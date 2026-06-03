import { Injectable, signal } from '@angular/core';
import { AuthService } from './auth.service';
import { SuscripcionService } from './suscripcion.service';

@Injectable({ providedIn: 'root' })
export class UserStateService {
  private readonly _userId = signal<string | null>(null);
  private readonly _subs   = signal<string[]>([]);

  readonly userId            = this._userId.asReadonly();
  readonly misSubscripciones = this._subs.asReadonly();

  constructor(
    private auth: AuthService,
    private suscripcionSvc: SuscripcionService
  ) {
    this._init();
  }

  private async _init() {
    // Carga inmediata desde sesión en cache
    const { data } = await this.auth.getSession();
    if (data.session) await this._cargar(data.session.user.id);

    // Mantiene sincronía con cualquier evento de auth posterior
    // (SIGNED_IN, TOKEN_REFRESHED, SIGNED_OUT, INITIAL_SESSION)
    this.auth.onAuthChange(async (_event, session) => {
      if (session) {
        await this._cargar(session.user.id);
      } else {
        this._userId.set(null);
        this._subs.set([]);
      }
    });
  }

  private async _cargar(userId: string) {
    this._userId.set(userId);
    const { data } = await this.suscripcionSvc.getByUsuario(userId);
    this._subs.set((data ?? []).map((s: any) => s.id_producto));
  }

  agregar(idProducto: string) {
    this._subs.update(ids => [...ids, idProducto]);
  }
}
