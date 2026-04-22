param(
    [string]$ZoomSdkKey,
    [string]$ZoomSdkSecret,
    [switch]$SkipRestart,
    [string]$GatewayUrl = "http://localhost:8088",
    [string]$UserIdentifier = "employe.cnstn",
    [string]$UserPassword = "User@12345"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Invoke-RestWithRetry {
    param(
        [Parameter(Mandatory = $true)][scriptblock]$Action,
        [int]$Attempts = 12,
        [int]$DelaySeconds = 5,
        [string]$OperationName = "REST call"
    )

    $lastError = $null
    for ($i = 1; $i -le $Attempts; $i++) {
        try {
            return & $Action
        }
        catch {
            $lastError = $_
            if ($i -lt $Attempts) {
                Write-Host "$OperationName failed (attempt $i/$Attempts). Retrying in $DelaySeconds sec..."
                Start-Sleep -Seconds $DelaySeconds
            }
        }
    }

    throw "${OperationName} failed after $Attempts attempts. Last error: $lastError"
}

function Read-RequiredValue {
    param(
        [string]$Prompt,
        [string]$Existing
    )

    if (-not [string]::IsNullOrWhiteSpace($Existing)) {
        return $Existing.Trim()
    }

    $value = Read-Host -Prompt $Prompt
    if ([string]::IsNullOrWhiteSpace($value)) {
        throw "Value for '$Prompt' is required."
    }

    return $value.Trim()
}

$ZoomSdkKey = Read-RequiredValue -Prompt "Enter ZOOM_SDK_KEY" -Existing $ZoomSdkKey
$ZoomSdkSecret = Read-RequiredValue -Prompt "Enter ZOOM_SDK_SECRET" -Existing $ZoomSdkSecret

$envFilePath = Join-Path $PSScriptRoot "..\\.env"
$envFilePath = [System.IO.Path]::GetFullPath($envFilePath)

@(
    "ZOOM_SDK_KEY=$ZoomSdkKey"
    "ZOOM_SDK_SECRET=$ZoomSdkSecret"
) | Set-Content -Encoding UTF8 -Path $envFilePath

Write-Host "Saved Zoom SDK variables to $envFilePath"

if (-not $SkipRestart) {
    Push-Location (Join-Path $PSScriptRoot "..")
    try {
        Write-Host "Restarting event-service with updated environment..."
        docker compose up -d --build event-service | Out-Null
    }
    finally {
        Pop-Location
    }
}

Write-Host "Authenticating test user to validate signature endpoint..."
$loginResponse = Invoke-RestWithRetry -OperationName "Auth login" -Action {
    Invoke-RestMethod -Method Post -Uri "$GatewayUrl/api/v1/auth/login" -ContentType "application/json" -Body (@{
        identifier = $UserIdentifier
        password = $UserPassword
    } | ConvertTo-Json -Depth 5)
}

if ($null -eq $loginResponse -or [string]::IsNullOrWhiteSpace($loginResponse.access_token)) {
    throw "Login failed or token missing."
}

$token = $loginResponse.access_token
$headers = @{ Authorization = "Bearer $token" }

$nowUtc = (Get-Date).ToUniversalTime()
$startAt = $nowUtc.AddDays(3).AddHours(1).ToString("yyyy-MM-ddTHH:mm:ssZ")
$endAt = $nowUtc.AddDays(3).AddHours(2).ToString("yyyy-MM-ddTHH:mm:ssZ")

$eventBody = @{
    title = "Zoom SDK Validation Event $([Guid]::NewGuid().ToString('N').Substring(0, 8))"
    description = "Automated Zoom SDK signature validation"
    startAt = $startAt
    endAt = $endAt
    location = ""
    onlineEvent = $true
    zoomMeetingNumber = "12345678901"
    zoomPasscode = "TestZoom123"
} | ConvertTo-Json -Depth 5

$createdEvent = Invoke-RestWithRetry -OperationName "Create online event" -Action {
    Invoke-RestMethod -Method Post -Uri "$GatewayUrl/api/v1/events" -Headers $headers -ContentType "application/json" -Body $eventBody
}
if ($null -eq $createdEvent -or [string]::IsNullOrWhiteSpace($createdEvent.id)) {
    throw "Failed to create online validation event."
}

$signatureResponse = Invoke-RestWithRetry -OperationName "Request zoom signature" -Action {
    Invoke-RestMethod -Method Post -Uri "$GatewayUrl/api/v1/events/$($createdEvent.id)/zoom-signature" -Headers $headers -ContentType "application/json" -Body "{}"
}

if ($null -eq $signatureResponse -or [string]::IsNullOrWhiteSpace($signatureResponse.signature)) {
    throw "Zoom signature endpoint did not return a signature."
}

Write-Host "Zoom signature validation succeeded."
Write-Host "Event ID: $($createdEvent.id)"
Write-Host "SDK Key returned: $($signatureResponse.sdkKey)"
