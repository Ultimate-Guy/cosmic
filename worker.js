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

  if (!env.COSMIC_ADMIN_PASSWORD) {
    // Never expose the secret or its value. This only indicates a server setup
    // problem so it can be diagnosed from the Worker logs/dashboard.
    return jsonResponse(request, { ok: false }, 500);
  }

  let data;
  try {
    data = await request.json();
  } catch {
    return jsonResponse(request, { ok: false }, 400);
  }

  const password = typeof data?.password === 'string' ? data.password : '';
  return jsonResponse(request, {
    ok: password === env.COSMIC_ADMIN_PASSWORD
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/admin-auth') {
      return handleAdminAuth(request, env);
    }

    return env.ASSETS.fetch(request);
  }
};
