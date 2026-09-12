const ALLOWED_ORIGINS = new Set([
  'https://ultimate-guy.github.io',
  'https://cosmicv2.v75ultimate.workers.dev'
]);

function corsHeaders(request) {
  const origin = request.headers.get('Origin');
  const headers = new Headers({
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'no-store'
  });

  if (origin && ALLOWED_ORIGINS.has(origin)) {
    headers.set('Access-Control-Allow-Origin', origin);
    headers.set('Vary', 'Origin');
  }

  return headers;
}

function jsonResponse(request, body, status = 200) {
  const headers = corsHeaders(request);
  headers.set('Content-Type', 'application/json; charset=utf-8');
  return new Response(JSON.stringify(body), { status, headers });
}

async function handleAdminAuth(request, env) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(request) });
  }

  if (request.method !== 'POST') {
    return jsonResponse(request, { ok: false }, 405);
  }

  let data;
  try {
    data = await request.json();
  } catch {
    return jsonResponse(request, { ok: false }, 400);
  }

  const password = typeof data?.password === 'string' ? data.password : '';
  const expectedPassword = env.COSMIC_ADMIN_PASSWORD;

  if (typeof expectedPassword !== 'string' || expectedPassword.length === 0) {
    return jsonResponse(request, { ok: false, error: 'server-not-configured' }, 500);
  }

  return jsonResponse(request, {
    ok: password === expectedPassword
  });
}

async function handleAI(request, env) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(request) });
  }

  if (request.method !== 'POST') {
    return jsonResponse(request, { error: 'Method not allowed' }, 405);
  }

  const apiKey = env.OPENROUTER_API_KEY;
  if (typeof apiKey !== 'string' || apiKey.length === 0) {
    return jsonResponse(request, { error: 'AI server is not configured.' }, 500);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse(request, { error: 'Invalid JSON request.' }, 400);
  }

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://ultimate-guy.github.io/goated-ai/',
        'X-Title': 'Cosmic AI'
      },
      body: JSON.stringify(body)
    });

    const text = await response.text();
    const headers = corsHeaders(request);
    headers.set('Content-Type', response.headers.get('content-type') || 'application/json; charset=utf-8');
    return new Response(text, { status: response.status, headers });
  } catch (error) {
    return jsonResponse(request, { error: error instanceof Error ? error.message : 'AI request failed.' }, 502);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/admin-auth') {
      return handleAdminAuth(request, env);
    }

    if (url.pathname === '/api/ai') {
      return handleAI(request, env);
    }

    return env.ASSETS.fetch(request);
  }
};
