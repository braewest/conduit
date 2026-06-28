const { Pool } = require('pg');

// Opening a reusable database connection pool for server requests
const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

module.exports = { pool };