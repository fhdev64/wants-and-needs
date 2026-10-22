// Sign-in with VK ID, Google and Apple: the classic server-side authorization code flow (with PKCE).
// The app opens the provider page in the browser, the provider redirects back to PUBLIC_URL/auth/cb/<provider>,
// the server swaps the code for the user's profile; the app meanwhile polls /api/auth/poll. No secrets in the apps.
const crypto = require('crypto');
const fs = require('fs');
const cfg = require('./config');

const o = cfg.oauth;
const redirectUri = p => `${cfg.publicUrl}/auth/cb/${p}`;
const challenge = verifier => crypto.createHash('sha256').update(verifier).digest('base64url');
// id_token comes straight from the provider's token endpoint over TLS, so its signature needs no re-check (OIDC 3.1.3.7)
const claims = jwt => JSON.parse(Buffer.from(String(jwt).split('.')[1] || '', 'base64url').toString('utf8') || '{}');

async function post(url, form) {
  const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' }, body: new URLSearchParams(form), signal: AbortSignal.timeout(20000) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error(j.error_description || j.error || `HTTP ${r.status}`);
  return j;
}

// Apple wants a client secret that is an ES256 JWT signed with the .p8 key (valid up to 6 months; we make a fresh one each time)
function appleSecret() {
  const pem = o.apple.key.startsWith('-----') ? o.apple.key.replace(/\\n/g, '\n') : fs.readFileSync(o.apple.key, 'utf8');
  const enc = x => Buffer.from(JSON.stringify(x)).toString('base64url');
  const t = Math.floor(Date.now() / 1000);
  const head = enc({ alg: 'ES256', kid: o.apple.keyId }) + '.' + enc({ iss: o.apple.teamId, iat: t, exp: t + 600, aud: 'https://appleid.apple.com', sub: o.apple.clientId });
  return head + '.' + crypto.sign('sha256', Buffer.from(head), { key: pem, dsaEncoding: 'ieee-p1363' }).toString('base64url');
}

const PROVIDERS = {
  vk: {
    on: () => !!o.vk.clientId,
    url: (state, verifier) => 'https://id.vk.ru/authorize?' + new URLSearchParams({
      response_type: 'code', client_id: o.vk.clientId, redirect_uri: redirectUri('vk'), state,
      code_challenge: challenge(verifier), code_challenge_method: 'S256', scope: 'email'
    }),
    // redirect: the Android VK ID SDK gets the code at vk<client_id>://vk.ru/blank.html and hands it to us
    async profile(q, verifier, redirect = redirectUri('vk'), clientId = o.vk.clientId) {
      // VK ID returns code/device_id/state as query params (older flows pack them into a JSON `payload`)
      const p = q.payload ? JSON.parse(q.payload) : q;
      const t = await post('https://id.vk.ru/oauth2/auth', {
        grant_type: 'authorization_code', code: p.code, code_verifier: verifier, client_id: clientId,
        device_id: p.device_id || '', redirect_uri: redirect, state: p.state || q.state
      });
      const u = (await post('https://id.vk.ru/oauth2/user_info', { client_id: clientId, access_token: t.access_token })).user || {};
      return { sub: String(u.user_id || t.user_id), name: [u.first_name, u.last_name].filter(Boolean).join(' '), email: u.email || '', photo: u.avatar || '' };
    }
  },
  google: {
    on: () => !!(o.google.clientId && o.google.secret),
    url: (state, verifier) => 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({
      response_type: 'code', client_id: o.google.clientId, redirect_uri: redirectUri('google'), state,
      scope: 'openid email profile', code_challenge: challenge(verifier), code_challenge_method: 'S256', prompt: 'select_account'
    }),
    async profile(q, verifier) {
      const t = await post('https://oauth2.googleapis.com/token', {
        grant_type: 'authorization_code', code: q.code, code_verifier: verifier, client_id: o.google.clientId,
        client_secret: o.google.secret, redirect_uri: redirectUri('google')
      });
      const c = claims(t.id_token);
      if (c.aud !== o.google.clientId) throw new Error('чужой токен');
      return { sub: c.sub, name: c.name || '', email: c.email || '', photo: c.picture || '' };
    }
  },
  apple: {
    on: () => !!(o.apple.clientId && o.apple.teamId && o.apple.keyId && o.apple.key),
    // name/email scopes require form_post: Apple POSTs the result to the callback
    url: state => 'https://appleid.apple.com/auth/authorize?' + new URLSearchParams({
      response_type: 'code', response_mode: 'form_post', client_id: o.apple.clientId, redirect_uri: redirectUri('apple'), state, scope: 'name email'
    }),
    async profile(q) {
      const t = await post('https://appleid.apple.com/auth/token', {
        grant_type: 'authorization_code', code: q.code, client_id: o.apple.clientId, client_secret: appleSecret(), redirect_uri: redirectUri('apple')
      });
      const c = claims(t.id_token);
      if (c.aud !== o.apple.clientId) throw new Error('чужой токен');
      // the name is sent only on the very first sign-in, as a JSON form field
      let name = '';
      try { const n = JSON.parse(q.user || '{}').name || {}; name = [n.firstName, n.lastName].filter(Boolean).join(' '); } catch {}
      return { sub: c.sub, name, email: c.email || '', photo: '' };
    }
  }
};

// Android: Credential Manager hands the app an ID token issued to our web client (serverClientId)
async function googleIdToken(idToken) {
  const r = await fetch('https://oauth2.googleapis.com/tokeninfo?' + new URLSearchParams({ id_token: idToken }), { signal: AbortSignal.timeout(20000) });
  const c = await r.json().catch(() => ({}));
  if (!r.ok || c.error) throw new Error(c.error_description || c.error || `HTTP ${r.status}`);
  if (c.aud !== o.google.clientId || !['accounts.google.com', 'https://accounts.google.com'].includes(c.iss)) throw new Error('чужой токен');
  return { sub: c.sub, name: c.name || '', email: c.email || '', photo: c.picture || '' };
}
const vkAppRedirect = () => `vk${o.vk.androidClientId}://vk.ru/blank.html`;

const NAMES = { tag: 'тег', vk: 'VK ID', google: 'Google', apple: 'Apple ID', tg: 'Telegram' };
const enabled = () => Object.keys(PROVIDERS).filter(p => PROVIDERS[p].on());
const get = p => PROVIDERS[p]?.on() ? PROVIDERS[p] : null;

module.exports = { enabled, get, NAMES, challenge, googleIdToken, vkAppRedirect };
