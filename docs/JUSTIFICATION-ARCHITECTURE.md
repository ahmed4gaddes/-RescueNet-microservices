# Justification des choix d'architecture

> Support pour la soutenance (AA2 comparer et justifier, AA3 analyser les besoins, AA5 évaluer, AA6 choisir les outils).

## 1. Le besoin métier

RescueNet coordonne une urgence médicale : dossier du patient, triage, lit d'hôpital, ambulance. Ce qui compte :

| Besoin | Conséquence technique |
|---|---|
| Une panne ne doit pas tout arrêter, et doit être **explicite** | isolation des domaines, réponse 503 claire, compensation |
| Pics de charge sur certains domaines (localisation des ambulances) | passage à l'échelle **par service** |
| Données de natures très différentes (relationnelles, documents, géo-spatiales) | **une base adaptée par service** |
| Équipes et compétences variées (IA en Python, flotte en Go…) | technologies **hétérogènes** par service |
| Évolutions fréquentes du modèle d'IA, indépendantes du reste | **déploiement indépendant** |

## 2. Comparaison des architectures

| Critère | Monolithe | SOA (ESB, services partagés) | Microservices (retenu) |
|---|---|---|---|
| Déploiement | un seul bloc : toute modification redéploie tout | services déployés ensemble via un bus central | un service = un déploiement indépendant |
| Base de données | une base partagée | souvent partagée | **une base par service** |
| Technologies | une seule pile | plusieurs possibles, bus imposant | libres par service (ici 5 langages) |
| Passage à l'échelle | on duplique tout | par service, via le bus | par service, finement |
| Tolérance aux pannes | une panne peut tout arrêter | le bus est un point unique | panne contenue, dégradation maîtrisée |
| Complexité d'exploitation | faible | moyenne | **élevée** (découverte, sécurité, supervision) |
| Cohérence des données | transactions ACID simples | transactions distribuées | **cohérence à terme** (saga) |
| Adapté à… | petite équipe, domaine simple | intégration d'un SI existant | domaines distincts, pannes à isoler, évolutions indépendantes |

**Décision** : microservices. L'application a quatre domaines distincts, des profils de données différents, et la panne d'un module doit être isolée et visible (démonstration : arrêt de `dispatch-service` donne un 503 et libère le lit). Un monolithe aurait été plus simple, mais n'aurait pas permis d'isoler la panne ni d'utiliser la base la mieux adaptée à chaque domaine.

## 3. Avantages observés dans ce projet

- **Isolation des pannes** : sans `dispatch-service`, les autres modules restent consultables.
- **Bonne base au bon endroit** : Redis pour la géolocalisation, SQL Server pour des décréments atomiques de lits, MongoDB pour un dossier flexible.
- **Évolution indépendante** : le modèle de triage se réentraîne et se redéploie sans toucher aux autres services.
- **Équipes autonomes** : chaque service a son code, son `Dockerfile`, sa base.

## 4. Limites et défis (à assumer en soutenance)

| Défi | Ce que le projet fait | Ce qui reste limité |
|---|---|---|
| Cohérence des données | saga orchestrée + compensation du lit | pas d'outbox transactionnelle : si RabbitMQ tombe pendant `mission.completed`, le message est retenté 3 fois puis abandonné |
| Latence et pannes réseau | timeouts, une nouvelle tentative sélective | pas de circuit breaker (Resilience4j) |
| Découverte de services | Eureka + load balancing côté client | un seul serveur Eureka (point de défaillance en production) |
| Sécurité | JWT Keycloak vérifié à la Gateway, rôles OPERATEUR / ADMIN | les services internes ne revérifient pas le JWT ; ils ne doivent pas être exposés (voir `docker-compose.yml`) |
| Observabilité | Actuator côté Java, `/health` côté autres services, logs Feign | pas de métriques Prometheus ni de traçage distribué |
| Coût d'exploitation | `docker compose` et scripts | 5 bases + RabbitMQ + Keycloak : ~5 Go de RAM |
| Données | jeu de données synthétique | démonstration uniquement |

## 5. Choix des outils (AA6)

| Besoin | Outil retenu | Pourquoi | Alternative écartée |
|---|---|---|---|
| Découverte de services | **Netflix Eureka** | imposé par le module, intégré à Spring Cloud ; clients REST simples pour Go et C# | Consul (plus riche, plus lourd) |
| Point d'entrée | **Spring Cloud Gateway** | routage `lb://`, intégration Eureka et Spring Security | Nginx / Kong (pas de résolution Eureka native) |
| Appels synchrones | **OpenFeign** | interface déclarative, DTO typés, résolution par nom | `RestClient` manuel (code plus long, utilisé avant la migration) |
| Asynchrone | **RabbitMQ** | exchange topic, routage par clé, facile à superviser | Kafka (surdimensionné pour ce volume) |
| Identité | **Keycloak** (OIDC, JWT) | standard, rôles, PKCE pour la SPA | solution maison JWT (risquée) |
| Conteneurs | **Docker Compose** | une commande pour toute la plateforme | Kubernetes (hors périmètre du module) |
| Documentation d'API | **OpenAPI / Swagger UI** | contrat standard, test dans le navigateur | Postman seul (pas de contrat) |
| Frontend | **Angular** (signals, standalone) | typé, routage et gardes de rôle intégrés | React / Vue |

## 6. Quand ne PAS choisir les microservices

Équipe réduite, domaine simple, pas de contrainte d'isolation ni de montée en charge différenciée : un **monolithe modulaire** est alors préférable (déploiement unique, transactions ACID, débogage simple). Le choix des microservices doit être justifié par le besoin, pas par la mode.
