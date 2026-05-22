const crypto = require('crypto');
const config = require('../config/env');

function verifyMetaSignature(req, res, next) {
    const signature = req.headers['x-hub-signature-256'];
    
    if (!signature) {
        console.warn('[Security] Rejecting unsigned request');
        return res.status(403).send('Signature required');
    }

    const expectedSignature = 'sha256=' + crypto.createHmac('sha256', config.meta.appSecret)
        .update(req.rawBody)
        .digest('hex');

    const signatureBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expectedSignature);

    if (signatureBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) {
        console.warn('[Security] Rejecting request with invalid signature');
        return res.status(403).send('Invalid signature');
    }

    next();
}

function basicAuth(req, res, next) {
    const b64auth = (req.headers.authorization || '').split(' ')[1] || '';
    const [login, password] = Buffer.from(b64auth, 'base64').toString().split(':');

    if (login && password && login === config.admin.username && password === config.admin.password) {
        return next();
    }

    res.set('WWW-Authenticate', 'Basic realm="401"');
    res.status(401).send('Authentication required.');
}

module.exports = {
    verifyMetaSignature,
    basicAuth
};
