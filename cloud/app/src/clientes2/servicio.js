/**
 * Clientes › Bot y Clientes › Reseñas y encuesta, en SOMBRA (19-oct-2026). Solo el dueño (matriz 020).
 *
 *   consola: la consola de respuestas REAL (consola-de-respuestas-rosanta: getThreads, getMensajes,
 *            getFicha = "lo que ya sabe el bot") sobre la copia de Rosanta Leads y del pipeline.
 *            Mandar, devolver al bot y mandar fotos responden 409: se siguen haciendo en la consola de siempre.
 *            botSombra: la comparacion de cada noche del bot en sombra (tablas bot_corridas y bot_turnos).
 *   resenas: el panel de reseñas REAL (panel-de-reseas-de-google; TripAdvisor se quito el 20-oct, decision de Juanma). getDatosDashboard
 *            sale de la hoja de control (el panel de siempre lo pide en vivo a Google Business, que el servidor
 *            no puede). Publicar, guardar y regenerar responden 409.
 *            encuesta: las respuestas de la encuesta (la encuesta no cambia: solo 5 estrellas van a Google).
 */
const { crearMotorGas } = require('./motor-gas');
const { GBP_ID, ENCUESTA_ID } = require('./partes');

const LEADS_ID = '1CxXcoLP9Fo523QJVLvNDuf_zqiLxWmrUDHLCzVoujrc';
const MKT_ID = '1wxsMm1Vx7tUci3ErQGa4SiGftZ21vTrxYqAObiEooyc';

const FUNCIONES = {
  consola: { lectura: ['getThreads', 'getMensajes', 'getFicha', 'botSombra', 'botSombraTurnos'],
    escritura: ['enviarMensaje', 'devolverAlBot', 'enviarImagen'],
    aviso: 'Prueba en sombra: desde aquí no se manda nada. Contesta desde la consola de siempre.' },
  resenas: { lectura: ['getDatosDashboard', 'encuesta'],
    escritura: ['publicarDesdePanel', 'editarRespuestaPublicada', 'guardarBorrador', 'regenerarBorrador', 'descartarBorrador'],
    aviso: 'Prueba en sombra: desde aquí no se publica ni se guarda nada. Usa el panel de reseñas de siempre.' }
};

function error(status, msg) { const e = new Error(msg); e.status = status; return e; }

/** getDatosDashboard sin la API de Google: las reseñas que el bot de reseñas fue anotando en la hoja de control. */
function datosDesdeHoja(filas) {
  if (!filas || filas.length < 2) return { average: 0, total: 0, fetched: 0, dist: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }, reviews: [], fuente: 'hoja' };
  const h = filas[0].map((x) => String(x).trim());
  const c = (n) => h.indexOf(n);
  const porId = new Map();
  filas.slice(1).forEach((f) => {
    const id = String(f[c('ReviewId')] || '');
    if (!id) return;
    const estado = String(f[c('Estado')] || '');
    porId.set(id, {   // si un id se repite gana la fila mas nueva (como mapaBorradores_)
      id, stars: Number(f[c('Estrellas')]) || 0, name: String(f[c('Cliente')] || 'Anónimo'), comment: String(f[c('Reseña original')] || ''),
      time: f[c('Fecha detectada')] instanceof Date ? f[c('Fecha detectada')].toISOString() : String(f[c('Fecha detectada')] || ''),
      hasReply: estado.indexOf('PUBLICADA') === 0, reply: estado.indexOf('PUBLICADA') === 0 ? String(f[c('Respuesta (editable)')] || '') : '',
      borrador: estado.indexOf('PUBLICADA') === 0 ? '' : String(f[c('Respuesta (editable)')] || ''), estado
    });
  });
  const reviews = Array.from(porId.values()).sort((a, b) => (a.time < b.time ? 1 : -1));
  const dist = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let suma = 0;
  reviews.forEach((r) => { if (dist[r.stars] !== undefined) { dist[r.stars]++; suma += r.stars; } });
  const n = reviews.filter((r) => r.stars).length;
  return { average: n ? Math.round(suma / n * 100) / 100 : 0, total: reviews.length, fetched: reviews.length, dist, reviews, fuente: 'hoja' };
}

/** La encuesta: respuestas mas nuevas primero, promedio y cuantas fueron de 5 (las que el formulario manda a Google). */
function datosEncuesta(filas) {
  const out = { respuestas: [], promedio: 0, cinco: 0, total: 0 };
  if (!filas || filas.length < 2) return out;
  filas.slice(1).forEach((f) => {
    const cal = Number(f[1]) || 0;
    if (!f[0] && !cal) return;
    out.respuestas.push({ fecha: f[0] instanceof Date ? f[0].toISOString() : String(f[0] || ''), calificacion: cal, comentario: String(f[2] || '') });
  });
  out.respuestas.reverse();
  out.total = out.respuestas.length;
  const con = out.respuestas.filter((r) => r.calificacion);
  out.promedio = con.length ? Math.round(con.reduce((a, r) => a + r.calificacion, 0) / con.length * 100) / 100 : 0;
  out.cinco = con.filter((r) => r.calificacion >= 5).length;
  return out;
}

