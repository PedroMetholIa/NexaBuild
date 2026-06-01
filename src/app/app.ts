import { Component, OnInit, signal } from '@angular/core';
import { RouterOutlet, Router } from '@angular/router';
import { AuthService } from './services/auth.service';
import { UserActivityService } from './services/user-activity.service';
import { UsuarioService } from './services/usuario.service';
import { Session } from '@supabase/supabase-js';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App implements OnInit {
  session = signal<Session | null>(null);
  isAdmin = signal(false);

  constructor(
    private auth: AuthService,
    private userActivity: UserActivityService,
    private usuarioService: UsuarioService,
    readonly router: Router
  ) {}

  ngOnInit() {
    this.auth.getSession().then(async ({ data }) => {
      this.session.set(data.session);
      if (data.session) await this.loadAdminStatus(data.session.user.id);
    });

    this.auth.onAuthChange(async (_, session) => {
      this.session.set(session);
      if (session) {
        await this.loadAdminStatus(session.user.id);
      } else {
        this.isAdmin.set(false);
        this.router.navigate(['/auth']);
      }
    });
  }

  private async loadAdminStatus(userId: string) {
    const { data } = await this.usuarioService.getByUserId(userId);
    this.isAdmin.set(data?.administrador ?? false);
  }

  async logout() {
    const { data } = await this.auth.getSession();
    if (data.session?.user) {
      await this.userActivity.setOffline(data.session.user.id);
    }
    await this.auth.signOut();
  }
}
