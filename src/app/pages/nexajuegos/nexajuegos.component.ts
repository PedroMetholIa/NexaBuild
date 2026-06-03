import { Component, OnInit, signal, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ProductoService } from '../../services/producto.service';
import { SuscripcionService } from '../../services/suscripcion.service';
import { UserStateService } from '../../services/user-state.service';
import { AuthModalService } from '../../services/auth-modal.service';
import { Producto } from '../../models/producto';

@Component({
  selector: 'app-nexajuegos',
  imports: [RouterLink],
  templateUrl: './nexajuegos.component.html',
  styleUrl: './nexajuegos.component.css',
})
export class NexaJuegosComponent implements OnInit {
  // inject() como field initializer — se resuelve antes que los campos dependientes
  private readonly userState    = inject(UserStateService);
  private readonly authModalSvc = inject(AuthModalService);

  readonly currentUserId     = this.userState.userId;
  readonly misSubscripciones = this.userState.misSubscripciones;

  submitted        = signal(false);
  subscribingId    = signal<string | null>(null);
  selectedJuego    = signal<Producto | null>(null);
  suscripcionError = signal('');

  private readonly GAME_PRODUCT_IDS = ['NexaTeg'];

  get juegos() {
    return this.productoSvc.productos().filter(p => this.GAME_PRODUCT_IDS.includes(p.id_producto));
  }

  get emptySlots() {
    return Array.from({ length: Math.max(0, 6 - this.juegos.length) });
  }

  private readonly gameRoutes: Record<string, string> = {
    NexaTeg: '/nexateg',
  };

  constructor(
    private router: Router,
    private productoSvc: ProductoService,
    private suscripcionSvc: SuscripcionService,
  ) {}

  async ngOnInit() {
    await this.productoSvc.cargar();
  }

  isSubscribed(idProducto: string): boolean {
    return this.misSubscripciones().includes(idProducto);
  }

  canNavigate(juego: Producto): boolean {
    return !juego.req_suscripcion || this.isSubscribed(juego.id_producto);
  }

  closeModal() { this.selectedJuego.set(null); }

  async suscribirse(juego: Producto) {
    const userId = this.currentUserId();
    if (!userId || this.subscribingId()) return;
    this.subscribingId.set(juego.id_producto);
    this.suscripcionError.set('');
    const today = new Date();
    const fechaIng = today.toISOString().substring(0, 10);
    const fechaFin = new Date(today.setFullYear(today.getFullYear() + 1)).toISOString().substring(0, 10);
    try {
      const { error } = await this.suscripcionSvc.create({
        id_usuario: userId,
        id_producto: juego.id_producto,
        fecha_ing_sus: fechaIng,
        fecha_fin_sus: fechaFin,
        url: null,
        user_admin: null,
        user_key: null,
      });
      if (error) throw error;
      this.userState.agregar(juego.id_producto);
      this.closeModal();
    } catch (err: any) {
      this.suscripcionError.set(err.message ?? 'No se pudo completar la suscripción.');
    } finally {
      this.subscribingId.set(null);
    }
  }

  navigate(juego: Producto) {
    if (juego.req_suscripcion && !this.isSubscribed(juego.id_producto)) {
      this.suscripcionError.set('');
      this.selectedJuego.set(juego);
      return;
    }
    const route = this.gameRoutes[juego.id_producto];
    if (route) this.router.navigate([route]);
  }

  abrirLoginModal() {
    this.selectedJuego.set(null);
    this.authModalSvc.solicitar();
  }

  submitForm() { this.submitted.set(true); }
}
