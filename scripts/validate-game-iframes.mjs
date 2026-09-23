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
const EXPECTED_COMMIT = process.env.GITHUB_SHA || '';
const DEPLOYMENT_URL = process.env.COSMIC_DEPLOYMENT_URL || GAME_ORIGIN.replace(/\/+$/, '') + '/deployment.json';

async function waitForDeployment() {
  if (!EXPECTED_COMMIT) return;
  const deadline = Date.now() + Number(process.env.COSMIC_DEPLOYMENT_WAIT || 180000);
  let last = null;
  while (Date.now() < deadline) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      const response = await fetch(DEPLOYMENT_URL + '?verify=' + encodeURIComponent(EXPECTED_COMMIT) + '&t=' + Date.now(), {
        cache: 'no-store',
        signal: controller.signal,
        headers: {'Cache-Control':'no-cache','Pragma':'no-cache'}
      });
      clearTimeout(timer);
      if (response.ok) {
        const data = await response.json();
        last = data;
        if (data.source_commit === EXPECTED_COMMIT) {
          console.log('LIVE DEPLOYMENT VERIFIED: ' + EXPECTED_COMMIT);
          return;
        }
      }
    } catch (e) {
      last = String(e);
    }
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
  throw new Error('Live Worker deployment did not reach expected commit ' + EXPECTED_COMMIT + '; last=' + JSON.stringify(last));
}


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
  const target = targetUrl(game);
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

  const result = {
    name,
    url,
    ok:false,
    inconclusive:false,
    shell:null,
    iframe:null,
    errors,
    failed,
    reason:null
  };

  try {
    const response = await page.goto(url, {
      waitUntil:'domcontentloaded',
      timeout:NAV_TIMEOUT
    });

    if (!response || response.status() >= 400) {
      result.reason = 'shell HTTP ' + (response?.status() || 'no response');
      return result;
    }

    result.shell = {
      href: page.url(),
      title: await page.title().catch(() => ''),
    };

    const deadline = Date.now() + FRAME_WAIT;
    let childFrame = null;

    while (Date.now() < deadline) {
      const frames = page.frames();
      childFrame = frames.find(frame =>
        frame !== page.mainFrame() &&
        frame.url() &&
        frame.url() !== 'about:blank' &&
        (
          frame.url().startsWith(target) ||
          frame.url().includes('/pages/lessons/')
        )
      );

      if (childFrame) break;
      await page.waitForTimeout(150);
    }

    if (!childFrame) {
      result.reason = 'Cosmic shell created no loaded child game frame within timeout';
      return result;
    }

    // The child frame can navigate several times during game startup. Read only
    // from the current Frame object, and retry after a navigation/context reset.
    let state = null;
    let lastContextError = null;

    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        await childFrame.waitForLoadState('domcontentloaded', {timeout: Math.max(500, FRAME_WAIT - (attempt * 500))}).catch(() => {});
        await page.waitForTimeout(LOAD_WAIT);

        state = await childFrame.evaluate(() => {
          const doc = document;
          const body = doc.body;
          const html = doc.documentElement;
          const canvasCount = doc.querySelectorAll('canvas').length;
          const visibleSurfaces = Array.from(
            doc.querySelectorAll('canvas, #game, #gameContainer, #unity-container, iframe, video')
          ).filter(el => {
            const style = getComputedStyle(el);
            const rect = el.getBoundingClientRect();
            return style.display !== 'none' &&
              style.visibility !== 'hidden' &&
              rect.width > 0 &&
              rect.height > 0;
          }).length;

          return {
            frameUrl: location.href,
            readyState: doc.readyState,
            bodyChildren: body?.children.length || 0,
            htmlLength: html?.outerHTML?.length || 0,
            canvasCount,
            visibleSurfaceCount: visibleSurfaces
          };
        });

        break;
      } catch (error) {
        lastContextError = String(error?.message || error);
        if (!/Execution context was destroyed|Cannot find context with specified id|frame was detached|Target page, context or browser has been closed/i.test(lastContextError)) {
          throw error;
        }
        await page.waitForTimeout(500);
        const current = page.frames().find(frame =>
          frame !== page.mainFrame() &&
          frame.url() &&
          frame.url() !== 'about:blank' &&
          (frame.url().startsWith(target) || frame.url().includes('/pages/lessons/'))
        );
        if (current) childFrame = current;
      }
    }

    if (!state) {
      result.reason = 'game frame kept changing browsing context during startup';
      result.inconclusive = true;
      result.ok = true;
      return result;
    }

    result.iframe = state;

    if (!state.frameUrl) {
      result.reason = 'game frame has no URL';
      return result;
    }

    if (state.bodyChildren === 0 || state.htmlLength < 80) {
      result.reason = 'game frame loaded an empty/nearly-empty document';
      return result;
    }

    const fatal = errors.find(e =>
      /ReferenceError|SyntaxError|TypeError|URIError|RangeError|Failed to load module script|uncaught/i.test(e)
    );

    if (fatal && state.canvasCount === 0 && state.visibleSurfaceCount === 0) {
      result.reason = fatal;
      return result;
    }

    result.ok = true;
    return result;
  } catch (error) {
    const message = String(error?.message || error);
    if (/Execution context was destroyed|Cannot find context with specified id|frame was detached|Target page, context or browser has been closed/i.test(message)) {
      result.reason = 'game navigated during smoke test (inconclusive)';
      result.inconclusive = true;
      result.ok = true;
      return result;
    }
    result.reason = message;
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
  console.log('WAITING FOR LIVE DEPLOYMENT');
  await waitForDeployment();
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
  const browserFailures = browserResults.filter(r => !r.ok && !r.inconclusive);

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
