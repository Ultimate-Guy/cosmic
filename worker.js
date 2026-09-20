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
      await this.state.storage.sql.exec(
        'CREATE TABLE IF NOT EXISTS site_state (key TEXT PRIMARY KEY, value TEXT NOT NULL)'
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

  async analytics(filters = {}) {
    const accounts = await this.state.storage.sql.exec(
      'SELECT username, created_at FROM accounts ORDER BY created_at DESC'
    ).toArray();
    const activity = await this.state.storage.sql.exec(
      'SELECT username, game_name, opens, last_opened FROM activity ORDER BY last_opened DESC LIMIT 1000'
    ).toArray();
    const topGames = await this.state.storage.sql.exec(
      'SELECT game_name, COALESCE(SUM(opens), 0) AS opens, COUNT(DISTINCT username) AS users, MAX(last_opened) AS last_opened FROM activity GROUP BY game_name ORDER BY opens DESC LIMIT 100'
    ).toArray();
    const recentUsers = await this.state.storage.sql.exec(
      'SELECT username, MAX(last_opened) AS last_opened, COUNT(DISTINCT game_name) AS games, COALESCE(SUM(opens), 0) AS opens FROM activity GROUP BY username ORDER BY last_opened DESC LIMIT 100'
    ).toArray();
    const usernameFilter = typeof filters.username === 'string' ? filters.username.trim().toLowerCase() : '';
    const gameFilter = typeof filters.game === 'string' ? filters.game.trim().toLowerCase() : '';
    const filteredActivity = activity.filter(a => (!usernameFilter || String(a.username).toLowerCase() === usernameFilter) && (!gameFilter || String(a.game_name).toLowerCase() === gameFilter));
    const filteredRecentUsers = recentUsers.filter(a => !usernameFilter || String(a.username).toLowerCase() === usernameFilter);
    return this.json({
      ok: true,
      account_count: accounts.length,
      accounts: accounts.map(a => ({ username: a.username, created_at: Number(a.created_at) })),
      activity: filteredActivity.map(a => ({ username: a.username, game_name: a.game_name, opens: Number(a.opens), last_opened: Number(a.last_opened) })),
      top_games: (gameFilter ? topGames.filter(a => String(a.game_name).toLowerCase() === gameFilter) : topGames).map(a => ({ game_name: a.game_name, opens: Number(a.opens), users: Number(a.users), last_opened: Number(a.last_opened) })),
      recent_users: filteredRecentUsers.map(a => ({ username: a.username, last_opened: Number(a.last_opened), games: Number(a.games), opens: Number(a.opens) }))
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

  async siteState() {
    const rows = await this.state.storage.sql.exec(
      'SELECT key, value FROM site_state'
    ).toArray();
    const raw = Object.fromEntries(rows.map(row => [row.key, row.value]));
    const parse = (key, fallback) => {
      try { return raw[key] ? JSON.parse(raw[key]) : fallback; } catch (_) { return fallback; }
    };
    return this.json({
      ok: true,
      blacklisted: parse('blacklisted', []),
      featured: parse('featured', []),
      maintenance: !!parse('maintenance', false),
      imported: parse('imported', []),
      announcement: parse('announcement', null),
      maintenance_message: parse('maintenance_message', ''),
      global: parse('global_state', {})
    });
  }

  async adminSiteState(request) {
    let body;
    try { body = await request.json(); } catch { return this.json({ ok: false, error: 'invalid-json' }, 400); }
    const action = typeof body?.action === 'string' ? body.action : '';
    const read = async (key, fallback) => {
      const row = await this.state.storage.sql.exec(
        'SELECT value FROM site_state WHERE key = ?', key
      ).one();
      if (!row) return fallback;
      try { return JSON.parse(row.value); } catch (_) { return fallback; }
    };
    const write = async (key, value) => {
      await this.state.storage.sql.exec(
        'INSERT INTO site_state (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
        key, JSON.stringify(value)
      );
    };

    if (action === 'blacklist_toggle') {
      const target = typeof body?.target === 'string' ? body.target.trim().slice(0, 500) : '';
      if (!target) return this.json({ ok: false, error: 'missing-target' }, 400);
      const list = await read('blacklisted', []);
      const index = list.findIndex(item => String(item?.target || '').toLowerCase() === target.toLowerCase());
      let enabled;
      if (index >= 0) {
        list.splice(index, 1);
        enabled = false;
      } else {
        list.push({ target, created_at: Date.now() });
        enabled = true;
      }
      await write('blacklisted', list.slice(-250));
      return this.siteState();
    }

    if (action === 'unfeature') {
      const name = typeof body?.name === 'string' ? body.name.trim().slice(0, 160) : '';
      if (!name) return this.json({ ok: false, error: 'missing-name' }, 400);
      const list = await read('featured', []);
      const filtered = list.filter(item => String(item?.name || '').toLowerCase() !== name.toLowerCase());
      await write('featured', filtered);
      return this.siteState();
    }

    if (action === 'feature_toggle') {
      const name = typeof body?.name === 'string' ? body.name.trim().slice(0, 160) : '';
      if (!name) return this.json({ ok: false, error: 'missing-name' }, 400);
      const list = await read('featured', []);
      const index = list.findIndex(item => String(item?.name || '').toLowerCase() === name.toLowerCase());
      if (index >= 0) list.splice(index, 1);
      else list.push({ name, created_at: Date.now() });
      await write('featured', list.slice(-20));
      return this.siteState();
    }

    if (action === 'announcement_set') {
      const text = typeof body?.text === 'string' ? body.text.trim().slice(0, 1000) : '';
      if (!text) return this.json({ ok: false, error: 'missing-announcement' }, 400);
      await write('announcement', { text, created_at: Date.now() });
      return this.siteState();
    }

    if (action === 'announcement_clear') {
      await write('announcement', null);
      return this.siteState();
    }

    if (action === 'maintenance_toggle') {
      const current = !!await read('maintenance', false);
      const enabled = !current;
      await write('maintenance', enabled);
      const message = typeof body?.message === 'string' ? body.message.trim().slice(0, 500) : '';
      if (enabled && message) await write('maintenance_message', message);
      if (!enabled) await write('maintenance_message', '');
      const global = await read('global_state', {});
      global.mode = { value: enabled ? 'maintenance' : 'normal', created_at: Date.now() };
      await write('global_state', global);
      return this.siteState();
    }

    if (action === 'import') {
      const incoming = Array.isArray(body?.items) ? body.items : [];
      if (!incoming.length) return this.json({ ok: false, error: 'no-items' }, 400);
      const clean = incoming.slice(0, 100).map(item => {
        const name = typeof item?.name === 'string' ? item.name.trim().slice(0, 160) : '';
        const path = typeof item?.path === 'string' ? item.path.trim().slice(0, 1000) : '';
        const kind = item?.kind === 'app' ? 'app' : 'game';
        if (!name || !path) return null;
        const entry = typeof item?.entry === 'string' ? item.entry.trim().slice(0, 300) : '';
        const image = typeof item?.image === 'string' ? item.image.trim().slice(0, 1000) : '';
        const description = typeof item?.description === 'string' ? item.description.trim().slice(0, 500) : '';
        const category = typeof item?.category === 'string' ? item.category.trim().slice(0, 60) : '';
        const tags = Array.isArray(item?.tags) ? item.tags.map(x => String(x).slice(0, 40)).slice(0, 10) : [];
        return { name, path, kind, ...(entry ? { entry } : {}), ...(image ? { image } : {}), ...(description ? { description } : {}), ...(category ? { category } : {}), tags };
      }).filter(Boolean);
      if (!clean.length) return this.json({ ok: false, error: 'invalid-items' }, 400);
      const existing = await read('imported', []);
      const merged = [...existing];
      for (const item of clean) {
        const key = (item.kind + ':' + item.name).toLowerCase();
        const index = merged.findIndex(x => (x.kind + ':' + x.name).toLowerCase() === key);
        if (index >= 0) merged[index] = item;
        else merged.push(item);
      }
      await write('imported', merged.slice(-250));
      return this.siteState();
    }

    if (action === 'global_notice_set' || action === 'site_banner_set' || action === 'global_message_set' || action === 'broadcast_set') {
      const text = typeof body?.text === 'string' ? body.text.trim().slice(0, 1000) : '';
      if (!text) return this.json({ ok: false, error: 'missing-text' }, 400);
      const keyMap = { global_notice_set: 'global_notice', site_banner_set: 'site_banner', global_message_set: 'global_message', broadcast_set: 'broadcast' };
      const key = keyMap[action];
      const global = await read('global_state', {});
      global[key] = { text, created_at: Date.now() };
      await write('global_state', global);
      return this.siteState();
    }

    if (action === 'global_notice_clear' || action === 'site_banner_clear' || action === 'global_message_clear' || action === 'broadcast_clear' || action === 'global_badge_clear' || action === 'spotlight_clear' || action === 'countdown_clear') {
      const keyMap = {
        global_notice_clear: 'global_notice', site_banner_clear: 'site_banner', global_message_clear: 'global_message',
        broadcast_clear: 'broadcast', global_badge_clear: 'global_badge', spotlight_clear: 'spotlight', countdown_clear: 'countdown'
      };
      const global = await read('global_state', {});
      delete global[keyMap[action]];
      await write('global_state', global);
      return this.siteState();
    }

    if (action === 'sitemode_set' || action === 'global_theme_set' || action === 'global_badge_set' || action === 'spotlight_set' || action === 'countdown_set' || action === 'event_set' || action === 'event_message' || action === 'event_timer' || action === 'gameannounce_set' || action === 'disabled_game_toggle' || action === 'maintenance_set') {
      const global = await read('global_state', {});
      if (action === 'sitemode_set') {
        const mode = typeof body?.mode === 'string' ? body.mode.trim().slice(0, 40).toLowerCase() : '';
        if (!['normal','maintenance'].includes(mode)) return this.json({ ok: false, error: 'invalid-mode', allowed: ['normal','maintenance'] }, 400);
        const enabled = mode === 'maintenance';
        if (mode === 'normal' || mode === 'maintenance') await write('maintenance', enabled);
        global.mode = { value: mode, created_at: Date.now() };
      } else if (action === 'global_theme_set') {
        const theme = typeof body?.theme === 'string' ? body.theme.trim().toLowerCase() : '';
        if (!['nebula','deep-space','solar-flare','synthwave'].includes(theme)) return this.json({ ok: false, error: 'invalid-theme' }, 400);
        global.theme = { value: theme, created_at: Date.now() };
      } else if (action === 'global_badge_set') {
        const text = typeof body?.text === 'string' ? body.text.trim().slice(0, 120) : '';
        if (!text) return this.json({ ok: false, error: 'missing-text' }, 400);
        global.global_badge = { text, created_at: Date.now() };
      } else if (action === 'spotlight_set') {
        const name = typeof body?.name === 'string' ? body.name.trim().slice(0, 160) : '';
        if (!name) return this.json({ ok: false, error: 'missing-name' }, 400);
        global.spotlight = { name, created_at: Date.now() };
      } else if (action === 'countdown_set') {
        const minutes = Number(body?.minutes);
        const target = Number(body?.target);
        const label = typeof body?.label === 'string' ? body.label.trim().slice(0, 160) : 'Countdown';
        const end = Number.isFinite(target) && target > Date.now() ? target : (Number.isFinite(minutes) && minutes > 0 ? Date.now() + Math.min(minutes, 7 * 24 * 60) * 60000 : 0);
        if (!end) return this.json({ ok: false, error: 'invalid-countdown' }, 400);
        global.countdown = { label, target: end, created_at: Date.now() };
      } else if (action === 'event_set') {
        const name = typeof body?.name === 'string' ? body.name.trim().slice(0, 160) : '';
        if (!name) return this.json({ ok: false, error: 'missing-name' }, 400);
        global.event = { name, message: typeof body?.message === 'string' ? body.message.trim().slice(0, 500) : '', target: Number(body?.target) > Date.now() ? Number(body.target) : null, created_at: Date.now() };
      } else if (action === 'event_message') {
        if (!global.event) return this.json({ ok: false, error: 'no-event' }, 400);
        global.event.message = typeof body?.message === 'string' ? body.message.trim().slice(0, 500) : '';
        global.event.updated_at = Date.now();
      } else if (action === 'event_timer') {
        if (!global.event) return this.json({ ok: false, error: 'no-event' }, 400);
        const minutes = Number(body?.minutes); const target = Number(body?.target);
        const end = Number.isFinite(target) && target > Date.now() ? target : (Number.isFinite(minutes) && minutes > 0 ? Date.now() + Math.min(minutes, 7 * 24 * 60) * 60000 : 0);
        if (!end) return this.json({ ok: false, error: 'invalid-timer' }, 400);
        global.event.target = end; global.event.updated_at = Date.now();
      } else if (action === 'gameannounce_set') {
        const game = typeof body?.game === 'string' ? body.game.trim().slice(0, 160) : '';
        const text = typeof body?.text === 'string' ? body.text.trim().slice(0, 500) : '';
        if (!game || !text) return this.json({ ok: false, error: 'missing-game-or-text' }, 400);
        const list = Array.isArray(global.game_announcements) ? global.game_announcements : [];
        const key = game.toLowerCase();
        const idx = list.findIndex(x => String(x?.game || '').toLowerCase() === key);
        const entry = { game, text, created_at: Date.now() };
        if (idx >= 0) list[idx] = entry; else list.push(entry);
        global.game_announcements = list.slice(-100);
      } else if (action === 'disabled_game_toggle' || action === 'disabled_game_enable') {
        const name = typeof body?.name === 'string' ? body.name.trim().slice(0, 160) : '';
        if (!name) return this.json({ ok: false, error: 'missing-name' }, 400);
        const list = Array.isArray(global.disabled_games) ? global.disabled_games : [];
        const idx = list.findIndex(x => String(x).toLowerCase() === name.toLowerCase());
        if (action === 'disabled_game_enable') { if (idx >= 0) list.splice(idx, 1); }
        else if (idx >= 0) list.splice(idx, 1); else list.push(name);
        global.disabled_games = list.slice(-250);
      } else if (action === 'maintenance_set') {
        const enabled = body?.enabled !== false;
        global.mode = { value: enabled ? 'maintenance' : 'normal', created_at: Date.now() };
        await write('maintenance', enabled);
        await write('maintenance_message', typeof body?.message === 'string' ? body.message.trim().slice(0, 500) : '');
      }
      await write('global_state', global);
      return this.siteState();
    }

    if (action === 'event_end') {
      const global = await read('global_state', {});
      delete global.event;
      delete global.countdown;
      await write('global_state', global);
      return this.siteState();
    }

    if (action === 'featured_rotate') {
      const list = await read('featured', []);
      if (list.length > 1) list.push(list.shift());
      await write('featured', list);
      const global = await read('global_state', {});
      global.spotlight = list[0] ? { name: String(list[0].name || ''), created_at: Date.now() } : undefined;
      await write('global_state', global);
      return this.siteState();
    }

    if (action === 'global_refresh' || action === 'global_reload' || action === 'sync_signal') {
      const global = await read('global_state', {});
      global[action === 'global_refresh' ? 'global_refresh' : action === 'global_reload' ? 'global_reload' : 'sync_signal'] = Date.now();
      await write('global_state', global);
      return this.siteState();
    }

    if (action === 'clearall') {
      const keys = ['blacklisted','featured','maintenance','maintenance_message','imported','announcement','global_state'];
      for (const key of keys) await write(key, key === 'maintenance' ? false : key === 'global_state' ? {} : key === 'maintenance_message' ? '' : key === 'announcement' ? null : []);
      return this.siteState();
    }

    return this.json({ ok: false, error: 'unknown-action' }, 400);
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
    if (url.pathname === '/analytics' && request.method === 'GET') return this.analytics();
    if (url.pathname === '/state' && request.method === 'GET') return this.siteState();
    if (url.pathname === '/admin-site-state' && request.method === 'POST') return this.adminSiteState(request);
    return this.json({ ok: false, error: 'not-found' }, 404);
  }
}

const COSMIC_DEPLOYMENT_COMMIT = '__COSMIC_DEPLOYMENT_COMMIT__';
const COSMIC_DEPLOYMENT_TIMESTAMP = '__COSMIC_DEPLOYMENT_TIMESTAMP__';

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

async function forwardJsonResponse(request, response) {
  let body;
  try {
    body = await response.json();
  } catch (_) {
    body = { ok: false, error: 'Upstream Durable Object returned invalid JSON.' };
  }
  return jsonResponse(request, body, response.status);
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
  let authorization = request.headers.get('Authorization') || '';
  if (!authorization.startsWith('Bearer ')) {
    const cookie = request.headers.get('Cookie') || '';
    const match = cookie.match(/(?:^|;\s*)cosmic_admin_session=([^;]+)/);
    if (match) authorization = 'Bearer ' + decodeURIComponent(match[1]);
  }
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
  const token = await createAdminSession(expected);
  const response = jsonResponse(request, { ok: true, token });
  response.headers.append('Set-Cookie', 'cosmic_admin_session=' + encodeURIComponent(token) + '; Path=/; Max-Age=3600; Secure; HttpOnly; SameSite=Lax');
  return response;
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

async function handleDeveloperSysinfo(request, env) {
  if (!(await verifyAdminSession(request, env))) return jsonResponse(request, { ok: false, error: 'unauthorized' }, 401);
  const cf = request.cf || {};
  return jsonResponse(request, {
    ok: true,
    worker: 'cosmicv2',
    edge_region: cf.colo || 'unknown',
    country: cf.country || 'unknown',
    build_timestamp: COSMIC_DEPLOYMENT_TIMESTAMP,
    source_commit: COSMIC_DEPLOYMENT_COMMIT,
    configured: {
      ASSETS: !!env.ASSETS,
      USERNAME_REGISTRY: !!env.USERNAME_REGISTRY,
      COSMIC_ADMIN_PASSWORD: typeof env.COSMIC_ADMIN_PASSWORD === 'string' && !!env.COSMIC_ADMIN_PASSWORD,
      OPENROUTER_API_KEY: typeof env.OPENROUTER_API_KEY === 'string' && !!env.OPENROUTER_API_KEY
    }
  });
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


async function getMaintenanceMessage(env) {
  try {
    const registry = env.USERNAME_REGISTRY;
    const response = await registry.get(registry.idFromName('global')).fetch(new Request('https://internal/state'));
    const data = await response.json();
    return typeof data.maintenance_message === 'string' ? data.maintenance_message.replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c])) : '';
  } catch (_) { return ''; }
}

async function isMaintenanceMode(env) {
  try {
    const registry = env.USERNAME_REGISTRY;
    const response = await registry.get(registry.idFromName('global')).fetch(
      new Request('https://internal/state')
    );
    const data = await response.json();
    return !!data.maintenance;
  } catch (_) {
    return false;
  }
}

async function handleMaintenanceBypass(request, env) {
  const authorization = request.headers.get('Authorization') || '';
  return await verifyAdminSession(new Request(request.url, { headers: { Authorization: authorization } }), env);
}

async function handleSiteState(request, env) {
  if (request.method !== 'GET') return jsonResponse(request, { ok: false }, 405);
  const registry = env.USERNAME_REGISTRY;
  const response = await registry.get(registry.idFromName('global')).fetch(new Request(new URL('/state', request.url), request));
  return forwardJsonResponse(request, response);
}

async function handleAdminSiteState(request, env) {
  if (!(await verifyAdminSession(request, env))) return jsonResponse(request, { ok: false, error: 'unauthorized' }, 401);
  const registry = env.USERNAME_REGISTRY;
  const response = await registry.get(registry.idFromName('global')).fetch(
    new Request(new URL('/admin-site-state', request.url), request)
  );
  return forwardJsonResponse(request, response);
}

async function handleAdminAccounts(request, env) {
  if (!(await verifyAdminSession(request, env))) return jsonResponse(request, { ok: false, error: 'unauthorized' }, 401);
  const registry = env.USERNAME_REGISTRY;
  const url = new URL(request.url);
  const id = registry.idFromName('global');
  if (url.pathname === '/api/admin/accounts') {
    const response = await registry.get(id).fetch(new Request(new URL('/list', request.url), request));
    return forwardJsonResponse(request, response);
  }
  if (url.pathname === '/api/admin/account') {
    const username = url.searchParams.get('username') || '';
    const response = await registry.get(id).fetch(new Request(new URL('/detail?username=' + encodeURIComponent(username), request.url), request));
    return forwardJsonResponse(request, response);
  }
  return jsonResponse(request, { ok: false, error: 'not-found' }, 404);
}

async function handleAdminGlobal(request, env) {
  if (!(await verifyAdminSession(request, env))) return jsonResponse(request, { ok: false, error: 'unauthorized' }, 401);
  let body;
  try { body = await request.json(); } catch { return jsonResponse(request, { ok: false, error: 'invalid-json' }, 400); }
  const action = typeof body?.action === 'string' ? body.action : '';
  const analyticsActions = new Set(['account','online','recentusers','userstats','activitylog','topgames','recentgames']);
  if (analyticsActions.has(action)) {
    const registry = env.USERNAME_REGISTRY;
    const internal = await registry.get(registry.idFromName('global')).fetch(new Request('https://internal/analytics'));
    return jsonResponse(request, await internal.json(), internal.status);
  }
  if (action === 'gamecount' || action === 'gameinfo') {
    const readAsset = async path => {
      try {
        const response = await env.ASSETS.fetch(new Request(new URL(path, request.url)));
        const data = await response.json();
        return Array.isArray(data) ? data : [];
      } catch (_) { return []; }
    };
    const [games,apps] = await Promise.all([readAsset('/pages/lessons/games.json'),readAsset('/apps/apps.json')]);
    if (action === 'gamecount') return jsonResponse(request,{ok:true,games:games.length,apps:apps.length,total:games.length+apps.length});
    const name = typeof body?.name === 'string' ? body.name.trim().toLowerCase() : '';
    const item = [...games.map(x=>({...x,kind:'game'})),...apps.map(x=>({...x,kind:'app'}))].find(x=>String(x.name||'').toLowerCase()===name);
    const registry = env.USERNAME_REGISTRY;
    const analytics = await registry.get(registry.idFromName('global')).fetch(new Request('https://internal/analytics')).then(r=>r.json());
    const stats = (analytics.top_games||[]).find(x=>String(x.game_name||'').toLowerCase()===name) || null;
    return jsonResponse(request,{ok:true,item:item||null,stats});
  }
  if (action === 'status' || action === 'version' || action === 'deployinfo' || action === 'sysinfo') return handleDeveloperSysinfo(request,env);
  if (action === 'routes') return jsonResponse(request,{ok:true,routes:['/api/site-state','/api/admin/site-state','/api/admin/global','/api/admin/accounts','/api/admin/account','/api/developer/sysinfo','/api/deployment-status','/api/hub-diagnostics','/api/ai']});
  if (action === 'assets') return jsonResponse(request,{ok:true,bindings:{ASSETS:!!env.ASSETS,USERNAME_REGISTRY:!!env.USERNAME_REGISTRY},notes:'Static assets are served through the configured Workers Assets binding.'});
  if (action === 'healthcheck' || action === 'diagnostics') {
    const started=Date.now();
    const checks=[];
    try { const r=await fetch(new URL('/api/deployment-status',request.url),{cache:'no-store'}); checks.push({name:'deployment-status',status:r.status,ok:r.ok}); } catch(e){ checks.push({name:'deployment-status',status:0,ok:false,error:String(e)}); }
    try { const reg=env.USERNAME_REGISTRY; const r=await reg.get(reg.idFromName('global')).fetch(new Request('https://internal/state')); checks.push({name:'username-registry',status:r.status,ok:r.ok}); } catch(e){ checks.push({name:'username-registry',status:0,ok:false,error:String(e)}); }
    return jsonResponse(request,{ok:checks.every(x=>x.ok),duration_ms:Date.now()-started,checks});
  }
  if (action === 'latency') {
    const started=Date.now();
    try { const r=await fetch(new URL('/api/deployment-status',request.url),{cache:'no-store'}); return jsonResponse(request,{ok:r.ok,status:r.status,latency_ms:Date.now()-started}); }
    catch(e){ return jsonResponse(request,{ok:false,latency_ms:Date.now()-started,error:String(e)},502); }
  }
  if (action === 'cacheinfo' || action === 'errors' || action === 'requests') return jsonResponse(request,{ok:true,scope:'local',note: action==='cacheinfo'?'Browser cache data is local to the current device.':'Historical browser request/error logs are not stored by Cosmic; use /toggledebug for live local request/error capture.'});

  // All remaining global mutation commands share the Durable Object-backed site state.
  const registry=env.USERNAME_REGISTRY;
  const forwarded=new Request(new URL('/admin-site-state',request.url),{method:'POST',headers:request.headers,body:JSON.stringify(body)});
  const internal=await registry.get(registry.idFromName('global')).fetch(forwarded);
  return jsonResponse(request, await internal.json(), internal.status);
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
    if (url.pathname === '/api/site-state') return handleSiteState(request, env);
    if (url.pathname === '/api/admin/site-state') return handleAdminSiteState(request, env);
    if (url.pathname === '/api/admin/global') return handleAdminGlobal(request, env);
    if (url.pathname === '/api/deployment-status') return handleDeploymentStatus(request);
    if (url.pathname === '/api/developer/sysinfo') return handleDeveloperSysinfo(request, env);
    if (url.pathname === '/api/hub-diagnostics') return handleHubDiagnostics(request, env);
    if (url.pathname === '/api/ai') return handleAI(request, env);
    if (url.pathname === '/api/admin/auth' || url.pathname === '/api/admin-auth') return handleAdminAuth(request, env);
    if ((url.pathname === '/api/usernames/reserve' || url.pathname === '/api/accounts/activity') && request.method === 'POST') {
      const id = env.USERNAME_REGISTRY.idFromName('global');
      const target = url.pathname === '/api/usernames/reserve' ? '/reserve' : '/activity';
      return env.USERNAME_REGISTRY.get(id).fetch(new Request(new URL(target, request.url), request));
    }

    if (request.method === 'GET' || request.method === 'HEAD') {
      const maintenance = await isMaintenanceMode(env);
      const bypass = maintenance ? await handleMaintenanceBypass(request, env) : false;
      const isMaintenanceAsset = url.pathname === '/api/site-state' || url.pathname === '/api/admin/site-state' ||
        /^(\/scripts\/cosmic-dev-tools\.js|\/worker\.js|\/sw\.js)$/i.test(url.pathname);
      if (maintenance && !bypass && !isMaintenanceAsset && !url.pathname.startsWith('/api/')) {
        return new Response(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Cosmic • Maintenance</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#050c12;color:#f2f7fa;font:16px system-ui,sans-serif;text-align:center}main{max-width:560px;padding:32px;border:1px solid #2dccff;border-radius:22px;background:#07131a;box-shadow:0 25px 80px rgba(0,0,0,.55)}h1{color:#2dccff}</style></head><body><main><div style="font-size:48px">☄</div><h1>Cosmic is under maintenance</h1><p>${await getMaintenanceMessage(env)}</p></main></body></html>`,{status:503,headers:{'Content-Type':'text/html; charset=UTF-8','Cache-Control':'no-store'}});
      }
      const hub = await serveHub(request, env);
      if (hub) return hub;
      return fetchAsset(request, env);
    }
    return fetchAsset(request, env);
  }
};
export { UsernameRegistry };
