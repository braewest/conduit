'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const path = require('path');
const fs = require('fs');
const WebSocket = require('ws');

const { execSync } = require('child_process');

const TEST_DB_DIR = path.join(process.cwd(), 'data', 'test-pg');
const TEST_DB_PORT = 5434;
const TEST_PORT = 3099;
const BASE = `http://localhost:${TEST_PORT}`;

let pgInstance;
let server;

// Kill any leftover embedded-postgres process (Windows holds shared memory until the
// process exits; initdb will fail with "pre-existing shared memory block" otherwise)
function killStalePostgres() {
    try { execSync('taskkill /F /IM postgres.exe /T', { stdio: 'ignore' }); } catch {}
}

// ── Setup / Teardown ──────────────────────────────────────────────────────────

before(async () => {
    // Set env vars before any app modules are required so the pool picks them up
    process.env.DATABASE_URL = `postgresql://conduit:conduit@localhost:${TEST_DB_PORT}/conduit_test`;
    process.env.JWT_SECRET   = 'test-secret';
    process.env.API_KEY      = 'test-api-key';
    process.env.PORT         = String(TEST_PORT);

    // Kill any stale postgres from a previous killed run before wiping the directory.
    // On Windows, postgres holds a shared memory block keyed to the port — initdb
    // will fail with "pre-existing shared memory block" if that process is still alive.
    killStalePostgres();
    await new Promise(r => setTimeout(r, 1000)); // let Windows release the shared memory

    fs.rmSync(TEST_DB_DIR, { recursive: true, force: true });

    const { default: EmbeddedPostgres } = await import('embedded-postgres');

    pgInstance = new EmbeddedPostgres({
        databaseDir: TEST_DB_DIR,
        user:        'conduit',
        password:    'conduit',
        port:        TEST_DB_PORT,
        persistent:  true,
    });

    await pgInstance.initialise();
    await pgInstance.start();
    await pgInstance.createDatabase('conduit_test');

    // Require app modules only after DATABASE_URL is set
    const { router }   = require('../src/router');
    const { initWebSocket } = require('../src/ws');
    const { initDB }   = require('../src/db/init');

    await initDB();

    server = http.createServer(router);
    initWebSocket(server);
    await new Promise(resolve => server.listen(TEST_PORT, resolve));
});

after(async () => {
    if (server) {
        server.closeAllConnections();
        await new Promise(resolve => server.close(resolve));
        const { pool } = require('../src/db');
        await pool.end();
    }
    if (pgInstance) {
        await pgInstance.stop();
        fs.rmSync(TEST_DB_DIR, { recursive: true, force: true });
    }
});

// ── Helpers ───────────────────────────────────────────────────────────────────

async function post(path, body, headers = {}) {
    const res = await fetch(`${BASE}${path}`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body:    JSON.stringify(body),
    });
    return { status: res.status, body: await res.json() };
}

async function get(path, headers = {}) {
    const res = await fetch(`${BASE}${path}`, { headers });
    return { status: res.status, body: await res.json() };
}

