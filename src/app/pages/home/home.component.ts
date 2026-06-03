import { Component, OnInit, OnDestroy, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UserActivityService } from '../../services/user-activity.service';
import { AuthService } from '../../services/auth.service';
import { UsuarioService } from '../../services/usuario.service';
import { ProductoService } from '../../services/producto.service';
import { SuscripcionService } from '../../services/suscripcion.service';
import { UserActivity } from '../../models/user-activity';
import { Usuario } from '../../models/usuario';
import { Producto } from '../../models/producto';
import { Suscripcion } from '../../models/suscripcion';

type Tab = 'usuarios' | 'sesiones' | 'productos' | 'suscripciones';

@Component({
  selector: 'app-home',
  imports: [DatePipe, FormsModule],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css',
})
export class HomeComponent implements OnInit, OnDestroy {
  activeTab = signal<Tab>('usuarios');

  usuarios = signal<Usuario[]>([]);
  sesiones = signal<UserActivity[]>([]);
  productos = signal<Producto[]>([]);
  suscripciones = signal<Suscripcion[]>([]);

  loading = signal(false);
  currentUserId = signal<string | null>(null);
  closing = signal<string | null>(null);

  modalOpen = signal(false);
  modalMode = signal<'add' | 'edit'>('add');
  modalSection = signal<Tab>('usuarios');
  modalSaving = signal(false);
  modalError = signal('');
  editingId = signal<string | null>(null);
  deleteConfirm = signal<{ tab: Tab; id: string; label: string } | null>(null);

  // Datos de formulario (propiedades normales para ngModel)
  usuarioForm = { id: '', email: '', nombre: '', apellido: '', administrador: false };
  sesionForm = { is_online: false };
  productoForm = { id_producto: '', descripcion: '', req_suscripcion: false };
  suscripcionForm = {
    id_usuario: '', id_producto: '',
    fecha_ing_sus: '', fecha_fin_sus: '',
    url: '', user_admin: '', user_key: '',
  };

  private refreshInterval?: ReturnType<typeof setInterval>;

  constructor(
    private userActivitySvc: UserActivityService,
    private auth: AuthService,
    private usuarioSvc: UsuarioService,
    private productoSvc: ProductoService,
    private suscripcionSvc: SuscripcionService,
  ) {}

  async ngOnInit() {
    const { data } = await this.auth.getSession();
    this.currentUserId.set(data.session?.user.id ?? null);
    await this.loadTab('usuarios');
    this.refreshInterval = setInterval(() => {
      if (this.activeTab() === 'sesiones') this.loadSesiones();
    }, 30_000);
  }

  ngOnDestroy() { clearInterval(this.refreshInterval); }

  async setTab(tab: Tab) {
    this.activeTab.set(tab);
    await this.loadTab(tab);
  }

  private async loadTab(tab: Tab) {
    switch (tab) {
      case 'usuarios':      return this.loadUsuarios();
      case 'sesiones':      return this.loadSesiones();
      case 'productos':     return this.loadProductos();
      case 'suscripciones': return this.loadSuscripciones();
    }
  }

  async loadUsuarios() {
    this.loading.set(true);
    const { data } = await this.usuarioSvc.getAll();
    this.usuarios.set((data as Usuario[]) ?? []);
    this.loading.set(false);
  }

  async loadSesiones() {
    this.loading.set(true);
    const { data } = await this.userActivitySvc.getAll();
    this.sesiones.set((data as UserActivity[]) ?? []);
    this.loading.set(false);
  }

  async loadProductos() {
    this.loading.set(true);
    const { data } = await this.productoSvc.getAll();
    this.productos.set((data as Producto[]) ?? []);
    this.loading.set(false);
  }

  async loadSuscripciones() {
    this.loading.set(true);
    if (!this.usuarios().length) await this.loadUsuarios();
    if (!this.productos().length) await this.loadProductos();
    const { data } = await this.suscripcionSvc.getAll();
    this.suscripciones.set((data as Suscripcion[]) ?? []);
    this.loading.set(false);
  }

  // ── Modal ──────────────────────────────────────────────────────────
  openAdd() {
    this.modalSection.set(this.activeTab());
    this.modalMode.set('add');
    this.editingId.set(null);
    this.modalError.set('');
    this.resetForm();
    this.modalOpen.set(true);
  }

  openEdit(item: Usuario | UserActivity | Producto | Suscripcion) {
    this.modalSection.set(this.activeTab());
    this.modalMode.set('edit');
    this.modalError.set('');
    this.fillForm(item);
    this.modalOpen.set(true);
  }

  closeModal() { this.modalOpen.set(false); }

  private resetForm() {
    const t = this.activeTab();
    if (t === 'usuarios')      this.usuarioForm = { id: '', email: '', nombre: '', apellido: '', administrador: false };
    if (t === 'sesiones')      this.sesionForm = { is_online: false };
    if (t === 'productos')     this.productoForm = { id_producto: '', descripcion: '', req_suscripcion: false };
    if (t === 'suscripciones') this.suscripcionForm = { id_usuario: '', id_producto: '', fecha_ing_sus: '', fecha_fin_sus: '', url: '', user_admin: '', user_key: '' };
  }

