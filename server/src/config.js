// Reads server/.env (secrets never live in the repo or in the client apps)
const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', '.env');
if (fs.existsSync(file)) {
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
  }
}

const cfg = {
  botToken: process.env.BOT_TOKEN || '',
  // api.telegram.org is blocked from Russian hosting; set TG_RELAY (deploy/tg-relay.gs) or TG_API
  tgRelay: process.env.TG_RELAY || '',
  tgApi: (process.env.TG_API || 'https://api.telegram.org').replace(/\/+$/, ''),
  ai: {
    provider: process.env.AI_PROVIDER || 'codex',
    key: process.env.AI_KEY || '',
    baseUrl: process.env.AI_BASE_URL || '',
    model: process.env.AI_MODEL || ''
  },
  port: +(process.env.PORT || 8787),
  publicUrl: process.env.PUBLIC_URL || 'http://localhost:8787',
  dataDir: process.env.DATA_DIR || path.join(__dirname, '..', 'data'),
  directSearch: process.env.DIRECT_SEARCH !== '0'
};
if (!cfg.botToken) throw new Error('BOT_TOKEN не задан в server/.env');
if (!cfg.ai.key) throw new Error('AI_KEY не задан в server/.env');
fs.mkdirSync(cfg.dataDir, { recursive: true });
module.exports = cfg;
