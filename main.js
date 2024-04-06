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
const clientsTable = document.getElementById('clients-table')


/** @type { Payment [] } */
let payments = [];

const DOLLAR_TO_EURO_RATE = 0.92;


csvUploadField.addEventListener('change', async (e) => {
    csvUploadFieldError.innerHTML = '';
    const target = /** @type { HTMLInputElement } */ (e.target);

    const file = /** @type { File } */ (e.target.files[0]);

    try {
        if(file) {
            if(file.type !== 'text/csv') {
                throw new Error('Incorrect file type. Supported file type is only CSV')
            }
            payments = await parseCSVFile(file);
            renderTable(payments);
            renderClientsTable(payments);
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
        'Paid (&euro;)'
    ]

    const tBody = document.createElement('tbody');

    for (payment of payments) {
        const row = createPaymentsTableRow(payment);
        tBody.appendChild(row);
    }

    const totalRow = document.createElement('tr');
    const emptyCell = document.createElement('td');
    emptyCell.colSpan = 3;
    const totalCol = document.createElement('td');
    const totalEur = payments.reduce((n, { amount }) => n + (amount * DOLLAR_TO_EURO_RATE), 0).toFixed(2);
    totalCol.innerHTML = totalEur;

    totalCol.classList.add('bold');

    totalRow.appendChild(emptyCell);
    totalRow.appendChild(totalCol);
    tBody.appendChild(totalRow);


    for (tHeadCol of tHeadCols) {
        const colElement = document.createElement('th');
        colElement.innerHTML = tHeadCol;
        tHeadRow.appendChild(colElement);
    }
    tHead.appendChild(tHeadRow);
    paymentsTable.appendChild(tHead)
    paymentsTable.appendChild(tBody);

    if(showTableIfHidden) {
        paymentsTable.classList.remove('hidden');
    }
}

/**
 * 
 * @param { Payment } payment 
 */
const createPaymentsTableRow = (payment) => {
    const row = document.createElement('tr');

    const columns = [
        payment.client,
        payment.date,
        payment.amount.toFixed(2),
        (payment.amount * DOLLAR_TO_EURO_RATE).toFixed(2)
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
        const totalAmountEuro = (totalAmountDollars * DOLLAR_TO_EURO_RATE).toFixed(2);

        clients.push({
            name: clientName,
            totalAmountDollars,
            totalAmountEuro
        })
    }

    const { tHead, tBody } = createTable(
        [
            'Client',
            'Total (&euro;)'
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

    clientsTable?.classList.remove('hidden');
}

// const hideTable