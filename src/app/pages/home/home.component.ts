import { Component, OnInit, OnDestroy, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { UserActivityService } from '../../services/user-activity.service';
import { UserActivity } from '../../models/user-activity';

@Component({
  selector: 'app-home',
  imports: [DatePipe],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css',
})
export class HomeComponent implements OnInit, OnDestroy {
  users = signal<UserActivity[]>([]);
  loading = signal(true);
  private refreshInterval?: ReturnType<typeof setInterval>;

  constructor(private userActivity: UserActivityService) {}

  ngOnInit() {
    this.load();
    this.refreshInterval = setInterval(() => this.load(), 30_000);
  }

  ngOnDestroy() {
    clearInterval(this.refreshInterval);
  }

  async load() {
    const { data } = await this.userActivity.getAll();
    this.users.set(data ?? []);
    this.loading.set(false);
  }

  get onlineCount() {
    return this.users().filter((u) => u.is_online).length;
  }
}
