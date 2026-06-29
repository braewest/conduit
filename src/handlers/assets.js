const { pool } = require('../db');
const { readBody, sendJSON } = require('../utils');
const { verifyToken } = require('../middleware/auth');

// Create asset for session
async function create(req, res, sessionId) {
    const player = verifyToken(req, res);
    if (!player) return;
    const body = await readBody(req);
    const result = await pool.query(
        `INSERT INTO assets (session_id, type, payload, created_by)
         VALUES ($1, $2, $3, $4) RETURNING *`,
         [sessionId, body.type, body.payload, player.player_id]
    );
    sendJSON(res, 201, result.rows[0]);
}

// List all assets in session
async function list(req, res, sessionId) {
    const result = await pool.query(
        `SELECT * FROM assets WHERE session_id = $1 ORDER BY created_at ASC`,
        [sessionId]
    );
    sendJSON(res, 200, result.rows);
}

module.exports = { create, list };