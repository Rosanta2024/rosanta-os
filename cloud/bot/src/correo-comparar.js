/**
 * Comparación de cada noche del correo en SOMBRA (20-oct-2026).
 *
 * Con bot_correo='sombra' la nube anota en bot_correo_sombra lo que HABRÍA hecho con cada correo de cliente. De noche,
 * para cada fila 'respuesta' o 'borrador' sin comparar y de hace más de 2 horas, se mira el hilo en Gmail (solo lectura)
 * y se decide qué hizo de verdad el bot de Apps Script con ese mensaje:
 *   'respuesta' hay un mensaje nuestro (@rosanta.rest, no borrador) después del mensaje del cliente;
 *   'borrador'  hay un borrador después del mensaje del cliente;
 *   'nada'      ninguna de las dos.
 * Si la sombra también anotó el aviso "🔔 Lead para atender (correo)" para ese cliente, se busca en Gmail el aviso real
 * (24 h alrededor de la fila). Resultado en la columna comparado: 'igual' o 'distinto: sombra=X real=Y'.
 *
 * GRAVE (ok=false → 409 → llega la alerta): la sombra contestaría sola y el real dejó borrador o nada, o al revés
 * (el real contestó y la sombra no hizo nada). Un error de Gmail con una fila también da ok=false; la fila queda sin
 * comparar y se reintenta la noche siguiente.
 */
const ESPERA_MS = 2 * 3600 * 1000;
const DIA_MS = 24 * 3600 * 1000;
const VENTANA_SIN_HILO_MS = 30 * 60 * 1000;   // sin el mensaje del cliente, "después" = desde media hora antes de la fila
const MAX_FILAS = 200;
const ASUNTO_AVISO = 'Lead para atender (correo)';

