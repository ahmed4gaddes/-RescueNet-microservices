package com.rescuenet.emergency.client.dto;

import java.util.List;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

/** Dossier patient renvoyé par PATIENT-RECORD-SERVICE (MongoDB : l'identifiant s'appelle « _id »). */
@JsonIgnoreProperties(ignoreUnknown = true)
public record PatientDto(
        @JsonProperty("_id") String id,
        String nationalId,
        String fullName,
        Integer age,
        List<String> chronicConditions,
        Boolean temporary) {
}
