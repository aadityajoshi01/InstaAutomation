const { Queue } = require('bullmq');
const Redis = require('ioredis');
const config = require('./env');

const redisOptions = {
    maxRetriesPerRequest: null, // Required by BullMQ
    ...(config.redis.url.startsWith('rediss://') && { tls: { rejectUnauthorized: false } })
};

const connection = new Redis(config.redis.url, redisOptions);

const dmQueue = new Queue('dm-processing', { connection });
const broadcastQueue = new Queue('broadcast-processing', { connection });

module.exports = {
    redisConnection: connection,
    dmQueue,
    broadcastQueue
};
