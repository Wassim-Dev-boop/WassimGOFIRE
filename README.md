# CNSTN Intranet - Version livrable soutenance

Application intranet CNSTN en architecture microservices (Spring Boot + PostgreSQL + Keycloak + Angular), livree en version propre pour soutenance.

## 1) Prerequis
- Docker Desktop (avec Docker Compose)
- Java 17+ et Maven 3.9+ (pour generer les JAR backend avant `docker compose build`)
- 8 Go RAM minimum recommandes
- Ports disponibles: `4200`, `8081-8090`, `8761`, `8888`, `5432`, `5050`

## 2) Lancement Docker
Depuis la racine du projet:

```bash
cd backend
mvn -DskipTests package
docker compose up -d --build
```

Verifier l etat des services:

```bash
docker compose ps
```

## 3) Comptes de demonstration
Voir le detail complet dans:
- `rapport/11-annexes/annexe-comptes-demo.md`

Comptes principaux:
- `admin.cnstn / Admin@12345`
- `employe.cnstn / User@12345`
- `chef.cnstn / User@12345`
- `salle.cnstn / User@12345`
- `securite.cnstn / User@12345`
- `qualite.cnstn / User@12345`
- `directeur.cnstn / User@12345`
- `it.cnstn / User@12345`

## 4) URLs principales
- Frontend: http://localhost:4200
- API Gateway (health): http://localhost:8088/actuator/health
- Keycloak: http://localhost:8090
- Eureka: http://localhost:8761
- pgAdmin: http://localhost:5050

## 5) Arret du projet
```bash
cd backend
docker compose down
```

Pour repartir sur une base vierge:
```bash
cd backend
docker compose down -v
docker compose up -d --build
```

## 6) SMTP / Mail
- Variables a renseigner dans `backend/.env` (copie de `backend/.env.example`).
- Aucun secret ne doit etre committe.
- Pour une demo sans envoi reel: desactiver via `MAIL_ENABLED=false`.

## 7) Notes importantes soutenance
- Les migrations et configurations Docker necessaires sont conservees.
- Les donnees de demonstration sont nettoyees et re-seedees (sans donnees parasites).
- Les fichiers de tests, caches et artefacts temporaires ont ete supprimes de la version livrable.
- Le rapport de nettoyage final est disponible dans `rapport/13-soutenance/rapport-nettoyage-release.md`.
