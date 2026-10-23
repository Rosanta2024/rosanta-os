/**
 * Vista de COCINA (23-oct-2026, pedido de Juanma por la Central): solo cantidades, sin datos de clientes.
 * Hoy y los proximos 7 dias: reservas y personas por dia, por turno (almuerzo antes de las 16:00, cena despues) y
 * el total de la semana; las fechas bloqueadas (cierres) como una linea aparte.
 *
 *   GET /cocina?u=<enlace de la persona>      la pantalla (telefono o tablet)
 *   GET /api/cocina/semana?u=<…>              los numeros (JSON)
 *
 * Quien entra: el enlace personal de siempre (?u=), con permiso de VER reservas (matriz 024: chef, sala, pauta, dueño).
 * Fuente: con motor_reservas = 'base', la tabla reservas del motor; mientras mande Wix, wix_reservas (el importador
 * del historial la tiene al dia cada 15 min). Nunca devuelve nombres, correos, telefonos ni notas.
 */
const express = require('express');
const C = require('./reservas/comun');

const CORTE_CENA = '16:00';
// Lo que cocina tiene que esperar: confirmadas, por aprobar, sentadas y terminadas. Fuera: canceladas, rechazadas,
// "no vino" y las retenciones de Wix que no terminaron (HELD / PAYMENT_INFORMATION_PENDING).
const CUENTAN_MOTOR = ['confirmada', 'pendiente', 'llego', 'termino'];
const CUENTAN_WIX = ['RESERVED', 'REQUESTED', 'SEATED', 'FINISHED'];

function turnoDe(inicio) { return C.horaGt(inicio) < CORTE_CENA ? 'almuerzo' : 'cena'; }

/** Pura: filas [{ inicio, personas }] y cierres [{ desde, hasta, motivo }] → los 8 dias (hoy + 7) y el total. */
function resumirSemana(filas, cierres, hoy) {
  const dias = [];
  for (let i = 0; i < 8; i++) {
    const f = C.sumarDias(hoy, i);
    dias.push({ fecha: f, almuerzo: { reservas: 0, personas: 0 }, cena: { reservas: 0, personas: 0 }, reservas: 0, personas: 0, bloqueos: [] });
  }
  const porFecha = {}; dias.forEach((d) => { porFecha[d.fecha] = d; });
  (filas || []).forEach((r) => {
    const d = porFecha[C.diaGt(r.inicio)]; if (!d) return;
    const p = Number(r.personas) || 0, t = d[turnoDe(r.inicio)];
    t.reservas++; t.personas += p; d.reservas++; d.personas += p;
  });
  // cierres: [{ desde, hasta (instantes), motivo }]; solo los que CIERRAN (los horarios especiales abiertos no van)
  (cierres || []).forEach((c) => {
    const ini = new Date(c.desde).getTime(), fin = new Date(c.hasta).getTime();
    dias.forEach((d) => {
      const d0 = C.instante(d.fecha, '00:00').getTime(), d1 = d0 + 24 * 3600000;
      if (ini < d1 && fin > d0) {
        const todoElDia = ini <= d0 && fin >= d1;
        d.bloqueos.push({ motivo: String(c.motivo || 'Fecha bloqueada').slice(0, 120), todo_el_dia: todoElDia,
          desde: todoElDia ? null : C.horaGt(Math.max(ini, d0)), hasta: todoElDia ? null : (fin >= d1 ? '24:00' : C.horaGt(fin)) });
      }
    });
  });
  const semana = dias.reduce((s, d) => ({ reservas: s.reservas + d.reservas, personas: s.personas + d.personas,
    almuerzo: s.almuerzo + d.almuerzo.personas, cena: s.cena + d.cena.personas }), { reservas: 0, personas: 0, almuerzo: 0, cena: 0 });
  return { hoy, dias, semana };
}

async function modoMotor(pool) {
  try { const r = await pool.query("SELECT modo FROM interruptores WHERE modulo = 'motor_reservas'"); return (r.rows[0] && r.rows[0].modo) || 'wix'; }
  catch (e) { return 'wix'; }
}

/** Lee la semana desde la fuente que mande hoy. Solo inicio y personas: nada que identifique al cliente. */
async function leerSemana(pool, hoy) {
  const desde = C.instante(hoy, '00:00'), hasta = C.instante(C.sumarDias(hoy, 8), '00:00');
  const modo = await modoMotor(pool);
  const filas = modo === 'base'
    ? (await pool.query('SELECT inicio, personas FROM reservas WHERE inicio >= $1 AND inicio < $2 AND estado = ANY($3)', [desde, hasta, CUENTAN_MOTOR])).rows
    : (await pool.query('SELECT inicio, personas FROM wix_reservas WHERE inicio >= $1 AND inicio < $2 AND estado = ANY($3) AND coalesce(archivada, false) = false', [desde, hasta, CUENTAN_WIX])).rows;
  const cierres = (await pool.query('SELECT desde, hasta, motivo FROM cierres_reservas WHERE activo AND cerrado AND desde < $2 AND hasta > $1', [desde, hasta])).rows;
  return Object.assign(resumirSemana(filas, cierres, hoy), { fuente: modo === 'base' ? 'motor' : 'wix' });
}

