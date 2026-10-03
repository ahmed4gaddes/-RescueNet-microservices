package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"
)

// EurekaClient : enregistrement REST minimal (register -> heartbeat 10 s -> deregister).
type EurekaClient struct {
	baseURL    string
	app        string
	instanceID string
	port       int
	http       *http.Client
}

func NewEurekaClient(baseURL, app string, port int) *EurekaClient {
	return &EurekaClient{
		baseURL: strings.TrimRight(baseURL, "/"), app: app, port: port,
		instanceID: fmt.Sprintf("%s:%d", strings.ToLower(app), port),
		http:       &http.Client{Timeout: 5 * time.Second},
	}
}

func (e *EurekaClient) register() error {
	p := fmt.Sprint(e.port)
	payload := map[string]any{"instance": map[string]any{
		"instanceId": e.instanceID, "hostName": "localhost", "app": e.app, "ipAddr": "127.0.0.1",
		"vipAddress": strings.ToLower(e.app), "status": "UP",
		"port":           map[string]any{"$": e.port, "@enabled": "true"},
		"securePort":     map[string]any{"$": 443, "@enabled": "false"},
		"healthCheckUrl": "http://127.0.0.1:" + p + "/health",
		"statusPageUrl":  "http://127.0.0.1:" + p + "/health",
		"homePageUrl":    "http://127.0.0.1:" + p + "/",
		"dataCenterInfo": map[string]any{"@class": "com.netflix.appinfo.InstanceInfo$DefaultDataCenterInfo", "name": "MyOwn"},
		"leaseInfo":      map[string]any{"renewalIntervalInSecs": 10, "durationInSecs": 30},
	}}
	body, _ := json.Marshal(payload)
	resp, err := e.http.Post(e.baseURL+"/apps/"+e.app, "application/json", bytes.NewReader(body))
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		return fmt.Errorf("register: HTTP %d", resp.StatusCode)
	}
	return nil
}

func (e *EurekaClient) heartbeat() (int, error) {
	req, _ := http.NewRequest(http.MethodPut, e.baseURL+"/apps/"+e.app+"/"+e.instanceID, nil)
	resp, err := e.http.Do(req)
	if err != nil {
		return 0, err
	}
	resp.Body.Close()
	return resp.StatusCode, nil
}

// Run boucle jusqu'à l'annulation du contexte, puis se désenregistre.
func (e *EurekaClient) Run(ctx context.Context) {
	registered := false
	for ctx.Err() == nil {
		if !registered {
			if err := e.register(); err != nil {
				log.Printf("[eureka] enregistrement impossible: %v", err)
			} else {
				registered = true
				log.Printf("[eureka] enregistré (%s)", e.instanceID)
			}
		} else if code, err := e.heartbeat(); err != nil || code == http.StatusNotFound {
			registered = false // Eureka a redémarré ou oublié l'instance
			continue
		}
		wait := 10 * time.Second
		if !registered {
			wait = 3 * time.Second
		}
		sleep(ctx, wait)
	}
	req, _ := http.NewRequest(http.MethodDelete, e.baseURL+"/apps/"+e.app+"/"+e.instanceID, nil)
	if resp, err := e.http.Do(req); err == nil {
		resp.Body.Close()
		log.Println("[eureka] désenregistré")
	}
}
