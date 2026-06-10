param(
    [Parameter(Mandatory=$true)][string]$EventType,
    [Parameter(Mandatory=$true)][string]$Status,
    [string]$FileReference = "",
    [bool]$ChecksumPresent = $false,
    [long]$FileSizeBytes = 0,
    [Parameter(Mandatory=$true)][datetime]$StartedAt,
    [datetime]$FinishedAt = (Get-Date),
    [string]$Operator = "SCRIPT_AUTOMATED"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$envPath = Join-Path $PSScriptRoot "..\.env"
if (-not (Test-Path -LiteralPath $envPath)) {
    Write-Warning "Backup event not logged: .env is missing."
    return
}

$serviceToken = $null
Get-Content -LiteralPath $envPath | ForEach-Object {
    if ($_ -match '^\s*BACKUP_SERVICE_TOKEN=(.*)$') {
        $serviceToken = $matches[1].Trim()
    }
}
if (-not $serviceToken) {
    Write-Warning "Backup event not logged: BACKUP_SERVICE_TOKEN is not configured."
    return
}

$payload = @{
    event_type = $EventType
    status = $Status
    file_reference = $FileReference
    checksum_present = $ChecksumPresent
    file_size_bytes = if ($FileSizeBytes -gt 0) { $FileSizeBytes } else { $null }
    started_at = $StartedAt.ToUniversalTime().ToString("o")
    finished_at = $FinishedAt.ToUniversalTime().ToString("o")
    operator = $Operator
} | ConvertTo-Json

try {
    Invoke-RestMethod `
        -Uri "http://127.0.0.1:8000/api/v1/backups/log" `
        -Method Post `
        -Headers @{ "X-Service-Token" = $serviceToken } `
        -ContentType "application/json" `
        -Body $payload `
        -TimeoutSec 10 | Out-Null
} catch {
    Write-Warning "Backup operation completed, but its event could not be logged: $($_.Exception.Message)"
}
