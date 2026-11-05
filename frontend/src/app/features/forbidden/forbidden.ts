import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-forbidden',
  imports: [RouterLink],
  template: `
  <div class="page">
    <div class="card empty">
      <strong>Accès refusé</strong>
      Votre rôle ne permet pas d'ouvrir cette page.
      <p style="margin-top:14px"><a class="btn" routerLink="/">Retour au tableau de bord</a></p>
    </div>
  </div>`,
})
export class Forbidden {}
