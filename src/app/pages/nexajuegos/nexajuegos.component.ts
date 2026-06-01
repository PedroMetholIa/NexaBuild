import { Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-nexajuegos',
  imports: [RouterLink],
  templateUrl: './nexajuegos.component.html',
  styleUrl: './nexajuegos.component.css',
})
export class NexaJuegosComponent {
  submitted = signal(false);

  submitForm() {
    this.submitted.set(true);
  }
}
