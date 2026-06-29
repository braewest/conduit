require('dotenv').config();

async function start() {
    // Start embedded Postgres if no external DATABASE_URL is provided
    if (!process.env.DATABASE_URL) {
        const { startEmbeddedPostgres } = require('./db/embedded');
        await startEmbeddedPostgres();
    }

    // Require DB-dependent modules only after DATABASE_URL is set
    const http = require('http');
    const { router } = require('./router');
    const { initWebSocket } = require('./ws');
    const { initDB } = require('./db/init');

    const server = http.createServer(router);
    initWebSocket(server);

    await initDB();

    server.listen(process.env.PORT, () => {
        console.log(`Server running on port ${process.env.PORT}`);
    });
}

start().catch((err) => {
    console.error('Startup failed:', err.message);
    process.exit(1);
});
