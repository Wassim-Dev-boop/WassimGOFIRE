param(
    [string]$GatewayUrl = "http://localhost:8088",
    [string]$KeycloakUrl = "http://localhost:8090",
    [string]$Realm = "cnstn-intranet",
    [string]$ClientId = "cnstn-postman",
    [string]$OutputFile = "test-reports/role-matrix-report.json"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$users = @(
    [PSCustomObject]@{ Username = "admin.cnstn"; Password = "Admin@12345"; Role = "ADMIN"; CanReadAdminUsers = $true; CanReadKpi = $true },
    [PSCustomObject]@{ Username = "employe.cnstn"; Password = "User@12345"; Role = "EMPLOYE"; CanReadAdminUsers = $false; CanReadKpi = $false },
    [PSCustomObject]@{ Username = "chef.cnstn"; Password = "User@12345"; Role = "CHEF_HIERARCHIQUE"; CanReadAdminUsers = $false; CanReadKpi = $false },
    [PSCustomObject]@{ Username = "salle.cnstn"; Password = "User@12345"; Role = "RESPONSABLE_SALLE"; CanReadAdminUsers = $false; CanReadKpi = $false },
    [PSCustomObject]@{ Username = "securite.cnstn"; Password = "User@12345"; Role = "RESPONSABLE_SECURITE"; CanReadAdminUsers = $false; CanReadKpi = $false },
    [PSCustomObject]@{ Username = "directeur.cnstn"; Password = "User@12345"; Role = "DIRECTEUR_DSN"; CanReadAdminUsers = $false; CanReadKpi = $true },
    [PSCustomObject]@{ Username = "qualite.cnstn"; Password = "User@12345"; Role = "RESPONSABLE_QUALITE"; CanReadAdminUsers = $false; CanReadKpi = $false }
)

function Get-Token {
    param(
        [Parameter(Mandatory = $true)][string]$Username,
        [Parameter(Mandatory = $true)][string]$Password
    )

    $response = Invoke-RestMethod -Method Post -Uri "$GatewayUrl/api/v1/auth/login" -Body (@{
        identifier = $Username
        password = $Password
    } | ConvertTo-Json -Depth 5) -ContentType "application/json"

    return $response.access_token
}

function Get-StatusCode {
    param(
        [Parameter(Mandatory = $true)][string]$Method,
        [Parameter(Mandatory = $true)][string]$Url,
        [Parameter(Mandatory = $true)][string]$Token
    )

    $headers = @{
        Authorization = "Bearer $Token"
    }

    try {
        Invoke-WebRequest -Method $Method -Uri $Url -Headers $headers -UseBasicParsing | Out-Null
        return 200
    } catch {
        if ($_.Exception.Response -and $_.Exception.Response.StatusCode) {
            return [int]$_.Exception.Response.StatusCode
        }
        return -1
    }
}

$results = @()

foreach ($user in $users) {
    $token = $null
    $tokenOk = $false

    try {
        $token = Get-Token -Username $user.Username -Password $user.Password
        $tokenOk = -not [string]::IsNullOrWhiteSpace($token)
    } catch {
        $tokenOk = $false
    }

    if (-not $tokenOk) {
        $results += [PSCustomObject]@{
            username = $user.Username
            role = $user.Role
            token_ok = $false
            notifications_status = -1
            admin_users_status = -1
            kpi_status = -1
            expected_admin_users_status = if ($user.CanReadAdminUsers) { 200 } else { 403 }
            expected_kpi_status = if ($user.CanReadKpi) { 200 } else { 403 }
            pass = $false
            error = "token_generation_failed"
        }
        continue
    }

    $notificationsStatus = Get-StatusCode -Method "GET" -Url "$GatewayUrl/api/v1/notifications" -Token $token
    $adminUsersStatus = Get-StatusCode -Method "GET" -Url "$GatewayUrl/api/v1/admin/users?page=0&size=1" -Token $token
    $kpiStatus = Get-StatusCode -Method "GET" -Url "$GatewayUrl/api/v1/kpis/dashboard" -Token $token

    $expectedAdminUsersStatus = if ($user.CanReadAdminUsers) { 200 } else { 403 }
    $expectedKpiStatus = if ($user.CanReadKpi) { 200 } else { 403 }

    $pass = $tokenOk `
        -and ($notificationsStatus -eq 200) `
        -and ($adminUsersStatus -eq $expectedAdminUsersStatus) `
        -and ($kpiStatus -eq $expectedKpiStatus)

    $results += [PSCustomObject]@{
        username = $user.Username
        role = $user.Role
        token_ok = $tokenOk
        notifications_status = $notificationsStatus
        admin_users_status = $adminUsersStatus
        kpi_status = $kpiStatus
        expected_admin_users_status = $expectedAdminUsersStatus
        expected_kpi_status = $expectedKpiStatus
        pass = $pass
        error = $null
    }
}

$outputDir = Split-Path -Path $OutputFile -Parent
if (-not [string]::IsNullOrWhiteSpace($outputDir)) {
    New-Item -ItemType Directory -Force -Path $outputDir | Out-Null
}

$results = @($results)
$passedUsers = @($results | Where-Object { $_.pass }).Count
$failedUsers = @($results | Where-Object { -not $_.pass }).Count

$report = [PSCustomObject]@{
    generated_at = (Get-Date).ToString("o")
    gateway_url = $GatewayUrl
    keycloak_url = $KeycloakUrl
    realm = $Realm
    total_users = $results.Count
    passed_users = $passedUsers
    failed_users = $failedUsers
    results = $results
}

$report | ConvertTo-Json -Depth 8 | Set-Content -Encoding UTF8 $OutputFile

Write-Host ""
Write-Host "Role matrix test results:"
$results | Format-Table username, role, token_ok, notifications_status, admin_users_status, kpi_status, pass -AutoSize
Write-Host ""
Write-Host "JSON report: $OutputFile"

if ($failedUsers -gt 0) {
    exit 1
}
