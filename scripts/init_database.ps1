$ErrorActionPreference = "Stop"

$mysql = "C:\Program Files\MySQL\MySQL Server 5.7\bin\mysql.exe"
$dbScript = Join-Path $PSScriptRoot "..\database\01_create_database.sql"
$userScript = Join-Path $PSScriptRoot "..\database\02_create_app_user_template.sql"
$grantScript = Join-Path $PSScriptRoot "..\database\03_grant_app_privileges_template.sql"

Write-Host "This script creates only the educard_secure database and dedicated application grants."
Write-Host "It does not drop databases and does not change global MySQL settings."
Write-Host "Review these files before running:"
Write-Host "  $dbScript"
Write-Host "  $userScript"
Write-Host "  $grantScript"

$confirm = Read-Host "Type INIT-EDUCARD to continue"
if ($confirm -ne "INIT-EDUCARD") {
    throw "Initialization cancelled."
}

$adminUser = Read-Host "MySQL administrative user for setup"
$securePassword = Read-Host "MySQL password" -AsSecureString
$plainPassword = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword))

try {
    $env:MYSQL_PWD = $plainPassword
    & $mysql -h localhost -P 3306 -u $adminUser --default-character-set=utf8mb4 -e "SOURCE $dbScript"
    if ($LASTEXITCODE -ne 0) { throw "Database creation failed with exit code $LASTEXITCODE" }

    Write-Host "The user and grant scripts contain password placeholders."
    Write-Host "Create local copies with a strong password and run them manually, or edit them outside Git."
    Write-Host "Template files were not executed automatically to avoid storing or echoing secrets."
} finally {
    Remove-Item Env:\MYSQL_PWD -ErrorAction SilentlyContinue
}
