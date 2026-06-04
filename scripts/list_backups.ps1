Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$backupDir = Join-Path $PSScriptRoot "..\backups"
if (-not (Test-Path -LiteralPath $backupDir)) {
    Write-Host "No backup directory found."
    return
}

Get-ChildItem -LiteralPath $backupDir -Filter "educard_secure_*.sql" |
    Sort-Object LastWriteTime -Descending |
    Select-Object Name, Length, LastWriteTime, @{Name="HasHash";Expression={ Test-Path -LiteralPath "$($_.FullName).sha256" }} |
    Format-Table -AutoSize
