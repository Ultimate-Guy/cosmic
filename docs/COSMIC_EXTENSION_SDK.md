# Cosmic Extension SDK (v1 runtime)

Cosmic Studio provides an **opt-in, sandboxed extension runner** for user-supplied HTTPS entry URLs. It is a small, local-first runtime—not a public extension store. Saving a manifest only saves metadata in this browser; it does not publish the extension or enable it automatically.

## Goals and boundaries

- Extensions must be started by a user and remain disabled until explicitly launched.
- The entry URL must use HTTPS, have no embedded credentials, and be on a **different origin from Cosmic**.
- Extension code executes only inside a sandboxed iframe, never by evaluating it in Cosmic's page.
- A manifest can request only the explicit capabilities below. The parent validates each request, limits message size and rate, and does not give the extension direct access to Cosmic's DOM, local storage, account token, password, administrator API, arbitrary filesystem, or game source.
- Extensions are local-only for now. There is no reviewed public distribution catalog, content-digest pinning, automatic updates, or extension-owned data cleanup feature.

## Manifest v1

```json
{
  "manifestVersion": 1,
  "name": "Example Cosmic Extension",
  "version": "0.1.0",
  "entry": "https://example.com/extension.html",
  "permissions": [
    "cosmic.profile.read",
    "cosmic.navigation.request"
  ],
  "isolation": {
    "mode": "iframe",
    "sandbox": "allow-scripts allow-same-origin",
    "sameOrigin": false
  },
  "enabledByDefault": false,
  "reviewRequired": true
}
```

`sameOrigin: false` means the extension entry must **not share Cosmic's origin**. The iframe retains the configured external origin so the host can check `MessageEvent.origin` and pin `postMessage` target origins. Since the extension origin differs from Cosmic's origin, it cannot access Cosmic's DOM or storage. The sandbox does not grant top-navigation, pop-up, form, download, or clipboard permissions.

Names are limited to 80 characters, versions use a numeric `major.minor.patch` format (optionally followed by prerelease/build text), entry URLs are limited to 2,048 characters, and only the two known capabilities are accepted. Unknown, duplicate, or unrequested capabilities are rejected.

## Host message protocol

All messages use JSON-compatible objects and protocol version `1`. The host sends an initialization message to the exact configured HTTPS origin when the iframe loads:

```json
{
  "type": "cosmic:host:init",
  "version": 1,
  "extension": { "name": "Example Cosmic Extension", "version": "0.1.0" },
  "capabilities": ["cosmic.profile.read", "cosmic.navigation.request"]
}
```

An extension asks for a capability with a unique request ID:

```json
{
  "type": "cosmic:extension:request",
  "version": 1,
  "id": "request-1",
  "capability": "cosmic.profile.read",
  "payload": {}
}
```

The host responds to the same iframe window and configured origin:

```json
{
  "type": "cosmic:host:response",
  "version": 1,
  "id": "request-1",
  "ok": true,
  "data": { "username": "player", "profile": {} }
}
```

Error replies use `ok: false` and a short `error` string. The host ignores messages from other windows or origins, malformed messages, payloads over 16 KiB, unknown capabilities, and requests above the 20-message-per-minute host limit. A runtime reload resets that in-memory rate counter.

### Available capabilities

**`cosmic.profile.read`** returns the signed-in username (if present) plus an allowlisted set of small text fields from the profile cached in this browser. It does not fetch a cloud profile and never returns account tokens or password material.

**`cosmic.navigation.request`** requires `payload.url` to be a credential-free HTTPS URL. Cosmic displays a prompt showing the target; only a user pressing **Open link** opens it in another tab. The extension cannot automatically redirect the parent page.

The iframe origin is checked for every message and outbound messages use the exact configured origin, so a redirect to a different origin cannot use the host bridge. The iframe is tied to its runtime instance, and Stop removes it and clears any pending navigation prompt.

## Example client snippet

This example is for an extension hosted on a different HTTPS origin. It records the host origin from the initialization event and sends only explicit requests; it cannot grant itself extra capabilities.

```js
let hostOrigin = null;
let requestNumber = 0;
const pending = new Map();

window.addEventListener("message", event => {
  if (event.source !== window.parent) return;

  if (event.data?.type === "cosmic:host:init" && event.data.version === 1) {
    hostOrigin = event.origin;
    window.parent.postMessage(
      { type: "cosmic:extension:ready", version: 1 },
      hostOrigin
    );
    return;
  }

  if (event.origin !== hostOrigin) return;
  const msg = event.data;
  if (msg?.type !== "cosmic:host:response" || msg.version !== 1) return;
  const resolve = pending.get(msg.id);
  if (!resolve) return;
  pending.delete(msg.id);
  resolve(msg);
});

function requestCapability(capability, payload = {}) {
  if (!hostOrigin) return Promise.reject(new Error("Cosmic host is not ready."));
  const id = "extension-" + (++requestNumber);
  return new Promise(resolve => {
    pending.set(id, resolve);
    window.parent.postMessage({
      type: "cosmic:extension:request", version: 1, id, capability, payload
    }, hostOrigin);
  });
}

// Example: requestCapability("cosmic.profile.read").then(console.log);
// For navigation: requestCapability("cosmic.navigation.request", { url: "https://example.com/" });
```

Extensions should also implement request timeouts, handle `ok: false`, and avoid asking for unnecessary capabilities.

## Known limits

- This is not an extension store and does not run a public review pipeline.
- The runner validates requested permissions but does not independently audit third-party code. Run only extensions whose publisher and URL you trust.
- Navigation requires a user click on each request; there is no background navigation.
- There is no content digest verification or automatic update mechanism yet.
- Game Source Lockfiles, community moderation, account tools, and offline packs are separate Studio features; extension code does not receive privileged access to them.
