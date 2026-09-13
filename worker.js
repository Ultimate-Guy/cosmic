const ALLOWED_ORIGINS = new Set([
  'https://ultimate-guy.github.io',
  'https://cosmicv2.v75ultimate.workers.dev'
]);

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

async function githubFetch(path) {
  const response = await fetch(`https://api.github.com${path}`, {
    headers: {
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'Cosmic'
    }
  });
  const text = await response.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { message: text }; }
  return { response, data };
}

async function handleGithub(request) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(request) });
  if (request.method !== 'GET') return jsonResponse(request, { error: 'Method not allowed' }, 405);

  const url = new URL(request.url);
  const repo = url.searchParams.get('repo') || 'Ultimate-Guy/cosmic';
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo)) return jsonResponse(request, { error: 'Invalid repository.' }, 400);

  if (url.pathname === '/api/github/repo') {
    const { response, data } = await githubFetch(`/repos/${repo}`);
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
    const apiPath = `/repos/${repo}/contents/${encodedPath}${ref ? `?ref=${encodeURIComponent(ref)}` : ''}`;
    const { response, data } = await githubFetch(apiPath);
    if (!response.ok) return jsonResponse(request, { error: data.message || 'GitHub request failed.' }, response.status);
    if (Array.isArray(data) || data.type !== 'file' || !data.content) return jsonResponse(request, { error: 'That path is not a readable text file.' }, 400);
    const content = atob(data.content.replace(/\s/g, ''));
    let binary = '';
    for (let i = 0; i < content.length; i++) binary += String.fromCharCode(content.charCodeAt(i));
    return jsonResponse(request, {
      full_name: repo,
      path: filePath,
      sha: data.sha,
      size: data.size,
      content: new TextDecoder().decode(Uint8Array.from(binary, c => c.charCodeAt(0))),
      html_url: data.html_url
    });
  }

  return jsonResponse(request, { error: 'GitHub endpoint not found.' }, 404);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/admin-auth') return handleAdminAuth(request, env);
    if (url.pathname === '/api/ai') return handleAI(request, env);
    if (url.pathname.startsWith('/api/github/')) return handleGithub(request);
    return env.ASSETS.fetch(request);
  }
};
