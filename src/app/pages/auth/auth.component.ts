import { Component, signal } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { UserActivityService } from '../../services/user-activity.service';
import { UsuarioService } from '../../services/usuario.service';

@Component({
  selector: 'app-auth',
  imports: [ReactiveFormsModule],
  templateUrl: './auth.component.html',
  styleUrl: './auth.component.css',
})
export class AuthComponent {
  form: FormGroup;
  isLogin = signal(true);
  loading = signal(false);
  error = signal('');
  passwordMismatch = signal(false);

  constructor(
    private fb: FormBuilder,
    private auth: AuthService,
    private userActivity: UserActivityService,
    private usuarioService: UsuarioService,
    private router: Router
  ) {
    this.form = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: [''],
      nombre: [''],
      apellido: [''],
    });
  }

  toggle(e: Event) {
    e.preventDefault();
    this.isLogin.update((v) => !v);
    this.error.set('');
    this.passwordMismatch.set(false);
    this.form.reset();
  }

  async submit() {
    const { email, password, confirmPassword, nombre, apellido } = this.form.value;

    if (this.form.get('email')?.invalid || this.form.get('password')?.invalid) return;

    if (!this.isLogin()) {
      if (password !== confirmPassword) {
        this.passwordMismatch.set(true);
        return;
      }
      if (!nombre?.trim() || !apellido?.trim()) {
        this.error.set('Nombre y apellido son requeridos');
        return;
      }
    }

    this.loading.set(true);
    this.error.set('');
    this.passwordMismatch.set(false);

    try {
      if (this.isLogin()) {
        const { data, error } = await this.auth.signIn(email, password);
        if (error) throw error;
        if (data.user) {
          const { error: errActivity } = await this.userActivity.upsertLogin(data.user.id, email);
          if (errActivity) throw errActivity;
        }
      } else {
        const { data, error } = await this.auth.signUp(email, password);
        if (error) throw error;
        if (data.user) {
          const { error: errUsuario } = await this.usuarioService.create(data.user.id, email, nombre.trim(), apellido.trim());
          if (errUsuario) throw errUsuario;
          const { error: errActivity } = await this.userActivity.upsertLogin(data.user.id, email);
          if (errActivity) throw errActivity;
        }
      }
      this.router.navigate(['/home']);
    } catch (err: any) {
      this.error.set(err.message ?? 'Ocurrió un error');
    } finally {
      this.loading.set(false);
    }
  }
}
