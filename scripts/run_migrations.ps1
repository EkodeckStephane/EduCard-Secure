$ErrorActionPreference = "Stop"

$backend = Join-Path $PSScriptRoot "..\backend"
$venvPython = Join-Path $PSScriptRoot "..\.venv\Scripts\python.exe"
$python = if (Test-Path -LiteralPath $venvPython) { (Resolve-Path $venvPython).Path } else { "python" }

if (-not (Test-Path -LiteralPath (Join-Path $PSScriptRoot "..\.env"))) {
    throw ".env not found. Create it locally from .env.example before running migrations."
}

Push-Location $backend
try {
    & $python -m alembic -c alembic.ini upgrade head
    if ($LASTEXITCODE -ne 0) { throw "Alembic migration failed with exit code $LASTEXITCODE" }
} finally {
    Pop-Location
}
