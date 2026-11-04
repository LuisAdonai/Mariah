#!/usr/bin/env bash
# Prepares a native NSIS toolchain for building the Windows installer on Linux/ARM64 hosts (no Wine).
set -e
D=${ELECTRON_BUILDER_NSIS_DIR:-/opt/nsis-custom}
command -v makensis >/dev/null || (sudo apt-get update -qq && sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq nsis)
S=$(ls -d "$HOME"/.cache/electron-builder/nsis/nsis-3* 2>/dev/null | head -1)
if [ -z "$S" ]; then
  S="$HOME/.cache/electron-builder/nsis/nsis-3.0.4.1"
  Z=$(find "$(dirname "$0")/../node_modules/7zip-bin" -path "*linux/$(uname -m | sed 's/aarch64/arm64/;s/x86_64/x64/')/7za" | head -1)
  chmod +x "$Z"; mkdir -p "$S"
  curl -sL -o /tmp/nsis.7z https://github.com/electron-userland/electron-builder-binaries/releases/download/nsis-3.0.4.1/nsis-3.0.4.1.7z
  "$Z" x -y -o"$S" /tmp/nsis.7z >/dev/null
  rm -rf "$D"
fi
if [ -f "$D/elevate.exe" ] && [ -e "$D/linux/makensis" ]; then exit 0; fi
rm -rf "$D"; sudo mkdir -p "$(dirname "$D")"; sudo cp -r /usr/share/nsis "$D"; sudo chown -R "$(id -u)" "$D"
cp -rn "$S"/Plugins/* "$D"/Plugins/; cp -rn "$S"/Include/* "$D"/Include/
cp -n "$S"/elevate.exe "$D"/ ; [ -f "$S"/nsisconf.nsh ] && cp -n "$S"/nsisconf.nsh "$D"/ || true
mkdir -p "$D"/linux && ln -sf "$(command -v makensis)" "$D"/linux/makensis
echo "NSIS toolchain ready at $D"
