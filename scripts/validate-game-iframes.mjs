#!/usr/bin/env node

import { chromium } from 'playwright-core';
import fs from 'node:fs';

const REGISTRY = 'pages/lessons/games.json';
const GAME_ORIGIN = process.env.COSMIC_GAME_ORIGIN || 'https://cosmicv2.v75ultimate.workers.dev';
const TARGET_CONCURRENCY = Number(process.env.COSMIC_TARGET_CONCURRENCY || 48);
const HTTP_TIMEOUT = Number(process.env.COSMIC_GAME_HTTP_TIMEOUT || 6000);
const BROWSER_CONCURRENCY = Number(process.env.COSMIC_BROWSER_CONCURRENCY || 8);
const NAV_TIMEOUT = Number(process.env.COSMIC_GAME_NAV_TIMEOUT || 5000);
const FRAME_WAIT = Number(process.env.COSMIC_GAME_FRAME_WAIT || 2500);
const LOAD_WAIT = Number(process.env.COSMIC_GAME_LOAD_WAIT || 500);
const BROWSER_SAMPLE = Number(process.env.COSMIC_BROWSER_SAMPLE || 12);

function readGames() {
  const data = JSON.parse(fs.readFileSync(REGISTRY, 'utf8'));
  if (!Array.isArray(data)) throw new Error('games.json must contain an array');
  return data;
}

function targetUrl(game) {
  const rawPath = String(game.path || '').replace(/^\/+/, '');
  return GAME_ORIGIN.replace(/\/+$/, '') + '/' + rawPath;
}

function shellUrl(game) {
  const target = targetUrl(game);
  return GAME_ORIGIN.replace(/\/+$/, '') + '/pages/lessons/game-shell.html?game=' + encodeURIComponent(target);
}

function sampleGames(games) {
  if (games.length <= BROWSER_SAMPLE) return games;
  const chosen = [];
  const seen = new Set();

  const add = (game) => {
    if (!game || seen.has(game.name)) return;
    seen.add(game.name);
    chosen.push(game);
  };

  add(games[0]);
  add(games[games.length - 1]);

  const step = Math.max(1, Math.floor(games.length / (BROWSER_SAMPLE - 2)));
  for (let i = step; i < games.length - 1 && chosen.length < BROWSER_SAMPLE; i += step) {
    add(games[i]);
  }

  return chosen.slice(0, BROWSER_SAMPLE);
}

async function checkTarget(game) {
  const name = String(game.name || '').trim() || '<unnamed>';
  const url = targetUrl(game);
  const result = {name, url, ok:false, status:null, contentType:null, reason:null};

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HTTP_TIMEOUT);

  try {
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {'User-Agent':'Cosmic-Game-Validator/1.0','Cache-Control':'no-cache'},
    });

    result.status = response.status;
    result.contentType = response.headers.get('content-type') || '';

    try { await response.body?.cancel(); } catch (_) {}

    if (!response.ok) {
      result.reason = 'target returned HTTP ' + response.status;
      return result;
    }

    if (result.contentType && !/text\/html|application\/xhtml\+xml/i.test(result.contentType)) {
      result.reason = 'target did not return HTML content (' + result.contentType + ')';
      return result;
    }

    result.ok = true;
    return result;
  } catch (e) {
    result.reason = e.name === 'AbortError' ? 'target request timed out' : e.message;
    return result;
  } finally {
    clearTimeout(timer);
  }
}

async function runTargetChecks(games) {
  const results = new Array(games.length);
  let next = 0;

  async function worker() {
    while (true) {
      const index = next++;
      if (index >= games.length) return;
      const result = await checkTarget(games[index]);
      results[index] = result;
      process.stdout.write(result.ok ? '.' : 'F');
    }
  }

  await Promise.all(
    Array.from({length: Math.min(TARGET_CONCURRENCY, games.length)}, worker)
  );

  return results;
}

