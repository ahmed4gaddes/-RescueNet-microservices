package com.rescuenet.emergency.events;

import java.nio.charset.StandardCharsets;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Component;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.rescuenet.emergency.mission.MissionService;

/** Reçoit les changements d'état publiés par dispatch-service (ON_SCENE, TRANSPORTING, ARRIVED). */
@Component
public class DispatchStatusListener {

    private static final Logger log = LoggerFactory.getLogger(DispatchStatusListener.class);
    private final ObjectMapper json = new ObjectMapper();
    private final MissionService missions;

    public DispatchStatusListener(MissionService missions) {
        this.missions = missions;
    }

    @RabbitListener(queues = RabbitConfig.STATUS_QUEUE)
    public void onStatusChanged(Message message) throws Exception {
        JsonNode evt = json.readTree(new String(message.getBody(), StandardCharsets.UTF_8));
        String missionId = evt.path("missionId").asText("");
        String status = evt.path("status").asText("");
        log.info("Événement dispatch : mission {} -> {}", missionId, status);
        missions.onDispatchStatus(missionId, status);
    }
}
