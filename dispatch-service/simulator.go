package main

import (
	"context"
	"log"
	"time"
)

// Simulator déplace les ambulances assignées (GPS simulé) et publie les changements d'état.
// Règle de robustesse : une phase n'avance qu'une fois l'événement publié avec succès,
// donc si RabbitMQ tombe, l'ambulance attend à destination et le tick suivant réessaie.
type Simulator struct {
	store   *Store
	bus     *Bus
	speedup float64 // accélération du temps pour la démo
}

func (s *Simulator) Run(ctx context.Context) {
	t := time.NewTicker(time.Second)
	defer t.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-t.C:
			ids, err := s.store.activeMissionIDs(ctx)
			if err != nil {
				continue
			}
			for _, id := range ids {
				s.tick(ctx, id)
			}
		}
	}
}

func (s *Simulator) tick(ctx context.Context, id string) {
	m, err := s.store.mission(ctx, id)
	if err != nil {
		s.store.rdb.SRem(ctx, activeKey, id)
		return
	}
	pos, err := s.store.position(ctx, m.AmbulanceID)
	if err != nil {
		return
	}
	step := speedKmh(m.Severity) * s.speedup / 3600 // km parcourus en 1 s réelle

	switch m.Phase {
	case "TO_SCENE":
		next, arrived := moveToward(pos, m.Pickup, step)
		_ = s.store.setPosition(ctx, m.AmbulanceID, next)
		if arrived && s.emit(m, "ON_SCENE", next) {
			m.Phase, m.DwellLeft = "ON_SCENE", 4
			_ = s.store.saveMission(ctx, m)
		}
	case "ON_SCENE":
		m.DwellLeft--
		if m.DwellLeft <= 0 {
			if s.emit(m, "TRANSPORTING", pos) {
				m.Phase = "TO_HOSPITAL"
				_ = s.store.saveMission(ctx, m)
			}
			return
		}
		_ = s.store.saveMission(ctx, m)
	case "TO_HOSPITAL":
		next, arrived := moveToward(pos, m.Hospital, step)
		_ = s.store.setPosition(ctx, m.AmbulanceID, next)
		if arrived && s.emit(m, "ARRIVED", next) {
			m.Phase = "ARRIVED"
			_ = s.store.saveMission(ctx, m)
			// L'ambulance reste ASSIGNED jusqu'à mission.completed (publié par emergency-service)
			s.store.rdb.SRem(ctx, activeKey, id)
		}
	}
}

func (s *Simulator) emit(m *Mission, status string, pos Point) bool {
	err := s.bus.Publish("mission.status.changed", map[string]any{
		"missionId": m.MissionID, "ambulanceId": m.AmbulanceID, "status": status,
		"position": pos, "at": time.Now().UTC().Format(time.RFC3339),
	})
	if err != nil {
		log.Printf("[sim] publication %s/%s impossible (%v), nouvel essai", m.MissionID, status, err)
		return false
	}
	log.Printf("[sim] mission %s -> %s", m.MissionID, status)
	return true
}