async function inspectBrowserGame(browser, game) {
  const name = String(game.name || '').trim() || '<unnamed>';
  const url = shellUrl(game);
  const page = await browser.newPage({viewport:{width:1365,height:768}});
  const errors = [];
  const failed = [];

  page.on('pageerror', e => {
    if (errors.length < 5) errors.push('pageerror: ' + e.message);
  });
  page.on('console', m => {
    if (m.type() === 'error' && errors.length < 5) errors.push('console: ' + m.text());
  });
  page.on('requestfailed', r => {
    if (failed.length < 5) {
      failed.push({
        url: r.url(),
        error: r.failure()?.errorText || 'request failed'
      });
    }
  });

  const result = {name, url, ok:false, shell:null, iframe:null, errors, failed, reason:null};

  try {
    const response = await page.goto(url, {
      waitUntil:'domcontentloaded',
      timeout:NAV_TIMEOUT
    });

    if (!response || response.status() >= 400) {
      result.reason = 'shell HTTP ' + (response?.status() || 'no response');
      return result;
    }

    const shellState = await page.evaluate(() => ({
      href: location.href,
      title: document.title,
      hasGameIframe: !!document.querySelector('#game'),
      iframeCount: document.querySelectorAll('iframe').length,
      bodyLength: document.body?.innerHTML?.length || 0
    }));

    let shell = shellState;
    if (!shell.hasGameIframe) {
      await page.waitForTimeout(500);
      shell = await page.evaluate(() => ({
        href: location.href,
        title: document.title,
        hasGameIframe: !!document.querySelector('#game'),
        iframeCount: document.querySelectorAll('iframe').length,
        bodyLength: document.body?.innerHTML?.length || 0
      }));
    }

    if (!shell.hasGameIframe) {
      result.reason = 'Cosmic shell did not contain #game iframe';
      result.shell = shell;
      return result;
    }

    const iframeHandle = await page.$('#game');
    if (!iframeHandle) {
      result.reason = 'Cosmic shell iframe disappeared before inspection';
      result.shell = shell;
      return result;
    }

    const src = await iframeHandle.getAttribute('src'); 
    if (!src) {
      result.reason = 'iframe src is empty';
      return result;
    }

    const frame = await iframe.contentFrame();
    if (!frame) {
      result.reason = 'iframe child frame was not created';
      return result;
    }

    try {
      await frame.waitForLoadState('domcontentloaded', {timeout:FRAME_WAIT});
    } catch (_) {}

    await page.waitForTimeout(LOAD_WAIT);

    const state = await iframe.evaluate(el => {
      const doc = el.contentDocument;
      const rect = el.getBoundingClientRect();

      if (!doc) {
        return {
          hasDocument:false,
          readyState:null,
          bodyChildren:0,
          htmlLength:0,
          canvasCount:0,
          width:rect.width,
          height:rect.height
        };
      }

      return {
        hasDocument:true,
        readyState:doc.readyState,
        bodyChildren:doc.body?.children.length || 0,
        htmlLength:doc.documentElement?.outerHTML?.length || 0,
        canvasCount:doc.querySelectorAll('canvas').length,
        width:rect.width,
        height:rect.height
      };
    });

    result.shell = shell;
    result.iframe = {src, ...state};

    if (state.width < 10 || state.height < 10) {
      result.reason = 'iframe has invalid dimensions';
      return result;
    }

    if (!state.hasDocument) {
      result.reason = 'iframe document is inaccessible';
      return result;
    }

    if (state.bodyChildren === 0 || state.htmlLength < 80) {
      result.reason = 'iframe loaded an empty/nearly-empty document';
      return result;
    }

    const fatal = errors.find(e =>
      /ReferenceError|SyntaxError|TypeError|URIError|RangeError|Failed to load module script|uncaught/i.test(e)
    );

    if (fatal && state.canvasCount === 0) {
      result.reason = fatal;
      return result;
    }

    result.ok = true;
    return result;
  } catch (e) {
    result.reason = e.message;
    return result;
  } finally {
    await page.close();
  }
}

async function runBrowserChecks(games) {
  const executablePath = process.env.CHROME_PATH;
  if (!executablePath) throw new Error('CHROME_PATH is not set');

  const browser = await chromium.launch({
    headless:true,
    executablePath,
    args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=swiftshader']
  });

  const results = new Array(games.length);
  let next = 0;

  async function worker() {
    while (true) {
      const index = next++;
      if (index >= games.length) return;
      const result = await inspectBrowserGame(browser, games[index]);
      results[index] = result;
      process.stdout.write(result.ok ? '.' : 'F');
    }
  }

  try {
    await Promise.all(
      Array.from({length:Math.min(BROWSER_CONCURRENCY, games.length)}, worker)
    );
  } finally {
    await browser.close();
  }

  return results;
}

async function main() {
  const games = readGames();
  console.log('FAST TARGET TEST: ' + games.length + ' games, concurrency ' + TARGET_CONCURRENCY);

  const targetResults = await runTargetChecks(games);
  const targetFailures = targetResults.filter(r => !r.ok);

  console.log('\nTARGET FAILURES: ' + targetFailures.length);
  for (const result of targetFailures) {
    console.log('FAIL: ' + result.name + ': ' + result.reason);
  }

  const samples = sampleGames(games);
  console.log('\nBROWSER IFRAME SAMPLE: ' + samples.length + ' games, concurrency ' + BROWSER_CONCURRENCY);
  console.log('Sample includes the catalog edges and evenly spaced games.');

  const browserResults = await runBrowserChecks(samples);
  const browserFailures = browserResults.filter(r => !r.ok);

  console.log('\nBROWSER SAMPLE FAILURES: ' + browserFailures.length);
  for (const result of browserFailures) {
    console.log('FAIL: ' + result.name + ': ' + result.reason);
    if (result.iframe) console.log('  iframe: ' + JSON.stringify(result.iframe));
    if (result.errors.length) console.log('  errors: ' + JSON.stringify(result.errors));
    if (result.failed.length) console.log('  failed requests: ' + JSON.stringify(result.failed));
  }

  console.log('\nIFRAME GAME TEST: ' + (targetFailures.length || browserFailures.length ? 'FAILED' : 'PASSED'));
  console.log('All game targets checked: ' + games.length);
  console.log('Full browser iframe samples checked: ' + samples.length);
  console.log('Target failures: ' + targetFailures.length);
  console.log('Browser sample failures: ' + browserFailures.length);

  if (targetFailures.length || browserFailures.length) process.exit(1);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
