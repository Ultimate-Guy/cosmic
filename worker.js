class UsernameRegistry {
  constructor(state) {
    this.state = state;
    this.state.blockConcurrencyWhile(async () => {
      await this.state.storage.sql.exec(
        'CREATE TABLE IF NOT EXISTS usernames (username TEXT PRIMARY KEY, created_at INTEGER NOT NULL)'
      );
    });
  }

  async fetch(request) {
    if (request.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });
    let body;
    try { body = await request.json(); } catch { return new Response(JSON.stringify({ok:false,error:'invalid-json'}), {status:400,headers:{'Content-Type':'application/json'}}); }
    const username = typeof body?.username === 'string' ? body.username.trim() : '';
    if (!/^[A-Za-z0-9_]{3,24}$/.test(username)) {
      return new Response(JSON.stringify({ok:false,error:'invalid-username'}), {status:400,headers:{'Content-Type':'application/json'}});
    }
    const key = username.toLowerCase();
    const row = await this.state.storage.sql.exec('SELECT username FROM usernames WHERE username = ?', key).one();
    if (row) return new Response(JSON.stringify({ok:false,error:'taken'}), {status:409,headers:{'Content-Type':'application/json'}});
    await this.state.storage.sql.exec('INSERT INTO usernames (username, created_at) VALUES (?, ?)', key, Date.now());
    return new Response(JSON.stringify({ok:true,username}), {status:200,headers:{'Content-Type':'application/json'}});
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
    'Access-Control-Allow-Headers': 'Content-Type',
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
    if (url.pathname === '/api/deployment-status') return handleDeploymentStatus(request);
    if (url.pathname === '/api/hub-diagnostics') return handleHubDiagnostics(request, env);
    if (url.pathname === '/api/ai') return handleAI(request, env);
    if (url.pathname === '/api/admin/auth' || url.pathname === '/api/admin-auth') return handleAdminAuth(request, env);
    if (url.pathname === '/api/usernames/reserve' && request.method === 'POST') {
      const id = env.USERNAME_REGISTRY.idFromName('global');
      return env.USERNAME_REGISTRY.get(id).fetch(request);
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
