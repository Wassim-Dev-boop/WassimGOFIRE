Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Escape-Xml([string]$value) {
    if ($null -eq $value) { return "" }
    return [System.Security.SecurityElement]::Escape($value)
}

function New-Graph([string]$name, [scriptblock]$body) {
    $script:cells = New-Object System.Collections.Generic.List[string]
    $script:nextId = 2
    $script:cells.Add('<mxCell id="0"/>')
    $script:cells.Add('<mxCell id="1" parent="0"/>')
    & $body
    $model = '<mxGraphModel dx="1600" dy="1000" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="1600" pageHeight="1100" math="0" shadow="0"><root>' +
        (($script:cells | ForEach-Object { $_ }) -join "") +
        '</root></mxGraphModel>'
    return '<diagram id="' + (Escape-Xml ([guid]::NewGuid().ToString("N"))) + '" name="' + (Escape-Xml $name) + '">' + $model + '</diagram>'
}

function Add-Node([string]$id, [string]$label, [int]$x, [int]$y, [int]$w, [int]$h, [string]$style) {
    $script:cells.Add('<mxCell id="' + (Escape-Xml $id) + '" value="' + (Escape-Xml $label) + '" style="' + (Escape-Xml $style) + '" vertex="1" parent="1"><mxGeometry x="' + $x + '" y="' + $y + '" width="' + $w + '" height="' + $h + '" as="geometry"/></mxCell>')
}

function Add-Edge([string]$id, [string]$label, [string]$source, [string]$target, [string]$style) {
    $script:cells.Add('<mxCell id="' + (Escape-Xml $id) + '" value="' + (Escape-Xml $label) + '" style="' + (Escape-Xml $style) + '" edge="1" parent="1" source="' + (Escape-Xml $source) + '" target="' + (Escape-Xml $target) + '"><mxGeometry relative="1" as="geometry"/></mxCell>')
}

function Add-Class([string]$id, [string]$name, [string[]]$attributes, [string[]]$methods, [int]$x, [int]$y, [int]$w = 250, [int]$h = 170) {
    $label = "<b>$name</b><hr/>" + (($attributes | ForEach-Object { "+ $_" }) -join "<br/>") + "<hr/>" + (($methods | ForEach-Object { "+ $_" }) -join "<br/>")
    Add-Node $id $label $x $y $w $h "shape=rectangle;rounded=0;whiteSpace=wrap;html=1;align=left;verticalAlign=top;spacing=8;fontSize=12;strokeColor=#2f5597;fillColor=#f8fbff;"
}

function Add-Actor([string]$id, [string]$label, [int]$x, [int]$y) {
    Add-Node $id $label $x $y 120 70 "shape=umlActor;verticalLabelPosition=bottom;verticalAlign=top;html=1;outlineConnect=0;fontSize=12;strokeColor=#333333;"
}

function Add-UseCase([string]$id, [string]$label, [int]$x, [int]$y, [int]$w = 190) {
    Add-Node $id $label $x $y $w 58 "ellipse;whiteSpace=wrap;html=1;fontSize=12;strokeColor=#2f5597;fillColor=#eef4ff;"
}

function Add-Lifeline([string]$id, [string]$label, [int]$x, [int]$y) {
    Add-Node $id $label $x $y 150 44 "rounded=0;whiteSpace=wrap;html=1;fontSize=12;strokeColor=#2f5597;fillColor=#f8fbff;"
    Add-Node ($id + "_line") "" ($x + 75) ($y + 44) 1 760 "shape=line;html=1;strokeColor=#999999;dashed=1;"
}

function Add-Message([string]$id, [string]$label, [string]$source, [string]$target) {
    Add-Edge $id $label $source $target "endArrow=block;html=1;rounded=0;fontSize=11;strokeColor=#333333;"
}

$association = "endArrow=none;html=1;rounded=0;fontSize=11;strokeColor=#333333;"
$dependency = "endArrow=open;html=1;rounded=0;dashed=1;fontSize=11;strokeColor=#666666;"
$include = "endArrow=open;html=1;rounded=0;dashed=1;fontSize=11;strokeColor=#666666;"

$diagrams = New-Object System.Collections.Generic.List[string]

