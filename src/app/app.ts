import { Component, OnInit, signal } from '@angular/core';
import { RouterOutlet, Router } from '@angular/router';
import { AuthService } from './services/auth.service';
import { UserActivityService } from './services/user-activity.service';
import { UsuarioService } from './services/usuario.service';
import { Session } from '@supabase/supabase-js';

const USER_NAME_KEY = 'nx_user_name';
const USER_ADMIN_KEY = 'nx_user_admin';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App implements OnInit {
  session = signal<Session | null>(null);
  isAdmin = signal(false);
  userName = signal(sessionStorage.getItem(USER_NAME_KEY) ?? '');

  constructor(
    private auth: AuthService,
    private userActivity: UserActivityService,
    private usuarioService: UsuarioService,
    readonly router: Router
  ) {}

  ngOnInit() {
    this.auth.getSession().then(async ({ data }) => {
      this.session.set(data.session);
      if (data.session) await this.loadUserProfile(data.session.user.id);
    });

    this.auth.onAuthChange(async (_, session) => {
      this.session.set(session);
      if (session) {
        await this.loadUserProfile(session.user.id);
      } else {
        this.isAdmin.set(false);
        this.userName.set('');
        sessionStorage.removeItem(USER_NAME_KEY);
        sessionStorage.removeItem(USER_ADMIN_KEY);
        this.router.navigate(['/auth']);
      }
    });
  }

  private async loadUserProfile(userId: string) {
    const { data } = await this.usuarioService.getByUserId(userId);
    const name = data ? `${data.nombre} ${data.apellido}` : '';
    const admin = data?.administrador ?? false;
    this.userName.set(name);
    this.isAdmin.set(admin);
    sessionStorage.setItem(USER_NAME_KEY, name);
    sessionStorage.setItem(USER_ADMIN_KEY, String(admin));
  }

  async logout() {
    const { data } = await this.auth.getSession();
    if (data.session?.user) {
      await this.userActivity.setOffline(data.session.user.id);
    }
    await this.auth.signOut();
  }
}
