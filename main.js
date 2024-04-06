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


/** @type { Payment [] } */
let payments = [];

const DOLLAR_TO_EURO_RATE = 0.92;


csvUploadField.addEventListener('change', async (e) => {
    console.log('changing');
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

    console.log(data);

    let rows = [...Array(100)].map(() => ({}));

    console.log(rows);

    for(const cellKey in sheet) {
        if (cellKey.startsWith('!')) {
            continue;
        }
        const column = cellKey.substring(0, 1);
        const row = parseInt(cellKey.substring(1, cellKey.length));
        console.log('column:', column);
        console.log('row: ', row);
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

    console.log('title: ', title);

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

    console.log(payments);

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

// const hideTable