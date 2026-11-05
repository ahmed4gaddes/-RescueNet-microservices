package com.rescuenet.emergency.client.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

/** Réponse de TRIAGE-AI-SERVICE : gravité ROUGE/ORANGE/VERT, score, spécialité, explication. */
@JsonIgnoreProperties(ignoreUnknown = true)
public record TriageResponse(String severity, double score, String specialty, String explanation) {
}