/** El correo de "Nombre <x@y>" (o x@y), en minúsculas. */
function correoDe(s) {
  const t = String(s || '');
  const m = t.match(/<([^>]+@[^>]+)>/) || t.match(/[^\s<>"',;]+@[^\s<>"',;]+/);
  return m ? (m[1] || m[0]).trim().toLowerCase() : '';
}
const esNuestro = (from) => /@rosanta\.rest\b/i.test(String(from || ''));
const esBorrador = (m) => !!(m.isDraft && m.isDraft());
const fechaMs = (m) => m.getDate().getTime();

/** Lo que hizo el real entre los mensajes msgs posteriores a ref (ms). paraQuien: solo mensajes a ese correo (sin hilo). */
function decidir(msgs, ref, paraQuien) {
  const despues = msgs.filter((m) => fechaMs(m) > ref && (!paraQuien || String(m.getTo ? m.getTo() : '').toLowerCase().indexOf(paraQuien) >= 0));
  if (despues.some((m) => !esBorrador(m) && esNuestro(m.getFrom()))) return 'respuesta';
  if (despues.some(esBorrador)) return 'borrador';
  return 'nada';
}

/** Qué hizo el bot real con el mensaje de la fila. */
function queHizoReal(gmail, fila, email) {
  const cuando = new Date(fila.cuando).getTime();
  if (fila.hilo) {
    const hilo = gmail.getThreadById(fila.hilo);
    if (!hilo) return 'sin hilo';
    const msgs = hilo.getMessages();
    const cliente = msgs.find((m) => m.getId() === fila.mensaje);
    return decidir(msgs, cliente ? fechaMs(cliente) : cuando - VENTANA_SIN_HILO_MS);
  }
  // Borrador nuevo sin hilo (chat de Wix / openwidget: GmailApp.createDraft al correo del visitante).
  if (!email) return 'sin hilo';
  const desde = Math.floor((cuando - VENTANA_SIN_HILO_MS) / 1000);
  const msgs = [];
  gmail.search('{in:drafts in:sent} to:' + email + ' after:' + desde, 0, 20).forEach((h) => msgs.push(...h.getMessages()));
  return decidir(msgs, cuando - VENTANA_SIN_HILO_MS, email);
}

/** ¿Llegó el aviso real "🔔 Lead para atender (correo) — <email>" dentro de las 24 h alrededor de la fila? */
function hayAvisoReal(gmail, email, cuando) {
  const desde = cuando - DIA_MS, hasta = cuando + DIA_MS;
  const q = 'subject:"' + ASUNTO_AVISO + '" "' + email + '" after:' + Math.floor(desde / 1000) + ' before:' + Math.ceil(hasta / 1000);
  return gmail.search(q, 0, 20).some((h) => h.getMessages().some((m) => {
    const t = fechaMs(m);
    const asunto = String(m.getSubject() || '');
    return !esBorrador(m) && esNuestro(m.getFrom()) && t >= desde && t <= hasta &&
      asunto.indexOf(ASUNTO_AVISO) >= 0 && asunto.toLowerCase().indexOf(email) >= 0;
  }));
}

/** La sombra contestaría sola y el real dejó borrador o nada, o el real contestó y la sombra no hizo nada. */
function esGrave(sombra, real) {
  return (sombra === 'respuesta' && (real === 'borrador' || real === 'nada')) || (real === 'respuesta' && sombra === 'nada');
}

/**
 * compararCorreoNoche({ pool, gmail, ahora }) — gmail: GmailApp de gmail-sincrono con escribir:false.
 * → { ok, revisadas, iguales, distintas: [{ id, hilo, comparado, grave }], errores: [{ id, error }] }
 */
async function compararCorreoNoche(deps) {
  const ahora = deps.ahora || Date.now();
  const { rows } = await deps.pool.query(`SELECT id, cuando, tipo, hilo, mensaje, para FROM bot_correo_sombra
    WHERE tipo IN ('respuesta', 'borrador') AND comparado IS NULL AND cuando < $1 ORDER BY id LIMIT ${MAX_FILAS}`, [new Date(ahora - ESPERA_MS)]);
  const r = { ok: true, revisadas: 0, iguales: 0, distintas: [], errores: [] };
  if (!rows.length) return r;
  const masVieja = Math.min(...rows.map((f) => new Date(f.cuando).getTime()));
  const avisos = (await deps.pool.query(`SELECT cuando, asunto FROM bot_correo_sombra WHERE tipo = 'aviso' AND cuando >= $1`,
    [new Date(masVieja - DIA_MS)])).rows.map((a) => ({ t: new Date(a.cuando).getTime(), asunto: String(a.asunto || '').toLowerCase() }));

  for (const f of rows) {
    const cuando = new Date(f.cuando).getTime();
    const email = correoDe(f.para);
    let comparado, grave;
    try {
      const real = queHizoReal(deps.gmail, f, email);
      const sombraAviso = !!email && avisos.some((a) => Math.abs(a.t - cuando) <= DIA_MS && a.asunto.indexOf(email) >= 0);
      const realAviso = sombraAviso && hayAvisoReal(deps.gmail, email, cuando);
      const s = f.tipo + (sombraAviso ? '+aviso' : '');
      const x = real + (realAviso ? '+aviso' : '');
      grave = esGrave(f.tipo, real);
      comparado = s === x ? 'igual' : 'distinto: sombra=' + s + ' real=' + x;
    } catch (e) {
      r.errores.push({ id: f.id, error: String(e.message).slice(0, 200) });
      continue;
    }
    await deps.pool.query('UPDATE bot_correo_sombra SET comparado = $2 WHERE id = $1', [f.id, comparado]);
    r.revisadas++;
    if (comparado === 'igual') r.iguales++;
    else r.distintas.push({ id: f.id, hilo: f.hilo, comparado, grave });
  }
  r.ok = !r.errores.length && !r.distintas.some((d) => d.grave);
  return r;
}

module.exports = { compararCorreoNoche, correoDe, esGrave, ESPERA_MS };
