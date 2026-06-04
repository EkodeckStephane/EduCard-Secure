param(
    [switch]$UseEnvFile
)

Set-StrictMode -Version Latest
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

if ($UseEnvFile) {
    $envPath = Join-Path $PSScriptRoot "..\.env"
    if (-not (Test-Path -LiteralPath $envPath)) { throw ".env not found for local backup." }
    $pairs = @{}
    Get-Content -LiteralPath $envPath | ForEach-Object {
        if ($_ -match '^\s*([^#=]+)=(.*)$') { $pairs[$matches[1].Trim()] = $matches[2].Trim() }
    }
    $dbUser = $pairs["DATABASE_USER"]
    $plainPassword = $pairs["DATABASE_PASSWORD"]
    if (-not $dbUser) { throw "DATABASE_USER missing in .env" }
} else {
    $dbUser = Read-Host "MySQL user"
    $securePassword = Read-Host "MySQL password" -AsSecureString
    $plainPassword = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword))
}

try {
    $env:MYSQL_PWD = $plainPassword
    & $mysqldump -h localhost -P 3306 -u $dbUser --single-transaction --skip-lock-tables --no-tablespaces --routines --triggers --default-character-set=utf8mb4 educard_secure --result-file=$output
    if ($LASTEXITCODE -ne 0) { throw "Backup failed with exit code $LASTEXITCODE" }
    $hash = Get-FileHash -Algorithm SHA256 -LiteralPath $output
    $hashPath = "$output.sha256"
    Set-Content -LiteralPath $hashPath -Value "$($hash.Hash)  $(Split-Path -Leaf $output)" -Encoding ASCII -NoNewline
    Write-Host "Backup written to $output"
    Write-Host "SHA256 written to $hashPath"
} finally {
    Remove-Item Env:\MYSQL_PWD -ErrorAction SilentlyContinue
}
