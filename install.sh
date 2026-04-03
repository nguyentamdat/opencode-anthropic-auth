#!/bin/bash
# nguyentamdat/opencode-anthropic-auth installer
# Patches opencode's built-in anthropic auth to fix 429 token exchange errors
# Supports: macOS, Ubuntu/Linux

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BUNDLE="$SCRIPT_DIR/index.mjs"

# Detect OS
OS="$(uname -s)"
case "$OS" in
  Darwin) PLATFORM="macOS" ;;
  Linux)  PLATFORM="Linux" ;;
  *)      echo "ERROR: Unsupported OS: $OS (use install.ps1 for Windows)"; exit 1 ;;
esac

echo "Installing nguyentamdat/opencode-anthropic-auth for $PLATFORM..."

# Verify bundle exists
if [ ! -f "$BUNDLE" ]; then
  echo "ERROR: index.mjs not found in $SCRIPT_DIR"
  echo "Run: cd $SCRIPT_DIR && bun install && bun run script/bundle.ts && cp dist-bundle/index.js index.mjs"
  exit 1
fi

# Determine cache base
CACHE_BASE="$HOME/.cache/opencode/node_modules"
if [ -n "$XDG_CACHE_HOME" ]; then
  CACHE_BASE="$XDG_CACHE_HOME/opencode/node_modules"
fi

# Patch old path: opencode-anthropic-auth (single bundle)
CACHE_DIR="$CACHE_BASE/opencode-anthropic-auth"
mkdir -p "$CACHE_DIR"
cp -f "$BUNDLE" "$CACHE_DIR/index.mjs"
echo "  [OK] Patched $CACHE_DIR/index.mjs"

# Patch new path: @ex-machina/opencode-anthropic-auth (split dist)
EX_CACHE_DIR="$CACHE_BASE/@ex-machina/opencode-anthropic-auth/dist"
EX_SRC_DIR="$SCRIPT_DIR/ex-machina-dist"
if [ -d "$EX_SRC_DIR" ] && [ -d "$(dirname "$EX_CACHE_DIR")" ]; then
  mkdir -p "$EX_CACHE_DIR"
  cp -f "$EX_SRC_DIR/auth.js" "$EX_CACHE_DIR/auth.js"
  cp -f "$EX_SRC_DIR/index.js" "$EX_CACHE_DIR/index.js"
  echo "  [OK] Patched $EX_CACHE_DIR/{auth,index}.js"
fi

# Determine shell rc file
SHELL_RC=""
if [ -f "$HOME/.zshrc" ]; then
  SHELL_RC="$HOME/.zshrc"
elif [ -f "$HOME/.bashrc" ]; then
  SHELL_RC="$HOME/.bashrc"
elif [ "$PLATFORM" = "Linux" ]; then
  # Ubuntu defaults to bash
  SHELL_RC="$HOME/.bashrc"
  touch "$SHELL_RC"
else
  SHELL_RC="$HOME/.zshrc"
  touch "$SHELL_RC"
fi

# Add auto-patch to shell rc
MARKER="# auto-patch anthropic auth"
if ! grep -q "$MARKER" "$SHELL_RC" 2>/dev/null; then
  cat >> "$SHELL_RC" << 'PATCH'

# auto-patch anthropic auth on every shell start (both old and new package paths)
_OC_AUTH_CFG="$HOME/.config/opencode/opencode-anthropic-auth"
_OC_AUTH_CACHE="${XDG_CACHE_HOME:-$HOME/.cache}/opencode/node_modules"
# patch old: opencode-anthropic-auth (single bundle)
if [ -f "$_OC_AUTH_CFG/index.mjs" ]; then
  mkdir -p "$_OC_AUTH_CACHE/opencode-anthropic-auth" 2>/dev/null
  cp -f "$_OC_AUTH_CFG/index.mjs" "$_OC_AUTH_CACHE/opencode-anthropic-auth/index.mjs" 2>/dev/null
fi
# patch new: @ex-machina/opencode-anthropic-auth (split dist)
if [ -d "$_OC_AUTH_CFG/ex-machina-dist" ]; then
  mkdir -p "$_OC_AUTH_CACHE/@ex-machina/opencode-anthropic-auth/dist" 2>/dev/null
  cp -f "$_OC_AUTH_CFG/ex-machina-dist/auth.js" "$_OC_AUTH_CACHE/@ex-machina/opencode-anthropic-auth/dist/auth.js" 2>/dev/null
  cp -f "$_OC_AUTH_CFG/ex-machina-dist/index.js" "$_OC_AUTH_CACHE/@ex-machina/opencode-anthropic-auth/dist/index.js" 2>/dev/null
fi
unset _OC_AUTH_CFG _OC_AUTH_CACHE
PATCH
  echo "  [OK] Added auto-patch to $SHELL_RC"
else
  echo "  [OK] Auto-patch already in $SHELL_RC — please verify it covers both old and new paths"
fi

echo ""
echo "Done! Run: opencode auth login -> Anthropic -> Claude Pro/Max"
echo ""
echo "Note: Open a new terminal or run 'source $SHELL_RC' to activate auto-patch."
