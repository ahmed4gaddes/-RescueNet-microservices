# Répartition du travail et planning

> Livrable « Validation 1 ». **À compléter par l'équipe** : les noms ci-dessous sont des espaces réservés, le planning suit les séances de la fiche du module.

## 1. Équipe et responsabilités

| Membre | Rôle | Services / livrables |
|---|---|---|
| _Membre 1 (à renseigner)_ | Architecte / Java | `discovery-server`, `api-gateway`, `emergency-service` (OpenFeign, saga, RabbitMQ producteur) |
| _Membre 2 (à renseigner)_ | Backend polyglotte | `patient-record-service` (Node.js), `triage-ai-service` (Python) |
| _Membre 3 (à renseigner)_ | Backend polyglotte | `hospital-service` (C#), `dispatch-service` (Go) |
| _Membre 4 (à renseigner)_ | Sécurité / DevOps | Keycloak (realm, rôles), Docker, Docker Compose |
| _Membre 5 (à renseigner)_ | Frontend | Application Angular, intégration JWT, tests de bout en bout |

Tous les membres : documentation de leurs services et revue de code via GitHub.

## 2. Planning (aligné sur les séances du module)

| Séance | Thème | Livrable du projet | Statut |
|---|---|---|---|
| S1 | Architectures distribuées et SOA | réponses au prosit, cadrage du sujet | fait |
| S2 | API REST | API REST de chaque service, Swagger/OpenAPI | fait |
| S3 | Migration vers les microservices | décomposition en 5 modules métier | fait |
| S4 | Service Discovery, observabilité | Eureka, clients Eureka (Java, Node, Python, C#, Go), Actuator | fait |
| S5 | Validation 1 : conception | diagramme d'architecture (`docs/ARCHITECTURE.md`), répartition, planning, dépôt Git | fait |
| S6 | API Gateway et documentation | Spring Cloud Gateway, routes `lb://`, Swagger UI | fait |
| S7 | Communication synchrone | OpenFeign dans `emergency-service`, DTO typés | fait |
| S8 | Communication asynchrone | RabbitMQ : événements de mission | fait |
| S9 | Sécurité | Keycloak, JWT, rôles OPERATEUR / ADMIN | fait |
| S10 | Conteneurisation | un `Dockerfile` par service, `docker-compose.yml` | fait |
| Soutenance | Démonstration et justification | `docs/JUSTIFICATION-ARCHITECTURE.md`, démo | à préparer |

## 3. Organisation Git

- Branche `main` : version stable et démontrable.
- Une branche par fonctionnalité (`feature/<sujet>`), fusion par pull request relue par un autre membre.
- Messages de commit courts et explicites.

## 4. Scénario de démonstration (soutenance)

1. `docker compose up -d --build`, puis ouvrir Eureka (6 services UP).
2. Connexion `operateur`, création d'une urgence, suivi sur la carte jusqu'à `COMPLETED`.
3. Connexion `admin` : écran Triage IA et modification d'un dossier (interdits à l'opérateur : 403).
4. Arrêt de `dispatch-service` : nouvelle urgence, 503 explicite, lit libéré.
5. Console RabbitMQ : messages des événements. Swagger UI de chaque service.
