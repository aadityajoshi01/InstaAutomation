const express = require('express');
const { dmQueue } = require('../services/queue.service');
const { verifyMetaSignature } = require('../middleware/security');
const config = require('../config/env');

const router = express.Router();

// Webhook test endpoints
router.get('/test', (req, res) => {
    res.json({ status: 'Webhook route is operational' });
});

router.get('/', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === config.meta.verifyToken) {
        res.status(200).send(challenge);
    } else {
        res.sendStatus(403);
    }
});

router.post('/', verifyMetaSignature, async (req, res) => {
    const body = req.body;

    if (body.object === 'instagram') {
        res.status(200).send('EVENT_RECEIVED');

        try {
            for (const entry of body.entry) {
                const igUserId = entry.id;
                for (const change of entry.changes) {
                    if (change.field === 'comments') {
                        const commentData = change.value;
                        
                        const commentId = commentData.id;
                        const text = (commentData.text || '').toLowerCase();
                        const userId = commentData.from?.id;
                        const username = commentData.from?.username || 'unknown';
                        const reelId = commentData.media?.id || null;

                        if (!userId) continue;

                        dmQueue.add({
                            commentId, userId, username, text, igUserId, reelId
                        });
                    }
                }
            }
        } catch (error) {
            console.error('[Error] Webhook processing failed:', error);
        }
    } else {
        res.sendStatus(404);
    }
});

module.exports = router;
