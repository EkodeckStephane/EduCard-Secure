param(
    [Parameter(Mandatory=$true)]
    [string]$BackupFile
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$startedAt = Get-Date

$mysql = "C:\Program Files\MySQL\MySQL Server 5.7\bin\mysql.exe"

if (-not (Test-Path -LiteralPath $BackupFile)) {
    throw "Backup file not found: $BackupFile"
}

$hashFile = "$BackupFile.sha256"
if (Test-Path -LiteralPath $hashFile) {
    $expected = ((Get-Content -LiteralPath $hashFile -Raw) -split "\s+")[0]
    $actual = (Get-FileHash -Algorithm SHA256 -LiteralPath $BackupFile).Hash
    if ($actual -ne $expected) {
        throw "Backup hash verification failed."
    }
    Write-Host "Backup hash verified."
} else {
    Write-Host "No .sha256 file found. Continue only after manual verification."
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
    & (Join-Path $PSScriptRoot "log_backup_event.ps1") `
        -EventType "BACKUP_RESTORED" -Status "RESTORE_COMPLETED" `
        -FileReference ([IO.Path]::GetFileNameWithoutExtension($BackupFile)) `
        -ChecksumPresent (Test-Path -LiteralPath $hashFile) `
        -FileSizeBytes (Get-Item -LiteralPath $BackupFile).Length `
        -StartedAt $startedAt -FinishedAt (Get-Date)
} catch {
    & (Join-Path $PSScriptRoot "log_backup_event.ps1") `
        -EventType "BACKUP_FAILED" -Status "FAILED" `
        -FileReference ([IO.Path]::GetFileNameWithoutExtension($BackupFile)) `
        -ChecksumPresent (Test-Path -LiteralPath $hashFile) `
        -FileSizeBytes (Get-Item -LiteralPath $BackupFile).Length `
        -StartedAt $startedAt -FinishedAt (Get-Date)
    throw
} finally {
    Remove-Item Env:\MYSQL_PWD -ErrorAction SilentlyContinue
}
