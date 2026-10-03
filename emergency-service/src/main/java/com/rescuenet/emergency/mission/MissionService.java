package com.rescuenet.emergency.mission;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.client.HttpClientErrorException;

import com.rescuenet.emergency.events.MissionPublisher;
import com.rescuenet.emergency.remote.RemoteServices;
import com.rescuenet.emergency.remote.SagaFailure;
import com.rescuenet.emergency.web.EmergencyRequest;
import com.rescuenet.emergency.web.MissionView;

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
    private final RemoteServices remote;
    private final MissionPublisher publisher;

    public MissionService(MissionRepository repo, RemoteServices remote, MissionPublisher publisher) {
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
            Map<String, Object> patient = resolvePatient(req);
            m.patientId = String.valueOf(patient.get("_id"));
            List<String> history = strings(patient.get("chronicConditions"));

            // 2. Triage par l'IA
            Map<String, Object> triage = remote.triage(triageBody(req, history));
            m.severity = String.valueOf(triage.get("severity"));
            m.score = ((Number) triage.get("score")).doubleValue();
            m.specialty = String.valueOf(triage.get("specialty"));
            m.triageExplanation = String.valueOf(triage.get("explanation"));
            m.status = Mission.Status.TRIAGED;
            save(m);

            // 3. Lit dans l'hôpital le plus proche ayant la spécialité
            Map<String, Object> match = remote.matchHospital(Map.of(
                    "latitude", m.latitude, "longitude", m.longitude,
                    "specialty", m.specialty, "severity", m.severity, "missionId", m.id));
            @SuppressWarnings("unchecked")
            Map<String, Object> hospital = (Map<String, Object>) match.get("hospital");
            m.reservationId = String.valueOf(match.get("reservationId"));
            m.hospitalId = ((Number) hospital.get("id")).intValue();
            m.hospitalName = String.valueOf(hospital.get("name"));
            m.hospitalLatitude = ((Number) hospital.get("latitude")).doubleValue();
            m.hospitalLongitude = ((Number) hospital.get("longitude")).doubleValue();
            m.status = Mission.Status.BED_RESERVED;
            save(m);

            // 4. Ambulance la plus proche ; en cas d'échec -> compensation (libération du lit)
            try {
                Map<String, Object> dispatch = remote.assignAmbulance(Map.of(
                        "missionId", m.id, "severity", m.severity,
                        "pickup", Map.of("lat", m.latitude, "lng", m.longitude),
                        "hospital", Map.of("lat", m.hospitalLatitude, "lng", m.hospitalLongitude)));
                m.ambulanceId = String.valueOf(dispatch.get("ambulanceId"));
                m.etaMinutes = ((Number) dispatch.get("totalEtaMinutes")).doubleValue();
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

    private Map<String, Object> resolvePatient(EmergencyRequest req) {
        if (req.nationalId() != null && !req.nationalId().isBlank()) {
            var known = remote.findPatientByNationalId(req.nationalId());
            if (known.isPresent()) {
                return known.get();
            }
        }
        Map<String, Object> temp = new LinkedHashMap<>();
        temp.put("temporary", true);
        temp.put("age", req.age());
        if (req.nationalId() != null && !req.nationalId().isBlank()) {
            temp.put("nationalId", req.nationalId());
        }
        return remote.createPatient(temp);
    }

    private Map<String, Object> triageBody(EmergencyRequest req, List<String> history) {
        var v = req.vitals();
        Map<String, Object> vitals = new LinkedHashMap<>();
        vitals.put("heartRate", v != null && v.heartRate() != null ? v.heartRate() : 80);
        vitals.put("spo2", v != null && v.spo2() != null ? v.spo2() : 98);
        vitals.put("systolicBP", v != null && v.systolicBP() != null ? v.systolicBP() : 120);
        vitals.put("consciousness", v != null && v.consciousness() != null ? v.consciousness() : "ALERT");
        vitals.put("painLevel", v != null && v.painLevel() != null ? v.painLevel() : 0);
        return Map.of("age", req.age(), "symptoms", req.symptoms(), "vitals", vitals, "medicalHistory", history);
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
        if (e instanceof HttpClientErrorException h) {
            HttpStatus status = h.getStatusCode().value() == 409 ? HttpStatus.CONFLICT : HttpStatus.BAD_GATEWAY;
            return new SagaFailure(status, "", "Demande refusée : " + h.getResponseBodyAsString(), e);
        }
        log.error("Erreur inattendue dans la saga", e);
        return new SagaFailure(HttpStatus.INTERNAL_SERVER_ERROR, "", "Erreur interne : " + e.getMessage(), e);
    }

    private void save(Mission m) {
        m.updatedAt = Instant.now();
        repo.save(m);
    }

    private static List<String> strings(Object value) {
        List<String> out = new ArrayList<>();
        if (value instanceof List<?> list) {
            list.forEach(o -> out.add(String.valueOf(o)));
        }
        return out;
    }
}
