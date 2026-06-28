const { pool } = require('../db');

// sessionId -> Map(playerId -> WebSocket)
const sessions = new Map();

// Add socket connection for session
function addSocket(sessionId, playerId, socket) {
    if (!sessions.has(sessionId)) sessions.set(sessionId, new Map());
    sessions.get(sessionId).set(playerId, socket);
}

// Remove socket connection from session
function removeSocket(sessionId, playerId) {
    sessions.get(sessionId)?.delete(playerId);
}

// Relay data to all other players in session
async function relay(sessionId, fromPlayerId, event, pool) {
    // Persist the event, atomically claiming the next sequence number
    const saved = await pool.query(
        `INSERT INTO events
            (session_id, from_player_id, type, payload, sequence_number)
        VALUES ($1, $2, $3, $4,
            COALESCE((SELECT MAX(sequence_number) FROM events WHERE session_id = $1), 0) + 1
        ) RETURNING *`,
        [sessionId, fromPlayerId, event.type, event.payload]
    );

    const outbound = JSON.stringify(saved.rows[0]); // Outbound message
    const peers = sessions.get(sessionId); // All players in session
    if (!peers) return;
    
    // Broadcast to everyone except the sender
    peers.forEach((socket, pid) => {
        if (pid !== fromPlayerId && socket.readyState === 1)
            socket.send(outbound);
    });
}

module.exports = { addSocket, removeSocket, relay };