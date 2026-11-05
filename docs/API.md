# Référence des API

Toutes les requêtes passent par la **Gateway** : `http://localhost:8080` (jeton JWT Keycloak obligatoire).

## Obtenir un jeton (tests)

```powershell
$t = (Invoke-RestMethod -Method Post http://localhost:8180/realms/rescuenet/protocol/openid-connect/token `
  -Body @{client_id='rescuenet-cli'; username='operateur'; password='operateur123'; grant_type='password'}).access_token
Invoke-RestMethod http://localhost:8080/api/hospitals -Headers @{Authorization="Bearer $t"}
```

Comptes de démonstration : `operateur` / `operateur123` (OPERATEUR), `admin` / `admin123` (ADMIN).

## Routes

| Méthode | Route Gateway | Service | Rôle | Description |
|---|---|---|---|---|
| POST | `/api/emergencies` | emergency | OPERATEUR, ADMIN | Signaler une urgence (saga complète). 201, 400, 409, 503 |
| GET | `/api/emergencies` | emergency | OPERATEUR, ADMIN | 50 dernières missions |
| GET | `/api/emergencies/{id}` | emergency | OPERATEUR, ADMIN | Détail d'une mission (404 si inconnue) |
| GET | `/api/patients` | patient-record | OPERATEUR, ADMIN | 50 dossiers récents |
| GET | `/api/patients/{id}` | patient-record | OPERATEUR, ADMIN | Dossier par identifiant |
| GET | `/api/patients/national/{cin}` | patient-record | OPERATEUR, ADMIN | Dossier par CIN |
| POST | `/api/patients` | patient-record | ADMIN | Créer un dossier |
| PUT | `/api/patients/{id}` | patient-record | ADMIN | Modifier un dossier |
| POST | `/api/patients/{id}/interventions` | patient-record | ADMIN | Ajouter une intervention |
| GET | `/api/hospitals` | hospital | OPERATEUR, ADMIN | Hôpitaux et lits |
| GET | `/api/hospitals/{id}` | hospital | OPERATEUR, ADMIN | Un hôpital |
| GET | `/api/dispatch/ambulances` | dispatch | OPERATEUR, ADMIN | Flotte et positions |
| GET | `/api/dispatch/missions/{id}` | dispatch | OPERATEUR, ADMIN | Position en direct d'une mission |
| GET | `/api/triage/history` | triage-ai | ADMIN | Historique des triages |
| POST | `/api/triage` | triage-ai | ADMIN | Calcul d'un triage (utilisé en interne par emergency) |

Sans jeton : **401**. Rôle insuffisant : **403**.

## Documentation interactive (Swagger UI)

Accessible directement sur chaque service (pas de jeton en direct, usage de développement) :

| Service | Swagger UI | Spécification OpenAPI |
|---|---|---|
| emergency-service | http://localhost:8081/swagger-ui.html | `/v3/api-docs` |
| patient-record-service | http://localhost:8082/swagger-ui | `/v3/api-docs` |
| triage-ai-service | http://localhost:8083/docs | `/openapi.json` |
| hospital-service | http://localhost:8084/swagger-ui | `/v3/api-docs` |
| dispatch-service | http://localhost:8085/swagger-ui | `/v3/api-docs` |

L'interface Swagger charge ses fichiers depuis `unpkg.com` (connexion internet nécessaire) pour les services Node, C# et Go.

## Postman

Importer dans Postman : `docs/postman/RescueNet.postman_collection.json` et `docs/postman/RescueNet.postman_environment.json`.
La collection contient les connexions des deux rôles, le parcours complet d'une urgence et les contrôles 401/403, avec des tests automatiques.
Exécution en ligne de commande :

```powershell
npx newman run docs\postman\RescueNet.postman_collection.json -e docs\postman\RescueNet.postman_environment.json
```

## Événements RabbitMQ (exchange topic `rescuenet.events`)

| Clé de routage | Producteur | Consommateurs | Contenu |
|---|---|---|---|
| `mission.status.changed` | dispatch | emergency | `missionId`, statut (`ON_SCENE`, `TRANSPORTING`, `ARRIVED`) |
| `mission.dispatched` | emergency | informatif | mission envoyée |
| `mission.completed` | emergency | hospital, patient-record, dispatch | admission, historique, ambulance libre |
