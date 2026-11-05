package com.rescuenet.emergency.mission;

import java.time.Instant;
import java.util.List;
import java.util.NoSuchElementException;
import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import com.rescuenet.emergency.events.MissionPublisher;
import com.rescuenet.emergency.client.FeignRemoteServices;
import com.rescuenet.emergency.client.dto.DispatchRequest;
import com.rescuenet.emergency.client.dto.DispatchResponse;
import com.rescuenet.emergency.client.dto.HospitalMatchRequest;
import com.rescuenet.emergency.client.dto.HospitalMatchResponse;
import com.rescuenet.emergency.client.dto.PatientCreateRequest;
import com.rescuenet.emergency.client.dto.PatientDto;
import com.rescuenet.emergency.client.dto.TriageRequest;
import com.rescuenet.emergency.client.dto.TriageResponse;
import com.rescuenet.emergency.remote.SagaFailure;
import com.rescuenet.emergency.web.EmergencyRequest;
import com.rescuenet.emergency.web.MissionView;

import feign.FeignException;

/**
 * Saga orchestrée : patient -> triage IA -> lit d'hôpital -> ambulance.
 * Si l'ambulance est indisponible, le lit déjà réservé est libéré (compensation).
 * Pas de @Transactional global : on n'immobilise jamais une connexion BD pendant un appel réseau ;
 * l'état de la mission est sauvegardé après chaque étape.
 */
@Service
public class MissionService {

    private static final Logger log = LoggerFactory.getLogger(MissionService.class);

    private final MissionRepository repo;
    private final FeignRemoteServices remote;
    private final MissionPublisher publisher;

    public MissionService(MissionRepository repo, FeignRemoteServices remote, MissionPublisher publisher) {
        this.repo = repo;
        this.remote = remote;
        this.publisher = publisher;
    }

    public MissionView create(EmergencyRequest req) {
        Mission m = new Mission();
        m.id = UUID.randomUUID().toString();
        m.callerPhone = req.callerPhone();
        m.nationalId = req.nationalId();
        m.age = req.age();
        m.latitude = req.location().lat();
        m.longitude = req.location().lng();
        m.symptoms = String.join(" | ", req.symptoms());
        save(m);

        try {
            // 1. Dossier patient (inconnu -> dossier temporaire)
            PatientDto patient = resolvePatient(req);
            m.patientId = patient.id();
            List<String> history = patient.chronicConditions() == null ? List.of() : patient.chronicConditions();

            // 2. Triage par l'IA
            TriageResponse triage = remote.triage(triageBody(req, history));
            m.severity = triage.severity();
            m.score = triage.score();
            m.specialty = triage.specialty();
            m.triageExplanation = triage.explanation();
            m.status = Mission.Status.TRIAGED;
            save(m);

            // 3. Lit dans l'hôpital le plus proche ayant la spécialité
            HospitalMatchResponse match = remote.matchHospital(new HospitalMatchRequest(
                    m.latitude, m.longitude, m.specialty, m.severity, m.id));
            m.reservationId = match.reservationId();
            m.hospitalId = match.hospital().id();
            m.hospitalName = match.hospital().name();
            m.hospitalLatitude = match.hospital().latitude();
            m.hospitalLongitude = match.hospital().longitude();
            m.status = Mission.Status.BED_RESERVED;
            save(m);

            // 4. Ambulance la plus proche ; en cas d'échec -> compensation (libération du lit)
            try {
                DispatchResponse dispatch = remote.assignAmbulance(new DispatchRequest(
                        m.id, m.severity,
                        new DispatchRequest.GeoPoint(m.latitude, m.longitude),
                        new DispatchRequest.GeoPoint(m.hospitalLatitude, m.hospitalLongitude)));
                m.ambulanceId = dispatch.ambulanceId();
                m.etaMinutes = dispatch.totalEtaMinutes();
            } catch (RuntimeException e) {
                compensateBed(m);
                throw e;
            }
            m.status = Mission.Status.DISPATCHED;
            save(m);

            try {
                publisher.missionDispatched(m); // informatif : ne doit pas faire échouer la mission
            } catch (RuntimeException e) {
                log.warn("Événement mission.dispatched non publié : {}", e.getMessage());
            }
            return MissionView.from(m);

        } catch (RuntimeException e) {
            SagaFailure failure = translate(e);
            m.status = Mission.Status.FAILED;
            m.failureReason = failure.getMessage();
            save(m);
            throw failure.forMission(m.id);
        }
    }

