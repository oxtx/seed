const mysql = require('mysql2/promise'); // Use mysql2 for Promise support
require('dotenv').config();

// console.log("dotenv", process.env.DB_HOST);

// Create a connection pool using environment variables
const pool = mysql.createPool({
    connectionLimit: 10,  
    host: process.env.DB_HOST,       // Database host
    user: process.env.DB_USER,       // Database username
    password: process.env.DB_PASSWORD, // Database password
    database: process.env.DB_NAME,   // Database name
    port: process.env.DB_PORT        // Database port (optional, default is 3306)
});

module.exports = { pool };
