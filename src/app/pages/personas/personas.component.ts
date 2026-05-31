import { Component, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PersonaService } from '../../services/persona.service';
import { Persona } from '../../models/persona';

@Component({
  selector: 'app-personas',
  imports: [RouterLink],
  templateUrl: './personas.component.html',
  styleUrl: './personas.component.css',
})
export class PersonasComponent implements OnInit {
  personas = signal<Persona[]>([]);
  loading = signal(true);

  constructor(private personaService: PersonaService) {}

  async ngOnInit() {
    try {
      this.personas.set(await this.personaService.getAll());
    } finally {
      this.loading.set(false);
    }
  }

  async eliminar(id: number) {
    if (!confirm('¿Eliminar esta persona?')) return;
    await this.personaService.delete(id);
    this.personas.update((ps) => ps.filter((p) => p.identificador !== id));
  }
}
