package com.rescuenet.emergency.web;

import java.time.Instant;
import java.util.Arrays;
import java.util.List;

import com.rescuenet.emergency.mission.Mission;

public record MissionView(
        String missionId,
        String status,
        String patientId,
        List<String> symptoms,
        Triage triage,
        Hospital hospital,
        Ambulance ambulance,
        String failureReason,
        Instant createdAt,
        Instant updatedAt) {

    public record Triage(String severity, Double score, String specialty, String explanation) {
    }

    public record Hospital(Integer id, String name, String reservationId) {
    }

    public record Ambulance(String id, Double etaMinutes) {
    }

    public static MissionView from(Mission m) {
        List<String> symptoms = m.symptoms == null ? List.of() : Arrays.asList(m.symptoms.split(" \\| "));
        return new MissionView(
                m.id, m.status.name(), m.patientId, symptoms,
                m.severity == null ? null : new Triage(m.severity, m.score, m.specialty, m.triageExplanation),
                m.hospitalId == null ? null : new Hospital(m.hospitalId, m.hospitalName, m.reservationId),
                m.ambulanceId == null ? null : new Ambulance(m.ambulanceId, m.etaMinutes),
                m.failureReason, m.createdAt, m.updatedAt);
    }
}
