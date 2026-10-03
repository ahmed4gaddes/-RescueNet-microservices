package com.rescuenet.emergency.mission;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

public interface MissionRepository extends JpaRepository<Mission, String> {

    List<Mission> findTop50ByOrderByCreatedAtDesc();
}
