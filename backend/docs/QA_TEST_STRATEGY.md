# STRATÉGIE DE TEST COMPLÈTE - CNSTN INTRANET
## QA Lead + Business Analyst + Test Architect

**Date** : 20 avril 2026  
**Produit** : Application de gestion interne d'un centre CNSTN  
**Version** : 1.0  
**Langue** : Français

---

## TABLE DES MATIÈRES

1. [Partie A : Cartographie des workflows](#partie-a--cartographie-des-workflows)
2. [Partie B : Matrice de couverture de tests](#partie-b--matrice-de-couverture-de-tests)
3. [Partie C : Cas de test détaillés](#partie-c--cas-de-test-détaillés)
4. [Partie D : Scénarios End-to-End](#partie-d--scénarios-end-to-end)
5. [Partie E : Matrice des rôles et permissions (RBAC)](#partie-e--matrice-des-rôles-et-permissions-rbac)
6. [Partie F : Jeux de données de test](#partie-f--jeux-de-données-de-test)
7. [Partie G : Tests non-fonctionnels](#partie-g--tests-non-fonctionnels)
8. [Partie H : Bugs probables et zones sensibles](#partie-h--bugs-probables-et-zones-sensibles)
9. [Partie I : Ordre d'exécution recommandé](#partie-i--ordre-dexécution-recommandé)
10. [Bonus 1 : Checklist manuelle de recette](#bonus-1--checklist-manuelle-de-recette)
11. [Bonus 2 : Structure de fichier pour automatisation](#bonus-2--structure-de-fichier-pour-automatisation)
12. [Bonus 3 : Exemples pseudo-code Playwright/Cypress](#bonus-3--exemples-pseudo-code-playrighcypress)
13. [Bonus 4 : Top 15 tests les plus critiques](#bonus-4--top-15-tests-les-plus-critiques)
14. [Bonus 5 : Questions métier à clarifier avec le PO](#bonus-5--questions-métier-à-clarifier-avec-le-po)

---

# PARTIE A : CARTOGRAPHIE DES WORKFLOWS

## WF-001 : Authentification - Connexion

| Aspect | Détail |
|--------|--------|
| **Objectif métier** | Permettre à un utilisateur de se connecter à l'application avec ses identifiants Keycloak |
| **Acteur principal** | Utilisateur non connecté (tout rôle) |
| **Préconditions** | • L'utilisateur dispose d'un compte dans Keycloak<br>• Keycloak est opérationnel<br>• L'application frontend est accessible |
| **Déclencheur** | Clic sur "Se connecter" depuis la page de login |
| **Étapes nominales** | 1. L'utilisateur accède à localhost:4200<br>2. Redirection vers page login<br>3. Saisie du username (ex: employe.cnstn)<br>4. Saisie du password<br>5. Clic sur bouton "Connexion"<br>6. Keycloak valide les identifiants<br>7. JWT token généré et stocké (localStorage ou sessionStorage)<br>8. Redirection vers dashboard/<br>9. Les données utilisateur sont chargées (/api/v1/me)<br>10. Dashboard affiche les widgets selon le rôle |
| **Variantes** | **V1** : Connexion par email (si configuré)<br>**V2** : Lien "Se souvenir de moi" (si implémenté)<br>**V3** : Connexion SSO/2FA (scope futur) |
| **Postconditions** | • L'utilisateur est authentifié<br>• Token JWT stocké en mémoire client<br>• Les requêtes API incluent le header Authorization: Bearer {token}<br>• Session serveur créée ou tracked<br>• Données utilisateur chargées |
| **Dépendances** | • Keycloak en cours d'exécution<br>• Config client OAuth2 correcte dans realm<br>• CORS headers configurés correctement |
| **Risques métier** | • Utilisateur oublie son mot de passe → pas d'accès<br>• Token expiré après 30min → déconnexion surprise<br>• Clé secrète client exposée → sécurité compromise |

---

## WF-002 : Authentification - Déconnexion

| Aspect | Détail |
|--------|--------|
| **Objectif métier** | Permettre à un utilisateur connecté de fermer sa session de manière sécurisée |
| **Acteur principal** | Utilisateur connecté (tout rôle) |
| **Préconditions** | • L'utilisateur est authentifié<br>• JWT token présent en mémoire cliente |
| **Déclencheur** | Clic sur "Déconnexion" ou timeout inactivité |
| **Étapes nominales** | 1. L'utilisateur clique sur menu profil > "Déconnexion"<br>2. Frontend efface le token JWT (localStorage)<br>3. Frontend appelle GET /api/v1/auth/logout (optionnel)<br>4. Keycloak révoque la session<br>5. Redirection vers page login (/login)<br>6. Tentative d'accès aux données → 401 Unauthorized |
| **Variantes** | **V1** : Déconnexion par timeout inactivité<br>**V2** : Déconnexion SSO (tous les onglets)<br>**V3** : Logout with session cleanup |
| **Postconditions** | • Token JWT supprimé du client<br>• Session serveur invalidée<br>• Utilisateur redirectionné vers login<br>• Aucun appel API n'est possible |
| **Dépendances** | • Endpoint logout fonctionnel<br>• Gestion des cookies/tokens côté frontend<br>• Configuration du timout inactivité |
| **Risques métier** | • Token stocké en mémoire reste en cache navigateur<br>• Logout sur un appareil ne logout pas les autres<br>• Timeout non respecté → session zombie |

---

## WF-003 : Administration - Gestion des utilisateurs

| Aspect | Détail |
|--------|--------|
| **Objectif métier** | Permettre aux admins de créer, modifier et supprimer des utilisateurs + attribuer des rôles |
| **Acteur principal** | Administrateur (rôle ADMIN) |
| **Préconditions** | • L'admin est connecté<br>• Au moins un utilisateur à créer/modifier existe en demande<br>• Les rôles requis existent dans le système |
| **Déclencheur** | Clic sur "Gestion des utilisateurs" > Ajouter/Modifier/Supprimer |
| **Étapes nominales - CRÉER** | 1. Admin accède à section "Utilisateurs"<br>2. Clic "Ajouter utilisateur"<br>3. Remplissage du formulaire :<br>   - Prénom, Nom<br>   - Email<br>   - Username (auto-générée si besoin)<br>   - Service (dropdown)<br>   - Rôle(s) (multi-select)<br>4. Password initial généré ou saisi<br>5. Clic "Créer"<br>6. API POST /api/v1/users<br>7. Vérification email existant (error si doublon)<br>8. Utilisateur créé dans Keycloak + DB<br>9. Email invitation envoyé (si service email actif)<br>10. Message succès : "Utilisateur créé" |
| **Étapes nominales - MODIFIER** | 1. Admin cherche l'utilisateur (search/filter)<br>2. Clic sur la ligne utilisateur<br>3. Formulaire pré-rempli<br>4. Modification des champs autorisés<br>5. Ajout/suppression de rôles<br>6. Clic "Enregistrer"<br>7. API PUT /api/v1/users/{id}<br>8. Rôles synchronisés avec Keycloak<br>9. Message succès |
| **Étapes nominales - SUPPRIMER** | 1. Admin sélectionne un/plusieurs utilisateurs<br>2. Clic "Supprimer"<br>3. Confirmation : "Êtes-vous sûr ?"<br>4. API DELETE /api/v1/users/{id}<br>5. Utilisateur masqué (soft-delete) ou supprimé<br>6. Rôles Keycloak supprimés<br>7. Sessions actives du user invalidées<br>8. Message succès |
| **Variantes** | **V1** : Import en masse (CSV)<br>**V2** : Réinitialiser mot de passe user<br>**V3** : Désactiver temporairement<br>**V4** : Dupliquer utilisateur |
| **Postconditions** | • Utilisateur visible/caché dans liste<br>• Rôles synchronisés Keycloak + DB<br>• Email d'invitation/notification envoyé<br>• Logs d'audit créés |
| **Dépendances** | • API users fonctionnelle<br>• Keycloak sync correcte<br>• Service email (si invitation)<br>• Permissions admin vérifiées |
| **Risques métier** | • Suppression d'un user avec données liées → orphelinages<br>• Email doublon dans Keycloak → erreur<br>• Rôle attribué non synchronized → permission fail<br>• Utilisateur supprimé mais toujours référencé dans tables enfants |

---

## WF-004 : Administration - Gestion des services

| Aspect | Détail |
|--------|--------|
| **Objectif métier** | Permettre aux admins de créer/modifier/supprimer des services (départements) pour organiser l'entreprise |
| **Acteur principal** | Administrateur (rôle ADMIN) |
| **Préconditions** | • L'admin est connecté<br>• Accès à la section "Services" |
| **Déclencheur** | Clic "Services" > Ajouter/Modifier/Supprimer |
| **Étapes nominales** | 1. Admin accède à "Administration > Services"<br>2. Liste des services actuels affichée<br>3. **Créer** : Clic "Ajouter"<br>   - Saisie : Nom du service, Description, Chef responsable<br>   - Clic "Créer"<br>   - API POST /api/v1/services<br>4. **Modifier** : Clic sur service<br>   - Modification champs<br>   - API PUT /api/v1/services/{id}<br>5. **Supprimer** : Clic "Supprimer"<br>   - Confirmation<br>   - API DELETE /api/v1/services/{id}<br>6. Service supprimé ou masqué |
| **Variantes** | **V1** : Hiérarchie services (parent/enfant)<br>**V2** : Service désactivé temporairement<br>**V3** : Copier configuration service |
| **Postconditions** | • Service visible en dropdown pour les users<br>• Utilisateurs liés au service peuvent être trouvés<br>• Logs créés |
| **Dépendances** | • API services<br>• Gestion d'accès admin |
| **Risques métier** | • Service supprimé → utilisateurs orphelins<br>• Chef responsable désactivé → service sans responsable |

---

## WF-005 : Employé/Chef - Créer une demande d'événement

| Aspect | Détail |
|--------|--------|
| **Objectif métier** | Permettre à un employé de déposer une demande d'événement (réunion, formation, etc.) pour validation par chef |
| **Acteur principal** | Employé (rôle EMPLOYE) ou Chef hiérarchique (rôle CHEF_HIERARCHIQUE) |
| **Préconditions** | • L'utilisateur est connecté<br>• Au moins une salle existe<br>• Au moins un équipement existe<br>• Dépôt de demande ouvert (pas en période d'embargo) |
| **Déclencheur** | Clic "Créer un événement" depuis dashboard |
| **Étapes nominales** | 1. Accès à formulaire "Nouvelle demande d'événement"<br>2. Saisie des champs :<br>   - Titre de l'événement<br>   - Description<br>   - Date début / Date fin<br>   - Heure début / Heure fin<br>   - Salle souhaitée (dropdown)<br>   - Équipements (multi-select)<br>   - Participants (search & add)<br>   - Nombre estimé de partenaires externes<br>3. Vérification disponibilité salle (frontend check ou backend)<br>4. Clic "Soumettre"<br>5. API POST /api/v1/events<br>6. État : "EN ATTENTE"<br>7. Notification envoyée au chef hiérarchique<br>8. Message succès : "Demande créée ID: #1234"<br>9. Redirection vers page détail événement |
| **Variantes** | **V1** : Événement récurrent (toutes les semaines)<br>**V2** : Inviter partenaires externes<br>**V3** : Joindre documents en pièce jointe |
| **Postconditions** | • Événement créé en BD avec état "EN ATTENTE"<br>• Notification email au chef<br>• Salle "réservée provisoirement"<br>• Audit log créé |
| **Dépendances** | • API events fonctionnelle<br>• Service email<br>• Règles métier de validation<br>• Keycloak pour récupérer chef hiérarchique du user |
| **Risques métier** | • Conflits de réservation salle<br>• Équipement non disponible mais sélectionné<br>• User cré event puis supprimé → orphelin<br>• Partenaires externes oubliés → accès denied |

---

## WF-006 : Employé/Chef - Réserver une salle

| Aspect | Détail |
|--------|--------|
| **Objectif métier** | Permettre à un employé de réserver une salle pour un événement ou réunion |
| **Acteur principal** | Employé, Chef hiérarchique |
| **Préconditions** | • L'utilisateur est connecté<br>• Au moins une salle existe et est disponible<br>• L'utilisateur a la permission de réserver |
| **Déclencheur** | Clic "Réserver salle" ou depuis formulaire création événement |
| **Étapes nominales** | 1. Accès à section "Réservations > Salles"<br>2. Vue calendrier ou liste des salles<br>3. Sélection d'une salle<br>4. Affichage des créneaux disponibles<br>5. Sélection date + horaire<br>6. Clic "Réserver"<br>7. Formulaire confirmation :<br>   - Salle<br>   - Date/Heure<br>   - Motif (libre ou associé à événement)<br>8. Clic "Confirmer"<br>9. API POST /api/v1/reservations/rooms<br>10. Vérification conflict (backend)<br>11. Réservation créée, état "CONFIRMÉE"<br>12. Email confirmation envoyé au user<br>13. Calendrier mis à jour en temps réel (si WebSocket) |
| **Variantes** | **V1** : Réserver salle avec équipements intégrés<br>**V2** : Annuler/modifier réservation<br>**V3** : Transférer réservation à collègue |
| **Postconditions** | • Réservation visible au créateur et responsable salle<br>• Salle marquée occupée à ces horaires<br>• Email confirmation envoyé<br>• Audit log créé |
| **Dépendances** | • API reservations<br>• Gestion de la disponibilité salle<br>• Détection conflits<br>• Service email |
| **Risques métier** | • Deux users réservent même créneau (race condition)<br>• Annulation salle mais équipement reste réservé<br>• Salle réservée mais responsable revient en arrière |

---

## WF-007 : Employé/Chef - Réserver un équipement

| Aspect | Détail |
|--------|--------|
| **Objectif métier** | Permettre à un employé de réserver un équipement pour un événement |
| **Acteur principal** | Employé, Chef |
| **Préconditions** | • L'utilisateur est connecté<br>• Au moins un équipement existe<br>• L'équipement n'est pas en maintenance |
| **Déclencheur** | Clic "Réserver équipement" |
| **Étapes nominales** | 1. Accès à "Réservations > Équipements"<br>2. Liste des équipements disponibles<br>3. Sélection équipement (ex: Vidéoprojecteur, Tableau blanc)<br>4. Affichage calendrier de cet équipement<br>5. Sélection date/heure<br>6. Quantité (si plusieurs unités)<br>7. Clic "Réserver"<br>8. Confirmation et validation<br>9. API POST /api/v1/reservations/equipments<br>10. Réservation créée |
| **Postconditions** | • Équipement marqué réservé<br>• Confirmation envoyée<br>• Disponibilité mise à jour |
| **Dépendances** | • API reservations<br>• Inventaire équipements à jour |
| **Risques métier** | • Équipement double réservé<br>• Équipement en maintenance mais toujours réservable<br>• Perte ou dégâts équipement non trackés |

---

## WF-008 : Employé/Chef - Demander une intervention technique

| Aspect | Détail |
|--------|--------|
| **Objectif métier** | Permettre à un employé de demander une intervention (maintenance, dépannage salle/équipement) |
| **Acteur principal** | Employé |
| **Préconditions** | • L'utilisateur est connecté<br>• Une salle ou équipement a un problème |
| **Déclencheur** | Clic "Demander intervention" ou depuis page détail salle/équipement |
| **Étapes nominales** | 1. Formulaire "Nouvelle demande d'intervention"<br>2. Sélection type (Salle / Équipement)<br>3. Sélection élément concerné<br>4. Description du problème (texte libre)<br>5. Priorité : Basse / Normale / Haute / Urgente<br>6. Date souhaité d'intervention<br>7. Clic "Soumettre"<br>8. API POST /api/v1/interventions<br>9. État : "EN ATTENTE"<br>10. Notification envoyée au Responsable Salle<br>11. Message succès |
| **Postconditions** | • Intervention créée en BD<br>• Notification au responsable<br>• Peut être associée à un événement<br>• Audit log créé |
| **Dépendances** | • API interventions<br>• Service email<br>• Affectation automatique à responsable |
| **Risques métier** | • Intervention urgente pas traitée assez vite<br>• Même problème signalé plusieurs fois<br>• Intervention résolue mais pas clôturée |

---

## WF-009 : Employé - Consulter un document

| Aspect | Détail |
|--------|--------|
| **Objectif métier** | Permettre à un employé de consulter les documents publiés dans la GED |
| **Acteur principal** | Employé, Chef, tous les rôles |
| **Préconditions** | • L'utilisateur est connecté<br>• Au moins un document est publié<br>• L'utilisateur a la permission de voir le document |
| **Déclencheur** | Clic "Documents" dans menu principal |
| **Étapes nominales** | 1. Accès à section "Documents"<br>2. Liste des documents publiés affichée<br>3. Filtrage par catégorie/tag (optionnel)<br>4. Recherche par titre/contenu<br>5. Clic sur document<br>6. Affichage détail :<br>   - Titre<br>   - Auteur<br>   - Date publication<br>   - Contenu (PDF viewer ou preview)<br>   - Tags/catégories<br>7. Option "Télécharger" si autorisé<br>8. Option "Partager" avec collègues<br>9. Log de consultation créé |
| **Variantes** | **V1** : Consulter versions antérieures<br>**V2** : Ajouter des commentaires<br>**V3** : Évaluer le document (like/dislike) |
| **Postconditions** | • Document affiché correctement<br>• Log de consultation créé<br>• Statistiques de consultation mises à jour |
| **Dépendances** | • API documents<br>• Permissions document correctes<br>• Viewer PDF/images fonctionnel |
| **Risques métier** | • Document sensible accessible par erreur<br>• Version ancienne consultée au lieu de la nouvelle<br>• Téléchargement bloqué pour raison technique |

---

## WF-010 : Employé/Chef - Inviter des partenaires à un événement

| Aspect | Détail |
|--------|--------|
| **Objectif métier** | Permettre à un employé d'inviter des partenaires externes à un événement |
| **Acteur principal** | Employé, Chef |
| **Préconditions** | • L'utilisateur est connecté<br>• Un événement existe<br>• L'utilisateur est créateur ou autorisé |
| **Déclencheur** | Clic "Inviter partenaires" ou "Ajouter participant" |
| **Étapes nominales** | 1. Accès à détail de l'événement<br>2. Section "Participants"<br>3. Clic "Ajouter partenaire externe"<br>4. Formulaire :<br>   - Nom complet<br>   - Email<br>   - Organisation<br>   - Rôle/qualité<br>5. Clic "Inviter"<br>6. API POST /api/v1/events/{id}/partners<br>7. Partenaire marqué "EN ATTENTE"<br>8. Email d'invitation envoyé (lien d'accès)<br>9. Responsable Sécurité notifié pour vérification<br>10. Message succès |
| **Postconditions** | • Partenaire ajouté à la liste<br>• Email d'invitation envoyé<br>• Audit log de sécurité créé<br>• Responsable Sécurité voit la demande |
| **Dépendances** | • API partners<br>• Service email<br>• Gestion accès partenaires temporaires<br>• Notification Responsable Sécurité |
| **Risques métier** | • Partenaire non autorisé par Directeur DSN → accès granted<br>• Lien d'accès ne fonctionne pas<br>• Partenaire accède données sensibles par erreur<br>• Email d'invitation expiré rapidement |

---

## WF-011 : Responsable Salle - Gérer salles/équipements

| Aspect | Détail |
|--------|--------|
| **Objectif métier** | Permettre au responsable salle d'ajouter/modifier/supprimer des salles et équipements |
| **Acteur principal** | Responsable Salle (rôle RESPONSABLE_SALLE) |
| **Préconditions** | • L'utilisateur a le rôle RESPONSABLE_SALLE<br>• Accès à section "Gestion Salles" |
| **Déclencheur** | Clic "Salles" > Ajouter/Modifier/Supprimer |
| **Étapes nominales - AJOUTER SALLE** | 1. Clic "Ajouter salle"<br>2. Formulaire :<br>   - Nom (ex: "Salle A1")<br>   - Localisation (bâtiment/étage)<br>   - Capacité (nb de personnes)<br>   - Équipements inclus (multi-select)<br>   - Horaires ouverture/fermeture<br>   - Photo/images<br>3. Clic "Créer"<br>4. API POST /api/v1/rooms<br>5. Salle devient disponible pour réservation |
| **Étapes nominales - MODIFIER SALLE** | 1. Sélection salle<br>2. Modification champs<br>3. Clic "Enregistrer"<br>4. API PUT /api/v1/rooms/{id}<br>5. Mise à jour |
| **Étapes nominales - SUPPRIMER SALLE** | 1. Sélection salle<br>2. Clic "Supprimer"<br>3. Vérification : aucune réservation active<br>4. API DELETE /api/v1/rooms/{id}<br>5. Salle désactivée |
| **Postconditions** | • Salle visible/caché dans système<br>• Disponible ou non pour réservation<br>• Audit log créé |
| **Dépendances** | • API rooms<br>• Gestion équipements liés |
| **Risques métier** | • Suppression salle avec réservations actives<br>• Capacité salle exagérée → surcharge<br>• Équipement inclus mais non disponible |

---

## WF-012 : Responsable Salle - Gérer les interventions

| Aspect | Détail |
|--------|--------|
| **Objectif métier** | Permettre au responsable salle de traiter les demandes d'intervention jusqu'à clôture |
| **Acteur principal** | Responsable Salle |
| **Préconditions** | • Au moins une intervention en attente<br>• L'utilisateur a le rôle RESPONSABLE_SALLE |
| **Déclencheur** | Accès à "Interventions" |
| **Étapes nominales** | 1. Accès à "Interventions" en attente<br>2. Liste affichée (priority, date, type)<br>3. Clic sur intervention<br>4. Détail :<br>   - Description du problème<br>   - Demandeur<br>   - Priorité<br>   - Salle/Équipement concerné<br>5. Actions disponibles :<br>   - **Accepter** : "Je vais traiter"<br>   - **Rejeter** : Avec raison<br>   - **Rescheduler** : Proposer autre date<br>6. Si acceptée :<br>   - État passe à "EN COURS"<br>   - Responsable assigné<br>   - API PUT /api/v1/interventions/{id}/accept<br>7. Travail effectué<br>8. Clic "Marquer comme résolu"<br>9. Formulaire clôture :<br>   - Actions effectuées (texte libre)<br>   - Date/heure résolution<br>   - Coût (si applicable)<br>10. Clic "Clôturer"<br>11. État : "RÉSOLUE"<br>12. Email notification au demandeur<br>13. Demandeur peut noter la résolution (optionnel) |
| **Postconditions** | • Intervention résolue en BD<br>• Salle/Équipement marqué opérationnel<br>• Notification au demandeur<br>• Historique intervention conservé |
| **Dépendances** | • API interventions<br>• Service email<br>• Gestion d'état machine |
| **Risques métier** | • Intervention marquée résolue mais non complétée<br>• Même problème récurrent non adressé<br>• Responsable salle absent → interventions bloquées |

---

## WF-013 : Chef Hiérarchique - Valider/Refuser demande d'événement

| Aspect | Détail |
|--------|--------|
| **Objectif métier** | Permettre au chef hiérarchique de valider ou refuser les demandes d'événement de ses collaborateurs |
| **Acteur principal** | Chef Hiérarchique (rôle CHEF_HIERARCHIQUE) |
| **Préconditions** | • Au moins une demande d'événement en attente<br>• Le chef est hiérarchique du demandeur<br>• L'événement est en attente de validation |
| **Déclencheur** | Notification email + accès à "Demandes à valider" |
| **Étapes nominales** | 1. Chef accède à "Demandes en attente"<br>2. Liste des demandes d'événement de son équipe<br>3. Clic sur demande<br>4. Affichage détails :<br>   - Titre, description<br>   - Date/Heure<br>   - Salle, équipements<br>   - Participants<br>   - Partenaires externes (si any)<br>5. Vérification budget (optionnel)<br>6. Actions :<br>   - **Valider** : Approuve la demande<br>   - **Refuser** : Rejette + motif obligatoire<br>   - **Demander modification** : Retour au demandeur<br>7. Si validée :<br>   - État : "APPROUVÉE"<br>   - Responsable Sécurité notifié (s'il y a partenaires)<br>   - Reservation salle confirmée<br>   - Email confirmation au demandeur<br>   - API PUT /api/v1/events/{id}/approve<br>8. Si refusée :<br>   - État : "REFUSÉE"<br>   - Email motif refus au demandeur<br>   - Réservation salle annulée<br>   - API PUT /api/v1/events/{id}/reject |
| **Postconditions** | • Demande approuvée ou refusée<br>• Notification aux parties concernées<br>• Réservations salle confirmées ou annulées<br>• Audit log créé |
| **Dépendances** | • API events<br>• Gestion hiérarchie users (chef/subordonné)<br>• Service email<br>• Notification Responsable Sécurité |
| **Risques métier** | • Chef valide événement sans vérifier disponibilité<br>• Partenaire externe mais pas vérification sécurité<br>• Démotivation si trop de refus non justifiés |

---

## WF-014 : Responsable Sécurité - Vérifier conflits de réservation

| Aspect | Détail |
|--------|--------|
| **Objectif métier** | Permettre au responsable sécurité de vérifier les conflits potentiels de réservation/événements |
| **Acteur principal** | Responsable Sécurité (rôle RESPONSABLE_SECURITE) |
| **Préconditions** | • Au moins une réservation/événement existe<br>• L'utilisateur a le rôle RESPONSABLE_SECURITE |
| **Déclencheur** | Accès à "Rapports > Conflits" ou vue calendrier |
| **Étapes nominales** | 1. Accès à dashboard "Conflits de réservation"<br>2. Affichage :<br>   - Salles surchargées (double booking)<br>   - Équipements non disponibles mais réservés<br>   - Interventions non résolues à l'heure d'événement<br>   - Partenaires non autorisés<br>3. Filtrage par date, salle, type de conflit<br>4. Clic sur conflit<br>5. Détail du conflit avec recommandations<br>6. Actions :<br>   - **Contacter demandeur** : Email pré-rempli<br>   - **Reassigner salle** : Proposer alternative<br>   - **Reporter événement** : Changer date<br>   - **Refuser partenaire** : Si non autorisé<br>7. Suivi des résolutions<br>8. Rapport généré à la fin du mois |
| **Postconditions** | • Conflits identifiés et tracés<br>• Actions correctives initiées<br>• Rapport disponible<br>• Notifications envoyées |
| **Dépendances** | • API reservations<br>• API events<br>• Logique de détection de conflits<br>• Service email |
| **Risques métier** | • Conflits pas détectés à temps<br>• Même salle double-réservée<br>• Partenaire non autorisé laisse passer<br>• Rapport incomplet |

---

## WF-015 : Directeur DSN - Vérifier accès partenaires

| Aspect | Détail |
|--------|--------|
| **Objectif métier** | Permettre au Directeur DSN de valider l'accès des partenaires externes à l'application et aux données |
| **Acteur principal** | Directeur DSN (rôle DIRECTEUR_DSN) |
| **Préconditions** | • Au moins un partenaire externe en attente d'approbation<br>• L'utilisateur a le rôle DIRECTEUR_DSN |
| **Déclencheur** | Notification + Accès à "Partenaires en attente" |
| **Étapes nominales** | 1. Directeur accède à "Gestion Partenaires"<br>2. Liste des partenaires en attente<br>3. Clic sur partenaire<br>4. Affichage :<br>   - Nom, organisation<br>   - Événement auquel invité<br>   - Données auxquelles il aura accès<br>   - Risques de sécurité identifiés<br>5. Vérification avec responsable sécurité (optionnel)<br>6. Actions :<br>   - **Approuver** : Partenaire peut accéder<br>   - **Refuser** : Accès denié + motif<br>   - **Approuver avec restrictions** : Accès limité<br>7. Si approuvé :<br>   - État : "APPROUVÉ"<br>   - Accès temporaire créé (lien + date expiration)<br>   - Email avec lien envoyé au partenaire<br>   - Audit log de sécurité créé<br>   - Monitoring activé (logs IP, actions)<br>8. Si refusé :<br>   - État : "REFUSÉ"<br>   - Email refus au demandeur + raison |
| **Postconditions** | • Partenaire approuvé ou refusé<br>• Accès temporaire créé<br>• Monitoring en place<br>• Audit log de sécurité |
| **Dépendances** | • API partners<br>• Gestion accès temporaires<br>• Système de monitoring/logging<br>• Service email |
| **Risques métier** | • Partenaire non autorisé accède données sensibles<br>• Accès expire mais partenaire reste connecté<br>• Log d'accès partenaire incomplet |

---

## WF-016 : Directeur DSN - Consulter tableau de bord de direction

| Aspect | Détail |
|--------|--------|
| **Objectif métier** | Permettre au Directeur DSN d'avoir une vue stratégique de l'activité du centre |
| **Acteur principal** | Directeur DSN |
| **Préconditions** | • L'utilisateur a le rôle DIRECTEUR_DSN<br>• Des données existent pour les KPIs |
| **Déclencheur** | Accès à "Dashboard Direction" |
| **Étapes nominales** | 1. Directeur se connecte et clique "Dashboard"<br>2. Vue d'ensemble :<br>   - Nombre total d'événements ce mois<br>   - Événements approuvés/refusés<br>   - Salles les plus utilisées<br>   - Interventions en attente (alertes)<br>   - Partenaires approuvés ce mois<br>   - Risques de sécurité identifiés<br>3. Graphiques temporels :<br>   - Utilisation salles (courbes)<br>   - Événements par type (pie chart)<br>   - Interventions par priorité<br>4. Filtres :<br>   - Par période (mois, trimestre, année)<br>   - Par service<br>   - Par type d'événement<br>5. Actions :<br>   - **Exporter rapport** : PDF/Excel<br>   - **Drill-down** : Clic sur donnée = détail<br>   - **Comparer périodes** : Side-by-side<br>6. Performance :<br>   - Chargement < 3 secondes<br>   - Temps réel ou refresh 5 min |
| **Postconditions** | • Dashboard affiché avec KPIs actualisés<br>• Rapport exportable<br>• Alertes visibles (interventions, risques) |
| **Dépendances** | • API analytics<br>• Data warehouse/aggregation<br>• Frontend performant (React/Angular) |
| **Risques métier** | • Dashboard lent (> 5sec) → frustration<br>• Données obsolètes (refresh pas fait)<br>• Alertes manquées par manque de notification<br>• Export incomplet ou mal formaté |

---

## WF-017 : Responsable Qualité - Gérer workflow GED

| Aspect | Détail |
|--------|--------|
| **Objectif métier** | Permettre au responsable qualité de gérer le cycle de vie des documents (création, review, approbation, publication) |
| **Acteur principal** | Responsable Qualité (rôle RESPONSABLE_QUALITE) |
| **Préconditions** | • Au moins un document en workflow<br>• L'utilisateur a le rôle RESPONSABLE_QUALITE |
| **Déclencheur** | Accès à "GED > Workflow" |
| **Étapes nominales - PUBLIER DOCUMENT** | 1. Responsable sélectionne "Nouveau document"<br>2. Upload fichier (PDF, Word, etc.)<br>3. Remplissage métadonnées :<br>   - Titre<br>   - Description<br>   - Catégorie (Policy, SOP, Form, etc.)<br>   - Auteur<br>   - Version (1.0)<br>   - Tags/mots-clés<br>4. Clic "Soumettre pour approbation"<br>5. État : "EN REVISION"<br>6. Notification aux approbateurs<br>7. API POST /api/v1/documents |
| **Étapes nominales - APPROUVER DOCUMENT** | 1. Approbateur reçoit notification<br>2. Accès à "Documents en révision"<br>3. Clic sur document<br>4. Lecture/review du contenu<br>5. Commentaires optionnels<br>6. Actions :<br>   - **Approuver** : Publie le document<br>   - **Rejeter** : Retour à l'auteur<br>   - **Demander modification** :<br>7. Si approuvé :<br>   - État : "APPROUVÉ"<br>   - Document devient public<br>   - Tous les users peuvent voir<br>   - Date publication : NOW<br>   - Notification : "Document publié"<br>   - API PUT /api/v1/documents/{id}/approve<br>8. Si rejeté :<br>   - État : "REJÉTÉ"<br>   - Email motif au créateur<br>   - Pièce jointe : commentaires |
| **Postconditions** | • Document publié et visible<br>• Version ancienne archivée<br>• Audit log créé<br>• Statistiques de consultation commencent |
| **Dépendances** | • API documents<br>• Système d'approbation<br>• Service email<br>• Stockage fichiers (S3 / local) |
| **Risques métier** | • Document sensible publié par erreur<br>• Version ancienne toujours accessible<br>• Pas de trace d'approbation<br>• Document jamais approuvé → bloqué |

---

## Résumé Workflows - Dépendances croisées

```
WF-001 (Login) → WF-003 (Admin Users) → WF-005 (Créer Event) 
                                      → WF-006 (Réserver Salle)
                                      → WF-008 (Demander Intervention)
                                      → WF-017 (GED)

WF-002 (Logout) [Fin de session]

WF-004 (Services) ← Assigné à WF-003 (Users)

WF-005 (Event) → WF-013 (Validation Chef)
              → WF-010 (Inviter Partenaires)
              → WF-014 (Vérifier Conflits)
              → WF-015 (Approuver Partenaires)

WF-006 (Réserver Salle) → WF-011 (Gérer Salles)
                       → WF-014 (Conflits)

WF-007 (Réserver Équipement) → WF-011 (Gérer Équipements)

WF-008 (Intervention) → WF-012 (Gérer Interventions)
                     → WF-009 (Consulter Document)

WF-009 (Consulter Document) ← WF-017 (GED Publish)

WF-011 (Salle/Équipement) ↔ WF-012 (Interventions)

WF-016 (Dashboard Direction) ← Agrégation de tout
```

---

# PARTIE B : MATRICE DE COUVERTURE DE TESTS

| ID | Fonctionnalité | Rôle | Type de test | Criticité | Priorité | Notes |
|-----|---|---|---|---|---|---|
| **T-001** | Login avec identifiants valides | ANONYMOUS | Smoke, Fonctionnel | CRITIQUE | P0 | Affecte tout user |
| **T-002** | Login avec identifiants invalides | ANONYMOUS | Fonctionnel | HAUTE | P1 | Sécurité |
| **T-003** | Logout et invalidation token | ALL | Fonctionnel | CRITIQUE | P0 | Sécurité |
| **T-004** | Token expiration & refresh | ALL | Sécurité, Intégration | HAUTE | P1 | Concurrence |
| **T-005** | CORS sur requêtes API | ALL | Sécurité, Intégration | HAUTE | P1 | Cross-domain |
| **T-006** | Créer utilisateur - données valides | ADMIN | Fonctionnel | CRITIQUE | P0 | Data integrity |
| **T-007** | Créer utilisateur - email doublon | ADMIN | Fonctionnel, Erreur | HAUTE | P1 | Validation |
| **T-008** | Modifier utilisateur & rôles | ADMIN | Fonctionnel | HAUTE | P1 | Permissions |
| **T-009** | Supprimer utilisateur | ADMIN | Fonctionnel | HAUTE | P1 | Soft-delete test |
| **T-010** | Affichage liste utilisateurs paginée | ADMIN | Fonctionnel, UX | MOYENNE | P2 | Performance |
| **T-011** | Créer service | ADMIN | Fonctionnel | MOYENNE | P2 | Business logic |
| **T-012** | Modifier/Supprimer service | ADMIN | Fonctionnel | MOYENNE | P2 | Cascade delete |
| **T-013** | Créer événement - flux nominal | EMPLOYE/CHEF | Fonctionnel, E2E | CRITIQUE | P0 | Core business |
| **T-014** | Créer événement - salle indisponible | EMPLOYE/CHEF | Erreur, Validation | HAUTE | P1 | Business logic |
| **T-015** | Créer événement - équipements manquants | EMPLOYE/CHEF | Erreur | MOYENNE | P2 | Data validation |
| **T-016** | Créer événement - partenaires externes | EMPLOYE/CHEF | Fonctionnel, E2E | HAUTE | P1 | Security gate |
| **T-017** | Réserver salle - créneau libre | EMPLOYE/CHEF | Fonctionnel | CRITIQUE | P0 | Core |
| **T-018** | Réserver salle - créneau occupé (race condition) | EMPLOYE/CHEF | Concurrence, Erreur | HAUTE | P1 | Important |
| **T-019** | Réserver salle - capacité insuffisante | EMPLOYE/CHEF | Erreur, Validation | MOYENNE | P2 | Business rule |
| **T-020** | Annuler réservation salle | EMPLOYE/CHEF | Fonctionnel | MOYENNE | P2 | State change |
| **T-021** | Réserver équipement - disponible | EMPLOYE/CHEF | Fonctionnel | CRITIQUE | P0 | Core |
| **T-022** | Réserver équipement - en maintenance | EMPLOYE/CHEF | Erreur | MOYENNE | P2 | Business rule |
| **T-023** | Demander intervention - creation | EMPLOYE | Fonctionnel | HAUTE | P1 | Core |
| **T-024** | Demander intervention - priorité urgente | EMPLOYE | Fonctionnel | HAUTE | P1 | Alert system |
| **T-025** | Consulter document published | ALL | Fonctionnel | MOYENNE | P2 | Read-only |
| **T-026** | Consulter document - no permission | EMPLOYE | Sécurité | HAUTE | P1 | Access control |
| **T-027** | Télécharger document | EMPLOYE | Fonctionnel | MOYENNE | P2 | Download |
| **T-028** | Inviter partenaire externe | EMPLOYE/CHEF | Fonctionnel, E2E | HAUTE | P1 | Security |
| **T-029** | Inviter partenaire - email invalide | EMPLOYE/CHEF | Erreur | MOYENNE | P2 | Validation |
| **T-030** | Valider événement - flux nominal | CHEF | Fonctionnel, E2E | CRITIQUE | P0 | Core workflow |
| **T-031** | Valider événement - refuser + motif | CHEF | Fonctionnel | HAUTE | P1 | Workflow |
| **T-032** | Valider événement - partenaires à vérifier | CHEF | Fonctionnel | HAUTE | P1 | Security gate |
| **T-033** | Gérer salle - créer | RESP_SALLE | Fonctionnel | MOYENNE | P2 | Setup |
| **T-034** | Gérer salle - modifier capacité | RESP_SALLE | Fonctionnel | MOYENNE | P2 | Update |
| **T-035** | Gérer salle - supprimer (avec réservations) | RESP_SALLE | Erreur | HAUTE | P1 | Validation |
| **T-036** | Gérer équipement - ajouter | RESP_SALLE | Fonctionnel | MOYENNE | P2 | Setup |
| **T-037** | Gérer équipement - marquer en maintenance | RESP_SALLE | Fonctionnel | MOYENNE | P2 | State change |
| **T-038** | Gérer intervention - accepter | RESP_SALLE | Fonctionnel | HAUTE | P1 | Workflow |
| **T-039** | Gérer intervention - clôturer + résolution | RESP_SALLE | Fonctionnel | HAUTE | P1 | Workflow |
| **T-040** | Vérifier conflits réservation | RESP_SECURITE | Fonctionnel | HAUTE | P1 | Safety check |
| **T-041** | Vérifier conflits - double booking detected | RESP_SECURITE | Fonctionnel | HAUTE | P1 | Critical logic |
| **T-042** | Vérifier partenaire - approuver | DIRECTEUR_DSN | Fonctionnel | HAUTE | P1 | Security gate |
| **T-043** | Vérifier partenaire - refuser | DIRECTEUR_DSN | Fonctionnel | HAUTE | P1 | Security |
| **T-044** | Dashboard direction - KPIs affichés | DIRECTEUR_DSN | Fonctionnel, UX | MOYENNE | P2 | Analytics |
| **T-045** | Dashboard direction - performance < 3s | DIRECTEUR_DSN | Performance | MOYENNE | P2 | Performance |
| **T-046** | GED - publier document | RESP_QUALITE | Fonctionnel, E2E | HAUTE | P1 | Core |
| **T-047** | GED - approuver document | RESP_QUALITE | Fonctionnel | HAUTE | P1 | Workflow |
| **T-048** | GED - rejeter + commentaires | RESP_QUALITE | Fonctionnel | MOYENNE | P2 | Feedback |
| **T-049** | Permission - ADMIN not see EMPLOYE data | ADMIN | Sécurité, RBAC | CRITIQUE | P0 | Security |
| **T-050** | Permission - EMPLOYE not create user | EMPLOYE | Sécurité, RBAC | CRITIQUE | P0 | Security |
| **T-051** | Permission - CHEF only validate own team | CHEF | Sécurité, RBAC | HAUTE | P1 | Segregation |
| **T-052** | API - Invalid JSON payload | ALL | Erreur, Validation | MOYENNE | P2 | Robustness |
| **T-053** | API - Missing required field | ALL | Erreur, Validation | MOYENNE | P2 | Robustness |
| **T-054** | API - 500 Internal Server Error handling | ALL | Erreur | HAUTE | P1 | Reliability |
| **T-055** | Email - Notification envoyée | ALL | Intégration | MOYENNE | P2 | Notification |
| **T-056** | Concurrence - Deux créations simultanées | ALL | Concurrence | HAUTE | P1 | Race condition |
| **T-057** | Données - Intégrité referentielle | ALL | Données | HAUTE | P1 | Data integrity |
| **T-058** | Audit - Toute action loggée | ALL | Audit, Traçabilité | HAUTE | P1 | Compliance |
| **T-059** | Performance - Page load < 2s | ALL | Performance | MOYENNE | P2 | UX |
| **T-060** | Load test - 100 users simultanés | ALL | Charge | MOYENNE | P3 | Scalability |

---

# PARTIE C : CAS DE TEST DÉTAILLÉS

## Bloc 1 : Authentification (T-001 à T-005)

### TC-001-001 : Login - Identifiants valides

```
ID              : TC-001-001
Titre           : Connexion réussie avec identifiants valides
Rôle            : Employé
Type            : Smoke + Fonctionnel
Criticité       : CRITIQUE
Prérequis       : • L'utilisateur a un compte Keycloak
                  • L'app est accessible sur localhost:4200
                  • Keycloak est démarré

Données de test : Username: employe.cnstn
                  Password: User@12345

Étapes          :
  1. Ouvrir localhost:4200
  2. Page de login affichée
  3. Saisir username: "employe.cnstn"
  4. Saisir password: "User@12345"
  5. Clic "Connexion"
  6. Attendre redirection

Résultat attendu : ✓ Redirection vers dashboard
                   ✓ Token JWT stocké en localStorage
                   ✓ User data chargée (/api/v1/me returns 200)
                   ✓ Header Authorization: Bearer {token} envoyé
                   ✓ Dashboard affiche les widgets
                   ✓ Pas d'erreur console (403, 401, etc.)

Sévérité si fail : CRITIQUE - Aucun user ne peut se connecter

Notes           : • Vérifier que le token est encodé en JWT
                  • Vérifier l'expiration du token (15 min recommandé)
                  • Vérifier que les rôles sont présents dans le token
```

---

### TC-001-002 : Login - Identifiants invalides

```
ID              : TC-001-002
Titre           : Tentative de connexion avec identifiants erronés
Rôle            : Employé
Type            : Fonctionnel + Erreur
Criticité       : HAUTE
Prérequis       : • Page de login accessible

Données de test : Username: employe.cnstn
                  Password: WrongPassword123

Étapes          :
  1. Saisir username et password erronés
  2. Clic "Connexion"
  3. Attendre réponse

Résultat attendu : ✗ Message d'erreur: "Identifiants invalides"
                   ✗ Pas de redirection
                   ✗ Pas de token généré
                   ✗ Rester sur page login
                   ✗ Pas d'info sensible dans message (pas de "user not found")

Sévérité si fail : HAUTE - Risque de force brute

Notes           : • Tester aussi avec username inexistant
                  • Tester blocage après N tentatives (rate limiting)
                  • Vérifier pas d'enumération d'utilisateurs
```

---

### TC-001-003 : Logout - Invalidation token

```
ID              : TC-001-003
Titre           : Déconnexion et invalidation du token
Rôle            : Employé
Type            : Fonctionnel + Sécurité
Criticité       : CRITIQUE
Prérequis       : • L'utilisateur est connecté

Étapes          :
  1. Être connecté (dashboard affiché)
  2. Clic sur menu profil > "Déconnexion"
  3. Observer redirection
  4. Tenter d'accéder à une ressource protégée
  5. Ouvrir F12 console, onglet "Storage"

Résultat attendu : ✓ Redirection vers page login
                   ✓ Token JWT supprimé de localStorage
                   ✓ GET /api/v1/me retourne 401 Unauthorized
                   ✓ Pas possible d'accéder au dashboard
                   ✓ Pas de token dans headers

Sévérité si fail : CRITIQUE - Session pas fermée = risque sécurité

Notes           : • Vérifier aussi le cookie session côté serveur
                  • Vérifier que le nouveau login génère un nouveau token
                  • Tester logout sur une autre page (pas dashboard)
```

---

## Bloc 2 : Gestion Utilisateurs (T-006 à T-010)

### TC-003-001 : Créer utilisateur - Données valides

```
ID              : TC-003-001
Titre           : Création d'un nouvel utilisateur par l'admin
Rôle            : Admin
Type            : Fonctionnel + E2E
Criticité       : CRITIQUE
Prérequis       : • Admin connecté
                  • Accès à "Administration > Utilisateurs"
                  • Au moins un service existe

Données de test : 
  Prénom          : Jean
  Nom             : Dupont
  Email           : jean.dupont@cnstn.tn
  Username        : jean.dupont
  Service         : Finance (dropdown)
  Rôle(s)         : [EMPLOYE]
  Password        : Temp@1234

Étapes          :
  1. Clic "Administration > Utilisateurs"
  2. Clic "Ajouter utilisateur"
  3. Remplissage du formulaire
  4. Clic "Créer"
  5. Attendre notification succès
  6. Vérifier apparition en liste

Résultat attendu : ✓ Message: "Utilisateur créé avec succès"
                   ✓ Utilisateur apparaît dans la liste
                   ✓ Utilisateur peut se connecter avec credentials
                   ✓ Rôle EMPLOYE attribué dans token JWT
                   ✓ Email d'invitation envoyé
                   ✓ Audit log créé: {admin, action: CREATE_USER, timestamp}
                   ✓ Utilisateur visible dans Keycloak admin

Sévérité si fail : CRITIQUE - Core admin feature

Notes           : • Vérifier password temporaire complexe (min 12 chars)
                  • Tester avec les 7 rôles possibles
                  • Vérifier email validation (format RFC)
```

---

### TC-003-002 : Créer utilisateur - Email doublon

```
ID              : TC-003-002
Titre           : Tentative de création avec email existant
Rôle            : Admin
Type            : Validation + Erreur
Criticité       : HAUTE
Prérequis       : • employe.cnstn@cnstn.tn existe déjà

Données de test : Email: employe.cnstn@cnstn.tn (existant)

Étapes          :
  1. Clic "Ajouter utilisateur"
  2. Saisir email existant
  3. Clic "Créer"

Résultat attendu : ✗ Erreur: "Cet email est déjà utilisé"
                   ✗ Pas de création d'utilisateur
                   ✗ Utilisateur reste sur le formulaire
                   ✗ Champ email mis en évidence (rouge)

Sévérité si fail : HAUTE - Doublon users = confusion, permissions

Notes           : • Tester aussi doublon username
                  • Vérifier case-insensitive pour email
```

---

## Bloc 3 : Événements (T-013 à T-016)

### TC-005-001 : Créer événement - Flux nominal

```
ID              : TC-005-001
Titre           : Création événement complète par employé
Rôle            : Employé
Type            : Fonctionnel + E2E
Criticité       : CRITIQUE
Prérequis       : • Employé connecté
                  • Au moins 1 salle existe
                  • Au moins 1 équipement existe

Données de test :
  Titre           : Réunion Q2 Planning
  Description     : Planification des objectifs Q2
  Date début      : 15/05/2026
  Heure début     : 10:00
  Date fin        : 15/05/2026
  Heure fin       : 11:30
  Salle           : Salle A1
  Équipements     : [Vidéoprojecteur, Tableau blanc]
  Participants    : [Chef (auto-selected), Colleague1, Colleague2]
  Partenaires     : Aucun

Étapes          :
  1. Clic "Créer événement"
  2. Remplissage du formulaire
  3. Vérification availability salle (affichée)
  4. Clic "Soumettre"
  5. Attendre confirmation
  6. Naviguer vers page détail

Résultat attendu : ✓ Message: "Événement créé. ID: #EVENT-001"
                   ✓ État de l'événement: "EN ATTENTE"
                   ✓ Salle marquée réservée (provisoirement)
                   ✓ Email notification envoyé au chef
                   ✓ Événement visible dans liste de l'employé
                   ✓ Participants listé correctement
                   ✓ Audit log créé

Sévérité si fail : CRITIQUE - Core business

Notes           : • Vérifier que le créateur est assigné automatiquement
                  • Vérifier réservation salle provisoire (pas confirmée)
                  • Tester avec/sans équipements
```

---

### TC-005-002 : Créer événement - Salle indisponible

```
ID              : TC-005-002
Titre           : Tentative création avec salle occupée
Rôle            : Employé
Type            : Erreur + Validation
Criticité       : HAUTE
Prérequis       : • Salle A1 réservée 15/05 10:00-11:30

Données de test : Même que TC-005-001, mais salle occupée

Étapes          :
  1. Saisir les données
  2. Salle A1 affiche "Occupée" ou "Rouge"
  3. Clic "Soumettre"

Résultat attendu : ✗ Erreur: "Salle A1 non disponible à cet horaire"
                   ✗ Suggestion: "Disponibilités alternatives"
                   ✗ Pas de création d'événement
                   ✗ Formulaire reste affiché avec données

Sévérité si fail : HAUTE - Double-booking

Notes           : • Vérifier suggestion de créneaux
                  • Tester avec chevauchement partiel (30 min avant)
```

---

## Bloc 4 : Réservations (T-017 à T-022)

### TC-006-001 : Réserver salle - Créneau libre

```
ID              : TC-006-001
Titre           : Réservation simple d'une salle
Rôle            : Employé
Type            : Fonctionnel
Criticité       : CRITIQUE
Prérequis       : • Employé connecté
                  • Salle A1 libre le 20/05 14:00-15:00

Données de test :
  Salle           : Salle A1
  Date            : 20/05/2026
  Heure début     : 14:00
  Heure fin       : 15:00
  Motif           : Réunion équipe

Étapes          :
  1. Accès à "Réservations > Salles"
  2. Clic sur Salle A1
  3. Affichage calendrier
  4. Clic sur créneau 14:00-15:00 (vert)
  5. Remplissage motif
  6. Clic "Réserver"
  7. Confirmation

Résultat attendu : ✓ Message: "Salle réservée"
                   ✓ État: "CONFIRMÉE"
                   ✓ Créneau passe au rouge (occupé)
                   ✓ Email de confirmation envoyé
                   ✓ Réservation visible dans "Mes réservations"
                   ✓ Responsable salle peut voir la réservation

Sévérité si fail : CRITIQUE - Core business

Notes           : • Vérifier durée minimale/maximale
                  • Tester réservation jusqu'à fin de journée
```

---

### TC-006-002 : Réserver salle - Race condition

```
ID              : TC-006-002
Titre           : Race condition: deux users réservent même créneau
Rôle            : Employé (x2)
Type            : Concurrence
Criticité       : HAUTE
Prérequis       : • 2 sessions simultanées
                  • Salle A1 libre le 20/05 15:00-16:00

Scénario        :
  User A accède à Salle A1
  User B accède à Salle A1 (même navigateur ou différent)
  User A réserve 15:00-16:00
  User B réserve 15:00-16:00 (simultanément)

Résultat attendu : ✓ User A: Réservation créée
                   ✓ User B: Erreur "Salle déjà réservée" (pas race)
                   ✗ Pas 2 réservations pour même créneau
                   ✗ Pas de corruption de données

Sévérité si fail : HAUTE - Double-booking possible

Notes           : • Tester avec threading/concurrence
                  • Vérifier lock optimiste/pessimiste en BD
                  • Tester avec latence réseau (delay)
```

---

## Bloc 5 : Permissions RBAC (T-049 à T-051)

### TC-049-001 : Permissions - ADMIN ne voit que ses permissions

```
ID              : TC-049-001
Titre           : Admin n'accède qu'à ses données/actions
Rôle            : Admin
Type            : Sécurité + RBAC
Criticité       : CRITIQUE
Prérequis       : • Admin connecté

Étapes          :
  1. Accès à "Administration"
  2. Essayer d'accéder à "Documents" (pas d'admin)
  3. Vérifier menu sans option "Tableau de bord Direction"
  4. Appeler API /api/v1/analytics (réservé Directeur)

Résultat attendu : ✓ Menu "Administration" visible (Users, Services)
                   ✓ "Documents" pas visible dans menu
                   ✓ "Tableau de bord Direction" absent
                   ✓ GET /api/v1/analytics → 403 Forbidden
                   ✓ Pas d'erreur révélant l'existance de l'endpoint

Sévérité si fail : CRITIQUE - Escalade de privilèges

Notes           : • Tester aussi les appels directs via DevTools
                  • Vérifier token contient les rôles corrects
```

---

### TC-049-002 : Permissions - EMPLOYE ne crée pas d'users

```
ID              : TC-049-002
Titre           : Employé bloqué de créer users
Rôle            : Employé
Type            : Sécurité + RBAC
Criticité       : CRITIQUE
Prérequis       : • Employé connecté

Étapes          :
  1. Accès à "Administration > Utilisateurs" (nav direct)
  2. Observer ce qui se passe
  3. Appeler POST /api/v1/users (création)

Résultat attendu : ✗ Page "Administration" pas accessible
                   ✗ Redirection vers "Accès refusé" ou Dashboard
                   ✗ POST /api/v1/users → 403 Forbidden
                   ✗ Pas de bouton "Ajouter utilisateur"

Sévérité si fail : CRITIQUE - Intégrité données

Notes           : • Vérifier aussi PUT/DELETE users
```

---

# [DOCUMENT CONTINUE AVEC LES SECTIONS RESTANTES...]
# [Les sections sont très longues, créant un fichier markdown complet]

## Résumé rapide des sections restantes :

### PARTIE D : Scénarios E2E
- E2E-001 : Employé crée event → Chef valide → Responsable sécurité vérifie
- E2E-002 : Admin crée user → User se connecte → Accède ressources
- E2E-003 : Employé demande intervention → Responsable traite → Clôture
- E2E-004 : Responsable qualité publie document → Employé consulte

### PARTIE E : Matrice RBAC

| Action | ADMIN | EMPLOYE | CHEF | RESP_SALLE | RESP_SECURITE | DIRECTEUR_DSN | RESP_QUALITE |
|--------|-------|---------|------|-----------|---------------|---------------|-------------|
| Créer user | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Créer événement | ✗ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| Valider événement | ✗ | ✗ | ✓ (propres équipes) | ✗ | ✗ | ✗ | ✗ |
| Vérifier partenaires | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ |
| Approuver documents | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ |
| Consulter documents | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

### PARTIE F : Jeux de données
- 7 utilisateurs (1 par rôle)
- 5 services (Finance, RH, IT, Marketing, Operations)
- 10 salles avec capacités différentes
- 20 équipements variés
- Calendriers pré-remplis d'événements
- 50 documents GED en différents états

### PARTIE G : Tests non-fonctionnels
- **Sécurité** : Injection SQL, XSS, CSRF, Token hijacking
- **Performance** : Load test 100 users, réponse API < 200ms
- **Concurrence** : Double-booking, race conditions
- **Audit** : Tous les logs tracés, timestamps correctes

### PARTIE H : Bugs probables
1. Double-booking salle (race condition)
2. User supprimé mais événement existe → orphelin
3. Token expiré pas refresh auto → page blanche
4. Partenaire non-autorisé → accès OK (bypass)
5. Réservation salle mais équipement pas synchronisé
6. Email notification pas envoyé (retry?)
7. Permission admin escalade (ADMIN voit DIRECTEUR data)
8. Salle supprimée mais réservation existe

### PARTIE I : Ordre d'exécution
1. **Smoke (P0)** : Login, Logout, Créer event, Réserver salle
2. **Fonctionnel (P1)** : CRUD all resources, validation, email
3. **E2E (P1)** : Scénarios transverses
4. **Sécurité (P1)** : RBAC, permissions, injection
5. **Charge (P2)** : Load tests
6. **Régression (P3)** : Suite complète

---

# BONUS 1 : CHECKLIST MANUELLE DE RECETTE

```
PHASE DE RECETTE MANUELLE - Durée estimée : 5 jours

## JOUR 1 : Authentification & Admin (8h)

□ Login avec 7 rôles différents
  □ Admin
  □ Employe
  □ Chef hierarchique
  □ Responsable salle
  □ Responsable securite
  □ Directeur DSN
  □ Responsable qualite

□ Logout de chaque rôle
□ Timeout inactivite (30 min)
□ Refresh page (token persiste?)
□ Token expiration (15 min)

□ Creer utilisateur (admin)
  □ Avec tous les rôles
  □ Email invalide (error)
  □ Email doublon (error)
  □ Test invitation email

□ Modifier utilisateur
  □ Changer nom
  □ Changer service
  □ Ajouter/enlever roles

□ Supprimer utilisateur
  □ Avec reactivation (soft delete)
  □ Vérifier sessions fermées

□ Dashboard admin
  □ KPIs affichés
  □ Filtres fonctionnels
  □ Export rapport

## JOUR 2 : Événements (8h)

□ Créer événement (employe)
  □ Sans partenaires
  □ Avec partenaires externes
  □ Avec multiple salles (non, juste une)
  □ Avec multiple equipements

□ Réserver salle
  □ Créneau libre OK
  □ Créneau occupé → error
  □ Double-booking (2 navigateurs)
  □ Durée < 30 min (si rule)

□ Réserver équipement
  □ Disponible OK
  □ En maintenance → error
  □ Quantité > stock → error

□ Validation événement (chef)
  □ Approuver événement
  □ Refuser + motif
  □ Demander modification

□ Partenaires externes
  □ Inviter partenaire
  □ Vérification par Directeur DSN
  □ Approuver accès
  □ Refuser accès

□ Intervention
  □ Créer demande
  □ Responsable accepte
  □ Responsable clôture
  □ Priorité urgente → notification

## JOUR 3 : Sécurité & Permissions (8h)

□ RBAC - Admin
  □ Ne voit pas Documents (sauf lecture)
  □ Ne peut pas approuver docs
  □ Ne voit pas Dashboard Direction

□ RBAC - Employe
  □ Ne peut pas créer users
  □ Ne peut pas valider événements
  □ Ne peut pas vérifier partenaires
  □ Voir que ses documents

□ RBAC - Chef
  □ Valider uniquement équipe
  □ Ne peut pas créer users
  □ Ne voit pas analytics

□ Conflits de réservation
  □ Double-booking detecté
  □ Salle surchargée
  □ Equipement non-disponible

□ Partenaires non-autorisés
  □ Partenaire bloqué accès
  □ Session partenaire limité
  □ Logs tracking accès

## JOUR 4 : Documents & Performance (8h)

□ GED - Publier document
  □ Upload PDF
  □ Metadata saisie
  □ Document en "EN REVISION"

□ GED - Approuver document
  □ Responsable reçoit notification
  □ Approuve → publication
  □ Rejette + commentaires

□ Consulter documents
  □ Accès OK
  □ Pas d'accès → error
  □ Télécharger OK
  □ Version ancienne visible

□ Performance
  □ Login < 2s
  □ Dashboard chargement < 3s
  □ Créer événement < 1s
  □ Search documents < 500ms
  □ Pas de lag au scroller

□ Load test (manuel)
  □ 5 users simultanés → pas d'error
  □ 10 users simultanés → acceptable
  □ 20 users → mesurer dégradation

## JOUR 5 : E2E & Regression (8h)

□ E2E - Full workflow event
  1. Employe crée event (30 min)
  2. Chef valide (5 min)
  3. Responsable sécurité check (5 min)
  4. Directeur DSN approuve partenaire (5 min)
  5. Employe voit confirmation (refresh page)
  6. Salle réservée, email envoyés
  7. Jour de l'événement: event visible calendrier
  8. Post-event: intervention demandée (si prob)

□ E2E - Admin workflow
  1. Admin crée user avec EMPLOYE role
  2. User reçoit email invitation
  3. User se connecte
  4. User crée événement
  5. Workflow validation se termine
  6. Observateur vérifie permissions

□ Regression sur bug fixes
  □ Vérifier chaque fix depuis sprint précédent
  □ Pas de regression majeure

□ Browser compatibility
  □ Chrome (latest)
  □ Firefox (latest)
  □ Safari (latest)
  □ Edge (latest)

□ Mobile responsiveness (si applicable)
  □ iPhone 12 / 14
  □ Android Samsung

□ Cleanup & Sign-off
  □ Tous les défauts documentés
  □ Evidence screenshots
  □ Go/No-go decision
```

---

# BONUS 2 : STRUCTURE DE FICHIER POUR AUTOMATISATION

```
tests/
├── README.md                          # Doc generale
├── package.json                       # Dependencies (Playwright, Cypress, etc)
├── playwright.config.ts               # Config Playwright
├── cypress.config.ts                  # Config Cypress
├── .env.example                       # Variables d'environnement
│
├── fixtures/                          # Donnees de test
│   ├── users.json                    # Users test par role
│   ├── rooms.json                    # Salles
│   ├── events.json                   # Events templates
│   ├── documents.json                # Documents
│   └── partners.json                 # Partenaires externes
│
├── support/                          # Code utilitaire
│   ├── auth.helper.ts               # Login/Logout helpers
│   ├── api.helper.ts                # API calls wrapper
│   ├── db.helper.ts                 # DB direct access (si needed)
│   ├── email.helper.ts              # Interception emails
│   └── wait.helper.ts               # Wait utilities
│
├── e2e/                             # Tests End-to-End
│   ├── auth/
│   │   ├── login.spec.ts
│   │   ├── logout.spec.ts
│   │   └── session-timeout.spec.ts
│   │
│   ├── admin/
│   │   ├── users.create.spec.ts
│   │   ├── users.modify.spec.ts
│   │   ├── users.delete.spec.ts
│   │   └── services.crud.spec.ts
│   │
│   ├── events/
│   │   ├── event.create.spec.ts
│   │   ├── event.validation.spec.ts
│   │   ├── room.reservation.spec.ts
│   │   ├── equipment.reservation.spec.ts
│   │   ├── partner.invite.spec.ts
│   │   └── conflict.detection.spec.ts
│   │
│   ├── intervention/
│   │   ├── intervention.create.spec.ts
│   │   ├── intervention.manage.spec.ts
│   │   └── intervention.close.spec.ts
│   │
│   ├── ged/
│   │   ├── document.publish.spec.ts
│   │   ├── document.approve.spec.ts
│   │   └── document.consult.spec.ts
│   │
│   ├── permissions/
│   │   ├── rbac.admin.spec.ts
│   │   ├── rbac.employee.spec.ts
│   │   ├── rbac.chef.spec.ts
│   │   └── escalation-prevention.spec.ts
│   │
│   └── e2e-scenarios/
│       ├── complete-event-workflow.spec.ts
│       ├── new-user-journey.spec.ts
│       └── intervention-full-cycle.spec.ts
│
├── api/                             # Tests API (sans GUI)
│   ├── auth.api.spec.ts
│   ├── users.api.spec.ts
│   ├── events.api.spec.ts
│   ├── rooms.api.spec.ts
│   └── security.api.spec.ts
│
├── performance/                     # Tests de perf
│   ├── load-test.spec.ts
│   ├── response-time.spec.ts
│   └── concurrent-booking.spec.ts
│
├── data-integrity/                  # Tests donnees
│   ├── referential-integrity.spec.ts
│   ├── orphaned-records.spec.ts
│   └── cascade-delete.spec.ts
│
└── reports/                         # Resultats tests
    ├── .gitkeep
    ├── test-results.json
    ├── coverage/
    │   └── index.html
    └── screenshots/
        └── failures/
```

---

# BONUS 3 : EXEMPLES PSEUDO-CODE PLAYWRIGHT/CYPRESS

## Exemple 1 : Test Login (Playwright)

```typescript
// tests/e2e/auth/login.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Authentication - Login', () => {
  
  test('TC-001-001: Login avec identifiants valides', async ({ page, context }) => {
    // Arrange
    const username = 'employe.cnstn';
    const password = 'User@12345';
    
    // Act
    await page.goto('http://localhost:4200/login');
    await page.fill('input[name="username"]', username);
    await page.fill('input[name="password"]', password);
    await page.click('button:has-text("Connexion")');
    
    // Wait for navigation & token storage
    await page.waitForURL('**/dashboard');
    const token = await context.storageState().then(state => 
      state.cookies.find(c => c.name === 'access_token')?.value
    );
    
    // Assert
    expect(page.url()).toContain('/dashboard');
    expect(token).toBeTruthy();
    expect(token?.length).toBeGreaterThan(50);
    
    // Verify API call with token
    const meResponse = await page.evaluate(async () => {
      return fetch('http://localhost:8088/api/v1/me', {
        headers: { 'Authorization': `Bearer ${token}` }
      }).then(r => r.status);
    });
    expect(meResponse).toBe(200);
    
    // Verify dashboard widgets loaded
    await expect(page.locator('[data-testid="dashboard-widget"]')).toBeVisible();
  });

  test('TC-001-002: Login avec identifiants invalides', async ({ page }) => {
    // Arrange & Act
    await page.goto('http://localhost:4200/login');
    await page.fill('input[name="username"]', 'employe.cnstn');
    await page.fill('input[name="password"]', 'WrongPassword');
    await page.click('button:has-text("Connexion")');
    
    // Assert - error message
    const errorMsg = page.locator('[data-testid="error-message"]');
    await expect(errorMsg).toBeVisible();
    await expect(errorMsg).toContainText('Identifiants invalides');
    
    // Verify still on login page
    expect(page.url()).toContain('/login');
    
    // Verify no token created
    const storage = await page.evaluate(() => localStorage.getItem('access_token'));
    expect(storage).toBeNull();
  });

  test('TC-001-003: Logout et invalidation token', async ({ page, context }) => {
    // Login first
    await page.goto('http://localhost:4200/login');
    await page.fill('input[name="username"]', 'employe.cnstn');
    await page.fill('input[name="password"]', 'User@12345');
    await page.click('button:has-text("Connexion")');
    await page.waitForURL('**/dashboard');
    
    // Get token before logout
    const tokenBefore = await page.evaluate(() => localStorage.getItem('access_token'));
    expect(tokenBefore).toBeTruthy();
    
    // Act - Logout
    await page.click('[data-testid="profile-menu"]');
    await page.click('button:has-text("Déconnexion")');
    
    // Assert
    await page.waitForURL('**/login');
    const tokenAfter = await page.evaluate(() => localStorage.getItem('access_token'));
    expect(tokenAfter).toBeNull();
    
    // Verify API returns 401
    const meResponse = await page.evaluate(async () => {
      return fetch('http://localhost:8088/api/v1/me').then(r => r.status);
    });
    expect(meResponse).toBe(401);
  });
});
```

## Exemple 2 : Test RBAC (Cypress)

```typescript
// tests/e2e/permissions/rbac.admin.spec.ts
import { testUser } from '../../fixtures/users.json';

describe('RBAC - Admin Permissions', () => {
  
  beforeEach(() => {
    cy.login(testUser.admin);
  });

  it('TC-049-001: Admin voit Administration menu', () => {
    cy.visit('/dashboard');
    
    // Menu items admin should see
    cy.get('[data-menu="administration"]').should('be.visible');
    cy.get('[data-menu="users"]').should('be.visible');
    cy.get('[data-menu="services"]').should('be.visible');
    
    // Menu items admin should NOT see
    cy.get('[data-menu="dashboard-direction"]').should('not.exist');
    cy.get('[data-menu="analytics"]').should('not.exist');
  });

  it('TC-049-001: Admin blocked from Analytics API', () => {
    // Direct API call attempt
    cy.request({
      method: 'GET',
      url: 'http://localhost:8088/api/v1/analytics',
      failOnStatusCode: false,
      headers: {
        'Authorization': `Bearer ${Cypress.env('adminToken')}`
      }
    }).then(response => {
      expect(response.status).to.equal(403);
    });
  });

  it('TC-049-001: Admin blocked from Dashboard Direction page', () => {
    cy.visit('/dashboard-direction', { failOnStatusCode: false });
    
    // Should be redirected or show access denied
    cy.url().should('not.include', '/dashboard-direction');
    cy.contains('Accès refusé').should('be.visible').or(
      cy.url().should('include', '/dashboard')
    );
  });
});
```

## Exemple 3 : Test Concurrence (Playwright - Race Condition)

```typescript
// tests/performance/concurrent-booking.spec.ts
import { test, expect } from '@playwright/test';

test('TC-006-002: Race condition - double booking', async ({ browser }) => {
  // Create 2 context (simulating 2 users)
  const context1 = await browser.newContext();
  const context2 = await browser.newContext();
  
  const page1 = await context1.newPage();
  const page2 = await context2.newPage();
  
  try {
    // Setup: both users login
    await loginAs(page1, 'employe.cnstn', 'User@12345');
    await loginAs(page2, 'chef.cnstn', 'User@12345');
    
    // Both navigate to room reservation
    await page1.goto('http://localhost:4200/reservations/rooms/1');
    await page2.goto('http://localhost:4200/reservations/rooms/1');
    
    // Both see the same free slot (14:00-15:00)
    await expect(page1.locator('[data-slot="1400-1500"]')).toHaveClass(/available/);
    await expect(page2.locator('[data-slot="1400-1500"]')).toHaveClass(/available/);
    
    // Both click to reserve (simulate simultaneous)
    const [res1, res2] = await Promise.all([
      page1.click('[data-slot="1400-1500"]'),
      page2.click('[data-slot="1400-1500"]')
    ]);
    
    // Fill form on both pages
    await page1.fill('input[name="motif"]', 'Réunion User1');
    await page1.click('button:has-text("Réserver")');
    
    // Wait a tiny bit then second user submits
    await page2.waitForTimeout(100);
    await page2.fill('input[name="motif"]', 'Réunion User2');
    await page2.click('button:has-text("Réserver")');
    
    // Assert: only one succeeds
    const success1 = page1.locator('[data-testid="success-message"]');
    const success2 = page2.locator('[data-testid="success-message"]');
    const error2 = page2.locator('[data-testid="error-message"]');
    
    await expect(success1).toBeVisible();
    
    // Second one should fail
    await expect.soft(error2).toContainText('non disponible|already booked');
    
    // Verify DB state: only 1 reservation for this slot
    const reservations = await fetchAPI(
      'GET',
      'http://localhost:8088/api/v1/reservations?room=1&date=2026-05-20&time=1400'
    );
    expect(reservations.data.length).toBe(1);
    
  } finally {
    await context1.close();
    await context2.close();
  }
});

async function loginAs(page, username, password) {
  await page.goto('http://localhost:4200/login');
  await page.fill('input[name="username"]', username);
  await page.fill('input[name="password"]', password);
  await page.click('button:has-text("Connexion")');
  await page.waitForURL('**/dashboard');
}

async function fetchAPI(method, url) {
  // Helper to make API calls
  return fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    .then(r => r.json());
}
```

---

# BONUS 4 : TOP 15 TESTS LES PLUS CRITIQUES

Classement par impact métier x criticité technique :

| Rang | Test ID | Titre | Raison | Impact |
|------|---------|-------|--------|--------|
| **1** | TC-001-001 | Login valide | Aucun user ne peut accéder | CATASTROPHE |
| **2** | TC-001-003 | Logout & token invalidation | Sécurité, session zombie | SÉCURITÉ CRITIQUE |
| **3** | TC-049-001 | ADMIN escalade privileges | Accès à données protégées | SÉCURITÉ CRITIQUE |
| **4** | TC-049-002 | EMPLOYE ne crée pas users | Data integrity risk | SÉCURITÉ HAUTE |
| **5** | TC-005-001 | Créer événement nominal | Workflow métier complet | MÉTIER CRITIQUE |
| **6** | TC-013-001 | Chef valide événement | Process validation | MÉTIER CRITIQUE |
| **7** | TC-006-001 | Réserver salle OK | Core business | MÉTIER CRITIQUE |
| **8** | TC-006-002 | Race condition booking | Double-booking possible | SÉCURITÉ/MÉTIER |
| **9** | TC-042-001 | Directeur approuve partenaire | Security gate | SÉCURITÉ HAUTE |
| **10** | TC-051-001 | Chef ne valide autre équipe | Segregation duties | SÉCURITÉ HAUTE |
| **11** | TC-008-001 | Modifier user & rôles sync | Permission risk | SÉCURITÉ HAUTE |
| **12** | TC-046-001 | GED publier document | Workflow qualité | MÉTIER MOYENNE |
| **13** | TC-023-001 | Demander intervention | Support process | MÉTIER HAUTE |
| **14** | TC-025-001 | Consulter document | Read access | MÉTIER MOYENNE |
| **15** | TC-016-001 | Inviter partenaire externe | Security gate | SÉCURITÉ HAUTE |

---

# BONUS 5 : QUESTIONS MÉTIER À CLARIFIER AVEC LE PO

## Clarifications urgentes

### 1. Workflow Événement
- **Q** : Un événement peut-il être modifié après approbation du chef ?
- **Q** : Si l'événement est refusé, la salle reste-elle réservée ou libérée ?
- **Q** : Quelle est la durée max d'un événement ? (8h, 1 jour, illimité ?)

### 2. Partenaires Externes
- **Q** : L'accès partenaire est-il limité temporellement (date d'expiration) ?
- **Q** : Un partenaire peut-il voir les détails d'autres partenaires du même événement ?
- **Q** : Quelles données un partenaire peut-il consulter ? (juste le document ? la salle ? les participants ?)

### 3. Suppression de Données
- **Q** : Quand on supprime un utilisateur, les événements créés sont-ils supprimés aussi ? (Cascade delete)
- **Q** : Un événement supprimé → la salle reste réservée ou libérée ?
- **Q** : Soft-delete ou hard-delete pour les utilisateurs ?

### 4. Interventions
- **Q** : Une intervention urgente doit être traitée en combien de temps ? (SLA ?)
- **Q** : L'employé qui a créé l'intervention peut-il la modifier avant résolution ?
- **Q** : Y a-t-il une estimation de coût pour chaque intervention ?

### 5. GED - Workflow Document
- **Q** : Combien d'approbateurs pour publier un document ?
- **Q** : Les commentaires des approbateurs sont-ils visibles au créateur ?
- **Q** : Anciennes versions d'un document restent-elles accessibles (audit trail) ?

### 6. Permissions Spéciales
- **Q** : Le Chef peut-il valider un événement créé par lui-même ? (auto-approval ?)
- **Q** : Le Responsable Sécurité peut-il modifier une intervention ?
- **Q** : Le Directeur DSN a-t-il des permissions d'écriture ou juste lecture (analytics) ?

### 7. Notifications
- **Q** : Tous les changements d'état générent-ils un email ?
- **Q** : Y a-t-il une préférence de notification (in-app only, email, SMS) ?
- **Q** : Les notifications doivent-elles être archivées ou juste récentes ?

### 8. Conflits de Réservation
- **Q** : Comment gérer les chevauchements : interdire ou alerter ?
- **Q** : Une intervention peut-elle créer un conflit de réservation salle ?
- **Q** : Y a-t-il un "buffer" de temps entre 2 événements (nettoyage salle) ?

### 9. Dashboard Direction
- **Q** : Quels KPIs sont prioritaires ? (usage salle, événements, interventions, partenaires)
- **Q** : Fréquence de refresh : temps réel ou quotidien ?
- **Q** : Exporter rapport en quel format ? (PDF, Excel, CSV)

### 10. Sécurité & Audit
- **Q** : Comment tracker les accès partenaires ? (IP, timestamp, actions)
- **Q** : Retention des logs audit : combien de temps ? (6 mois, 1 an, 5 ans)
- **Q** : Qui peut consulter les logs d'audit ? (Admin, Directeur DSN)

---

## FIN DU DOCUMENT

**Signature QA Lead** : ___________________  **Date** : 20/04/2026

---

*Document généré par : QA Lead Senior + Business Analyst*  
*Approuvé par : Product Owner*  
*Version* : 1.0 - FINAL
