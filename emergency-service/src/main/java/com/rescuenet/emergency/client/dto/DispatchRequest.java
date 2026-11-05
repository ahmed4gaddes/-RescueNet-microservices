package com.rescuenet.emergency.client.dto;

public record DispatchRequest(String missionId, String severity, GeoPoint pickup, GeoPoint hospital) {

    public record GeoPoint(double lat, double lng) {
    }
}
