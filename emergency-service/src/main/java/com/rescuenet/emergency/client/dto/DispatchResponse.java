package com.rescuenet.emergency.client.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

/** Réponse de DISPATCH-SERVICE : ambulance choisie et temps estimé. */
@JsonIgnoreProperties(ignoreUnknown = true)
public record DispatchResponse(String missionId, String ambulanceId, String plate, Double totalEtaMinutes) {
}
