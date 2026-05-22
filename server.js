const app = require('./src/app');
const config = require('./src/config/env');

app.listen(config.port, () => {
    console.log(`[System] SaaS Engine running on port ${config.port}`);
    console.log(`[System] Environment: ${config.env}`);
});