    /** Appelé par DispatchStatusListener ; ignore les doublons et les événements dans le désordre. */
    public void onDispatchStatus(String missionId, String dispatchStatus) {
        Mission m = repo.findById(missionId).orElse(null);
        if (m == null || m.status == Mission.Status.COMPLETED || m.status == Mission.Status.FAILED) {
            return;
        }
        Mission.Status next = switch (dispatchStatus) {
            case "ON_SCENE" -> Mission.Status.ON_SCENE;
            case "TRANSPORTING" -> Mission.Status.TRANSPORTING;
            case "ARRIVED" -> Mission.Status.COMPLETED;
            default -> null;
        };
        if (next == null || next.ordinal() <= m.status.ordinal()) {
            return;
        }
        if (next == Mission.Status.COMPLETED) {
            // Publier avant de sauvegarder : si RabbitMQ échoue, l'exception relance le traitement du message
            publisher.missionCompleted(m);
        }
        m.status = next;
        save(m);
    }

    public MissionView get(String id) {
        return MissionView.from(repo.findById(id).orElseThrow(() -> new NoSuchElementException("Mission introuvable : " + id)));
    }

    public List<MissionView> latest() {
        return repo.findTop50ByOrderByCreatedAtDesc().stream().map(MissionView::from).toList();
    }

    // --- étapes -------------------------------------------------------------------------------

    private PatientDto resolvePatient(EmergencyRequest req) {
        boolean hasId = req.nationalId() != null && !req.nationalId().isBlank();
        if (hasId) {
            var known = remote.findPatientByNationalId(req.nationalId());
            if (known.isPresent()) {
                return known.get();
            }
        }
        return remote.createPatient(new PatientCreateRequest(true, req.age(), hasId ? req.nationalId() : null));
    }

    private TriageRequest triageBody(EmergencyRequest req, List<String> history) {
        var v = req.vitals();
        var vitals = new TriageRequest.Vitals(
                v != null && v.heartRate() != null ? v.heartRate() : 80,
                v != null && v.spo2() != null ? v.spo2() : 98,
                v != null && v.systolicBP() != null ? v.systolicBP() : 120,
                v != null && v.consciousness() != null ? v.consciousness() : "ALERT",
                v != null && v.painLevel() != null ? v.painLevel() : 0);
        return new TriageRequest(req.age(), req.symptoms(), vitals, history);
    }

    private void compensateBed(Mission m) {
        try {
            remote.releaseReservation(m.reservationId);
            log.info("Compensation : lit {} libéré pour la mission {}", m.reservationId, m.id);
        } catch (RuntimeException ce) {
            log.error("Compensation impossible pour la réservation {} : {}", m.reservationId, ce.getMessage());
        }
    }

    private SagaFailure translate(RuntimeException e) {
        if (e instanceof SagaFailure sf) {
            return sf;
        }
        if (e instanceof FeignException.FeignClientException h) {
            HttpStatus status = h.status() == 409 ? HttpStatus.CONFLICT : HttpStatus.BAD_GATEWAY;
            return new SagaFailure(status, "", "Demande refusée : " + h.contentUTF8(), e);
        }
        log.error("Erreur inattendue dans la saga", e);
        return new SagaFailure(HttpStatus.INTERNAL_SERVER_ERROR, "", "Erreur interne : " + e.getMessage(), e);
    }

    private void save(Mission m) {
        m.updatedAt = Instant.now();
        repo.save(m);
    }
}
