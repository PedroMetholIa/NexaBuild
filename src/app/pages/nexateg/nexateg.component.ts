import { Component, OnInit, OnDestroy, signal, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { RealtimeChannel } from '@supabase/supabase-js';
import { PartidaService } from '../../services/partida.service';
import { SuscripcionService } from '../../services/suscripcion.service';
import { UserStateService } from '../../services/user-state.service';
import { UserActivityService } from '../../services/user-activity.service';
import { Partida } from '../../models/partida';
import { Suscripcion } from '../../models/suscripcion';
import { UserActivity } from '../../models/user-activity';

@Component({
  selector: 'app-nexateg',
  imports: [FormsModule, DatePipe],
  templateUrl: './nexateg.component.html',
  styleUrl: './nexateg.component.css',
})
export class NexaTegComponent implements OnInit, OnDestroy {
  partidas       = signal<Partida[]>([]);
  suscriptores   = signal<Suscripcion[]>([]);
  onlineUserIds  = signal<Set<string>>(new Set());
  lastSeenMap    = signal<Map<string, string>>(new Map());
  loading        = signal(true);
  loadingSubs    = signal(false);
  private subsInFlight = false;
  saving         = signal(false);
  showForm       = signal(false);
  deletingId     = signal<number | null>(null);
  deleteError    = signal('');
  joiningId      = signal<number | null>(null);
  joinError      = signal('');
  comenzandoId   = signal<number | null>(null);
  showStartModal = signal(false);
  startError     = signal('');
  error          = signal('');
  showClave      = signal(false);


  private readonly userState      = inject(UserStateService);
  private readonly suscripcionSvc = inject(SuscripcionService);
  private readonly activitySvc    = inject(UserActivityService);

  form = {
    idProducto:      'NexaTeg',
    NombrePartida:   '',
    ClavePartida:    '',
    LimiteJugadores: 2,
    PartidaActiva:   false,
  };

  gameStarted    = signal(false);
  gamePartidaId  = signal<number | null>(null);

  private refreshInterval?: ReturnType<typeof setInterval>;
  private initTimeout?: ReturnType<typeof setTimeout>;
  private partidaChannel?: RealtimeChannel;
  private activityChannel?: RealtimeChannel;
  private jugadorChannel?: RealtimeChannel;

  constructor(private partidaSvc: PartidaService) {}

  async ngOnInit() {
    // Suscripciones PRIMERO para no perder eventos durante la carga inicial
    this.partidaChannel = this.partidaSvc.subscribeToPartidaChanges(
      () => this.load(),
      (updated) => this.partidas.update(list =>
        list.map(p => p.idPartida === updated.idPartida ? { ...p, ...updated } : p)
      ),
      (idPartida) => this.partidas.update(list =>
        list.filter(p => p.idPartida !== idPartida)
      ),
    );

    this.activityChannel = this.activitySvc.subscribeToActivityUpdates((updated) => {
      const ONE_HOUR_MS = 60 * 60 * 1000;
      const recentlyActive = updated.is_online &&
        Date.now() - new Date(updated.last_seen).getTime() < ONE_HOUR_MS;
      this.onlineUserIds.update(ids => {
        const next = new Set(ids);
        if (recentlyActive) next.add(updated.user_id);
        else                next.delete(updated.user_id);
        return next;
      });
      this.lastSeenMap.update(m => {
        const next = new Map(m);
        next.set(updated.user_id, updated.last_seen);
        return next;
      });
    });

    const userId = this.userState.userId();
    if (userId) {
      this.jugadorChannel = this.partidaSvc.subscribeToJugadorGame(userId, (idPartida) => {
        this.gamePartidaId.set(idPartida);
        this.gameStarted.set(true);
      });
    }

    await Promise.all([this.load(), this.loadSuscriptores()]);

    // Segundo fetch a los 3 seg: captura updateLastSeen de otros jugadores
    // que completaron después del setup del WebSocket Realtime.
    this.initTimeout = setTimeout(() => this.loadSuscriptores(), 3000);

    this.refreshInterval = setInterval(() => {
      this.load();
      this.loadSuscriptores();
    }, 30_000);
  }

  ngOnDestroy() {
    clearTimeout(this.initTimeout);
    clearInterval(this.refreshInterval);
    this.partidaChannel?.unsubscribe();
    this.activityChannel?.unsubscribe();
    this.jugadorChannel?.unsubscribe();
  }

  abrirJuego() {
    window.open(`/nexateg/game?partida=${this.gamePartidaId()}`, '_blank');
    this.gameStarted.set(false);
  }

  async load() {
    try {
      const { data } = await this.partidaSvc.getAll();
      this.partidas.set((data as unknown as Partida[]) ?? []);
    } catch {
      // mantener datos previos ante error de red
    } finally {
      this.loading.set(false);
    }
  }

  async loadSuscriptores() {
    if (this.subsInFlight) return;
    this.subsInFlight = true;
    this.loadingSubs.set(true);
    // Capa 2: si las promesas nunca resuelven, desbloquea la UI a los 14s
    const safetyTimer = setTimeout(() => {
      this.loadingSubs.set(false);
      this.subsInFlight = false;
    }, 22_000);
    try {
      const [subsResult, activityResult] = await Promise.allSettled([
        this.suscripcionSvc.getByProducto('NexaTeg'),
        this.activitySvc.getAll(),
      ]);

      if (subsResult.status === 'fulfilled' && !subsResult.value.error) {
        this.suscriptores.set((subsResult.value.data as Suscripcion[]) ?? []);
      }

      const activityData: UserActivity[] =
        activityResult.status === 'fulfilled'
          ? ((activityResult.value.data ?? []) as UserActivity[])
          : [];
      const ONE_HOUR_MS = 60 * 60 * 1000;
      const activeIds = activityData
        .filter(a => a.is_online && Date.now() - new Date(a.last_seen).getTime() < ONE_HOUR_MS)
        .map(a => a.user_id);
      const currentId = this.userState.userId();
      if (currentId) activeIds.push(currentId);
      this.onlineUserIds.set(new Set<string>(activeIds));

      this.lastSeenMap.set(new Map(activityData.map(a => [a.user_id, a.last_seen])));
    } catch {
      // error inesperado — no modificar estado previo
    } finally {
      clearTimeout(safetyTimer);
      this.subsInFlight = false;
      this.loadingSubs.set(false);
    }
  }

  isOnline(userId: string): boolean {
    return this.onlineUserIds().has(userId);
  }

  get misPartidas() {
    return this.partidas().filter(p => p.HostPartida === this.userState.userId());
  }

  get otrasPartidas() {
    return this.partidas().filter(p => p.HostPartida !== this.userState.userId());
  }

  get activeSuscriptoresCount() {
    return this.suscriptores().filter(s => this.isOnline(s.id_usuario)).length;
  }

  abrirForm() {
    this.form = { idProducto: 'NexaTeg', NombrePartida: '', ClavePartida: '', LimiteJugadores: 2, PartidaActiva: false };
    this.error.set('');
    this.showClave.set(false);
    this.showForm.set(true);
  }

  cancelar() { this.showForm.set(false); }
  recargar()  { window.location.reload(); }

  private withTimeout<T>(promise: PromiseLike<T>, ms = 8000): Promise<T> {
    return Promise.race([
      Promise.resolve(promise),
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error('La operación tardó demasiado. Verificá tu conexión e intentá de nuevo.')), ms)
      ),
    ]);
  }

  async crear() {
    if (!this.form.ClavePartida.trim()) {
      this.error.set('La clave de partida es requerida.');
      return;
    }
    this.saving.set(true);
    this.error.set('');
    try {
      const nombre = this.form.NombrePartida.trim() || null;
      const clave  = this.form.ClavePartida.trim();
      const limite = this.form.LimiteJugadores;

      console.log('[crear] llamando RPC crear_partida_completa...');
      const { data, error } = await this.withTimeout(
        this.partidaSvc.crearCompleta(nombre, clave, limite) as unknown as Promise<any>
      );
      console.log('[crear] RPC completo — error:', error, 'data:', data);
      if (error) throw error;

      const raw = data as {
        idPartida: number;
        NombrePartida: string | null;
        ClavePartida: string | null;
        LimiteJugadores: number;
        PartidaActiva: boolean;
        HostPartida: string;
        JugadoresRegistrados: number;
      };
      const partida: Partida = {
        idPartida:           raw.idPartida,
        idProducto:          this.form.idProducto.trim(),
        NombrePartida:       raw.NombrePartida ?? null,
        ClavePartida:        raw.ClavePartida ?? null,
        LimiteJugadores:     raw.LimiteJugadores,
        PartidaActiva:       raw.PartidaActiva,
        HostPartida:         raw.HostPartida,
        JugadoresRegistrados: raw.JugadoresRegistrados,
      };
      this.partidas.update(list => [partida, ...list]);
      this.showForm.set(false);
    } catch (err: any) {
      console.error('[crear] catch:', err);
      this.error.set(err.message ?? 'Error al crear la partida.');
    } finally {
      this.saving.set(false);
    }
  }

  async comenzar(p: Partida) {
    this.comenzandoId.set(p.idPartida);
    this.startError.set('');
    try {
      const { error } = await this.partidaSvc.comenzarPartida(p.idPartida);
      if (error) throw error;
      window.open(`/nexateg/game?partida=${p.idPartida}`, '_blank');
    } catch (err: any) {
      this.startError.set(err?.message ?? JSON.stringify(err) ?? 'Error desconocido al iniciar la partida.');
    } finally {
      this.comenzandoId.set(null);
    }
  }

  async unirse(p: Partida) {
    this.joiningId.set(p.idPartida);
    this.joinError.set('');
    try {
      console.log('[unirse] llamando RPC unirse_a_partida para partida', p.idPartida);
      const { error } = await this.withTimeout(
        this.partidaSvc.unirseConRpc(p.idPartida) as unknown as Promise<any>
      );
      console.log('[unirse] resultado:', error);
      if (error) throw error;
      this.partidas.update(list =>
        list.map(x => x.idPartida === p.idPartida
          ? { ...x, JugadoresRegistrados: (x.JugadoresRegistrados ?? 0) + 1 }
          : x
        )
      );
    } catch (err: any) {
      console.error('[unirse] catch:', err);
      this.joinError.set(err?.message ?? 'Error al unirse a la partida.');
    } finally {
      this.joiningId.set(null);
    }
  }

  async eliminar(p: Partida) {
    this.deletingId.set(p.idPartida);
    this.deleteError.set('');
    try {
      console.log('[eliminar] llamando RPC eliminar_partida para partida', p.idPartida);
      const { error } = await this.withTimeout(
        this.partidaSvc.eliminarConRpc(p.idPartida) as unknown as Promise<any>
      );
      console.log('[eliminar] RPC completo, error:', error);
      if (error) throw error;

      this.partidas.update(list => list.filter(x => x.idPartida !== p.idPartida));
    } catch (err: any) {
      const msg = err?.message ?? 'Error al eliminar la partida.';
      console.error('[eliminar] catch:', err);
      this.deleteError.set(msg);
    } finally {
      this.deletingId.set(null);
    }
  }
}
