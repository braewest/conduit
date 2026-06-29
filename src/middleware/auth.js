const jwt = require('jsonwebtoken');
const { sendError } = require('../utils');

// Verify API key
function requireApiKey(req, res) {
    const key = req.headers['x-api-key'];
    if (key !== process.env.API_KEY) {
        sendError(res, 401, 'Invalid API key');
        return false;
    }
    return true;
}

// Verify JWT
function verifyToken(req, res) {
    const auth = req.headers['authorization'] || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    try {
        return jwt.verify(token, process.env.JWT_SECRET);
    } catch {
        sendError(res, 401, 'Invalid or expired token');
        return null;
    }
}

module.exports = { requireApiKey, verifyToken };