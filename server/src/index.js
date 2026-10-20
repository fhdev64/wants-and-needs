// Хотелки server: HTTP API for apps + Telegram bot, in one process
const api = require('./api');
const bot = require('./bot');

api.serve();
require('./watch').startScheduler();
bot.run().catch(e => { console.error('Бот не запустился:', e.message); process.exit(1); });
process.on('unhandledRejection', e => console.error('unhandled', e?.message || e));
