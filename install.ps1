# MoerAI/opencode-anthropic-auth installer for Windows
# Patches opencode's built-in anthropic auth to fix 429 token exchange errors
# Run: powershell -ExecutionPolicy Bypass -File install.ps1

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$Bundle = Join-Path $ScriptDir "index.mjs"

Write-Host "Installing MoerAI/opencode-anthropic-auth for Windows..."

# Verify bundle exists
if (-not (Test-Path $Bundle)) {
    Write-Host "ERROR: index.mjs not found in $ScriptDir" -ForegroundColor Red
    Write-Host "Run: cd $ScriptDir && bun install && bun run script/bundle.ts && cp dist-bundle/index.js index.mjs"
    exit 1
}

# Determine cache path
# Windows: %LOCALAPPDATA%\opencode\node_modules\... or %USERPROFILE%\.cache\opencode\...
$CacheDir = $null

# Try LOCALAPPDATA first (Windows standard)
$LocalAppData = $env:LOCALAPPDATA
if ($LocalAppData) {
    $CacheDir = Join-Path $LocalAppData "opencode\node_modules\opencode-anthropic-auth"
}

# Fallback to ~/.cache (some opencode versions use this)
if (-not $CacheDir -or -not (Test-Path (Split-Path $CacheDir -Parent))) {
    $CacheDir = Join-Path $env:USERPROFILE ".cache\opencode\node_modules\opencode-anthropic-auth"
}

# Also check if opencode uses AppData\Roaming
$RoamingCache = Join-Path $env:APPDATA "opencode\node_modules\opencode-anthropic-auth"

$CacheTarget = Join-Path $CacheDir "index.mjs"

# Patch cache - try all possible locations
$Patched = $false
foreach ($Dir in @($CacheDir, $RoamingCache)) {
    $Target = Join-Path $Dir "index.mjs"
    $ParentDir = Split-Path $Target -Parent

    # Only patch if the directory already exists (opencode created it)
    if (Test-Path $ParentDir) {
        Copy-Item -Path $Bundle -Destination $Target -Force
        Write-Host "  [OK] Patched $Target" -ForegroundColor Green
        $Patched = $true
    }
}

# If no existing cache found, create the default one
if (-not $Patched) {
    New-Item -ItemType Directory -Path $CacheDir -Force | Out-Null
    Copy-Item -Path $Bundle -Destination $CacheTarget -Force
    Write-Host "  [OK] Patched $CacheTarget" -ForegroundColor Green
}

# Add auto-patch to PowerShell profile
$ProfilePath = $PROFILE.CurrentUserAllHosts
if (-not $ProfilePath) {
    $ProfilePath = $PROFILE
}

$Marker = "# auto-patch anthropic auth"
$ProfileExists = Test-Path $ProfilePath
$AlreadyPatched = $false

if ($ProfileExists) {
    $ProfileContent = Get-Content $ProfilePath -Raw -ErrorAction SilentlyContinue
    if ($ProfileContent -and $ProfileContent.Contains($Marker)) {
        $AlreadyPatched = $true
    }
}

if (-not $AlreadyPatched) {
    if (-not $ProfileExists) {
        New-Item -ItemType File -Path $ProfilePath -Force | Out-Null
    }

    $PatchBlock = @"

# auto-patch anthropic auth on every PowerShell start
`$_ocAuthSrc = Join-Path `$env:USERPROFILE ".config\opencode\opencode-anthropic-auth\index.mjs"
`$_ocAuthDst = Join-Path (`$env:LOCALAPPDATA ?? (Join-Path `$env:USERPROFILE ".cache")) "opencode\node_modules\opencode-anthropic-auth\index.mjs"
if (Test-Path `$_ocAuthSrc) {
    `$dstDir = Split-Path `$_ocAuthDst -Parent
    if (-not (Test-Path `$dstDir)) { New-Item -ItemType Directory -Path `$dstDir -Force | Out-Null }
    Copy-Item -Path `$_ocAuthSrc -Destination `$_ocAuthDst -Force -ErrorAction SilentlyContinue
}
Remove-Variable _ocAuthSrc, _ocAuthDst -ErrorAction SilentlyContinue
"@

    Add-Content -Path $ProfilePath -Value $PatchBlock
    Write-Host "  [OK] Added auto-patch to $ProfilePath" -ForegroundColor Green
} else {
    Write-Host "  [OK] Auto-patch already in $ProfilePath" -ForegroundColor Green
}

Write-Host ""
Write-Host "Done! Run: opencode auth login -> Anthropic -> Claude Pro/Max"
Write-Host ""
Write-Host "Note: Open a new PowerShell window to activate auto-patch." -ForegroundColor Yellow