$diagrams.Add((New-Graph "01-Cas-utilisation-global" {
    Add-Node "sys" "<b>Systeme intranet CNSTN</b>" 250 80 840 760 "rounded=0;whiteSpace=wrap;html=1;strokeColor=#666666;fillColor=none;dashed=1;fontSize=14;"
    Add-Actor "employe" "Employe" 50 160
    Add-Actor "chef" "Chef hierarchique" 50 300
    Add-Actor "securite" "Responsable securite" 50 440
    Add-Actor "salles" "Responsable salles" 50 580
    Add-Actor "qualite" "Responsable qualite" 1140 230
    Add-Actor "directeur" "Directeur" 1140 380
    Add-Actor "admin" "Administrateur systeme" 1140 560
    Add-UseCase "uc_auth" "S'authentifier" 360 130
    Add-UseCase "uc_profile" "Consulter son profil" 610 130
    Add-UseCase "uc_event" "Creer / suivre un evenement" 350 250 220
    Add-UseCase "uc_res" "Reserver une salle ou un materiel" 640 250 250
    Add-UseCase "uc_inter" "Declarer une intervention" 350 380 220
    Add-UseCase "uc_validate" "Valider les demandes" 640 380 220
    Add-UseCase "uc_ged" "Gerer les documents GED" 350 520 220
    Add-UseCase "uc_notif" "Recevoir les notifications" 650 520 230
    Add-UseCase "uc_users" "Gerer utilisateurs, roles et droits" 520 680 280
    Add-Edge "e1" "" "employe" "uc_auth" $association
    Add-Edge "e2" "" "employe" "uc_profile" $association
    Add-Edge "e3" "" "employe" "uc_event" $association
    Add-Edge "e4" "" "employe" "uc_res" $association
    Add-Edge "e5" "" "employe" "uc_inter" $association
    Add-Edge "e6" "" "chef" "uc_validate" $association
    Add-Edge "e7" "" "securite" "uc_validate" $association
    Add-Edge "e8" "" "salles" "uc_res" $association
    Add-Edge "e9" "" "qualite" "uc_ged" $association
    Add-Edge "e10" "" "directeur" "uc_validate" $association
    Add-Edge "e11" "" "admin" "uc_users" $association
    Add-Edge "e12" "&lt;&lt;include&gt;&gt;" "uc_res" "uc_notif" $include
    Add-Edge "e13" "&lt;&lt;include&gt;&gt;" "uc_inter" "uc_notif" $include
    Add-Edge "e14" "&lt;&lt;include&gt;&gt;" "uc_event" "uc_notif" $include
}))

$diagrams.Add((New-Graph "02-Classes-authentification-rbac" {
    Add-Class "User" "Utilisateur" @("id: UUID", "username: String", "email: String", "firstName: String", "lastName: String", "enabled: boolean") @("sAuthentifier()", "mettreAJourProfil()") 90 110
    Add-Class "Department" "Departement" @("id: UUID", "code: String", "name: String", "active: boolean") @("activer()", "desactiver()") 420 110
    Add-Class "Role" "Role" @("id: UUID", "name: RoleName", "description: String") @("affecterPermission()") 90 390
    Add-Class "Permission" "Permission" @("id: UUID", "code: String", "module: String", "action: String") @("verifierAcces()") 420 390
    Add-Class "PasswordToken" "JetonReinitialisation" @("id: UUID", "token: String", "expiresAt: Instant", "used: boolean") @("estValide()", "marquerUtilise()") 750 110
    Add-Class "Workflow" "WorkflowDefinition" @("id: UUID", "type: WorkflowType", "active: boolean") @("ajouterEtape()", "ordonnerEtapes()") 750 390
    Add-Class "WorkflowStep" "WorkflowStep" @("id: UUID", "stepCode: WorkflowStepCode", "position: int", "role: RoleName") @("executerAction()") 1080 390
    Add-Edge "a1" "0..* / 0..1" "User" "Department" $association
    Add-Edge "a2" "0..* / 0..*" "User" "Role" $association
    Add-Edge "a3" "0..* / 0..*" "Role" "Permission" $association
    Add-Edge "a4" "0..* / 0..*" "User" "Permission" $association
    Add-Edge "a5" "1 / 0..*" "User" "PasswordToken" $association
    Add-Edge "a6" "1 / 1..*" "Workflow" "WorkflowStep" $association
}))

