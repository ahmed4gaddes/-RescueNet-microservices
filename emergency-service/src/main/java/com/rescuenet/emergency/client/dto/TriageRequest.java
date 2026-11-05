package com.rescuenet.emergency.client.dto;

import java.util.List;

public record TriageRequest(Integer age, List<String> symptoms, Vitals vitals, List<String> medicalHistory) {

    public record Vitals(int heartRate, int spo2, int systolicBP, String consciousness, int painLevel) {
    }
}
