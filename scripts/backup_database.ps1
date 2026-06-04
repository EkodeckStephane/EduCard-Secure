$ErrorActionPreference = "Stop"

$mysqldump = "C:\Program Files\MySQL\MySQL Server 5.7\bin\mysqldump.exe"
$backupDir = Join-Path $PSScriptRoot "..\backups"
New-Item -ItemType Directory -Force $backupDir | Out-Null

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$output = Join-Path $backupDir "educard_secure_$timestamp.sql"

if (Test-Path -LiteralPath $output) {
    $confirm = Read-Host "Backup file exists. Type OVERWRITE to replace"
    if ($confirm -ne "OVERWRITE") { throw "Backup cancelled." }
}

$dbUser = Read-Host "MySQL user"
$securePassword = Read-Host "MySQL password" -AsSecureString
$plainPassword = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword))

try {
    $env:MYSQL_PWD = $plainPassword
    & $mysqldump -h localhost -P 3306 -u $dbUser --single-transaction --skip-lock-tables --no-tablespaces --routines --triggers --default-character-set=utf8mb4 educard_secure --result-file=$output
    if ($LASTEXITCODE -ne 0) { throw "Backup failed with exit code $LASTEXITCODE" }
    Write-Host "Backup written to $output"
} finally {
    Remove-Item Env:\MYSQL_PWD -ErrorAction SilentlyContinue
}
