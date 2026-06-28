const { pool } = require('../db');
const { readBody, sendJSON } = require('../utils');
const { requireApiKey } = require('../middleware/auth');

function randomCode() {
    // Generate a random string and take 6 letters
    return Math.random().toString(36).substring(2, 8).toUpperCase
}

// Create a session in the database
async function create(req, res) {
    // Require API key
    if (!requireApiKey(req, res)) return;
    // Retrieve request data
    const body = await readBody(req);
    const code = randomCode();
    // Create session
    const result = await pool.query(
        `INSERT INTO sessions (join_code, metadata)
         VALUES ($1, $2) RETURNING *`,
         [code, body.metadata || {}]
    );
    sendJSON(res, 201, result.rows[0]); // Return session data
}

// Get session data
async function get(req, res, sessionId) {
    const result = await pool.query(
        'SELECT * FROM sessions WHERE id = $1',
        [sessionId]
    );
    if (!result.rows.length)
        return sendJSON(res, 404, { error: 'Session not found' });
    sendJSON(res, 200, result.rows[0]);
}

module.exports = { create, get };