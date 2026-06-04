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
  loading        = signal(true);
  loadingSubs    = signal(false);
  saving         = signal(false);
  showForm       = signal(false);
  deletingId     = signal<number | null>(null);
  joiningId      = signal<number | null>(null);
  comenzandoId   = signal<number | null>(null);
  showStartModal = signal(false);
  startError     = signal('');
  error          = signal('');
  showClave      = signal(false);

  private readonly ONLINE_THRESHOLD_MS = 20 * 60 * 1000;

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

  private refreshInterval?: ReturnType<typeof setInterval>;
  private partidaChannel?: RealtimeChannel;
  private activityChannel?: RealtimeChannel;

  constructor(private partidaSvc: PartidaService) {}

  async ngOnInit() {
    // Suscripciones PRIMERO para no perder eventos durante la carga inicial
    this.partidaChannel = this.partidaSvc.subscribeToUpdates((updated) => {
      this.partidas.update(list =>
        list.map(p => p.idPartida === updated.idPartida ? { ...p, ...updated } : p)
      );
    });

    this.activityChannel = this.activitySvc.subscribeToActivityUpdates((updated) => {
      const online = updated.is_online &&
        Date.now() - new Date(updated.last_seen).getTime() < this.ONLINE_THRESHOLD_MS;

      this.onlineUserIds.update(ids => {
        const next = new Set(ids);
        if (online) next.add(updated.user_id);
        else        next.delete(updated.user_id);
        return next;
      });
    });

    await Promise.all([this.load(), this.loadSuscriptores()]);

    this.refreshInterval = setInterval(() => {
      this.load();
      this.loadSuscriptores();
    }, 30_000);
  }

  ngOnDestroy() {
    clearInterval(this.refreshInterval);
    this.partidaChannel?.unsubscribe();
    this.activityChannel?.unsubscribe();
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
    this.loadingSubs.set(true);
    try {
      // Las dos consultas corren en paralelo; si activity falla no bloquea a subs
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
      const activeIds = activityData
        .filter(a => a.is_online && Date.now() - new Date(a.last_seen).getTime() < this.ONLINE_THRESHOLD_MS)
        .map(a => a.user_id);
      const currentId = this.userState.userId();
      if (currentId) activeIds.push(currentId);
      this.onlineUserIds.set(new Set<string>(activeIds));
    } catch {
      // error inesperado — no modificar estado previo
    } finally {
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

  async crear() {
    if (!this.form.ClavePartida.trim()) {
      this.error.set('La clave de partida es requerida.');
      return;
    }
    this.saving.set(true);
    this.error.set('');
    try {
      const { data, error } = await this.partidaSvc.create({
        idProducto:      this.form.idProducto.trim(),
        NombrePartida:   this.form.NombrePartida.trim() || null,
        ClavePartida:    this.form.ClavePartida.trim() || null,
        LimiteJugadores: this.form.LimiteJugadores,
        PartidaActiva:   this.form.PartidaActiva,
        HostPartida:     this.userState.userId(),
      });
      if (error) throw error;
      const partida = data as unknown as Partida;
      const { error: jugadorError } = await this.partidaSvc.addJugador(partida.idPartida, this.userState.userId()!);
      if (jugadorError) throw jugadorError;
      this.partidas.update(list => [{ ...partida, JugadoresRegistrados: 1 }, ...list]);
      this.showForm.set(false);
    } catch (err: any) {
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
      this.showStartModal.set(true);
    } catch (err: any) {
      this.startError.set(err?.message ?? JSON.stringify(err) ?? 'Error desconocido al iniciar la partida.');
    } finally {
      this.comenzandoId.set(null);
    }
  }

  async unirse(p: Partida) {
    this.joiningId.set(p.idPartida);
    const { error } = await this.partidaSvc.addJugador(p.idPartida, this.userState.userId()!);
    if (!error) {
      this.partidas.update(list =>
        list.map(x => x.idPartida === p.idPartida
          ? { ...x, JugadoresRegistrados: (x.JugadoresRegistrados ?? 0) + 1 }
          : x
        )
      );
    }
    this.joiningId.set(null);
  }

  async eliminar(p: Partida) {
    this.deletingId.set(p.idPartida);
    await this.partidaSvc.delete(p.idPartida);
    this.partidas.update(list => list.filter(x => x.idPartida !== p.idPartida));
    this.deletingId.set(null);
  }
}
