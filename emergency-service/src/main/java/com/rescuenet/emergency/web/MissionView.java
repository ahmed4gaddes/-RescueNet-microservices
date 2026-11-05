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
        Location location,
        String failureReason,
        Instant createdAt,
        Instant updatedAt) {

    public record Triage(String severity, Double score, String specialty, String explanation) {
    }

    public record Location(Double lat, Double lng) {
    }

    public record Hospital(Integer id, String name, String reservationId, Double latitude, Double longitude) {
    }

    public record Ambulance(String id, Double etaMinutes) {
    }

    public static MissionView from(Mission m) {
        List<String> symptoms = m.symptoms == null ? List.of() : Arrays.asList(m.symptoms.split(" \\| "));
        return new MissionView(
                m.id, m.status.name(), m.patientId, symptoms,
                m.severity == null ? null : new Triage(m.severity, m.score, m.specialty, m.triageExplanation),
                m.hospitalId == null ? null : new Hospital(m.hospitalId, m.hospitalName, m.reservationId, m.hospitalLatitude, m.hospitalLongitude),
                m.ambulanceId == null ? null : new Ambulance(m.ambulanceId, m.etaMinutes),
                new Location(m.latitude, m.longitude),
                m.failureReason, m.createdAt, m.updatedAt);
    }
}
