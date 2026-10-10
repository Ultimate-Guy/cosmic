import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const html = await readFile(new URL('../cosmic-studio.html', import.meta.url), 'utf8');
const start = html.indexOf('function validateExtensionManifest(input){');
const end = html.indexOf('\nfunction buildExtensionManifest', start);
if (start < 0 || end < 0) throw new Error('Could not locate the Studio manifest validator.');

const validator = html.slice(start, end);
for (const invariant of [
  "sandbox:'allow-scripts'",
  "frame.setAttribute('sandbox','allow-scripts')",
  "event.origin!=='null'",
  "event.data.nonce!==activeExtensionNonce",
  "activeExtensionNonce=crypto.randomUUID()",
  "if(entry.origin===location.origin)",
  "auditGithubExtensionSource",
  "'/api/extensions/source-audit'",
  "'catalog' === 'extensions'"
]) {
  if (!html.includes(invariant)) throw new Error('Missing extension runtime security invariant: ' + invariant);
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
  isolation: {
    mode: 'iframe',
    sandbox: 'allow-scripts',
    sameOrigin: false
  }
};
const good = validate(base);
if (good.version !== '1.2.3' || good.entry !== base.entry) {
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
console.log('Cosmic extension manifest tests passed (9 acceptance/rejection cases plus runtime source invariants).');
