// SQLite storage (built into Node 22.5+): users, sessions, wishlist items
const { DatabaseSync } = require('node:sqlite');
const crypto = require('crypto');
const path = require('path');
const cfg = require('./config');

const db = new DatabaseSync(path.join(cfg.dataDir, 'hotelki.db'));
db.exec(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,             -- Telegram user id
    name TEXT, username TEXT, photo TEXT,
    city TEXT DEFAULT '',
    created INTEGER
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY, user_id INTEGER NOT NULL, device TEXT, created INTEGER
  );
  CREATE TABLE IF NOT EXISTS items (
    id TEXT PRIMARY KEY, user_id INTEGER NOT NULL, data TEXT NOT NULL, added INTEGER, updated INTEGER
  );
  CREATE INDEX IF NOT EXISTS items_user ON items(user_id, added);
`);

const now = () => Date.now();

const users = {
  upsert(u) {
    db.prepare(`INSERT INTO users (id, name, username, created) VALUES (?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET name = excluded.name, username = excluded.username`)
      .run(u.id, u.name || '', u.username || '', now());
    return users.get(u.id);
  },
  get: id => db.prepare('SELECT * FROM users WHERE id = ?').get(id),
  setCity: (id, city) => db.prepare('UPDATE users SET city = ? WHERE id = ?').run(city || '', id)
};

const sessions = {
  create(userId, device = '') {
    const token = crypto.randomBytes(32).toString('base64url');
    db.prepare('INSERT INTO sessions (token, user_id, device, created) VALUES (?, ?, ?, ?)').run(token, userId, device, now());
    return token;
  },
  user(token) {
    if (!token) return null;
    const s = db.prepare('SELECT user_id FROM sessions WHERE token = ?').get(token);
    return s ? users.get(s.user_id) : null;
  },
  drop: token => db.prepare('DELETE FROM sessions WHERE token = ?').run(token)
};

const items = {
  list: userId => db.prepare('SELECT data FROM items WHERE user_id = ? ORDER BY added DESC').all(userId).map(r => JSON.parse(r.data)),
  get: (userId, id) => { const r = db.prepare('SELECT data FROM items WHERE user_id = ? AND id = ?').get(userId, id); return r && JSON.parse(r.data); },
  save(userId, item) {
    item.id ||= crypto.randomUUID();
    item.addedAt ||= now();
    item.updatedAt = now();
    db.prepare(`INSERT INTO items (id, user_id, data, added, updated) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated = excluded.updated WHERE user_id = excluded.user_id`)
      .run(item.id, userId, JSON.stringify(item), item.addedAt, item.updatedAt);
    return item;
  },
  remove: (userId, id) => db.prepare('DELETE FROM items WHERE user_id = ? AND id = ?').run(userId, id).changes > 0,
  count: userId => db.prepare('SELECT COUNT(*) c FROM items WHERE user_id = ?').get(userId).c,
  hasName: (userId, name) => items.list(userId).some(i => i.name === name)
};

module.exports = { db, users, sessions, items };