$diagrams.Add((New-Graph "03-Classes-reservation-evenement" {
    Add-Class "Event" "Evenement" @("id: UUID", "title: String", "eventMode: EventMode", "status: EventStatus", "startAt: Instant", "endAt: Instant") @("soumettre()", "changerStatut()") 80 90
    Add-Class "Reservation" "Reservation" @("id: UUID", "referenceCode: String", "quantityRequested: int", "requesterUsername: String", "status: ReservationStatus", "securityConflict: boolean") @("verifierDisponibilite()", "confirmer()", "rejeter()") 420 90 290 190
    Add-Class "Room" "Salle" @("id: UUID", "name: String", "capacity: int", "location: String", "active: boolean") @("estDisponible()") 820 90
    Add-Class "Equipment" "Materiel" @("id: UUID", "name: String", "quantity: int", "active: boolean") @("reserverQuantite()") 1120 90
    Add-Class "Invitation" "Invitation" @("id: UUID", "email: String", "status: String") @("envoyer()") 80 390
    Add-Class "OfficialDoc" "DocumentOfficielReservation" @("id: UUID", "fileName: String", "uploadedBy: String") @("attacher()") 420 390 290 150
    Add-Class "ReferenceCounter" "CompteurReference" @("id: UUID", "prefix: String", "currentValue: long") @("genererReference()") 820 390
    Add-Edge "r1" "1 / 0..*" "Event" "Reservation" $association
    Add-Edge "r2" "0..* / 0..1" "Reservation" "Room" $association
    Add-Edge "r3" "0..* / 0..1" "Reservation" "Equipment" $association
    Add-Edge "r4" "1 / 0..*" "Event" "Invitation" $association
    Add-Edge "r5" "1 / 0..*" "Reservation" "OfficialDoc" $association
    Add-Edge "r6" "&lt;&lt;utilise&gt;&gt;" "Reservation" "ReferenceCounter" $dependency
}))

$diagrams.Add((New-Graph "04-Classes-intervention-notification" {
    Add-Class "Intervention" "Intervention" @("id: UUID", "title: String", "type: String", "priority: String", "location: String", "requestedBy: String", "assignedTo: String", "status: InterventionStatus") @("soumettre()", "valider()", "assigner()", "resoudre()") 100 110 300 210
    Add-Class "Transition" "ItInterventionTransition" @("id: UUID", "fromStatus: ItWorkflowStatus", "toStatus: ItWorkflowStatus", "actorUsername: String", "comment: String") @("tracerTransition()") 500 110 300 170
    Add-Class "Notification" "Notification" @("id: UUID", "recipientUsername: String", "title: String", "message: String", "type: NotificationType", "read: boolean") @("marquerCommeLue()", "creerDepuisEvenement()") 900 110 330 190
    Add-Class "EmailLog" "NotificationEmailLog" @("id: UUID", "recipientEmail: String", "subject: String", "status: EmailStatus", "sentAt: Instant") @("journaliserSucces()", "journaliserErreur()") 900 420 330 180
    Add-Class "UserRef" "Utilisateur(reference)" @("username: String", "email: String", "role: RoleName") @("recevoirNotification()") 100 430
    Add-Edge "i1" "1 / 0..*" "Intervention" "Transition" $association
    Add-Edge "i2" "&lt;&lt;cree&gt;&gt;" "Intervention" "Notification" $dependency
    Add-Edge "i3" "1 / 0..*" "Notification" "EmailLog" $association
    Add-Edge "i4" "requestedBy, assignedTo" "Intervention" "UserRef" $dependency
    Add-Edge "i5" "recipientUsername" "Notification" "UserRef" $dependency
}))

