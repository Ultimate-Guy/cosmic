const ALLOWED_ORIGINS = new Set([
  'https://ultimate-guy.github.io',
  'https://cosmicv2.v75ultimate.workers.dev'
]);

// This placeholder is replaced during the Cloudflare build using the
// COSMIC_ADMIN_PASSWORD build secret. The password never lives in GitHub.
const BUILD_ADMIN_PASSWORD = '__COSMIC_ADMIN_PASSWORD__';

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

  // The normal Cosmic Entry password is injected into the GitHub Pages build.
  // We use the same basic idea for the Cloudflare Worker: the admin password
  // is supplied as a Cloudflare Build Secret and injected only during deploy.
  const expectedPassword = BUILD_ADMIN_PASSWORD !== '__COSMIC_ADMIN_PASSWORD__'
    ? BUILD_ADMIN_PASSWORD
    : env.COSMIC_ADMIN_PASSWORD;

  if (!expectedPassword) {
    return jsonResponse(request, { ok: false, error: 'server-not-configured' }, 500);
  }

  return jsonResponse(request, {
    ok: password === expectedPassword
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