/**
 * crearServicioClientes2({ pool, copia, puede }) — copia(): { libros, leida } de la sombra 2;
 * puede(usuario, parte): la matriz.
 */
function crearServicioClientes2(deps) {
  let cache = { leida: null, consola: null, resenas: null };
  function motores() {
    const c = deps.copia() || {};
    if (!c.libros) throw error(503, 'El servidor nuevo todavía está cargando la copia de las hojas.');
    if (cache.leida !== c.leida || !cache.consola) {
      cache = { leida: c.leida, consola: null, resenas: null };
      if (c.libros[LEADS_ID]) {
        cache.consola = crearMotorGas({ proyecto: 'consola-de-respuestas-rosanta', archivos: ['Code.js'], libros: c.libros, activo: LEADS_ID });
      }
      if (c.libros[GBP_ID]) {
        cache.resenas = crearMotorGas({ proyecto: 'panel-de-reseas-de-google', archivos: ['Bot de Reseñas de Google.js', 'PanelServidor.js'],
          libros: c.libros, props: { SHEET_ID: GBP_ID } });
      }
    }
    return { c, consola: cache.consola, resenas: cache.resenas };
  }

  async function llamar(usuario, parte, nombre, args) {
    const F = FUNCIONES[parte];
    if (!F) throw error(404, 'Esa parte no existe.');
    if (!deps.puede(usuario, parte)) throw error(403, 'Tu cuenta no tiene esta parte de Clientes.');
    if (F.escritura.includes(nombre)) throw error(409, F.aviso);
    if (!F.lectura.includes(nombre)) throw error(404, 'Esa función no está disponible en el servidor nuevo.');
    const a = Array.isArray(args) ? args : [];
    if (nombre === 'botSombra') return botSombra();
    if (nombre === 'botSombraTurnos') return botSombraTurnos(Number(a[0]) || 0);
    const m = motores();
    if (parte === 'consola') {
      if (!m.consola) throw error(503, 'Todavía no hay copia de Rosanta Leads.');
      return m.consola[nombre].apply(null, a.slice(0, 3));
    }
    if (nombre === 'encuesta') {
      const e = m.c.libros[ENCUESTA_ID];
      if (!e) throw error(503, 'Todavía no hay copia de la encuesta (falta compartir la hoja con el servidor como Lector).');
      return datosEncuesta(e['Encuesta 2026']);
    }
    if (!m.resenas) throw error(503, 'Todavía no hay copia de la hoja de reseñas (falta compartirla con el servidor como Lector).');
    return datosDesdeHoja(m.c.libros[GBP_ID]['Reseñas']);   // getDatosDashboard
  }

  async function botSombra() {
    const r = await deps.pool.query(`SELECT id, to_char(cuando AT TIME ZONE 'America/Guatemala', 'YYYY-MM-DD HH24:MI') AS cuando, modo,
      to_char(desde AT TIME ZONE 'America/Guatemala', 'YYYY-MM-DD HH24:MI') AS desde, to_char(hasta AT TIME ZONE 'America/Guatemala', 'YYYY-MM-DD HH24:MI') AS hasta,
      version_bot, resumen, costo_usd FROM bot_corridas ORDER BY id DESC LIMIT 40`);
    return r.rows.map((x) => { const s = x.resumen || {}; return { id: Number(x.id), cuando: x.cuando, modo: x.modo, desde: x.desde, hasta: x.hasta,
      version: x.version_bot, costo: Number(x.costo_usd || 0), chats: s.chats, turnos: s.turnos, iguales: s.iguales, contesto: s.contesto,
      accion: s.accion, juanma: s.juanma, reservas: s.reservas, errores: s.errores, diferencias: (s.diferencias || []).length, modeloFallas: s.modeloFallas || 0 }; });
  }

  async function botSombraTurnos(corrida) {
    const r = await deps.pool.query(`SELECT chat, canal, nombre, to_char(t AT TIME ZONE 'America/Guatemala', 'YYYY-MM-DD HH24:MI') AS t, cliente, real, sombra, diferencias
      FROM bot_turnos WHERE corrida = $1 ORDER BY t`, [corrida]);
    return r.rows;
  }

  return { llamar, FUNCIONES };
}

module.exports = { crearServicioClientes2, datosDesdeHoja, datosEncuesta, FUNCIONES, LEADS_ID, MKT_ID };
