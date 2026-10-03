package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"sync"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
)

func env(k, def string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return def
}

type assignRequest struct {
	MissionID string `json:"missionId" binding:"required"`
	Severity  string `json:"severity"`
	Pickup    Point  `json:"pickup" binding:"required"`
	Hospital  Point  `json:"hospital" binding:"required"`
}

const roadFactor = 1.3 // distance routière ≈ 1,3 × vol d'oiseau

func main() {
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	port, _ := strconv.Atoi(env("PORT", "8085"))
	speedup, _ := strconv.ParseFloat(env("SIM_SPEEDUP", "15"), 64)

	rdb := redis.NewClient(&redis.Options{Addr: env("REDIS_ADDR", "localhost:6379")})
	for i := 1; ; i++ {
		if err := rdb.Ping(ctx).Err(); err == nil {
			break
		} else if i >= 30 {
			log.Fatalf("Redis injoignable: %v", err)
		}
		log.Println("[redis] indisponible, nouvelle tentative…")
		sleep(ctx, 2*time.Second)
	}
	store := &Store{rdb: rdb}
	if err := store.seed(ctx); err != nil {
		log.Fatalf("seed: %v", err)
	}
	log.Println("[redis] prêt, flotte initialisée")

	bus := NewBus(env("RABBIT_URL", "amqp://rescue:rescue123@localhost:5672/"))
	sim := &Simulator{store: store, bus: bus, speedup: speedup}
	eureka := NewEurekaClient(env("EUREKA_URL", "http://localhost:8761/eureka"), "DISPATCH-SERVICE", port)

	var wg sync.WaitGroup
	for _, f := range []func(){
		func() { bus.Run(ctx, store) },
		func() { sim.Run(ctx) },
		func() { eureka.Run(ctx) },
	} {
		wg.Add(1)
		go func(f func()) { defer wg.Done(); f() }(f)
	}

	gin.SetMode(gin.ReleaseMode)
	r := gin.New()
	r.Use(gin.Recovery(), gin.Logger())
	r.GET("/health", func(c *gin.Context) { c.JSON(200, gin.H{"status": "UP"}) })

	r.GET("/api/dispatch/ambulances", func(c *gin.Context) {
		list, err := store.allAmbulances(c)
		if err != nil {
			c.JSON(http.StatusServiceUnavailable, gin.H{"error": err.Error()})
			return
		}
		c.JSON(200, list)
	})

	// Choisit l'ambulance libre la plus proche (GEOSEARCH) et démarre la mission simulée.
	r.POST("/api/dispatch/assign", func(c *gin.Context) {
		var req assignRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(400, gin.H{"error": err.Error()})
			return
		}
		if existing, err := store.mission(c, req.MissionID); err == nil && existing.Phase != "DONE" {
			amb, _ := store.ambulance(c, existing.AmbulanceID) // idempotence
			c.JSON(200, gin.H{"missionId": req.MissionID, "ambulanceId": existing.AmbulanceID, "ambulance": amb, "idempotent": true})
			return
		}
		amb, err := store.claimNearest(c, req.Pickup, req.MissionID)
		if err != nil {
			if errors.Is(err, context.Canceled) {
				return
			}
			c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
			return
		}
		m := &Mission{MissionID: req.MissionID, AmbulanceID: amb.ID, Severity: req.Severity, Phase: "TO_SCENE",
			Pickup: req.Pickup, Hospital: req.Hospital}
		if err := store.saveMission(c, m); err != nil {
			c.JSON(500, gin.H{"error": err.Error()})
			return
		}
		store.rdb.SAdd(c, activeKey, req.MissionID)

		toScene := amb.DistKm * roadFactor
		trip := distanceKm(req.Pickup, req.Hospital) * roadFactor
		c.JSON(200, gin.H{
			"missionId": req.MissionID, "ambulanceId": amb.ID, "plate": amb.Plate,
			"distanceToSceneKm": round1(toScene), "etaToSceneMinutes": etaMinutes(toScene, req.Severity),
			"tripToHospitalKm": round1(trip), "totalEtaMinutes": round1(etaMinutes(toScene, req.Severity) + etaMinutes(trip, req.Severity)),
			"ambulancePosition": amb.Position,
		})
	})

	r.GET("/api/dispatch/missions/:id", func(c *gin.Context) {
		m, err := store.mission(c, c.Param("id"))
		if err != nil {
			c.JSON(404, gin.H{"error": err.Error()})
			return
		}
		pos, _ := store.position(c, m.AmbulanceID)
		target := m.Pickup
		if m.Phase == "TO_HOSPITAL" || m.Phase == "ARRIVED" || m.Phase == "DONE" {
			target = m.Hospital
		}
		c.JSON(200, gin.H{
			"missionId": m.MissionID, "ambulanceId": m.AmbulanceID, "phase": m.Phase, "position": pos,
			"remainingKm":  round1(distanceKm(pos, target) * roadFactor),
			"etaMinutes":   etaMinutes(distanceKm(pos, target)*roadFactor, m.Severity),
		})
	})

	// Libération explicite (compensation de saga ou annulation manuelle) — idempotent
	r.DELETE("/api/dispatch/missions/:id", func(c *gin.Context) {
		if err := store.release(c, c.Param("id")); err != nil {
			c.JSON(500, gin.H{"error": err.Error()})
			return
		}
		c.Status(http.StatusNoContent)
	})

	srv := &http.Server{Addr: ":" + strconv.Itoa(port), Handler: r}
	go func() {
		log.Printf("[http] dispatch-service sur le port %d (simulation x%.0f)", port, speedup)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatalf("http: %v", err)
		}
	}()

	<-ctx.Done()
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_ = srv.Shutdown(shutdownCtx)
	wg.Wait() // laisse Eureka se désenregistrer
}

func round1(v float64) float64 { return float64(int(v*10+0.5)) / 10 }
