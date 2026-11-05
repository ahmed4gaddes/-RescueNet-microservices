package com.rescuenet.emergency.web;

import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.rescuenet.emergency.mission.MissionService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;

@Tag(name = "Urgences", description = "Création et suivi des missions de secours (saga : patient, triage, lit, ambulance)")
@RestController
@RequestMapping("/api/emergencies")
public class EmergencyController {

    private final MissionService missions;

    public EmergencyController(MissionService missions) {
        this.missions = missions;
    }

    @Operation(summary = "Signaler une urgence", description = "Lance la saga : dossier patient, triage IA, réservation d'un lit, envoi de l'ambulance. 503 si un service indispensable est indisponible.")
    @PostMapping
    public ResponseEntity<MissionView> create(@Valid @RequestBody EmergencyRequest request) {
        return ResponseEntity.status(201).body(missions.create(request));
    }

    @Operation(summary = "50 dernières missions")
    @GetMapping
    public List<MissionView> latest() {
        return missions.latest();
    }

    @Operation(summary = "Détail et statut d'une mission")
    @GetMapping("/{id}")
    public MissionView get(@PathVariable String id) {
        return missions.get(id);
    }
}
