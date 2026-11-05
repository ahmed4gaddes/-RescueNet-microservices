# Architecture de RescueNet

> Livrable « Validation 1 » (diagramme d'architecture). Les diagrammes sont en Mermaid : ils s'affichent directement sur GitHub.

## 1. Vue d'ensemble

```mermaid
flowchart LR
    U([Opérateur / Admin<br/>navigateur]) -->|HTTP| FE[Frontend Angular<br/>:4200]
    FE -->|OIDC code + PKCE| KC[(Keycloak<br/>:8180<br/>realm rescuenet)]
    FE -->|HTTP + JWT| GW[API Gateway<br/>Spring Cloud Gateway :8080]
    GW -.->|clés publiques JWT| KC
    GW -->|lb://| EM[emergency-service<br/>Java :8081]
    GW -->|lb://| PA[patient-record-service<br/>Node.js :8082]
    GW -->|lb://| TR[triage-ai-service<br/>Python :8083]
    GW -->|lb://| HO[hospital-service<br/>C# :8084]
    GW -->|lb://| DI[dispatch-service<br/>Go :8085]

    EM -->|OpenFeign| PA
    EM -->|OpenFeign| TR
    EM -->|OpenFeign| HO
    EM -->|OpenFeign| DI

    EU{{Eureka Server :8761}}
    GW -.-> EU
    EM -.-> EU
    PA -.-> EU
    TR -.-> EU
    HO -.-> EU
    DI -.-> EU

    EM --- PG[(PostgreSQL)]
    PA --- MG[(MongoDB)]
    TR --- MY[(MySQL)]
    HO --- MS[(SQL Server)]
    DI --- RE[(Redis)]

    MQ>RabbitMQ :5672<br/>exchange rescuenet.events]
    DI == mission.status.changed ==> MQ
    MQ == mission.status.changed ==> EM
    EM == mission.completed ==> MQ
    MQ == mission.completed ==> HO
    MQ == mission.completed ==> PA
    MQ == mission.completed ==> DI
```

Légende : trait plein = appel synchrone, trait pointillé = enregistrement / résolution Eureka ou clés publiques, trait épais = événement asynchrone RabbitMQ.

## 2. Une base par service (polyglotte)

| Service | Langage | Base | Pourquoi ce choix |
|---|---|---|---|
| emergency-service | Java 21 / Spring Boot | PostgreSQL | missions et statuts : données relationnelles, transactions |
| patient-record-service | Node.js / Express | MongoDB | dossier médical : document flexible (listes, historique imbriqué) |
| triage-ai-service | Python / FastAPI | MySQL | écosystème scikit-learn ; historique des triages |
| hospital-service | C# / .NET 10 | SQL Server | lits : décrément atomique `ExecuteUpdate` |
| dispatch-service | Go / Gin | Redis | `GEOSEARCH` : ambulance la plus proche, très faible latence |

Aucun service n'accède à la base d'un autre : toute donnée d'un autre domaine passe par son API ou par un événement.

## 3. Saga d'une urgence (communication synchrone puis asynchrone)

```mermaid
sequenceDiagram
    autonumber
    actor Op as Opérateur
    participant FE as Frontend
    participant GW as Gateway
    participant EM as emergency-service
    participant PA as patient-record
    participant TR as triage-ai
    participant HO as hospital
    participant DI as dispatch
    participant MQ as RabbitMQ

    Op->>FE: formulaire « Nouvelle urgence »
    FE->>GW: POST /api/emergencies + JWT
    GW->>GW: vérifie signature + rôle
    GW->>EM: lb://EMERGENCY-SERVICE
    EM->>PA: Feign : dossier par CIN (ou dossier temporaire)
    EM->>TR: Feign : gravité + spécialité
    EM->>HO: Feign : match + réservation d'un lit
    EM->>DI: Feign : ambulance la plus proche
    alt ambulance indisponible
        EM->>HO: Feign : libère le lit (compensation)
        EM-->>FE: 503 « DISPATCH-SERVICE indisponible »
    else succès
        EM-->>FE: 201 mission DISPATCHED
    end
    loop simulation GPS
        DI->>MQ: mission.status.changed (ON_SCENE, TRANSPORTING, ARRIVED)
        MQ->>EM: met à jour le statut
    end
    EM->>MQ: mission.completed
    MQ->>HO: lit ADMITTED
    MQ->>PA: intervention ajoutée au dossier
    MQ->>DI: ambulance AVAILABLE
```

## 4. Déploiement

```mermaid
flowchart TB
    subgraph Docker["Docker Compose (réseau rescuenet_default)"]
        direction TB
        subgraph infra["docker-compose.infra.yml"]
            PG[(postgres)] --- MG[(mongo)] --- MY[(mysql)] --- MS[(sqlserver)] --- RE[(redis)]
            MQ[rabbitmq]
            KC[keycloak]
        end
        subgraph apps["docker-compose.yml"]
            D[discovery-server] --> G[api-gateway]
            D --> E[emergency-service]
            D --> P[patient-record-service]
            D --> T[triage-ai-service]
            D --> H[hospital-service]
            D --> S[dispatch-service]
            F[frontend nginx]
        end
    end
    Host((Navigateur)) -->|4200| F
    Host -->|8080| G
    Host -->|8180| KC
```

Deux modes :
- **Conteneurs** : `docker compose up -d --build` (tout dans Docker).
- **Développement** : `docker-compose.infra.yml` (bases, RabbitMQ, Keycloak) + `scripts\start-all.ps1` (services en processus locaux, rechargement rapide).

## 5. Sécurité

```mermaid
flowchart LR
    B[Navigateur] -->|1. redirection login| KC[Keycloak]
    KC -->|2. code| B
    B -->|3. échange code + PKCE| KC
    KC -->|4. JWT RS256<br/>realm_access.roles| B
    B -->|5. Authorization: Bearer| GW[API Gateway]
    GW -->|6. contrôle des rôles| S[Services]
```

| Route (via Gateway) | OPERATEUR | ADMIN |
|---|---|---|
| `POST/GET /api/emergencies/**` | oui | oui |
| `GET /api/patients/**`, `/api/hospitals/**`, `/api/dispatch/**` | oui | oui |
| `POST/PUT /api/patients/**` | non (403) | oui |
| `/api/triage/**`, `/actuator/**` | non (403) | oui |
| sans jeton | 401 | 401 |

## 6. Choix de conception à retenir

- **Couplage faible** : aucune URL en dur, tout passe par les noms Eureka (`lb://NOM`, `@FeignClient(name=...)`).
- **Saga orchestrée avec compensation** : pas de transaction distribuée ; le lit réservé est libéré si l'ambulance échoue.
- **Asynchrone là où l'on n'attend pas de réponse** : suivi de mission et clôture passent par RabbitMQ.
- **Résilience** : timeouts (2 s connexion, 6 s lecture), une nouvelle tentative, jamais de rejeu après timeout sur un appel non idempotent.
