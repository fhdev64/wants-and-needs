// Хотелки server: HTTP API for apps + (optional) Telegram bot, in one process
const cfg = require('./config');
const api = require('./api');

api.serve();
require('./watch').startScheduler();
// the bot is reached through a relay that may be down at boot: keep trying instead of taking the API down with it
const startBot = () => require('./bot').run().catch(e => { console.error('Бот не запустился:', e.message); setTimeout(startBot, 30e3); });
if (cfg.botToken) startBot();
else console.log('BOT_TOKEN не задан — бот выключен, привязка Telegram недоступна');
process.on('unhandledRejection', e => console.error('unhandled', e?.message || e));
