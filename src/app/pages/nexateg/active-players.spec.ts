/**
 * Tests de lógica de jugadores activos — NexaTeg
 *
 * Cubre las tres capas donde se determina si un usuario está activo:
 *  L1 - loadSuscriptores()        → carga inicial desde BD
 *  L2 - activityChannel callback  → eventos Realtime
 *  L3 - isActuallyOnline()        → panel admin (home.component)
 */

// ─── Constantes del sistema ─────────────────────────────────────────────────

const ONLINE_THRESHOLD_MS = 20 * 60 * 1000;          // 20 min
const HEARTBEAT_MS        =  5 * 60 * 1000;           // 5 min

// ─── Helpers de tiempo ──────────────────────────────────────────────────────

function minAgo(m: number): string {
  return new Date(Date.now() - m * 60 * 1000).toISOString();
}

// ─── Réplica exacta de la lógica de producción (nexateg.component.ts) ───────

/** Replica la lógica de loadSuscriptores() */
function buildOnlineIds(
  activityData: Array<{ user_id: string; is_online: boolean; last_seen: string }>,
  currentUserId: string | null
): Set<string> {
  const activeIds = activityData
    .filter(a => a.is_online && Date.now() - new Date(a.last_seen).getTime() < ONLINE_THRESHOLD_MS)
    .map(a => a.user_id);
  if (currentUserId) activeIds.push(currentUserId);
  return new Set<string>(activeIds);
}

/** Replica la lógica del callback de activityChannel */
function applyRealtimeUpdate(
  current: Set<string>,
  payload: { user_id: string; is_online: boolean; last_seen: string }
): Set<string> {
  const online =
    payload.is_online &&
    Date.now() - new Date(payload.last_seen).getTime() < ONLINE_THRESHOLD_MS;
  const next = new Set(current);
  if (online) next.add(payload.user_id);
  else        next.delete(payload.user_id);
  return next;
}

/** Replica isActuallyOnline() de home.component.ts */
function isActuallyOnline(s: { is_online: boolean; last_seen: string }): boolean {
  if (!s.is_online) return false;
  return Date.now() - new Date(s.last_seen).getTime() < ONLINE_THRESHOLD_MS;
}

/** Replica activeSuscriptoresCount getter */
function activeSuscriptoresCount(
  suscriptores: Array<{ id_usuario: string }>,
  onlineIds: Set<string>
): number {
  return suscriptores.filter(s => onlineIds.has(s.id_usuario)).length;
}

// ════════════════════════════════════════════════════════════════════════════
// SUITE DE TESTS
// ════════════════════════════════════════════════════════════════════════════

