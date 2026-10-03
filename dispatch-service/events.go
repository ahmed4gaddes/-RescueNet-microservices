package main

import (
	"context"
	"encoding/json"
	"log"
	"sync"
	"time"

	amqp "github.com/rabbitmq/amqp091-go"
)

const (
	exchange     = "rescuenet.events"
	completedQ   = "dispatch.mission-completed"
	completedKey = "mission.completed"
)

// Bus : publication + consommation RabbitMQ avec reconnexion automatique.
// Si RabbitMQ est indisponible, Publish renvoie une erreur et le simulateur réessaie au tick suivant.
type Bus struct {
	url  string
	mu   sync.RWMutex
	conn *amqp.Connection
	pub  *amqp.Channel
}

func NewBus(url string) *Bus { return &Bus{url: url} }

func (b *Bus) connect() error {
	conn, err := amqp.Dial(b.url)
	if err != nil {
		return err
	}
	pub, err := conn.Channel()
	if err != nil {
		conn.Close()
		return err
	}
	if err := pub.ExchangeDeclare(exchange, "topic", true, false, false, false, nil); err != nil {
		conn.Close()
		return err
	}
	b.mu.Lock()
	b.conn, b.pub = conn, pub
	b.mu.Unlock()
	return nil
}

func (b *Bus) Publish(routingKey string, payload any) error {
	body, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	b.mu.RLock()
	ch := b.pub
	b.mu.RUnlock()
	if ch == nil || ch.IsClosed() {
		return amqp.ErrClosed
	}
	return ch.Publish(exchange, routingKey, false, false, amqp.Publishing{
		ContentType: "application/json", DeliveryMode: amqp.Persistent, Body: body,
	})
}

// Run maintient la connexion et consomme mission.completed -> libère l'ambulance.
func (b *Bus) Run(ctx context.Context, store *Store) {
	for ctx.Err() == nil {
		if err := b.connect(); err != nil {
			log.Printf("[rabbit] indisponible (%v), nouvelle tentative dans 5s", err)
			sleep(ctx, 5*time.Second)
			continue
		}
		log.Println("[rabbit] connecté")
		if err := b.consume(ctx, store); err != nil {
			log.Printf("[rabbit] connexion perdue: %v", err)
		}
		sleep(ctx, 3*time.Second)
	}
}

func (b *Bus) consume(ctx context.Context, store *Store) error {
	b.mu.RLock()
	conn := b.conn
	b.mu.RUnlock()
	ch, err := conn.Channel()
	if err != nil {
		return err
	}
	defer ch.Close()
	if _, err := ch.QueueDeclare(completedQ, true, false, false, false, nil); err != nil {
		return err
	}
	if err := ch.QueueBind(completedQ, completedKey, exchange, false, nil); err != nil {
		return err
	}
	msgs, err := ch.Consume(completedQ, "", false, false, false, false, nil)
	if err != nil {
		return err
	}
	closed := conn.NotifyClose(make(chan *amqp.Error, 1))
	for {
		select {
		case <-ctx.Done():
			return nil
		case e := <-closed:
			return e
		case m, ok := <-msgs:
			if !ok {
				return amqp.ErrClosed
			}
			var evt struct {
				MissionID string `json:"missionId"`
			}
			if err := json.Unmarshal(m.Body, &evt); err != nil || evt.MissionID == "" {
				m.Nack(false, false)
				continue
			}
			if err := store.release(ctx, evt.MissionID); err != nil {
				log.Printf("[events] release %s: %v", evt.MissionID, err)
				m.Nack(false, true)
				continue
			}
			log.Printf("[events] mission %s terminée -> ambulance libérée", evt.MissionID)
			m.Ack(false)
		}
	}
}

func sleep(ctx context.Context, d time.Duration) {
	select {
	case <-ctx.Done():
	case <-time.After(d):
	}
}
