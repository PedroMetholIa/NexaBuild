import { Component, OnInit, OnDestroy, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AuthService } from './services/auth.service';
import { UserActivityService } from './services/user-activity.service';
import { UserStateService } from './services/user-state.service';
import { RealtimeChannel } from '@supabase/supabase-js';

const HEARTBEAT_MS        =  5 * 60 * 1000;
const INACTIVITY_MS       = 60 * 60 * 1000;
const INACTIVITY_CHECK_MS = 20 * 60 * 1000;
const ACTIVITY_THROTTLE_MS =      60 * 1000;
const PROACTIVE_REFRESH_MS = 45 * 60 * 1000; // refresca JWT 45 min antes de que expire
const DOM_EVENTS: (keyof WindowEventMap)[] = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App implements OnInit, OnDestroy {
  showSessionExpiredModal = signal(false);

  private heartbeatInterval?: ReturnType<typeof setInterval>;
  private inactivityInterval?: ReturnType<typeof setInterval>;
  private refreshInterval?:    ReturnType<typeof setInterval>;
  private realtimeChannel?: RealtimeChannel;
  private lastActivity    = Date.now();
  private lastSeenWritten = 0;
  private activeUserId: string | null = null;

  private readonly activityHandler = () => {
    this.lastActivity = Date.now();
    if (this.activeUserId && Date.now() - this.lastSeenWritten > ACTIVITY_THROTTLE_MS) {
      this.lastSeenWritten = Date.now();
      this.userActivity.updateLastSeen(this.activeUserId);
    }
  };

  constructor(
    private auth: AuthService,
    private userActivity: UserActivityService,
    _userState: UserStateService,   // inicialización temprana del singleton
  ) {}

  async ngOnInit() {
    const { data: { session: initial } } = await this.auth.getSession();
    if (initial) this.startMonitoring(initial.user.id);

    this.auth.onAuthChange(async (event, session) => {
      if (session && event === 'SIGNED_IN') {
        this.startMonitoring(session.user.id);
      } else if (!session && event !== 'INITIAL_SESSION') {
        if (this.showSessionExpiredModal()) return;
        this.stopMonitoring();
        window.location.href = '/';
      }
    });
  }

  ngOnDestroy() { this.stopMonitoring(); }

  private startMonitoring(userId: string) {
    this.stopMonitoring();
    this.activeUserId = userId;
    this.userActivity.updateLastSeen(userId);
    this.lastActivity    = Date.now();
    this.lastSeenWritten = Date.now();

    this.heartbeatInterval = setInterval(() => {
      if (Date.now() - this.lastActivity < INACTIVITY_MS) {
        this.lastSeenWritten = Date.now();
        this.userActivity.updateLastSeen(userId);
      }
    }, HEARTBEAT_MS);

    this.inactivityInterval = setInterval(() => {
      if (Date.now() - this.lastActivity > INACTIVITY_MS) {
        this.doLogout(true);
      }
    }, INACTIVITY_CHECK_MS);

    this.refreshInterval = setInterval(async () => {
      const { error } = await this.auth.refreshSession();
      if (error) {
        // Si el refresh falla proactivamente es señal de sesión inválida → logout limpio
        console.warn('[proactive-refresh] falló:', error.message);
        this.doLogout(true);
      }
    }, PROACTIVE_REFRESH_MS);

    DOM_EVENTS.forEach(e => window.addEventListener(e, this.activityHandler, { passive: true }));
    this.realtimeChannel = this.userActivity.subscribeToStatus(userId, () => this.doLogout(true));
  }

  private stopMonitoring() {
    this.activeUserId = null;
    clearInterval(this.heartbeatInterval);
    clearInterval(this.inactivityInterval);
    clearInterval(this.refreshInterval);
    this.realtimeChannel?.unsubscribe();
    this.realtimeChannel = undefined;
    DOM_EVENTS.forEach(e => window.removeEventListener(e, this.activityHandler));
  }

  private async doLogout(expired: boolean) {
    this.stopMonitoring();
    try {
      const { data } = await this.auth.getSession();
      if (data.session?.user) await this.userActivity.setOffline(data.session.user.id);
    } catch { /* ignorar */ }
    await this.auth.signOut();
    if (expired) {
      this.showSessionExpiredModal.set(true);
    } else {
      window.location.href = '/';
    }
  }

  async logout() { await this.doLogout(false); }
  closeSessionModal() { window.location.href = '/'; }
}
