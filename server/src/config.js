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

const env = k => (process.env[k] || '').trim();
const cfg = {
  // the Telegram bot is optional now: sign-in is VK ID / Google / Apple, the bot is linked afterwards
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
  // public https address of this server (OAuth providers redirect back to it), e.g. https://188-120-246-113.sslip.io
  publicUrl: (process.env.PUBLIC_URL || 'http://localhost:8787').replace(/\/+$/, ''),
  // sign-in providers; a provider without its keys is simply not offered in the apps
  oauth: {
    vk: { clientId: env('VK_CLIENT_ID') },
    google: { clientId: env('GOOGLE_CLIENT_ID'), secret: env('GOOGLE_CLIENT_SECRET') },
    // Services ID, Team ID, key id and the .p8 key (file path or the key itself) from developer.apple.com
    apple: { clientId: env('APPLE_CLIENT_ID'), teamId: env('APPLE_TEAM_ID'), keyId: env('APPLE_KEY_ID'), key: env('APPLE_PRIVATE_KEY') }
  },
  dataDir: process.env.DATA_DIR || path.join(__dirname, '..', 'data'),
  directSearch: process.env.DIRECT_SEARCH !== '0'
};
if (!cfg.ai.key) throw new Error('AI_KEY не задан в server/.env');
fs.mkdirSync(cfg.dataDir, { recursive: true });
module.exports = cfg;
