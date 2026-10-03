package com.rescuenet.emergency.web;

import java.util.List;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

public record EmergencyRequest(
        String callerPhone,
        String nationalId,
        @NotNull @Valid Location location,
        @NotEmpty List<String> symptoms,
        @Valid Vitals vitals,
        @NotNull @Min(0) @Max(120) Integer age) {

    public record Location(@NotNull Double lat, @NotNull Double lng) {
    }

    /** Constantes vitales ; les valeurs absentes reçoivent une valeur « normale » avant le triage. */
    public record Vitals(Integer heartRate, Integer spo2, Integer systolicBP, String consciousness, Integer painLevel) {
    }
}
