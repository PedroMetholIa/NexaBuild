import { Component, OnInit, OnDestroy, signal } from '@angular/core';
import { RouterOutlet, Router } from '@angular/router';
import { AuthService } from './services/auth.service';
import { UserActivityService } from './services/user-activity.service';
import { UsuarioService } from './services/usuario.service';
import { Session, RealtimeChannel } from '@supabase/supabase-js';

const USER_NAME_KEY = 'nx_user_name';
const USER_ADMIN_KEY = 'nx_user_admin';
const HEARTBEAT_MS = 5 * 60 * 1000;
const INACTIVITY_MS = 30 * 60 * 1000;
const INACTIVITY_CHECK_MS = 60_000;

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App implements OnInit, OnDestroy {
  session = signal<Session | null>(null);
  isAdmin = signal(false);
  userName = signal(sessionStorage.getItem(USER_NAME_KEY) ?? '');

  private heartbeatInterval?: ReturnType<typeof setInterval>;
  private inactivityInterval?: ReturnType<typeof setInterval>;
  private realtimeChannel?: RealtimeChannel;
  private lastActivity = Date.now();
  private readonly activityHandler = () => { this.lastActivity = Date.now(); };

  constructor(
    private auth: AuthService,
    private userActivity: UserActivityService,
    private usuarioService: UsuarioService,
    readonly router: Router
  ) {}

  async ngOnInit() {
    const { data: { session: initial } } = await this.auth.getSession();
    if (initial) {
      this.session.set(initial);
      await this.loadUserProfile(initial.user.id);
      this.startMonitoring(initial.user.id);
    }

    this.auth.onAuthChange(async (event, session) => {
      this.session.set(session);
      if (session && event === 'SIGNED_IN') {
        await this.loadUserProfile(session.user.id);
        this.startMonitoring(session.user.id);
      } else if (!session && event !== 'INITIAL_SESSION') {
        this.stopMonitoring();
        this.isAdmin.set(false);
        this.userName.set('');
        sessionStorage.removeItem(USER_NAME_KEY);
        sessionStorage.removeItem(USER_ADMIN_KEY);
        this.router.navigate(['/']);
      }
    });
  }

  ngOnDestroy() {
    this.stopMonitoring();
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

  private startMonitoring(userId: string) {
    this.stopMonitoring();

    this.heartbeatInterval = setInterval(
      () => this.userActivity.updateLastSeen(userId),
      HEARTBEAT_MS
    );

    this.lastActivity = Date.now();
    const events: (keyof WindowEventMap)[] = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    events.forEach(e => window.addEventListener(e, this.activityHandler, { passive: true }));
    this.inactivityInterval = setInterval(() => {
      if (Date.now() - this.lastActivity > INACTIVITY_MS) {
        this.logout();
      }
    }, INACTIVITY_CHECK_MS);

    this.realtimeChannel = this.userActivity.subscribeToStatus(userId, () => this.logout());
  }

  private stopMonitoring() {
    clearInterval(this.heartbeatInterval);
    clearInterval(this.inactivityInterval);
    this.realtimeChannel?.unsubscribe();
    this.realtimeChannel = undefined;
    const events: (keyof WindowEventMap)[] = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    events.forEach(e => window.removeEventListener(e, this.activityHandler));
  }

  async logout() {
    this.stopMonitoring();
    try {
      const { data } = await this.auth.getSession();
      if (data.session?.user) {
        await this.userActivity.setOffline(data.session.user.id);
      }
    } catch {
      // ignorar errores al marcar offline
    }
    await this.auth.signOut();
    this.session.set(null);
    this.isAdmin.set(false);
    this.userName.set('');
    sessionStorage.removeItem(USER_NAME_KEY);
    sessionStorage.removeItem(USER_ADMIN_KEY);
    this.router.navigate(['/']);
  }
}
