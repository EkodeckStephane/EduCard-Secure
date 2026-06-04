Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot
$Python = Join-Path $Root ".venv\Scripts\python.exe"

if (-not (Test-Path $Python)) {
    throw "Python virtual environment not found: $Python"
}

Push-Location (Join-Path $Root "backend")
try {
    & $Python "scripts\generate_dev_qr_keys.py"
    if ($LASTEXITCODE -ne 0) {
        throw "QR key generation failed with exit code $LASTEXITCODE"
    }
}
finally {
    Pop-Location
}
