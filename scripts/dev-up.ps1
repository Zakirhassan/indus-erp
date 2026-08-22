# Thin wrapper so `.\scripts\dev-up.ps1` works from PowerShell.
# The real cross-platform implementation lives in scripts/dev-up.mjs
# (invoked here, and also directly via `npm run dev:up`).
$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
node "$ScriptDir/dev-up.mjs" @args
exit $LASTEXITCODE
