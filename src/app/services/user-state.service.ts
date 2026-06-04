import { Injectable, signal } from '@angular/core';
import { AuthService } from './auth.service';
import { SuscripcionService } from './suscripcion.service';
import { UsuarioService } from './usuario.service';

const NAME_KEY  = 'nx_user_name';
const ADMIN_KEY = 'nx_user_admin';

@Injectable({ providedIn: 'root' })
export class UserStateService {
  private readonly _userId   = signal<string | null>(null);
  private readonly _userName = signal(sessionStorage.getItem(NAME_KEY) ?? '');
  private readonly _isAdmin  = signal(sessionStorage.getItem(ADMIN_KEY) === 'true');
  private readonly _subs     = signal<string[]>([]);

  readonly userId            = this._userId.asReadonly();
  readonly userName          = this._userName.asReadonly();
  readonly isAdmin           = this._isAdmin.asReadonly();
  readonly misSubscripciones = this._subs.asReadonly();

  constructor(
    private auth: AuthService,
    private suscripcionSvc: SuscripcionService,
    private usuarioSvc: UsuarioService,
  ) {
    this._init();
  }

  private async _init() {
    const { data } = await this.auth.getSession();
    if (data.session) await this._cargar(data.session.user.id);

    this.auth.onAuthChange(async (_event, session) => {
      if (session) {
        await this._cargar(session.user.id);
      } else {
        this._userId.set(null);
        this._userName.set('');
        this._isAdmin.set(false);
        this._subs.set([]);
        sessionStorage.removeItem(NAME_KEY);
        sessionStorage.removeItem(ADMIN_KEY);
      }
    });
  }

  private async _cargar(userId: string) {
    this._userId.set(userId);
    const [perfil, subs] = await Promise.all([
      this.usuarioSvc.getByUserId(userId),
      this.suscripcionSvc.getByUsuario(userId),
    ]);
    if (perfil.data) {
      const name = `${perfil.data.nombre} ${perfil.data.apellido}`;
      this._userName.set(name);
      this._isAdmin.set(perfil.data.administrador ?? false);
      sessionStorage.setItem(NAME_KEY, name);
      sessionStorage.setItem(ADMIN_KEY, String(perfil.data.administrador ?? false));
    }
    this._subs.set((subs.data ?? []).map((s: any) => s.id_producto));
  }

  agregar(idProducto: string) {
    this._subs.update(ids => [...ids, idProducto]);
  }
}