$diagrams.Add((New-Graph "05-Classes-ged" {
    Add-Class "Document" "Document" @("id: UUID", "referenceCode: String", "title: String", "category: String", "confidentialityLevel: Level", "status: DocumentStatus", "archived: boolean") @("creerVersion()", "publier()", "archiver()") 110 120 310 210
    Add-Class "Folder" "DossierGED" @("id: UUID", "name: String", "parentId: UUID", "path: String") @("creerSousDossier()") 520 120
    Add-Class "Version" "DocumentVersion" @("id: UUID", "versionNumber: int", "fileName: String", "createdBy: String") @("restaurer()") 920 120
    Add-Class "Acl" "DocumentAclEntry" @("id: UUID", "principalType: String", "principal: String", "permission: String") @("autoriser()", "revoquer()") 110 430
    Add-Class "Link" "DocumentLink" @("id: UUID", "targetType: String", "targetId: UUID") @("lierObjetMetier()") 520 430
    Add-Class "Audit" "GedAuditLog" @("id: UUID", "action: String", "actorUsername: String", "createdAt: Instant") @("tracerAction()") 920 430
    Add-Edge "g1" "0..* / 0..1" "Document" "Folder" $association
    Add-Edge "g2" "1 / 1..*" "Document" "Version" $association
    Add-Edge "g3" "1 / 0..*" "Document" "Acl" $association
    Add-Edge "g4" "1 / 0..*" "Document" "Link" $association
    Add-Edge "g5" "1 / 0..*" "Document" "Audit" $association
}))

$diagrams.Add((New-Graph "06-Sequence-authentification" {
    Add-Lifeline "actor" "Utilisateur" 80 80
    Add-Lifeline "front" "Frontend Angular" 300 80
    Add-Lifeline "gateway" "API Gateway" 540 80
    Add-Lifeline "auth" "auth-user-service" 780 80
    Add-Lifeline "keycloak" "Keycloak" 1040 80
    Add-Lifeline "db" "PostgreSQL" 1280 80
    Add-Message "m1" "1. saisirIdentifiants()" "actor" "front"
    Add-Message "m2" "2. POST /auth/login" "front" "gateway"
    Add-Message "m3" "3. transfererRequete()" "gateway" "auth"
    Add-Message "m4" "4. verifierCredentials()" "auth" "keycloak"
    Add-Message "m5" "5. chargerProfilEtDroits()" "auth" "db"
    Add-Message "m6" "6. retournerTokenEtProfil" "auth" "front"
    Add-Node "alt" "alt<br/>[identifiants valides] ouvrir session<br/>[sinon] afficher erreur" 390 430 760 95 "rounded=0;whiteSpace=wrap;html=1;strokeColor=#b7791f;fillColor=#fff7e6;fontSize=12;"
}))

$diagrams.Add((New-Graph "07-Sequence-reservation-salle" {
    Add-Lifeline "emp" "Employe" 80 80
    Add-Lifeline "front" "Frontend Angular" 280 80
    Add-Lifeline "gateway" "API Gateway" 500 80
    Add-Lifeline "reservation" "reservation-service" 730 80
    Add-Lifeline "event" "event-service" 980 80
    Add-Lifeline "notification" "notification-service" 1220 80
    Add-Message "m1" "1. saisirReservation()" "emp" "front"
    Add-Message "m2" "2. POST /reservations" "front" "gateway"
    Add-Message "m3" "3. verifierDisponibilite()" "gateway" "reservation"
    Add-Message "m4" "4. rattacherEvenement()" "reservation" "event"
    Add-Message "m5" "5. enregistrerReservation()" "reservation" "reservation"
    Add-Message "m6" "6. notifierResponsables()" "reservation" "notification"
    Add-Message "m7" "7. afficherStatut(PENDING)" "reservation" "front"
    Add-Node "opt" "opt<br/>[conflit securite] transmettre au responsable securite pour decision" 390 430 850 80 "rounded=0;whiteSpace=wrap;html=1;strokeColor=#b7791f;fillColor=#fff7e6;fontSize=12;"
}))

$diagrams.Add((New-Graph "08-Sequence-intervention-it" {
    Add-Lifeline "emp" "Employe" 70 80
    Add-Lifeline "front" "Frontend Angular" 270 80
    Add-Lifeline "gateway" "API Gateway" 490 80
    Add-Lifeline "intervention" "intervention-service" 720 80
    Add-Lifeline "auth" "auth-user-service" 980 80
    Add-Lifeline "notif" "notification-service" 1230 80
    Add-Message "m1" "1. declarerPanne()" "emp" "front"
    Add-Message "m2" "2. POST /interventions" "front" "gateway"
    Add-Message "m3" "3. controlerPermissions()" "gateway" "intervention"
    Add-Message "m4" "4. verifierRoleDemandeur()" "intervention" "auth"
    Add-Message "m5" "5. enregistrerIntervention(REQUESTED)" "intervention" "intervention"
    Add-Message "m6" "6. notifierChefHierarchique()" "intervention" "notif"
    Add-Node "loop" "loop<br/>validation chef, validation DSN, traitement IT, resolution" 390 410 810 85 "rounded=0;whiteSpace=wrap;html=1;strokeColor=#b7791f;fillColor=#fff7e6;fontSize=12;"
    Add-Message "m7" "7. afficherSuivi()" "intervention" "front"
}))

