#!/usr/bin/env node

import { chromium } from 'playwright-core';
import fs from 'node:fs';

const REGISTRY = 'pages/lessons/games.json';
const GAME_ORIGIN = process.env.COSMIC_GAME_ORIGIN || 'https://cosmicv2.v75ultimate.workers.dev';
const CONCURRENCY = Number(process.env.COSMIC_GAME_CONCURRENCY || 6);
const NAV_TIMEOUT = Number(process.env.COSMIC_GAME_NAV_TIMEOUT || 10000);
const LOAD_WAIT = Number(process.env.COSMIC_GAME_LOAD_WAIT || 2500);
const FRAME_WAIT = Number(process.env.COSMIC_GAME_FRAME_WAIT || 7000);

function readGames() {
  const data = JSON.parse(fs.readFileSync(REGISTRY, 'utf8'));
  if (!Array.isArray(data)) throw new Error('games.json must contain an array');
  return data;
}

function shellUrl(game) {
  const rawPath = String(game.path || '').replace(/^\/+/, '');
  const target = GAME_ORIGIN + '/' + rawPath;
  return GAME_ORIGIN + '/pages/lessons/game-shell.html?game=' + encodeURIComponent(target);
}

async function inspectGame(browser, game) {
  const name = String(game.name || '').trim() || '<unnamed>';
  const url = shellUrl(game);
  const page = await browser.newPage({ viewport: { width: 1365, height: 768 } });
  const errors = [];
  const failed = [];
  const badResponses = [];
  page.on('pageerror', e => { if (errors.length < 8) errors.push('pageerror: ' + e.message); });
  page.on('console', m => { if (m.type() === 'error' && errors.length < 8) errors.push('console: ' + m.text()); });
  page.on('requestfailed', r => { if (failed.length < 8) failed.push({url:r.url(), error:r.failure()?.errorText || 'request failed'}); });
  page.on('response', r => { if (r.status() >= 500 && badResponses.length < 8) badResponses.push({url:r.url(), status:r.status()}); });
  const result = { name, url, ok:false, iframe:null, errors, failed, badResponses, reason:null };
  try {
    const response = await page.goto(url, {waitUntil:'domcontentloaded', timeout:NAV_TIMEOUT});
    if (!response || response.status() >= 400) { result.reason = 'game shell HTTP ' + (response?.status() || 'no response'); return result; }
    const iframe = page.locator('#game');
    await iframe.waitFor({state:'attached', timeout:3000});
    const src = await iframe.getAttribute('src');
    const frame = await iframe.contentFrame();
    if (!frame) { result.reason = 'game iframe has no child frame'; return result; }
    try { await frame.waitForLoadState('domcontentloaded', {timeout:FRAME_WAIT}); } catch (_) {}
    await page.waitForTimeout(LOAD_WAIT);
    const state = await iframe.evaluate(el => {
      const doc = el.contentDocument;
      const rect = el.getBoundingClientRect();
      if (!doc) return {hasDocument:false, readyState:null, bodyChildren:0, htmlLength:0, canvasCount:0, visibleSurfaceCount:0, width:rect.width, height:rect.height};
      const visibleSurfaceCount = Array.from(doc.querySelectorAll('canvas, #game, #gameContainer, #unity-container, iframe, video')).filter(x => {
        const s=getComputedStyle(x), r=x.getBoundingClientRect();
        return s.display!=='none' && s.visibility!=='hidden' && r.width>0 && r.height>0;
      }).length;
      return {hasDocument:true, readyState:doc.readyState, bodyChildren:doc.body?.children.length||0, htmlLength:doc.documentElement?.outerHTML?.length||0, canvasCount:doc.querySelectorAll('canvas').length, visibleSurfaceCount, width:rect.width, height:rect.height, title:doc.title||''};
    });
    result.iframe = Object.assign({src:src}, state);
    if (!src) { result.reason='iframe src is empty'; return result; }
    if (state.width < 10 || state.height < 10) { result.reason='iframe has invalid dimensions ' + state.width + 'x' + state.height; return result; }
    if (!state.hasDocument || !state.readyState || state.readyState === 'loading') { result.reason='iframe document did not finish loading'; return result; }
    if (state.bodyChildren === 0 || state.htmlLength < 80) { result.reason='iframe loaded an empty/nearly-empty document'; return result; }
    const fatal = errors.find(e => /ReferenceError|SyntaxError|TypeError|URIError|RangeError|Failed to load module script|uncaught/i.test(e));
    if (fatal && state.visibleSurfaceCount === 0 && state.canvasCount === 0) { result.reason=fatal; return result; }
    result.ok=true;
    return result;
  } catch (e) { result.reason=e.message; return result; }
  finally { await page.close(); }
}

async function main() {
  const games=readGames();
  console.log('Testing ' + games.length + ' games through ' + GAME_ORIGIN);
  const executablePath = process.env.CHROME_PATH;
  if (!executablePath) throw new Error('CHROME_PATH is not set');
  const browser=await chromium.launch({headless:true, executablePath, args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=swiftshader']});
  const results=[]; let next=0;
  async function worker(){ while(true){ const i=next++; if(i>=games.length) return; const r=await inspectGame(browser,games[i]); results[i]=r; process.stdout.write(r.ok?'.':'F'); } }
  try { await Promise.all(Array.from({length:Math.min(CONCURRENCY,games.length)},worker)); } finally { await browser.close(); }
  console.log('\n');
  const failures=results.filter(r=>!r.ok);
  for(const r of failures){
    console.log('FAIL: ' + r.name + ': ' + (r.reason||'unknown failure'));
    if(r.iframe) console.log('  iframe: ' + JSON.stringify(r.iframe));
    if(r.errors.length) console.log('  errors: ' + JSON.stringify(r.errors));
    if(r.failed.length) console.log('  failed requests: ' + JSON.stringify(r.failed));
    if(r.badResponses.length) console.log('  5xx responses: ' + JSON.stringify(r.badResponses));
  }
  console.log('IFRAME GAME TEST: ' + (failures.length ? 'FAILED' : 'PASSED'));
  console.log('Games checked: ' + results.length);
  console.log('Failures: ' + failures.length);
  if(failures.length) process.exit(1);
}

main().catch(e=>{console.error(e);process.exit(1);});