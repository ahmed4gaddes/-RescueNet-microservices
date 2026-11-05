package com.rescuenet.emergency.client;

import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;

import com.rescuenet.emergency.client.dto.DispatchRequest;
import com.rescuenet.emergency.client.dto.DispatchResponse;

@FeignClient(name = "DISPATCH-SERVICE", contextId = "dispatchClient")
public interface DispatchClient {

    @PostMapping("/api/dispatch/assign")
    DispatchResponse assign(@RequestBody DispatchRequest body);
}
