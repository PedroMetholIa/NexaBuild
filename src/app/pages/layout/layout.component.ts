import { Component, OnInit, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { UsuarioService } from '../../services/usuario.service';
import { UserActivityService } from '../../services/user-activity.service';
import { AuthComponent } from '../auth/auth.component';

@Component({
  selector: 'app-layout',
  imports: [RouterOutlet, AuthComponent],
  templateUrl: './layout.component.html',
  styleUrl: './layout.component.css',
})
export class LayoutComponent implements OnInit {
  isLoggedIn = signal(false);
  userName = signal('');
  modalOpen = signal(false);
  modalRegister = signal(false);

  constructor(
    private auth: AuthService,
    private usuarioService: UsuarioService,
    private userActivity: UserActivityService
  ) {}

  async ngOnInit() {
    this.auth.onAuthChange(async (event, session) => {
      if (session && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION')) {
        const { data } = await this.usuarioService.getByUserId(session.user.id);
        this.userName.set(data ? `${data.nombre} ${data.apellido}` : '');
        this.isLoggedIn.set(true);
        if (event === 'SIGNED_IN') this.modalOpen.set(false);
      } else if (!session && event !== 'INITIAL_SESSION') {
        this.isLoggedIn.set(false);
        this.userName.set('');
      }
    });
  }

  openModal(register: boolean) {
    this.modalRegister.set(register);
    this.modalOpen.set(true);
  }

  closeModal() {
    this.modalOpen.set(false);
  }

  async logout() {
    try {
      const { data } = await this.auth.getSession();
      if (data.session?.user) {
        await this.userActivity.setOffline(data.session.user.id);
      }
    } catch { /* ignorar */ }
    await this.auth.signOut();
  }
}
