#!/usr/bin/env bash
# Rebuilds the Android app (Trusted Web Activity) from twa-manifest.json.
# Needs: Node.js, JDK 17 and the Android SDK configured for Bubblewrap
# (~/.bubblewrap/config.json), and the signing key kanadojo-ru.keystore
# next to this script (it is not in Git). Before a new release, raise
# "appVersionCode" (and "appVersion") in twa-manifest.json.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
rm -rf "$HERE/twa" && mkdir -p "$HERE/twa"
sed "s|\"./kanadojo-ru.keystore\"|\"$HERE/kanadojo-ru.keystore\"|" "$HERE/twa-manifest.json" > "$HERE/twa/twa-manifest.json"
cd "$HERE/twa"
npx --yes @bubblewrap/cli@1.27.0 update --skipVersionUpgrade
# Passwords come from BUBBLEWRAP_KEYSTORE_PASSWORD and BUBBLEWRAP_KEY_PASSWORD.
npx --yes @bubblewrap/cli@1.27.0 build --skipPwaValidation
ls -la "$HERE/twa/app-release-signed.apk"
