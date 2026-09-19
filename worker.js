class UsernameRegistry {
  constructor(state) {
    this.state = state;
    this.state.blockConcurrencyWhile(async () => {
      await this.state.storage.sql.exec(
        'CREATE TABLE IF NOT EXISTS usernames (username TEXT PRIMARY KEY, created_at INTEGER NOT NULL)'
      );
      await this.state.storage.sql.exec(
        'CREATE TABLE IF NOT EXISTS accounts (username TEXT PRIMARY KEY, created_at INTEGER NOT NULL, account_token TEXT NOT NULL)'
      );
      await this.state.storage.sql.exec(
        'CREATE TABLE IF NOT EXISTS activity (username TEXT NOT NULL, game_key TEXT NOT NULL, game_name TEXT NOT NULL, opens INTEGER NOT NULL DEFAULT 0, last_opened INTEGER NOT NULL, PRIMARY KEY (username, game_key))'
      );
    });
  }

  json(body, status = 200) {
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
    });
  }

  async reserve(username) {
    const key = username.toLowerCase();
    const existing = await this.state.storage.sql.exec(
      'SELECT username, account_token FROM accounts WHERE username = ?', key
    ).one();
    if (existing) return this.json({ ok: false, error: 'taken' }, 409);

    const token = crypto.randomUUID();
    const now = Date.now();
    await this.state.storage.sql.exec(
      'INSERT INTO usernames (username, created_at) VALUES (?, ?)', key, now
    );
    await this.state.storage.sql.exec(
      'INSERT INTO accounts (username, created_at, account_token) VALUES (?, ?, ?)', key, now, token
    );
    return this.json({ ok: true, username, account_token: token });
  }

  async activity(request) {
    let body;
    try { body = await request.json(); } catch { return this.json({ ok: false, error: 'invalid-json' }, 400); }
    const username = typeof body?.username === 'string' ? body.username.trim() : '';
    const token = typeof body?.account_token === 'string' ? body.account_token : '';
    const gameName = typeof body?.game_name === 'string' ? body.game_name.trim().slice(0, 120) : '';
    if (!username || !token || !gameName) return this.json({ ok: false, error: 'missing-fields' }, 400);

    const key = username.toLowerCase();
    const account = await this.state.storage.sql.exec(
      'SELECT username, account_token FROM accounts WHERE username = ?', key
    ).one();
    if (!account || account.account_token !== token) return this.json({ ok: false, error: 'unauthorized' }, 401);

    const gameKey = gameName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 120) || 'game';
    const now = Date.now();
    await this.state.storage.sql.exec(
      'INSERT INTO activity (username, game_key, game_name, opens, last_opened) VALUES (?, ?, ?, 1, ?) ON CONFLICT(username, game_key) DO UPDATE SET game_name = excluded.game_name, opens = activity.opens + 1, last_opened = excluded.last_opened',
      key, gameKey, gameName, now
    );
    return this.json({ ok: true });
  }

  async adminList() {
    const rows = await this.state.storage.sql.exec(
      'SELECT username, created_at FROM accounts ORDER BY created_at DESC'
    ).toArray();
    const counts = await this.state.storage.sql.exec(
      'SELECT username, COALESCE(SUM(opens), 0) AS total_opens, MAX(last_opened) AS last_opened FROM activity GROUP BY username'
    ).toArray();
    const byUser = new Map(counts.map(row => [row.username, row]));
    return this.json({
      ok: true,
      account_count: rows.length,
      accounts: rows.map(row => {
        const stat = byUser.get(row.username);
        return {
          username: row.username,
          created_at: row.created_at,
          total_opens: Number(stat?.total_opens || 0),
          last_opened: stat?.last_opened ? Number(stat.last_opened) : null
        };
      })
    });
  }

  async adminDetail(username) {
    const key = username.toLowerCase();
    const account = await this.state.storage.sql.exec(
      'SELECT username, created_at FROM accounts WHERE username = ?', key
    ).one();
    if (!account) return this.json({ ok: false, error: 'not-found' }, 404);
    const games = await this.state.storage.sql.exec(
      'SELECT game_name, opens, last_opened FROM activity WHERE username = ? ORDER BY last_opened DESC',
      key
    ).toArray();
    return this.json({
      ok: true,
      account: {
        username: account.username,
        created_at: account.created_at,
        games: games.map(game => ({
          game_name: game.game_name,
          opens: Number(game.opens),
          last_opened: Number(game.last_opened)
        }))
      }
    });
  }

  async fetch(request) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204 });
    if (url.pathname === '/reserve' && request.method === 'POST') {
      let body;
      try { body = await request.json(); } catch { return this.json({ ok: false, error: 'invalid-json' }, 400); }
      const username = typeof body?.username === 'string' ? body.username.trim() : '';
      if (!/^[A-Za-z0-9_]{3,24}$/.test(username)) return this.json({ ok: false, error: 'invalid-username' }, 400);
      return this.reserve(username);
    }
    if (url.pathname === '/activity' && request.method === 'POST') return this.activity(request);
    if (url.pathname === '/list' && request.method === 'GET') return this.adminList();
    if (url.pathname === '/detail' && request.method === 'GET') return this.adminDetail(url.searchParams.get('username') || '');
    return this.json({ ok: false, error: 'not-found' }, 404);
  }
}

