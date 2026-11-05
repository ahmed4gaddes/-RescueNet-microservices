# Démarrage complet et scénario de démonstration

## A. Tout arrêter (point de départ propre)

Dans PowerShell, à la racine du projet :

```powershell
cd G:\project2
docker compose down                 # arrête et supprime les conteneurs (les données sont conservées)
powershell -ExecutionPolicy Bypass -File scripts\stop-all.ps1 -WithInfra   # seulement si vous avez lancé le mode local
docker ps                           # doit afficher une liste vide
```

- `docker compose down -v` efface **aussi** les données (lits, dossiers, comptes Keycloak) : à utiliser pour repartir de zéro.
- Pour fermer Docker lui-même : clic droit sur l'icône Docker (barre des tâches) puis **Quit Docker Desktop**.

## B. Démarrer (tout en conteneurs)

1. **Ouvrir Docker Desktop** et attendre « Engine running » (icône verte).
2. Dans PowerShell :
   ```powershell
   cd G:\project2
   docker compose up -d --build
   ```
   - Premier lancement : construction des 8 images, plusieurs minutes selon la connexion. Ensuite : 1 à 2 minutes.
   - L'ordre est géré par Docker : bases, RabbitMQ et Keycloak d'abord, puis Eureka, puis les services, puis le frontend.
3. Vérifier les conteneurs :
   ```powershell
   docker compose ps
   ```
   Les 15 conteneurs doivent être `Up`, ceux qui ont une sonde sont `healthy`. SQL Server et Keycloak sont les plus lents (environ une minute).

## C. Vérifier les serveurs dans Eureka

Ouvrir **http://localhost:8761** (patienter 30 à 60 secondes après le démarrage).
Dans « Instances currently registered with Eureka », on doit voir **6 applications, toutes en UP** :

| Application | Port |
|---|---|
| API-GATEWAY | 8080 |
| EMERGENCY-SERVICE | 8081 |
| PATIENT-RECORD-SERVICE | 8082 |
| TRIAGE-AI-SERVICE | 8083 |
| HOSPITAL-SERVICE | 8084 |
| DISPATCH-SERVICE | 8085 |

Si un service manque : attendre une minute et actualiser, puis `docker compose logs <nom-du-service>` (ex. `docker compose logs hospital-service`).

Autres vérifications utiles :

| Outil | Adresse | Accès |
|---|---|---|
| Keycloak (console) | http://localhost:8180 | `admin` / `admin123` |
| RabbitMQ | http://localhost:15672 | `rescue` / `rescue123` |
| Swagger emergency | http://localhost:8081/swagger-ui.html | — |

## D. Lancer le frontend

En mode Docker, le frontend **tourne déjà** : ouvrir **http://localhost:4200**.
Le navigateur est redirigé vers la page de connexion Keycloak.

> Mode développement (sans Docker pour les services) : `docker compose -f docker-compose.infra.yml up -d`, puis `scripts\start-all.ps1` (il lance aussi le frontend avec `ng serve`).

## E. Scénario complet

Comptes de démonstration :

| Compte | Mot de passe | Rôle |
|---|---|---|
| `operateur` | `operateur123` | OPERATEUR |
| `admin` | `admin123` | ADMIN |

### Partie 1 : rôle OPERATEUR (centre d'appels)

| # | Action | Bouton / écran | Résultat attendu |
|---|---|---|---|
| 1 | Ouvrir http://localhost:4200 | page Keycloak | formulaire de connexion |
| 2 | Saisir `operateur` / `operateur123` | **Sign In** | retour sur le tableau de bord, « Sami Operateur · Opérateur » en bas du menu |
| 3 | Observer le **Tableau de bord** | — | 4 indicateurs (missions, cas rouge, ambulances libres, lits), carte avec hôpitaux (bleu) et ambulances (vert) |
| 4 | Regarder le menu | — | 6 entrées, **pas de « Triage IA »** |
| 5 | Menu **Nouvelle urgence** (ou bouton **✚ Signaler une urgence**) | formulaire | page « Nouvelle urgence » |
| 6 | Cliquer **Remplir avec la démo** | — | téléphone, CIN, 2 symptômes et constantes remplis (SpO₂ 88 %, pouls 128) |
| 7 | Cliquer **🚑 Lancer le dispatch** | — | redirection vers « Suivi de mission » |
| 8 | Observer le **Suivi de mission** | frise + carte | triage **ROUGE** (score ≈ 99, Cardiologie), hôpital et réservation, ambulance AMB-xx ; l'ambulance (vert) bouge vers le patient (rouge) puis vers l'hôpital (bleu) |
| 9 | Attendre environ 15 s | — | frise : Ambulance envoyée → Sur place → Transport → **Admis** ; message vert « Patient admis à… » |
| 10 | Cliquer **Voir le dossier patient →** | — | dossier : l'intervention vient d'être ajoutée à l'historique |
| 11 | Menu **Missions** | tableau | la mission apparaît ; essayer les filtres **Toutes / Rouge / Orange / Vert / Échecs**, puis cliquer une ligne |
| 12 | Menu **Hôpitaux** | cartes | jauge de lits : un lit de moins à l'hôpital choisi |
| 13 | Menu **Ambulances** | table + carte | l'ambulance est « En mission » puis redevient « Disponible » |
| 14 | Menu **Patients** | liste | taper un nom ou un CIN dans la recherche ; ouvrir un dossier : **aucun bouton « Modifier le dossier »** |
| 15 | Dans la barre d'adresse, ouvrir `/triage` | — | page **« Accès refusé »** (rôle insuffisant) |
| 16 | Cliquer **Changer de thème** | — | bascule clair / sombre |
| 17 | Cliquer **Se déconnecter** | — | retour à la page de connexion Keycloak |

