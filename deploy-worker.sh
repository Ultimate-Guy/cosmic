#!/bin/sh
set -eu

: "${COSMIC_ADMIN_PASSWORD:?COSMIC_ADMIN_PASSWORD build secret is required}"

SECRETS_FILE=".wrangler-deploy-secrets.env"
trap 'rm -f "$SECRETS_FILE"' EXIT HUP INT TERM

printf 'COSMIC_ADMIN_PASSWORD=%s\n' "$COSMIC_ADMIN_PASSWORD" > "$SECRETS_FILE"
npx wrangler deploy --secrets-file "$SECRETS_FILE"
