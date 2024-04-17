//@ts-check

/**
 * @typedef { Object } Payment
 * @property { string } client
 * @property { string } date
 * @property { number } amount
 * @property { string } id
*/

/**
 * @typedef { Object } Settings
 * @property { number } conversionRate
 * @property { string } localCurrencySymbol
 * @property { { [clientName: string]: number } } taxDeductions
 */

const csvUploadField = /** @type { HTMLInputElement } */ (document.getElementById('csv-upload'));
const csvUploadFieldError = /** @type { HTMLSpanElement } */ (document.getElementById('csv-upload-error'));
const paymentsTable = /** @type { HTMLTableElement } */ (document.getElementById('payments-table'));
const clientsTable = /** @type { HTMLTableElement } */ (document.getElementById('clients-table'));
const renderIfUploadedElement = /** @type { HTMLDivElement } */ (document.getElementById('render-if-uploaded'));
const taxDeductionsElement = /** @type { HTMLDivElement } */ (document.getElementById('tax-deduction-fields'))

// Options form
const optionsForm = /** @type { HTMLFormElement } */ (document.getElementById('options'));
const conversionRateInput = /** @type { HTMLInputElement } */ (document.getElementById('conversion-rate'));
const localCurrencySymbolInput = /** @type { HTMLInputElement } */ (document.getElementById('local-currency'));
// const taxDeductionInput = document.getElementById('tax-deduction');

if(
    !optionsForm || 
    !conversionRateInput ||
    !localCurrencySymbolInput
) {
    throw new Error('DOM element not found')
}

/** @type { Payment [] } */
let payments = [];
//let conversionRate = 1;
//let localCurrencySymbol = htmlEntityToCharacter('&euro;');
//let taxDeductions = {};

/**
 * @returns { Settings }
 */
const getSettingsFromStorage = () => {
    const settingsStr = localStorage.getItem('upwork-csv:settings');
    if(!settingsStr) {
        /**
         * @type { Settings }
         */
        const settings = { ...DEFAULT_SETTINGS };
        localStorage.setItem('upwork-csv:settings', JSON.stringify(settings));
        return settings;
    }
    return JSON.parse(settingsStr);
}

const saveSettingsToStorage = (settings) => {
    localStorage.setItem('upwork-csv:settings', JSON.stringify(settings));
}

/** @type { Settings } */
const settings = getSettingsFromStorage();
const defaultTaxDeduction = 0;

const DEFAULT_SETTINGS = {
    conversionRate: 1,
    localCurrencySymbol: htmlEntityToCharacter('&euro;'),
    taxDeductions: {}
}

conversionRateInput.value = settings.conversionRate.toString();
localCurrencySymbolInput.value = settings.localCurrencySymbol;
//taxDeductionInput.value = taxDeduction * 100;

optionsForm.addEventListener('submit', (e) => {
    e.preventDefault();
    settings.conversionRate = parseFloat(conversionRateInput.value);
    settings.localCurrencySymbol = localCurrencySymbolInput.value;
    const taxDeductionFields = /** @type { HTMLElement[] } */ (Array.from(taxDeductionsElement.children));
    for(const taxDeductionField of taxDeductionFields) {
        console.log(taxDeductionField);
        const taxInput = /** @type { HTMLInputElement } */ (taxDeductionField.querySelector('input'));
        const clientName = taxDeductionField.dataset.client;
        if(typeof clientName !== 'string') {
            console.warn('No client name specified in field\'s dataset')
            continue;
        }
        settings.taxDeductions[clientName] = parseFloat(taxInput.value) / 100;
    }
    // taxDeductionsElement.children;
    //taxDeduction = taxDeductionInput.value / 100;
    saveSettingsToStorage(settings);
    renderTable(payments);
    renderClientsTable(payments);
})



function htmlEntityToCharacter(str){
    var a = document.createElement('div');
    a.innerHTML = str;
    return a.innerHTML;
}

