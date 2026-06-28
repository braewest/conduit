const jwt = require('jsonwebtoken');
const { sendJSON } = require('../utils');

// Verify API key
function requireApiKey(req, res) {
    const key = req.headers['x-api-key'];
    if (key !== process.env.API_KEY) {
        sendJSON(res, 401, { error: 'Invalid API key' });
        return false;
    }
    return true;
}

// Verify JWT
function verifyToken(req, res) {
    const auth = req.headers['authorization'] || '';
    const token = auth.replace('Bearer ', '');
    try {
        // Check if the JWT is valid
        return jwt.verify(token, process.env.JWT_SECRET);
    } catch {
        sendJSON(res, 401, { error: 'Invalid or expired token' });
        return null;
    }
}

module.exports = { requireApiKey, verifyToken };