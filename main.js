//@ts-check

/**
 * @typedef { Object } Payment
 * @property { string } client
 * @property { string } date
 * @property { number } amount
 * @property { string } id
*/

const csvUploadField = document.getElementById('csv-upload');
const csvUploadFieldError = document.getElementById('csv-upload-error');
const paymentsTable = document.getElementById('payments-table');
const clientsTable = document.getElementById('clients-table');
const renderIfUploadedElement = document.getElementById('render-if-uploaded');
const taxDeductionsElement = document.getElementById('tax-deduction-fields')

// Options form
const optionsForm = document.getElementById('options')
const conversionRateInput = document.getElementById('conversion-rate');
const localCurrencySymbolInput = document.getElementById('local-currency');
const taxDeductionInput = document.getElementById('tax-deduction');

/** @type { Payment [] } */
let payments = [];
let conversionRate = 1;
let localCurrencySymbol = 'Euro'
let taxDeduction = 0.3;
let taxDeductions = {};
const defaultTaxDeduction = 0;

conversionRateInput.value = conversionRate;
localCurrencySymbolInput.value = localCurrencySymbol;
//taxDeductionInput.value = taxDeduction * 100;

optionsForm.addEventListener('submit', (e) => {
    e.preventDefault();
    conversionRate = conversionRateInput.value;
    localCurrencySymbol = localCurrencySymbolInput.value;
    const taxDeductionFields = /** @type { HTMLElement[] } */ (Array.from(taxDeductionsElement.children));
    for(taxDeductionField of taxDeductionFields) {
        console.log(taxDeductionField);
        const taxInput = taxDeductionField.querySelector('input');
        taxDeductions[taxDeductionField.dataset.client] = taxInput.value / 100;
    }
    // taxDeductionsElement.children;
    //taxDeduction = taxDeductionInput.value / 100;
    renderTable(payments);
    renderClientsTable(payments);
})


csvUploadField.addEventListener('change', async (e) => {
    csvUploadFieldError.innerHTML = '';
    const target = /** @type { HTMLInputElement } */ (e.target);

    const file = /** @type { File } */ (e.target.files[0]);

    renderIfUploadedElement.classList.add('hidden');


    try {
        if(file) {
            if(file.type !== 'text/csv') {
                throw new Error('Incorrect file type. Supported file type is only CSV')
            }
            payments = await parseCSVFile(file);
            renderTable(payments);
            renderClientsTable(payments);
            renderOptions();
            renderIfUploadedElement.classList.remove('hidden');
        }
    } catch (e) {
        csvUploadField.value = '';
        csvUploadFieldError.innerHTML = e.message;
    }  
})



/**
 * Parse Upwork CSV file and convert it to an object
 * 
 * @param { File } file
 */
const parseCSVFile = async (file) => {
    const fileBuffer = await file.arrayBuffer()
    const data = XLSX.read(fileBuffer);

    const sheet = data.Sheets.Sheet1;

    let rows = [...Array(100)].map(() => ({}));

    for(const cellKey in sheet) {
        if (cellKey.startsWith('!')) {
            continue;
        }
        const column = cellKey.substring(0, 1);
        const row = parseInt(cellKey.substring(1, cellKey.length));
        rows[row - 1][column] = sheet[cellKey];
    }

    rows.shift();

    let parsedRows = [];

    for(const row of rows) {
        const parsedRow = parseRow(row);

        if(parsedRow) {
            parsedRows.push(parsedRow)
        }
    }

    return parsedRows;
}

/**
 * Parse a CSV row and convert it into a payment object
 * @param row 
 * 
 * @returns { Payment }
 */
const parseRow = (row) => {

    if(!row.G) {
        return null;
    }

    const title = /** @type { string } */ (row.D.v);


    if (!title || !title.includes('Invoice')) {
        return null;
    }

    return ({
        client: row.G.v,
        amount: parseFloat(row.J.v),
        date: row.A.w,
        id: row.B.v
    })
}

const getClientTax = (clientName) => {
    return taxDeductions[clientName] || 0;
}

/**
 * Render the payments table on the page
 * 
 * @param { Payment[] } payments
 */
const renderTable = (payments, showTableIfHidden = true) => {

    paymentsTable.innerHTML = '';

    const tHead = document.createElement('thead');
    const tHeadRow = document.createElement('tr');
    
    const tHeadCols = [
        'Client',
        'Date',
        'Paid ($)',
        `Paid (${localCurrencySymbol})`,
        `Taxed (${localCurrencySymbol})`,
        `Paid (${localCurrencySymbol}) after tax`
    ]

    const tBody = document.createElement('tbody');

    let totalLocalAfterTax = 0;

    for (payment of payments) {
        const row = createPaymentsTableRow(payment);
        tBody.appendChild(row);
        totalLocalAfterTax += payment.amount * conversionRate * (1 - getClientTax(payment.client));
    }

    const totalRow = document.createElement('tr');
    const emptyCell = document.createElement('td');
    emptyCell.colSpan = 3;
    // const emptyCell2 = document.createElement('td');
    const totalCol = document.createElement('td');
    const totalEur = payments.reduce((n, { amount }) => n + (amount * conversionRate), 0).toFixed(2);
    const totalAfterTaxCol = document.createElement('td');
    totalLocalAfterTax = totalLocalAfterTax.toFixed(2);
    const totalTaxCol = document.createElement('td');
    const totalTax = (totalEur - totalLocalAfterTax).toFixed(2);
    totalCol.innerHTML = totalEur;
    totalTaxCol.innerHTML = totalTax;
    totalAfterTaxCol.innerHTML = totalLocalAfterTax;

    totalCol.classList.add('bold');
    totalTaxCol.classList.add('bold');
    totalAfterTaxCol.classList.add('bold');

    totalRow.appendChild(emptyCell);
    totalRow.appendChild(totalCol);
    totalRow.appendChild(totalTaxCol);
    totalRow.appendChild(totalAfterTaxCol);
    tBody.appendChild(totalRow);


    for (tHeadCol of tHeadCols) {
        const colElement = document.createElement('th');
        colElement.innerHTML = tHeadCol;
        tHeadRow.appendChild(colElement);
    }
    tHead.appendChild(tHeadRow);
    paymentsTable.appendChild(tHead)
    paymentsTable.appendChild(tBody);
}

