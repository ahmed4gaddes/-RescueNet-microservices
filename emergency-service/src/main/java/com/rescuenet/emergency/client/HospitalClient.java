package com.rescuenet.emergency.client;

import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;

import com.rescuenet.emergency.client.dto.HospitalMatchRequest;
import com.rescuenet.emergency.client.dto.HospitalMatchResponse;

@FeignClient(name = "HOSPITAL-SERVICE", contextId = "hospitalClient")
public interface HospitalClient {

    @PostMapping("/api/hospitals/match")
    HospitalMatchResponse match(@RequestBody HospitalMatchRequest body);

    /** Compensation de la saga : libère le lit réservé. */
    @DeleteMapping("/api/hospitals/reservations/{id}")
    void release(@PathVariable("id") String reservationId);
}
