import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class AuthModalService {
  private readonly _solicitado = signal(false);
  readonly solicitado = this._solicitado.asReadonly();

  solicitar() { this._solicitado.set(true); }
  limpiar()   { this._solicitado.set(false); }
}
