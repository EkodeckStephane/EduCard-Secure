$ErrorActionPreference = "Stop"

Write-Host "This loads only synthetic demonstration data."
$confirm = Read-Host "Type SEED-DEMO to continue"
if ($confirm -ne "SEED-DEMO") {
    throw "Demo seed cancelled."
}

$env:PYTHONPATH = (Resolve-Path (Join-Path $PSScriptRoot "..\backend")).Path
$venvPython = Join-Path $PSScriptRoot "..\.venv\Scripts\python.exe"
$python = if (Test-Path -LiteralPath $venvPython) { (Resolve-Path $venvPython).Path } else { "python" }
& $python (Join-Path $PSScriptRoot "..\backend\scripts\seed_demo_data.py")
if ($LASTEXITCODE -ne 0) { throw "Demo seed failed with exit code $LASTEXITCODE" }
