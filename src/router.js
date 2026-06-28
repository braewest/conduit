const sessions = require('./handlers/sessions');
const players = require('./handlers/players');
const events = require('./handlers/events');
const assets = require('./handlers/assets');
const { sendJSON } = require('./utils');

// The router handles all incoming traffic. It looks for a HTTP method and URL path, then calls the right handler for the request.
async function router(req, res) {
    // Retrieve the url information for handling
    const url = new URL(req.url, `http://${req.headers.host}`);
    const path = url.pathname;
    const method = req.method;
    const parts = path.split('/').filter(Boolean);

    // Find corresponding handler
    try {
        // POST /sessions - create a new game session, returns sessions_id and join_code
        if (method === 'POST' && path === '/sessions')
            return await sessions.create(req, res);

        // POST /sessions/join - join a session via join_code, returns player_id and JWT
        if (method === 'POST' && path === '/sessions/join')
            return await players.join(req, res);

        // GET /sessions/:id - get session info and current snapshot
        if (method === 'GET' && parts[0] === 'sessions' && parts.length === 2)
            return await sessions.get(req, res, parts[1]);

        // GET /sessions/:id/events?after=N - get event log, optionally filtered by sequence number
        if (method === 'GET' && parts[0] === 'session' && parts[2] === 'events')
            return await events.list(req, res, parts[1], url.searchParams);

        // POST /sessions/:id/assets - upload a custom asset for a session
        if (method === 'POST' && parts[0] === 'session' && parts[2] === 'assets')
            return await assets.create(req, res, parts[1]);

        // GET /sessions/:id/assets - retrieve all assets for a session
        if (method === 'GET' && parts[0] === 'session' && parts[2] === 'assets')
            return await assets.list(req, res, parts[1]);

        sendJSON(res, 404, { error: 'Not found' });
    } catch (err) {
        console.error(err);
        sendJSON(res, 500, { error: 'Internal server error' });
    }
}

module.exports = { router };