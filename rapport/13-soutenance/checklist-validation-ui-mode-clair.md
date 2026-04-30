# Checklist validation UI mode clair

Date: 2026-04-30
Contexte: mise en oeuvre progressive de la refonte mode clair. Cette checklist indique uniquement les validations reellement faites dans cette session.

| Module | Bouton / action | Role | Resultat |
|---|---|---|---|
| Shell global | Build frontend apres Lot A | N/A | OK |
| Sidebar | Navigation vers Tableau de bord/GED/Evenements/Invitations/Salles/Equipements/Interventions/Notifications/Administration/Reporting | Selon permissions role | OK (routes reelles, liens morts supprimes) |
| Sidebar | Badges Invitations/Notifications | Utilisateur connecte | OK (donnees backend via services) |
| Sidebar | Changement mode clair/sombre | Utilisateur connecte | OK |
| Header | Recherche globale (Ctrl+K + soumission) | Utilisateur connecte | OK (navigation reelle vers modules) |
| Header | Breadcrumb dynamique | Utilisateur connecte | OK |
| Header | Acces messages/notifications | Utilisateur connecte | OK |
| Header | Profil utilisateur + logout | Utilisateur connecte | OK (workflow existant conserve) |
| Accueil public | CTA Se connecter / Creer un compte / Decouvrir | Public | OK (liens reels) |
| Accueil public | Avantages + modules (sans faux KPI chiffres) | Public | OK |
| Auth - Login | Soumission email/mot de passe + erreurs FR | Public | A verifier manuellement (build OK) |
| Auth - Login | Mot de passe oublie | Public | A verifier manuellement (build OK) |
| Auth - Signup | Creation demande compte en attente | Public | A verifier manuellement (build OK) |
| Auth - Forgot password | Envoi email reset | Public | A verifier manuellement (build OK) |
| Dashboard | Affichage role + KPI reels | Utilisateur connecte | A verifier manuellement (non modifie fonctionnellement dans cette session) |
| GED | CRUD, upload, viewer, ACL, audit | Selon permissions | A verifier manuellement |
| Evenements | Chargement page + vue calendrier lisible + vue liste | Chef hierarchique | OK |
| Evenements | Filtres `Appliquer` / `Reinitialiser` | Chef hierarchique | OK |
| Evenements | `Nouvel evenement` (ouverture modale) | Chef hierarchique | OK |
| Evenements | `Voir detail` evenement | Chef hierarchique | OK |
| Evenements | `Rejoindre en ligne` (si lien disponible) | Chef hierarchique | OK |
| Evenements | `Telecharger PDF officiel` | Chef hierarchique | OK (action declenchee) |
| Evenements | `Album photos` + navigation + chargement page album | Chef hierarchique | OK |
| Evenements | `Modifier evenement` | Chef hierarchique | Bouton visible, ouverture modale non reproduite de maniere stable sur l evenement de test |
| Evenements | Boutons workflow `Approuver` / `Refuser` | Admin | Desactives/absents sur l evenement cible (etat backend `REJECTED/REFUSE`) |
| Evenements | `Voir l evenement` depuis Invitations (`?eventId=`) | Employe | OK (navigation vers /events + detail cible) |
| Invitations | Chargement page + KPI + onglets + filtres | Employe / Qualite | OK |
| Invitations | `Details` (modale invitation) | Employe | OK |
| Invitations | `Accepter` invitation | Employe destinataire | OK |
| Invitations | `Refuser` invitation + modale motif | Responsable qualite destinataire | OK |
| Invitations | `Voir l evenement` depuis carte invitation | Employe | OK |
| Reservations - Salles | Chargement page + onglets `Salles/Equipements logistiques` | Responsable salle | OK |
| Reservations - Salles | Filtres `Appliquer` / `Reinitialiser` | Responsable salle | OK |
| Reservations - Salles | `Voir planning` (modale details salle) | Responsable salle | OK |
| Reservations - Salles | Action reservation visible avec etat (disponible/indisponible/role) | Responsable salle | OK |
| Reservations - Equipements | Chargement page + onglets `Salles/Equipements logistiques` | Responsable salle | OK |
| Reservations - Equipements | Filtres `Appliquer` / `Reinitialiser` | Responsable salle | OK |
| Reservations - Equipements | `Voir planning` (modale details equipement) | Responsable salle | OK |
| Reservations - Equipements | Action reservation visible avec retour metier | Responsable salle | OK |
| Parc IT | Chargement `it/equipements` + KPI + categories | Responsable IT | OK |
| Parc IT | Filtres `Filtrer` / `Reinitialiser` | Responsable IT | OK |
| Parc IT | `Details` equipement (modale) | Responsable IT | OK |
| Parc IT | Navigation `Voir interventions IT` | Responsable IT | OK |
| Interventions IT | Chargement `it/interventions` + filtres `Filtrer` / `Reinitialiser` | Responsable IT | OK |
| Interventions IT | `Nouvelle demande IT` (ouverture formulaire) | Employe | OK |
| Interventions IT | Blocage acces `/it/equipements` pour employe (non autorise) | Employe | OK (403/route guard) |
| Interventions IT | Workflow complet API (Employe -> Chef -> DSN -> IT) | Employe/Chef/DSN/Responsable IT | Non valide dans cet environnement: creation intervention 400 `Verification de l'equipement IT impossible.` |
| Administration / Workflows | Gestion complete + audit | Admin | A verifier manuellement |
| Notifications / emails | Liste, lecture, logs email | Selon permissions | A verifier manuellement |
| Reporting | KPI par role | Selon permissions | A verifier manuellement |

## Notes
- Validations executees automatiquement dans cette session: `npm run build` (frontend) + script de verification UI/API Lot E (`frontend/lot-e-validation.mjs`) + script Lot F (`frontend/lot-f-validation.mjs`).
- Donnees testees sur evenement backend existant `Session cyber interne` (id `22222222-2222-2222-2222-222222221002`).
- Limite backend constatee pendant Lot E: creation d un nouvel evenement via API echoue (conflit `reference_code`), puis workflow de re-soumission contraint par regles reservation/salle sur l evenement cible.
- Limite backend constatee pendant Lot F: endpoint de creation intervention IT retourne `400 Verification de l'equipement IT impossible.` meme avec employe authentifie et equipement assigne (`/api/v1/it-equipment/my`).
- Les tests manuels complets multi-modules restent a faire avant declaration "livrable 100% fonctionnelle".

## Validation technique executee (session)
- Backend: `mvn -DskipTests package` -> SUCCESS (reactor 11/11 modules).
- Frontend: `npm run build` -> SUCCESS.
- Docker: `docker compose up -d --build` (depuis `backend/`) -> SUCCESS.
- Docker: `docker compose ps` -> services principaux en etat `Up`.
- Frontend runtime: `http://localhost:4200` -> HTTP 200.
- Gateway health: `http://localhost:8088/actuator/health` -> `UP`.
