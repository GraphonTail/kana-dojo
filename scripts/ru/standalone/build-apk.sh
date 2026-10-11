#!/usr/bin/env bash
# Builds the standalone (offline) Android app KanaDojo RU.
#
# Needs: Node.js with the repo's node_modules installed, JDK 17, the Android
# SDK (platform 36, build-tools), and the signing key kanadojo-ru.keystore in
# scripts/ru/standalone/android/ (it is not in Git). Raise versionCode in
# android/app/build.gradle before every new release.
#
#   ANDROID_HOME=~/android-sdk JAVA_HOME=~/jdk17 \
#   KANADOJO_KEYSTORE_PASSWORD=... scripts/ru/standalone/build-apk.sh
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"

node "$HERE/build-web.mjs"

cd "$HERE/android"
if [[ -n "${ANDROID_HOME:-}" && ! -f local.properties ]]; then
  echo "sdk.dir=$ANDROID_HOME" > local.properties
fi
./gradlew --no-daemon assembleRelease
ls -la app/build/outputs/apk/release/app-release.apk
