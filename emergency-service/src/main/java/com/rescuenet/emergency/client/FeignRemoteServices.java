package com.rescuenet.emergency.client;

import java.util.Optional;
import java.util.function.Supplier;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import com.rescuenet.emergency.client.dto.DispatchRequest;
import com.rescuenet.emergency.client.dto.DispatchResponse;
import com.rescuenet.emergency.client.dto.HospitalMatchRequest;
import com.rescuenet.emergency.client.dto.HospitalMatchResponse;
import com.rescuenet.emergency.client.dto.PatientCreateRequest;
import com.rescuenet.emergency.client.dto.PatientDto;
import com.rescuenet.emergency.client.dto.TriageRequest;
import com.rescuenet.emergency.client.dto.TriageResponse;
import com.rescuenet.emergency.remote.SagaFailure;

import feign.FeignException;

/**
 * Façade des 4 clients Feign : mêmes règles de résilience que l'ancien RemoteServices.
 * Un timeout / une panne -> 1 nouvelle tentative (seulement si l'appel est idempotent, ou si le service
 * n'a AUCUNE instance = 503), puis SagaFailure(503). Les 4xx sont des réponses métier (ex. 409 plus de lit).
 */
@Component
public class FeignRemoteServices {

    private static final Logger log = LoggerFactory.getLogger(FeignRemoteServices.class);

    public static final String PATIENT = "PATIENT-RECORD-SERVICE";
    public static final String TRIAGE = "TRIAGE-AI-SERVICE";
    public static final String HOSPITAL = "HOSPITAL-SERVICE";
    public static final String DISPATCH = "DISPATCH-SERVICE";

    private final PatientClient patients;
    private final TriageClient triage;
    private final HospitalClient hospitals;
    private final DispatchClient dispatch;

    public FeignRemoteServices(PatientClient patients, TriageClient triage, HospitalClient hospitals, DispatchClient dispatch) {
        this.patients = patients;
        this.triage = triage;
        this.hospitals = hospitals;
        this.dispatch = dispatch;
    }

    public Optional<PatientDto> findPatientByNationalId(String nationalId) {
        return call(PATIENT, true, () -> {
            try {
                return Optional.ofNullable(patients.findByNationalId(nationalId));
            } catch (FeignException.NotFound e) {
                return Optional.empty();
            }
        });
    }

    public PatientDto createPatient(PatientCreateRequest body) {
        return call(PATIENT, false, () -> patients.create(body));
    }

    public TriageResponse triage(TriageRequest body) {
        return call(TRIAGE, true, () -> triage.triage(body));
    }

    public HospitalMatchResponse matchHospital(HospitalMatchRequest body) {
        return call(HOSPITAL, false, () -> hospitals.match(body));
    }

    public void releaseReservation(String reservationId) {
        call(HOSPITAL, true, () -> {
            hospitals.release(reservationId);
            return null;
        });
    }

    public DispatchResponse assignAmbulance(DispatchRequest body) {
        return call(DISPATCH, false, () -> dispatch.assign(body));
    }

    private <T> T call(String service, boolean idempotent, Supplier<T> action) {
        for (int attempt = 1;; attempt++) {
            try {
                return action.get();
            } catch (FeignException.FeignClientException e) {
                throw e; // 4xx = réponse métier, pas une panne
            } catch (FeignException e) {
                // timeout / connexion refusée (status -1), 5xx, ou « aucune instance » (503 du LoadBalancer)
                boolean retryable = idempotent || e.status() == 503;
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
