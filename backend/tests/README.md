# 📚 INDEX - Suite de Test CNSTN Intranet (60 Tests)
## Quick Navigation & Documentation Hub
**Généré**: 20 avril 2026  
**Status**: ✅ Complet & Prêt

---

## 🚀 DÉMARRAGE RAPIDE

### Pour Exécuter les Tests
```bash
cd backend/tests
npm install --save-dev @playwright/test
npm test
```

### Pour Voir le Rapport
```bash
npm run test:report
```

---

## 📖 DOCUMENTATION

### 🎯 Commencer Ici
| Document | Audience | Contenu |
|----------|----------|---------|
| **[FINAL_REPORT.md](FINAL_REPORT.md)** | Tous | ✅ Résumé complet du livrable (20 min read) |
| **[EXECUTION_SUMMARY.md](EXECUTION_SUMMARY.md)** | Testeurs | ✅ Guide exécution des 60 tests (30 min read) |
| **[TEST_EXECUTION_REPORT.md](TEST_EXECUTION_REPORT.md)** | Managers | ✅ Matrice couverture & statuts (15 min read) |
| **[DETAILED_TEST_REPORT.md](DETAILED_TEST_REPORT.md)** | Devs | ⚠️ Blocage 401 & investigation (20 min read) |

### 📚 Référence Stratégie QA (Session Précédente)
| Document | Audience | Contenu |
|----------|----------|---------|
| **[../docs/QA_TEST_STRATEGY.md](../docs/QA_TEST_STRATEGY.md)** | Tous | ✅ Stratégie complète (2500+ lignes) |
| Part A | Docs | 17 workflows détaillés |
| Part B | Docs | Matrice 60 tests |
| Part C | Tests | Cas de test détaillés |
| Part D | Tests | 4 E2E scenarios |
| Part E | Security | RBAC matrix (8×7) |
| Part F | Data | Test data spec |
| Part G | Tests | Non-functional tests |
| Part H | Risk | Probable bugs |
| Part I | Plan | Ordre d'exécution |
| Bonus 1 | Recette | 5-day manual checklist |
| Bonus 2 | Dev | Automation structure |
| Bonus 3 | Dev | Code examples |
| Bonus 4 | Priority | Top 15 tests |
| Bonus 5 | PO | 10 PO questions |

---

## 🛠️ FICHIERS IMPLÉMENTATION

### Framework & Configuration
```
playwright.config.ts              ← Playwright setup (60 lignes)
  • Chromium headless
  • 4 parallel workers
  • HTML/JSON/JUnit reporters
  • Screenshot & video on failure
```

### Code de Test
```
e2e/all-60-tests.spec.ts          ← 60 tests (900+ lignes)
  • 10 Smoke tests (P0)
  • 5 Authentication tests
  • 5 User Management tests
  • 3 Event tests
  • 4 Room Reservation tests
  • 2 Equipment tests
  • 2 Intervention tests
  • 3 GED Document tests
  • 5 Partners & Security tests
  • 3 Room Management tests
  • 2 Equipment Management tests
  • 2 Intervention Management tests
  • 4 Security Verification tests
  • 2 Direction Dashboard tests
  • 3 GED Workflow tests
  • 3 Permissions tests
  • 3 API Validation tests
  • 1 Email & Notification test
  • 3 Concurrency & Data tests
  • 2 Performance & Load tests
```

### Helpers & Utilities
```
support/helpers.ts               ← Test utilities (120 lignes)
  • TEST_USERS (7 users)
  • login(page, user)
  • logout(page)
  • getToken(page)
  • apiCall(page, method, url, data)
```

### Package Management
```
package.json                      ← npm configuration
  • "test": playwright test
  • "test:smoke": --grep @smoke
  • "test:report": show-report
```

### Diagnostic
```
test-auth.ps1                     ← PowerShell auth test
  • Keycloak token request
  • API Gateway validation
  • 401 error diagnosis
```

---

## 📊 COUVERTURE TEST

### Résumé Numérique
```
Total Tests:              60
├─ Smoke (P0)             10
├─ Functional (P1)        48
└─ Performance (P2)        2

By Role:                 60
├─ ADMIN                 10
├─ EMPLOYE               15
├─ CHEF_HIERARCHIQUE      5
├─ RESPONSABLE_SALLE      7
├─ RESPONSABLE_SECURITE   4
├─ DIRECTEUR_DSN          4
└─ RESPONSABLE_QUALITE    2

By Domain:               60
├─ Authentication         5
├─ User Management        5
├─ Events                 3
├─ Rooms                  4
├─ Equipment              2
├─ Interventions          2
├─ GED Documents          3
├─ Partnerships           5
├─ Admin                  5
├─ Dashboard              2
├─ API                    3
├─ Email                  1
├─ Concurrency            3
└─ Performance            2
```

---

## 🔑 TEST USERS (7 Rôles)

