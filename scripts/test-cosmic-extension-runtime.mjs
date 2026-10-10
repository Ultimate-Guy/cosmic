import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const studio = await readFile(new URL('../cosmic-studio.html', import.meta.url), 'utf8');
const worker = await readFile(new URL('../worker.js', import.meta.url), 'utf8');
const shell = await readFile(new URL('../pages/lessons/game-shell.html', import.meta.url), 'utf8');

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
  [worker, 'async auditGithubExtensionSource(repositoryUrl, commitSha)', 'pinned source scanner'],
  [worker, "url.searchParams.get('catalog') === 'extensions'", 'moderated public catalog route'],
  [worker, "url.pathname === '/api/extensions/source-audit'", 'source-audit Worker route'],
  [worker, 'source-commit-not-found', 'immutable commit verification'],
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
console.log('Cosmic extension manifest tests passed (9 acceptance/rejection cases and 17 runtime/marketplace/touch invariants).');
