# RescueNet — dispatch intelligent des urgences médicales

Projet microservices **polyglotte** et **faiblement couplé** : 5 modules métier indispensables (chacun dans un langage
et avec une base de données différents), un **Discovery Server Eureka** et une **API Gateway**.

Scénario : un appel d'urgence arrive → dossier du patient → **triage par IA** → **lit réservé** dans l'hôpital le plus
proche ayant la bonne spécialité → **ambulance la plus proche** envoyée, avec suivi GPS simulé jusqu'à l'hôpital.
Sans l'un des 5 modules, aucune mission ne peut être lancée.

| Module | Langage | Port | Base de données | Rôle |
|---|---|---|---|---|
| `discovery-server` | Java / Spring Boot (Eureka) | 8761 | – | Annuaire des services |
| `api-gateway` | Java / Spring Cloud Gateway | 8080 | – | Entrée unique, routes `lb://` |
| `emergency-service` | Java 21 / Spring Boot | 8081 | PostgreSQL (5433) | Orchestration de la mission (saga) |
| `patient-record-service` | Node.js / Express | 8082 | MongoDB (27017) | Dossiers médicaux |
| `triage-ai-service` | Python / FastAPI + scikit-learn | 8083 | MySQL (3306) | Gravité ROUGE/ORANGE/VERT + spécialité |
| `hospital-service` | C# / .NET 10 | 8084 | SQL Server (1433) | Hôpitaux, lits, réservations |
| `dispatch-service` | Go / Gin | 8085 | Redis (6379) | Ambulances, GEOSEARCH, simulateur GPS |

Infra : RabbitMQ (5672, console http://localhost:15672, `rescue` / `rescue123`).
PostgreSQL Docker est sur **5433** car le PostgreSQL local de la machine occupe 5432.

## Prérequis
JDK 21, .NET 10 SDK, Python 3.12, Go 1.23+, Node.js 22, Docker Desktop.
Maven n'est pas nécessaire (`mvnw` inclus dans chaque projet Spring Boot).

## Première installation
```powershell
# Java (une fois par service Spring Boot : discovery-server, api-gateway, emergency-service)
cd emergency-service ; .\mvnw.cmd -DskipTests package ; cd ..
# Python
cd triage-ai-service ; python -m venv .venv ; .\.venv\Scripts\pip install -r requirements.txt ; .\.venv\Scripts\python train_model.py ; cd ..
# Node
cd patient-record-service ; npm install ; cd ..
# .NET
cd hospital-service ; dotnet build -c Release ; cd ..
# Go
cd dispatch-service ; go build -o dispatch-service.exe . ; cd ..
```

## Lancer / arrêter
```powershell
powershell -ExecutionPolicy Bypass -File scripts\start-all.ps1     # Docker + infra + tous les services
powershell -ExecutionPolicy Bypass -File scripts\stop-all.ps1      # arrête les services (-WithInfra : + conteneurs)
```
Chaque service s'enregistre seul dans Eureka (http://localhost:8761) ; il apparaît sous ~10-30 s et disparaît à l'arrêt.
Logs : `logs\*.log` et `logs\*.err`.

## Démo
```powershell
# Urgence : patient connu, douleur thoracique, SpO2 88 %  (via la Gateway)
curl.exe -X POST http://localhost:8080/api/emergencies -H "Content-Type: application/json" -d "@scripts/demo-emergency.json"
# Suivi (remplacer <id>) : DISPATCHED -> ON_SCENE -> TRANSPORTING -> COMPLETED
curl.exe http://localhost:8080/api/emergencies/<id>
```
À la fin de la mission : le lit passe en `ADMITTED` (hospital), l'ambulance redevient `AVAILABLE` (dispatch) et
l'intervention est ajoutée au dossier du patient (patient-record).

Test de résilience : arrêter `dispatch-service`, relancer l'urgence → `503` explicite (« Service indispensable
indisponible : DISPATCH-SERVICE »), mission `FAILED`, et le lit déjà réservé est **libéré** (compensation de la saga).

## Lancer avec Docker (tout en conteneurs)
```powershell
docker compose up -d --build          # construit les 8 images et démarre toute la plateforme
docker compose ps                     # état des conteneurs
docker compose logs -f emergency-service
docker compose down                   # arrêt (ajouter -v pour supprimer aussi les données)
```
Un `Dockerfile` par service (build multi-étapes), `docker-compose.yml` pour les applications et `docker-compose.infra.yml` (inclus) pour les bases, RabbitMQ et Keycloak.
Accès : frontend http://localhost:4200, Gateway http://localhost:8080, Eureka http://localhost:8761, Keycloak http://localhost:8180.
Ne pas lancer `scripts\start-all.ps1` en même temps (mêmes ports). Il faut environ 5 Go de RAM alloués à Docker.

