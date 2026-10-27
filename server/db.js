// SQLite storage for the sync server. Plain ESM, no build step.
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

const DB_PATH = process.env.DB_PATH || '/data/home.sqlite';

// Make sure the parent directory exists (e.g. a fresh ./data volume mount).
const dir = path.dirname(DB_PATH);
if (dir && dir !== '.' && !fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

export const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS records (
    tbl TEXT NOT NULL,
    id TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    deleted INTEGER NOT NULL,
    payload TEXT NOT NULL,
    serverSeq INTEGER NOT NULL,
    PRIMARY KEY (tbl, id)
  );
  CREATE INDEX IF NOT EXISTS records_serverSeq_idx ON records (serverSeq);

  CREATE TABLE IF NOT EXISTS meta (
    k TEXT PRIMARY KEY,
    v TEXT
  );

  CREATE TABLE IF NOT EXISTS push_subs (
    endpoint TEXT PRIMARY KEY,
    sub TEXT NOT NULL,          -- full PushSubscription JSON
    scope TEXT NOT NULL,        -- 'all' or a member id
    digestTime TEXT NOT NULL,   -- 'HH:MM' or ''
    tz TEXT NOT NULL,           -- IANA zone of the device
    updatedAt TEXT NOT NULL
  );

  -- One row per reminder actually sent, so restarts / overlapping ticks never double-send.
  CREATE TABLE IF NOT EXISTS push_sent (
    endpoint TEXT NOT NULL,
    key TEXT NOT NULL,          -- 'digest:YYYY-MM-DD' or 'task:<id>:YYYY-MM-DD'
    PRIMARY KEY (endpoint, key)
  );
`);

const SEQ_KEY = 'serverSeq';

function readSeq() {
  const row = db.prepare('SELECT v FROM meta WHERE k = ?').get(SEQ_KEY);
  return row ? Number(row.v) : 0;
}

if (!db.prepare('SELECT 1 FROM meta WHERE k = ?').get(SEQ_KEY)) {
  db.prepare('INSERT INTO meta (k, v) VALUES (?, ?)').run(SEQ_KEY, '0');
}

const bumpSeqStmt = db.prepare('UPDATE meta SET v = CAST(CAST(v AS INTEGER) + 1 AS TEXT) WHERE k = ?');
const getSeqStmt = db.prepare('SELECT v FROM meta WHERE k = ?');

/** Atomically increments and returns the new global change counter. Call only inside a transaction. */
export function nextServerSeq() {
  bumpSeqStmt.run(SEQ_KEY);
  return Number(getSeqStmt.get(SEQ_KEY).v);
}

/** Current global change counter (does not advance it). */
export function currentServerSeq() {
  return readSeq();
}
