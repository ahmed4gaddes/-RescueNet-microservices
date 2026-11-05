package com.rescuenet.emergency.client.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

/** Création d'un dossier temporaire quand le patient est inconnu. */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record PatientCreateRequest(boolean temporary, Integer age, String nationalId) {
}
