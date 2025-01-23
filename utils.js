const dumyData = [
    {
        title: 'PV Roadway Mix Nitrocoated',
        table: [
            {
                percentage_pure: 29.76,
                name: 'FESCUE, TALL',
                variety: 'Fawn',
                G_D_or_H: '97 + 0 = 97',
                origin: 'OR'
            },
            {
                percentage_pure: 29.62,
                name: 'FESCUE, TALL',
                variety: 'Adventure II',
                G_D_or_H: '92 + 0 = 92',
                origin: 'OR'
            },
            {
                percentage_pure: 11.44,
                name: 'CLOVER, STRAWBERRY',
                variety: 'Palestine NCO',
                G_D_or_H: '91 + 4 = 95',
                origin: 'OR'
            },
            {
                percentage_pure: 11.18,
                name: 'CLOVER, WHITE',
                variety: 'New Zealand NCO',
                G_D_or_H: '88 + 8 = 96',
                origin: 'AUS'
            },
            {
                percentage_pure: 4.92,
                name: 'BLUEGRASS, KENTUCKY',
                variety: 'Kentucky',
                G_D_or_H: '85 + 0 = 85',
                origin: 'DNK'
            }
        ],
        Other_Crop: 0.28,
        Inert_Matter: 12.77,
        Weed_Seed: 0.02,
        date_tested: '13-Mar-24',
        Hard_Seed: 2.08,
        Coverage: '50.000 x Bulk',
        Weight: { PLS: '40.95 lbs (PLS)', Bulk: '50.00 lbs (Bulk)' },
        Noxious: 0,
        Lot: null,
        Order: '713345',
        Mix: '284518'
    },
]

function formatString(input) {
    // Remove spaces for easier processing
    input = input.replace(/\s+/g, '');

    // Match numbers and operators using regex
    const match = input.match(/^(\d+)([+\-*/]?)(\d+|[A-Za-z]*)=?(\d+|[A-Za-z]*)$/);

    if (!match) {
        throw new Error('Invalid input format');
    }

    // Extract components from the match
    const num1 = parseInt(match[1], 10); // First number
    const operator = match[2];          // Operator (e.g., +, -, *, /)
    const num2 = isNaN(match[3]) ? 0 : parseInt(match[3], 10); // Second number or replace non-numeric with 0
    const result = isNaN(match[4]) ? 0 : parseInt(match[4], 10); // Result number or replace non-numeric with 0

    return [num1, num2, result || calculateResult(num1, num2, operator)];
}

// Helper function to calculate the result if it's missing
function calculateResult(num1, num2, operator) {
    switch (operator) {
        case '+':
            return num1 + num2;
        case '-':
            return num1 - num2;
        case '*':
            return num1 * num2;
        case '/':
            return num2 !== 0 ? Math.floor(num1 / num2) : 0; // Avoid division by 0
        default:
            return num1; // If no operator, assume the result is the first number
    }
}

function validation(data) {

    let percentage = 0;

    for (let i = 0; i < data.table.length; i++) {
        percentage += data.table[i].percentage_pure*1000;
    }
    percentage = percentage + data.Other_Crop*1000 + data.Inert_Matter*1000+ data.Weed_Seed*1000  + data.Noxious*1000;
    if (percentage/1000 == 100) {
        return true;
    } else {
        return false
    }
}

// console.log(validation(dumyData[0]));

function formatDate(inputDate) {
    // Split the input date into parts
    const [day, month, year] = inputDate.split('-');

    // Define a mapping of month abbreviations to their numeric values
    const monthMap = {
        jan: '01',
        feb: '02',
        mar: '03',
        apr: '04',
        may: '05',
        jun: '06',
        jul: '07',
        aug: '08',
        sep: '09',
        oct: '10',
        nov: '11',
        dec: '12',
    };

    // Get the numeric value of the month
    const numericMonth = monthMap[month.toLowerCase()];

    // Add "20" to the year to convert it to 4 digits
    const fullYear = `20${year}`;

    // Return the formatted date with the day always as "01"
    return `${fullYear}-${numericMonth}-01`;
}

// Example usage
// const input = "13-Mar-24";
// const formattedDate = formatDate(input);
// console.log(formattedDate); // Output: 2024-03-01

// console.log(formatDate('01-OCT-24'));

module.exports = { validation, formatDate, formatString }