(() => {
  'use strict';
  if (window.__COSMIC_REQUIRED_ACCOUNT_GATE__) return;
  window.__COSMIC_REQUIRED_ACCOUNT_GATE__ = true;

  const ACCOUNT_KEY = 'cosmicCloudAccountV1';
  const LOCAL_ACCOUNTS_KEY = 'cosmicAccountsV1';
  const CURRENT_USER_KEY = 'cosmicCurrentUserV1';
  const API = 'https://cosmicv2.v75ultimate.workers.dev';
  const isEntryPage = /\/pages\/lessons\/lessons\.html$/i.test(location.pathname);
  const hasEntry = () => {
    try { return sessionStorage.getItem('cosmicGamesUnlocked') === '1'; } catch (_) { return false; }
  };
  const read = (key, fallback) => {
    try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch (_) { return fallback; }
  };
  const write = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) {} };
  const safe = value => String(value || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let mounted = false;

  async function request(path, body) {
    const response = await fetch(API + path, {
      method: body ? 'POST' : 'GET',
      headers: body ? {'Content-Type':'application/json'} : {},
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store'
    });
    const type = response.headers.get('content-type') || '';
    const data = type.includes('application/json') ? await response.json() : {};
    if (!response.ok || data.ok === false) {
      const error = new Error(data.error || 'account-service-unavailable');
      error.status = response.status;
      throw error;
    }
    return data;
  }

  async function verify(account) {
    if (!account?.username || !account?.account_token) return false;
    try {
      await request('/api/cosmic-profile?username=' + encodeURIComponent(account.username) +
        '&account_token=' + encodeURIComponent(account.account_token));
      return true;
    } catch (_) { return false; }
  }

  function setActive(account) {
    write(ACCOUNT_KEY, {username:account.username, account_token:account.account_token});
    try { localStorage.setItem(CURRENT_USER_KEY, account.username); } catch (_) {}
    try {
      const accounts = read(LOCAL_ACCOUNTS_KEY, {});
      const key = account.username.toLowerCase();
      accounts[key] = {...(accounts[key] || {}), username:account.username,
        accountToken:account.account_token, account_token:account.account_token};
      write(LOCAL_ACCOUNTS_KEY, accounts);
    } catch (_) {}
    try { window.dispatchEvent(new Event('cosmic-account-changed')); } catch (_) {}
  }

  async function passwordHash(password, salt) {
    const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({name:'PBKDF2',salt:new TextEncoder().encode(salt),iterations:100000,hash:'SHA-256'}, material, 256);
    return Array.from(new Uint8Array(bits)).map(n=>n.toString(16).padStart(2,'0')).join('');
  }

  function mount() {
    if (mounted || !document.body) return;
    mounted = true;
    const style = document.createElement('style');
    style.textContent = `
      #cosmic-required-account{position:fixed;inset:0;z-index:2147483647;display:grid;place-items:center;padding:18px;background:radial-gradient(ellipse at 50% 0%,rgba(45,204,255,.18),transparent 48%),rgba(2,7,12,.98);font-family:system-ui,sans-serif;color:#edfaff}
      #cosmic-required-account *{box-sizing:border-box}
      #cosmic-required-account .cra-card{width:min(460px,96vw);max-height:92vh;overflow:auto;padding:clamp(22px,5vw,36px);border:1px solid rgba(45,204,255,.55);border-radius:24px;background:linear-gradient(145deg,#0c1b25,#050b11);box-shadow:0 28px 100px #000b}
      #cosmic-required-account .cra-mark{font-size:12px;letter-spacing:4px;color:#2dccff;font-weight:900}
      #cosmic-required-account h1{font-size:clamp(25px,5vw,34px);margin:12px 0 8px}
      #cosmic-required-account p{color:#b7cbd5;line-height:1.5}
      #cosmic-required-account label{display:block;font-size:13px;color:#b7cbd5;margin:13px 0}
      #cosmic-required-account input{display:block;width:100%;margin-top:6px;padding:12px;border:1px solid #234654;border-radius:10px;background:#02070b;color:#fff;font:inherit;outline-color:#2dccff}
      #cosmic-required-account button{padding:11px 14px;border:1px solid #2dccff;border-radius:10px;background:#0b202b;color:#2dccff;font-weight:800;cursor:pointer}
      #cosmic-required-account button.cra-primary{background:#2dccff;color:#031721;width:100%;margin-top:10px}
      #cosmic-required-account button:disabled{opacity:.55;cursor:wait}
      #cosmic-required-account .cra-switch{display:flex;gap:8px;margin:18px 0 8px}
      #cosmic-required-account .cra-switch button{flex:1}
      #cosmic-required-account .cra-switch button[aria-pressed=true]{background:#163847}
      #cosmic-required-account [data-message]{min-height:24px;font-size:13px;color:#ffbf8d;overflow-wrap:anywhere}
    `;
    document.head.appendChild(style);
    const overlay = document.createElement('section');
    overlay.id = 'cosmic-required-account';
    overlay.setAttribute('role','dialog');
    overlay.setAttribute('aria-modal','true');
    overlay.setAttribute('aria-labelledby','cra-title');
    overlay.innerHTML = `<div class="cra-card">
      <div class="cra-mark">COSMIC ACCOUNT</div>
      <h1 id="cra-title">One account. Your Cosmic.</h1>
      <p>Create an account or log in to continue to the rest of Cosmic. Your account is checked by Cosmic Cloud.</p>
      <div class="cra-switch"><button type="button" data-mode="create" aria-pressed="true">Create account</button><button type="button" data-mode="login" aria-pressed="false">Log in</button></div>
      <form novalidate>
        <label>Username<input name="username" autocomplete="username" minlength="3" maxlength="24" required placeholder="3–24 letters, numbers, underscores"></label>
        <label data-password-label>Password<input name="password" type="password" autocomplete="new-password" minlength="6" required placeholder="At least 6 characters"></label>
        <label data-confirm-label>Confirm password<input name="confirm" type="password" autocomplete="new-password" minlength="6" required placeholder="Enter it again"></label>
        <p data-message role="status" aria-live="polite"></p>
        <button class="cra-primary" type="submit">Create account and continue</button>
      </form>
    </div>`;
    document.body.appendChild(overlay);
    const form = overlay.querySelector('form');
    const modeButtons = [...overlay.querySelectorAll('[data-mode]')];
    const password = form.elements.password;
    const confirm = form.elements.confirm;
    const submit = form.querySelector('[type=submit]');
    const message = overlay.querySelector('[data-message]');
    let mode = 'create';
    modeButtons.forEach(button => button.addEventListener('click', () => {
      mode = button.dataset.mode;
      modeButtons.forEach(b => b.setAttribute('aria-pressed', String(b === button)));
      overlay.querySelector('[data-confirm-label]').hidden = mode !== 'create';
      confirm.required = mode === 'create';
      password.autocomplete = mode === 'create' ? 'new-password' : 'current-password';
      submit.textContent = mode === 'create' ? 'Create account and continue' : 'Log in and continue';
      message.textContent = '';
    }));
    form.addEventListener('submit', async event => {
      event.preventDefault();
      const username = form.elements.username.value.trim();
      const pass = password.value;
      if (!/^[A-Za-z0-9_]{3,24}$/.test(username)) { message.textContent = 'Username must be 3–24 letters, numbers, or underscores.'; return; }
      if (pass.length < 6) { message.textContent = 'Password must be at least 6 characters.'; return; }
      if (mode === 'create' && pass !== confirm.value) { message.textContent = 'Passwords do not match.'; return; }
      submit.disabled = true;
      message.textContent = mode === 'create' ? 'Creating your account…' : 'Checking your login…';
      try {
        let account;
        if (mode === 'create') {
          const data = await request('/api/usernames/reserve', {username, password:pass});
          account = {username:data.username || username, account_token:data.account_token};
          const accounts = read(LOCAL_ACCOUNTS_KEY, {});
          const salt = Array.from(crypto.getRandomValues(new Uint8Array(16))).map(n=>n.toString(16).padStart(2,'0')).join('');
          const hash = await passwordHash(pass, salt);
          accounts[username.toLowerCase()] = {username, salt, hash, accountToken:account.account_token, account_token:account.account_token, createdAt:Date.now()};
          write(LOCAL_ACCOUNTS_KEY, accounts);
        } else {
          try {
            const data = await request('/api/accounts/login', {username, password:pass});
            account = {username:data.username || username, account_token:data.account_token};
          } catch (cloudError) {
            // Keep same-device legacy accounts usable if they already have a cloud token.
            const legacy = read(LOCAL_ACCOUNTS_KEY, {})[username.toLowerCase()];
            if (!legacy?.salt || !legacy?.hash || !legacy?.accountToken) throw cloudError;
            if (await passwordHash(pass, legacy.salt) !== legacy.hash) throw cloudError;
            account = {username:legacy.username || username, account_token:legacy.accountToken};
          }
        }
        if (!account.account_token || !(await verify(account))) throw new Error('account-verification-failed');
        setActive(account);
        overlay.remove();
        try { window.dispatchEvent(new Event('cosmic-account-authenticated')); } catch (_) {}
      } catch (error) {
        const errors = {
          taken:'That username is already taken.',
          'invalid-credentials':'Username or password is incorrect.',
          'cloud-login-not-enabled':'This older account has no Cloud password yet. Log in on the device where it was created, then set a Cloud password in account settings.',
          'account-verification-failed':'The account could not be verified. Please try again.',
          'account-service-unavailable':'Cosmic Cloud is temporarily unavailable. Please try again.'
        };
        message.textContent = errors[error.message] || (error.message === 'account-service-unavailable' ? errors[error.message] : 'Could not complete account authentication. Please try again.');
      } finally { submit.disabled = false; }
    });
    password.focus();
  }

  async function start() {
    if (isEntryPage && !hasEntry()) return;
    const existing = read(ACCOUNT_KEY, {});
    if (await verify(existing)) {
      setActive(existing);
      return;
    }
    mount();
  }

  if (isEntryPage && !hasEntry()) {
    window.addEventListener('cosmic-entry-ready', () => { start(); }, {once:true});
  } else {
    start();
  }
  window.addEventListener('storage', event => {
    if (event.key === ACCOUNT_KEY || event.key === null) start();
  });
})();
