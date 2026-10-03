const mongoose = require('mongoose');

const interventionSchema = new mongoose.Schema(
  {
    missionId: String,
    severity: String,
    hospitalName: String,
    symptoms: [String],
    date: { type: Date, default: Date.now },
  },
  { _id: false }
);

const patientSchema = new mongoose.Schema(
  {
    nationalId: { type: String, index: true, unique: true, sparse: true },
    fullName: { type: String, default: 'Patient inconnu' },
    age: Number,
    gender: { type: String, enum: ['M', 'F', 'UNKNOWN'], default: 'UNKNOWN' },
    bloodType: { type: String, default: 'UNKNOWN' },
    allergies: [String],
    chronicConditions: [String],
    medications: [String],
    emergencyContact: { name: String, phone: String },
    temporary: { type: Boolean, default: false },
    interventions: [interventionSchema],
  },
  { timestamps: true }
);

module.exports = { Patient: mongoose.model('Patient', patientSchema) };
