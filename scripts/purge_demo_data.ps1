$ErrorActionPreference = "Stop"

Write-Host "This removes only rows marked as demonstration data."
Write-Host "Core roles, permissions and settings are preserved."
$confirm = Read-Host "Type PURGE-DEMO to continue"
if ($confirm -ne "PURGE-DEMO") {
    throw "Demo purge cancelled."
}

$env:PYTHONPATH = (Resolve-Path (Join-Path $PSScriptRoot "..\backend")).Path
$venvPython = Join-Path $PSScriptRoot "..\.venv\Scripts\python.exe"
$python = if (Test-Path -LiteralPath $venvPython) { (Resolve-Path $venvPython).Path } else { "python" }
& $python (Join-Path $PSScriptRoot "..\backend\scripts\purge_demo_data.py")
if ($LASTEXITCODE -ne 0) { throw "Demo purge failed with exit code $LASTEXITCODE" }
