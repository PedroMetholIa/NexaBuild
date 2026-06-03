import { Component, OnInit, OnDestroy, signal, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { PartidaService } from '../../services/partida.service';
import { SuscripcionService } from '../../services/suscripcion.service';
import { UserStateService } from '../../services/user-state.service';
import { UserActivityService } from '../../services/user-activity.service';
import { Partida } from '../../models/partida';
import { Suscripcion } from '../../models/suscripcion';

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
  saving        = signal(false);
  showForm      = signal(false);
  deletingId    = signal<number | null>(null);
  togglingId    = signal<number | null>(null);
  error         = signal('');
  showClave     = signal(false);

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

  constructor(private partidaSvc: PartidaService) {}

  async ngOnInit() {
    await Promise.all([this.load(), this.loadSuscriptores()]);
    this.refreshInterval = setInterval(() => {
      this.load();
      this.loadSuscriptores();
    }, 30_000);
  }

  ngOnDestroy() { clearInterval(this.refreshInterval); }

  async load() {
    const { data } = await this.partidaSvc.getAll();
    this.partidas.set((data as Partida[]) ?? []);
    this.loading.set(false);
  }

  async loadSuscriptores() {
    this.loadingSubs.set(true);
    const [{ data: subs }, { data: activity }] = await Promise.all([
      this.suscripcionSvc.getByProducto('NexaTeg'),
      this.activitySvc.getAll(),
    ]);
    this.suscriptores.set((subs as Suscripcion[]) ?? []);
    const online = new Set<string>(
      ((activity ?? []) as any[]).filter(a => a.is_online).map(a => a.user_id)
    );
    this.onlineUserIds.set(online);
    this.loadingSubs.set(false);
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

  get activasCount() {
    return this.partidas().filter(p => p.PartidaActiva).length;
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
      this.partidas.update(list => [data as Partida, ...list]);
      this.showForm.set(false);
    } catch (err: any) {
      this.error.set(err.message ?? 'Error al crear la partida.');
    } finally {
      this.saving.set(false);
    }
  }

  async toggleActiva(p: Partida) {
    this.togglingId.set(p.idPartida);
    const nuevoEstado = !p.PartidaActiva;
    await this.partidaSvc.toggleActiva(p.idPartida, nuevoEstado);
    this.partidas.update(list =>
      list.map(x => x.idPartida === p.idPartida ? { ...x, PartidaActiva: nuevoEstado } : x)
    );
    this.togglingId.set(null);
  }

  async eliminar(p: Partida) {
    this.deletingId.set(p.idPartida);
    await this.partidaSvc.delete(p.idPartida);
    this.partidas.update(list => list.filter(x => x.idPartida !== p.idPartida));
    this.deletingId.set(null);
  }
}
