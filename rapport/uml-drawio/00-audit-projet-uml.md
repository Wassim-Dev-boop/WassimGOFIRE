# Audit projet UML - CNSTN Intranet

Date d'audit : 2026-05-07.
Portee : audit base sur le depot local, sans ajout de fonctionnalite non confirmee.

## Sources analysees

- `README.md`
- `backend/README.md`
- `backend/docker-compose.yml`
- `backend/api-gateway/src/main/resources/application.yml`
- `backend/docs/ENDPOINTS.md`
- `backend/infra/keycloak/realm-export.json`
- `frontend/src/app/app.routes.ts`
- `frontend/src/app/core/models/*.ts`
- `frontend/src/app/core/services/*.ts`
- `backend/*-service/src/main/java/**/controller/*.java`
- `backend/*-service/src/main/java/**/entity/*.java`
- `backend/*-service/src/main/resources/db/migration/*.sql`

## Microservices confirmes

- `api-gateway`
- `config-server`
- `discovery-server`
- `auth-user-service`
- `event-service`
- `reservation-service`
- `intervention-service`
- `ged-service`
- `notification-service`

## Acteurs confirmes par le code

Rôles Keycloak confirmes dans `backend/infra/keycloak/realm-export.json` et les `@PreAuthorize` backend :

- Administrateur : `ADMIN`
- Employe : `EMPLOYE` cote backend, `EMPLOYEE` cote frontend
- Chef hierarchique : `CHEF_HIERARCHIQUE` cote backend, `MANAGER` cote frontend
- Responsable salle : `RESPONSABLE_SALLE` cote backend, `ROOM_MANAGER` cote frontend
- Responsable securite : `RESPONSABLE_SECURITE` cote backend, `SECURITY_MANAGER` cote frontend
- Directeur DSN : `DIRECTEUR_DSN` cote backend, `DSN_DIRECTOR` cote frontend
- Responsable qualite : `RESPONSABLE_QUALITE` cote backend, `QUALITY_MANAGER` cote frontend
- Responsable IT : `RESPONSABLE_IT` cote backend, `IT_MANAGER` cote frontend
- Partenaire externe : confirme comme destinataire d'invitation email via `PartnerInvitationEntity` et `POST /api/v1/events/{id}/partners`, mais pas comme utilisateur applicatif authentifie.

## Modules confirmes par le code

- Authentification, deconnexion, inscription publique et recuperation de mot de passe.
- Profil utilisateur.
- Administration des utilisateurs, roles, permissions et departements.
- Administration des workflows.
- Tableau de bord Angular.
- Gestion documentaire GED.
- Gestion des evenements : creation, modification, soumission, workflow de validation, invitations internes, invitations partenaires, album photos, salle virtuelle.
- Gestion des salles.
- Gestion des equipements reservables.
- Reservations de salles et d'equipements.
- Controle de disponibilite et conflits de reservation.
- Validation securite des reservations.
- Notifications applicatives, SSE, journaux email et renvoi email.
- Interventions logistiques.
- Interventions IT.
- Parc et affectations d'equipements IT.
- Supervision/infrastructure : API Gateway, Eureka, Config Server, Docker Compose, PostgreSQL, pgAdmin, Keycloak, MailHog.

## Entites backend confirmees

### auth-user-service

- `UserEntity`
- `RoleEntity`
- `DepartmentEntity`
- `PermissionEntity`
- `PasswordResetTokenEntity`
- `WorkflowDefinitionEntity`
- `WorkflowStepEntity`
- `WorkflowAuditLogEntity`
- `ItEquipmentCategoryEntity`
- `ItEquipmentEntity`
- `ItEquipmentAssignmentEntity`

### event-service

- `EventEntity`
- `PartnerInvitationEntity`
- `EventInvitationEntity`
- `EventPhotoEntity`
- `EventOfficialDocumentEntity`
- `EventReferenceCounterEntity`

### reservation-service

- `RoomEntity`
- `EquipmentEntity`
- `ReservationEntity`
- `ReservationOfficialDocumentEntity`
- `ReservationReferenceCounterEntity`

### ged-service

- `DocumentEntity`
- `DocumentVersionEntity`
- `DocumentAclEntryEntity`
- `DocumentLinkEntity`
- `GedFolderEntity`
- `GedAuditLogEntity`
- `GedReferenceCounterEntity`

### intervention-service

- `InterventionEntity`
- `ItInterventionTransitionEntity`

### notification-service

- `NotificationEntity`
- `NotificationEmailLogEntity`

## Controleurs REST confirmes

- Auth/profil/admin : `AuthRegistrationController`, `PasswordRecoveryController`, `ProfileController`, `AdminUserController`, `AdminRoleController`, `AdminDepartmentController`, `AdminPermissionController`, `AdminUserPermissionController`, `AdminRolePermissionController`, `AdminWorkflowController`, `PublicDepartmentController`, `InternalUserController`, `InternalPermissionController`.
- Parc IT : `ItEquipmentController`, `ItEquipmentCategoryController`, `ItEquipmentAssignmentController`, `InternalItEquipmentController`.
- Evenements : `EventController`, `InternalEventWorkflowController`.
- Reservations : `RoomController`, `EquipmentController`, `ReservationController`, `InternalReservationWorkflowController`.
- GED : `DocumentController`.
- Interventions : `InterventionController`, `ItInterventionController`.
- Notifications : `NotificationController`, `InternalNotificationController`, `InternalEmailController`.

## Routes frontend Angular confirmees

