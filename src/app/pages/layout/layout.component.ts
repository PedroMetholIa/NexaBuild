import { Component, OnInit, signal, HostListener, effect } from '@angular/core';
import { RouterOutlet, RouterLink, Router, NavigationEnd } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { UsuarioService } from '../../services/usuario.service';
import { UserActivityService } from '../../services/user-activity.service';
import { AuthModalService } from '../../services/auth-modal.service';
import { AuthComponent } from '../auth/auth.component';

@Component({
  selector: 'app-layout',
  imports: [RouterOutlet, RouterLink, AuthComponent],
  templateUrl: './layout.component.html',
  styleUrl: './layout.component.css',
})
export class LayoutComponent implements OnInit {
  isLoggedIn  = signal(!!sessionStorage.getItem('nx_user_name'));
  userName    = signal(sessionStorage.getItem('nx_user_name') ?? '');
  modalOpen   = signal(false);
  modalRegister = signal(false);
  menuOpen    = signal(false);
  isNexaTeg   = signal(false);

  constructor(
    private auth: AuthService,
    private usuarioService: UsuarioService,
    private userActivity: UserActivityService,
    private authModalSvc: AuthModalService,
    private router: Router,
  ) {
    effect(() => {
      if (this.authModalSvc.solicitado()) {
        this.modalRegister.set(false);
        this.modalOpen.set(true);
        this.authModalSvc.limpiar();
      }
    });
  }

  async ngOnInit() {
    this.isNexaTeg.set(this.router.url.startsWith('/nexateg'));
    this.router.events.subscribe(e => {
      if (e instanceof NavigationEnd) {
        this.isNexaTeg.set(e.urlAfterRedirects.startsWith('/nexateg'));
      }
    });

    const { data: sessionData } = await this.auth.getSession();
    if (sessionData.session) {
      await this.loadUser(sessionData.session.user.id, sessionData.session.user.user_metadata);
    } else {
      // Sesión expirada o inválida — limpiar estado cacheado
      this.isLoggedIn.set(false);
      this.userName.set('');
      sessionStorage.removeItem('nx_user_name');
      sessionStorage.removeItem('nx_user_admin');
    }

    this.auth.onAuthChange(async (event, session) => {
      if (session && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION')) {
        await this.loadUser(session.user.id, session.user.user_metadata);
        if (event === 'SIGNED_IN') this.modalOpen.set(false);
      } else if (!session) {
        this.isLoggedIn.set(false);
        this.userName.set('');
      }
    });
  }

  private async loadUser(userId: string, meta: Record<string, unknown>) {
    // Try the usuario table first
    try {
      const { data } = await this.usuarioService.getByUserId(userId);
      if (data) {
        this.userName.set(`${data.nombre} ${data.apellido}`);
        this.isLoggedIn.set(true);
        // Cache name in auth metadata so future loads don't depend on RLS
        if (!meta?.['nombre']) {
          this.auth.updateUserMetadata({ nombre: data.nombre, apellido: data.apellido });
        }
        return;
      }
    } catch { /* ignorar */ }

    // Fallback: name stored in auth token metadata (set at signup or cached above)
    const nombre = meta?.['nombre'] as string | undefined;
    const apellido = meta?.['apellido'] as string | undefined;
    this.userName.set(nombre ? `${nombre} ${apellido ?? ''}`.trim() : '');
    this.isLoggedIn.set(true);
  }

  @HostListener('document:click')
  closeMenu() {
    if (this.menuOpen()) this.menuOpen.set(false);
  }

  toggleMenu() {
    this.menuOpen.update(v => !v);
  }

  openModal(register: boolean) {
    this.modalRegister.set(register);
    this.modalOpen.set(true);
  }

  closeModal() {
    this.modalOpen.set(false);
  }

  async logout() {
    // Actualizar header inmediatamente, sin esperar eventos async
    this.isLoggedIn.set(false);
    this.userName.set('');
    this.menuOpen.set(false);
    try {
      const { data } = await this.auth.getSession();
      if (data.session?.user) {
        await this.userActivity.setOffline(data.session.user.id);
      }
    } catch { /* ignorar */ }
    await this.auth.signOut();
  }
}
