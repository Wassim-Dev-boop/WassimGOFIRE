#!/usr/bin/env pwsh

# Test des notifications - Accès direct aux services

Write-Host "`n╔════════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  TEST D'INTÉGRATION DES NOTIFICATIONS - MULTI-RÔLES            ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan

# Fonction d'authentification
function Get-AuthToken {
    param([string]$Username, [string]$Password)
    
    $tokenUrl = "http://localhost:8090/realms/cnstn-intranet/protocol/openid-connect/token"
    $clientId = "cnstn-postman"
    
    $body = @{
        grant_type = "password"
        client_id = $clientId
        username = $Username
        password = $Password
    }
    
    try {
        $response = Invoke-RestMethod -Uri $tokenUrl -Method Post -Body $body -ContentType "application/x-www-form-urlencoded" -TimeoutSec 10 -ErrorAction Stop
        Write-Host "✓ Token obtenu pour $Username" -ForegroundColor Green
        return $response.access_token
    }
    catch {
        Write-Host "✗ Erreur authentification $Username : $($_.Exception.Message)" -ForegroundColor Red
        return $null
    }
}

# Test 1: Création de réservation
Write-Host "`n=== TEST 1: Création de réservation (employe.cnstn)" -ForegroundColor Cyan

$token = Get-AuthToken "employe.cnstn" "User@12345"
if ($token) {
    $headers = @{"Authorization" = "Bearer $token"; "Content-Type" = "application/json"}
    $body = @{title = "Test Reservation"; startTime = (Get-Date).AddDays(1).ToUniversalTime().ToString("O"); endTime = (Get-Date).AddDays(1).AddHours(2).ToUniversalTime().ToString("O"); requesterUsername = "employe.cnstn"} | ConvertTo-Json
    
    try {
        $response = Invoke-RestMethod -Uri "http://localhost:8083/api/v1/reservations" -Method Post -Headers $headers -Body $body -TimeoutSec 10 -ErrorAction Stop
        Write-Host "✓ Réservation créée: $($response.id)" -ForegroundColor Green
        $reservationId = $response.id
    } catch {
        Write-Host "✗ Erreur: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# Test 2: Approbation de réservation
if ($reservationId) {
    Write-Host "`n=== TEST 2: Approbation de réservation (securite.cnstn)" -ForegroundColor Cyan
    Start-Sleep -Seconds 2
    
    $token = Get-AuthToken "securite.cnstn" "User@12345"
    if ($token) {
        $headers = @{"Authorization" = "Bearer $token"; "Content-Type" = "application/json"}
        $body = @{approved = $true; comment = "Approuvé"} | ConvertTo-Json
        
        try {
            $response = Invoke-RestMethod -Uri "http://localhost:8083/api/v1/reservations/$reservationId/security-validation" -Method Post -Headers $headers -Body $body -TimeoutSec 10 -ErrorAction Stop
            Write-Host "✓ Réservation approuvée" -ForegroundColor Green
        } catch {
            Write-Host "✗ Erreur: $($_.Exception.Message)" -ForegroundColor Red
        }
    }
}

# Test 3: Création d'intervention
Write-Host "`n=== TEST 3: Création intervention (chef.cnstn)" -ForegroundColor Cyan

$token = Get-AuthToken "chef.cnstn" "User@12345"
if ($token) {
    $headers = @{"Authorization" = "Bearer $token"; "Content-Type" = "application/json"}
    $body = @{title = "Test Intervention"; description = "Description test"; requestedBy = "chef.cnstn"} | ConvertTo-Json
    
    try {
        $response = Invoke-RestMethod -Uri "http://localhost:8084/api/v1/interventions" -Method Post -Headers $headers -Body $body -TimeoutSec 10 -ErrorAction Stop
        Write-Host "✓ Intervention créée: $($response.id)" -ForegroundColor Green
        $interventionId = $response.id
    } catch {
        Write-Host "✗ Erreur: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# Test 4: Validation d'intervention
if ($interventionId) {
    Write-Host "`n=== TEST 4: Validation intervention (directeur.cnstn)" -ForegroundColor Cyan
    Start-Sleep -Seconds 2
    
    $token = Get-AuthToken "directeur.cnstn" "User@12345"
    if ($token) {
        $headers = @{"Authorization" = "Bearer $token"; "Content-Type" = "application/json"}
        $body = @{approved = $true; note = "Validé"} | ConvertTo-Json
        
        try {
            $response = Invoke-RestMethod -Uri "http://localhost:8084/api/v1/interventions/$interventionId/validate" -Method Post -Headers $headers -Body $body -TimeoutSec 10 -ErrorAction Stop
            Write-Host "✓ Intervention validée" -ForegroundColor Green
        } catch {
            Write-Host "✗ Erreur: $($_.Exception.Message)" -ForegroundColor Red
        }
    }
}

# Test 5: Création document
Write-Host "`n=== TEST 5: Création document (qualite.cnstn)" -ForegroundColor Cyan

$token = Get-AuthToken "qualite.cnstn" "User@12345"
if ($token) {
    $headers = @{"Authorization" = "Bearer $token"; "Content-Type" = "application/json"}
    $body = @{title = "Test Document"; category = "Test"; content = "Contenu test"; createdBy = "qualite.cnstn"} | ConvertTo-Json
    
    try {
        $response = Invoke-RestMethod -Uri "http://localhost:8085/api/v1/documents" -Method Post -Headers $headers -Body $body -TimeoutSec 10 -ErrorAction Stop
        Write-Host "✓ Document créé: $($response.id)" -ForegroundColor Green
        $documentId = $response.id
    } catch {
        Write-Host "✗ Erreur: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# Test 6: Soumission document
if ($documentId) {
    Write-Host "`n=== TEST 6: Soumission document (qualite.cnstn)" -ForegroundColor Cyan
    Start-Sleep -Seconds 2
    
    $token = Get-AuthToken "qualite.cnstn" "User@12345"
    if ($token) {
        $headers = @{"Authorization" = "Bearer $token"}
        
        try {
            $response = Invoke-RestMethod -Uri "http://localhost:8085/api/v1/documents/$documentId/submit" -Method Post -Headers $headers -TimeoutSec 10 -ErrorAction Stop
            Write-Host "✓ Document soumis" -ForegroundColor Green
        } catch {
            Write-Host "✗ Erreur: $($_.Exception.Message)" -ForegroundColor Red
        }
    }
}

# Test 7: Approbation document
if ($documentId) {
    Write-Host "`n=== TEST 7: Approbation document (salle.cnstn)" -ForegroundColor Cyan
    Start-Sleep -Seconds 2
    
    $token = Get-AuthToken "salle.cnstn" "User@12345"
    if ($token) {
        $headers = @{"Authorization" = "Bearer $token"}
        
        try {
            $response = Invoke-RestMethod -Uri "http://localhost:8085/api/v1/documents/$documentId/approve" -Method Post -Headers $headers -TimeoutSec 10 -ErrorAction Stop
            Write-Host "✓ Document approuvé" -ForegroundColor Green
        } catch {
            Write-Host "✗ Erreur: $($_.Exception.Message)" -ForegroundColor Red
        }
    }
}

# Test 8: Publication document
if ($documentId) {
    Write-Host "`n=== TEST 8: Publication document (salle.cnstn)" -ForegroundColor Cyan
    Start-Sleep -Seconds 2
    
    $token = Get-AuthToken "salle.cnstn" "User@12345"
    if ($token) {
        $headers = @{"Authorization" = "Bearer $token"}
        
        try {
            $response = Invoke-RestMethod -Uri "http://localhost:8085/api/v1/documents/$documentId/publish" -Method Post -Headers $headers -TimeoutSec 10 -ErrorAction Stop
            Write-Host "✓ Document publié" -ForegroundColor Green
        } catch {
            Write-Host "✗ Erreur: $($_.Exception.Message)" -ForegroundColor Red
        }
    }
}

# Test 9: Vérifier notification service
Write-Host "`n=== TEST 9: Vérification notification service" -ForegroundColor Cyan

try {
    $response = Invoke-RestMethod -Uri "http://localhost:8086/health" -Method Get -TimeoutSec 10 -ErrorAction Stop
    Write-Host "✓ Notification service est opérationnel" -ForegroundColor Green
} catch {
    Write-Host "✗ Erreur: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n╔════════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  TESTS COMPLÉTÉS                                               ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
