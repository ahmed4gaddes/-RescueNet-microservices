const amqp = require('amqplib');
const mongoose = require('mongoose');
const { Patient } = require('./models');

const RABBIT_URL = process.env.RABBIT_URL || 'amqp://rescue:rescue123@localhost:5672';
const EXCHANGE = 'rescuenet.events';
const QUEUE = 'patient-record.mission-completed';

// Consomme mission.completed -> ajoute l'intervention à l'historique du patient.
// RabbitMQ peut être absent au démarrage : on réessaie sans jamais planter le service.
async function startConsumer() {
  try {
    const conn = await amqp.connect(RABBIT_URL);
    conn.on('close', () => setTimeout(startConsumer, 5000));
    conn.on('error', () => {});
    const ch = await conn.createChannel();
    await ch.assertExchange(EXCHANGE, 'topic', { durable: true });
    await ch.assertQueue(QUEUE, { durable: true });
    await ch.bindQueue(QUEUE, EXCHANGE, 'mission.completed');
    await ch.consume(QUEUE, async (msg) => {
      if (!msg) return;
      try {
        const evt = JSON.parse(msg.content.toString());
        if (evt.patientId && mongoose.isValidObjectId(evt.patientId)) {
          await Patient.findByIdAndUpdate(evt.patientId, {
            $push: {
              interventions: {
                missionId: evt.missionId,
                severity: evt.severity,
                hospitalName: evt.hospitalName,
                symptoms: evt.symptoms,
                date: evt.completedAt ? new Date(evt.completedAt) : new Date(),
              },
            },
          });
          console.log(`[events] intervention ajoutée au patient ${evt.patientId}`);
        }
        ch.ack(msg);
      } catch (err) {
        console.error('[events] message rejeté:', err.message);
        ch.nack(msg, false, false);
      }
    });
    console.log('[events] consommateur RabbitMQ prêt');
  } catch (err) {
    console.warn('[events] RabbitMQ indisponible, nouvelle tentative dans 5s');
    setTimeout(startConsumer, 5000);
  }
}

module.exports = { startConsumer };
