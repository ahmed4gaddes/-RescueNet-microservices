package main

import "math"

type Point struct {
	Lat float64 `json:"lat"`
	Lng float64 `json:"lng"`
}

// distanceKm : distance de Haversine entre deux points.
func distanceKm(a, b Point) float64 {
	const r = 6371.0
	rad := func(d float64) float64 { return d * math.Pi / 180 }
	dLat, dLng := rad(b.Lat-a.Lat), rad(b.Lng-a.Lng)
	h := math.Sin(dLat/2)*math.Sin(dLat/2) +
		math.Cos(rad(a.Lat))*math.Cos(rad(b.Lat))*math.Sin(dLng/2)*math.Sin(dLng/2)
	return r * 2 * math.Atan2(math.Sqrt(h), math.Sqrt(1-h))
}

// speedKmh : vitesse moyenne en ville ; les urgences rouges roulent gyrophare allumé.
func speedKmh(severity string) float64 {
	if severity == "ROUGE" {
		return 70
	}
	return 50
}

func etaMinutes(km float64, severity string) float64 {
	return math.Round(km/speedKmh(severity)*60*10) / 10
}

// moveToward avance de stepKm vers target ; renvoie la nouvelle position et true si arrivé.
func moveToward(from, to Point, stepKm float64) (Point, bool) {
	d := distanceKm(from, to)
	if d <= stepKm || d == 0 {
		return to, true
	}
	f := stepKm / d
	return Point{from.Lat + (to.Lat-from.Lat)*f, from.Lng + (to.Lng-from.Lng)*f}, false
}
