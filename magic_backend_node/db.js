const mysql = require('mysql2');

const pool = mysql.createPool({
    host: 'gateway01.ap-southeast-1.prod.aws.tidbcloud.com', // TiDB se milega
    user: '9pd1sGZKNLrpdxJ.root',                                       // TiDB se milega
    password: 'TPIPBDUBNknTgzK8',                            // Jo abhi generate kiya
    database: 'restmagicfood',
    port: 4000,                                               // TiDB ka port
    ssl: {
        rejectUnauthorized: true                              // TiDB ke liye ye zaroori hai
    },
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

const promisePool = pool.promise();
console.log("✅ Connected to Cloud Database!");
module.exports = promisePool;