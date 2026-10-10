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
      await this.state.storage.sql.exec('CREATE TABLE IF NOT EXISTS profiles (username TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at INTEGER NOT NULL)');
      try { await this.state.storage.sql.exec('ALTER TABLE accounts ADD COLUMN password_salt TEXT'); } catch (_) {}
      try { await this.state.storage.sql.exec('ALTER TABLE accounts ADD COLUMN password_hash TEXT'); } catch (_) {}
      await this.state.storage.sql.exec(
        'CREATE TABLE IF NOT EXISTS site_state (key TEXT PRIMARY KEY, value TEXT NOT NULL)'
      );
      await this.state.storage.sql.exec(
        "CREATE TABLE IF NOT EXISTS community_submissions (id TEXT PRIMARY KEY, username TEXT NOT NULL, kind TEXT NOT NULL, name TEXT NOT NULL, source_url TEXT NOT NULL, url_key TEXT NOT NULL, notes TEXT NOT NULL DEFAULT '', status TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, reviewed_at INTEGER, reviewer TEXT NOT NULL DEFAULT '', review_note TEXT NOT NULL DEFAULT '')"
      );
      await this.state.storage.sql.exec(
        "CREATE INDEX IF NOT EXISTS community_submissions_status_created ON community_submissions(status, created_at)"
      );
      await this.state.storage.sql.exec(
        "CREATE INDEX IF NOT EXISTS community_submissions_owner_created ON community_submissions(username, created_at)"
      );
      await this.state.storage.sql.exec(
        "CREATE TABLE IF NOT EXISTS community_reviews (game_key TEXT NOT NULL, username TEXT NOT NULL, game_name TEXT NOT NULL, rating INTEGER NOT NULL, result TEXT NOT NULL, text TEXT NOT NULL DEFAULT '', status TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, reviewed_at INTEGER, reviewer TEXT NOT NULL DEFAULT '', review_note TEXT NOT NULL DEFAULT '', PRIMARY KEY(game_key, username))"
      );
      await this.state.storage.sql.exec(
        "CREATE INDEX IF NOT EXISTS community_reviews_status_created ON community_reviews(status, created_at)"
      );
      await this.state.storage.sql.exec(
        "CREATE TABLE IF NOT EXISTS source_lockfiles (id TEXT PRIMARY KEY, username TEXT NOT NULL, label TEXT NOT NULL, status TEXT NOT NULL, value TEXT NOT NULL, parent_id TEXT, created_at INTEGER NOT NULL, reviewed_at INTEGER, reviewer TEXT NOT NULL DEFAULT '', review_note TEXT NOT NULL DEFAULT '')"
      );
      await this.state.storage.sql.exec(
        "CREATE INDEX IF NOT EXISTS source_lockfiles_owner_created ON source_lockfiles(username, created_at)"
      );
    });
  }

  json(body, status = 200) {
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
    });
  }

  async passwordHash(password, salt) {
    const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']);
    const bits=await crypto.subtle.deriveBits({name:'PBKDF2',salt:new TextEncoder().encode(salt),iterations:120000,hash:'SHA-256'},key,256);
    return Array.from(new Uint8Array(bits)).map(x=>x.toString(16).padStart(2,'0')).join('');
  }
  async reserve(username, password='') {
    const key = username.toLowerCase();
    const existing = await this.state.storage.sql.exec(
      'SELECT username, account_token FROM accounts WHERE username = ?', key
    ).toArray()[0];
    if (existing) return this.json({ ok: false, error: 'taken' }, 409);

    const token = crypto.randomUUID();
    const now = Date.now();
    await this.state.storage.sql.exec(
      'INSERT INTO usernames (username, created_at) VALUES (?, ?)', key, now
    );
    const salt=crypto.randomUUID();
    const passwordHash=password?await this.passwordHash(password,salt):'';
    await this.state.storage.sql.exec(
      'INSERT INTO accounts (username, created_at, account_token, password_salt, password_hash) VALUES (?, ?, ?, ?, ?)', key, now, token, salt, passwordHash
    );
    return this.json({ ok: true, username, account_token: token });
  }

  async accountLogin(request) {
    let body; try { body=await request.json(); } catch { return this.json({ok:false,error:'invalid-json'},400); }
    const username=typeof body?.username==='string'?body.username.trim():''; const password=typeof body?.password==='string'?body.password:'';
    if(!username||!password)return this.json({ok:false,error:'missing-fields'},400);
    const key=username.toLowerCase(); const account=await this.state.storage.sql.exec('SELECT username,account_token,password_salt,password_hash FROM accounts WHERE username = ?',key).toArray()[0];
    if(!account)return this.json({ok:false,error:'invalid-credentials'},401);
    if(!account.password_hash||!account.password_salt)return this.json({ok:false,error:'cloud-login-not-enabled'},409);
    if(await this.passwordHash(password,account.password_salt)!==account.password_hash)return this.json({ok:false,error:'invalid-credentials'},401);
    return this.json({ok:true,username:account.username,account_token:account.account_token});
  }
  async accountPassword(request) {
    let body; try { body=await request.json(); } catch { return this.json({ok:false,error:'invalid-json'},400); }
    const username=typeof body?.username==='string'?body.username.trim():''; const token=typeof body?.account_token==='string'?body.account_token:''; const password=typeof body?.password==='string'?body.password:'';
    if(!username||!token||password.length<6)return this.json({ok:false,error:'missing-fields'},400);
    const key=username.toLowerCase(); const account=await this.state.storage.sql.exec('SELECT account_token FROM accounts WHERE username = ?',key).toArray()[0];
    if(!account||account.account_token!==token)return this.json({ok:false,error:'unauthorized'},401);
    const salt=crypto.randomUUID(); const hash=await this.passwordHash(password,salt);
    await this.state.storage.sql.exec('UPDATE accounts SET password_salt=?, password_hash=? WHERE username=?',salt,hash,key);
    return this.json({ok:true});
  }
  async cloudProfile(request) {
    let username='', token='';
    if (request.method === 'GET') {
      const url=new URL(request.url);
      username=(url.searchParams.get('username')||'').trim();
      token=url.searchParams.get('account_token')||'';
    } else {
      let body; try { body=await request.json(); } catch { return this.json({ok:false,error:'invalid-json'},400); }
      username=typeof body?.username==='string'?body.username.trim():'';
      token=typeof body?.account_token==='string'?body.account_token:'';
    }
    if(!username||!token)return this.json({ok:false,error:'missing-fields'},400);
    const key=username.toLowerCase(); const account=await this.state.storage.sql.exec('SELECT account_token FROM accounts WHERE username = ?',key).toArray()[0];
    if(!account||account.account_token!==token)return this.json({ok:false,error:'unauthorized'},401);
    const profile=await this.state.storage.sql.exec('SELECT value FROM profiles WHERE username = ?',key).toArray()[0];
    let value={};
    if(profile?.value){try{value=JSON.parse(profile.value)||{}}catch(_){value={};}}
    return this.json({ok:true,profile:value});
  }
  async cloudProfileWrite(request) {
    let body; try { body=await request.json(); } catch { return this.json({ok:false,error:'invalid-json'},400); }
    const username=typeof body?.username==='string'?body.username.trim():''; const token=typeof body?.account_token==='string'?body.account_token:'';
    if(!username||!token)return this.json({ok:false,error:'missing-fields'},400);
    const key=username.toLowerCase(); const account=await this.state.storage.sql.exec('SELECT account_token FROM accounts WHERE username = ?',key).toArray()[0];
    if(!account||account.account_token!==token)return this.json({ok:false,error:'unauthorized'},401);
    const value=body?.profile&&typeof body.profile==='object'?JSON.stringify(body.profile):'{}';
    await this.state.storage.sql.exec('INSERT INTO profiles (username,value,updated_at) VALUES (?,?,?) ON CONFLICT(username) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at',key,value,Date.now());
    return this.json({ok:true,profile:JSON.parse(value)});
  }
  async authenticatedAccount(request, body = {}) {
    const url = new URL(request.url);
    const username = String(body.username || request.headers.get('X-Cosmic-Username') || url.searchParams.get('username') || '').trim();
    const authorization = request.headers.get('Authorization') || '';
    const bearer = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
    const token = String(body.account_token || bearer || '').trim();
    if (!username || !token) return null;
    const key = username.toLowerCase();
    const account = await this.state.storage.sql.exec(
      'SELECT username, account_token, password_salt, password_hash, created_at FROM accounts WHERE username = ?', key
    ).toArray()[0];
    if (!account || account.account_token !== token) return null;
    return { key, account };
  }

  async communitySubmissions(request) {
    if (request.method === 'GET') {
      const auth = await this.authenticatedAccount(request);
      if (!auth) return this.json({ok:false,error:'unauthorized'},401);
      const rows = await this.state.storage.sql.exec(
        'SELECT id, kind, name, source_url, notes, status, created_at, updated_at, reviewed_at, reviewer, review_note FROM community_submissions WHERE username = ? ORDER BY created_at DESC LIMIT 100',
        auth.key
      ).toArray();
      return this.json({ok:true,submissions:rows});
    }
    if (request.method !== 'POST') return this.json({ok:false,error:'method-not-allowed'},405);
    let body; try { body=await request.json(); } catch { return this.json({ok:false,error:'invalid-json'},400); }
    const auth = await this.authenticatedAccount(request, body);
    if (!auth) return this.json({ok:false,error:'unauthorized'},401);
    const kind = body.kind === 'app' ? 'app' : body.kind === 'game' ? 'game' : '';
    const name = typeof body.name === 'string' ? body.name.trim().slice(0,80) : '';
    const sourceUrl = typeof body.source_url === 'string' ? body.source_url.trim().slice(0,500) : '';
    const notes = typeof body.notes === 'string' ? body.notes.trim().slice(0,1200) : '';
    if (!kind || !name || !sourceUrl) return this.json({ok:false,error:'missing-fields'},400);
    let parsed;
    try { parsed = new URL(sourceUrl); } catch (_) { return this.json({ok:false,error:'invalid-source-url'},400); }
    if (!['http:','https:'].includes(parsed.protocol) || parsed.username || parsed.password) return this.json({ok:false,error:'invalid-source-url'},400);
    const duplicateKey = (parsed.origin + parsed.pathname + parsed.search).slice(0,600);
    const now = Date.now();
    const recent = await this.state.storage.sql.exec(
      "SELECT COUNT(*) AS count FROM community_submissions WHERE username = ? AND created_at > ?", auth.key, now - 86400000
    ).toArray()[0];
    if (Number(recent?.count || 0) >= 8) return this.json({ok:false,error:'submission-rate-limit'},429);
    const duplicate = await this.state.storage.sql.exec(
      "SELECT id, status FROM community_submissions WHERE url_key = ? AND status IN ('pending','approved') LIMIT 1", duplicateKey
    ).toArray()[0];
    if (duplicate) return this.json({ok:false,error:'duplicate-source',status:duplicate.status},409);
    const id = crypto.randomUUID();
    await this.state.storage.sql.exec(
      'INSERT INTO community_submissions (id, username, kind, name, source_url, url_key, notes, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      id, auth.key, kind, name, parsed.href, duplicateKey, notes, 'pending', now, now
    );
    return this.json({ok:true,submission:{id,kind,name,source_url:parsed.href,notes,status:'pending',created_at:now}},201);
  }

  async communityReviews(request) {
    const url = new URL(request.url);
    if (request.method === 'GET') {
      const gameName = String(url.searchParams.get('game') || '').trim().slice(0,100);
      const gameKey = gameName.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,100);
      if (url.searchParams.get('mine') === '1') {
        const auth = await this.authenticatedAccount(request);
        if (!auth) return this.json({ok:false,error:'unauthorized'},401);
        const mine = await this.state.storage.sql.exec(
          'SELECT game_key, game_name, rating, result, text, status, created_at, updated_at, reviewed_at, review_note FROM community_reviews WHERE username = ? ORDER BY updated_at DESC LIMIT 100',
          auth.key
        ).toArray();
        return this.json({ok:true,reviews:mine});
      }
      if (!gameKey) return this.json({ok:false,error:'game-required'},400);
      const rows = await this.state.storage.sql.exec(
        "SELECT username, game_name, rating, result, text, created_at FROM community_reviews WHERE game_key = ? AND status = 'approved' ORDER BY created_at DESC LIMIT 50",
        gameKey
      ).toArray();
      const average = rows.length ? rows.reduce((sum,row)=>sum+Number(row.rating||0),0)/rows.length : null;
      const publicReviews = rows.map(row=>({...row,username:String(row.username||'Player').slice(0,1)+'***'}));
      return this.json({ok:true,game:gameName,count:rows.length,average_rating:average,reviews:publicReviews});
    }
    if (request.method !== 'POST') return this.json({ok:false,error:'method-not-allowed'},405);
    let body; try { body=await request.json(); } catch { return this.json({ok:false,error:'invalid-json'},400); }
    const auth = await this.authenticatedAccount(request, body);
    if (!auth) return this.json({ok:false,error:'unauthorized'},401);
    const gameName = typeof body.game === 'string' ? body.game.trim().slice(0,100) : '';
    const gameKey = gameName.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,100);
    const rating = Number(body.rating);
    const result = ['worked','partial','broken'].includes(body.result) ? body.result : '';
    const reviewText = typeof body.text === 'string' ? body.text.trim().slice(0,1000) : '';
    if (!gameName || !gameKey || !Number.isInteger(rating) || rating < 1 || rating > 5 || !result) {
      return this.json({ok:false,error:'invalid-review'},400);
    }
    const now = Date.now();
    const recent = await this.state.storage.sql.exec(
      'SELECT COUNT(*) AS count FROM community_reviews WHERE username = ? AND created_at > ?', auth.key, now - 86400000
    ).toArray()[0];
    const existing = await this.state.storage.sql.exec(
      'SELECT created_at FROM community_reviews WHERE game_key = ? AND username = ?', gameKey, auth.key
    ).toArray()[0];
    if (!existing && Number(recent?.count || 0) >= 30) return this.json({ok:false,error:'review-rate-limit'},429);
    await this.state.storage.sql.exec(
      "INSERT INTO community_reviews (game_key, username, game_name, rating, result, text, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?) ON CONFLICT(game_key, username) DO UPDATE SET game_name=excluded.game_name,rating=excluded.rating,result=excluded.result,text=excluded.text,status='pending',updated_at=excluded.updated_at,reviewed_at=NULL,reviewer='',review_note=''",
      gameKey, auth.key, gameName, rating, result, reviewText, now, now
    );
    return this.json({ok:true,status:'pending',message:'Report submitted for review before it appears publicly.'},201);
  }

  async sourceLockfiles(request) {
    if (request.method === 'GET') {
      const auth = await this.authenticatedAccount(request);
      if (!auth) return this.json({ok:false,error:'unauthorized'},401);
      const url = new URL(request.url);
      const id = String(url.searchParams.get('id') || '').trim();
      if (id) {
        const row = await this.state.storage.sql.exec(
          'SELECT id, username, label, status, value, parent_id, created_at, reviewed_at, reviewer, review_note FROM source_lockfiles WHERE id = ? AND username = ?', id, auth.key
        ).toArray()[0];
        if (!row) return this.json({ok:false,error:'not-found'},404);
        let lockfile={}; try { lockfile=JSON.parse(row.value)||{}; } catch (_) {}
        return this.json({ok:true,record:{...row,value:undefined,lockfile}});
      }
      const rows = await this.state.storage.sql.exec(
        'SELECT id, label, status, parent_id, created_at, reviewed_at, reviewer, review_note FROM source_lockfiles WHERE username = ? ORDER BY created_at DESC LIMIT 5',
        auth.key
      ).toArray();
      return this.json({ok:true,lockfiles:rows});
    }
    if (request.method !== 'POST') return this.json({ok:false,error:'method-not-allowed'},405);
    let body; try { body=await request.json(); } catch { return this.json({ok:false,error:'invalid-json'},400); }
    const auth = await this.authenticatedAccount(request, body);
    if (!auth) return this.json({ok:false,error:'unauthorized'},401);
    const now=Date.now();
    if (body.action === 'rollback') {
      const id=String(body.id||'').trim();
      const parent=await this.state.storage.sql.exec(
        'SELECT id, label, value FROM source_lockfiles WHERE id = ? AND username = ?', id, auth.key
      ).toArray()[0];
      if (!parent) return this.json({ok:false,error:'not-found'},404);
      const newId=crypto.randomUUID();
      const label=('Restore draft: '+String(parent.label||'source snapshot')).slice(0,100);
      await this.state.storage.sql.exec(
        "INSERT INTO source_lockfiles (id, username, label, status, value, parent_id, created_at) VALUES (?, ?, ?, 'pending', ?, ?, ?)",
        newId, auth.key, label, parent.value, parent.id, now
      );
      return this.json({ok:true,id:newId,status:'pending',message:'A rollback proposal was created. It does not change the live catalog; deployment still requires an approved source update.'},201);
    }
    const input=body.lockfile;
    if (!input || !Array.isArray(input.games) || input.games.length < 1 || input.games.length > 3000) {
      return this.json({ok:false,error:'invalid-lockfile'},400);
    }
    const safeGames=input.games.map(game=>({
      name:String(game?.name||'').slice(0,100),
      path:String(game?.path||'').slice(0,1000),
      source:String(game?.source||'').slice(0,40),
      revision:String(game?.revision||'').slice(0,100),
      source_path:String(game?.source_path||'').slice(0,500),
      mutableExternal:!!game?.mutableExternal
    })).filter(game=>game.name && game.path);
    if (!safeGames.length) return this.json({ok:false,error:'empty-lockfile'},400);
    const value=JSON.stringify({schemaVersion:1,generatedAt:String(input.generatedAt||new Date(now).toISOString()),games:safeGames});
    if (new TextEncoder().encode(value).length > 900000) return this.json({ok:false,error:'lockfile-too-large'},413);
    const label=String(body.label||('Source audit '+new Date(now).toISOString().slice(0,10))).trim().slice(0,100)||'Source audit';
    const parentId=String(body.parent_id||'').trim()||null;
    if (parentId) {
      const parent=await this.state.storage.sql.exec(
        'SELECT id FROM source_lockfiles WHERE id = ? AND username = ?', parentId, auth.key
      ).toArray()[0];
      if (!parent) return this.json({ok:false,error:'invalid-parent'},400);
    }
    const id=crypto.randomUUID();
    await this.state.storage.sql.exec(
      "INSERT INTO source_lockfiles (id, username, label, status, value, parent_id, created_at) VALUES (?, ?, ?, 'pending', ?, ?, ?)",
      id, auth.key, label, value, parentId, now
    );
    const oldRows=await this.state.storage.sql.exec(
      'SELECT id FROM source_lockfiles WHERE username = ? ORDER BY created_at DESC LIMIT 100 OFFSET 5', auth.key
    ).toArray();
    for (const row of oldRows) await this.state.storage.sql.exec('DELETE FROM source_lockfiles WHERE id = ? AND username = ?',row.id,auth.key);
    return this.json({ok:true,id,status:'pending',games:safeGames.length,mutableSources:safeGames.filter(game=>game.mutableExternal).length,message:'Source snapshot saved for administrator review. It is not deployed automatically.'},201);
  }

  async accountDataExport(request) {
    const auth=await this.authenticatedAccount(request);
    if(!auth)return this.json({ok:false,error:'unauthorized'},401);
    const profileRow=await this.state.storage.sql.exec('SELECT value, updated_at FROM profiles WHERE username = ?',auth.key).toArray()[0];
    const activity=await this.state.storage.sql.exec('SELECT game_name, opens, last_opened FROM activity WHERE username = ? ORDER BY last_opened DESC LIMIT 500',auth.key).toArray();
    const submissions=await this.state.storage.sql.exec('SELECT id, kind, name, source_url, notes, status, created_at, updated_at, reviewed_at, review_note FROM community_submissions WHERE username = ? ORDER BY created_at DESC LIMIT 100',auth.key).toArray();
    const reviews=await this.state.storage.sql.exec('SELECT game_name, rating, result, text, status, created_at, updated_at, reviewed_at, review_note FROM community_reviews WHERE username = ? ORDER BY updated_at DESC LIMIT 200',auth.key).toArray();
    const locks=await this.state.storage.sql.exec('SELECT id, label, status, parent_id, created_at, reviewed_at, review_note, value FROM source_lockfiles WHERE username = ? ORDER BY created_at DESC LIMIT 5',auth.key).toArray();
    let profile={};try{profile=JSON.parse(profileRow?.value||'{}')||{}}catch(_){}
    const scrub=value=>{
      if(Array.isArray(value))return value.map(scrub);
      if(value&&typeof value==='object'){
        const clean={};
        for(const [key,item] of Object.entries(value)){
          if(/(?:account.?token|password|secret|authorization|session.?token)/i.test(key))continue;
          clean[key]=scrub(item);
        }
        return clean;
      }
      return value;
    };
    return this.json({ok:true,exported_at:new Date().toISOString(),account:{username:auth.account.username,created_at:auth.account.created_at},profile:scrub(profile),profile_updated_at:profileRow?.updated_at||null,activity,submissions,reviews,source_lockfiles:locks.map(row=>({...row,lockfile:(()=>{try{return JSON.parse(row.value)}catch(_){return {}}})(),value:undefined}))});
  }

  async revokeAccountSessions(request) {
    let body;try{body=await request.json()}catch{return this.json({ok:false,error:'invalid-json'},400)}
    const auth=await this.authenticatedAccount(request,body);
    if(!auth)return this.json({ok:false,error:'unauthorized'},401);
    const token=crypto.randomUUID();
    await this.state.storage.sql.exec('UPDATE accounts SET account_token = ? WHERE username = ?',token,auth.key);
    return this.json({ok:true,username:auth.account.username,account_token:token,message:'All other devices were signed out. Update this device with the new token.'});
  }

  async deleteAccount(request) {
    let body;try{body=await request.json()}catch{return this.json({ok:false,error:'invalid-json'},400)}
    const auth=await this.authenticatedAccount(request,body);
    if(!auth)return this.json({ok:false,error:'unauthorized'},401);
    if(String(body.confirm_username||'').trim().toLowerCase()!==auth.key)return this.json({ok:false,error:'confirmation-mismatch'},400);
    if(auth.account.password_hash) {
      const password=typeof body.password==='string'?body.password:'';
      if(!password||!auth.account.password_salt||await this.passwordHash(password,auth.account.password_salt)!==auth.account.password_hash) {
        return this.json({ok:false,error:'invalid-credentials'},401);
      }
    }
    for(const table of ['activity','profiles','community_submissions','community_reviews','source_lockfiles']) {
      await this.state.storage.sql.exec('DELETE FROM '+table+' WHERE username = ?',auth.key);
    }
    await this.state.storage.sql.exec('DELETE FROM accounts WHERE username = ?',auth.key);
    await this.state.storage.sql.exec('DELETE FROM usernames WHERE username = ?',auth.key);
    return this.json({ok:true,deleted:true,message:'Account and stored Cosmic Cloud records were deleted.'});
  }

  async adminCommunity(request) {
    if(request.method==='GET') {
      const submissions=await this.state.storage.sql.exec(
        "SELECT id, username, kind, name, source_url, notes, status, created_at FROM community_submissions WHERE status='pending' ORDER BY created_at ASC LIMIT 100"
      ).toArray();
      const reviews=await this.state.storage.sql.exec(
        "SELECT game_key, username, game_name, rating, result, text, status, created_at FROM community_reviews WHERE status='pending' ORDER BY created_at ASC LIMIT 100"
      ).toArray();
      const lockfiles=await this.state.storage.sql.exec(
        "SELECT id, username, label, status, parent_id, created_at FROM source_lockfiles WHERE status='pending' ORDER BY created_at ASC LIMIT 50"
      ).toArray();
      return this.json({ok:true,submissions,reviews,source_lockfiles:lockfiles});
    }
    if(request.method!=='POST')return this.json({ok:false,error:'method-not-allowed'},405);
    let body;try{body=await request.json()}catch{return this.json({ok:false,error:'invalid-json'},400)}
    const type=String(body.type||'');
    const status=body.status==='approved'?'approved':body.status==='rejected'?'rejected':'';
    const id=String(body.id||'').trim();
    const note=typeof body.note==='string'?body.note.trim().slice(0,500):'';
    if(!status||!id)return this.json({ok:false,error:'missing-fields'},400);
    const now=Date.now(),reviewer='TheDevilAngel';
    let result;
    if(type==='submission') result=await this.state.storage.sql.exec(
      'UPDATE community_submissions SET status=?, updated_at=?, reviewed_at=?, reviewer=?, review_note=? WHERE id=?',status,now,now,reviewer,note,id
    );
    else if(type==='review') {
      const gameKey=String(body.game_key||'').trim().slice(0,100);
      const username=String(body.username||'').trim().toLowerCase();
      if(!gameKey||!username)return this.json({ok:false,error:'missing-review-key'},400);
      result=await this.state.storage.sql.exec(
        'UPDATE community_reviews SET status=?, updated_at=?, reviewed_at=?, reviewer=?, review_note=? WHERE game_key=? AND username=?',status,now,now,reviewer,note,gameKey,username
      );
    } else if(type==='source_lockfile') result=await this.state.storage.sql.exec(
      'UPDATE source_lockfiles SET status=?, reviewed_at=?, reviewer=?, review_note=? WHERE id=?',status,now,reviewer,note,id
    );
    else return this.json({ok:false,error:'invalid-type'},400);
    return this.json({ok:true,status,reviewed:result?.rowsWritten??null});
  }

  async eventWrite(request) {
    let body;try{body=await request.json()}catch{return this.json({ok:false,error:'invalid-json'},400)}
    const event=body?.event&&typeof body.event==='object'?body.event:null;if(!event)return this.json({ok:false,error:'missing-event'},400);
    await this.state.storage.sql.exec('INSERT INTO site_state (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value','cosmic_events',JSON.stringify({...event,updated_at:Date.now()}));
    return this.json({ok:true,event});
  }
  async eventState(request) {
    const row=await this.state.storage.sql.exec('SELECT value FROM site_state WHERE key = ?', 'cosmic_events').toArray()[0];
    return this.json({ok:true,event:row?.value?JSON.parse(row.value):null});
  }
  async room(request) {
    const url=new URL(request.url);
    const code=url.pathname.split('/').filter(Boolean).pop().toUpperCase();
    if(!/^[A-Z0-9]{4,8}$/.test(code))return this.json({ok:false,error:'invalid-code'},400);
    const key='room:'+code;
    const readRoom=async()=>{const row=await this.state.storage.sql.exec('SELECT value FROM site_state WHERE key = ?',key).toArray()[0];if(!row?.value)return null;try{return JSON.parse(row.value)||null}catch(_){return null}};
    const writeRoom=async(room)=>{await this.state.storage.sql.exec('INSERT INTO site_state (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',key,JSON.stringify(room));return room};
    if(request.method==='GET'){const room=await readRoom();return this.json({ok:true,room})}
    let body;try{body=await request.json()}catch{return this.json({ok:false,error:'invalid-json'},400)}
    const action=body?.action||'get';
    const incoming=body?.player&&typeof body.player==='object'?body.player:null;
    if(action==='create'){
      if(await readRoom())return this.json({ok:false,error:'room-exists'},409);
      if(!incoming?.id)return this.json({ok:false,error:'missing-player'},400);
      const now=Date.now();
      const room={code,name:String(body?.name||'Cosmic Room').trim().slice(0,80)||'Cosmic Room',host:String(incoming.id),queue:[],watch_queue:[],status:'open',players:[{id:String(incoming.id),name:String(incoming.name||'Guest').trim().slice(0,32)||'Guest',joined_at:now}],created_at:now,updated_at:now};
      await writeRoom(room);return this.json({ok:true,room});
    }
    const room=await readRoom();if(!room)return this.json({ok:false,error:'room-not-found'},404);
    if(action==='join'){
      if(!incoming?.id)return this.json({ok:false,error:'missing-player'},400);
      const players=Array.isArray(room.players)?room.players:[];if(!players.some(p=>String(p.id)===String(incoming.id)))players.push({id:String(incoming.id),name:String(incoming.name||'Guest').trim().slice(0,32)||'Guest',joined_at:Date.now()});
      room.players=players;room.updated_at=Date.now();await writeRoom(room);return this.json({ok:true,room});
    }
    if(action==='leave'){
      if(!incoming?.id)return this.json({ok:false,error:'missing-player'},400);
      room.players=(Array.isArray(room.players)?room.players:[]).filter(p=>String(p.id)!==String(incoming.id));
      if(String(room.host)===String(incoming.id))room.host=room.players[0]?.id||null;
      room.updated_at=Date.now();
      if(!room.players.length){await this.state.storage.sql.exec('DELETE FROM site_state WHERE key = ?',key);return this.json({ok:true,left:true,room:null})}
      await writeRoom(room);return this.json({ok:true,left:true,room});
    }
    if(action==='update'){
      if(!incoming?.id||String(room.host)!==String(incoming.id))return this.json({ok:false,error:'host-required'},403);
      if(body?.room&&typeof body.room==='object'){room.queue=Array.isArray(body.room.queue)?body.room.queue:room.queue;room.watch_queue=Array.isArray(body.room.watch_queue)?body.room.watch_queue:room.watch_queue;room.status=String(body.room.status||room.status);room.updated_at=Date.now();await writeRoom(room)}
      return this.json({ok:true,room});
    }
    return this.json({ok:false,error:'unknown-action'},400);
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
    ).toArray()[0];
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
    ).toArray()[0];
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

  async sharedStateRead() {
    const key='cosmicGlobalStateV2';
    try{
      const stored=await this.state.storage.get(key);
      if(stored && typeof stored==='object') {
        const global=stored.global&&typeof stored.global==='object'?{...stored.global}:{};
        const migratedVersion=Number(stored.version||0);
        if(migratedVersion<4){
          delete global.global_notice;
          delete global.site_banner;
          delete global.global_message;
          delete global.broadcast;
          delete global.global_reload;
          delete global.global_refresh;
          delete global.sync_signal;
        }
        if(global.global_reload && Number(global.global_reload)<Date.now()-30000) delete global.global_reload;
        if(global.global_refresh && Number(global.global_refresh)<Date.now()-30000) delete global.global_refresh;
        if(global.sync_signal && Number(global.sync_signal)<Date.now()-30000) delete global.sync_signal;
        const normalized={
          version:4,
          blacklisted:Array.isArray(stored.blacklisted)?stored.blacklisted:[],
          featured:Array.isArray(stored.featured)?stored.featured:[],
          maintenance:!!stored.maintenance,
          imported:Array.isArray(stored.imported)?stored.imported:[],
          announcement:stored.announcement||null,
          maintenance_message:typeof stored.maintenance_message==='string'?stored.maintenance_message:'',
          global
        };
        if(migratedVersion<3 || global.global_reload===undefined || global.global_refresh===undefined || global.sync_signal===undefined) try{await this.state.storage.put(key,normalized)}catch(_){}
        return normalized;
      }
    }catch(_){}
    const defaults={version:4,blacklisted:[],featured:[],maintenance:false,imported:[],announcement:null,maintenance_message:'',global:{}};
    try{
      const rows=await this.state.storage.sql.exec('SELECT key, value FROM site_state').toArray();
      const raw=Object.fromEntries(rows.map(row=>[row.key,row.value]));
      const parse=(k,f)=>{try{return raw[k]?JSON.parse(raw[k]):f}catch(_){return f}};
      const migrated={
        version:4,
        blacklisted:parse('blacklisted',[]),
        featured:parse('featured',[]),
        maintenance:!!parse('maintenance',false),
        imported:parse('imported',[]),
        announcement:parse('announcement',null),
        maintenance_message:parse('maintenance_message',''),
        global:parse('global_state',{})
      };
      delete migrated.global.global_notice;
      delete migrated.global.site_banner;
      delete migrated.global.global_message;
      delete migrated.global.broadcast;
      delete migrated.global.global_reload;
      delete migrated.global.global_refresh;
      delete migrated.global.sync_signal;
      try{await this.state.storage.put(key,migrated);}catch(_){}
      return migrated;
    }catch(_){
      try{await this.state.storage.put(key,defaults);}catch(__){}
      return defaults;
    }
  }

  async sharedStateWrite(state) {
    const normalized={
      version:4,
      blacklisted:Array.isArray(state.blacklisted)?state.blacklisted:[],
      featured:Array.isArray(state.featured)?state.featured:[],
      maintenance:!!state.maintenance,
      imported:Array.isArray(state.imported)?state.imported:[],
      announcement:state.announcement||null,
      maintenance_message:typeof state.maintenance_message==='string'?state.maintenance_message:'',
      global:state.global&&typeof state.global==='object'?state.global:{}
    };
    await this.state.storage.put('cosmicGlobalStateV2',normalized);
    return normalized;
  }

  async siteState() {
    const state=await this.sharedStateRead();
    return this.json({ok:true,...state});
  }

  async adminSharedState(request) {
    let body;
    try { body=await request.json(); } catch { return this.json({ok:false,error:'invalid-json'},400); }
    const action=typeof body?.action==='string'?body.action:'';
    const state=await this.sharedStateRead();
    const global=state.global||{};
    const now=Date.now();

    if(action==='blacklist_toggle'){
      const target=typeof body?.target==='string'?body.target.trim().slice(0,500):'';
      if(!target)return this.json({ok:false,error:'missing-target'},400);
      const idx=state.blacklisted.findIndex(x=>String(x?.target||'').toLowerCase()===target.toLowerCase());
      if(idx>=0)state.blacklisted.splice(idx,1);
      else state.blacklisted.push({target,created_at:now});
    } else if(action==='unfeature'){
      const name=typeof body?.name==='string'?body.name.trim().slice(0,160):'';
      if(!name)return this.json({ok:false,error:'missing-name'},400);
      state.featured=state.featured.filter(x=>String(x?.name||'').toLowerCase()!==name.toLowerCase());
    } else if(action==='feature_toggle'){
      const name=typeof body?.name==='string'?body.name.trim().slice(0,160):'';
      if(!name)return this.json({ok:false,error:'missing-name'},400);
      const idx=state.featured.findIndex(x=>String(x?.name||'').toLowerCase()===name.toLowerCase());
      if(idx>=0)state.featured.splice(idx,1);
      else state.featured.push({name,created_at:now});
    } else if(action==='announcement_set'){
      const text=typeof body?.text==='string'?body.text.trim().slice(0,1000):'';
      if(!text)return this.json({ok:false,error:'missing-announcement'},400);
      state.announcement={text,created_at:now};
    } else if(action==='announcement_clear'){
      state.announcement=null;
    } else if(action==='maintenance_toggle'){
      state.maintenance=!state.maintenance;
      state.maintenance_message=state.maintenance&&typeof body?.message==='string'?body.message.trim().slice(0,500):'';
      global.mode={value:state.maintenance?'maintenance':'normal',created_at:now};
    } else if(action==='import'){
      const incoming=Array.isArray(body?.items)?body.items:[];
      if(!incoming.length)return this.json({ok:false,error:'no-items'},400);
      const clean=incoming.slice(0,100).map(item=>{
        const name=typeof item?.name==='string'?item.name.trim().slice(0,160):'';
        const path=typeof item?.path==='string'?item.path.trim().slice(0,1000):'';
        const kind=item?.kind==='app'?'app':'game';
        if(!name||!path)return null;
        return {
          name,path,kind,
          ...(typeof item?.entry==='string'&&item.entry.trim()?{entry:item.entry.trim().slice(0,300)}:{}),
          ...(typeof item?.image==='string'&&item.image.trim()?{image:item.image.trim().slice(0,1000)}:{}),
          ...(typeof item?.description==='string'?{description:item.description.trim().slice(0,500)}:{}),
          ...(typeof item?.category==='string'?{category:item.category.trim().slice(0,60)}:{}),
          tags:Array.isArray(item?.tags)?item.tags.map(x=>String(x).slice(0,40)).slice(0,10):[]
        };
      }).filter(Boolean);
      if(!clean.length)return this.json({ok:false,error:'invalid-items'},400);
      const merged=[...state.imported];
      for(const item of clean){
        const key=(item.kind+':'+item.name).toLowerCase();
        const idx=merged.findIndex(x=>(x.kind+':'+x.name).toLowerCase()===key);
        if(idx>=0)merged[idx]=item;else merged.push(item);
      }
      state.imported=merged.slice(-250);
    } else if(action==='global_notice_set'||action==='site_banner_set'||action==='global_message_set'||action==='broadcast_set'){
      const text=typeof body?.text==='string'?body.text.trim().slice(0,1000):'';
      if(!text)return this.json({ok:false,error:'missing-text'},400);
      const key={global_notice_set:'global_notice',site_banner_set:'site_banner',global_message_set:'global_message',broadcast_set:'broadcast'}[action];
      global[key]={text,created_at:now};
    } else if(action==='global_notice_clear'||action==='site_banner_clear'||action==='global_message_clear'||action==='broadcast_clear'||action==='global_badge_clear'||action==='spotlight_clear'||action==='countdown_clear'){
      const key={global_notice_clear:'global_notice',site_banner_clear:'site_banner',global_message_clear:'global_message',broadcast_clear:'broadcast',global_badge_clear:'global_badge',spotlight_clear:'spotlight',countdown_clear:'countdown'}[action];
      delete global[key];
    } else if(action==='sitemode_set'){
      const mode=typeof body?.mode==='string'?body.mode.trim().toLowerCase():'';
      if(!['normal','maintenance'].includes(mode))return this.json({ok:false,error:'invalid-mode',allowed:['normal','maintenance']},400);
      state.maintenance=mode==='maintenance';
      state.maintenance_message=state.maintenance&&typeof body?.message==='string'?body.message.trim().slice(0,500):'';
      global.mode={value:mode,created_at:now};
    } else if(action==='global_theme_set'){
      const theme=typeof body?.theme==='string'?body.theme.trim().toLowerCase():'';
      if(!['nebula','deep-space','solar-flare','synthwave'].includes(theme))return this.json({ok:false,error:'invalid-theme'},400);
      global.theme={value:theme,created_at:now};
    } else if(action==='global_badge_set'){
      const text=typeof body?.text==='string'?body.text.trim().slice(0,120):'';
      if(!text)return this.json({ok:false,error:'missing-text'},400);
      global.global_badge={text,created_at:now};
    } else if(action==='spotlight_set'){
      const name=typeof body?.name==='string'?body.name.trim().slice(0,160):'';
      if(!name)return this.json({ok:false,error:'missing-name'},400);
      global.spotlight={name,created_at:now};
    } else if(action==='countdown_set'){
      const minutes=Number(body?.minutes);
      const target=Number(body?.target);
      const label=typeof body?.label==='string'?body.label.trim().slice(0,160):'Countdown';
      const end=Number.isFinite(target)&&target>now?target:(Number.isFinite(minutes)&&minutes>0?now+Math.min(minutes,7*24*60)*60000:0);
      if(!end)return this.json({ok:false,error:'invalid-countdown'},400);
      global.countdown={label,target:end,created_at:now};
    } else if(action==='event_set'){
      const name=typeof body?.name==='string'?body.name.trim().slice(0,160):'';
      if(!name)return this.json({ok:false,error:'missing-name'},400);
      global.event={name,message:typeof body?.message==='string'?body.message.trim().slice(0,500):'',target:Number(body?.target)>now?Number(body.target):null,created_at:now};
    } else if(action==='event_message'){
      if(!global.event)return this.json({ok:false,error:'no-event'},400);
      global.event.message=typeof body?.message==='string'?body.message.trim().slice(0,500):'';
      global.event.updated_at=now;
    } else if(action==='event_timer'){
      if(!global.event)return this.json({ok:false,error:'no-event'},400);
      const minutes=Number(body?.minutes),target=Number(body?.target);
      const end=Number.isFinite(target)&&target>now?target:(Number.isFinite(minutes)&&minutes>0?now+Math.min(minutes,7*24*60)*60000:0);
      if(!end)return this.json({ok:false,error:'invalid-timer'},400);
      global.event.target=end;global.event.updated_at=now;
    } else if(action==='gameannounce_set'){
      const game=typeof body?.game==='string'?body.game.trim().slice(0,160):'';
      const text=typeof body?.text==='string'?body.text.trim().slice(0,500):'';
      if(!game||!text)return this.json({ok:false,error:'missing-game-or-text'},400);
      const list=Array.isArray(global.game_announcements)?global.game_announcements:[];
      const idx=list.findIndex(x=>String(x?.game||'').toLowerCase()===game.toLowerCase());
      const entry={game,text,created_at:now};
      if(idx>=0)list[idx]=entry;else list.push(entry);
      global.game_announcements=list.slice(-100);
    } else if(action==='disabled_game_toggle'||action==='disabled_game_enable'){
      const name=typeof body?.name==='string'?body.name.trim().slice(0,160):'';
      if(!name)return this.json({ok:false,error:'missing-name'},400);
      const list=Array.isArray(global.disabled_games)?global.disabled_games:[];
      const idx=list.findIndex(x=>String(x).toLowerCase()===name.toLowerCase());
      if(action==='disabled_game_enable'){if(idx>=0)list.splice(idx,1);}else if(idx>=0)list.splice(idx,1);else list.push(name);
      global.disabled_games=list.slice(-250);
    } else if(action==='maintenance_set'){
      state.maintenance=body?.enabled!==false;
      state.maintenance_message=typeof body?.message==='string'?body.message.trim().slice(0,500):'';
      global.mode={value:state.maintenance?'maintenance':'normal',created_at:now};
    } else if(action==='event_end'){
      delete global.event;delete global.countdown;
    } else if(action==='featured_rotate'){
      if(state.featured.length>1)state.featured.push(state.featured.shift());
      global.spotlight=state.featured[0]?{name:String(state.featured[0].name||''),created_at:now}:null;
    } else if(action==='global_refresh'||action==='global_reload'||action==='sync_signal'){
      global[action==='global_refresh'?'global_refresh':action==='global_reload'?'global_reload':'sync_signal']=now;
    } else if(action==='clearall'){
      state.blacklisted=[];state.featured=[];state.maintenance=false;state.imported=[];state.announcement=null;state.maintenance_message='';state.global={};
    } else {
      return this.json({ok:false,error:'unknown-action'},400);
    }

    state.global=global;
    await this.sharedStateWrite(state);
    return this.siteState();
  }

  async adminSiteState(request) {
    let body;
    try { body = await request.json(); } catch { return this.json({ ok: false, error: 'invalid-json' }, 400); }
    const action = typeof body?.action === 'string' ? body.action : '';
    const read = async (key, fallback) => {
      const row = await this.state.storage.sql.exec(
        'SELECT value FROM site_state WHERE key = ?', key
      ).toArray()[0];
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
      const password = typeof body?.password === 'string' ? body.password : '';
      if (!/^[A-Za-z0-9_]{3,24}$/.test(username)) return this.json({ ok: false, error: 'invalid-username' }, 400);
      if (password && password.length < 6) return this.json({ ok: false, error: 'weak-password' }, 400);
      return this.reserve(username, password);
    }
    if (url.pathname === '/login' && request.method === 'POST') return this.accountLogin(request);
    if (url.pathname === '/password' && request.method === 'POST') return this.accountPassword(request);
    if (url.pathname === '/community/submissions' && ['GET','POST'].includes(request.method)) return this.communitySubmissions(request);
    if (url.pathname === '/community/reviews' && ['GET','POST'].includes(request.method)) return this.communityReviews(request);
    if (url.pathname === '/source-lockfiles' && ['GET','POST'].includes(request.method)) return this.sourceLockfiles(request);
    if (url.pathname === '/account-data' && request.method === 'GET') return this.accountDataExport(request);
    if (url.pathname === '/revoke-sessions' && request.method === 'POST') return this.revokeAccountSessions(request);
    if (url.pathname === '/delete-account' && request.method === 'POST') return this.deleteAccount(request);
    if (url.pathname === '/admin/community' && ['GET','POST'].includes(request.method)) return this.adminCommunity(request);
    if (url.pathname === '/profile' && request.method === 'GET') return this.cloudProfile(request);
    if (url.pathname === '/profile' && request.method === 'POST') return this.cloudProfileWrite(request);
    if (url.pathname === '/events' && request.method === 'GET') return this.eventState(request);
    if (url.pathname === '/events' && request.method === 'POST') return this.eventWrite(request);
    if (url.pathname.startsWith('/rooms/') && (request.method === 'GET' || request.method === 'POST')) return this.room(request);
    if (url.pathname === '/activity' && request.method === 'POST') return this.activity(request);
    if (url.pathname === '/list' && request.method === 'GET') return this.adminList();
    if (url.pathname === '/detail' && request.method === 'GET') return this.adminDetail(url.searchParams.get('username') || '');
    if (url.pathname === '/analytics' && request.method === 'GET') return this.analytics();
    if (url.pathname === '/state' && request.method === 'GET') return this.siteState();
    if (url.pathname === '/admin-site-state' && request.method === 'POST') return this.adminSharedState(request);
    return this.json({ ok: false, error: 'not-found' }, 404);
  }
}

