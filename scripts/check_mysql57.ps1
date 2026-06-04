$ErrorActionPreference = "Stop"

$mysqlDefault = "C:\Program Files\MySQL\MySQL Server 5.7\bin\mysql.exe"
$mysqldumpDefault = "C:\Program Files\MySQL\MySQL Server 5.7\bin\mysqldump.exe"

Write-Host "Checking MySQL 5.7 local tools..."

if (-not (Test-Path -LiteralPath $mysqlDefault)) {
    throw "mysql.exe not found at $mysqlDefault"
}

if (-not (Test-Path -LiteralPath $mysqldumpDefault)) {
    throw "mysqldump.exe not found at $mysqldumpDefault"
}

& $mysqlDefault --version
if ($LASTEXITCODE -ne 0) { throw "mysql.exe --version failed with exit code $LASTEXITCODE" }

& $mysqldumpDefault --version
if ($LASTEXITCODE -ne 0) { throw "mysqldump.exe --version failed with exit code $LASTEXITCODE" }

$port = Get-NetTCPConnection -State Listen -LocalPort 3306 -ErrorAction SilentlyContinue |
    Select-Object -First 1 -Property LocalAddress,LocalPort,State,OwningProcess

if ($port) {
    $port | Format-List
} else {
    Write-Warning "No listening socket detected on port 3306 through Get-NetTCPConnection. This does not modify MySQL."
}

Write-Host "MySQL tool check completed."
