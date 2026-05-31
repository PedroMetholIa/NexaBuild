import { Component, OnInit, signal } from '@angular/core';
import { FormBuilder, FormArray, FormControl, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { PersonaService } from '../../services/persona.service';

@Component({
  selector: 'app-persona-form',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './persona-form.component.html',
  styleUrl: './persona-form.component.css',
})
export class PersonaFormComponent implements OnInit {
  form!: FormGroup;
  esNueva = signal(true);
  loading = signal(false);
  error = signal('');
  private id?: number;

  constructor(
    private fb: FormBuilder,
    private personaService: PersonaService,
    private route: ActivatedRoute,
    private router: Router,
  ) {}

  ngOnInit() {
    this.form = this.fb.group({
      nombre: ['', Validators.required],
      telefonos: this.fb.array([]),
    });
    this.cargarSiEdicion();
  }

  private async cargarSiEdicion() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.esNueva.set(false);
      this.id = +id;
      const persona = await this.personaService.getById(this.id);
      if (persona) {
        this.form.patchValue({ nombre: persona.nombre });
        (persona.telefonos ?? []).forEach((t) => this.telefonos.push(new FormControl(t)));
      }
    }
  }

  get telefonos(): FormArray {
    return this.form.get('telefonos') as FormArray;
  }

  addTelefono() {
    this.telefonos.push(new FormControl(''));
  }

  removeTelefono(index: number) {
    this.telefonos.removeAt(index);
  }

  async submit() {
    if (this.form.invalid) return;
    this.loading.set(true);
    this.error.set('');
    const { nombre, telefonos } = this.form.value;
    try {
      if (this.esNueva()) {
        await this.personaService.create({ nombre: nombre!, telefonos: telefonos as string[] });
      } else {
        await this.personaService.update(this.id!, { nombre: nombre!, telefonos: telefonos as string[] });
      }
      this.router.navigate(['/personas']);
    } catch (err: any) {
      this.error.set(err?.message ?? 'Ocurrió un error');
    } finally {
      this.loading.set(false);
    }
  }
}