const COSMIC_DEPLOYMENT_COMMIT = '__COSMIC_DEPLOYMENT_COMMIT__';

const ALLOWED_ORIGINS = new Set([
  'https://ultimate-guy.github.io',
  'https://cosmicv2.v75ultimate.workers.dev'
]);

function corsHeaders(request) {
  const origin = request.headers.get('Origin');
  const h = new Headers({
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Cache-Control': 'no-store'
  });
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    h.set('Access-Control-Allow-Origin', origin);
    h.set('Vary', 'Origin');
  }
  return h;
}

function jsonResponse(request, body, status = 200) {
  const h = corsHeaders(request);
  h.set('Content-Type', 'application/json; charset=utf-8');
  return new Response(JSON.stringify(body), { status, headers: h });
}
async function hmacKey(secret) {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

function base64url(bytes) {
  let s = '';
  for (const byte of bytes) s += String.fromCharCode(byte);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function bytesFromBase64url(value) {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((value.length + 3) % 4);
  const raw = atob(padded);
  return Uint8Array.from(raw, c => c.charCodeAt(0));
}

async function createAdminSession(secret) {
  const payload = { role: 'developer', exp: Date.now() + 60 * 60 * 1000 };
  const encoded = base64url(new TextEncoder().encode(JSON.stringify(payload)));
  const key = await hmacKey(secret);
  const signature = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(encoded)));
  return encoded + '.' + base64url(signature);
}

async function verifyAdminSession(request, env) {
  const expected = env.COSMIC_ADMIN_PASSWORD;
  if (typeof expected !== 'string' || !expected) return false;
  const authorization = request.headers.get('Authorization') || '';
  if (!authorization.startsWith('Bearer ')) return false;
  const token = authorization.slice(7).trim();
  const dot = token.indexOf('.');
  if (dot < 1) return false;
  const encoded = token.slice(0, dot);
  const signature = token.slice(dot + 1);
  try {
    const payload = JSON.parse(new TextDecoder().decode(bytesFromBase64url(encoded)));
    if (payload.role !== 'developer' || Number(payload.exp) < Date.now()) return false;
    const key = await hmacKey(expected);
    return await crypto.subtle.verify('HMAC', key, bytesFromBase64url(signature), new TextEncoder().encode(encoded));
  } catch (_) {
    return false;
  }
}

async function handleAdminSession(request, env) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(request) });
  if (request.method !== 'POST') return jsonResponse(request, { ok: false }, 405);
  let data;
  try { data = await request.json(); } catch { return jsonResponse(request, { ok: false }, 400); }
  const password = typeof data?.password === 'string' ? data.password : '';
  const expected = env.COSMIC_ADMIN_PASSWORD;
  if (typeof expected !== 'string' || !expected) return jsonResponse(request, { ok: false, error: 'server-not-configured' }, 500);
  if (password !== expected) return jsonResponse(request, { ok: false, error: 'invalid-password' }, 401);
  return jsonResponse(request, { ok: true, token: await createAdminSession(expected) });
}


