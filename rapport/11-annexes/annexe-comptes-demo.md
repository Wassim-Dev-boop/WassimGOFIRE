# Annexe - Comptes de demonstration

Date: 2026-04-28

## Comptes applicatifs
| Role | Username | Mot de passe demo | Description d utilisation |
|---|---|---|---|
| Administrateur | `admin.cnstn` | `Admin@12345` | Pilotage global, administration utilisateurs, supervision modules |
| Employe | `employe.cnstn` | `User@12345` | Creation demandes (evenements, reservations, interventions) |
| Chef hierarchique | `chef.cnstn` | `User@12345` | Validation manager et suivi des demandes |
| Responsable salle | `salle.cnstn` | `User@12345` | Gestion salles/equipements et traitement reservations |
| Responsable securite | `securite.cnstn` | `User@12345` | Validation securite reservations/evenements |
| Responsable qualite | `qualite.cnstn` | `User@12345` | GED, publication documentaire, qualite |
| Directeur DSN | `directeur.cnstn` | `User@12345` | Decision DSN et pilotage transverse |
| Responsable IT | `it.cnstn` | `User@12345` | Workflow IT et gestion parc informatique |

## Notes
- Les comptes sont precharges via Keycloak (`backend/infra/keycloak/realm-export.json`) et synchronises dans `auth_user_db`.
- Les services de demonstration associes sont nettoyes et alignes: `DSI`, `Administration`, `Qualite`, `Securite`.
