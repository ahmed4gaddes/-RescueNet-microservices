package com.rescuenet.emergency.remote;

import java.util.Map;
import java.util.Optional;
import java.util.function.Supplier;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.cloud.client.loadbalancer.LoadBalanced;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.stereotype.Component;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.HttpServerErrorException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

/**
 * Appels synchrones vers les 4 autres modules, par NOM Eureka (jamais d'URL en dur).
 * Chaque appel : timeout, 1 nouvelle tentative, puis SagaFailure(503) si le service est indisponible.
 * Les appels non idempotents (réservation de lit, assignation) ne sont rejoués que sur un 503
 * explicite (aucune instance / service arrêté), jamais après un timeout de lecture.
 */
@Component
public class RemoteServices {

    private static final Logger log = LoggerFactory.getLogger(RemoteServices.class);
    private static final ParameterizedTypeReference<Map<String, Object>> MAP = new ParameterizedTypeReference<>() {
    };

    public static final String PATIENT = "PATIENT-RECORD-SERVICE";
    public static final String TRIAGE = "TRIAGE-AI-SERVICE";
    public static final String HOSPITAL = "HOSPITAL-SERVICE";
    public static final String DISPATCH = "DISPATCH-SERVICE";

    private final RestClient http;

    public RemoteServices(@LoadBalanced RestClient.Builder lbBuilder) {
        this.http = lbBuilder.build();
    }

    public Optional<Map<String, Object>> findPatientByNationalId(String nationalId) {
        return call(PATIENT, true, () -> {
            try {
                return Optional.ofNullable(http.get()
                        .uri("http://" + PATIENT + "/api/patients/national/{id}", nationalId)
                        .retrieve().body(MAP));
            } catch (HttpClientErrorException.NotFound e) {
                return Optional.empty();
            }
        });
    }

    public Map<String, Object> createPatient(Map<String, Object> body) {
        return call(PATIENT, false, () -> http.post()
                .uri("http://" + PATIENT + "/api/patients").body(body).retrieve().body(MAP));
    }

    public Map<String, Object> triage(Map<String, Object> body) {
        return call(TRIAGE, true, () -> http.post()
                .uri("http://" + TRIAGE + "/api/triage").body(body).retrieve().body(MAP));
    }

    public Map<String, Object> matchHospital(Map<String, Object> body) {
        return call(HOSPITAL, false, () -> http.post()
                .uri("http://" + HOSPITAL + "/api/hospitals/match").body(body).retrieve().body(MAP));
    }

    public void releaseReservation(String reservationId) {
        call(HOSPITAL, true, () -> http.delete()
                .uri("http://" + HOSPITAL + "/api/hospitals/reservations/{id}", reservationId)
                .retrieve().toBodilessEntity());
    }

    public Map<String, Object> assignAmbulance(Map<String, Object> body) {
        return call(DISPATCH, false, () -> http.post()
                .uri("http://" + DISPATCH + "/api/dispatch/assign").body(body).retrieve().body(MAP));
    }

    private <T> T call(String service, boolean idempotent, Supplier<T> action) {
        for (int attempt = 1;; attempt++) {
            try {
                return action.get();
            } catch (HttpClientErrorException e) {
                throw e; // 4xx = réponse métier (ex. 409 plus de lit), pas une panne
            } catch (RestClientException e) {
                boolean retryable = idempotent || e instanceof HttpServerErrorException.ServiceUnavailable;
                if (!retryable || attempt >= 2) {
                    log.warn("{} indisponible : {}", service, e.getMessage());
                    throw SagaFailure.unavailable(service, e);
                }
                log.info("{} : nouvelle tentative ({})", service, e.getClass().getSimpleName());
                try {
                    Thread.sleep(500);
                } catch (InterruptedException ie) {
                    Thread.currentThread().interrupt();
                    throw SagaFailure.unavailable(service, ie);
                }
            }
        }
    }
}
