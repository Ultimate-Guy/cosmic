# Cosmic Extension SDK (Draft v1)

This document describes the first, intentionally limited Cosmic extension manifest. It is a proposal and manifest generator only: Cosmic Studio does **not** install or execute third-party extensions yet.

## Goals

- Keep extensions opt-in and versioned.
- Use an isolated, cross-origin iframe rather than executing extension code in Cosmic's main page.
- Start with a tiny read-only capability set.
- Require review before any extension is distributed through Cosmic.
- Allow users to remove an extension without changing Cosmic core files.

## Draft manifest

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
    "sandbox": "allow-scripts",
    "sameOrigin": false
  },
  "enabledByDefault": false,
  "reviewRequired": true
}
```

## Security rules for a future runtime

1. Require HTTPS and validate the manifest schema before displaying an install prompt.
2. Never grant `allow-same-origin` by default; never evaluate extension source in the parent page.
3. Treat messages from an extension as untrusted. Validate origin, message size, shape, rate, and requested capability.
4. Start with read-only APIs. Require a user gesture for navigation or other visible actions.
5. Do not expose account tokens, raw cloud profile credentials, arbitrary filesystem access, or admin APIs.
6. Pin the extension version and content digest in an install lockfile. Show permission changes before updating.
7. Keep extensions disabled until explicitly enabled; offer disable/uninstall and clear any extension-owned storage.
8. Require review and a rollback path before a manifest can become available in the public catalog.

## Current status

Cosmic Studio can generate and download a draft manifest. It does not install extensions, grant these capabilities, or execute the entry URL. A production runtime still needs a protocol, schema validation, a trusted review pipeline, and security tests.
