param(
    [Parameter(Mandatory=$true)]
    [string]$BackupFile
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$startedAt = Get-Date

if (-not (Test-Path -LiteralPath $BackupFile)) {
    throw "Backup file not found: $BackupFile"
}

$hashFile = "$BackupFile.sha256"
if (-not (Test-Path -LiteralPath $hashFile)) {
    throw "Hash file not found: $hashFile"
}

$expected = ((Get-Content -LiteralPath $hashFile -Raw) -split "\s+")[0]
$actual = (Get-FileHash -Algorithm SHA256 -LiteralPath $BackupFile).Hash

if ($actual -ne $expected) {
    & (Join-Path $PSScriptRoot "log_backup_event.ps1") `
        -EventType "BACKUP_VERIFIED" -Status "CHECKSUM_FAILED" `
        -FileReference ([IO.Path]::GetFileNameWithoutExtension($BackupFile)) `
        -ChecksumPresent $true -FileSizeBytes (Get-Item -LiteralPath $BackupFile).Length `
        -StartedAt $startedAt -FinishedAt (Get-Date)
    throw "Backup hash mismatch. Expected $expected but got $actual"
}

Write-Host "Backup hash verified: $BackupFile"
& (Join-Path $PSScriptRoot "log_backup_event.ps1") `
    -EventType "BACKUP_VERIFIED" -Status "CHECKSUM_OK" `
    -FileReference ([IO.Path]::GetFileNameWithoutExtension($BackupFile)) `
    -ChecksumPresent $true -FileSizeBytes (Get-Item -LiteralPath $BackupFile).Length `
    -StartedAt $startedAt -FinishedAt (Get-Date)
