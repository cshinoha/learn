<#
.SYNOPSIS
  Install and verify local NotebookLM MCP sidecar prerequisites on Windows.

.DESCRIPTION
  This script prepares the LOCAL machine that owns NotebookLM/Google auth.
  It installs uv when missing, installs notebooklm-mcp-cli as a uv tool,
  verifies `nlm` and `notebooklm-mcp`, and optionally starts login/server steps.

  It does NOT write credentials into this repository. `nlm login` stores auth in
  the user's normal local CLI/profile location.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File .\learn-anything-plugin\scripts\notebooklm\setup-local-windows.ps1

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File .\learn-anything-plugin\scripts\notebooklm\setup-local-windows.ps1 -RunLogin -StartServer
#>

[CmdletBinding()]
param(
  [int]$Port = 8000,
  [string]$Profile = "",
  [switch]$RunLogin,
  [switch]$StartServer,
  [switch]$UsePipx
)

$ErrorActionPreference = "Stop"

function Write-Step($Message) {
  Write-Host "`n==> $Message" -ForegroundColor Cyan
}

function Require-Command($Name, $InstallHint) {
  $cmd = Get-Command $Name -ErrorAction SilentlyContinue
  if (-not $cmd) {
    throw "Required command '$Name' not found. $InstallHint"
  }
  return $cmd
}

function Ensure-UserPathContains($PathToAdd) {
  $current = [Environment]::GetEnvironmentVariable("Path", "User")
  if (($current -split ';') -notcontains $PathToAdd) {
    [Environment]::SetEnvironmentVariable("Path", (($current, $PathToAdd) -ne '' -join ';'), "User")
    $env:Path = "$env:Path;$PathToAdd"
    Write-Host "Added to user PATH: $PathToAdd"
  }
}

Write-Step "Checking Python"
$python = Get-Command python -ErrorAction SilentlyContinue
if (-not $python) {
  $python = Get-Command py -ErrorAction SilentlyContinue
}
if (-not $python) {
  $winget = Get-Command winget -ErrorAction SilentlyContinue
  if ($winget) {
    Write-Host "Python not found. Installing Python via winget..."
    winget install --id Python.Python.3.12 --source winget --accept-package-agreements --accept-source-agreements
  } else {
    throw "Python not found and winget is unavailable. Install Python 3.10+ manually, then rerun."
  }
} else {
  Write-Host "Found Python launcher: $($python.Source)"
}

if ($UsePipx) {
  Write-Step "Installing notebooklm-mcp-cli with pipx"
  $pipx = Get-Command pipx -ErrorAction SilentlyContinue
  if (-not $pipx) {
    Write-Host "pipx not found. Installing pipx with Python..."
    python -m pip install --user pipx
    python -m pipx ensurepath
    Ensure-UserPathContains "$env:USERPROFILE\.local\bin"
    Ensure-UserPathContains "$env:APPDATA\Python\Python312\Scripts"
  }
  pipx install notebooklm-mcp-cli --force
} else {
  Write-Step "Installing uv if needed"
  $uv = Get-Command uv -ErrorAction SilentlyContinue
  if (-not $uv) {
    Write-Host "uv not found. Installing uv via official installer..."
    powershell -ExecutionPolicy Bypass -NoProfile -Command "irm https://astral.sh/uv/install.ps1 | iex"
    Ensure-UserPathContains "$env:USERPROFILE\.local\bin"
    Ensure-UserPathContains "$env:USERPROFILE\.cargo\bin"
    $uv = Get-Command uv -ErrorAction SilentlyContinue
    if (-not $uv) {
      throw "uv install completed but 'uv' is not on PATH. Open a new PowerShell or add the uv install directory to PATH, then rerun."
    }
  }

  Write-Step "Installing notebooklm-mcp-cli as uv tool"
  uv tool install notebooklm-mcp-cli --force
  $uvToolBin = Join-Path $env:USERPROFILE ".local\bin"
  Ensure-UserPathContains $uvToolBin
}

Write-Step "Verifying NotebookLM CLI commands"
$nlm = Require-Command "nlm" "The notebooklm-mcp-cli install did not expose 'nlm' on PATH. Open a new shell or check uv/pipx tool path."
$mcp = Require-Command "notebooklm-mcp" "The notebooklm-mcp-cli install did not expose 'notebooklm-mcp' on PATH. Open a new shell or check uv/pipx tool path."
Write-Host "nlm: $($nlm.Source)"
Write-Host "notebooklm-mcp: $($mcp.Source)"

Write-Step "Printing tool help/version probes"
nlm --help | Select-Object -First 20
notebooklm-mcp --help | Select-Object -First 30

if ($RunLogin) {
  Write-Step "Running NotebookLM login locally"
  if ($Profile -ne "") {
    nlm login --profile $Profile
    nlm login switch $Profile
  } else {
    nlm login
  }
  Write-Host "Checking login if supported..."
  try { nlm login --check } catch { Write-Warning "'nlm login --check' failed or is unsupported: $($_.Exception.Message)" }
} else {
  Write-Host "`nLogin not run. When ready, run: nlm login" -ForegroundColor Yellow
}

Write-Step "Next SSH reverse tunnel command"
Write-Host "From this local machine, after the remote host is reachable, run:" -ForegroundColor Green
Write-Host "ssh -N -R 18000:127.0.0.1:$Port <remote-host>" -ForegroundColor Green
Write-Host "Then on remote set: export NOTEBOOKLM_MCP_ENDPOINT=http://127.0.0.1:18000" -ForegroundColor Green

if ($StartServer) {
  Write-Step "Starting NotebookLM MCP HTTP server"
  Write-Host "Press Ctrl+C to stop. Keep this terminal open while remote skills use NotebookLM."
  notebooklm-mcp --transport http --port $Port
} else {
  Write-Host "`nServer not started. When ready, run:" -ForegroundColor Yellow
  Write-Host "notebooklm-mcp --transport http --port $Port" -ForegroundColor Yellow
}

Write-Host "`nLocal NotebookLM MCP setup finished." -ForegroundColor Green
