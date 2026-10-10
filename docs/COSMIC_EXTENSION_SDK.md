# Cosmic Extension SDK (v1 runtime and moderated catalog)

Cosmic Studio includes an **opt-in extension runner** and a small moderated metadata catalog. The catalog does not host or execute submitted code. Saving a manifest is local to the current browser, and running an extension always requires explicit confirmation.

## Security model

- Extensions run in an iframe with `sandbox="allow-scripts"` only. Cosmic does not grant `allow-same-origin`, top navigation, pop-ups, forms, downloads, clipboard, or other iframe permissions.
- This strict sandbox gives the child an opaque origin, visible to the parent as `event.origin === "null"`. Since the host cannot pin a meaningful child origin for a sandboxed frame, every message is bound to the exact iframe Window and a fresh random nonce created on each load. The nonce is rotated after navigation. It is a channel-binding control, not a code trust signal.
- The manifest entry must be HTTPS, must not contain URL credentials, and must not use Cosmic's own origin.
- Only the two capabilities below are accepted. The parent checks the requested capability against the manifest, limits incoming messages to 16 KiB and 20 messages per minute, and returns no raw account token, password, or direct DOM/storage access.
- A navigation request is shown to the user and opens a separate tab only after a user click. The extension cannot automatically navigate Cosmic.
- Use only third-party code you trust. Iframe sandboxing limits integration privileges; it does not make malicious code safe from harming its own page, sending network requests from its own origin, or displaying deceptive content.

## Manifest v1

```json
{
  "manifestVersion": 1,
  "name": "Example Cosmic Extension",
  "version": "1.0.0",
  "entry": "https://extensions.example/extension.html",
  "permissions": [
    "cosmic.profile.read",
    "cosmic.navigation.request"
  ],
  "isolation": {
    "mode": "iframe",
    "sandbox": "allow-scripts",
    "sameOrigin": false
  },
  "enabledByDefault": false,
  "reviewRequired": true
}
```

Names are 1–80 characters. Versions use numeric `major.minor.patch` formatting, with optional prerelease/build text. Entry URLs are limited to 2,048 characters. Unknown or duplicate permissions are rejected, and extensions cannot enable themselves by setting `enabledByDefault`.

## Host message protocol

After each frame load, Cosmic sends an initialization message with a fresh unguessable nonce. Because the iframe is strictly sandboxed, the target origin must be `"*"`; the exact iframe Window and nonce are checked on subsequent messages.

```json
{
  "type": "cosmic:host:init",
  "version": 1,
  "nonce": "fresh-random-channel-token",
  "extension": { "name": "Example Cosmic Extension", "version": "1.0.0" },
  "capabilities": ["cosmic.profile.read", "cosmic.navigation.request"]
}
```

To request a capability, include the received nonce:

```json
{
  "type": "cosmic:extension:request",
  "version": 1,
  "nonce": "fresh-random-channel-token",
  "id": "request-1",
  "capability": "cosmic.profile.read",
  "payload": {}
}
```

Successful and failed replies use `type: "cosmic:host:response"`, protocol `version: 1`, the same `nonce`, and the matching `id`. Responses include either `ok: true` and `data`, or `ok: false` and a short `error` string. Old messages from previous iframe loads are rejected because their nonce is no longer current.

## Available capabilities

**`cosmic.profile.read`** returns a username if one is available in this browser and a small allowlist of text fields from the locally cached profile. It does not fetch private cloud profile data or return account tokens/password material.

**`cosmic.navigation.request`** accepts only a credential-free HTTPS URL. Cosmic displays the destination and waits for the user to approve or reject it.

## Example extension-side client

An extension should allowlist Cosmic's parent origins, retain the nonce from the first valid host initialization, and include it with every request. Replace the list with the exact Cosmic deployment origins you expect to embed the extension from.

```js
const trustedCosmicOrigins = new Set([
  "https://ultimate-guy.github.io",
  "https://cosmicv2.v75ultimate.workers.dev"
]);
let hostOrigin = null;
let channelNonce = null;
let requestNumber = 0;
const pending = new Map();

window.addEventListener("message", event => {
  if (event.source !== window.parent) return;

  if (event.data?.type === "cosmic:host:init" && event.data.version === 1) {
    if (!trustedCosmicOrigins.has(event.origin) ||
        typeof event.data.nonce !== "string" ||
        event.data.nonce.length < 32) return;
    hostOrigin = event.origin;
    channelNonce = event.data.nonce;
    window.parent.postMessage({
      type: "cosmic:extension:ready",
      version: 1,
      nonce: channelNonce
    }, hostOrigin);
    return;
  }

  if (!hostOrigin || event.origin !== hostOrigin) return;
  const msg = event.data;
  if (msg?.type !== "cosmic:host:response" ||
      msg.version !== 1 ||
      msg.nonce !== channelNonce) return;
  const resolve = pending.get(msg.id);
  if (!resolve) return;
  pending.delete(msg.id);
  resolve(msg);
});

function requestCapability(capability, payload = {}) {
  if (!hostOrigin || !channelNonce) {
    return Promise.reject(new Error("Cosmic host is not ready."));
  }
  const id = "extension-" + (++requestNumber);
  return new Promise(resolve => {
    pending.set(id, resolve);
    window.parent.postMessage({
      type: "cosmic:extension:request",
      version: 1,
      nonce: channelNonce,
      id,
      capability,
      payload
    }, hostOrigin);
  });
}

// Example:
// requestCapability("cosmic.profile.read").then(console.log);
// requestCapability("cosmic.navigation.request", {url: "https://example.com/"});
```

Implement request timeouts and handle `ok: false`. Do not request capabilities the extension doesn't need.

## Community catalog and pinned-source static scan

An extension catalog submission requires a public GitHub source repository, a full immutable 40-character commit SHA, and a query-free entry URL in the form `https://cdn.jsdelivr.net/gh/owner/repo@<commit-sha>/path/to/entry.html`. Cosmic verifies that the repository and commit in the entry URL match the audited GitHub source, confirms the exact HTML entry exists at that commit, and scans that entry file first plus a bounded selection of other source files. The code is never run by the scanner. The scanner looks for signals such as dynamic code execution, cookie access, suspicious credential-adjacent network calls, dynamic script loading, wildcard messaging, common obfuscation helpers, and network-capability use.

The report includes the verified repository/commit, scanned file counts, file size limits, and any configured findings. It is heuristic, can miss malicious behavior, and can flag legitimate patterns. **A clean report is not a guarantee of safety and is not an independent human security audit.** Each listing remains pending until a Cosmic moderator reviews its metadata/source report. To approve an extension, the moderator must explicitly acknowledge a manual source review, enter the exact pinned commit SHA, and write a review note; the API rejects an approval that omits these checks. A moderator-approved listing still displays that the code is not independently audited. The catalog never downloads an entry page just to render its metadata, never executes a submission during moderation, and never auto-runs a catalog item.

## Current limits

- There is no automated public release pipeline, signed publisher identity, content-digest pinning, or automatic updating of extensions.
- The metadata catalog requires a pinned GitHub source snapshot for review. The runtime entry URL can still change unless the extension publisher serves versioned immutable assets.
- Cosmic's static source scan is advisory only. Treat extension code as untrusted even when its catalog metadata has been approved.
- The Controller & Touch Hub is separate: on-screen touch key injection is enabled only when the game iframe is same-origin and accessible to Cosmic. Cross-origin games cannot be safely controlled by synthetic DOM keyboard events from the parent.
