#!/bin/zsh
# deploy-all.sh — build Bloom once and install it on EVERY booted simulator,
# so no device is ever left running an old build. Run from anywhere:
#
#   ios/tools/deploy-all.sh
#
# (Running from Xcode with ⌘R also always uses the newest code — this script
# is for refreshing simulators without opening Xcode.)
set -e
export DEVELOPER_DIR=${DEVELOPER_DIR:-/Applications/Xcode.app/Contents/Developer}
cd "$(dirname "$0")/.."

echo "building…"
xcodebuild -project Bloom.xcodeproj -scheme Bloom -configuration Debug \
  -destination 'generic/platform=iOS Simulator' -derivedDataPath /tmp/bloom-dd build 2>&1 | tail -2

APP=/tmp/bloom-dd/Build/Products/Debug-iphonesimulator/Bloom.app
xcrun simctl list devices booted | grep -oE '\([0-9A-F-]{36}\)' | tr -d '()' | while read -r udid; do
  name=$(xcrun simctl list devices | grep "$udid" | sed 's/ (.*//' | head -1 | xargs)
  if xcrun simctl install "$udid" "$APP" 2>/dev/null; then
    echo "installed on $name"
  else
    echo "skipped $name (not an iOS device)"
  fi
done
echo "done — every booted simulator is on the latest build."
