const CORS_HEADERS = {
    'Access-Control-Allow-Origin':  process.env.CORS_ORIGIN || '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
};

// Collects user request body chunks into a parsed JS object
function readBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => body += chunk.toString());
        req.on('end', () => {
            if (!body) return resolve({});
            try { resolve(JSON.parse(body)); }
            catch { reject(new Error('Invalid JSON')); }
        });
        req.on('error', reject);
    });
}

// Sends a JSON response with CORS headers and the given status code
function sendJSON(res, status, data) {
    res.writeHead(status, { 'Content-Type': 'application/json', ...CORS_HEADERS });
    res.end(JSON.stringify(data));
}

// Sends a guaranteed { error: string } response — use for all error paths
function sendError(res, status, message) {
    sendJSON(res, status, { error: String(message) });
}

module.exports = { readBody, sendJSON, sendError };