```
1. admin.cnstn
   Password: Admin@12345
   Role: ADMIN
   Access: Full system

2. employe.cnstn
   Password: User@12345
   Role: EMPLOYE
   Access: Events, Reservations

3. chef.cnstn
   Password: User@12345
   Role: CHEF_HIERARCHIQUE
   Access: Event validation, Team

4. salle.cnstn
   Password: User@12345
   Role: RESPONSABLE_SALLE
   Access: Room & Equipment management

5. securite.cnstn
   Password: User@12345
   Role: RESPONSABLE_SECURITE
   Access: Conflict checking, Security

6. directeur.cnstn
   Password: User@12345
   Role: DIRECTEUR_DSN
   Access: Partner approval, Analytics

7. qualite.cnstn
   Password: User@12345
   Role: RESPONSABLE_QUALITE
   Access: Document publishing, GED
```

---

## 🌐 SERVICES TARGETS

```
Frontend              http://localhost:4200
API Gateway           http://localhost:8088
Keycloak             http://localhost:8090
  - Realm: cnstn-intranet
  - Token Endpoint: /protocol/openid-connect/token
  - JWKS Endpoint: /protocol/openid-connect/certs

Microservices (internes):
├─ auth-user-service     :8081
├─ event-service         :8082
├─ reservation-service   :8083
├─ intervention-service  :8084
├─ ged-service          :8085
├─ notification-service :8086
├─ reporting-service    :8087
└─ config-server        (internal)
```

---

## 🔍 STATUT EXÉCUTION

### ✅ Complété
```
✓ 60 tests codés en TypeScript
✓ Framework Playwright configuré
✓ 7 utilisateurs définis
✓ Helpers d'authentification
✓ Documentation exhaustive (3000+ lignes)
✓ Keycloak token generation fonctionnel
```

### ⏳ En Attente
```
□ Fix 401 Unauthorized (API Gateway)
□ Exécution smoke tests
□ Exécution 60 tests complets
□ Génération rapports HTML
```

### 🔴 Blockers Identifiés
```
1x 401 Unauthorized
  Keycloak: ✅ Token généré
  API Gateway: ❌ Token rejeté
  Root Cause: JWT validation configuration issue
  Impact: Tous les 60 tests ne peuvent pas s'exécuter
```

---

## 📋 CHECKLIST AVANT EXÉCUTION

### Prérequis
- [ ] Docker services running: `docker compose ps`
- [ ] Frontend accessible: http://localhost:4200
- [ ] API Gateway accessible: http://localhost:8088
- [ ] Keycloak accessible: http://localhost:8090
- [ ] All 13 containers UP

### Setup
- [ ] Node.js 16+ installé
- [ ] npm install dans `backend/tests/`
- [ ] Playwright installed (ou utiliser sans UI)

### Configuration
- [ ] Keycloak realm: cnstn-intranet
- [ ] 7 test users créés
- [ ] API Gateway JWT validation configurée

### Exécution
- [ ] `npm test` pour tous les 60 tests
- [ ] `npm run test:smoke` pour 10 smoke tests
- [ ] `npm run test:report` pour voir résultats

---

## 🎯 COMMANDES CLÉS

### Setup
```bash
cd backend/tests
npm install --save-dev @playwright/test
npx playwright install --with-deps
```

### Exécution
```bash
# Tous les tests
npm test

# Smoke tests seulement
npm run test:smoke

# Tests spécifiques
npx playwright test --grep "Login"
npx playwright test --grep "RBAC"
npx playwright test --grep "Authentication"
```

### Rapports
```bash
# Voir rapport HTML
npm run test:report

# Afficher rapports JSON
cat test-results/results.json | jq

# JUnit pour CI/CD
cat test-results/junit.xml
```

### Debug
```bash
# Mode debug (UI interactif)
npx playwright test --debug

# Avec mode headed (voir navigateur)
npx playwright test --headed

# Verbose output
npx playwright test --reporter=verbose
```

---

## 📁 STRUCTURE RÉPERTOIRE

```
backend/
├── tests/                           ← CETTE SUITE
│   ├── e2e/
│   │   └── all-60-tests.spec.ts    ← 60 tests (900+ lines)
│   ├── support/
│   │   └── helpers.ts              ← Utilities (120 lines)
│   ├── test-results/               ← Generated after run
│   │   ├── results.json
│   │   ├── junit.xml
│   │   └── index.html
│   ├── playwright.config.ts        ← Framework config
│   ├── package.json                ← npm setup
│   ├── test-auth.ps1               ← Diagnostic script
│   ├── FINAL_REPORT.md             ← This suite overview
│   ├── EXECUTION_SUMMARY.md        ← Detailed guide
│   ├── TEST_EXECUTION_REPORT.md    ← Coverage matrix
│   └── DETAILED_TEST_REPORT.md     ← Blocker analysis
│
├── docs/
│   └── QA_TEST_STRATEGY.md         ← Full strategy (2500+ lines)
│       ├── Part A: 17 workflows
│       ├── Part B: 60 test matrix
│       ├── Part C: Test cases
│       ├── Part D: E2E scenarios
│       ├── Part E: RBAC matrix
│       ├── Part F: Test data
│       ├── Part G: Non-functional
│       ├── Part H: Bug risks
│       ├── Part I: Execution order
│       └── Bonus 1-5: Extras
│
├── docker-compose.yml              ← All services
├── infra/
│   └── keycloak/
│       └── realm-export.json       ← 7 users, 7 roles
│
└── api-gateway/
    └── src/main/java/.../SecurityConfig.java
        (CORS + JWT config - fixed in previous session)
```

