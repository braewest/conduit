const jwt = require('jsonwebtoken');
const { pool } = require('../db');
const { readBody, sendJSON } = require('../utils');

// Join session
async function join(req, res) {
    const { join_code, display_name } = await readBody(req);

    if (!join_code || !display_name)
        return sendJSON(res, 400, { error: 'join_code and display_name are required' });

    // Look for session in database
    const session = await pool.query(
        'SELECT * FROM sessions WHERE join_code = $1', [join_code]
    );
    if (!session.rows.length) // Return if no session found
        return sendJSON(res, 404, { error: 'Session not found' });

    // If session was found, create a player in the database
    const player = await pool.query(
        `INSERT INTO players (session_id, display_name)
         VALUES ($1, $2) RETURNING *`,
         [session.rows[0].id, display_name]
    );

    // Generate JSON Web Token
    const token = jwt.sign(
        { player_id: player.rows[0].id, session_id: session.rows[0].id },
        process.env.JWT_SECRET,
        { expiresIn: '7d' } // Currently limits session authorization to 7 days, should convert later to allow for sessions that stay open longer than 7 days
    );

    sendJSON(res, 200, { player: player.rows[0], token });
}

module.exports = { join };