#!/usr/bin/env bash
# A release .app for trying out on this Mac, signed with the same Developer ID as published releases. The Keychain only
# lets an app read its items without asking when the signature matches the one that saved them, so an unsigned local
# build asks for the password on every read. No notarization, no updater artifacts, this Mac's architecture only.
set -euo pipefail
cd "$(dirname "$0")/.."

identity=$(security find-identity -v -p codesigning | sed -n 's/.*"\(Developer ID Application: [^"]*\)".*/\1/p' | head -1)
[ -n "$identity" ] || { echo "No Developer ID Application identity in the Keychain." >&2; exit 1; }

APPLE_SIGNING_IDENTITY="$identity" bunx tauri build --bundles app --config '{"bundle":{"createUpdaterArtifacts":false}}'
echo "Built: $(pwd)/src-tauri/target/release/bundle/macos/AssignedToMe.app"