  private fillForm(item: any) {
    const t = this.activeTab();
    if (t === 'usuarios') {
      this.editingId.set(item.id);
      this.usuarioForm = { id: item.id, email: item.email, nombre: item.nombre, apellido: item.apellido, administrador: item.administrador };
    } else if (t === 'sesiones') {
      this.editingId.set(item.user_id);
      this.sesionForm = { is_online: item.is_online };
    } else if (t === 'productos') {
      this.editingId.set(item.id_producto);
      this.productoForm = { id_producto: item.id_producto, descripcion: item.descripcion, req_suscripcion: item.req_suscripcion };
    } else if (t === 'suscripciones') {
      this.editingId.set(item.id);
      this.suscripcionForm = {
        id_usuario: item.id_usuario, id_producto: item.id_producto,
        fecha_ing_sus: item.fecha_ing_sus?.substring(0, 10) ?? '',
        fecha_fin_sus: item.fecha_fin_sus?.substring(0, 10) ?? '',
        url: item.url ?? '', user_admin: item.user_admin ?? '', user_key: item.user_key ?? '',
      };
    }
  }

  async save() {
    this.modalSaving.set(true);
    this.modalError.set('');
    try {
      const tab  = this.modalSection();
      const mode = this.modalMode();

      if (tab === 'usuarios') {
        const f = this.usuarioForm;
        if (mode === 'add') {
          if (!f.id || !f.email || !f.nombre || !f.apellido) throw new Error('Completá todos los campos requeridos.');
          const { error } = await this.usuarioSvc.create(f.id, f.email, f.nombre, f.apellido);
          if (error) throw error;
        } else {
          const { error } = await this.usuarioSvc.update(this.editingId()!, { nombre: f.nombre, apellido: f.apellido, administrador: f.administrador });
          if (error) throw error;
        }
        await this.loadUsuarios();

      } else if (tab === 'sesiones') {
        const { error } = await this.userActivitySvc.updateStatus(this.editingId()!, this.sesionForm.is_online);
        if (error) throw error;
        await this.loadSesiones();

      } else if (tab === 'productos') {
        const f = this.productoForm;
        if (!f.id_producto || !f.descripcion) throw new Error('Completá todos los campos requeridos.');
        if (mode === 'add') {
          const { error } = await this.productoSvc.create({ id_producto: f.id_producto, descripcion: f.descripcion, req_suscripcion: f.req_suscripcion });
          if (error) throw error;
        } else {
          const { error } = await this.productoSvc.update(this.editingId()!, { descripcion: f.descripcion, req_suscripcion: f.req_suscripcion });
          if (error) throw error;
        }
        await this.loadProductos();

      } else if (tab === 'suscripciones') {
        const f = this.suscripcionForm;
        if (!f.id_usuario || !f.id_producto || !f.fecha_ing_sus) throw new Error('Completá los campos requeridos.');
        const payload = {
          id_usuario: f.id_usuario, id_producto: f.id_producto,
          fecha_ing_sus: f.fecha_ing_sus,
          fecha_fin_sus: f.fecha_fin_sus || null,
          url: f.url || null,
          user_admin: f.user_admin || null,
          user_key: f.user_key || null,
        };
        if (mode === 'add') {
          const { error } = await this.suscripcionSvc.create(payload);
          if (error) throw error;
        } else {
          const { error } = await this.suscripcionSvc.update(this.editingId()!, payload);
          if (error) throw error;
        }
        await this.loadSuscripciones();
      }

      this.closeModal();
    } catch (e: any) {
      this.modalError.set(e.message ?? 'Ocurrió un error');
    } finally {
      this.modalSaving.set(false);
    }
  }

  // ── Eliminar ───────────────────────────────────────────────────────
  askDelete(tab: Tab, id: string, label: string) {
    this.deleteConfirm.set({ tab, id, label });
  }

  cancelDelete() { this.deleteConfirm.set(null); }

  async confirmDelete() {
    const conf = this.deleteConfirm();
    if (!conf) return;
    this.deleteConfirm.set(null);
    try {
      if (conf.tab === 'usuarios')      await this.usuarioSvc.delete(conf.id);
      else if (conf.tab === 'sesiones') await this.userActivitySvc.delete(conf.id);
      else if (conf.tab === 'productos') await this.productoSvc.delete(conf.id);
      else if (conf.tab === 'suscripciones') await this.suscripcionSvc.delete(conf.id);
      await this.loadTab(conf.tab);
    } catch (e: any) {
      alert(e.message ?? 'No se pudo eliminar');
    }
  }

  // ── Sesiones ───────────────────────────────────────────────────────
  async forceLogout(userId: string) {
    this.closing.set(userId);
    await this.userActivitySvc.setOffline(userId);
    await this.userActivitySvc.broadcastForceLogout(userId);
    this.sesiones.update(list => list.map(u => u.user_id === userId ? { ...u, is_online: false } : u));
    this.closing.set(null);
  }

  // ── Helpers ────────────────────────────────────────────────────────
  get onlineCount() { return this.sesiones().filter(u => u.is_online).length; }

  modalTitle() {
    const mode = this.modalMode() === 'add' ? 'Agregar' : 'Editar';
    const labels: Record<Tab, string> = { usuarios: 'usuario', sesiones: 'sesión', productos: 'producto', suscripciones: 'suscripción' };
    return `${mode} ${labels[this.modalSection()]}`;
  }

  usuarioLabel(id: string) {
    const u = this.usuarios().find(x => x.id === id);
    return u ? `${u.nombre} ${u.apellido}` : id;
  }

  productoLabel(id: string) {
    const p = this.productos().find(x => x.id_producto === id);
    return p ? `${p.id_producto} – ${p.descripcion}` : id;
  }
}
