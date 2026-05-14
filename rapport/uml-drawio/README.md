# Diagrammes UML draw.io - CNSTN Intranet

Ce dossier contient les diagrammes UML generes a partir du code source reel du projet CNSTN Intranet.

## Fichiers generes

- `00-audit-projet-uml.md` : synthese d'audit des acteurs, modules, entites, workflows, enums et exclusions.
- `01-cas-utilisation-global.drawio` : cas d'utilisation globaux confirmes par les routes Angular et les endpoints backend.
- `02-architecture-microservices.drawio` : architecture logique Angular, Gateway, Eureka, Keycloak, microservices, PostgreSQL et Docker Compose.
- `03-diagramme-classes-global.drawio` : vue de classes synthetique basee sur les entites JPA principales.
- `04-sequence-authentification.drawio` : scenario de login JWT via Angular, API Gateway, auth-user-service et Keycloak.
- `05-sequence-reservation.drawio` : reservation de salle/equipement avec controle de disponibilite, conflit, persistance et notification.
- `06-sequence-evenement.drawio` : creation, soumission et validation d'un evenement selon le workflow reel du code.
- `07-activite-reservation.drawio` : activite du processus de reservation.
- `08-deploiement-docker.drawio` : deploiement Docker Compose avec conteneurs et ports reels.

## Role dans le rapport PFE

- Le cas d'utilisation global presente le perimetre fonctionnel valide.
- L'architecture microservices justifie les choix techniques et les communications entre services.
- Le diagramme de classes donne une vue metier globale sans inventer d'entites.
- Les sequences illustrent les scenarios critiques : authentification, reservation et evenement.
- Le diagramme d'activite formalise la logique de decision d'une reservation.
- Le deploiement Docker documente l'environnement local reproductible.

## Fichiers source analyses

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

## Avertissements

- Les diagrammes ne representent pas les modules non trouves, notamment budget, application mobile, signature electronique et messagerie conversationnelle.
- Les modules GED et interventions sont inclus car ils existent dans le depot, meme s'ils etaient listes comme a ne pas inventer.
- Le diagramme de classes est volontairement synthétique pour rester exploitable dans un rapport; l'audit contient la liste complete des entites confirmees.
- Les fichiers `.drawio` sont directement ouvrables dans diagrams.net / draw.io et exportables en PNG.
