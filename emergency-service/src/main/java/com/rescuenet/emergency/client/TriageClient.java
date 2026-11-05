package com.rescuenet.emergency.client;

import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;

import com.rescuenet.emergency.client.dto.TriageRequest;
import com.rescuenet.emergency.client.dto.TriageResponse;

@FeignClient(name = "TRIAGE-AI-SERVICE", contextId = "triageClient")
public interface TriageClient {

    @PostMapping("/api/triage")
    TriageResponse triage(@RequestBody TriageRequest body);
}
