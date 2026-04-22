# Backlog Test Matrix (ISET DSI level)

Ce document mappe les user stories backlog vers les tests automatiques du script:

`scripts/backlog-functional-tests.ps1`

| ID | Acteur | Story backlog | Endpoint(s) teste(s) |
|---|---|---|---|
| 1 | Tous | Authentification | `POST /realms/{realm}/protocol/openid-connect/token` (7 comptes) |
| 2 | Tous | Deconnexion | `GET /api/v1/notifications` sans token => `401/403` |
| 3 | Admin | Ajouter utilisateur | `POST /api/v1/admin/users` |
| 4 | Admin | Modifier utilisateur | `PUT /api/v1/admin/users/{id}` |
| 5 | Admin | Supprimer utilisateur | `DELETE /api/v1/admin/users/{id}` |
| 6 | Admin | Attribuer roles | `PUT /api/v1/admin/users/{id}/roles` |
| 7 | Admin | Ajouter service | `POST /api/v1/admin/departments` |
| 8 | Admin | Modifier service | `PUT /api/v1/admin/departments/{id}` |
| 9 | Admin | Supprimer service | `DELETE /api/v1/admin/departments/{id}` |
| 10 | Employe/Chef | Modifier profil | `PATCH /api/v1/me/profile` |
| 11 | Employe | Organiser evenement | `POST /api/v1/events` |
| 12 | Employe | Reserver salle | `POST /api/v1/reservations` avec `roomId` |
| 13 | Employe | Reserver equipement | `POST /api/v1/reservations` avec `equipmentId` |
| 14 | Employe | Demander intervention | `POST /api/v1/interventions` |
| 15 | Employe | Consulter document | `GET /api/v1/documents` |
| 16 | Employe | Ajouter partenaire | `POST /api/v1/events/{id}/partners` |
| 17 | Responsable salle | Gerer salle | `POST/PUT/DELETE /api/v1/rooms` |
| 18 | Responsable salle | Gerer equipement | `POST/PUT/DELETE /api/v1/equipments` |
| 19 | Responsable salle | Gerer intervention | `PUT /api/v1/interventions/{id}/status` + `/validate` |
| 20 | Chef hierarchique | Valider evenement | `PUT /api/v1/events/{id}/decision` (`approved=true`) |
| 21 | Chef hierarchique | Refuser evenement | `PUT /api/v1/events/{id}/decision` (`approved=false`) |
| 22 | Responsable securite | Gerer reservation | `GET /api/v1/reservations/conflicts` + `PUT /security-validation` |
| 23 | Directeur DSN | Verifier acces partenaire | `GET /api/v1/events/{id}/partners` |
| 24 | Directeur DSN | Consulter tableau de bord | `GET /api/v1/kpis/dashboard` |
| 25 | Responsable qualite | Gerer workflow GED | `PUT /api/v1/documents/{id}/submit` + `/approve` |
| 26 | Responsable qualite | Publier document | `PUT /api/v1/documents/{id}/publish` |
| 27 | Responsable qualite | Approuver document | `PUT /api/v1/documents/{id}/approve` |
| 28 | Employe | Rejoindre evenement en ligne (Zoom SDK) | `POST /api/v1/events` (`onlineEvent=true`) + `POST /api/v1/events/{id}/zoom-signature` |

Rapport JSON genere:

`test-reports/backlog-functional-report.json`
