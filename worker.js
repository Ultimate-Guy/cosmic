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
    if (url.pathname === '/api/ai') return handleAI(request, env);
    if (url.pathname === '/api/admin/auth' || url.pathname === '/api/admin-auth') return handleAdminAuth(request, env);

    if (request.method === 'GET' || request.method === 'HEAD') {
      const hub = await serveHub(request, env);
      if (hub) return hub;
      return fetchAsset(request, env);
    }
    return fetchAsset(request, env);
  }
};