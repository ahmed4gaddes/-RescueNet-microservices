package com.rescuenet.emergency.client;

import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;

import com.rescuenet.emergency.client.dto.PatientCreateRequest;
import com.rescuenet.emergency.client.dto.PatientDto;

/** Nom Eureka uniquement : aucune URL ni port. */
@FeignClient(name = "PATIENT-RECORD-SERVICE", contextId = "patientClient")
public interface PatientClient {

    @GetMapping("/api/patients/national/{nationalId}")
    PatientDto findByNationalId(@PathVariable("nationalId") String nationalId);

    @PostMapping("/api/patients")
    PatientDto create(@RequestBody PatientCreateRequest body);
}