// Creates a session and joins it as one player. Returns { session, player, token }.
async function scaffold() {
    const { body: session } = await post('/sessions', {}, { 'x-api-key': 'test-api-key' });
    const { body: joined }  = await post('/sessions/join', {
        join_code:    session.join_code,
        display_name: 'Player1',
    });
    return { session, player: joined.player, token: joined.token };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test('POST /sessions creates a session', async () => {
    const { status, body } = await post('/sessions', { metadata: { name: 'Test' } }, { 'x-api-key': 'test-api-key' });
    assert.equal(status, 201);
    assert.ok(body.id);
    assert.equal(body.join_code.length, 6);
    assert.deepEqual(body.metadata, { name: 'Test' });
});

test('POST /sessions rejects missing API key', async () => {
    const { status } = await post('/sessions', {});
    assert.equal(status, 401);
});

test('POST /sessions/join returns player and JWT', async () => {
    const { body: session } = await post('/sessions', {}, { 'x-api-key': 'test-api-key' });
    const { status, body }  = await post('/sessions/join', {
        join_code:    session.join_code,
        display_name: 'Alice',
    });
    assert.equal(status, 200);
    assert.ok(body.token);
    assert.ok(body.player.id);
    assert.equal(body.player.display_name, 'Alice');
});

test('POST /sessions/join rejects unknown join code', async () => {
    const { status } = await post('/sessions/join', { join_code: 'XXXXXX', display_name: 'Ghost' });
    assert.equal(status, 404);
});

test('POST /sessions/join rejects missing fields', async () => {
    const { status } = await post('/sessions/join', { join_code: 'XXXXXX' });
    assert.equal(status, 400);
});

test('GET /sessions/:id returns session data', async () => {
    const { session } = await scaffold();
    const { status, body } = await get(`/sessions/${session.id}`);
    assert.equal(status, 200);
    assert.equal(body.id, session.id);
    assert.equal(body.join_code, session.join_code);
});

test('GET /sessions/:id/events returns empty list initially', async () => {
    const { session, token } = await scaffold();
    const { status, body }   = await get(`/sessions/${session.id}/events`, { authorization: `Bearer ${token}` });
    assert.equal(status, 200);
    assert.deepEqual(body, []);
});

test('GET /sessions/:id/events rejects missing token', async () => {
    const { session } = await scaffold();
    const { status }  = await get(`/sessions/${session.id}/events`);
    assert.equal(status, 401);
});

test('POST /sessions/:id/assets creates an asset', async () => {
    const { session, token } = await scaffold();
    const { status, body }   = await post(
        `/sessions/${session.id}/assets`,
        { type: 'sprite', payload: { url: 'hero.png' } },
        { authorization: `Bearer ${token}` }
    );
    assert.equal(status, 201);
    assert.equal(body.type, 'sprite');
    assert.deepEqual(body.payload, { url: 'hero.png' });
    assert.equal(body.session_id, session.id);
});

test('GET /sessions/:id/assets lists assets', async () => {
    const { session, token } = await scaffold();
    const auth = { authorization: `Bearer ${token}` };

    await post(`/sessions/${session.id}/assets`, { type: 'map',    payload: { src: 'map.png'    } }, auth);
    await post(`/sessions/${session.id}/assets`, { type: 'sprite', payload: { src: 'player.png' } }, auth);

    const { status, body } = await get(`/sessions/${session.id}/assets`);
    assert.equal(status, 200);
    assert.equal(body.length, 2);
    assert.equal(body[0].type, 'map');
    assert.equal(body[1].type, 'sprite');
});

test('WebSocket relays events between players and persists them', { timeout: 10000 }, async () => {
    const { body: session } = await post('/sessions', {}, { 'x-api-key': 'test-api-key' });
    const { body: p1 } = await post('/sessions/join', { join_code: session.join_code, display_name: 'P1' });
    const { body: p2 } = await post('/sessions/join', { join_code: session.join_code, display_name: 'P2' });

    const ws1 = new WebSocket(`ws://localhost:${TEST_PORT}/?token=${p1.token}`);
    const ws2 = new WebSocket(`ws://localhost:${TEST_PORT}/?token=${p2.token}`);

    await Promise.all([
        new Promise(resolve => ws1.on('open', resolve)),
        new Promise(resolve => ws2.on('open', resolve)),
    ]);

    // P2 waits for a relayed event
    const relayed = new Promise(resolve => ws2.on('message', data => resolve(JSON.parse(data))));

    ws1.send(JSON.stringify({ type: 'move', payload: { x: 10, y: 20 } }));

    const event = await relayed;
    assert.equal(event.type, 'move');
    assert.deepEqual(event.payload, { x: 10, y: 20 });
    assert.equal(event.sequence_number, 1);

    ws1.close();
    ws2.close();

    // Confirm the event was persisted and returned by the REST endpoint
    const { body: events } = await get(
        `/sessions/${session.id}/events`,
        { authorization: `Bearer ${p1.token}` }
    );
    assert.equal(events.length, 1);
    assert.equal(events[0].type, 'move');
    assert.equal(events[0].sequence_number, 1);
});

test('WebSocket replays missed events on reconnect', { timeout: 10000 }, async () => {
    const { body: session } = await post('/sessions', {}, { 'x-api-key': 'test-api-key' });
    const { body: p1 } = await post('/sessions/join', { join_code: session.join_code, display_name: 'P1' });
    const { body: p2 } = await post('/sessions/join', { join_code: session.join_code, display_name: 'P2' });

    // P1 and P2 connect, P1 sends an event, then both disconnect
    const ws1 = new WebSocket(`ws://localhost:${TEST_PORT}/?token=${p1.token}`);
    const ws2 = new WebSocket(`ws://localhost:${TEST_PORT}/?token=${p2.token}`);
    await Promise.all([
        new Promise(resolve => ws1.on('open', resolve)),
        new Promise(resolve => ws2.on('open', resolve)),
    ]);
    ws1.send(JSON.stringify({ type: 'shoot', payload: { x: 5, y: 5 } }));
    await new Promise(resolve => setTimeout(resolve, 100)); // let relay finish
    ws1.close();
    ws2.close();

    // P2 reconnects with after=0 and should receive the missed event immediately
    const ws2b = new WebSocket(`ws://localhost:${TEST_PORT}/?token=${p2.token}&after=0`);
    const missed = new Promise(resolve => ws2b.on('message', data => resolve(JSON.parse(data))));

    const replayed = await missed;
    assert.equal(replayed.type, 'shoot');

    ws2b.close();
});