### Partie 2 : rôle ADMIN

| # | Action | Bouton / écran | Résultat attendu |
|---|---|---|---|
| 18 | Se connecter avec `admin` / `admin123` | **Sign In** | « Amel Admin · Administrateur » |
| 19 | Regarder le menu | — | 7 entrées, dont **Triage IA**, et un lien **Eureka ↗** |
| 20 | Menu **Triage IA** | tableau | répartition ROUGE / ORANGE / VERT et historique des décisions du modèle |
| 21 | Menu **Patients**, ouvrir un dossier | — | le bouton **Modifier le dossier** est visible |
| 22 | Cliquer **Modifier le dossier**, changer le nom, **Enregistrer** | formulaire | message « Dossier enregistré. », nouveau nom affiché |
| 23 | Cliquer **Se déconnecter** | — | retour à Keycloak |

### Partie 3 : panne d'un service (résilience)

| # | Action | Résultat attendu |
|---|---|---|
| 24 | Se reconnecter en `operateur`, puis dans PowerShell : `docker stop rescuenet-dispatch` | — |
| 25 | Attendre 10 s, **Nouvelle urgence** → **Remplir avec la démo** → **🚑 Lancer le dispatch** | message rouge « Service indispensable indisponible : DISPATCH-SERVICE », la mission est en **Échec** (filtre « Échecs »), le nombre de lits **n'a pas baissé** (le lit est libéré) |
| 26 | `docker start rescuenet-dispatch`, attendre 30 s, relancer une urgence | tout refonctionne |

### Partie 4 : libération automatique des lits

Après la partie 1, le nombre de lits libres a baissé d'une unité. **Environ 3 minutes plus tard**, le patient « sort » : sur la page **Hôpitaux**, le lit réapparaît dans la jauge (la durée se règle avec `Hospital__StayMinutes` dans `docker-compose.yml`).

### Partie 5 : ce que l'on peut montrer côté technique

| Quoi | Où |
|---|---|
| Services par nom, sans URL en dur | Eureka http://localhost:8761 |
| Appels OpenFeign | `docker compose logs emergency-service` (lignes `[TriageClient#triage] ---> POST http://TRIAGE-AI-SERVICE/...`) |
| Messages asynchrones | RabbitMQ http://localhost:15672, exchange `rescuenet.events` |
| Contrôle des rôles par la Gateway | Postman : `docs/postman/` (401 sans jeton, 403 pour l'opérateur) |
| Documentation des API | Swagger : voir `docs/API.md` |

## F. En cas de problème

| Symptôme | Cause probable | Action |
|---|---|---|
| Page blanche ou erreur de connexion | Keycloak pas encore prêt | attendre 1 à 2 minutes, actualiser |
| Message « API Gateway injoignable » | gateway pas démarrée | `docker compose ps`, `docker compose logs api-gateway` |
| Un service absent d'Eureka | démarrage en cours ou base indisponible | attendre, puis `docker compose logs <service>` |
| Réponse 409 « Aucun lit disponible » | beaucoup d'urgences en peu de temps | attendre la sortie automatique (3 min) ou `docker compose down -v` |
| Erreur de port déjà utilisé | mode local encore actif | `scripts\stop-all.ps1` puis relancer `docker compose up -d` |
| Cartes grises | pas d'internet (tuiles OpenStreetMap) | vérifier la connexion |
