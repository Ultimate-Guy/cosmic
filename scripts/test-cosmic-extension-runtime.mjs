import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const studio = await readFile(new URL('../cosmic-studio.html', import.meta.url), 'utf8');
const worker = await readFile(new URL('../worker.js', import.meta.url), 'utf8');
const shell = await readFile(new URL('../pages/lessons/game-shell.html', import.meta.url), 'utf8');

const pinStart = worker.indexOf('function validatePinnedExtensionEntry(');
const pinEnd = worker.indexOf('\nclass UsernameRegistry', pinStart);
if (pinStart < 0 || pinEnd < 0) throw new Error('Could not locate pinned extension entry validator.');
const pinnedValidator = worker.slice(pinStart, pinEnd);
const pinContext = { URL, decodeURIComponent, String, Error };
pinContext.globalThis = pinContext;
vm.runInNewContext(pinnedValidator + '\nglobalThis.validatePinnedExtensionEntry = validatePinnedExtensionEntry;', pinContext, {filename:'cosmic-pinned-entry-validator.js'});
const pinValidate = pinContext.validatePinnedExtensionEntry;
const fixedSha = 'a'.repeat(40);
const validPinned = pinValidate('https://cdn.jsdelivr.net/gh/octocat/hello-world@'+fixedSha+'/extension/index.html','octocat','hello-world',fixedSha);
if (!validPinned.ok || validPinned.entryPath !== 'extension/index.html') throw new Error('Valid pinned jsDelivr entry was rejected.');
function mustRejectPinned(label, url, owner='octocat', repository='hello-world', sha=fixedSha) {
  const result = pinValidate(url, owner, repository, sha);
  if (result.ok) throw new Error('Unsafe pinned extension entry accepted: ' + label);
}
mustRejectPinned('wrong commit', 'https://cdn.jsdelivr.net/gh/octocat/hello-world@'+'b'.repeat(40)+'/extension/index.html');
mustRejectPinned('wrong repository', 'https://cdn.jsdelivr.net/gh/attacker/hello-world@'+fixedSha+'/extension/index.html');
mustRejectPinned('non-jsDelivr host', 'https://example.com/extension.html');
mustRejectPinned('mutable non-pinned path', 'https://cdn.jsdelivr.net/gh/octocat/hello-world@main/extension/index.html');
mustRejectPinned('query override', 'https://cdn.jsdelivr.net/gh/octocat/hello-world@'+fixedSha+'/extension/index.html?x=1');
mustRejectPinned('path traversal', 'https://cdn.jsdelivr.net/gh/octocat/hello-world@'+fixedSha+'/../extension.html');

const start = studio.indexOf('function validateExtensionManifest(input){');
const end = studio.indexOf('\nfunction buildExtensionManifest', start);
if (start < 0 || end < 0) throw new Error('Could not locate the Studio manifest validator.');

const validator = studio.slice(start, end);
const invariants = [
  [studio, "sandbox:'allow-scripts'", 'strict manifest sandbox'],
  [studio, "frame.setAttribute('sandbox','allow-scripts')", 'strict iframe sandbox'],
  [studio, "event.origin!=='null'", 'opaque-origin check'],
  [studio, "event.data.nonce!==activeExtensionNonce", 'nonce-bound message validation'],
  [studio, 'activeExtensionNonce=crypto.randomUUID()', 'per-load random channel nonce'],
  [studio, 'id="extension-catalog-list"', 'catalog UI'],
  [studio, "apiRequest('/api/community/submissions?catalog=extensions'", 'public catalog client'],
  [studio, "apiRequest('/api/extensions/source-audit'+query", 'source-audit client'],
  [worker, 'async auditGithubExtensionSource(repositoryUrl, commitSha, entryUrl)', 'pinned source scanner'],
  [worker, 'function validatePinnedExtensionEntry(', 'pinned entry URL validator'],
  [worker, "url.searchParams.get('catalog') === 'extensions'", 'moderated public catalog route'],
  [worker, "url.pathname === '/api/extensions/source-audit'", 'source-audit Worker route'],
  [worker, 'source-commit-not-found', 'immutable commit verification'],
  [worker, 'pinned-jsdelivr-entry-required', 'extension entry pinned to jsDelivr commit'],
  [worker, 'extension-entry-not-pinned-to-audited-source', 'entry/source commit identity check'],
  [worker, 'entryPath', 'static scan includes exact entry path'],
  [worker, 'body.source_reviewed!==true', 'manual source review acknowledgement'],
  [worker, 'source_commit_confirmation', 'pinned commit confirmation on approval'],
  [worker, 'Heuristic static analysis only', 'source scan limitations disclosure'],
  [shell, 'id="touch-controls"', 'on-screen touch interface'],
  [shell, "frame.contentWindow.location.origin===location.origin", 'same-origin-only touch injection'],
  [shell, "pressed.set(action,{button,info})", 'stable key mapping while touch is held'],
  [shell, "window.addEventListener('blur',releaseAll)", 'stuck-key cleanup on blur']
];
for (const [source, invariant, label] of invariants) {
  if (!source.includes(invariant)) throw new Error('Missing security/feature invariant: ' + label);
}

const sandbox = {
  URL,
  Set,
  Error,
  location: { origin: 'https://cosmic.example' }
};
sandbox.globalThis = sandbox;
vm.runInNewContext(
  `const EXT_CAPABILITIES = new Set(['cosmic.profile.read','cosmic.navigation.request']);\n` +
  validator +
  '\nglobalThis.validateExtensionManifest = validateExtensionManifest;',
  sandbox,
  { filename: 'cosmic-studio-manifest-validator.js' }
);
const validate = sandbox.validateExtensionManifest;

const base = {
  manifestVersion: 1,
  name: 'Test Extension',
  version: '1.2.3',
  entry: 'https://extensions.example/entry.html',
  permissions: ['cosmic.profile.read'],
  isolation: { mode: 'iframe', sandbox: 'allow-scripts', sameOrigin: false }
};
const good = validate(base);
if (good.version !== '1.2.3' || good.entry !== base.entry ||
    good.isolation.sandbox !== 'allow-scripts' || good.enabledByDefault !== false) {
  throw new Error('Valid manifest was not normalized correctly.');
}
function mustReject(label, patch) {
  let rejected = false;
  try { validate({ ...base, ...patch }); }
  catch { rejected = true; }
  if (!rejected) throw new Error('Unsafe manifest was accepted: ' + label);
}
mustReject('malformed semantic version', { version: '1.2' });
mustReject('non-HTTPS entry', { entry: 'http://extensions.example/entry.html' });
mustReject('same-origin entry', { entry: 'https://cosmic.example/extension.html' });
mustReject('URL credentials', { entry: 'https://user:pass@extensions.example/entry.html' });
mustReject('unknown capability', { permissions: ['cosmic.admin'] });
mustReject('duplicate capability', { permissions: ['cosmic.profile.read', 'cosmic.profile.read'] });
mustReject('loosened sandbox', {
  isolation: { mode: 'iframe', sandbox: 'allow-scripts allow-top-navigation', sameOrigin: false }
});
mustReject('same-origin sandbox grant', {
  isolation: { mode: 'iframe', sandbox: 'allow-scripts allow-same-origin', sameOrigin: false }
});
mustReject('automatic extension enablement', { enabledByDefault: true });
console.log('Cosmic tests passed: 9 manifest rejection cases, 6 pinned-entry cases, and runtime/marketplace/touch invariants.');
