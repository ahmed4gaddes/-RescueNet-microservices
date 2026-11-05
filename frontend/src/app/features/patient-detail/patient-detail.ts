import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, effect, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { Patient } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { SeverityBadge } from '../../shared/badges';

const toList = (s: string) => s.split(',').map(x => x.trim()).filter(Boolean);

@Component({
  selector: 'app-patient-detail',
  imports: [RouterLink, DatePipe, ReactiveFormsModule, SeverityBadge],
  templateUrl: './patient-detail.html',
})
export class PatientDetail {
  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);
  protected readonly auth = inject(AuthService);

  readonly id = input.required<string>();
  protected readonly patient = signal<Patient | null>(null);
  protected readonly notFound = signal(false);
  protected readonly editing = signal(false);
  protected readonly saving = signal(false);

  protected readonly form = this.fb.nonNullable.group({
    fullName: [''], age: [0], gender: ['UNKNOWN'], bloodType: ['UNKNOWN'],
    allergies: [''], chronicConditions: [''], medications: [''],
    contactName: [''], contactPhone: [''],
  });

  constructor() {
    effect(() => {
      const id = this.id();
      this.patient.set(null);
      this.notFound.set(false);
      this.api.patient(id).subscribe({
        next: p => { this.patient.set(p); this.fill(p); },
        error: (e: HttpErrorResponse) => this.notFound.set(e.status === 404 || e.status === 400),
      });
    });
  }

  private fill(p: Patient): void {
    this.form.patchValue({
      fullName: p.fullName ?? '', age: p.age ?? 0, gender: p.gender ?? 'UNKNOWN', bloodType: p.bloodType ?? 'UNKNOWN',
      allergies: (p.allergies ?? []).join(', '), chronicConditions: (p.chronicConditions ?? []).join(', '),
      medications: (p.medications ?? []).join(', '),
      contactName: p.emergencyContact?.name ?? '', contactPhone: p.emergencyContact?.phone ?? '',
    });
  }

  protected save(): void {
    const v = this.form.getRawValue();
    this.saving.set(true);
    this.api.updatePatient(this.id(), {
      fullName: v.fullName, age: v.age, gender: v.gender, bloodType: v.bloodType,
      allergies: toList(v.allergies), chronicConditions: toList(v.chronicConditions), medications: toList(v.medications),
      emergencyContact: { name: v.contactName, phone: v.contactPhone },
      temporary: false,
    }).subscribe({
      next: p => { this.patient.set(p); this.editing.set(false); this.saving.set(false); this.toast.success('Dossier enregistré.'); },
      error: () => this.saving.set(false),
    });
  }

  protected reversed(p: Patient) { return [...(p.interventions ?? [])].reverse(); }
}
