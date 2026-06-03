export interface Partida {
  idPartida: number;
  idProducto: string;
  NombrePartida: string | null;
  ClavePartida: string | null;
  PartidaActiva: boolean | null;
  LimiteJugadores: number | null;
  HostPartida: string | null;
  usuario?: { nombre: string; apellido: string } | null;
}
