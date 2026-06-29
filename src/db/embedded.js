const path = require('path');
const fs = require('fs');

const DB_DIR  = path.join(process.cwd(), 'data', 'pg');
const DB_USER = 'conduit';
const DB_PASS = 'conduit';
const DB_PORT = 5433;
const DB_NAME = 'conduit';

async function startEmbeddedPostgres() {
    // embedded-postgres is ESM-only, so use dynamic import from CJS
    const { default: EmbeddedPostgres } = await import('embedded-postgres');

    const pg = new EmbeddedPostgres({
        databaseDir: DB_DIR,
        user: DB_USER,
        password: DB_PASS,
        port: DB_PORT,
        persistent: true,
    });

    // PG_VERSION file marks an already-initialized data directory
    const initialized = fs.existsSync(path.join(DB_DIR, 'PG_VERSION'));
    if (!initialized) await pg.initialise();
    await pg.start();

    try {
        await pg.createDatabase(DB_NAME);
    } catch {
        // database already exists, continue
    }

    process.env.DATABASE_URL =
        `postgresql://${DB_USER}:${DB_PASS}@localhost:${DB_PORT}/${DB_NAME}`;
}

module.exports = { startEmbeddedPostgres };
