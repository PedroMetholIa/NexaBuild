import { Component, OnInit, OnDestroy, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { UserActivityService } from '../../services/user-activity.service';
import { AuthService } from '../../services/auth.service';
import { UserActivity } from '../../models/user-activity';

@Component({
  selector: 'app-home',
  imports: [DatePipe],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css',
})
export class HomeComponent implements OnInit, OnDestroy {
  users = signal<UserActivity[]>([]);
  loading = signal(true);
  currentUserId = signal<string | null>(null);
  closing = signal<string | null>(null);

  private refreshInterval?: ReturnType<typeof setInterval>;

  constructor(
    private userActivity: UserActivityService,
    private auth: AuthService
  ) {}

  async ngOnInit() {
    const { data } = await this.auth.getSession();
    this.currentUserId.set(data.session?.user.id ?? null);
    this.load();
    this.refreshInterval = setInterval(() => this.load(), 30_000);
  }

  ngOnDestroy() {
    clearInterval(this.refreshInterval);
  }

  async load() {
    const { data } = await this.userActivity.getAll();
    this.users.set(data ?? []);
    this.loading.set(false);
  }

  async forceLogout(userId: string) {
    this.closing.set(userId);
    // Intenta actualizar la DB (puede fallar por RLS si el admin no tiene permiso sobre filas ajenas)
    await this.userActivity.setOffline(userId);
    // Envía la señal por WebSocket: el usuario la recibe, hace su propio signOut()
    // y actualiza su propia fila sin restricciones de RLS
    await this.userActivity.broadcastForceLogout(userId);
    this.users.update((list) =>
      list.map((u) => (u.user_id === userId ? { ...u, is_online: false } : u))
    );
    this.closing.set(null);
  }

  get onlineCount() {
    return this.users().filter((u) => u.is_online).length;
  }
}