async function handleAdminAuth(request, env) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(request) });
  if (request.method !== 'POST') return jsonResponse(request, { ok: false }, 405);
  let data;
  try { data = await request.json(); } catch { return jsonResponse(request, { ok: false }, 400); }
  const password = typeof data?.password === 'string' ? data.password : '';
  const expected = env.COSMIC_ADMIN_PASSWORD;
  if (typeof expected !== 'string' || !expected) return jsonResponse(request, { ok: false, error: 'server-not-configured' }, 500);
  return jsonResponse(request, { ok: password === expected });
}

async function handleHubDiagnostics(request, env) {
  const paths = [
    '/pages/lessons/lessons.html',
    '/scripts/cosmic-hub.js',
    '/scripts/cosmic-hub-preflight.js',
    '/scripts/cosmic-hub-repair.js',
    '/pages/lessons/games.json'
  ];
  const result = {};
  for (const path of paths) {
    try {
      const response = await env.ASSETS.fetch(new Request(new URL(path, request.url)));
      const text = await response.text();
      result[path] = {
        status: response.status,
        bytes: text.length,
        lessons_has_hub_loader: path.endsWith('lessons.html')
          ? /(?:\\.\\.\/)+scripts\/cosmic-hub\.js/i.test(text)
          : undefined,
        lessons_has_preflight: path.endsWith('lessons.html')
          ? /(?:\\.\\.\/)+scripts\/cosmic-hub-preflight\.js/i.test(text)
          : undefined,
        lessons_has_repair: path.endsWith('lessons.html')
          ? /(?:\\.\\.\/)+scripts\/cosmic-hub-repair\.js/i.test(text)
          : undefined,
        hub_release: path.endsWith('cosmic-hub.js')
          ? (text.match(/COSMIC_HUB_RELEASE\\s*=\\s*['"]([^'"]+)/i) || [])[1] || null
          : undefined,
        game_entries: path.endsWith('games.json')
          ? (() => { try { const data = JSON.parse(text); return Array.isArray(data) ? data.length : -1; } catch (_) { return -1; } })()
          : undefined
      };
    } catch (error) {
      result[path] = { status: 0, error: error instanceof Error ? error.message : String(error) };
    }
  }
  return jsonResponse(request, { ok: true, assets: result });
}

function handleDeploymentStatus(request) {
  return jsonResponse(request, {
    ok: true,
    service: 'cosmicv2',
    source_commit: COSMIC_DEPLOYMENT_COMMIT,
    hub_release: 'cosmic-hub-v9',
    service_worker_cache: 'cosmic-shell-v10'
  });
}

async function handleAdminAccounts(request, env) {
  if (!(await verifyAdminSession(request, env))) return jsonResponse(request, { ok: false, error: 'unauthorized' }, 401);
  const registry = env.USERNAME_REGISTRY;
  const url = new URL(request.url);
  const id = registry.idFromName('global');
  if (url.pathname === '/api/admin/accounts') {
    return registry.get(id).fetch(new Request(new URL('/list', request.url), request));
  }
  if (url.pathname === '/api/admin/account') {
    const username = url.searchParams.get('username') || '';
    return registry.get(id).fetch(new Request(new URL('/detail?username=' + encodeURIComponent(username), request.url), request));
  }
  return jsonResponse(request, { ok: false, error: 'not-found' }, 404);
}

async function handleAI(request, env) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(request) });
  if (request.method !== 'POST') return jsonResponse(request, { error: 'Method not allowed' }, 405);
  if (typeof env.OPENROUTER_API_KEY !== 'string' || !env.OPENROUTER_API_KEY) return jsonResponse(request, { error: 'AI server is not configured.' }, 500);
  let body;
  try { body = await request.json(); } catch { return jsonResponse(request, { error: 'Invalid JSON request.' }, 400); }
  try {
    const messages = Array.isArray(body?.messages) ? body.messages : [];
    const system = { role: 'system', content: 'You are Cosmic AI, a polished general-purpose AI assistant. Answer directly, naturally, and helpfully. Do not output private chain-of-thought, hidden reasoning, tool-call syntax, fake execution logs, or JSON pretending to be tool output.' };
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://ultimate-guy.github.io/goated-ai/',
        'X-Title': 'Cosmic AI'
      },
      body: JSON.stringify({ ...body, messages: [system, ...messages] })
    });
    const text = await response.text();
    const h = corsHeaders(request);
    h.set('Content-Type', response.headers.get('content-type') || 'application/json; charset=utf-8');
    return new Response(text, { status: response.status, headers: h });
  } catch (e) {
    return jsonResponse(request, { error: e instanceof Error ? e.message : 'AI request failed.' }, 502);
  }
}

