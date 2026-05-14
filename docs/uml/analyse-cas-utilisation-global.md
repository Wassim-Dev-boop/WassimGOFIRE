# Analyse du diagramme de cas d'utilisation global

## Objectif

Ce document justifie le diagramme `docs/uml/diagramme-cas-utilisation-global.drawio`.
Le diagramme reste volontairement simplifie : chaque acteur est relie uniquement a ses fonctionnalites principales confirmees par le code. Les relations UML ajoutees sont limitees aux `include` et `extend` globaux necessaires entre cas d'utilisation, sans modifier les associations acteur/fonctionnalite.

## Acteurs et fonctionnalites principales

| Acteur | Fonctionnalites principales representees | Justification courte |
|---|---|---|
| Visiteur | Acceder au portail; S authentifier | Routes publiques d'accueil, connexion, inscription et recuperation de mot de passe. |
| Employe | Gerer son compte; Consulter notifications; Faire demandes metier; Gerer reservations | Role metier de base utilisant le profil, les notifications, les demandes et les reservations selon permissions. |
| Administrateur | Administrer utilisateurs et droits; Configurer workflows; Gerer evenements | Role `ADMIN` pour administration globale et supervision des modules. |
| Chef hierarchique | Valider demandes; Gerer evenements | Role de validation/suivi des demandes et evenements. |
| Responsable salle | Gerer salles et equipements; Valider reservations | Role responsable des ressources physiques et validations associees. |
| Responsable securite | Controler securite; Valider reservations | Role de controle securite sur reservations/evenements. |
| Directeur DSN | Superviser evenements et IT; Valider demandes | Role de validation/suivi niveau DSN. |
| Responsable qualite | Gerer documents GED | Role qualite confirme sur GED. |
| Responsable IT | Gerer parc et interventions IT | Role confirme sur parc IT, affectations et interventions IT. |

## Heritage des acteurs

Les acteurs principaux `Administrateur`, `Chef hierarchique`, `Responsable salle`, `Responsable securite`, `Directeur DSN`, `Responsable qualite` et `Responsable IT` sont representes comme des specialisations de `Employe`. Le diagramme utilise une ligne principale d'heritage vers `Employe`, avec une branche secondaire pour chaque acteur specialise. Cet heritage indique que ces roles conservent les usages communs de l'employe, puis ajoutent leurs responsabilites propres.

## Relations UML ajoutees

| Relation | Type | Justification courte |
|---|---|---|
| Gerer son compte -> S authentifier | `include` | Le profil et la session personnelle necessitent un utilisateur authentifie. |
| Faire demandes metier -> S authentifier | `include` | Les demandes protegees passent par les routes gardees et le JWT. |
| Gerer reservations -> S authentifier | `include` | Les reservations de salles/equipements sont des routes protegees. |
| Administrer utilisateurs et droits -> S authentifier | `include` | L'administration est reservee aux roles autorises apres authentification. |
| Valider demandes -> S authentifier | `include` | Les validations sont associees aux roles metier connectes. |
| Gerer evenements -> S authentifier | `include` | La gestion des evenements est exposee comme module protege. |
| Gerer documents GED -> S authentifier | `include` | L'acces GED utilise les permissions et l'identite connectee. |
| Gerer parc et interventions IT -> S authentifier | `include` | Le parc IT et les interventions IT sont controles par role/JWT. |
| Configurer workflows -> Administrer utilisateurs et droits | `extend` | La configuration des workflows est une capacite administrative specialisee. |
| Controler securite -> Valider reservations | `extend` | Le controle securite intervient comme branche conditionnelle de validation. |
| Valider reservations -> Valider demandes | `extend` | La validation des reservations est un cas particulier de validation metier. |
| Creer evenement -> Faire demandes metier | `extend` | La creation d'evenement est un type de demande metier soumis au workflow evenement. |
| Demander reservation -> Faire demandes metier | `extend` | La reservation de salle ou d'equipement specialise la demande metier selon les disponibilites. |
| Declarer intervention -> Faire demandes metier | `extend` | La declaration d'intervention est une demande metier declenchant un circuit de validation. |
| Deposer document GED -> Faire demandes metier | `extend` | Le depot documentaire est une variante metier confirmee par le module GED. |

## Preuves principales

- `backend/infra/keycloak/realm-export.json` : roles `ADMIN`, `EMPLOYE`, `CHEF_HIERARCHIQUE`, `RESPONSABLE_SALLE`, `RESPONSABLE_SECURITE`, `DIRECTEUR_DSN`, `RESPONSABLE_QUALITE`, `RESPONSABLE_IT`.
- `frontend/src/app/app.routes.ts` : routes publiques, routes protegees, modules Angular.
- `frontend/src/app/core/guards/auth.guard.ts` : protection par authentification/roles.
- `backend/auth-user-service/src/main/java/com/cnstn/authuser/controller/*.java` : auth, profil, administration utilisateurs/roles/permissions/departements/workflows.
- `backend/event-service/src/main/java/com/cnstn/event/controller/EventController.java` : evenements, decisions, invitations, album, salle virtuelle.
- `backend/reservation-service/src/main/java/com/cnstn/reservation/controller/*.java` : reservations, salles, equipements, validation securite.
- `backend/ged-service/src/main/java/com/cnstn/ged/controller/DocumentController.java` : GED, documents, dossiers, versions, ACL.
- `backend/intervention-service/src/main/java/com/cnstn/intervention/controller/*.java` : interventions logistiques et IT.
- `backend/notification-service/src/main/java/com/cnstn/notification/controller/*.java` : notifications, SSE, logs email.
- `backend/auth-user-service/src/main/java/com/cnstn/authuser/controller/ItEquipment*.java` : parc IT, categories, affectations.

## Fonctionnalites ignorees car non confirmees

- Gerer un budget.
- Gerer une application mobile.
- Signer electroniquement des documents.
- Echanger via une messagerie interne conversationnelle.
- Publier des posts publics ou un fil social.
- Gerer des procedures qualite comme module autonome separe de la GED.

## Controle qualite

- Chaque acteur est relie uniquement a ses fonctionnalites principales.
- Aucune fonctionnalite inventee.
- Les heritages d'acteurs restent limites aux roles internes principaux qui specialisent `Employe`.
- Les `include` et `extend` restent limites aux dependances globales confirmees par les routes protegees, roles et workflows.
- Les cas d'utilisation sont formules avec des verbes a l'infinitif.
- Le diagramme contient acteurs UML et ovales UML, avec les associations principales conservees.
