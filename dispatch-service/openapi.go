package main

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// registerDocs expose la documentation OpenAPI : /v3/api-docs (JSON) et /swagger-ui (interface).
func registerDocs(r *gin.Engine) {
	r.GET("/v3/api-docs", func(c *gin.Context) {
		c.Data(http.StatusOK, "application/json; charset=utf-8", []byte(openAPISpec))
	})
	r.GET("/swagger-ui", func(c *gin.Context) {
		c.Data(http.StatusOK, "text/html; charset=utf-8", []byte(swaggerPage))
	})
}

const swaggerPage = `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><title>Dispatch Service - Swagger</title>
<link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5.17.14/swagger-ui.css"></head>
<body><div id="ui"></div>
<script src="https://unpkg.com/swagger-ui-dist@5.17.14/swagger-ui-bundle.js"></script>
<script>SwaggerUIBundle({ url: '/v3/api-docs', dom_id: '#ui' });</script></body></html>`

const openAPISpec = `{
  "openapi": "3.0.3",
  "info": {"title": "Dispatch Service", "version": "1.0.0",
           "description": "Ambulances : recherche de la plus proche (Redis GEOSEARCH) et simulation GPS (Go / Gin)."},
  "tags": [{"name": "Dispatch"}],
  "components": {"schemas": {
    "Point": {"type": "object", "properties": {"lat": {"type": "number", "example": 36.806}, "lng": {"type": "number", "example": 10.18}}},
    "Ambulance": {"type": "object", "properties": {"id": {"type": "string", "example": "AMB-01"}, "plate": {"type": "string", "example": "TUN-1001"},
                  "status": {"type": "string", "example": "AVAILABLE"}, "position": {"$ref": "#/components/schemas/Point"}}},
    "AssignRequest": {"type": "object", "required": ["missionId", "pickup", "hospital"], "properties": {
      "missionId": {"type": "string"}, "severity": {"type": "string", "example": "ROUGE"},
      "pickup": {"$ref": "#/components/schemas/Point"}, "hospital": {"$ref": "#/components/schemas/Point"}}},
    "AssignResponse": {"type": "object", "properties": {
      "missionId": {"type": "string"}, "ambulanceId": {"type": "string"}, "plate": {"type": "string"},
      "distanceToSceneKm": {"type": "number"}, "etaToSceneMinutes": {"type": "number"},
      "tripToHospitalKm": {"type": "number"}, "totalEtaMinutes": {"type": "number"},
      "ambulancePosition": {"$ref": "#/components/schemas/Point"}}},
    "DispatchMission": {"type": "object", "properties": {
      "missionId": {"type": "string"}, "ambulanceId": {"type": "string"}, "phase": {"type": "string", "enum": ["TO_SCENE", "TO_HOSPITAL", "DONE"]},
      "etaMinutes": {"type": "number"}, "remainingKm": {"type": "number"}, "position": {"$ref": "#/components/schemas/Point"}}}
  }},
  "paths": {
    "/api/dispatch/ambulances": {"get": {"tags": ["Dispatch"], "summary": "Flotte et positions",
      "responses": {"200": {"description": "OK", "content": {"application/json": {"schema": {"type": "array", "items": {"$ref": "#/components/schemas/Ambulance"}}}}}}}},
    "/api/dispatch/assign": {"post": {"tags": ["Dispatch"], "summary": "Affecter l'ambulance libre la plus proche (idempotent par missionId)",
      "requestBody": {"required": true, "content": {"application/json": {"schema": {"$ref": "#/components/schemas/AssignRequest"}}}},
      "responses": {"200": {"description": "Ambulance affectée", "content": {"application/json": {"schema": {"$ref": "#/components/schemas/AssignResponse"}}}},
                    "400": {"description": "Requête invalide"}, "409": {"description": "Aucune ambulance disponible"}}}},
    "/api/dispatch/missions/{id}": {"get": {"tags": ["Dispatch"], "summary": "Position en direct de l'ambulance d'une mission",
      "parameters": [{"name": "id", "in": "path", "required": true, "schema": {"type": "string"}}],
      "responses": {"200": {"description": "OK", "content": {"application/json": {"schema": {"$ref": "#/components/schemas/DispatchMission"}}}}, "404": {"description": "Mission inconnue"}}}},
    "/health": {"get": {"summary": "Etat de sante (Eureka)", "responses": {"200": {"description": "UP"}}}}
  }
}`
