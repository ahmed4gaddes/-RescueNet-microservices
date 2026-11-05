# Veille : observabilité hors Spring Boot Actuator

> Activité de l'atelier 2 : pour Node.js et Python, identifier la bibliothèque, les endpoints, les informations exposées et les différences avec Spring Boot Actuator.

## 1. Référence : Spring Boot Actuator (Java)

Dans ce projet, `spring-boot-starter-actuator` est présent dans `discovery-server`, `api-gateway` et `emergency-service`.

| Endpoint | Information |
|---|---|
| `/actuator/health` | état (UP/DOWN), sous-composants (base, broker…) |
| `/actuator/info` | informations applicatives |
| `/actuator/metrics` | métriques JVM, HTTP, pool de connexions |
| `/actuator/gateway` | routes de la Gateway (exposé dans `api-gateway`) |

Eureka s'en sert pour vérifier l'état des instances. Dans `application.properties`, seuls `health` et `info` sont exposés pour limiter la surface d'attaque.

## 2. Node.js / Express (`patient-record-service`)

| Besoin | Bibliothèque | Endpoints / informations |
|---|---|---|
| Endpoints de type Actuator | `express-actuator` (1.8.4) | `/info`, `/metrics`, `/health`, `/env`, `/threaddump` |
| Health checks avancés + arrêt propre | `@godaddy/terminus` (4.12.1) | `/health` avec sondes personnalisées (ex. MongoDB), `onSignal` |
| Métriques Prometheus | `prom-client` (15.1.3) | `/metrics` : CPU, mémoire, boucle d'événements, compteurs métier |
| Enregistrement Eureka | `eureka-js-client` (4.5.0) | utilisé dans ce projet |

**Dans ce projet** : un simple `GET /health` renvoie `{status: UP}` (suffisant pour Eureka).

## 3. Python / FastAPI (`triage-ai-service`)

| Besoin | Bibliothèque | Endpoints / informations |
|---|---|---|
| Health check | endpoint natif FastAPI, ou `fastapi-health` (0.4.0) | `/health` avec sondes (base de données, modèle chargé) |
| Métriques HTTP | `prometheus-fastapi-instrumentator` (8.1.0) | `/metrics` : durées, codes de réponse, requêtes en cours |
| Métriques bas niveau | `prometheus-client` (0.26.0) | compteurs et histogrammes personnalisés |
| Enregistrement Eureka | `py-eureka-client` (0.13.3) | utilisé dans ce projet |
| Documentation automatique | FastAPI natif | `/docs` (Swagger UI), `/openapi.json` |

**Dans ce projet** : `GET /health` + documentation Swagger native.

## 4. Autres services du projet

| Service | Mécanisme |
|---|---|
| `hospital-service` (C#) | `/health` écrit à la main ; ASP.NET propose aussi `AddHealthChecks()` |
| `dispatch-service` (Go) | `/health` écrit à la main (Gin) |

## 5. Différences avec Spring Boot Actuator

| Point | Actuator | Node.js / Python |
|---|---|---|
| Intégration | **starter unique**, configuration par propriétés | bibliothèques à assembler, code à écrire |
| Sondes de santé | agrégées automatiquement (base, broker, disque) | à écrire à la main (une sonde par dépendance) |
| Format de métriques | Micrometer (Prometheus en option) | Prometheus en général (`prom-client`, `prometheus-client`) |
| Sécurisation des endpoints | `management.endpoints.web.exposure.include`, Spring Security | à protéger soi-même (middleware) |
| Standardisation | la même chose dans tous les services Spring | dépend de la bibliothèque choisie |

**Conclusion** : Actuator offre une observabilité « clé en main » côté Java ; hors JVM, on obtient l'équivalent en combinant une bibliothèque de santé et une bibliothèque Prometheus. Pour une vraie exploitation, l'étape suivante serait un `/metrics` Prometheus sur tous les services, un tableau de bord Grafana et du traçage distribué.
