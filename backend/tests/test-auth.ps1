# Test Keycloak pour obtenir token
param(
    [string]$TestUser = "employe.cnstn",
    [string]$TestPassword = "User@12345"
)

Write-Host "🔐 Keycloak Token Request Test" -ForegroundColor Cyan

try {
    # 1. Request token from Keycloak
    $tokenUrl = "http://localhost:8090/realms/cnstn-intranet/protocol/openid-connect/token"
    
    $body = @{
        client_id = "cnstn-postman"
        username = $TestUser
        password = $TestPassword
        grant_type = "password"
        scope = "openid"
    }
    
    Write-Host "📍 Keycloak URL: $tokenUrl" -ForegroundColor Gray
    Write-Host "👤 User: $TestUser" -ForegroundColor Gray
    
    $tokenResponse = Invoke-WebRequest -Uri $tokenUrl `
        -Method POST `
        -ContentType "application/x-www-form-urlencoded" `
        -Body $body `
        -ErrorAction Stop
    
    $tokenData = $tokenResponse.Content | ConvertFrom-Json
    $accessToken = $tokenData.access_token
    
    Write-Host "✅ Token obtenu!" -ForegroundColor Green
    Write-Host "Token: $($accessToken.Substring(0, 50))..." -ForegroundColor Green
    
    # 2. Test API Gateway
    Write-Host "`n🌐 Test API Gateway" -ForegroundColor Cyan
    
    $apiUrl = "http://localhost:8088/api/v1/me"
    
    $headers = @{
        "Authorization" = "Bearer $accessToken"
        "Content-Type" = "application/json"
    }
    
    Write-Host "📍 API URL: $apiUrl" -ForegroundColor Gray
    
    $apiResponse = Invoke-WebRequest -Uri $apiUrl `
        -Method GET `
        -Headers $headers `
        -ErrorAction Stop
    
    Write-Host "✅ API Response Status: $($apiResponse.StatusCode)" -ForegroundColor Green
    
    $userData = $apiResponse.Content | ConvertFrom-Json
    Write-Host "User Info: $($userData | ConvertTo-Json)" -ForegroundColor Green
    
    return @{
        Success = $true
        Token = $accessToken
        UserData = $userData
        StatusCode = $apiResponse.StatusCode
    }
    
} catch {
    Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Full Error: $($_)" -ForegroundColor Red
    
    return @{
        Success = $false
        Error = $_.Exception.Message
    }
}
