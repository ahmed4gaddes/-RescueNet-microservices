// Spécification OpenAPI 3 du patient-record-service (affichée par Swagger UI sur /swagger-ui)
const patient = {
  type: 'object',
  properties: {
    _id: { type: 'string', example: '6ac14ed18dbf9fae5aafed04' },
    nationalId: { type: 'string', example: '12345678' },
    fullName: { type: 'string', example: 'Patient inconnu' },
    age: { type: 'integer', example: 58 },
    gender: { type: 'string', enum: ['M', 'F', 'UNKNOWN'] },
    bloodType: { type: 'string', example: 'O+' },
    allergies: { type: 'array', items: { type: 'string' } },
    chronicConditions: { type: 'array', items: { type: 'string' } },
    medications: { type: 'array', items: { type: 'string' } },
    emergencyContact: { type: 'object', properties: { name: { type: 'string' }, phone: { type: 'string' } } },
    temporary: { type: 'boolean' },
    interventions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          missionId: { type: 'string' }, severity: { type: 'string' }, hospitalName: { type: 'string' },
          symptoms: { type: 'array', items: { type: 'string' } }, date: { type: 'string', format: 'date-time' },
        },
      },
    },
  },
};
const idParam = { name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'Identifiant MongoDB (ObjectId)' };
const json = (schema) => ({ content: { 'application/json': { schema } } });
const err = { description: 'Erreur', ...json({ type: 'object', properties: { error: { type: 'string' } } }) };

module.exports = {
  openapi: '3.0.3',
  info: { title: 'Patient Record Service', version: '1.0.0', description: 'Dossiers médicaux des patients (Node.js / Express / MongoDB).' },
  servers: [{ url: '/' }],
  tags: [{ name: 'Patients' }],
  components: { schemas: { Patient: patient } },
  paths: {
    '/api/patients': {
      get: { tags: ['Patients'], summary: '50 dossiers les plus récents', responses: { 200: { description: 'OK', ...json({ type: 'array', items: { $ref: '#/components/schemas/Patient' } }) } } },
      post: {
        tags: ['Patients'], summary: 'Créer un dossier (ex. dossier temporaire)',
        requestBody: { required: true, ...json({ $ref: '#/components/schemas/Patient' }) },
        responses: { 201: { description: 'Créé', ...json({ $ref: '#/components/schemas/Patient' }) }, 400: err, 409: err },
      },
    },
    '/api/patients/national/{nationalId}': {
      get: {
        tags: ['Patients'], summary: 'Chercher par numéro CIN',
        parameters: [{ name: 'nationalId', in: 'path', required: true, schema: { type: 'string' }, example: '12345678' }],
        responses: { 200: { description: 'OK', ...json({ $ref: '#/components/schemas/Patient' }) }, 404: err },
      },
    },
    '/api/patients/{id}': {
      get: { tags: ['Patients'], summary: 'Lire un dossier', parameters: [idParam], responses: { 200: { description: 'OK', ...json({ $ref: '#/components/schemas/Patient' }) }, 400: err, 404: err } },
      put: {
        tags: ['Patients'], summary: 'Modifier un dossier', parameters: [idParam],
        requestBody: { required: true, ...json({ $ref: '#/components/schemas/Patient' }) },
        responses: { 200: { description: 'OK', ...json({ $ref: '#/components/schemas/Patient' }) }, 400: err, 404: err },
      },
    },
    '/api/patients/{id}/interventions': {
      post: {
        tags: ['Patients'], summary: "Ajouter une intervention à l'historique", parameters: [idParam],
        requestBody: { required: true, ...json({ type: 'object' }) },
        responses: { 201: { description: 'Créé', ...json({ $ref: '#/components/schemas/Patient' }) }, 404: err },
      },
    },
    '/health': { get: { summary: 'État de santé (Eureka)', responses: { 200: { description: 'UP' } } } },
  },
};
