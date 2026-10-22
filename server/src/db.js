// SQLite storage (built into Node 22.5+): users, their sign-in identities, sessions, wishlist items
const { DatabaseSync } = require('node:sqlite');
const crypto = require('crypto');
const path = require('path');
const cfg = require('./config');

const db = new DatabaseSync(path.join(cfg.dataDir, 'hotelki.db'));
db.exec(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,             -- accounts made before VK ID / Google / Apple sign-in keep their Telegram id
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
  -- how a user signs in (vk, google, apple) and the linked Telegram bot (tg); sub = id at the provider
  CREATE TABLE IF NOT EXISTS identities (
    provider TEXT NOT NULL, sub TEXT NOT NULL, user_id INTEGER NOT NULL, name TEXT, username TEXT, email TEXT, created INTEGER,
    PRIMARY KEY (provider, sub)
  );
  CREATE INDEX IF NOT EXISTS identities_user ON identities(user_id);
`);
// v1: every account so far came from the bot, so its id is the Telegram id: keep the bot linked
if (db.prepare('PRAGMA user_version').get().user_version < 1) {
  db.exec(`INSERT OR IGNORE INTO identities (provider, sub, user_id, name, username, created)
    SELECT 'tg', CAST(id AS TEXT), id, name, username, created FROM users; PRAGMA user_version = 1;`);
}

const now = () => Date.now();

const users = {
  create(u) {
    const r = db.prepare('INSERT INTO users (name, username, photo, created) VALUES (?, ?, ?, ?)').run(u.name || '', u.username || '', u.photo || '', now());
    return users.get(Number(r.lastInsertRowid));
  },
  get: id => db.prepare('SELECT * FROM users WHERE id = ?').get(id),
  setCity: (id, city) => db.prepare('UPDATE users SET city = ? WHERE id = ?').run(city || '', id),
  /** move everything of account `from` into `into` and drop `from` (linking a bot that already had its own wishes) */
  merge(from, into) {
    if (from === into) return;
    db.exec('BEGIN');
    try {
      for (const t of ['items', 'sessions', 'identities', 'alerts']) db.prepare(`UPDATE ${t} SET user_id = ? WHERE user_id = ?`).run(into, from);
      const a = users.get(from), b = users.get(into);
      if (a?.city && !b?.city) users.setCity(into, a.city);
      db.prepare('DELETE FROM users WHERE id = ?').run(from);
      db.exec('COMMIT');
    } catch (e) { db.exec('ROLLBACK'); throw e; }
  }
};

const identities = {
  user: (provider, sub) => db.prepare('SELECT user_id FROM identities WHERE provider = ? AND sub = ?').get(provider, String(sub))?.user_id ?? null,
  of: (userId, provider) => db.prepare('SELECT * FROM identities WHERE user_id = ? AND provider = ? ORDER BY created LIMIT 1').get(userId, provider),
  list: userId => db.prepare('SELECT provider, name, username, email FROM identities WHERE user_id = ? ORDER BY created').all(userId),
  link(provider, sub, userId, p = {}) {
    db.prepare(`INSERT INTO identities (provider, sub, user_id, name, username, email, created) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(provider, sub) DO UPDATE SET user_id = excluded.user_id, name = excluded.name, username = excluded.username, email = coalesce(excluded.email, identities.email)`)
      .run(provider, String(sub), userId, p.name || '', p.username || '', p.email || null, now());
  },
  unlink: (userId, provider) => db.prepare('DELETE FROM identities WHERE user_id = ? AND provider = ?').run(userId, provider).changes > 0
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

module.exports = { db, users, identities, sessions, items };
