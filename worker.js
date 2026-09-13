const ALLOWED_ORIGINS = new Set([
  'https://ultimate-guy.github.io',
  'https://cosmicv2.v75ultimate.workers.dev'
]);

const GITHUB_REPO = 'Ultimate-Guy/cosmic';

function corsHeaders(request) {
  const origin = request.headers.get('Origin');
  const headers = new Headers({
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(request) });
  if (request.method !== 'POST') return jsonResponse(request, { ok: false }, 405);
  let data;
  try { data = await request.json(); } catch { return jsonResponse(request, { ok: false }, 400); }
  const password = typeof data?.password === 'string' ? data.password : '';
  const expectedPassword = env.COSMIC_ADMIN_PASSWORD;
  if (typeof expectedPassword !== 'string' || expectedPassword.length === 0) {
    return jsonResponse(request, { ok: false, error: 'server-not-configured' }, 500);
  }
  return jsonResponse(request, { ok: password === expectedPassword });
}

async function handleAI(request, env) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(request) });
  if (request.method !== 'POST') return jsonResponse(request, { error: 'Method not allowed' }, 405);
  const apiKey = env.OPENROUTER_API_KEY;
  if (typeof apiKey !== 'string' || apiKey.length === 0) return jsonResponse(request, { error: 'AI server is not configured.' }, 500);
  let body;
  try { body = await request.json(); } catch { return jsonResponse(request, { error: 'Invalid JSON request.' }, 400); }
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

function base64Url(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function textBase64Url(text) {
  return base64Url(new TextEncoder().encode(text));
}

function pemToBytes(pem) {
  const base64 = pem.replace(/-----BEGIN PRIVATE KEY-----/g, '').replace(/-----END PRIVATE KEY-----/g, '').replace(/\s/g, '');
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function githubAppJwt(env) {
  const appId = String(env.GITHUB_APP_ID || '').trim();
  const privateKeyPem = env.GITHUB_APP_PRIVATE_KEY;
  if (!appId || !privateKeyPem) throw new Error('GitHub App is not configured on the Worker.');

  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToBytes(privateKeyPem),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const now = Math.floor(Date.now() / 1000);
  const header = textBase64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = textBase64Url(JSON.stringify({ iat: now - 60, exp: now + 540, iss: appId }));
  const unsigned = `${header}.${payload}`;
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned));
  return `${unsigned}.${base64Url(new Uint8Array(signature))}`;
}

async function githubRequest(path, options = {}) {
  const response = await fetch(`https://api.github.com${path}`, {
    ...options,
    headers: {
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'Cosmic',
      ...(options.headers || {})
    }
  });
  const text = await response.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { message: text }; }
  return { response, data };
}

async function githubInstallationToken(env) {
  const jwt = await githubAppJwt(env);
  const installation = await githubRequest(`/repos/${GITHUB_REPO}/installation`, {
    headers: { 'Authorization': `Bearer ${jwt}` }
  });
  if (!installation.response.ok) {
    throw new Error(installation.data.message || `GitHub installation lookup failed (${installation.response.status}).`);
  }

  const token = await githubRequest(`/app/installations/${installation.data.id}/access_tokens`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${jwt}` }
  });
  if (!token.response.ok || !token.data.token) {
    throw new Error(token.data.message || `GitHub installation token request failed (${token.response.status}).`);
  }
  return token.data.token;
}

async function githubApi(env, path, options = {}) {
  const token = await githubInstallationToken(env);
  return githubRequest(path, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      ...(options.headers || {})
    }
  });
}

async function handleGithub(request, env) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(request) });
  if (request.method !== 'GET') return jsonResponse(request, { error: 'Method not allowed' }, 405);

  const url = new URL(request.url);
  const requestedRepo = url.searchParams.get('repo') || GITHUB_REPO;
  if (requestedRepo !== GITHUB_REPO) return jsonResponse(request, { error: 'This GitHub App is currently limited to the Cosmic repository.' }, 403);

  try {
    if (url.pathname === '/api/github/status') {
      const { response, data } = await githubApi(env, `/repos/${GITHUB_REPO}`);
      if (!response.ok) return jsonResponse(request, { error: data.message || 'GitHub request failed.' }, response.status);
      return jsonResponse(request, {
        connected: true,
        repository: data.full_name,
        private: data.private,
        default_branch: data.default_branch,
        permissions: 'read-only'
      });
    }

    if (url.pathname === '/api/github/repo') {
      const { response, data } = await githubApi(env, `/repos/${GITHUB_REPO}`);
      if (!response.ok) return jsonResponse(request, { error: data.message || 'GitHub request failed.' }, response.status);
      return jsonResponse(request, {
        full_name: data.full_name,
        description: data.description,
        default_branch: data.default_branch,
        private: data.private,
        html_url: data.html_url,
        language: data.language,
        stargazers_count: data.stargazers_count,
        forks_count: data.forks_count,
        updated_at: data.updated_at
      });
    }

    if (url.pathname === '/api/github/file') {
      const filePath = url.searchParams.get('path');
      const ref = url.searchParams.get('ref');
      if (!filePath) return jsonResponse(request, { error: 'A file path is required.' }, 400);
      const encodedPath = filePath.split('/').map(encodeURIComponent).join('/');
      const apiPath = `/repos/${GITHUB_REPO}/contents/${encodedPath}${ref ? `?ref=${encodeURIComponent(ref)}` : ''}`;
      const { response, data } = await githubApi(env, apiPath);
      if (!response.ok) return jsonResponse(request, { error: data.message || 'GitHub request failed.' }, response.status);
      if (Array.isArray(data) || data.type !== 'file' || !data.content) return jsonResponse(request, { error: 'That path is not a readable text file.' }, 400);
      const content = atob(data.content.replace(/\s/g, ''));
      const bytes = new Uint8Array(content.length);
      for (let i = 0; i < content.length; i++) bytes[i] = content.charCodeAt(i);
      return jsonResponse(request, {
        full_name: GITHUB_REPO,
        path: filePath,
        sha: data.sha,
        size: data.size,
        content: new TextDecoder().decode(bytes),
        html_url: data.html_url
      });
    }

    return jsonResponse(request, { error: 'GitHub endpoint not found.' }, 404);
  } catch (error) {
    return jsonResponse(request, { error: error instanceof Error ? error.message : 'GitHub request failed.' }, 500);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/admin-auth') return handleAdminAuth(request, env);
    if (url.pathname === '/api/ai') return handleAI(request, env);
    if (url.pathname.startsWith('/api/github/')) return handleGithub(request, env);
    return env.ASSETS.fetch(request);
  }
};