- `/accueil`
- `/signin`, `/login` redirige vers `/signin`
- `/signup`, `/inscription` redirige vers `/signup`
- `/forgot-password`
- `/reset-password`
- `/dashboard`
- `/profile`
- `/documents`
- `/events`
- `/events/:id/album`
- `/events/:id/meeting`
- `/invitations`
- `/reservations/salles`
- `/reservations/equipements`
- `/it/equipements`
- `/it/interventions`
- `/interventions`
- `/notifications`
- `/admin/workflows`
- `/admin`

## Enums importants confirmes

- Roles : `RoleName` avec `ADMIN`, `EMPLOYE`, `CHEF_HIERARCHIQUE`, `RESPONSABLE_SALLE`, `RESPONSABLE_SECURITE`, `DIRECTEUR_DSN`, `RESPONSABLE_QUALITE`, `RESPONSABLE_IT`.
- Workflows : `WorkflowType`, `WorkflowStepCode`, `WorkflowConditionType`, `WorkflowActionType`, `WorkflowAuditActionType`.
- Evenements : `EventStatus`, `EventType`, `EventMode`, `EventWorkflowStep`, `EventInvitationStatus`, `EventOfficialDocumentType`.
- Reservations : `ReservationStatus`, `RoomOperationalStatus`, `EquipmentOperationalStatus`, `ReservationOfficialDocumentType`, `EventMode`.
- GED : `DocumentStatus`, `DocumentConfidentialityLevel`, `DocumentAclType`, `DocumentLinkType`.
- Interventions : `InterventionStatus`, `ItWorkflowStatus`.
- Equipements IT : `ItEquipmentState`.
- Notifications/email : `EmailDeliveryStatus`. Le type de notification est expose cote frontend sous `NotificationType`; cote backend il est stocke comme chaine dans `NotificationEntity`.

## Workflows reels confirmes

### Authentification

- Angular appelle `POST /api/v1/auth/login`.
- `auth-user-service` transmet les identifiants a Keycloak via le grant password.
- Keycloak renvoie `access_token` et `refresh_token`.
- Angular persiste la session, lit le profil via `/api/v1/me` et les permissions, puis redirige l'utilisateur.
- En cas 400/401, une erreur d'identifiants invalides est remontee.

### Reservation salle/equipement

- L'utilisateur selectionne un evenement, une salle ou un equipement, un creneau et une quantite eventuelle.
- `reservation-service` refuse les demandes sans ressource unique ou avec fin avant debut.
- Le service appelle `event-service` pour verifier le contexte evenement et le mode.
- Les evenements `EN_LIGNE` ne permettent pas de reservation physique.
- Les salles/equipements doivent etre actifs et disponibles.
- Le controle de conflit bloque sur les reservations `PENDING` et `APPROVED`.
- Une reservation valide est creee en statut `PENDING`, avec reference et document de demande.
- Une notification interne est envoyee au demandeur si possible.
- Le responsable securite peut approuver/refuser via `PUT /api/v1/reservations/{id}/security-validation`, ce qui genere un document de decision et des notifications.

### Workflow evenement

- Creation : `EventEntity` en `DRAFT` et `BROUILLON`.
- Modification autorisee seulement en `BROUILLON` ou `REFUSE`, sauf override admin.
- Soumission : passage en `PENDING` et `VALIDATION_MANAGER`, generation d'un document de soumission et notification.
- Decision chef hierarchique : refuse vers `REJECTED/REFUSE`, ou progresse vers securite si reservation physique, DSN si partenaires externes, ou approbation directe.
- Decision securite : applique aussi la validation des reservations liees via `reservation-service`; progresse vers DSN, responsable salle, ou approbation.
- Decision DSN : requise pour evenements avec partenaires externes, puis responsable salle si preparation necessaire ou approbation.
- Decision responsable salle : approbation finale ou refus.
- Les invitations internes et partenaires sont implementees; les partenaires recoivent des emails.

### GED

- Module confirme par routes frontend, `DocumentController`, entites documentaires, versions, ACL, liens, dossiers et audit.
- Workflow de document configure via `GED_DOCUMENT_WORKFLOW` et endpoints documentaires de soumission/approbation/publication dans `backend/docs/ENDPOINTS.md`.

### Interventions

- Deux surfaces confirmees : interventions logistiques et interventions IT.
- Les workflows et statuts IT existent via `ItWorkflowStatus` et `ItInterventionController`.
- Ce module est inclus dans l'audit et le cas d'utilisation global car il existe dans le depot, meme s'il n'est pas detaille dans les sequences demandees.

## Elements exclus ou non representes faute de preuve suffisante

- Application mobile : aucun module mobile trouve.
- Module budget : aucun service, route ou entite budget trouve.
- Workflow de signature electronique : aucune preuve directe trouvee.
- Messagerie interne conversationnelle : seules les notifications et emails existent; pas de messagerie utilisateur a utilisateur.
- Posts publics / reseau social : aucune entite ou route de posts publics trouvee.
- Procedures qualite comme module autonome : le role qualite et la GED existent, mais aucun module dedie de procedures qualite n'a ete isole.
- Paiement, facturation, stock financier : non trouve.

## Notes de prudence UML

- Le diagramme de classes global est volontairement synthétique pour rester lisible dans un rapport PFE; toutes les entites confirmees sont listees dans cet audit.
- Les relations interservices `EventEntity` -> `ReservationEntity` utilisent `eventId` UUID et non une association JPA directe.
- Les roles frontend sont mappes vers les roles backend via `role-mapper.util.ts`; les noms affiches dans les diagrammes sont francises quand possible.
- `MailHog` est present dans `docker-compose.yml` meme si le README mentionne aussi une configuration SMTP Gmail possible via variables d'environnement.