$diagrams.Add((New-Graph "09-Architecture-composants" {
    Add-Node "frontend" "Frontend Angular" 80 110 220 90 "rounded=0;whiteSpace=wrap;html=1;strokeColor=#2f5597;fillColor=#eef4ff;fontSize=14;"
    Add-Node "gateway" "API Gateway" 390 110 220 90 "rounded=0;whiteSpace=wrap;html=1;strokeColor=#2f5597;fillColor=#eef4ff;fontSize=14;"
    Add-Node "keycloak" "Keycloak<br/>IAM / OAuth2" 700 110 220 90 "rounded=0;whiteSpace=wrap;html=1;strokeColor=#2f5597;fillColor=#eef4ff;fontSize=14;"
    Add-Node "eureka" "Eureka Discovery" 1010 110 220 90 "rounded=0;whiteSpace=wrap;html=1;strokeColor=#2f5597;fillColor=#eef4ff;fontSize=14;"
    Add-Node "auth" "auth-user-service" 80 330 220 80 "rounded=0;whiteSpace=wrap;html=1;strokeColor=#555555;fillColor=#f8fbff;fontSize=13;"
    Add-Node "event" "event-service" 330 330 220 80 "rounded=0;whiteSpace=wrap;html=1;strokeColor=#555555;fillColor=#f8fbff;fontSize=13;"
    Add-Node "reservation" "reservation-service" 580 330 220 80 "rounded=0;whiteSpace=wrap;html=1;strokeColor=#555555;fillColor=#f8fbff;fontSize=13;"
    Add-Node "intervention" "intervention-service" 830 330 220 80 "rounded=0;whiteSpace=wrap;html=1;strokeColor=#555555;fillColor=#f8fbff;fontSize=13;"
    Add-Node "ged" "ged-service" 1080 330 220 80 "rounded=0;whiteSpace=wrap;html=1;strokeColor=#555555;fillColor=#f8fbff;fontSize=13;"
    Add-Node "notification" "notification-service" 580 540 220 80 "rounded=0;whiteSpace=wrap;html=1;strokeColor=#555555;fillColor=#f8fbff;fontSize=13;"
    Add-Node "postgres" "PostgreSQL<br/>base par service" 80 700 260 90 "shape=cylinder3d;whiteSpace=wrap;html=1;boundedLbl=1;backgroundOutline=1;size=15;strokeColor=#555555;fillColor=#f8fbff;fontSize=13;"
    Add-Node "smtp" "Serveur SMTP" 960 700 220 80 "rounded=0;whiteSpace=wrap;html=1;strokeColor=#555555;fillColor=#f8fbff;fontSize=13;"
    Add-Edge "c1" "REST / JWT" "frontend" "gateway" $association
    Add-Edge "c2" "validation token" "gateway" "keycloak" $dependency
    Add-Edge "c3" "routage" "gateway" "auth" $association
    Add-Edge "c4" "routage" "gateway" "event" $association
    Add-Edge "c5" "routage" "gateway" "reservation" $association
    Add-Edge "c6" "routage" "gateway" "intervention" $association
    Add-Edge "c7" "routage" "gateway" "ged" $association
    Add-Edge "c8" "notifications internes" "event" "notification" $dependency
    Add-Edge "c9" "notifications internes" "reservation" "notification" $dependency
    Add-Edge "c10" "notifications internes" "intervention" "notification" $dependency
    Add-Edge "c11" "persistance" "auth" "postgres" $dependency
    Add-Edge "c12" "persistance" "event" "postgres" $dependency
    Add-Edge "c13" "persistance" "reservation" "postgres" $dependency
    Add-Edge "c14" "persistance" "intervention" "postgres" $dependency
    Add-Edge "c15" "persistance" "ged" "postgres" $dependency
    Add-Edge "c16" "persistance" "notification" "postgres" $dependency
    Add-Edge "c17" "emails" "notification" "smtp" $dependency
}))

