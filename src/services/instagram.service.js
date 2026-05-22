const axios = require('axios');
const config = require('../config/env');

async function sendPrivateReply(igUserId, commentId, messageText) {
    try {
        const response = await axios.post(`https://graph.facebook.com/${config.meta.igVersion}/${igUserId}/messages`, {
            recipient: { comment_id: commentId },
            message: { text: messageText }
        }, {
            headers: {
                'Authorization': `Bearer ${config.meta.accessToken}`,
                'Content-Type': 'application/json'
            }
        });
        return response.data;
    } catch (error) {
        throw new Error(error.response?.data?.error?.message || error.message);
    }
}

async function sendDirectMessage(igUserId, recipientIgId, messageText) {
    try {
        const response = await axios.post(`https://graph.facebook.com/${config.meta.igVersion}/${igUserId}/messages`, {
            recipient: { id: recipientIgId },
            message: { text: messageText }
        }, {
            headers: {
                'Authorization': `Bearer ${config.meta.accessToken}`,
                'Content-Type': 'application/json'
            }
        });
        return response.data;
    } catch (error) {
        throw new Error(error.response?.data?.error?.message || error.message);
    }
}

module.exports = {
    sendPrivateReply,
    sendDirectMessage
};
