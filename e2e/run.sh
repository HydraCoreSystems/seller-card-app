#!/usr/bin/env bash
# Runs the emulator pass on a booted emulator and gathers everything into shots/<profile>/:
# the flow's screenshots, the images the app saved to the gallery, and the app's log.
set -u
PROFILE="$1"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/shots/$PROFILE"
mkdir -p "$OUT/saved"

adb install -r "$ROOT/apk/app.apk"
adb shell mkdir -p /sdcard/Pictures
adb push "$ROOT/e2e/plant-photo.jpg" /sdcard/Pictures/plant-photo.jpg
adb shell content call --method scan_volume --uri content://media --arg external_primary || true
adb shell am broadcast -a android.intent.action.MEDIA_SCANNER_SCAN_FILE -d file:///sdcard/Pictures/plant-photo.jpg || true
{ adb shell wm size; adb shell wm density; } > "$OUT/screen.txt"
adb logcat -c

cd "$OUT"
status=0
maestro test --debug-output "$OUT/debug" "$ROOT/e2e/sample-pass.yaml" || status=$?

# Screenshots land beside the flow or in the working directory, depending on the Maestro version.
find "$ROOT/e2e" "$ROOT" -maxdepth 1 -name 'shot-*.png' -exec mv {} "$OUT/" \; 2>/dev/null || true

for f in $(adb shell find /sdcard/DCIM /sdcard/Pictures -type f -newer /sdcard/Pictures/plant-photo.jpg 2>/dev/null | tr -d '\r'); do
  adb pull "$f" "$OUT/saved/" || true
done
adb logcat -d -s ReactNativeJS:V AndroidRuntime:E > "$OUT/logcat.txt" || true
ls -laR "$OUT"
exit $status
