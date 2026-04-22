param(
    [switch]$WithFrontend
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Run-Step {
    param(
        [Parameter(Mandatory = $true)][string]$Name,
        [Parameter(Mandatory = $true)][scriptblock]$Action
    )

    Write-Host ""
    Write-Host "==> $Name"
    & $Action
}

Run-Step -Name "Newman full API tests" -Action {
    newman run docs/postman/CNSTN-Intranet.postman_collection.json `
        -e docs/postman/CNSTN-Intranet.local.postman_environment.json `
        --reporters "cli,json" `
        --reporter-json-export newman-full-e2e.json
}

Run-Step -Name "Role matrix tests (7 users)" -Action {
    .\scripts\role-matrix-tests.ps1
}

Run-Step -Name "Backlog functional tests (28 stories)" -Action {
    .\scripts\backlog-functional-tests.ps1
}

if ($WithFrontend) {
    $frontendPath = Join-Path (Split-Path -Parent $PSScriptRoot) "..\\frontend"
    $frontendPath = [System.IO.Path]::GetFullPath($frontendPath)

    Run-Step -Name "Frontend build" -Action {
        Push-Location $frontendPath
        try {
            npm run build
        } finally {
            Pop-Location
        }
    }

    Run-Step -Name "Frontend unit tests" -Action {
        Push-Location $frontendPath
        try {
            npm run test -- --watch=false --browsers=ChromeHeadless
        } finally {
            Pop-Location
        }
    }
}

Write-Host ""
Write-Host "All requested test steps completed."
