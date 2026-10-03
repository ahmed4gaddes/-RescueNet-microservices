package com.rescuenet.emergency.remote;

import org.springframework.http.HttpStatus;

/** Échec de la saga : porte le code HTTP à renvoyer, le service responsable et la mission concernée. */
public class SagaFailure extends RuntimeException {

    private final HttpStatus status;
    private final String service;
    private String missionId;

    public SagaFailure(HttpStatus status, String service, String message, Throwable cause) {
        super(message, cause);
        this.status = status;
        this.service = service;
    }

    public static SagaFailure unavailable(String service, Throwable cause) {
        return new SagaFailure(HttpStatus.SERVICE_UNAVAILABLE, service,
                "Service indispensable indisponible : " + service, cause);
    }

    public HttpStatus status() {
        return status;
    }

    public String service() {
        return service;
    }

    public String missionId() {
        return missionId;
    }

    public SagaFailure forMission(String missionId) {
        this.missionId = missionId;
        return this;
    }
}
