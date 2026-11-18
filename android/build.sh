#!/usr/bin/env bash
# Build the signed HelpSetu APK using the locally installed Android SDK/JDK.
# No Gradle required. Run from anywhere:  bash android/build.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ANDROID="$ROOT/android"
SDK="${ANDROID_HOME:-/opt/homebrew/share/android-commandlinetools}"
BT="$SDK/build-tools/36.0.0"
JAR="$SDK/platforms/android-36/android.jar"
JAVA_HOME="${JAVA_HOME:-/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home}"
export JAVA_HOME
export PATH="$JAVA_HOME/bin:$BT:$PATH"

VERSION="1.1.0"
CODE=1
BUILD="$ANDROID/build"
OUT="$ROOT/HelpSetu-$VERSION.apk"
KS="$ANDROID/keystore/helpsetu.jks"
STOREPASS="helpsetu123"

for tool in aapt2 d8 zipalign apksigner; do
  [ -x "$BT/$tool" ] || { echo "Missing $BT/$tool" >&2; exit 1; }
done
[ -f "$JAR" ] || { echo "Missing $JAR" >&2; exit 1; }

rm -rf "$BUILD"
mkdir -p "$BUILD/gen" "$BUILD/classes" "$BUILD/dex" "$BUILD/assets/icons"

# --- bundle the offline PWA as WebView assets ---
for f in index.html styles.css core.js data.js i18n.js i18n-extra.js \
         data-i18n.js views.js views2.js sw.js manifest.webmanifest; do
  cp "$ROOT/$f" "$BUILD/assets/$f"
done
cp "$ROOT"/icons/* "$BUILD/assets/icons/"
# file:// WebView loads are more reliable without cache-busting query strings.
perl -pi -e 's/\?v=[0-9.]+//g' "$BUILD/assets/index.html"

# --- publishable web bundle for silent in-app updates ---
rm -f "$ANDROID/web-bundle.zip"
(cd "$BUILD/assets" && zip -q -r "$ANDROID/web-bundle.zip" .)
HASH="$(shasum -a 256 "$ANDROID/web-bundle.zip" | awk '{print $1}')"
python3 - "$ANDROID/update.json" "$HASH" <<'PY'
import json, sys
path, digest = sys.argv[1], sys.argv[2]
with open(path, encoding='utf-8') as f:
    data = json.load(f)
web = data.setdefault('web', {})
web['version'] = int(web.get('version', 1)) + 1
web['url'] = 'https://github.com/chandramondal-1/Help-Setu/raw/refs/heads/main/android/web-bundle.zip'
web['sha256'] = digest
with open(path, 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)
    f.write('\n')
print('web bundle version:', web['version'])
PY

# --- resources + manifest ---
"$BT/aapt2" compile --dir "$ANDROID/res" -o "$BUILD/res.zip"
"$BT/aapt2" link \
  -o "$BUILD/base.apk" \
  -I "$JAR" \
  --manifest "$ANDROID/AndroidManifest.xml" \
  -R "$BUILD/res.zip" \
  --java "$BUILD/gen" \
  --auto-add-overlay \
  --min-sdk-version 21 \
  --target-sdk-version 36 \
  --version-code "$CODE" \
  --version-name "$VERSION"

# --- Java -> DEX ---
find "$BUILD/gen" "$ANDROID/src" -name '*.java' | while IFS= read -r f; do printf '"%s"\n' "$f"; done > "$BUILD/sources.txt"
javac -source 8 -target 8 -classpath "$JAR" -d "$BUILD/classes" @"$BUILD/sources.txt"
jar cf "$BUILD/classes.jar" -C "$BUILD/classes" .
"$BT/d8" --lib "$JAR" --output "$BUILD/dex" "$BUILD/classes.jar"

# --- assemble, align, sign ---
(cd "$BUILD/dex" && zip -q "$BUILD/base.apk" classes.dex)
(cd "$BUILD" && zip -q -r "$BUILD/base.apk" assets)
"$BT/zipalign" -f -p 4 "$BUILD/base.apk" "$BUILD/aligned.apk"

mkdir -p "$(dirname "$KS")"
if [ ! -f "$KS" ]; then
  echo "Creating release keystore (keep this file safe; .gitignore excludes it)."
  keytool -genkeypair -keystore "$KS" \
    -storepass "$STOREPASS" -keypass "$STOREPASS" \
    -alias helpsetu -keyalg RSA -keysize 2048 -validity 10000 \
    -dname "CN=HelpSetu, OU=HelpSetu, O=HelpSetu, L=India, ST=India, C=IN" \
    -noprompt >/dev/null 2>&1
fi

"$BT/apksigner" sign \
  --ks "$KS" --ks-pass "pass:$STOREPASS" --key-pass "pass:$STOREPASS" \
  --out "$OUT" "$BUILD/aligned.apk"
"$BT/apksigner" verify --verbose "$OUT"

echo ""
echo "Built: $OUT"
ls -lh "$OUT"
