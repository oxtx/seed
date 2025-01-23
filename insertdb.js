const { pool } = require('./dbconnect');
const { formatDate, formatString } = require('./utils');


const dumyPartNumber = "DP450";

async function insertSeedData(data) {
    let connection; // Declare the connection variable

    try {
        // Attempt to get a connection from the pool
        connection = await pool.getConnection();

        const [partResults] = await connection.query(`SELECT * FROM inventory WHERE Part_Number='${dumyPartNumber}'`);

        if (partResults.length > 0) {
            console.log('Part Number already exists in the database.');
            const part_desc = partResults[0].Description;
            const lotNum = data.Lot ?? data.Mix;
            // console.log('Data', data)
            // console.log('lotNum', lotNum, data.Lot, data.Mix);

            const [lotResults] = await connection.query(`SELECT * FROM partnumbers, ingredients WHERE partnumbers.Lot = ingredients.Lot AND partnumbers.Part_Number LIKE '${dumyPartNumber}' AND partnumbers.Lot LIKE '${lotNum}'`);

            if (lotResults.length > 0) {
                console.log('Lot Number already exists in the database.');
            } else {
                console.log('Lot Number does not exist in the database.');
                const insert_partnumber_query = `INSERT INTO partnumbers (Lot, Part_Number, Description, Other_Crop, Inert_Matter, Weed_Seed, Noxious_Weeds, Origin, Unit, Nitro, Organic, Received) VALUES ('${lotNum}', '${dumyPartNumber}', '${part_desc}', '${data.Other_Crop}', '${data.Inert_Matter}', '${data.Weed_Seed}', '${data.Noxious}', '${data.table.map(item=>item.origin).join(', ')}', '${data.Weight ? 'lbs' : 'oz'}', 'No', 'No', 1)`;
                const [insertedData] = await connection.query(insert_partnumber_query);
                console.log('Correctly inserted in database Partnumber table.');
                console.log('inserted Data', insertedData.insertId);
                for(let i=0;i<data.table.length;i++){
                    const insert_ingredients_query = `INSERT INTO ingredients (Lot, Pure_Seed, Name, Germination, Hard_Seed, Total, Test_Date, Partner) VALUES ('${lotNum}', '${data.table[i].percentage_pure}', '${data.table[i].name}', '${formatString(data.table[i].G_D_or_H)[0]}', '${formatString(data.table[i].G_D_or_H)[1]}', '${formatString(data.table[i].G_D_or_H)[2]}', '${formatDate(data.date_tested)}','${insertedData.insertId}')`;

                    const [insertedData1] = await connection.query(insert_ingredients_query);
                    console.log('Correctly inserted in database ingredients table.');
                }
            }
        } else {
            console.log('Part Number does not exist in the database.');
        }
    } catch (error) {
        console.error('Error executing query:', error.stack);
    } finally {
        // Release the connection only if it was successfully acquired
        if (connection) {
            connection.release();
        }
    }
}

module.exports = { insertSeedData };
