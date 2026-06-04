$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath (Join-Path $PSScriptRoot "..\.env"))) {
    throw ".env not found. Create it locally from .env.example before seeding."
}

$env:PYTHONPATH = (Resolve-Path (Join-Path $PSScriptRoot "..\backend")).Path
$venvPython = Join-Path $PSScriptRoot "..\.venv\Scripts\python.exe"
$python = if (Test-Path -LiteralPath $venvPython) { (Resolve-Path $venvPython).Path } else { "python" }
& $python (Join-Path $PSScriptRoot "..\backend\scripts\seed_initial_data.py")
if ($LASTEXITCODE -ne 0) { throw "Initial seed failed with exit code $LASTEXITCODE" }