csvUploadField.addEventListener('change', async (e) => {
    csvUploadFieldError.innerHTML = '';
    const target = /** @type { HTMLInputElement } */ (e.target);

    if(!target.files?.length) {
        throw new Error('File not found')
    }
    const file = /** @type { File } */ (target.files[0]);

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
    //@ts-ignore
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
 * @returns { Payment | null }
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
    return settings.taxDeductions[clientName] || 0;
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
        `Paid (${settings.localCurrencySymbol})`,
        `Taxed (${settings.localCurrencySymbol})`,
        `Paid (${settings.localCurrencySymbol}) after tax`
    ]

    const tBody = document.createElement('tbody');

    /**
     * @type { number }
     */
    let totalLocalAfterTax = 0;

    for (const payment of payments) {
        const row = createPaymentsTableRow(payment);
        tBody.appendChild(row);
        totalLocalAfterTax += payment.amount * settings.conversionRate * (1 - getClientTax(payment.client));
    }

    const totalRow = document.createElement('tr');
    const emptyCell = document.createElement('td');
    emptyCell.colSpan = 3;
    // const emptyCell2 = document.createElement('td');
    const totalCol = document.createElement('td');
    const totalEur = payments.reduce((n, { amount }) => n + (amount * settings.conversionRate), 0);
    const totalAfterTaxCol = document.createElement('td');
    totalLocalAfterTax = totalLocalAfterTax;
    const totalTaxCol = document.createElement('td');
    const totalTax = (totalEur - totalLocalAfterTax).toFixed(2);
    totalCol.innerHTML = totalEur.toFixed(2);
    totalTaxCol.innerHTML = totalTax;
    totalAfterTaxCol.innerHTML = totalLocalAfterTax.toFixed(2);

    totalCol.classList.add('bold');
    totalTaxCol.classList.add('bold');
    totalAfterTaxCol.classList.add('bold');

    totalRow.appendChild(emptyCell);
    totalRow.appendChild(totalCol);
    totalRow.appendChild(totalTaxCol);
    totalRow.appendChild(totalAfterTaxCol);
    tBody.appendChild(totalRow);


    for (const tHeadCol of tHeadCols) {
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
    for (const client of clients) {
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

    const taxDeduction = settings.taxDeductions[payment.client] || 0;

    const amountLocal = (payment.amount * settings.conversionRate)
    const amountLocalAfterTax = (payment.amount * (1 - taxDeduction) * settings.conversionRate)

    const columns = [
        payment.client,
        payment.date,
        payment.amount.toFixed(2),
        amountLocal.toFixed(2),
        (amountLocal - amountLocalAfterTax).toFixed(2),
        amountLocalAfterTax.toFixed(2)
    ]

    for (const column of columns) {
        const colElement = document.createElement('td');
        colElement.innerHTML = column;
        row.appendChild(colElement);
    }

    return row;
}

const createTableHead = (cols) => {
    const tHead = document.createElement('thead');
    const tHeadRow = document.createElement('tr');

    for (const tHeadCol of cols) {
        const colElement = document.createElement('th');
        colElement.innerHTML = tHeadCol;
        tHeadRow.appendChild(colElement);
    }

    tHead.appendChild(tHeadRow);

    return tHead;
}

const createTableRow = (cols) => {
    const row = document.createElement('tr');
    for (const column of cols) {
        const colElement = document.createElement('td');
        colElement.innerHTML = column;
        row.appendChild(colElement);
    }
    return row;
}

const createTable = (headCols, rows) => {
    const tHead = createTableHead(headCols);
    const tBody = document.createElement('tbody');
    
    for (const row of rows) {
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
 * @param { Payment[] } payments
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

    for(const clientName of clientNames) {
        const totalAmountDollars = payments.filter(payment => payment.client == clientName).reduce((n, { amount }) => n + (amount), 0);
        const totalAmountEuro = (totalAmountDollars * settings.conversionRate);

        clients.push({
            name: clientName,
            totalAmountDollars,
            totalAmountEuro
        })
    }

    const { tHead, tBody } = createTable(
        [
            'Client',
            `Total (${settings.localCurrencySymbol})`,
            `Tax (${settings.localCurrencySymbol})`,
            `After Tax (${settings.localCurrencySymbol})`
        ],
        clients.map(client => {
            const taxPercentage = getClientTax(client.name);
            const taxAmount = (client.totalAmountEuro * taxPercentage);
            const totalAfterTax = (client.totalAmountEuro - taxAmount).toFixed(2)
            return [
                client.name,
                client.totalAmountEuro,
                taxAmount.toFixed(2),
                totalAfterTax
            ]
        })
    )


    clientsTable.innerHTML = '';

    console.log(tHead);
    
    clientsTable.appendChild(tHead);
    clientsTable.appendChild(tBody);
}

// const hideTable