const COSMIC_DEPLOYMENT_COMMIT = '__COSMIC_DEPLOYMENT_COMMIT__';
const COSMIC_DEPLOYMENT_TIMESTAMP = '__COSMIC_DEPLOYMENT_TIMESTAMP__';

// Temporarily force the public site to normal mode while maintenance is disabled.
// Flip this back to false when Maintenance Mode should be honored again.
const COSMIC_MAINTENANCE_FORCE_OFF = true;

const COSMIC_DEVELOPER_USERNAME = 'TheDevilAngel';

const ALLOWED_ORIGINS = new Set([
  'https://ultimate-guy.github.io',
  'https://cosmicv2.v75ultimate.workers.dev'
]);

function corsHeaders(request) {
  const origin = request.headers.get('Origin');
  const h = new Headers({
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Cosmic-Username',
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

async function createAdminSession(secret, username) {
  const payload = { role: 'developer', username: String(username || ''), exp: Date.now() + 60 * 60 * 1000 };
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
    if (payload.role !== 'developer' || payload.username !== COSMIC_DEVELOPER_USERNAME || Number(payload.exp) < Date.now()) return false;
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
  const username = typeof data?.username === 'string' ? data.username : '';
  const expected = env.COSMIC_ADMIN_PASSWORD;
  if (typeof expected !== 'string' || !expected) return jsonResponse(request, { ok: false, error: 'server-not-configured' }, 500);
  if (username !== COSMIC_DEVELOPER_USERNAME) return jsonResponse(request, { ok: false, error: 'developer-account-required' }, 403);
  if (password !== expected) return jsonResponse(request, { ok: false, error: 'invalid-password' }, 401);
  const token = await createAdminSession(expected, username);
  const response = jsonResponse(request, { ok: true, token });
  response.headers.append('Set-Cookie', 'cosmic_admin_session=' + encodeURIComponent(token) + '; Path=/; Max-Age=3600; Secure; HttpOnly; SameSite=None');
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
    return COSMIC_MAINTENANCE_FORCE_OFF ? false : !!data.maintenance;
  } catch (_) {
    return false;
  }
}

async function forwardRegistryPath(request, env, path) {
  const url = new URL(request.url);
  const target = new URL(path, request.url);
  target.search = url.search;
  const id = env.USERNAME_REGISTRY.idFromName('global');
  const response = await env.USERNAME_REGISTRY.get(id).fetch(new Request(target, request));
  return forwardJsonResponse(request, response);
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


const GFILES_REPOS = {
  gfiles: 'Ultimate-Guy/gfiles',
  gfiles2: 'Ultimate-Guy/gfiles2',
  gfiles3: 'Ultimate-Guy/gfiles3',
  gfiles4: 'Ultimate-Guy/gfiles4',
  gfiles5: 'Ultimate-Guy/gfiles5'
};

function rewriteGfilesHtml(html, source, folder) {
  const rootPrefix = '/gfiles/' + encodeURIComponent(source) + '/' + encodeURIComponent(folder) + '/';
  return html.replace(/(["'(])\/(?!\/)/g, '$1' + rootPrefix);
}

function ugsError(message, status = 400) {
  return new Response(message, {status, headers:{'Content-Type':'text/plain; charset=UTF-8','Cache-Control':'no-store'}});
}

function decodeSafeUgsPath(encodedPath, allowedRoot) {
  let parts;
  try { parts = encodedPath.split('/').map(part => decodeURIComponent(part)); }
  catch (_) { return null; }
  if (!parts.length || parts.some(part => !part || part === '.' || part === '..' || part.includes('/') || part.includes('\\'))) return null;
  if (allowedRoot && parts[0] !== allowedRoot) return null;
  return parts;
}

function rewriteUgsTextAsset(text, origin) {
  return text
    .replace(/(?:https?:)?\/\/(?:cdn|fastly|gcore)\.jsdelivr\.net\//gi, origin + '/ugs-cdn/')
    .replace(/https?:\/\/raw\.githubusercontent\.com\/Ultimate-Guy\/cosmicgames\/main\//gi, origin + '/ugs-repo/');
}

function encodeUgsPathPart(value) {
  // jsDelivr needs literal @ in GitHub branch and npm scope/version paths.
  return encodeURIComponent(value).replace(/%40/gi, '@');
}

async function proxyUgsAsset(request, prefix, upstreamBase, allowedRoot) {
  const url = new URL(request.url);
  if (!url.pathname.startsWith(prefix)) return null;
  const parts = decodeSafeUgsPath(url.pathname.slice(prefix.length), allowedRoot);
  if (!parts) return ugsError('Invalid UGS asset path.');
  const upstreamUrl = new URL(upstreamBase + parts.map(encodeUgsPathPart).join('/'));
  upstreamUrl.search = url.search;
  const upstream = await fetch(upstreamUrl.href, {
    headers: {'User-Agent':'Cosmic-UGS-Asset-Proxy/1.0','Accept':'*/*'},
    cf: {cacheTtl:3600, cacheEverything:true}
  });
  const headers = new Headers(upstream.headers);
  headers.set('Cache-Control', upstream.ok ? 'public, max-age=3600, s-maxage=86400' : 'no-store');
  headers.delete('Set-Cookie');
  headers.delete('X-Frame-Options');
  headers.delete('Content-Security-Policy');
  headers.delete('Content-Security-Policy-Report-Only');

  const contentType = headers.get('Content-Type') || '';
  if (upstream.ok && /(?:text\/|javascript|ecmascript|json|xml)/i.test(contentType)) {
    const body = rewriteUgsTextAsset(await upstream.text(), url.origin);
    headers.delete('Content-Length');
    headers.delete('Content-Encoding');
    headers.delete('ETag');
    headers.delete('Content-MD5');
    return new Response(body, {status:upstream.status,statusText:upstream.statusText,headers});
  }
  return new Response(upstream.body, {status:upstream.status,statusText:upstream.statusText,headers});
}

async function serveUgsCdn(request) {
  return proxyUgsAsset(request, '/ugs-cdn/', 'https://cdn.jsdelivr.net/', null);
}

async function serveUgsRepoAsset(request) {
  return proxyUgsAsset(request, '/ugs-repo/', 'https://raw.githubusercontent.com/Ultimate-Guy/cosmicgames/main/', 'UGS-Files');
}

async function serveUgs(request) {
  const url = new URL(request.url);
  const match = url.pathname.match(/^\/ugs\/(.+)$/);
  if (!match) return null;
  const parts = decodeSafeUgsPath(match[1]);
  if (!parts || parts.length !== 1) return ugsError('Invalid UGS path.');
  const upstreamUrl = new URL('https://raw.githubusercontent.com/Ultimate-Guy/cosmicgames/main/UGS-Files/' + encodeURIComponent(parts[0]));
  upstreamUrl.search = url.search;
  const upstream = await fetch(upstreamUrl.href, {
    headers: {'User-Agent':'Cosmic-UGS-Runtime','Accept':'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8'},
    cf: {cacheTtl:3600,cacheEverything:true}
  });
  if (!upstream.ok) return ugsError('UGS game source not found.', upstream.status);

  const headers = new Headers(upstream.headers);
  headers.set('Cache-Control','public, max-age=3600, s-maxage=86400');
  headers.set('Content-Type','text/html; charset=UTF-8');
  headers.delete('Set-Cookie');
  headers.delete('X-Frame-Options');
  headers.delete('Content-Security-Policy');
  headers.delete('Content-Security-Policy-Report-Only');

  let html = await upstream.text();

  // Thief Puzzle's upstream file is malformed: it starts with head content,
  // loads its interface before a real body exists, and ends with an empty
  // <body>. Normalize only this known file on the Worker response.
  if (parts[0].toLowerCase() === 'thiefpuzzle.html') {
    html = '<!doctype html><html lang="en"><head>' + html;
    html = html.replace(
      /<script\s+src=["']gameSnacks-game-interface\.js["'][^>]*>/i,
      tag => '</head><body>' + tag
    );
    html = html.replace(
      /alert\(["']The Menu\/Back Buttons Do Not Work and The Game Does Not Save as of now - Greeni["']\);/i,
      () => "console.info('Thief Puzzle upstream note: menu/back and save may be unavailable.');"
    );
    html = html.replace(/<body>\s*$/i, '');
    html += '</body></html>';
  }

  // Some UGS catalog entries are Google Gadget XML modules containing the
  // actual HTML inside CDATA (or nested inside a <Module> wrapper). Serving
  // the wrapper as text/html produces a blank iframe instead of the game.
  if (/^\s*<Module\b/i.test(html)) {
    const cdata = html.match(/<!\[CDATA\[([\s\S]*?)\]\]>/i);
    if (cdata) {
      html = cdata[1];
    } else {
      const htmlStart = html.search(/<!doctype\s+html|<html\b/i);
      const htmlEnd = html.toLowerCase().lastIndexOf('</html>');
      if (htmlStart >= 0 && htmlEnd > htmlStart) {
        html = html.slice(htmlStart, htmlEnd + 7);
      }
    }
  }

  // Keep the original upstream base URL. Rewriting all nested CDN assets
  // through the Worker changed package paths and broke games that worked
  // when loaded directly from jsDelivr.
  if (!/<base\b/i.test(html) && /<head\b/i.test(html)) {
    const base = '<base href="https://raw.githubusercontent.com/Ultimate-Guy/cosmicgames/main/UGS-Files/">';
    html = html.replace(/<head\b[^>]*>/i, match => match + base);
  }

  // Route UGS HTML dependencies through the same Worker so CDN fetch failures
  // do not leave the iframe blank. This rewrites only upstream asset URLs;
  // each asset proxy still fetches the original upstream resource.
  html = rewriteUgsTextAsset(html, url.origin);
  return new Response(html, {status:upstream.status,headers});
}


async function serveGfiles(request, env) {
  const url = new URL(request.url);
  const match = url.pathname.match(/^\/gfiles\/(gfiles|gfiles2|gfiles3|gfiles4|gfiles5)\/(.+)$/);
  if (!match) return null;

  const source = match[1];
  const repo = GFILES_REPOS[source];
  const token = typeof env.GFILES_READ_TOKEN === 'string' ? env.GFILES_READ_TOKEN.trim() : '';
  if (!repo || !token) {
    return new Response('Cosmic gfiles runtime is not configured.', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=UTF-8', 'Cache-Control': 'no-store' }
    });
  }

  const parts = match[2].split('/').map(part => decodeURIComponent(part));
  if (!parts.length || parts.some(part => !part || part === '.' || part === '..' || part.includes('\\'))) {
    return new Response('Invalid gfiles path.', { status: 400 });
  }

  const githubPath = parts.map(part => encodeURIComponent(part)).join('/');
  const upstream = await fetch(
    'https://api.github.com/repos/' + repo + '/contents/' + githubPath + '?ref=main',
    {
      headers: {
        Accept: 'application/vnd.github.raw+json',
        Authorization: 'Bearer ' + token,
        'User-Agent': 'Cosmic-gfiles-proxy',
        'X-GitHub-Api-Version': '2022-11-28'
      },
      cf: { cacheTtl: 3600, cacheEverything: true }
    }
  );

  if (!upstream.ok) {
    return new Response('Gfiles asset not found.', {
      status: upstream.status,
      headers: { 'Content-Type': 'text/plain; charset=UTF-8', 'Cache-Control': 'no-store' }
    });
  }

  const headers = new Headers(upstream.headers);
  headers.set('Cache-Control', 'public, max-age=3600, s-maxage=86400');
  headers.delete('Set-Cookie');

  const type = headers.get('content-type') || '';
  if (type.includes('text/html')) {
    const html = await upstream.text();
    const folder = parts[0] || '';
    return new Response(rewriteGfilesHtml(html, source, folder), {
      status: upstream.status,
      headers
    });
  }

  return new Response(upstream.body, { status: upstream.status, headers });
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
    if (url.pathname === '/api/community/submissions') return forwardRegistryPath(request, env, '/community/submissions');
    if (url.pathname === '/api/community/reviews') return forwardRegistryPath(request, env, '/community/reviews');
    if (url.pathname === '/api/source-lockfiles') return forwardRegistryPath(request, env, '/source-lockfiles');
    if (url.pathname === '/api/accounts/data') {
      if (request.method !== 'GET') return jsonResponse(request,{ok:false,error:'method-not-allowed'},405);
      return forwardRegistryPath(request, env, '/account-data');
    }
    if (url.pathname === '/api/accounts/revoke-sessions') {
      if (request.method !== 'POST') return jsonResponse(request,{ok:false,error:'method-not-allowed'},405);
      return forwardRegistryPath(request, env, '/revoke-sessions');
    }
    if (url.pathname === '/api/accounts/delete') {
      if (request.method !== 'POST') return jsonResponse(request,{ok:false,error:'method-not-allowed'},405);
      return forwardRegistryPath(request, env, '/delete-account');
    }
    if (url.pathname === '/api/admin/community/queue' || url.pathname === '/api/admin/community/moderate') {
      if (!(await verifyAdminSession(request, env))) return jsonResponse(request,{ok:false,error:'unauthorized'},401);
      if (url.pathname.endsWith('/queue') && request.method !== 'GET') return jsonResponse(request,{ok:false,error:'method-not-allowed'},405);
      if (url.pathname.endsWith('/moderate') && request.method !== 'POST') return jsonResponse(request,{ok:false,error:'method-not-allowed'},405);
      return forwardRegistryPath(request, env, '/admin/community');
    }
    if (url.pathname === '/api/admin/accounts' || url.pathname === '/api/admin/account') return handleAdminAccounts(request, env);
    if (url.pathname === '/api/site-state') return handleSiteState(request, env);
    if (url.pathname === '/api/admin/site-state') return handleAdminSiteState(request, env);
    if (url.pathname === '/api/admin/global') return handleAdminGlobal(request, env);
    if (url.pathname === '/api/deployment-status') return handleDeploymentStatus(request);
    if (url.pathname === '/api/developer/sysinfo') return handleDeveloperSysinfo(request, env);
    if (url.pathname === '/api/hub-diagnostics') return handleHubDiagnostics(request, env);
    if (url.pathname === '/api/ai') return handleAI(request, env);
    if (url.pathname === '/api/admin/auth' || url.pathname === '/api/admin-auth') return handleAdminAuth(request, env);
    if (url.pathname === '/api/accounts/login' && request.method === 'POST') {
      const id=env.USERNAME_REGISTRY.idFromName('global'); return env.USERNAME_REGISTRY.get(id).fetch(new Request(new URL('/login',request.url),request));
    }
    if (url.pathname === '/api/accounts/password' && request.method === 'POST') {
      const id=env.USERNAME_REGISTRY.idFromName('global'); return env.USERNAME_REGISTRY.get(id).fetch(new Request(new URL('/password',request.url),request));
    }
    if (url.pathname === '/api/cosmic-profile' && request.method === 'GET') {
      const username=(url.searchParams.get('username')||'').trim();
      const token=url.searchParams.get('account_token')||'';
      try {
        const id=env.USERNAME_REGISTRY.idFromName('global');
        return await env.USERNAME_REGISTRY.get(id).fetch(new Request(new URL('/profile',request.url),{
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body:JSON.stringify({username,account_token:token})
        }));
      } catch (error) {
        return jsonResponse(request,{ok:false,error:'cosmic-profile-worker-error',detail:String(error?.message||error)},500);
      }
    }
    if (url.pathname === '/api/cosmic-events' && request.method === 'GET') {
      const id=env.USERNAME_REGISTRY.idFromName('global');
      return env.USERNAME_REGISTRY.get(id).fetch(new Request(new URL('/events',request.url),{method:'GET'}));
    }
    if (url.pathname === '/api/admin/cosmic-event' && request.method === 'POST') {
      if (!(await verifyAdminSession(request,env))) return jsonResponse(request,{ok:false,error:'unauthorized'},401);
      const id=env.USERNAME_REGISTRY.idFromName('global'); return env.USERNAME_REGISTRY.get(id).fetch(new Request(new URL('/events',request.url),request));
    }
    if (url.pathname === '/api/cosmic-profile' && request.method === 'POST') {
      const id=env.USERNAME_REGISTRY.idFromName('global'); return env.USERNAME_REGISTRY.get(id).fetch(new Request(new URL('/profile',request.url),request));
    }
    if (url.pathname.startsWith('/api/rooms/') && (request.method === 'GET' || request.method === 'POST')) {
      const id=env.USERNAME_REGISTRY.idFromName('global'); const code=url.pathname.split('/').pop();
      return env.USERNAME_REGISTRY.get(id).fetch(new Request(new URL('/rooms/'+code,request.url),request));
    }
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
      if (url.pathname.startsWith('/gfiles/')) {
        const gfiles = await serveGfiles(request, env);
        if (gfiles) return gfiles;
      }
      if (url.pathname.startsWith('/ugs-cdn/')) {
        const asset = await serveUgsCdn(request);
        if (asset) return asset;
      }
      if (url.pathname.startsWith('/ugs-repo/')) {
        const asset = await serveUgsRepoAsset(request);
        if (asset) return asset;
      }
      if (url.pathname.startsWith('/ugs/')) {
        const ugs = await serveUgs(request);
        if (ugs) return ugs;
      }
      const hub = await serveHub(request, env);
      if (hub) return hub;
      return fetchAsset(request, env);
    }
    return fetchAsset(request, env);
  }
};
export { UsernameRegistry };