Deux modes : **Docker** (ci-dessus) ou **développement** (`docker-compose.infra.yml` + `scripts\start-all.ps1`, services en processus locaux).
Les services s'annoncent à Eureka sous leur nom de conteneur grâce à `SERVICE_HOST` (par défaut `localhost` en mode local).

## Documentation
| Document | Contenu |
|---|---|
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | diagrammes d'architecture, de séquence (saga), de déploiement et de sécurité |
| [`docs/API.md`](docs/API.md) | routes, rôles, Swagger UI de chaque service, événements RabbitMQ |
| [`docs/JUSTIFICATION-ARCHITECTURE.md`](docs/JUSTIFICATION-ARCHITECTURE.md) | monolithe / SOA / microservices, limites, choix d'outils |
| [`docs/VEILLE-OBSERVABILITE.md`](docs/VEILLE-OBSERVABILITE.md) | équivalents d'Actuator pour Node.js et Python |
| [`docs/PLANNING-REPARTITION.md`](docs/PLANNING-REPARTITION.md) | répartition de l'équipe, planning, scénario de démo |
| [`docs/postman/`](docs/postman) | collection Postman + environnement |

## Frontend (Angular)
`frontend/` : Angular 22, connexion Keycloak (PKCE), écrans tableau de bord, nouvelle urgence, suivi de mission sur carte, missions, patients, hôpitaux, ambulances, triage IA (admin). En développement : `cd frontend ; npx ng serve` (lancé par `start-all.ps1`).

## Architecture et couplage faible
- **Une base par service**, moteurs différents ; aucun accès croisé.
- **Aucune URL en dur** : `emergency-service` appelle `http://TRIAGE-AI-SERVICE/...` etc. via Eureka + LoadBalancer.
- **Saga orchestrée** dans `emergency-service` : patient → triage → lit → ambulance, avec compensation (libération du lit).
  Timeouts, une nouvelle tentative, et jamais de rejeu automatique des appels non idempotents après un timeout.
- **Événements RabbitMQ** (exchange topic `rescuenet.events`) :
  - `mission.status.changed` (dispatch → emergency) : `ON_SCENE`, `TRANSPORTING`, `ARRIVED`
  - `mission.dispatched` (emergency) — informatif
  - `mission.completed` (emergency → hospital, patient-record, dispatch) : admission, historique, ambulance libre
- Les clients Eureka de .NET et Go sont écrits à la main (register, heartbeat 10 s, deregister) pour ne dépendre
  d'aucune bibliothèque liée à une version précise du framework.

## Routes de la Gateway
```
/api/emergencies/**  -> EMERGENCY-SERVICE        /api/hospitals/**  -> HOSPITAL-SERVICE
/api/patients/**     -> PATIENT-RECORD-SERVICE   /api/dispatch/**   -> DISPATCH-SERVICE
/api/triage/**       -> TRIAGE-AI-SERVICE
```

## Limites connues
- Les données (hôpitaux, ambulances, patients) et le modèle d'IA sont **synthétiques** : démonstration uniquement.
- La saga n'a pas d'outbox transactionnelle : si RabbitMQ tombe pendant la publication de `mission.completed`,
  le message est retenté 3 fois puis abandonné.
- Mémoire : SQL Server (~2 Go) + 3 JVM limitées + 4 autres services : fermer les applications lourdes pendant la démo.

## Sécurité (Keycloak + JWT)
- **Keycloak** (Docker, http://localhost:8180, console `admin` / `admin123`) émet les JWT du realm `rescuenet` (importé depuis `keycloak/rescuenet-realm.json`).
- **API Gateway** = resource server : sans jeton `401`, rôle insuffisant `403`. Les services internes ne sont joignables que via la Gateway en usage normal.
- **Frontend Angular** : connexion Keycloak (code + PKCE) via `keycloak-js`, jeton ajouté par `auth.interceptor.ts`, menus et routes filtrés par rôle.

| Compte | Mot de passe | Rôle |
|---|---|---|
| `operateur` | `operateur123` | OPERATEUR |
| `admin` | `admin123` | ADMIN (+ OPERATEUR) |

| Action | OPERATEUR | ADMIN |
|---|---|---|
| Créer / suivre une urgence, voir patients, hôpitaux, ambulances | oui | oui |
| Modifier un dossier patient, historique du triage IA, actuator | non | oui |

Test en ligne de commande (client `rescuenet-cli`, dev uniquement) :
```powershell
$t = (Invoke-RestMethod -Method Post http://localhost:8180/realms/rescuenet/protocol/openid-connect/token -Body @{client_id='rescuenet-cli';username='operateur';password='operateur123';grant_type='password'}).access_token
Invoke-RestMethod http://localhost:8080/api/hospitals -Headers @{Authorization="Bearer $t"}
```
Les mots de passe ci-dessus sont des comptes de démonstration : à changer hors démo. Pour réimporter le realm, supprimer le volume `rescuenet_rescuenet_keycloak_data`.
