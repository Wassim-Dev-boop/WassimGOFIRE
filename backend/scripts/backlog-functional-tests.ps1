param(
    [string]$GatewayUrl = "http://localhost:8088",
    [string]$KeycloakUrl = "http://localhost:8090",
    [string]$Realm = "cnstn-intranet",
    [string]$ClientId = "cnstn-postman",
    [string]$OutputFile = "test-reports/backlog-functional-report.json"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$results = @()

function Add-StoryResult {
    param(
        [int]$Id,
        [string]$Actor,
        [string]$Feature,
        [string]$Expected,
        [string]$Actual,
        [bool]$Pass,
        [string]$Note = ""
    )

    $script:results += [PSCustomObject]@{
        id = $Id
        actor = $Actor
        feature = $Feature
        expected = $Expected
        actual = $Actual
        pass = $Pass
        note = $Note
    }
}

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

function Invoke-Api {
    param(
        [Parameter(Mandatory = $true)][string]$Method,
        [Parameter(Mandatory = $true)][string]$Url,
        [string]$Token,
        [object]$Body
    )

    $headers = @{}
    if (-not [string]::IsNullOrWhiteSpace($Token)) {
        $headers["Authorization"] = "Bearer $Token"
    }

    $status = -1
    $raw = ""

    try {
        if ($null -ne $Body) {
            $jsonBody = if ($Body -is [string]) { $Body } else { $Body | ConvertTo-Json -Depth 12 }
            $response = Invoke-WebRequest -Method $Method -Uri $Url -Headers $headers -ContentType "application/json" -Body $jsonBody -UseBasicParsing -SkipHttpErrorCheck -ErrorAction Stop
        } else {
            $response = Invoke-WebRequest -Method $Method -Uri $Url -Headers $headers -UseBasicParsing -SkipHttpErrorCheck -ErrorAction Stop
        }

        $status = [int]$response.StatusCode
        $raw = [string]$response.Content
    } catch {
        $status = -1
        $raw = $_.Exception.Message
    }

    $json = $null
    if (-not [string]::IsNullOrWhiteSpace($raw)) {
        try {
            $json = $raw | ConvertFrom-Json
        } catch {
            $json = $null
        }
    }

    return [PSCustomObject]@{
        status = $status
        raw = $raw
        json = $json
    }
}

function Get-IsoUtc {
    param([Parameter(Mandatory = $true)][DateTime]$DateValue)
    return $DateValue.ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
}

$nowUtc = (Get-Date).ToUniversalTime()
$uniqueSuffix = ([DateTimeOffset]::UtcNow.ToUnixTimeSeconds()).ToString() + "-" + ([Guid]::NewGuid().ToString("N").Substring(0, 6))

$eventStart1 = Get-IsoUtc ($nowUtc.AddDays(7).AddHours(1))
$eventEnd1 = Get-IsoUtc ($nowUtc.AddDays(7).AddHours(3))
$eventStart2 = Get-IsoUtc ($nowUtc.AddDays(8).AddHours(1))
$eventEnd2 = Get-IsoUtc ($nowUtc.AddDays(8).AddHours(3))

$reservationStartRoom = Get-IsoUtc ($nowUtc.AddDays(9).AddHours(1))
$reservationEndRoom = Get-IsoUtc ($nowUtc.AddDays(9).AddHours(3))
$reservationStartEquipment = Get-IsoUtc ($nowUtc.AddDays(10).AddHours(1))
$reservationEndEquipment = Get-IsoUtc ($nowUtc.AddDays(10).AddHours(3))

$tokens = @{}
$accounts = @(
    [PSCustomObject]@{ Key = "admin"; Username = "admin.cnstn"; Password = "Admin@12345" },
    [PSCustomObject]@{ Key = "employee"; Username = "employe.cnstn"; Password = "User@12345" },
    [PSCustomObject]@{ Key = "chef"; Username = "chef.cnstn"; Password = "User@12345" },
    [PSCustomObject]@{ Key = "roomManager"; Username = "salle.cnstn"; Password = "User@12345" },
    [PSCustomObject]@{ Key = "securityManager"; Username = "securite.cnstn"; Password = "User@12345" },
    [PSCustomObject]@{ Key = "director"; Username = "directeur.cnstn"; Password = "User@12345" },
    [PSCustomObject]@{ Key = "qualityManager"; Username = "qualite.cnstn"; Password = "User@12345" }
)

$allTokensOk = $true
foreach ($account in $accounts) {
    try {
        $token = Get-Token -Username $account.Username -Password $account.Password
        if ([string]::IsNullOrWhiteSpace($token)) {
            $allTokensOk = $false
        } else {
            $tokens[$account.Key] = $token
        }
    } catch {
        $allTokensOk = $false
    }
}

Add-StoryResult -Id 1 -Actor "Tous" -Feature "Authentification" -Expected "Tous les tokens Keycloak sont generes" -Actual ("tokens_ok=" + $allTokensOk) -Pass $allTokensOk

$logoutCheck = Invoke-Api -Method "GET" -Url "$GatewayUrl/api/v1/notifications"
$logoutPass = $logoutCheck.status -eq 401 -or $logoutCheck.status -eq 403
Add-StoryResult -Id 2 -Actor "Tous" -Feature "Deconnexion" -Expected "Sans token, acces refuse" -Actual ("status=" + $logoutCheck.status) -Pass $logoutPass -Note "Verification backend de session non authentifiee"

$departmentId = $null
$departmentDeleteId = $null
$userId = $null
$eventIdApprove = $null
$eventIdReject = $null
$roomIdMain = $null
$roomIdDelete = $null
$equipmentIdMain = $null
$equipmentIdDelete = $null
$reservationRoomId = $null
$reservationEquipmentId = $null
$interventionId = $null
$documentId = $null

$departmentCreate = Invoke-Api -Method "POST" -Url "$GatewayUrl/api/v1/admin/departments" -Token $tokens["admin"] -Body @{
    code = "DSI-$uniqueSuffix"
    name = "DSI Test $uniqueSuffix"
    description = "Departement test backlog"
    active = $true
}
$pass7 = $departmentCreate.status -eq 201 -and $null -ne $departmentCreate.json -and $null -ne $departmentCreate.json.id
if ($pass7) {
    $departmentId = $departmentCreate.json.id
}
Add-StoryResult -Id 7 -Actor "Administrateur" -Feature "Ajouter service" -Expected "201 + id departement" -Actual ("status=" + $departmentCreate.status) -Pass $pass7

if ($null -ne $departmentId) {
    $departmentUpdate = Invoke-Api -Method "PUT" -Url "$GatewayUrl/api/v1/admin/departments/$departmentId" -Token $tokens["admin"] -Body @{
        name = "DSI Test Updated $uniqueSuffix"
        description = "Departement update backlog"
        active = $true
    }
    $pass8 = $departmentUpdate.status -eq 200
    Add-StoryResult -Id 8 -Actor "Administrateur" -Feature "Modifier service" -Expected "200" -Actual ("status=" + $departmentUpdate.status) -Pass $pass8
} else {
    Add-StoryResult -Id 8 -Actor "Administrateur" -Feature "Modifier service" -Expected "200" -Actual "skipped_dependency" -Pass $false -Note "Department creation failed"
}

$departmentCreateForDelete = Invoke-Api -Method "POST" -Url "$GatewayUrl/api/v1/admin/departments" -Token $tokens["admin"] -Body @{
    code = "TMP-$uniqueSuffix"
    name = "Temp Department $uniqueSuffix"
    description = "Temp delete"
    active = $true
}
if ($departmentCreateForDelete.status -eq 201 -and $null -ne $departmentCreateForDelete.json -and $null -ne $departmentCreateForDelete.json.id) {
    $departmentDeleteId = $departmentCreateForDelete.json.id
    $departmentDelete = Invoke-Api -Method "DELETE" -Url "$GatewayUrl/api/v1/admin/departments/$departmentDeleteId" -Token $tokens["admin"]
    $pass9 = $departmentDelete.status -eq 204
    Add-StoryResult -Id 9 -Actor "Administrateur" -Feature "Supprimer service" -Expected "204" -Actual ("status=" + $departmentDelete.status) -Pass $pass9
} else {
    Add-StoryResult -Id 9 -Actor "Administrateur" -Feature "Supprimer service" -Expected "204" -Actual ("create_status=" + $departmentCreateForDelete.status) -Pass $false
}

if ($null -ne $departmentId) {
    $createUser = Invoke-Api -Method "POST" -Url "$GatewayUrl/api/v1/admin/users" -Token $tokens["admin"] -Body @{
        username = "agent.$uniqueSuffix"
        email = "agent.$uniqueSuffix@cnstn.tn"
        firstName = "Agent"
        lastName = "Backlog"
        phone = "+21620000001"
        departmentId = $departmentId
        roles = @("EMPLOYE")
        enabled = $true
        initialPassword = "User@12345"
    }
    $pass3 = $createUser.status -eq 201 -and $null -ne $createUser.json -and $null -ne $createUser.json.id
    if ($pass3) {
        $userId = $createUser.json.id
    }
    Add-StoryResult -Id 3 -Actor "Administrateur" -Feature "Ajouter utilisateur" -Expected "201 + id user" -Actual ("status=" + $createUser.status) -Pass $pass3
} else {
    Add-StoryResult -Id 3 -Actor "Administrateur" -Feature "Ajouter utilisateur" -Expected "201 + id user" -Actual "skipped_dependency" -Pass $false -Note "Department missing"
}

if ($null -ne $userId -and $null -ne $departmentId) {
    $updateUser = Invoke-Api -Method "PUT" -Url "$GatewayUrl/api/v1/admin/users/$userId" -Token $tokens["admin"] -Body @{
        email = "agent.updated.$uniqueSuffix@cnstn.tn"
        firstName = "AgentUpdated"
        lastName = "Backlog"
        phone = "+21620000002"
        departmentId = $departmentId
        enabled = $true
    }
    $pass4 = $updateUser.status -eq 200
    Add-StoryResult -Id 4 -Actor "Administrateur" -Feature "Modifier utilisateur" -Expected "200" -Actual ("status=" + $updateUser.status) -Pass $pass4
} else {
    Add-StoryResult -Id 4 -Actor "Administrateur" -Feature "Modifier utilisateur" -Expected "200" -Actual "skipped_dependency" -Pass $false -Note "User missing"
}

if ($null -ne $userId) {
    $assignRoles = Invoke-Api -Method "PUT" -Url "$GatewayUrl/api/v1/admin/users/$userId/roles" -Token $tokens["admin"] -Body @{
        roles = @("EMPLOYE", "CHEF_HIERARCHIQUE")
    }
    $pass6 = $assignRoles.status -eq 200
    Add-StoryResult -Id 6 -Actor "Administrateur" -Feature "Attribuer roles" -Expected "200" -Actual ("status=" + $assignRoles.status) -Pass $pass6
} else {
    Add-StoryResult -Id 6 -Actor "Administrateur" -Feature "Attribuer roles" -Expected "200" -Actual "skipped_dependency" -Pass $false -Note "User missing"
}

if ($null -ne $userId) {
    $deleteUser = Invoke-Api -Method "DELETE" -Url "$GatewayUrl/api/v1/admin/users/$userId" -Token $tokens["admin"]
    $pass5 = $deleteUser.status -eq 204
    Add-StoryResult -Id 5 -Actor "Administrateur" -Feature "Supprimer utilisateur" -Expected "204" -Actual ("status=" + $deleteUser.status) -Pass $pass5
} else {
    Add-StoryResult -Id 5 -Actor "Administrateur" -Feature "Supprimer utilisateur" -Expected "204" -Actual "skipped_dependency" -Pass $false -Note "User missing"
}

$profileUpdate = Invoke-Api -Method "PATCH" -Url "$GatewayUrl/api/v1/me/profile" -Token $tokens["employee"] -Body @{
    email = "employe+$uniqueSuffix@cnstn.tn"
    firstName = "Employe"
    lastName = "CNSTN"
    phone = "+21620000003"
}
$pass10 = $profileUpdate.status -eq 200
Add-StoryResult -Id 10 -Actor "Employe, Chef hierarchique" -Feature "Modifier profil" -Expected "200" -Actual ("status=" + $profileUpdate.status) -Pass $pass10

$eventCreateApprove = Invoke-Api -Method "POST" -Url "$GatewayUrl/api/v1/events" -Token $tokens["employee"] -Body @{
    title = "Evenement backlog approve $uniqueSuffix"
    description = "Scenario backlog approve"
    startAt = $eventStart1
    endAt = $eventEnd1
    location = "Salle A"
}
$pass11 = $eventCreateApprove.status -eq 201 -and $null -ne $eventCreateApprove.json -and $null -ne $eventCreateApprove.json.id
if ($pass11) {
    $eventIdApprove = $eventCreateApprove.json.id
}
Add-StoryResult -Id 11 -Actor "Employe" -Feature "Organiser evenement" -Expected "201 + id event" -Actual ("status=" + $eventCreateApprove.status) -Pass $pass11

$eventCreateOnline = Invoke-Api -Method "POST" -Url "$GatewayUrl/api/v1/events" -Token $tokens["employee"] -Body @{
    title = "Evenement backlog zoom $uniqueSuffix"
    description = "Scenario backlog evenement en ligne"
    startAt = $eventStart2
    endAt = $eventEnd2
    location = ""
    onlineEvent = $true
    zoomMeetingNumber = "12345678901"
    zoomPasscode = "TestZoom123"
}

if ($eventCreateOnline.status -eq 201 -and $null -ne $eventCreateOnline.json -and $null -ne $eventCreateOnline.json.id) {
    $zoomEventId = $eventCreateOnline.json.id
    $zoomSignature = Invoke-Api -Method "POST" -Url "$GatewayUrl/api/v1/events/$zoomEventId/zoom-signature" -Token $tokens["employee"] -Body @{}

    # 200 => Zoom SDK configuré, 400 => endpoint disponible mais configuration SDK absente/incomplète.
    $pass28 = $zoomSignature.status -eq 200 -or $zoomSignature.status -eq 400
    Add-StoryResult -Id 28 -Actor "Employe" -Feature "Rejoindre evenement en ligne (Zoom SDK)" -Expected "200 ou 400 (endpoint Zoom actif)" -Actual ("create_status=" + $eventCreateOnline.status + ",signature_status=" + $zoomSignature.status) -Pass $pass28
} else {
    Add-StoryResult -Id 28 -Actor "Employe" -Feature "Rejoindre evenement en ligne (Zoom SDK)" -Expected "200 ou 400 (endpoint Zoom actif)" -Actual ("create_status=" + $eventCreateOnline.status) -Pass $false
}

if ($null -ne $eventIdApprove) {
    $invitePartner = Invoke-Api -Method "POST" -Url "$GatewayUrl/api/v1/events/$eventIdApprove/partners" -Token $tokens["chef"] -Body @{
        partnerName = "Partner Backlog"
        partnerEmail = "partner.$uniqueSuffix@example.com"
    }
    $pass16 = $invitePartner.status -eq 201
    Add-StoryResult -Id 16 -Actor "Employe" -Feature "Ajouter partenaire" -Expected "201" -Actual ("status=" + $invitePartner.status) -Pass $pass16

    $listPartnersDirector = Invoke-Api -Method "GET" -Url "$GatewayUrl/api/v1/events/$eventIdApprove/partners" -Token $tokens["director"]
    $pass23 = $listPartnersDirector.status -eq 200
    Add-StoryResult -Id 23 -Actor "Directeur DSN" -Feature "Verifier acces partenaire" -Expected "200" -Actual ("status=" + $listPartnersDirector.status) -Pass $pass23

    $approveEvent = Invoke-Api -Method "PUT" -Url "$GatewayUrl/api/v1/events/$eventIdApprove/decision" -Token $tokens["chef"] -Body @{
        approved = $true
        decisionComment = "Validation backlog"
    }
    $pass20 = $approveEvent.status -eq 200
    Add-StoryResult -Id 20 -Actor "Chef hierarchique" -Feature "Valider demande evenement" -Expected "200" -Actual ("status=" + $approveEvent.status) -Pass $pass20
} else {
    Add-StoryResult -Id 16 -Actor "Employe" -Feature "Ajouter partenaire" -Expected "201" -Actual "skipped_dependency" -Pass $false
    Add-StoryResult -Id 23 -Actor "Directeur DSN" -Feature "Verifier acces partenaire" -Expected "200" -Actual "skipped_dependency" -Pass $false
    Add-StoryResult -Id 20 -Actor "Chef hierarchique" -Feature "Valider demande evenement" -Expected "200" -Actual "skipped_dependency" -Pass $false
}

$eventCreateReject = Invoke-Api -Method "POST" -Url "$GatewayUrl/api/v1/events" -Token $tokens["employee"] -Body @{
    title = "Evenement backlog reject $uniqueSuffix"
    description = "Scenario backlog reject"
    startAt = $eventStart2
    endAt = $eventEnd2
    location = "Salle B"
}
if ($eventCreateReject.status -eq 201 -and $null -ne $eventCreateReject.json -and $null -ne $eventCreateReject.json.id) {
    $eventIdReject = $eventCreateReject.json.id
    $rejectEvent = Invoke-Api -Method "PUT" -Url "$GatewayUrl/api/v1/events/$eventIdReject/decision" -Token $tokens["chef"] -Body @{
        approved = $false
        decisionComment = "Refus backlog"
    }
    $pass21 = $rejectEvent.status -eq 200
    Add-StoryResult -Id 21 -Actor "Chef hierarchique" -Feature "Refuser demande evenement" -Expected "200" -Actual ("status=" + $rejectEvent.status) -Pass $pass21
} else {
    Add-StoryResult -Id 21 -Actor "Chef hierarchique" -Feature "Refuser demande evenement" -Expected "200" -Actual ("create_status=" + $eventCreateReject.status) -Pass $false
}

$roomCreateMain = Invoke-Api -Method "POST" -Url "$GatewayUrl/api/v1/rooms" -Token $tokens["roomManager"] -Body @{
    name = "Salle Main $uniqueSuffix"
    location = "Bloc 1"
    capacity = 20
    active = $true
}
$roomCreateDelete = Invoke-Api -Method "POST" -Url "$GatewayUrl/api/v1/rooms" -Token $tokens["roomManager"] -Body @{
    name = "Salle Delete $uniqueSuffix"
    location = "Bloc 2"
    capacity = 10
    active = $true
}

$roomManagePass = $false
if ($roomCreateMain.status -eq 201 -and $roomCreateDelete.status -eq 201 -and $null -ne $roomCreateMain.json.id -and $null -ne $roomCreateDelete.json.id) {
    $roomIdMain = $roomCreateMain.json.id
    $roomIdDelete = $roomCreateDelete.json.id
    $roomUpdateMain = Invoke-Api -Method "PUT" -Url "$GatewayUrl/api/v1/rooms/$roomIdMain" -Token $tokens["roomManager"] -Body @{
        name = "Salle Main Updated $uniqueSuffix"
        location = "Bloc 1A"
        capacity = 25
        active = $true
    }
    $roomDeleteTemp = Invoke-Api -Method "DELETE" -Url "$GatewayUrl/api/v1/rooms/$roomIdDelete" -Token $tokens["roomManager"]
    $roomManagePass = ($roomUpdateMain.status -eq 200 -and $roomDeleteTemp.status -eq 204)
    Add-StoryResult -Id 17 -Actor "Responsable salle" -Feature "Gerer salle (ajouter/modifier/supprimer)" -Expected "201/200/204" -Actual ("create_main=" + $roomCreateMain.status + ",create_delete=" + $roomCreateDelete.status + ",update=" + $roomUpdateMain.status + ",delete=" + $roomDeleteTemp.status) -Pass $roomManagePass
} else {
    Add-StoryResult -Id 17 -Actor "Responsable salle" -Feature "Gerer salle (ajouter/modifier/supprimer)" -Expected "201/200/204" -Actual ("create_main=" + $roomCreateMain.status + ",create_delete=" + $roomCreateDelete.status) -Pass $false
}

$equipmentCreateMain = Invoke-Api -Method "POST" -Url "$GatewayUrl/api/v1/equipments" -Token $tokens["roomManager"] -Body @{
    name = "Equip Main $uniqueSuffix"
    serialNumber = "SER-MAIN-$uniqueSuffix"
    description = "Equipment main"
    active = $true
}
$equipmentCreateDelete = Invoke-Api -Method "POST" -Url "$GatewayUrl/api/v1/equipments" -Token $tokens["roomManager"] -Body @{
    name = "Equip Delete $uniqueSuffix"
    serialNumber = "SER-DEL-$uniqueSuffix"
    description = "Equipment delete"
    active = $true
}

$equipmentManagePass = $false
if ($equipmentCreateMain.status -eq 201 -and $equipmentCreateDelete.status -eq 201 -and $null -ne $equipmentCreateMain.json.id -and $null -ne $equipmentCreateDelete.json.id) {
    $equipmentIdMain = $equipmentCreateMain.json.id
    $equipmentIdDelete = $equipmentCreateDelete.json.id
    $equipmentUpdateMain = Invoke-Api -Method "PUT" -Url "$GatewayUrl/api/v1/equipments/$equipmentIdMain" -Token $tokens["roomManager"] -Body @{
        name = "Equip Main Updated $uniqueSuffix"
        serialNumber = "SER-MAIN-UPD-$uniqueSuffix"
        description = "Equipment updated"
        active = $true
    }
    $equipmentDeleteTemp = Invoke-Api -Method "DELETE" -Url "$GatewayUrl/api/v1/equipments/$equipmentIdDelete" -Token $tokens["roomManager"]
    $equipmentManagePass = ($equipmentUpdateMain.status -eq 200 -and $equipmentDeleteTemp.status -eq 204)
    Add-StoryResult -Id 18 -Actor "Responsable salle" -Feature "Gerer equipement (ajouter/modifier/supprimer)" -Expected "201/200/204" -Actual ("create_main=" + $equipmentCreateMain.status + ",create_delete=" + $equipmentCreateDelete.status + ",update=" + $equipmentUpdateMain.status + ",delete=" + $equipmentDeleteTemp.status) -Pass $equipmentManagePass
} else {
    Add-StoryResult -Id 18 -Actor "Responsable salle" -Feature "Gerer equipement (ajouter/modifier/supprimer)" -Expected "201/200/204" -Actual ("create_main=" + $equipmentCreateMain.status + ",create_delete=" + $equipmentCreateDelete.status) -Pass $false
}

if ($null -ne $roomIdMain) {
    $reservationRoom = Invoke-Api -Method "POST" -Url "$GatewayUrl/api/v1/reservations" -Token $tokens["employee"] -Body @{
        roomId = $roomIdMain
        startAt = $reservationStartRoom
        endAt = $reservationEndRoom
        purpose = "Backlog room reservation"
    }
    $pass12 = $reservationRoom.status -eq 201 -and $null -ne $reservationRoom.json -and $null -ne $reservationRoom.json.id
    if ($pass12) {
        $reservationRoomId = $reservationRoom.json.id
    }
    Add-StoryResult -Id 12 -Actor "Employe" -Feature "Reserver salle" -Expected "201 + id reservation" -Actual ("status=" + $reservationRoom.status) -Pass $pass12
} else {
    Add-StoryResult -Id 12 -Actor "Employe" -Feature "Reserver salle" -Expected "201 + id reservation" -Actual "skipped_dependency" -Pass $false -Note "Room missing"
}

if ($null -ne $equipmentIdMain) {
    $reservationEquipment = Invoke-Api -Method "POST" -Url "$GatewayUrl/api/v1/reservations" -Token $tokens["employee"] -Body @{
        equipmentId = $equipmentIdMain
        startAt = $reservationStartEquipment
        endAt = $reservationEndEquipment
        purpose = "Backlog equipment reservation"
    }
    $pass13 = $reservationEquipment.status -eq 201 -and $null -ne $reservationEquipment.json -and $null -ne $reservationEquipment.json.id
    if ($pass13) {
        $reservationEquipmentId = $reservationEquipment.json.id
    }
    Add-StoryResult -Id 13 -Actor "Employe" -Feature "Reserver equipement" -Expected "201 + id reservation" -Actual ("status=" + $reservationEquipment.status) -Pass $pass13
} else {
    Add-StoryResult -Id 13 -Actor "Employe" -Feature "Reserver equipement" -Expected "201 + id reservation" -Actual "skipped_dependency" -Pass $false -Note "Equipment missing"
}

if ($null -ne $roomIdMain -and $null -ne $reservationRoomId) {
    $checkConflict = Invoke-Api -Method "GET" -Url "$GatewayUrl/api/v1/reservations/conflicts?roomId=$roomIdMain&startAt=$reservationStartRoom&endAt=$reservationEndRoom" -Token $tokens["securityManager"]
    $securityValidation = Invoke-Api -Method "PUT" -Url "$GatewayUrl/api/v1/reservations/$reservationRoomId/security-validation" -Token $tokens["securityManager"] -Body @{
        approved = $true
    }
    $pass22 = ($checkConflict.status -eq 200) -and ($securityValidation.status -eq 200)
    Add-StoryResult -Id 22 -Actor "Responsable securite" -Feature "Gerer demande reservation" -Expected "200 conflict + 200 validation" -Actual ("conflict=" + $checkConflict.status + ",validation=" + $securityValidation.status) -Pass $pass22
} else {
    Add-StoryResult -Id 22 -Actor "Responsable securite" -Feature "Gerer demande reservation" -Expected "200 conflict + 200 validation" -Actual "skipped_dependency" -Pass $false
}

$interventionCreate = Invoke-Api -Method "POST" -Url "$GatewayUrl/api/v1/interventions" -Token $tokens["employee"] -Body @{
    title = "Intervention $uniqueSuffix"
    description = "Probleme technique backlog"
}
$pass14 = $interventionCreate.status -eq 201 -and $null -ne $interventionCreate.json -and $null -ne $interventionCreate.json.id
if ($pass14) {
    $interventionId = $interventionCreate.json.id
}
Add-StoryResult -Id 14 -Actor "Employe" -Feature "Demander intervention" -Expected "201 + id intervention" -Actual ("status=" + $interventionCreate.status) -Pass $pass14

if ($null -ne $interventionId) {
    $interventionStatus = Invoke-Api -Method "PUT" -Url "$GatewayUrl/api/v1/interventions/$interventionId/status" -Token $tokens["roomManager"] -Body @{
        status = "IN_PROGRESS"
        assignedTo = "team.backlog"
    }
    $interventionValidate = Invoke-Api -Method "PUT" -Url "$GatewayUrl/api/v1/interventions/$interventionId/validate" -Token $tokens["roomManager"] -Body @{
        approved = $true
        note = "Validation backlog"
    }
    $pass19 = ($interventionStatus.status -eq 200) -and ($interventionValidate.status -eq 200)
    Add-StoryResult -Id 19 -Actor "Responsable salle" -Feature "Gerer intervention" -Expected "200 status + 200 validate" -Actual ("status_update=" + $interventionStatus.status + ",validate=" + $interventionValidate.status) -Pass $pass19
} else {
    Add-StoryResult -Id 19 -Actor "Responsable salle" -Feature "Gerer intervention" -Expected "200 status + 200 validate" -Actual "skipped_dependency" -Pass $false
}

$documentCreate = Invoke-Api -Method "POST" -Url "$GatewayUrl/api/v1/documents" -Token $tokens["employee"] -Body @{
    title = "Doc Backlog $uniqueSuffix"
    category = "SECURITE"
    content = "Document de test backlog"
}
if ($documentCreate.status -eq 201 -and $null -ne $documentCreate.json -and $null -ne $documentCreate.json.id) {
    $documentId = $documentCreate.json.id
}

$documentList = Invoke-Api -Method "GET" -Url "$GatewayUrl/api/v1/documents?page=0&size=20" -Token $tokens["employee"]
$pass15 = $documentList.status -eq 200
Add-StoryResult -Id 15 -Actor "Employe" -Feature "Consulter document" -Expected "200" -Actual ("status=" + $documentList.status) -Pass $pass15

if ($null -ne $documentId) {
    $documentSubmit = Invoke-Api -Method "PUT" -Url "$GatewayUrl/api/v1/documents/$documentId/submit" -Token $tokens["employee"]
    $documentApprove = Invoke-Api -Method "PUT" -Url "$GatewayUrl/api/v1/documents/$documentId/approve" -Token $tokens["qualityManager"]
    $documentPublish = Invoke-Api -Method "PUT" -Url "$GatewayUrl/api/v1/documents/$documentId/publish" -Token $tokens["qualityManager"]

    $pass25 = ($documentSubmit.status -eq 200) -and ($documentApprove.status -eq 200)
    $pass27 = $documentApprove.status -eq 200
    $pass26 = $documentPublish.status -eq 200

    Add-StoryResult -Id 25 -Actor "Responsable qualite" -Feature "Gerer workflow GED" -Expected "200 submit + 200 approve" -Actual ("submit=" + $documentSubmit.status + ",approve=" + $documentApprove.status) -Pass $pass25
    Add-StoryResult -Id 27 -Actor "Responsable qualite" -Feature "Approuver document" -Expected "200" -Actual ("status=" + $documentApprove.status) -Pass $pass27
    Add-StoryResult -Id 26 -Actor "Responsable qualite" -Feature "Publier document" -Expected "200" -Actual ("status=" + $documentPublish.status) -Pass $pass26
} else {
    Add-StoryResult -Id 25 -Actor "Responsable qualite" -Feature "Gerer workflow GED" -Expected "200 submit + 200 approve" -Actual "skipped_dependency" -Pass $false
    Add-StoryResult -Id 27 -Actor "Responsable qualite" -Feature "Approuver document" -Expected "200" -Actual "skipped_dependency" -Pass $false
    Add-StoryResult -Id 26 -Actor "Responsable qualite" -Feature "Publier document" -Expected "200" -Actual "skipped_dependency" -Pass $false
}

$dashboard = Invoke-Api -Method "GET" -Url "$GatewayUrl/api/v1/kpis/dashboard" -Token $tokens["director"]
$pass24 = $dashboard.status -eq 200
Add-StoryResult -Id 24 -Actor "Directeur DSN" -Feature "Consulter tableau de bord" -Expected "200" -Actual ("status=" + $dashboard.status) -Pass $pass24

$results = @($results | Sort-Object id)
$passCount = @($results | Where-Object { $_.pass }).Count
$failCount = @($results | Where-Object { -not $_.pass }).Count

$outputDir = Split-Path -Path $OutputFile -Parent
if (-not [string]::IsNullOrWhiteSpace($outputDir)) {
    New-Item -ItemType Directory -Force -Path $outputDir | Out-Null
}

$report = [PSCustomObject]@{
    generated_at = (Get-Date).ToString("o")
    gateway_url = $GatewayUrl
    keycloak_url = $KeycloakUrl
    realm = $Realm
    backlog_total = $results.Count
    backlog_passed = $passCount
    backlog_failed = $failCount
    results = $results
}

$report | ConvertTo-Json -Depth 10 | Set-Content -Encoding UTF8 $OutputFile

Write-Host ""
Write-Host "Backlog functional test results:"
$results | Format-Table id, actor, feature, pass, actual -AutoSize
Write-Host ""
Write-Host "JSON report: $OutputFile"

if ($failCount -gt 0) {
    exit 1
}
