$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$backend = Join-Path $root "backend"
$frontend = Join-Path $root "frontend"
$python = Join-Path $root ".venv\Scripts\python.exe"

if (-not (Test-Path -LiteralPath $python)) {
    $python = "python"
}

function Invoke-Step {
    param(
        [Parameter(Mandatory = $true)][string]$Name,
        [Parameter(Mandatory = $true)][scriptblock]$Command
    )
    Write-Host "== $Name =="
    & $Command
    if ($LASTEXITCODE -ne 0) {
        throw "$Name failed with exit code $LASTEXITCODE"
    }
}

Invoke-Step "Alembic current" { Push-Location $backend; try { & $python -m alembic -c alembic.ini current } finally { Pop-Location } }
Invoke-Step "Backend tests" { Push-Location $backend; try { & $python -m pytest -q } finally { Pop-Location } }
Invoke-Step "Frontend lint" { Push-Location $frontend; try { & npm.cmd run lint } finally { Pop-Location } }
Invoke-Step "Frontend tests" { Push-Location $frontend; try { & npm.cmd run test } finally { Pop-Location } }
Invoke-Step "Frontend build" { Push-Location $frontend; try { & npm.cmd run build } finally { Pop-Location } }
Invoke-Step "Secret scan" {
    Push-Location $root
    try {
        $secretPattern = @(
            ("DATABASE" + "_PASSWORD=.+"),
            ("SECRET" + "_KEY=.+"),
            ("FIELD" + "_ENCRYPTION_KEY=.+"),
            ("BEGIN " + "PRIVATE"),
            ("BEGIN " + "RSA"),
            ("AK" + "IA"),
            ("AI" + "za"),
            ("sk" + "-[A-Za-z0-9]")
        ) -join "|"
        & rg -n $secretPattern .env.example backend database scripts docs frontend -g "!*__pycache__*" -g "!*.pyc" -g "!dist/**" -g "!node_modules/**"
        if ($LASTEXITCODE -eq 1) { $global:LASTEXITCODE = 0 }
    } finally {
        Pop-Location
    }
}
Invoke-Step "Git sensitive files" { Push-Location $root; try { & git ls-files backups private exports logs secrets *.pem *.key } finally { Pop-Location } }
Invoke-Step "Git status" { Push-Location $root; try { & git status --short } finally { Pop-Location } }

Write-Host "All checks completed."
