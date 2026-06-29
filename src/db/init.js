const { pool } = require('./index');

// Initialize postgres database if not initialized
async function initDB() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS sessions (
            id          SERIAL PRIMARY KEY,
            join_code   VARCHAR(6) NOT NULL UNIQUE,
            metadata    JSONB NOT NULL DEFAULT '{}',
            created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS players (
            id           SERIAL PRIMARY KEY,
            session_id   INTEGER NOT NULL REFERENCES sessions(id),
            display_name TEXT NOT NULL,
            created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS events (
            id              SERIAL PRIMARY KEY,
            session_id      INTEGER NOT NULL REFERENCES sessions(id),
            from_player_id  INTEGER NOT NULL REFERENCES players(id),
            type            TEXT NOT NULL,
            payload         JSONB NOT NULL DEFAULT '{}',
            sequence_number INTEGER NOT NULL,
            created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS assets (
            id          SERIAL PRIMARY KEY,
            session_id  INTEGER NOT NULL REFERENCES sessions(id),
            type        TEXT NOT NULL,
            payload     JSONB NOT NULL DEFAULT '{}',
            created_by  INTEGER NOT NULL REFERENCES players(id),
            created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
    `);
}

module.exports = { initDB };
