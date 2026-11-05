package com.rescuenet.emergency.client.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

/** Réponse de HOSPITAL-SERVICE : réservation du lit + hôpital retenu. */
@JsonIgnoreProperties(ignoreUnknown = true)
public record HospitalMatchResponse(String reservationId, Hospital hospital, Double distanceKm, Boolean specialtyMatched) {

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Hospital(int id, String name, String city, double latitude, double longitude) {
    }
}