const renderOptions = () => {
    const clients = getClients(payments);
    taxDeductionsElement.innerHTML = "";
    for (client of clients) {
        const field = createTaxDeductionField(client);
        taxDeductionsElement.appendChild(field);
    }
}

/**
 * Get unique clients from a payments object
 */
const getClients = (payments) => {
    const clientNames = [];

    payments.map(payment => {
        if (!clientNames.includes(payment.client)) {
            clientNames.push(payment.client);
        }
    })

    return clientNames;

}

const createTaxDeductionField = (clientName) => {
    const fieldID = 'tax-deduction-' + kebabCase(clientName)
    const field = document.createElement('div');
    field.classList.add('input-container');
    field.dataset.client = clientName;
    field.innerHTML = `
        <label for='${fieldID}'>Tax deduction (percent) for ${clientName}</label>
        <div>
            <input value='${defaultTaxDeduction}' name='${fieldID}' id='${fieldID}' type='number' step='1' min='0' max='100'/>
            <span>%</span>
        </div>
    `

    return field;
}

const kebabCase = string => string
    .replace(/([a-z])([A-Z])/g, "$1-$2")
    .replace(/[\s_]+/g, '-')
    .toLowerCase();

/**
 * 
 * @param { Payment } payment 
 */
const createPaymentsTableRow = (payment) => {
    const row = document.createElement('tr');

    console.log(taxDeductions);
    console.log(payment.client)
    const taxDeduction = taxDeductions[payment.client] || 0;

    const amountLocal = (payment.amount * conversionRate).toFixed(2)
    const amountLocalAfterTax = (payment.amount * (1 - taxDeduction) * conversionRate).toFixed(2)

    const columns = [
        payment.client,
        payment.date,
        payment.amount.toFixed(2),
        amountLocal,
        (amountLocal - amountLocalAfterTax).toFixed(2),
        amountLocalAfterTax
    ]

    for (column of columns) {
        const colElement = document.createElement('td');
        colElement.innerHTML = column;
        row.appendChild(colElement);
    }

    return row;
}

const createTableHead = (cols) => {
    const tHead = document.createElement('thead');
    const tHeadRow = document.createElement('tr');

    for (tHeadCol of cols) {
        const colElement = document.createElement('th');
        colElement.innerHTML = tHeadCol;
        tHeadRow.appendChild(colElement);
    }

    tHead.appendChild(tHeadRow);

    return tHead;
}

const createTableRow = (cols) => {
    const row = document.createElement('tr');
    for (column of cols) {
        const colElement = document.createElement('td');
        colElement.innerHTML = column;
        row.appendChild(colElement);
    }
    return row;
}

const createTable = (headCols, rows) => {
    const tHead = createTableHead(headCols);
    const tBody = document.createElement('tbody');
    
    for (row of rows) {
        const rowElement = createTableRow(row);
        tBody.appendChild(rowElement);
    }

    return {
        tHead,
        tBody
    }
}

/**
 * @typedef { Object } Client
 * 
 * @property { string } name
 * @property { number } totalAmountDollars
 * @property { number } totalAmountEuro
 */

/**
 * @type { Payment[] } payments
 */
const renderClientsTable = (payments) => {

    const clientNames = [];

    payments.map(payment => {
        if (!clientNames.includes(payment.client)) {
            clientNames.push(payment.client);
        }
    })

    /** @type { Client[]} */
    const clients = [];

    for(clientName of clientNames) {
        const totalAmountDollars = payments.filter(payment => payment.client == clientName).reduce((n, { amount }) => n + (amount), 0).toFixed(2)
        const totalAmountEuro = (totalAmountDollars * conversionRate).toFixed(2);

        clients.push({
            name: clientName,
            totalAmountDollars,
            totalAmountEuro
        })
    }

    const { tHead, tBody } = createTable(
        [
            'Client',
            `Total (${localCurrencySymbol})`
        ],
        clients.map(client => [
            client.name,
            client.totalAmountEuro
        ])
    )


    clientsTable.innerHTML = '';

    console.log(tHead);
    
    clientsTable.appendChild(tHead);
    clientsTable.appendChild(tBody);
}

// const hideTable