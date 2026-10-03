const express = require('express');
const mongoose = require('mongoose');
const { Patient } = require('./models');

const router = express.Router();
const validId = (id) => mongoose.isValidObjectId(id);

// Création d'un dossier (le service emergency crée un dossier temporaire si le patient est inconnu)
router.post('/', async (req, res) => {
  try {
    const patient = await Patient.create(req.body);
    res.status(201).json(patient);
  } catch (err) {
    const status = err.code === 11000 ? 409 : 400;
    res.status(status).json({ error: err.code === 11000 ? 'nationalId déjà utilisé' : err.message });
  }
});

router.get('/', async (_req, res) => {
  res.json(await Patient.find().sort({ createdAt: -1 }).limit(50));
});

router.get('/national/:nationalId', async (req, res) => {
  const patient = await Patient.findOne({ nationalId: req.params.nationalId });
  if (!patient) return res.status(404).json({ error: 'Patient introuvable' });
  res.json(patient);
});

router.get('/:id', async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ error: 'id invalide' });
  const patient = await Patient.findById(req.params.id);
  if (!patient) return res.status(404).json({ error: 'Patient introuvable' });
  res.json(patient);
});

router.put('/:id', async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ error: 'id invalide' });
  const patient = await Patient.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!patient) return res.status(404).json({ error: 'Patient introuvable' });
  res.json(patient);
});

router.post('/:id/interventions', async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ error: 'id invalide' });
  const patient = await Patient.findByIdAndUpdate(
    req.params.id,
    { $push: { interventions: req.body } },
    { new: true }
  );
  if (!patient) return res.status(404).json({ error: 'Patient introuvable' });
  res.status(201).json(patient);
});

module.exports = router;
