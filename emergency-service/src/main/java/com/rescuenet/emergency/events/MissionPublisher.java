package com.rescuenet.emergency.events;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.amqp.core.Message;
import org.springframework.amqp.core.MessageBuilder;
import org.springframework.amqp.core.MessageDeliveryMode;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.stereotype.Component;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.rescuenet.emergency.mission.Mission;

/** Publie les événements du domaine sur l'exchange topic « rescuenet.events » (JSON). */
@Component
public class MissionPublisher {

    private final RabbitTemplate rabbit;
    private final ObjectMapper json = new ObjectMapper();

    public MissionPublisher(RabbitTemplate rabbit) {
        this.rabbit = rabbit;
    }

    public void missionDispatched(Mission m) {
        publish("mission.dispatched", payload(m));
    }

    /** Consommé par hospital (réservation -> admission), patient-record (historique) et dispatch (ambulance libre). */
    public void missionCompleted(Mission m) {
        Map<String, Object> p = payload(m);
        p.put("completedAt", Instant.now().toString());
        publish("mission.completed", p);
    }

    private Map<String, Object> payload(Mission m) {
        Map<String, Object> p = new LinkedHashMap<>();
        p.put("missionId", m.id);
        p.put("patientId", m.patientId);
        p.put("severity", m.severity);
        p.put("specialty", m.specialty);
        p.put("hospitalName", m.hospitalName);
        p.put("reservationId", m.reservationId);
        p.put("ambulanceId", m.ambulanceId);
        List<String> symptoms = m.symptoms == null ? List.of() : Arrays.asList(m.symptoms.split(" \\| "));
        p.put("symptoms", symptoms);
        return p;
    }

    private void publish(String routingKey, Map<String, Object> payload) {
        try {
            Message message = MessageBuilder
                    .withBody(json.writeValueAsString(payload).getBytes(StandardCharsets.UTF_8))
                    .setContentType("application/json")
                    .setDeliveryMode(MessageDeliveryMode.PERSISTENT)
                    .build();
            rabbit.send(RabbitConfig.EXCHANGE, routingKey, message);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException(e);
        }
    }
}