const PANTALLA = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>Cocina · reservas de la semana</title>
<style>:root{--fondo:#F0EDE6;--texto:#2f3a33;--verde:#456B50;--linea:#ddd6c8;--suave:#6b7a70}
*{box-sizing:border-box}body{margin:0;background:var(--fondo);color:var(--texto);font:16px/1.4 system-ui,-apple-system,Segoe UI,sans-serif;padding:16px;max-width:640px;margin:auto}
h1{font-size:1.4rem;margin:.2em 0}.sub{color:var(--suave);font-size:.9rem;margin-bottom:12px}
.dia{background:#fff;border:1px solid var(--linea);border-radius:10px;padding:10px 12px;margin:8px 0}.dia.hoy{border:2px solid var(--verde)}
.cab{display:flex;justify-content:space-between;align-items:baseline}.cab b{font-size:1.05rem}.tot{font-size:1.15rem;font-weight:700;color:var(--verde)}
.turnos{display:flex;gap:16px;color:var(--suave);font-size:.95rem;margin-top:2px}.bloq{margin-top:6px;background:#f6e7d8;border-radius:6px;padding:4px 8px;font-size:.9rem}
.semana{background:var(--verde);color:#fff;border-radius:10px;padding:12px;margin-top:12px}.semana b{font-size:1.2rem}.err{color:#a33}</style></head>
<body><h1>Reservas de la semana</h1><div class="sub" id="sub">Cargando…</div><div id="dias"></div><div id="semana"></div>
<script>
(function(){
  var u = new URLSearchParams(location.search).get('u') || '';
  var DIAS = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'], MESES = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  function nombre(f){ var p = f.split('-'), d = new Date(Date.UTC(+p[0], +p[1]-1, +p[2])); return DIAS[d.getUTCDay()] + ' ' + (+p[2]) + ' ' + MESES[+p[1]-1]; }
  function esc(t){ return String(t).replace(/[&<>"]/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }
  function pers(n){ return n + (n === 1 ? ' persona' : ' personas'); }
  fetch('/api/cocina/semana', { headers: { 'x-rosanta-u': u } }).then(function(r){ return r.json().then(function(j){ if(!r.ok) throw new Error(j.error || 'Sin acceso'); return j; }); })
  .then(function(d){
    document.getElementById('sub').textContent = 'Hoy y los próximos 7 días · se actualiza cada vez que abres la página' + (d.fuente === 'wix' ? ' · datos de Wix' : '');
    document.getElementById('dias').innerHTML = d.dias.map(function(x, i){
      return '<div class="dia' + (i === 0 ? ' hoy' : '') + '"><div class="cab"><b>' + (i === 0 ? 'Hoy · ' : '') + esc(nombre(x.fecha)) + '</b><span class="tot">' + pers(x.personas) + '</span></div>' +
        '<div class="turnos"><span>' + x.reservas + (x.reservas === 1 ? ' reserva' : ' reservas') + '</span><span>Almuerzo: ' + x.almuerzo.personas + '</span><span>Cena: ' + x.cena.personas + '</span></div>' +
        x.bloqueos.map(function(b){ return '<div class="bloq">Bloqueado' + (b.todo_el_dia ? '' : ' ' + esc(b.desde || '') + '–' + esc(b.hasta || '')) + ': ' + esc(b.motivo) + '</div>'; }).join('') + '</div>';
    }).join('');
    var s = d.semana;
    document.getElementById('semana').innerHTML = '<div class="semana">Total de la semana: <b>' + pers(s.personas) + '</b> en ' + s.reservas + ' reservas · almuerzo ' + s.almuerzo + ' · cena ' + s.cena + '</div>';
  }).catch(function(e){ document.getElementById('sub').innerHTML = '<span class="err">' + esc(e.message) + '. Abre esta página con tu enlace de la intranet.</span>'; });
})();
</script></body></html>`;

/** deps: { pool, quien(req) → usuario|null, permisos(u, parte, accion) → { ok, motivo }, reloj } */
function crearRutasCocina(deps) {
  const d = deps || {};
  const reloj = d.reloj || (() => Date.now());
  const r = express.Router();
  r.get('/cocina', (req, res) => { res.set('Cache-Control', 'no-store').type('html').send(PANTALLA); });
  r.get('/api/cocina/semana', async (req, res, next) => {
    try {
      const u = await d.quien(req);
      if (!u) return res.status(401).json({ error: 'No pude identificarte' });
      const p = await d.permisos(u, 'reservas', 'ver');
      if (!p || !p.ok) return res.status(403).json({ error: (p && p.motivo) || 'Sin permiso' });
      res.set('Cache-Control', 'no-store').json(await leerSemana(d.pool, C.diaGt(reloj())));
    } catch (e) { next(e); }
  });
  return r;
}

module.exports = { crearRutasCocina, resumirSemana, leerSemana, turnoDe, CUENTAN_MOTOR, CUENTAN_WIX };
