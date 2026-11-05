package com.rescuenet.emergency.client.dto;

public record HospitalMatchRequest(double latitude, double longitude, String specialty, String severity, String missionId) {
}
