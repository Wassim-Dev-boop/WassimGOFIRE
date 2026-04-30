# Resultats tests finaux avant nettoyage

Date: 2026-04-28

## Sauvegarde prealable
- Type: copie complete du projet (Git non disponible dans le PATH)
- Emplacement: `C:\Users\wassi\wassimGoFire_backup_validated_before_cleanup_20260428-183839`
- Verification: dossier existant, 45501 elements copies

## Backend
Commande: `mvn test`
- Statut: SUCCESS (exit code 0)
- Debut: 2026-04-28T18:40:19
- Fin: 2026-04-28T18:40:58
- Resume: reactor complet OK (`api-gateway`, `config-server`, `discovery-server`, `auth-user-service`, `event-service`, `reservation-service`, `intervention-service`, `ged-service`, `notification-service`, `reporting-service`).

## Frontend build
Commande: `npm run build`
- Statut: SUCCESS (exit code 0)
- Debut: 2026-04-28T18:41:02
- Fin: 2026-04-28T18:41:23
- Note: warnings de budget CSS et module CommonJS `react-dom` (non bloquants).

## Frontend tests unitaires
Commande: `npm test -- --watch=false --browsers=ChromeHeadless`
- Statut: SUCCESS (exit code 0)
- Debut: 2026-04-28T18:41:28
- Fin: 2026-04-28T18:41:37
- Resume: 41/41 tests SUCCESS

## Frontend E2E Playwright
Commande: `npx playwright test --project=chrome-local --workers=1`
- Statut: SUCCESS (exit code 0)
- Debut: 2026-04-28T18:41:42
- Fin: 2026-04-28T18:44:11
- Resume: 36/36 tests SUCCESS

## Docker etat services
Commande: `docker compose ps`
- Statut: SUCCESS (exit code 0)
- Date controle: 2026-04-28T18:44:16
- Services principaux UP verifies:
  - frontend
  - api-gateway
  - postgres (healthy)
  - keycloak
  - auth-user-service
  - event-service
  - reservation-service
  - intervention-service
  - ged-service
  - notification-service
  - reporting-service
