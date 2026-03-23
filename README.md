# OpenCode Anthropic Auth Plugin (MoerAI Fork)

Forked from [ex-machina-co/opencode-anthropic-auth](https://github.com/ex-machina-co/opencode-anthropic-auth) to fix **OAuth token exchange 429 errors**.

## What This Fork Fixes

The upstream plugin has two bugs that cause `Failed to authorize` / `Token refresh failed: 429`:

1. **Wrong `Content-Type`**: Token exchange and refresh send `application/json`, but Anthropic's `/v1/oauth/token` expects `application/x-www-form-urlencoded` (OAuth 2.0 RFC 6749 §4.1.3)
2. **Missing `User-Agent`**: Anthropic rate-limits token requests without `claude-cli/2.1.2 (external, cli)` User-Agent header. The upstream plugin sets this for API calls but omits it from token exchange/refresh

> **Note (2026-03):** The upstream has been republished as `@ex-machina/opencode-anthropic-auth@0.1.0` but the same two bugs remain. This fork patches both the old (`opencode-anthropic-auth`) and the new (`@ex-machina/opencode-anthropic-auth`) cache paths.

## Important: `opencode.json` Plugin Path

If you reference this plugin via `file://` in your `opencode.json`, you **must** point to the single-file bundle (`index.mjs`), **not** `dist/index.js`. The split `dist/` files use extensionless ESM imports (`import './auth'`) which fail under Node.js ESM resolution:

```jsonc
// ✅ Correct — single-file bundle, no import resolution issues
"plugin": ["file:///path/to/opencode-anthropic-auth/index.mjs"]

// ❌ Wrong — dist/index.js imports ./auth which Node.js cannot resolve without .js extension
"plugin": ["file:///path/to/opencode-anthropic-auth/dist/index.js"]
```

## Installation

### macOS / Ubuntu (Linux)

```bash
# 1. Clone this fork
git clone https://github.com/MoerAI/opencode-anthropic-auth.git ~/.config/opencode/opencode-anthropic-auth

# 2. Run installer (patches cache + adds auto-patch to shell rc)
bash ~/.config/opencode/opencode-anthropic-auth/install.sh

# 3. Login
opencode auth login  # → Anthropic → Claude Pro/Max
```

### Windows (PowerShell)

```powershell
# 1. Clone this fork
git clone https://github.com/MoerAI/opencode-anthropic-auth.git "$env:USERPROFILE\.config\opencode\opencode-anthropic-auth"

# 2. Run installer (patches cache + adds auto-patch to PowerShell profile)
powershell -ExecutionPolicy Bypass -File "$env:USERPROFILE\.config\opencode\opencode-anthropic-auth\install.ps1"

# 3. Login
opencode auth login  # → Anthropic → Claude Pro/Max
```

### Why Patching the Cache?

opencode bundles the auth plugin as an internal `BUILTIN` plugin. It installs to a cache directory and **ignores** any version in `~/.config/opencode/node_modules/`. The only way to override it is to replace the cached files directly.

| OS | Old Cache Path | New Cache Path (`@ex-machina`) |
|----|---------------|-------------------------------|
| macOS | `~/.cache/opencode/node_modules/opencode-anthropic-auth/index.mjs` | `~/.cache/opencode/node_modules/@ex-machina/opencode-anthropic-auth/dist/{auth,index}.js` |
| Ubuntu/Linux | Same (or `$XDG_CACHE_HOME/...`) | Same (or `$XDG_CACHE_HOME/...`) |
| Windows | `%LOCALAPPDATA%\opencode\node_modules\opencode-anthropic-auth\index.mjs` | `%LOCALAPPDATA%\opencode\node_modules\@ex-machina\opencode-anthropic-auth\dist\{auth,index}.js` |

### Auto-Patch

The installer automatically adds an auto-patch hook to your shell:

- **macOS**: `~/.zshrc`
- **Ubuntu/Linux**: `~/.bashrc`
- **Windows**: PowerShell profile (`$PROFILE`)

This ensures the patch survives `opencode upgrade`.

## File Structure

```
index.mjs              # Single-file bundle (deploy this to old cache path)
ex-machina-dist/       # Patched dist files for @ex-machina cache path
  auth.js              # OAuth authorize + exchange (FIXED)
  index.js             # Plugin entry, token refresh (FIXED)
dist/                  # TypeScript compiled output
dist-bundle/           # Bun-bundled single file
src/                   # TypeScript source
  auth.ts              # OAuth authorize + exchange (FIXED)
  index.ts             # Plugin entry, token refresh (FIXED)
  constants.ts         # CLIENT_ID, beta headers
  transform.ts         # Request headers, URL rewrite, tool prefix
  tests/               # Test suite (59 tests)
```

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| `Failed to authorize` on login | Cache not patched | Run `install.sh` or manual `cp` |
| `Token refresh failed: 429` | Cache reset by `opencode upgrade` | Re-run installer or open new terminal (auto-patch) |
| Login works but stops next day | Access token expired, refresh still works | opencode auto-refreshes; if 429, re-patch cache |
| Patch reverts after `bun install` | `~/.config/opencode/node_modules` is not what opencode reads | Always patch `~/.cache/opencode/node_modules` |
| "Claude Pro/Max" option missing | `opencode.json` plugin points to `dist/index.js` | Change to `index.mjs` bundle (see above) |
| Plugin loads but no auth methods | `@ex-machina` built-in overrides user plugin | Patch both old and new cache paths |

## Development

```bash
bun install
bun test           # 59 tests
bun run build      # TypeScript → dist/
bun run script/bundle.ts  # → dist-bundle/index.js (single file)
cp dist-bundle/index.js index.mjs  # Update the deployable bundle
```

## License

MIT
