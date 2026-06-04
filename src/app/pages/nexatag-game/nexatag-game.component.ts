import { Component, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

@Component({
  selector: 'app-nexatag-game',
  imports: [RouterLink],
  templateUrl: './nexatag-game.component.html',
  styleUrl: './nexatag-game.component.css',
})
export class NexaTagGameComponent implements OnInit {
  idPartida = signal<string | null>(null);

  constructor(private route: ActivatedRoute) {}

  ngOnInit() {
    this.idPartida.set(this.route.snapshot.queryParamMap.get('partida'));
  }
}