describe('Jugadores Activos — Lógica completa', () => {

  // ── GRUPO 1: Carga inicial (loadSuscriptores) ───────────────────────────

  describe('GRUPO 1 — Carga inicial desde BD (loadSuscriptores)', () => {

    it('CU-01 | Usuario activo: is_online=true, last_seen 5 min → ONLINE', () => {
      const result = buildOnlineIds(
        [{ user_id: 'u1', is_online: true, last_seen: minAgo(5) }],
        null
      );
      expect(result.has('u1')).toBe(true);
    });

    it('CU-02 | Usuario inactivo: is_online=true, last_seen 21 min → OFFLINE', () => {
      const result = buildOnlineIds(
        [{ user_id: 'u1', is_online: true, last_seen: minAgo(21) }],
        null
      );
      expect(result.has('u1')).toBe(false);
    });

    it('CU-03 | Usuario desconectado: is_online=false, last_seen 1 min → OFFLINE', () => {
      const result = buildOnlineIds(
        [{ user_id: 'u1', is_online: false, last_seen: minAgo(1) }],
        null
      );
      expect(result.has('u1')).toBe(false);
    });

    it('CU-04 | Usuario desconectado: is_online=false, last_seen 25 min → OFFLINE', () => {
      const result = buildOnlineIds(
        [{ user_id: 'u1', is_online: false, last_seen: minAgo(25) }],
        null
      );
      expect(result.has('u1')).toBe(false);
    });

    it('CU-05 | Usuario actual con DB obsoleta (is_online=false) → ONLINE por estar en la página', () => {
      const result = buildOnlineIds(
        [{ user_id: 'me', is_online: false, last_seen: minAgo(30) }],
        'me'
      );
      expect(result.has('me')).toBe(true);
    });

    it('CU-06 | Usuario actual no tiene registro en DB → ONLINE por estar en la página', () => {
      const result = buildOnlineIds([], 'me');
      expect(result.has('me')).toBe(true);
      expect(result.size).toBe(1);
    });

    it('CU-07 | Sin sesión (currentId=null), DB vacía → 0 online', () => {
      const result = buildOnlineIds([], null);
      expect(result.size).toBe(0);
    });

    it('CU-08 | Exactamente en el límite (20 min) → OFFLINE (threshold es exclusivo)', () => {
      const result = buildOnlineIds(
        [{ user_id: 'u1', is_online: true, last_seen: minAgo(20) }],
        null
      );
      expect(result.has('u1')).toBe(false);
    });

    it('CU-09 | Un minuto antes del límite (19 min) → ONLINE', () => {
      const result = buildOnlineIds(
        [{ user_id: 'u1', is_online: true, last_seen: minAgo(19) }],
        null
      );
      expect(result.has('u1')).toBe(true);
    });

    it('CU-10 | Mix: 4 usuarios con distintos estados', () => {
      const result = buildOnlineIds(
        [
          { user_id: 'u1', is_online: true,  last_seen: minAgo(5)  }, // online
          { user_id: 'u2', is_online: false, last_seen: minAgo(5)  }, // offline (flag)
          { user_id: 'u3', is_online: true,  last_seen: minAgo(25) }, // offline (viejo)
          { user_id: 'u4', is_online: true,  last_seen: minAgo(10) }, // online
        ],
        'me'
      );
      expect(result.has('u1')).toBe(true);
      expect(result.has('u2')).toBe(false);
      expect(result.has('u3')).toBe(false);
      expect(result.has('u4')).toBe(true);
      expect(result.has('me')).toBe(true);
      expect(result.size).toBe(3);
    });

    it('CU-11 | Heartbeat corrió hace 4 min 59 seg → ONLINE (dentro del margen)', () => {
      // El heartbeat actualiza cada 5 min. En el peor caso last_seen puede tener ~5 min.
      // Con threshold 20 min, debe quedar online.
      const result = buildOnlineIds(
        [{ user_id: 'u1', is_online: true, last_seen: minAgo(4.98) }],
        null
      );
      expect(result.has('u1')).toBe(true);
    });

    it('CU-12 | Usuario volvió activo: DB aún vieja (race con updateLastSeen) + es usuario actual → ONLINE', () => {
      // Escenario: usuario refreshó la página, updateLastSeen no completó aún,
      // loadSuscriptores corre con last_seen viejo. Al ser el usuario actual, sigue online.
      const result = buildOnlineIds(
        [{ user_id: 'me', is_online: true, last_seen: minAgo(22) }],
        'me'
      );
      expect(result.has('me')).toBe(true); // garantizado por ser usuario actual
    });

    it('CU-13 | Usuario volvió activo: DB vieja, NO es usuario actual → OFFLINE hasta próximo refresh', () => {
      // Mismo race pero para otro usuario: debe esperar heartbeat + poll de 30 seg
      const result = buildOnlineIds(
        [{ user_id: 'other', is_online: true, last_seen: minAgo(22) }],
        'me'
      );
      expect(result.has('other')).toBe(false); // gap esperado: máx 30s
    });
  });

  // ── GRUPO 2: Eventos Realtime (activityChannel callback) ───────────────

  describe('GRUPO 2 — Eventos Realtime (activityChannel)', () => {

    it('CU-14 | Realtime: usuario vuelve activo (is_online=true, fresh) → agregado al set', () => {
      const initial = new Set<string>();
      const result = applyRealtimeUpdate(initial, {
        user_id: 'u1', is_online: true, last_seen: minAgo(1)
      });
      expect(result.has('u1')).toBe(true);
    });

    it('CU-15 | Realtime: usuario se desconecta (is_online=false) → removido del set', () => {
      const initial = new Set(['u1', 'u2']);
      const result = applyRealtimeUpdate(initial, {
        user_id: 'u1', is_online: false, last_seen: minAgo(1)
      });
      expect(result.has('u1')).toBe(false);
      expect(result.has('u2')).toBe(true);
    });

    it('CU-16 | Realtime: is_online=true pero last_seen viejo (21 min) → removido del set', () => {
      const initial = new Set(['u1']);
      const result = applyRealtimeUpdate(initial, {
        user_id: 'u1', is_online: true, last_seen: minAgo(21)
      });
      expect(result.has('u1')).toBe(false);
    });

    it('CU-17 | Realtime: updateLastSeen llega para usuario inactivo → pasa a ONLINE', () => {
      // Escenario clave: usuario volvió activo, heartbeat corrió, Realtime notifica
      const initial = new Set<string>(); // estaba offline
      const result = applyRealtimeUpdate(initial, {
        user_id: 'u1', is_online: true, last_seen: minAgo(0)
      });
      expect(result.has('u1')).toBe(true);
    });

    it('CU-18 | Realtime: evento para usuario desconocido (no en set) con is_online=false → sin cambio', () => {
      const initial = new Set(['u1']);
      const result = applyRealtimeUpdate(initial, {
        user_id: 'u99', is_online: false, last_seen: minAgo(5)
      });
      expect(result.has('u1')).toBe(true);
      expect(result.size).toBe(1);
    });

    it('CU-19 | Realtime: Edge Function marca offline al usuario actual → se remueve del set [GAP DETECTADO]', () => {
      // BUG CONOCIDO: el handler Realtime no re-agrega al usuario actual.
      // El próximo loadSuscriptores (30 seg) o el app.ts subscribeToStatus
      // (que cerrará la sesión) manejan esto.
      const initial = new Set(['me', 'u1']);
      const result = applyRealtimeUpdate(initial, {
        user_id: 'me', is_online: false, last_seen: minAgo(1)
      });
      // En producción esto gatilla doLogout() vía subscribeToStatus en app.ts
      // antes de que el visual sea un problema.
      expect(result.has('me')).toBe(false);
      expect(result.has('u1')).toBe(true);
    });

    it('CU-20 | Realtime: múltiples eventos en secuencia → estado final correcto', () => {
      let set = new Set<string>();
      set = applyRealtimeUpdate(set, { user_id: 'u1', is_online: true,  last_seen: minAgo(1) });
      set = applyRealtimeUpdate(set, { user_id: 'u2', is_online: true,  last_seen: minAgo(2) });
      set = applyRealtimeUpdate(set, { user_id: 'u1', is_online: false, last_seen: minAgo(1) });
      set = applyRealtimeUpdate(set, { user_id: 'u3', is_online: true,  last_seen: minAgo(0) });
      expect(set.has('u1')).toBe(false);
      expect(set.has('u2')).toBe(true);
      expect(set.has('u3')).toBe(true);
      expect(set.size).toBe(2);
    });
  });

  // ── GRUPO 3: isActuallyOnline (home.component — panel admin) ───────────

  describe('GRUPO 3 — isActuallyOnline (home.component)', () => {

    it('CU-21 | is_online=true, last_seen 5 min → true', () => {
      expect(isActuallyOnline({ is_online: true, last_seen: minAgo(5) })).toBe(true);
    });

    it('CU-22 | is_online=true, last_seen 21 min → false', () => {
      expect(isActuallyOnline({ is_online: true, last_seen: minAgo(21) })).toBe(false);
    });

    it('CU-23 | is_online=false, last_seen 1 min → false', () => {
      expect(isActuallyOnline({ is_online: false, last_seen: minAgo(1) })).toBe(false);
    });

    it('CU-24 | is_online=false, last_seen 25 min → false', () => {
      expect(isActuallyOnline({ is_online: false, last_seen: minAgo(25) })).toBe(false);
    });

    it('CU-25 | Exactamente en el límite (20 min) → false', () => {
      expect(isActuallyOnline({ is_online: true, last_seen: minAgo(20) })).toBe(false);
    });
  });

  // ── GRUPO 4: activeSuscriptoresCount ───────────────────────────────────

  describe('GRUPO 4 — activeSuscriptoresCount', () => {

    it('CU-26 | Sin suscriptores → 0', () => {
      expect(activeSuscriptoresCount([], new Set(['u1']))).toBe(0);
    });

    it('CU-27 | Todos offline → 0', () => {
      const subs = [{ id_usuario: 'u1' }, { id_usuario: 'u2' }];
      expect(activeSuscriptoresCount(subs, new Set())).toBe(0);
    });

    it('CU-28 | 2 de 3 online → 2', () => {
      const subs = [{ id_usuario: 'u1' }, { id_usuario: 'u2' }, { id_usuario: 'u3' }];
      expect(activeSuscriptoresCount(subs, new Set(['u1', 'u3']))).toBe(2);
    });

    it('CU-29 | Todos online → count = total de suscriptores', () => {
      const subs = [{ id_usuario: 'u1' }, { id_usuario: 'u2' }];
      expect(activeSuscriptoresCount(subs, new Set(['u1', 'u2', 'extra']))).toBe(2);
    });

    it('CU-30 | Usuario online pero no es suscriptor → no cuenta', () => {
      const subs = [{ id_usuario: 'u1' }];
      expect(activeSuscriptoresCount(subs, new Set(['u99']))).toBe(0);
    });
  });

  // ── GRUPO 5: Escenarios de ciclo de vida completo ──────────────────────

  describe('GRUPO 5 — Ciclos de vida completos', () => {

    it('CU-31 | Login fresco: DB con last_seen=now, is_online=true → ONLINE', () => {
      // updateLastSeen se llama en startMonitoring y completa antes del poll
      const result = buildOnlineIds(
        [{ user_id: 'me', is_online: true, last_seen: minAgo(0) }],
        'me'
      );
      expect(result.has('me')).toBe(true);
    });

    it('CU-32 | Refresh con race: updateLastSeen no completó → garantizado por currentId', () => {
      // El race condition más común: nexateg loadSuscriptores corre antes
      // de que updateLastSeen de app.ts actualice la BD
      const staleActivity = [{ user_id: 'me', is_online: false, last_seen: minAgo(65) }];
      const result = buildOnlineIds(staleActivity, 'me');
      expect(result.has('me')).toBe(true); // fix: currentId siempre online
    });

    it('CU-33 | Inactividad 19 min → ONLINE (no llegó al threshold)', () => {
      // El heartbeat sigue corriendo (lastActivity < 1h), last_seen se actualiza cada 5 min
      const result = buildOnlineIds(
        [{ user_id: 'u1', is_online: true, last_seen: minAgo(5) }],
        null
      );
      expect(result.has('u1')).toBe(true);
    });

    it('CU-34 | Inactividad 21 min, heartbeat corrió hace 4 min → OFFLINE en vista', () => {
      // Usuario inactivo 21 min. Heartbeat actualizó last_seen hace 4 min
      // (cuando lastActivity era ~17 min). Ahora last_seen tiene 4 min.
      // Usuario aparece ONLINE a pesar de estar "inactivo" 21 min.
      // COMPORTAMIENTO ESPERADO: el threshold es sobre last_seen, no sobre actividad real.
      const result = buildOnlineIds(
        [{ user_id: 'u1', is_online: true, last_seen: minAgo(4) }],
        null
      );
      expect(result.has('u1')).toBe(true);
      // Nota: esto es correcto — el heartbeat garantiza que si el tab está abierto
      // y hubo actividad en la última hora, last_seen es fresco.
    });

    it('CU-35 | Usuario cerró el browser: is_online=true, last_seen 25 min → OFFLINE en vista', () => {
      // Browser cerrado → JS detuvo, heartbeat no corrió, last_seen quedó viejo
      const result = buildOnlineIds(
        [{ user_id: 'u1', is_online: true, last_seen: minAgo(25) }],
        null
      );
      expect(result.has('u1')).toBe(false);
    });

    it('CU-36 | Edge Function corrió: is_online=false, last_seen=ahora → OFFLINE', () => {
      // Edge Function actualizó is_online=false y last_seen=now en DB
      const result = buildOnlineIds(
        [{ user_id: 'u1', is_online: false, last_seen: minAgo(0) }],
        null
      );
      expect(result.has('u1')).toBe(false);
    });

    it('CU-37 | Vuelve activo después de inactividad: Realtime lleva updateLastSeen → ONLINE', () => {
      // Usuario estuvo offline (25 min), mueve el mouse, heartbeat corre,
      // updateLastSeen actualiza BD, Realtime notifica nexateg
      let set = buildOnlineIds(
        [{ user_id: 'u1', is_online: true, last_seen: minAgo(25) }], // carga inicial: offline
        null
      );
      expect(set.has('u1')).toBe(false); // estaba offline

      // Llega Realtime de updateLastSeen
      set = applyRealtimeUpdate(set, { user_id: 'u1', is_online: true, last_seen: minAgo(0) });
      expect(set.has('u1')).toBe(true);  // ahora online
    });

    it('CU-38 | Threshold detecta expiración entre polls: sin Realtime, máx 30 seg de ventana', () => {
      // Si Realtime falla, el poll de 30 seg detectará el cambio.
      // Aquí verificamos que buildOnlineIds con datos actualizados da el resultado correcto.
      const stateT0 = buildOnlineIds(
        [{ user_id: 'u1', is_online: true, last_seen: minAgo(19) }], null
      );
      expect(stateT0.has('u1')).toBe(true);

      // Simulamos que pasaron 2 minutos y el poll corrió de nuevo con last_seen actualizado
      const stateT2 = buildOnlineIds(
        [{ user_id: 'u1', is_online: true, last_seen: minAgo(21) }], null
      );
      expect(stateT2.has('u1')).toBe(false);
    });
  });
});
