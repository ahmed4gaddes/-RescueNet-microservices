const express = require('express');
const mongoose = require('mongoose');
const { Eureka } = require('eureka-js-client');
const routes = require('./routes');
const { Patient } = require('./models');
const { startConsumer } = require('./events');

const PORT = parseInt(process.env.PORT || '8082', 10);
const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017/patients';
const EUREKA_HOST = process.env.EUREKA_HOST || 'localhost';
const EUREKA_PORT = parseInt(process.env.EUREKA_PORT || '8761', 10);

const SEED = [
  { nationalId: '12345678', fullName: 'Ahmed Ben Salah', age: 58, gender: 'M', bloodType: 'A+',
    allergies: ['Pénicilline'], chronicConditions: ['Hypertension', 'Diabète type 2'], medications: ['Metformine'],
    emergencyContact: { name: 'Sonia Ben Salah', phone: '+21620111222' } },
  { nationalId: '23456789', fullName: 'Leila Trabelsi', age: 34, gender: 'F', bloodType: 'O-',
    allergies: [], chronicConditions: ['Asthme'], medications: ['Ventoline'],
    emergencyContact: { name: 'Karim Trabelsi', phone: '+21620333444' } },
  { nationalId: '34567890', fullName: 'Youssef Gharbi', age: 72, gender: 'M', bloodType: 'B+',
    allergies: ['Aspirine'], chronicConditions: ['Insuffisance cardiaque'], medications: ['Bisoprolol'],
    emergencyContact: { name: 'Mariem Gharbi', phone: '+21620555666' } },
];

async function seed() {
  if ((await Patient.countDocuments()) === 0) {
    await Patient.insertMany(SEED);
    console.log(`[seed] ${SEED.length} patients de démo créés`);
  }
}

async function main() {
  await mongoose.connect(MONGO_URL);
  console.log('[mongo] connecté');
  await Patient.init();
  await seed();

  const app = express();
  app.use(express.json());
  app.get('/health', (_req, res) => res.json({ status: 'UP' }));
  app.use('/api/patients', routes);

  app.listen(PORT, () => {
    console.log(`[http] patient-record-service sur le port ${PORT}`);

    const eureka = new Eureka({
      instance: {
        app: 'PATIENT-RECORD-SERVICE',
        instanceId: `patient-record-service:${PORT}`,
        hostName: 'localhost',
        ipAddr: '127.0.0.1',
        port: { $: PORT, '@enabled': true },
        vipAddress: 'patient-record-service',
        statusPageUrl: `http://127.0.0.1:${PORT}/health`,
        healthCheckUrl: `http://127.0.0.1:${PORT}/health`,
        dataCenterInfo: { '@class': 'com.netflix.appinfo.InstanceInfo$DefaultDataCenterInfo', name: 'MyOwn' },
        leaseInfo: { renewalIntervalInSecs: 10, durationInSecs: 30 },
      },
      eureka: { host: EUREKA_HOST, port: EUREKA_PORT, servicePath: '/eureka/apps/', maxRetries: 30, requestRetryDelay: 2000 },
    });
    eureka.start((err) => console.log(err ? `[eureka] erreur: ${err}` : '[eureka] enregistré'));

    const shutdown = () => eureka.stop(() => process.exit(0));
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  });

  startConsumer();
}

main().catch((err) => {
  console.error('Démarrage impossible:', err.message);
  process.exit(1);
});
