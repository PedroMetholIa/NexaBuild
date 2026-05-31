import { Component, signal } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

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

  constructor(private fb: FormBuilder, private auth: AuthService, private router: Router) {
    this.form = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
    });
  }

  toggle(e: Event) {
    e.preventDefault();
    this.isLogin.update((v) => !v);
    this.error.set('');
  }

  async submit() {
    if (this.form.invalid) return;
    this.loading.set(true);
    this.error.set('');
    const { email, password } = this.form.value;
    try {
      if (this.isLogin()) {
        const { error } = await this.auth.signIn(email, password);
        if (error) throw error;
      } else {
        const { error } = await this.auth.signUp(email, password);
        if (error) throw error;
      }
      this.router.navigate(['/personas']);
    } catch (err: any) {
      this.error.set(err.message ?? 'Ocurrió un error');
    } finally {
      this.loading.set(false);
    }
  }
}
