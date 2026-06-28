// Collects user request body chunks into a parsed JS object
function readBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => body += chunk.toString()); // Chunk data to body
        req.on('end', () => { // When end of chunks, parse body to JS object
            if (!body) return resolve({});
            try { resolve(JSON.parse(body)); }
            catch { reject(new Error('Invalid JSON')); }
        });
        req.on('error', reject);
    });
}

// Sends a JSON response with the given status code
function sendJSON(res, status, data) {
    res.writeHead(status, { 'Content-Type': 'application/json' }); // header
    res.end(JSON.stringify(data)); // data
}

module.exports = { readBody, sendJSON };