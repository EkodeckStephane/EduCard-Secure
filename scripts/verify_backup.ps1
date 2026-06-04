param(
    [Parameter(Mandatory=$true)]
    [string]$BackupFile
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

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
    throw "Backup hash mismatch. Expected $expected but got $actual"
}

Write-Host "Backup hash verified: $BackupFile"
