import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { EmergencyRequest, LatLng } from '../../core/models';
import { messageOf } from '../../core/error.interceptor';
import { MapMarker, RescueMap } from '../../shared/map';

const SYMPTOM_PRESETS = [
  'douleur thoracique', 'difficulté à respirer', 'perte de connaissance', 'saignement abondant',
  'traumatisme crânien', 'fracture', 'AVC', 'brûlure', 'douleur abdominale', 'convulsions',
];

@Component({
  selector: 'app-emergency-form',
  imports: [ReactiveFormsModule, RescueMap],
  templateUrl: './emergency-form.html',
})
export class EmergencyForm {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);

  protected readonly presets = SYMPTOM_PRESETS;
  protected readonly symptoms = signal<string[]>([]);
  protected readonly location = signal<LatLng>({ lat: 36.806, lng: 10.18 });
  protected readonly submitting = signal(false);
  protected readonly failure = signal<string | null>(null);

  protected readonly form = this.fb.nonNullable.group({
    callerPhone: ['', [Validators.required, Validators.pattern(/^\+?[0-9 ]{8,15}$/)]],
    nationalId: [''],
    age: [40, [Validators.required, Validators.min(0), Validators.max(120)]],
    lat: [36.806, [Validators.required, Validators.min(-90), Validators.max(90)]],
    lng: [10.18, [Validators.required, Validators.min(-180), Validators.max(180)]],
    symptomInput: [''],
    heartRate: [80, [Validators.min(20), Validators.max(250)]],
    spo2: [98, [Validators.min(50), Validators.max(100)]],
    systolicBP: [120, [Validators.min(40), Validators.max(260)]],
    consciousness: ['ALERT'],
    painLevel: [0, [Validators.min(0), Validators.max(10)]],
  });

  protected readonly markers = computed<MapMarker[]>(() => [
    { id: 'p', ...this.location(), kind: 'patient', label: "Lieu de l'urgence", pulse: true },
  ]);

  protected invalid(name: string): boolean {
    const c = this.form.get(name);
    return !!c && c.invalid && (c.touched || c.dirty);
  }

  protected addSymptom(raw: string): void {
    const s = raw.trim();
    if (s && !this.symptoms().includes(s)) this.symptoms.update(l => [...l, s]);
    this.form.controls.symptomInput.setValue('');
  }
  protected removeSymptom(s: string): void { this.symptoms.update(l => l.filter(x => x !== s)); }
  protected togglePreset(s: string): void {
    this.symptoms().includes(s) ? this.removeSymptom(s) : this.addSymptom(s);
  }

  protected syncLocation(): void {
    const { lat, lng } = this.form.getRawValue();
    if (Number.isFinite(lat) && Number.isFinite(lng)) this.location.set({ lat, lng });
  }

  protected useMyPosition(): void {
    navigator.geolocation?.getCurrentPosition(p => {
      this.form.patchValue({ lat: +p.coords.latitude.toFixed(5), lng: +p.coords.longitude.toFixed(5) });
      this.syncLocation();
    });
  }

  protected fillDemo(): void {
    this.form.patchValue({
      callerPhone: '+21698123456', nationalId: '12345678', age: 58, lat: 36.806, lng: 10.18,
      heartRate: 128, spo2: 88, systolicBP: 95, consciousness: 'ALERT', painLevel: 9,
    });
    this.symptoms.set(['douleur thoracique intense', 'sueurs froides']);
    this.syncLocation();
  }

  protected submit(): void {
    const pending = this.form.controls.symptomInput.value.trim();
    if (pending) this.addSymptom(pending);
    this.form.markAllAsTouched();
    if (this.form.invalid || this.symptoms().length === 0) {
      this.failure.set(this.symptoms().length === 0 ? 'Ajoutez au moins un symptôme.' : 'Corrigez les champs en rouge.');
      return;
    }
    const v = this.form.getRawValue();
    const body: EmergencyRequest = {
      callerPhone: v.callerPhone.replace(/\s/g, ''),
      nationalId: v.nationalId.trim(),
      age: v.age,
      location: { lat: v.lat, lng: v.lng },
      symptoms: this.symptoms(),
      vitals: { heartRate: v.heartRate, spo2: v.spo2, systolicBP: v.systolicBP, consciousness: v.consciousness, painLevel: v.painLevel },
    };
    this.failure.set(null);
    this.submitting.set(true);
    this.api.createEmergency(body).subscribe({
      next: m => this.router.navigate(['/emergency', m.missionId]),
      error: (e: HttpErrorResponse) => {
        this.submitting.set(false);
        const id = e.error?.missionId;
        this.failure.set(messageOf(e) + (id ? ` (mission ${id} enregistrée en échec — lits libérés)` : ''));
      },
    });
  }
}
