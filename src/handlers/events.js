const { pool } = require('../db');
const { sendJSON } = require('../utils');
const { verifyToken } = require('../middleware/auth');

// List all event after specified sequence number
async function list(req, res, sequenceId, params) {
    const player = verifyToken(req, res);
    if (!player) return;
    const after = parseInt(params.get('after') || '0')
    const result = await pool.query(
        `SELECT * FROM events
         WHERE session_id = $1 AND sequence_number > $2
         ORDER BY sequence_number ASC`,
         [sequenceId, after]
    );
    sendJSON(res, 200, result.rows);
}

module.exports = { list };