import { Component, OnInit, signal, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ProductoService } from '../../services/producto.service';
import { SuscripcionService } from '../../services/suscripcion.service';
import { UserStateService } from '../../services/user-state.service';
import { Producto } from '../../models/producto';

@Component({
  selector: 'app-landing',
  imports: [RouterLink],
  templateUrl: './landing.component.html',
  styleUrl: './landing.component.css',
})
export class LandingComponent implements OnInit {
  // inject() como field initializer — se resuelve antes que los campos dependientes
  private readonly userState = inject(UserStateService);

  readonly currentUserId     = this.userState.userId;
  readonly misSubscripciones = this.userState.misSubscripciones;

  submitted        = signal(false);
  subscribingId    = signal<string | null>(null);
  selectedProducto = signal<Producto | null>(null);
  suscripcionError = signal('');

  private readonly GAME_PRODUCT_IDS = ['NexaTeg'];

  get productosPlataforma() {
    return this.productoSvc.productos().filter(p => !this.GAME_PRODUCT_IDS.includes(p.id_producto));
  }

  private readonly productRoutes: Record<string, string> = {
    NexaJuegos: '/nexajuegos',
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

  async suscribirse(producto: Producto) {
    const userId = this.currentUserId();
    if (!userId || this.subscribingId()) return;
    this.subscribingId.set(producto.id_producto);
    this.suscripcionError.set('');
    const today = new Date();
    const fechaIng = today.toISOString().substring(0, 10);
    const fechaFin = new Date(today.setFullYear(today.getFullYear() + 1)).toISOString().substring(0, 10);
    try {
      const { error } = await this.suscripcionSvc.create({
        id_usuario: userId,
        id_producto: producto.id_producto,
        fecha_ing_sus: fechaIng,
        fecha_fin_sus: fechaFin,
        url: null,
        user_admin: null,
        user_key: null,
      });
      if (error) throw error;
      this.userState.agregar(producto.id_producto);
      this.closeModal();
    } catch (err: any) {
      this.suscripcionError.set(err.message ?? 'No se pudo completar la suscripción.');
    } finally {
      this.subscribingId.set(null);
    }
  }

  hasRoute(idProducto: string): boolean {
    return idProducto in this.productRoutes;
  }

  closeModal() { this.selectedProducto.set(null); }

  handleCardClick(p: Producto) {
    if (p.req_suscripcion && !this.isSubscribed(p.id_producto)) {
      this.suscripcionError.set('');
      this.selectedProducto.set(p);
      return;
    }
    this.navigate(p);
  }

  navigate(producto: Producto) {
    const route = this.productRoutes[producto.id_producto];
    if (route) this.router.navigate([route]);
  }

  submitForm() { this.submitted.set(true); }
}
