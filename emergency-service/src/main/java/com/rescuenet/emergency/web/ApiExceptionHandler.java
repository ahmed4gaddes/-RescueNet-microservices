package com.rescuenet.emergency.web;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.NoSuchElementException;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import com.rescuenet.emergency.remote.SagaFailure;

@RestControllerAdvice
public class ApiExceptionHandler {

    @ExceptionHandler(SagaFailure.class)
    ResponseEntity<Map<String, Object>> saga(SagaFailure e) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("error", e.getMessage());
        if (!e.service().isEmpty()) {
            body.put("service", e.service());
        }
        body.put("missionId", e.missionId());
        body.put("missionStatus", "FAILED");
        return ResponseEntity.status(e.status()).body(body);
    }

    @ExceptionHandler(NoSuchElementException.class)
    ResponseEntity<Map<String, String>> notFound(NoSuchElementException e) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", e.getMessage()));
    }
}
