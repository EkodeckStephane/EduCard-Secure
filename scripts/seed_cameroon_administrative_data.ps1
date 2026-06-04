$ErrorActionPreference = "Stop"

$backend = Join-Path $PSScriptRoot "..\backend"
$venvPython = Join-Path $PSScriptRoot "..\.venv\Scripts\python.exe"
$python = if (Test-Path -LiteralPath $venvPython) { (Resolve-Path $venvPython).Path } else { "python" }

Push-Location $backend
try {
    & $python scripts\seed_cameroon_administrative_data.py
    if ($LASTEXITCODE -ne 0) { throw "Cameroon administrative seed failed with exit code $LASTEXITCODE" }
} finally {
    Pop-Location
}
