import { Component, OnInit, signal, HostListener, effect, inject } from '@angular/core';
import { RouterOutlet, RouterLink, Router, NavigationEnd } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { UserActivityService } from '../../services/user-activity.service';
import { UserStateService } from '../../services/user-state.service';
import { AuthModalService } from '../../services/auth-modal.service';
import { AuthComponent } from '../auth/auth.component';

@Component({
  selector: 'app-layout',
  imports: [RouterOutlet, RouterLink, AuthComponent],
  templateUrl: './layout.component.html',
  styleUrl: './layout.component.css',
})
export class LayoutComponent implements OnInit {
  private readonly userState = inject(UserStateService);

  readonly userName   = this.userState.userName;
  isLoggedIn          = signal(!!sessionStorage.getItem('nx_user_name'));
  modalOpen           = signal(false);
  modalRegister       = signal(false);
  menuOpen            = signal(false);
  isNexaTeg           = signal(false);

  constructor(
    private auth: AuthService,
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

  ngOnInit() {
    this.isNexaTeg.set(this.router.url.startsWith('/nexateg'));
    this.router.events.subscribe(e => {
      if (e instanceof NavigationEnd) {
        this.isNexaTeg.set(e.urlAfterRedirects.startsWith('/nexateg'));
      }
    });

    this.auth.onAuthChange((event, session) => {
      this.isLoggedIn.set(session !== null);
      if (event === 'SIGNED_IN') this.modalOpen.set(false);
    });
  }

  @HostListener('document:click')
  closeMenu() { if (this.menuOpen()) this.menuOpen.set(false); }

  toggleMenu() { this.menuOpen.update(v => !v); }

  openModal(register: boolean) {
    this.modalRegister.set(register);
    this.modalOpen.set(true);
  }

  closeModal() { this.modalOpen.set(false); }

  async logout() {
    this.menuOpen.set(false);
    try {
      const { data } = await this.auth.getSession();
      if (data.session?.user) await this.userActivity.setOffline(data.session.user.id);
    } catch { /* ignorar */ }
    await this.auth.signOut();
  }
}