function assetResponse(response) {
  const headers = new Headers(response.headers);
  headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  headers.set('CDN-Cache-Control', 'no-store');
  headers.set('Pragma', 'no-cache');
  headers.set('Expires', '0');
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

async function fetchAsset(request, env) {
  if (!env?.ASSETS?.fetch) {
    return new Response('Cosmic static asset binding is unavailable.', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=UTF-8', 'Cache-Control': 'no-store' }
    });
  }
  return assetResponse(await env.ASSETS.fetch(request));
}

async function serveHub(request, env) {
  if (!env?.ASSETS?.fetch) return null;
  const url = new URL(request.url);
  const hubPaths = new Set(['/pages/lessons/lessons.html', '/apps/apps.html', '/cosmic-hub.html']);
  if (!hubPaths.has(url.pathname)) return null;

  const source = await env.ASSETS.fetch(new Request(url.href, {
    method: 'GET',
    headers: request.headers,
    redirect: 'manual'
  }));
  if (!source.ok) return assetResponse(source);

  let html = await source.text();
  const version = encodeURIComponent('cf-' + Date.now().toString(36));
  html = html.replace(/(<script\s+src=["'][^"']*\/scripts\/cosmic-hub\.js)(\?[^"']*)?(["'])/gi, `$1?build=${version}$3`);
  html = html.replace(/(<script\s+src=["'][^"']*\/scripts\/cosmic-hub-repair\.js)(\?[^"']*)?(["'])/gi, `$1?build=${version}$3`);
  html = html.replace(/(<script\s+src=["'][^"']*\/scripts\/cosmic-profile-widget\.js)(\?[^"']*)?(["'])/gi, `$1?build=${version}$3`);

  const headers = new Headers(source.headers);
  headers.set('Content-Type', 'text/html; charset=UTF-8');
  headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  headers.set('CDN-Cache-Control', 'no-store');
  headers.set('Pragma', 'no-cache');
  headers.set('Expires', '0');
  return new Response(html, { status: source.status, statusText: source.statusText, headers });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(request) });
    if (url.pathname === '/api/admin/session') return handleAdminSession(request, env);
    if (url.pathname === '/api/admin/accounts' || url.pathname === '/api/admin/account') return handleAdminAccounts(request, env);
    if (url.pathname === '/api/deployment-status') return handleDeploymentStatus(request);
    if (url.pathname === '/api/hub-diagnostics') return handleHubDiagnostics(request, env);
    if (url.pathname === '/api/ai') return handleAI(request, env);
    if (url.pathname === '/api/admin/auth' || url.pathname === '/api/admin-auth') return handleAdminAuth(request, env);
    if ((url.pathname === '/api/usernames/reserve' || url.pathname === '/api/accounts/activity') && request.method === 'POST') {
      const id = env.USERNAME_REGISTRY.idFromName('global');
      const target = url.pathname === '/api/usernames/reserve' ? '/reserve' : '/activity';
      return env.USERNAME_REGISTRY.get(id).fetch(new Request(new URL(target, request.url), request));
    }

    if (request.method === 'GET' || request.method === 'HEAD') {
      const hub = await serveHub(request, env);
      if (hub) return hub;
      return fetchAsset(request, env);
    }
    return fetchAsset(request, env);
  }
};
export { UsernameRegistry };
