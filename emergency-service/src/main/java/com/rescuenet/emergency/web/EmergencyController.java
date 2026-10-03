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

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/emergencies")
public class EmergencyController {

    private final MissionService missions;

    public EmergencyController(MissionService missions) {
        this.missions = missions;
    }

    @PostMapping
    public ResponseEntity<MissionView> create(@Valid @RequestBody EmergencyRequest request) {
        return ResponseEntity.status(201).body(missions.create(request));
    }

    @GetMapping
    public List<MissionView> latest() {
        return missions.latest();
    }

    @GetMapping("/{id}")
    public MissionView get(@PathVariable String id) {
        return missions.get(id);
    }
}