---

## 🎓 GUIDES PAR ROLE

### Pour les QA / Testeurs
1. Lire: [EXECUTION_SUMMARY.md](EXECUTION_SUMMARY.md)
2. Setup: `npm install && npm test`
3. Chercher: Failures dans test-results
4. Reporter: Bugs avec screenshots

### Pour les Développeurs
1. Lire: [DETAILED_TEST_REPORT.md](DETAILED_TEST_REPORT.md)
2. Focus: Section "Probable Causes"
3. Debug: Follow "Investigation Steps"
4. Fix: Security/Gateway config
5. Test: Re-run `npm test`

### Pour les Managers / POs
1. Lire: [FINAL_REPORT.md](FINAL_REPORT.md)
2. Reference: [../docs/QA_TEST_STRATEGY.md](../docs/QA_TEST_STRATEGY.md)
3. Understand: 60 test coverage
4. Answer: Bonus 5 PO questions

### Pour DevOps / CI/CD
1. Setup: Copy `tests/` folder
2. Install: `npm install`
3. Run: `npm test` in pipeline
4. Parse: `test-results/junit.xml`
5. Report: Upload to Xray/Testrail

---

## ⚡ AIDE-MÉMOIRE

### Quick Reference
```
Total Tests:     60
Smoke Tests:     10 (5-10 min)
Full Suite:      60 (45-60 min with 4 workers)
Test Framework:  Playwright 1.40+
Language:        TypeScript
Browser:         Chromium
Reporters:       HTML + JSON + JUnit
```

### Test Status Legend
```
✅ DÉFINI       - Test code écrit
⏳ BLOQUÉ       - En attente de fix
🔄 PRÊT         - Peut exécuter
✓ PASSÉ         - Test réussi
✗ ÉCHOUÉ        - Test échoué
```

### Domains Couvertus
```
RBAC & Permissions  ← Core security
Authentication      ← Login/token
Users               ← Admin CRUD
Events              ← Main workflow
Rooms/Equipment     ← Reservations
Documents (GED)     ← Publishing
Partners            ← External access
Interventions       ← Maintenance
Dashboards          ← Analytics
API                 ← Integration
Performance         ← Load testing
```

---

## 🔗 LIENS RAPIDES

### Documentation
- **Stratégie Complète**: [QA_TEST_STRATEGY.md](../docs/QA_TEST_STRATEGY.md)
- **Résumé Suite**: [FINAL_REPORT.md](FINAL_REPORT.md)
- **Guide Exécution**: [EXECUTION_SUMMARY.md](EXECUTION_SUMMARY.md)
- **Blockers**: [DETAILED_TEST_REPORT.md](DETAILED_TEST_REPORT.md)

### Configuration
- **Tests**: [e2e/all-60-tests.spec.ts](e2e/all-60-tests.spec.ts)
- **Helpers**: [support/helpers.ts](support/helpers.ts)
- **Playwright**: [playwright.config.ts](playwright.config.ts)
- **NPM**: [package.json](package.json)

### Infrastructure
- **Docker**: [docker-compose.yml](docker-compose.yml)
- **Keycloak**: [infra/keycloak/realm-export.json](infra/keycloak/realm-export.json)
- **Security**: [api-gateway/src/.../SecurityConfig.java]

### Test Data
- **Users**: 7 in realm-export.json
- **Roles**: ADMIN, EMPLOYE, CHEF, SALLE, SECURITE, DIRECTEUR, QUALITE
- **Services**: 8 microservices (ports 8081-8088)

---

## ✨ PROCHAINES ÉTAPES

### URGENT (Aujourd'hui)
1. [ ] Fix 401 Unauthorized error
2. [ ] Valider JWT propagation API Gateway
3. [ ] Run smoke tests (npm run test:smoke)

### HIGH (Cette semaine)
1. [ ] Run tous les 60 tests
2. [ ] Générer rapport HTML
3. [ ] Analyser failures
4. [ ] Créer tickets bugs

### MEDIUM (Prochaine semaine)
1. [ ] Corriger failures
2. [ ] Re-run tests
3. [ ] Archive résultats
4. [ ] Documenter learnings

### LOW (Suivi)
1. [ ] Setup CI/CD pipeline
2. [ ] Maintenance continue
3. [ ] Update tests si UI change
4. [ ] Performance monitoring

---

## 📞 SUPPORT

**Status**: ✅ Suite prête, ⏳ Exécution en attente de fix auth  
**Last Updated**: 2026-04-20  
**Framework**: Playwright v1.40+ TypeScript  
**Blockers**: 1x 401 (API Gateway JWT)  
**Next Action**: Debug + Execute  

---

**Suite de 60 Tests QA - CNSTN Intranet**  
✨ **Prête pour exécution immédiate dès fix d'authentification** ✨