$mxfile = '<mxfile host="app.diagrams.net" modified="' + (Get-Date).ToUniversalTime().ToString("s") + 'Z" agent="Codex" version="24.7.17" type="device" compressed="false">' + (($diagrams | ForEach-Object { $_ }) -join "") + '</mxfile>'
Set-Content -LiteralPath "rapport\complements-uml\cnstn-complements-uml.drawio" -Value $mxfile -Encoding UTF8

$latex = @'
\section{Compléments UML de conception}

Les diagrammes ajoutés complètent la version compilée du rapport en distinguant les vues UML attendues : cas d'utilisation, classes, séquences et composants. Chaque diagramme reste centré sur une responsabilité afin d'éviter la surcharge visuelle et de maintenir la cohérence entre acteurs, classes métier et messages échangés.

\subsection{Diagramme global des cas d'utilisation}

Le diagramme global identifie les acteurs externes de la plateforme intranet CNSTN : employé, chef hiérarchique, responsable sécurité, responsable des salles, responsable qualité, directeur et administrateur système. Les cas d'utilisation principaux sont l'authentification, la gestion du profil, la création et le suivi des événements, la réservation des ressources, la déclaration des interventions, la gestion GED, la validation des demandes et l'administration des utilisateurs, rôles et permissions. Les notifications sont modélisées comme un cas inclus par les processus qui produisent une décision ou un changement d'état.

\subsection{Diagrammes de classes}

Les diagrammes de classes sont séparés par domaine fonctionnel pour conserver une lecture claire. Le domaine authentification et habilitations s'appuie sur les classes Utilisateur, Département, Rôle, Permission, JetonRéinitialisation et Workflow. Le domaine réservation relie Événement, Réservation, Salle, Matériel, Invitation, Document officiel et Compteur de référence. Le domaine intervention met en relation Intervention, Transition de workflow, Notification, Journal d'email et Utilisateur référencé. Le domaine GED repose sur Document, Dossier, Version, ACL, Lien documentaire et Journal d'audit.

Les multiplicités indiquent les contraintes principales du modèle : un utilisateur peut appartenir à un département, posséder plusieurs rôles et permissions ; une réservation peut viser une salle ou un matériel ; un document possède au moins une version ; une intervention peut générer plusieurs transitions et notifications.

\subsection{Diagrammes de séquence}

Les séquences détaillent les scénarios majeurs de la V1. L'authentification commence par la saisie des identifiants dans Angular, passe par l'API Gateway, puis par le service auth-user qui délègue la vérification à Keycloak et charge le profil depuis PostgreSQL. La réservation de salle vérifie la disponibilité, rattache la demande à un événement, enregistre la réservation puis notifie les responsables. La déclaration d'intervention contrôle les droits du demandeur, crée l'intervention à l'état initial et déclenche le circuit de validation chef, DSN et responsable IT.

\subsection{Diagramme de composants}

L'architecture est représentée sous forme de composants : Angular communique avec l'API Gateway, qui route les appels vers les microservices Spring Boot. Keycloak assure l'identité et la validation OAuth2/JWT, Eureka permet la découverte de services, PostgreSQL héberge une base logique par service, et le service notification centralise les notifications applicatives et les emails via SMTP.
'@
Set-Content -LiteralPath "rapport\complements-uml\texte-a-integrer-rapport.tex" -Value $latex -Encoding UTF8

$readme = @'
# Compléments UML CNSTN

Ce dossier contient les éléments à intégrer au rapport PFE à partir de l'aperçu compilé.

- `cnstn-complements-uml.drawio` : fichier Draw.io multi-pages contenant les diagrammes UML.
- `texte-a-integrer-rapport.tex` : texte LaTeX prêt à insérer dans les sections Analyse et Conception.

Pages du fichier Draw.io :

1. Cas d'utilisation global
2. Classes authentification et RBAC
3. Classes réservation et événement
4. Classes intervention et notification
5. Classes GED
6. Séquence authentification
7. Séquence réservation salle
8. Séquence intervention IT
9. Architecture composants

Les diagrammes respectent les bonnes pratiques demandées : séparation par vue, noms d'opérations lisibles, multiplicités sur les associations principales, fragments `alt`, `opt` et `loop` pour les séquences, et cohérence entre classes et messages.
'@
Set-Content -LiteralPath "rapport\complements-uml\README.md" -Value $readme -Encoding UTF8
