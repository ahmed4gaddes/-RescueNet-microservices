package main

import (
	"context"
	"errors"
	"fmt"
	"strconv"

	"github.com/redis/go-redis/v9"
)

const (
	geoKey      = "ambulances:geo"
	activeKey   = "missions:active"
	statusAvail = "AVAILABLE"
)

var claimScript = redis.NewScript(`
if redis.call('HGET', KEYS[1], 'status') == 'AVAILABLE' then
  redis.call('HSET', KEYS[1], 'status', 'ASSIGNED', 'missionId', ARGV[1])
  return 1
end
return 0`)

type Ambulance struct {
	ID        string  `json:"id"`
	Plate     string  `json:"plate"`
	Status    string  `json:"status"`
	MissionID string  `json:"missionId,omitempty"`
	Position  Point   `json:"position"`
	DistKm    float64 `json:"distanceKm,omitempty"`
}

type Mission struct {
	MissionID   string  `json:"missionId"`
	AmbulanceID string  `json:"ambulanceId"`
	Severity    string  `json:"severity"`
	Phase       string  `json:"phase"` // TO_SCENE | ON_SCENE | TO_HOSPITAL | DONE
	Pickup      Point   `json:"pickup"`
	Hospital    Point   `json:"hospital"`
	DwellLeft   int     `json:"dwellTicksLeft"`
	EtaMinutes  float64 `json:"etaMinutes,omitempty"`
}

type Store struct{ rdb *redis.Client }

func ambKey(id string) string     { return "ambulance:" + id }
func missionKey(id string) string { return "mission:" + id }

func (s *Store) seed(ctx context.Context) error {
	if n, _ := s.rdb.ZCard(ctx, geoKey).Result(); n > 0 {
		return nil
	}
	fleet := []struct {
		id, plate string
		p         Point
	}{
		{"AMB-01", "TUN-1001", Point{36.8065, 10.1815}}, // centre de Tunis
		{"AMB-02", "TUN-1002", Point{36.7950, 10.1700}},
		{"AMB-03", "TUN-1003", Point{36.8190, 10.1650}},
		{"AMB-04", "TUN-1004", Point{36.8650, 10.1930}}, // Ariana
		{"AMB-05", "TUN-1005", Point{36.8800, 10.3250}}, // La Marsa
		{"AMB-06", "TUN-1006", Point{36.8420, 10.2400}}, // Lac / Berges
		{"AMB-07", "TUN-1007", Point{36.7500, 10.2000}}, // Sud
		{"AMB-08", "TUN-1008", Point{36.8300, 10.1500}}, // Bardo
	}
	for _, a := range fleet {
		if err := s.rdb.HSet(ctx, ambKey(a.id), "id", a.id, "plate", a.plate, "status", statusAvail, "missionId", "").Err(); err != nil {
			return err
		}
		if err := s.setPosition(ctx, a.id, a.p); err != nil {
			return err
		}
	}
	return nil
}

func (s *Store) setPosition(ctx context.Context, id string, p Point) error {
	return s.rdb.GeoAdd(ctx, geoKey, &redis.GeoLocation{Name: id, Longitude: p.Lng, Latitude: p.Lat}).Err()
}

func (s *Store) position(ctx context.Context, id string) (Point, error) {
	res, err := s.rdb.GeoPos(ctx, geoKey, id).Result()
	if err != nil || len(res) == 0 || res[0] == nil {
		return Point{}, errors.New("position inconnue")
	}
	return Point{Lat: res[0].Latitude, Lng: res[0].Longitude}, nil
}

func (s *Store) ambulance(ctx context.Context, id string) (*Ambulance, error) {
	h, err := s.rdb.HGetAll(ctx, ambKey(id)).Result()
	if err != nil || len(h) == 0 {
		return nil, errors.New("ambulance introuvable")
	}
	pos, _ := s.position(ctx, id)
	return &Ambulance{ID: id, Plate: h["plate"], Status: h["status"], MissionID: h["missionId"], Position: pos}, nil
}

func (s *Store) allAmbulances(ctx context.Context) ([]Ambulance, error) {
	ids, err := s.rdb.ZRange(ctx, geoKey, 0, -1).Result()
	if err != nil {
		return nil, err
	}
	out := make([]Ambulance, 0, len(ids))
	for _, id := range ids {
		if a, err := s.ambulance(ctx, id); err == nil {
			out = append(out, *a)
		}
	}
	return out, nil
}

// claimNearest : GEOSEARCH trié par distance, puis réservation atomique (Lua) de la première ambulance libre.
func (s *Store) claimNearest(ctx context.Context, from Point, missionID string) (*Ambulance, error) {
	locs, err := s.rdb.GeoSearchLocation(ctx, geoKey, &redis.GeoSearchLocationQuery{
		GeoSearchQuery: redis.GeoSearchQuery{
			Longitude: from.Lng, Latitude: from.Lat, Radius: 200, RadiusUnit: "km", Sort: "ASC", Count: 50,
		},
		WithDist: true, WithCoord: true,
	}).Result()
	if err != nil {
		return nil, err
	}
	for _, l := range locs {
		ok, err := claimScript.Run(ctx, s.rdb, []string{ambKey(l.Name)}, missionID).Int()
		if err != nil {
			return nil, err
		}
		if ok == 1 {
			a, err := s.ambulance(ctx, l.Name)
			if err != nil {
				return nil, err
			}
			a.DistKm = l.Dist
			return a, nil
		}
	}
	return nil, errors.New("aucune ambulance disponible")
}

func (s *Store) saveMission(ctx context.Context, m *Mission) error {
	return s.rdb.HSet(ctx, missionKey(m.MissionID), map[string]any{
		"ambulanceId": m.AmbulanceID, "severity": m.Severity, "phase": m.Phase,
		"pickupLat": m.Pickup.Lat, "pickupLng": m.Pickup.Lng,
		"hospLat": m.Hospital.Lat, "hospLng": m.Hospital.Lng, "dwell": m.DwellLeft,
	}).Err()
}

func (s *Store) mission(ctx context.Context, id string) (*Mission, error) {
	h, err := s.rdb.HGetAll(ctx, missionKey(id)).Result()
	if err != nil || len(h) == 0 {
		return nil, errors.New("mission introuvable")
	}
	f := func(k string) float64 { v, _ := strconv.ParseFloat(h[k], 64); return v }
	dwell, _ := strconv.Atoi(h["dwell"])
	return &Mission{
		MissionID: id, AmbulanceID: h["ambulanceId"], Severity: h["severity"], Phase: h["phase"],
		Pickup: Point{f("pickupLat"), f("pickupLng")}, Hospital: Point{f("hospLat"), f("hospLng")}, DwellLeft: dwell,
	}, nil
}

func (s *Store) activeMissionIDs(ctx context.Context) ([]string, error) {
	return s.rdb.SMembers(ctx, activeKey).Result()
}

// release : remet l'ambulance en service et clôt la mission (idempotent).
func (s *Store) release(ctx context.Context, missionID string) error {
	m, err := s.mission(ctx, missionID)
	if err != nil {
		return nil // déjà libérée ou inconnue
	}
	if err := s.rdb.HSet(ctx, ambKey(m.AmbulanceID), "status", statusAvail, "missionId", "").Err(); err != nil {
		return fmt.Errorf("release ambulance: %w", err)
	}
	s.rdb.SRem(ctx, activeKey, missionID)
	s.rdb.HSet(ctx, missionKey(missionID), "phase", "DONE")
	return nil
}
