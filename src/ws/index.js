const { WebSocketServer } = require('ws');
const jwt = require('jsonwebtoken');
const { relay, addSocket, removeSocket } = require('./relay');
const { pool } = require('../db');

// Initiate web socket server
function initWebSocket(server) {
    const wss = new WebSocketServer({ server });

    // On connection, verify player has authorization to connect to server
    wss.on('connection', async (socket, req) => {
        const url = new URL(req.url, `http://localhost`);
        const token = url.searchParams.get('token');
        const lastSeq = parseInt(url.searchParams.get('after') || '0');

        let player;
        try {
            player = jwt.verify(token, process.env.JWT_SECRET);
        } catch {
            socket.close(4001, 'Unauthorized');
            return;
        }

        // Create socket and send any missed events in event of a reconnection
        addSocket(player.session_id, player.player_id, socket);
        await sendMissedEvents(socket, player.session_id, lastSeq);

        // On socket message, relay data to other players
        socket.on('message', async (data) => {
            try {
                const event = JSON.parse(data);
                await relay(player.session_id, player.player_id, event, pool);
            } catch (err) {
                socket.close(4002, 'Bad request');
            }
        });

        // On socket close, remove socket connection
        socket.on('close', () => {
            removeSocket(player.session_id, player.player_id);
        });
    });
}

// Send all missed events to socket
async function sendMissedEvents(socket, sessionId, afterSeq) {
    const result = await pool.query(
        `SELECT * FROM events
         WHERE session_id = $1 AND sequence_number > $2
         ORDER BY sequence_number ASC`,
         [sessionId, afterSeq]
    );
    result.rows.forEach(e => socket.send(JSON.stringify(e))); // Send each event in order to the player
}

module.exports = { initWebSocket };