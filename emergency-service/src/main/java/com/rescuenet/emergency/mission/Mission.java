package com.rescuenet.emergency.mission;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "missions")
public class Mission {

    public enum Status { CREATED, TRIAGED, BED_RESERVED, DISPATCHED, ON_SCENE, TRANSPORTING, COMPLETED, FAILED }

    @Id
    public String id;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    public Status status = Status.CREATED;

    public String callerPhone;
    public String nationalId;
    public String patientId;
    public Integer age;
    public double latitude;
    public double longitude;

    @Column(length = 1000)
    public String symptoms; // séparés par " | "

    // Résultat du triage (triage-ai-service)
    public String severity;
    public Double score;
    public String specialty;
    @Column(length = 500)
    public String triageExplanation;

    // Hôpital (hospital-service)
    public Integer hospitalId;
    public String hospitalName;
    public Double hospitalLatitude;
    public Double hospitalLongitude;
    public String reservationId;

    // Ambulance (dispatch-service)
    public String ambulanceId;
    public Double etaMinutes;

    @Column(length = 500)
    public String failureReason;

    public Instant createdAt = Instant.now();
    public Instant updatedAt = Instant.now();
}
