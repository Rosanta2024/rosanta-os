/**
 * Comparación de cada noche de la "sombra viva" (20-oct-2026): lo que habría contestado la nube (bot_sombra_viva)
 * contra lo que contestó de verdad el bot de Apps Script (Conversaciones de Rosanta Leads, la copia que guarda la
 * sombra 2 cada 15 minutos).
 *
 * Por cada mensaje pensado (de hace más de 1 hora, sin comparar):
 *   - real: ¿el bot contestó a ese contacto dentro de los 3 minutos? ¿lo pasó a Juanma (Leads › ¿Humano? = Sí)?
 *   - sombra: ¿habría contestado? ¿lo habría pasado a Juanma?
 *   GRAVE (llega la alerta): uno contesta y el otro no, salvo que una persona estuviera atendiendo ese chat
 *   (hubo un mensaje de la consola o del equipo en las 6 horas antes): ahí el bot real se calla a propósito y la
 *   sombra no lo sabe, así que queda como diferencia leve.
 *   LEVE: los dos contestan pero uno pasa a Juanma y el otro no.
 *   SIN DATO: la copia todavía no tiene ese mensaje del cliente (se reintenta la noche siguiente).
 */
const LEADS_ID = '1CxXcoLP9Fo523QJVLvNDuf_zqiLxWmrUDHLCzVoujrc';
const VENTANA_MS = 3 * 60000, ATENDIA_MS = 6 * 3600000, CLIENTE_MS = 2 * 60000;

/** Las fechas de la copia vienen como {"$d":"2026-10-19T10:40:42"} en hora de Guatemala. */
function ms(v) {
  if (v && typeof v === 'object' && v.$d) return Date.parse(v.$d + '-06:00');
  const t = Date.parse(v);
  return isNaN(t) ? 0 : t;
}

async function compararVivaNoche(deps) {
  const pool = deps.pool;
  const c = await pool.query("SELECT pestana, filas FROM hojas_copia_f2 WHERE libro = $1 AND pestana IN ('Conversaciones', 'Leads')", [LEADS_ID]);
  const copia = {};
  c.rows.forEach((x) => { copia[x.pestana] = typeof x.filas === 'string' ? JSON.parse(x.filas) : x.filas; });
  if (!copia.Conversaciones) throw new Error('La base no tiene la copia de Rosanta Leads (la guarda la sombra 2).');
  const conv = copia.Conversaciones.slice(1).map((r) => ({ t: ms(r[0]), canal: String(r[1]), contacto: String(r[2]), dir: String(r[4]), autor: String(r[5]) }));
  const leads = (copia.Leads || []).slice(1).map((r) => ({ t: ms(r[0]), contacto: String(r[11]), humano: r[9] === 'Sí' }));
  const filas = (await pool.query(`SELECT id, recibido, canal, contacto, respuesta, acciones FROM bot_sombra_viva
    WHERE estado = 'pensado' AND comparado IS NULL AND recibido < now() - interval '1 hour' ORDER BY id LIMIT 500`)).rows;
  const res = { revisadas: 0, iguales: 0, distintas: [], sinDato: 0 };
  for (const f of filas) {
    const t = new Date(f.recibido).getTime();
    const del = conv.filter((x) => x.canal === f.canal && x.contacto === f.contacto);
    if (!del.some((x) => x.dir === 'in' && Math.abs(x.t - t) <= CLIENTE_MS)) { res.sinDato++; continue; }
    const realContesto = del.some((x) => x.dir === 'out' && x.autor === 'bot' && x.t >= t - 5000 && x.t <= t + VENTANA_MS);
    const atendia = del.some((x) => x.dir === 'out' && x.autor !== 'bot' && x.t < t && x.t >= t - ATENDIA_MS);
    const realHumano = leads.some((x) => x.contacto === f.contacto && x.humano && x.t >= t - 5000 && x.t <= t + VENTANA_MS);
    const acc = typeof f.acciones === 'string' ? JSON.parse(f.acciones || '{}') : (f.acciones || {});
    const sombraContesto = !!String(f.respuesta || '').trim();
    const sombraHumano = !!acc.humano;
    let comparado = 'igual', grave = false;
    if (realContesto !== sombraContesto) {
      grave = !atendia;
      comparado = 'distinto: sombra ' + (sombraContesto ? 'contesta' : 'se calla') + ', real ' + (realContesto ? 'contesta' : 'se calla') + (atendia ? ' (atendía una persona)' : '');
    } else if (realHumano !== sombraHumano) {
      comparado = 'distinto: sombra ' + (sombraHumano ? 'pasa a Juanma' : 'no pasa') + ', real ' + (realHumano ? 'pasa a Juanma' : 'no pasa');
    }
    await pool.query('UPDATE bot_sombra_viva SET comparado = $2, grave = $3 WHERE id = $1', [f.id, comparado, grave]);
    res.revisadas++;
    if (comparado === 'igual') res.iguales++; else res.distintas.push({ id: Number(f.id), canal: f.canal, comparado, grave });
  }
  const graves = res.distintas.filter((d) => d.grave).length;
  return Object.assign({ ok: graves === 0, graves }, res);
}

module.exports = { compararVivaNoche, ms };
