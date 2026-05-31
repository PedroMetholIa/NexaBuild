import { Component, OnInit, signal } from '@angular/core';
import { RouterOutlet, Router } from '@angular/router';
import { AuthService } from './services/auth.service';
import { UserActivityService } from './services/user-activity.service';
import { Session } from '@supabase/supabase-js';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App implements OnInit {
  session = signal<Session | null>(null);

  constructor(
    private auth: AuthService,
    private userActivity: UserActivityService,
    readonly router: Router
  ) {}

  ngOnInit() {
    this.auth.getSession().then(({ data }) => this.session.set(data.session));
    this.auth.onAuthChange((_, session) => {
      this.session.set(session);
      if (!session) this.router.navigate(['/auth']);
    });
  }

  async logout() {
    const { data } = await this.auth.getSession();
    if (data.session?.user) {
      await this.userActivity.setOffline(data.session.user.id);
    }
    await this.auth.signOut();
  }
}
