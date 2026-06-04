$ErrorActionPreference = "Stop"

param(
    [Parameter(Mandatory=$true)]
    [string]$BackupFile
)

$mysql = "C:\Program Files\MySQL\MySQL Server 5.7\bin\mysql.exe"

if (-not (Test-Path -LiteralPath $BackupFile)) {
    throw "Backup file not found: $BackupFile"
}

Write-Host "Restore is sensitive and may overwrite data inside the educard_secure database."
Write-Host "No restore will run without explicit confirmation."
$confirm = Read-Host "Type RESTORE-EDUCARD to continue"
if ($confirm -ne "RESTORE-EDUCARD") {
    throw "Restore cancelled."
}

$dbUser = Read-Host "MySQL user"
$securePassword = Read-Host "MySQL password" -AsSecureString
$plainPassword = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword))

try {
    $env:MYSQL_PWD = $plainPassword
    & $mysql -h localhost -P 3306 -u $dbUser --default-character-set=utf8mb4 educard_secure -e "SOURCE $BackupFile"
    if ($LASTEXITCODE -ne 0) { throw "Restore failed with exit code $LASTEXITCODE" }
    Write-Host "Restore completed."
} finally {
    Remove-Item Env:\MYSQL_PWD -ErrorAction SilentlyContinue
}
