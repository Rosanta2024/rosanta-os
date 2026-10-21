/**
 * Rosanta Adventures (AYUDANTE 4, 21-oct-2026). Estudio §3.9. Tablas: migracion 055.
 *
 * Actividades (Acatenango y otros volcanes, fincas de cafe, viajes dentro de Guatemala) que OPERAN OPERADORES ALIADOS,
 * no Rosanta. Rosanta las recomienda, recibe la consulta, se la pasa al operador con su codigo de referido y mide.
 * Sin cobro por ahora. Lo edita SOLO el dueño (operadores y experiencias, desde "Contenido web").
 *
 * - Ninguna ficha sale al sitio si su operador no esta activo con licencia de INGUAT y seguro VIGENTES.
 * - Tarea diaria (revisarVencimientos): aviso a Juanma 30 dias antes de que venza la licencia o el seguro; si vence,
 *   el operador pasa a 'vencido' y sus fichas salen del sitio: se publica de nuevo la ULTIMA VERSION PUBLICADA sin
 *   ellas (no el borrador, que puede tener cambios sin revisar).
 * - Consulta publica (POST /api/adventures/consulta): crea el lead y llama a ganchos INYECTADOS: pipeline de eventos
 *   (tipo "adventure"), aviso a Juanma y, si pidio cena, crearReserva del motor de reservas (AYUDANTE 1). Si un gancho
 *   falla, el lead queda igual y se anota que fallo.
 * - Cada ficha se exporta con schema.org TouristTrip (+ Offer de referencia y FAQPage) y el aviso legal del operador.
 */
const P = require('./permisos');
const { r2 } = require('./almacen-web');
const { formatDate } = require('./motor-pagos');

const ZONA = 'America/Guatemala';
const SITIO = 'https://rosanta.rest';
const DIAS_AVISO = 30;
const IDIOMAS = { es: { es: 'Español', en: 'Spanish' }, en: { es: 'Inglés', en: 'English' }, fr: { es: 'Francés', en: 'French' },
  de: { es: 'Alemán', en: 'German' }, it: { es: 'Italiano', en: 'Italian' }, pt: { es: 'Portugués', en: 'Portuguese' } };
const DIFICULTAD = { facil: { es: 'Fácil', en: 'Easy' }, moderada: { es: 'Moderada', en: 'Moderate' }, dificil: { es: 'Difícil', en: 'Challenging' }, muy_dificil: { es: 'Muy difícil', en: 'Very challenging' } };
const REQUISITOS = ['inguat_registro', 'guias_carne', 'seguro_rc_accidentes', 'patente_rtu', 'protocolo_seguridad', 'contacto_emergencia', 'acuerdo_firmado', 'resenas'];
const ESTADOS_LEAD = ['nuevo', 'pasado_al_operador', 'confirmado', 'vendido', 'perdido'];

function error(status, msg) { const e = new Error(msg); e.status = status; return e; }
const hoyGT = (d) => formatDate(d || new Date(), ZONA, 'yyyy-MM-dd');
const dia = (x) => (x === null || x === undefined || x === '' ? null : (typeof x === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x) ? x : formatDate(new Date(x), ZONA, 'yyyy-MM-dd')));
const masDias = (d, n) => formatDate(new Date(new Date(d + 'T12:00:00-06:00').getTime() + n * 86400000), ZONA, 'yyyy-MM-dd');
const limpio = (x, n) => String(x === undefined || x === null ? '' : x).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, n);
const correoValido = (x) => /^[^\s@<>]+@[^\s@<>]+\.[A-Za-z]{2,}$/.test(x) && x.length <= 200;

// ---------------------------------------------------------------- reglas del operador

/** ¿Se puede publicar? → { ok, motivo }. Licencia y seguro con numero y fecha, vigentes hoy, y estado activo. */
function operadorPublicable(op, hoy) {
  const h = hoy || hoyGT();
  if (!op) return { ok: false, motivo: 'sin operador' };
  if (!op.licencia_inguat || !op.licencia_vence) return { ok: false, motivo: 'falta la licencia de INGUAT' };
  if (!op.seguro_poliza || !op.seguro_vence) return { ok: false, motivo: 'falta el seguro' };
  if (dia(op.licencia_vence) < h) return { ok: false, motivo: 'la licencia de INGUAT venció el ' + dia(op.licencia_vence) };
  if (dia(op.seguro_vence) < h) return { ok: false, motivo: 'el seguro venció el ' + dia(op.seguro_vence) };
  if (op.estado !== 'activo') return { ok: false, motivo: 'el operador está ' + op.estado };
  return { ok: true };
}

/** Aviso legal de la ficha y del formulario (texto base del estudio; lo revisa el abogado). */
function avisoLegal(op) {
  const reg = op.licencia_inguat ? ' registrada en INGUAT con el n.º ' + op.licencia_inguat : '';
  const regEn = op.licencia_inguat ? ', registered with INGUAT under no. ' + op.licencia_inguat : '';
  return {
    es: 'Esta actividad la organiza y opera ' + op.nombre + ', empresa independiente' + reg + '. Rosanta solo la recomienda y no es responsable de su ejecución, seguridad ni cobro. Condiciones, seguros y cancelación: las del operador.',
    en: 'This activity is organized and operated by ' + op.nombre + ', an independent company' + regEn + '. Rosanta only recommends it and is not responsible for its operation, safety or payment. Terms, insurance and cancellation are those of the operator.'
  };
}

/** schema.org TouristTrip (+ Offer de referencia y FAQPage) de una ficha ya armada, en un idioma. */
function schemaExperiencia(x, idioma) {
  const L = idioma === 'es' ? 'es' : 'en';
  const url = SITIO + (L === 'es' ? '/es' : '') + '/adventures/' + x.slug;
  const trip = {
    '@context': 'https://schema.org', '@type': 'TouristTrip', '@id': url + '#trip', url, name: x.titulo[L], description: x.descripcion[L],
    inLanguage: L, availableLanguage: x.idiomas.map((i) => (IDIOMAS[i] ? IDIOMAS[i].en : i)),
    provider: { '@type': 'Organization', name: x.operador.nombre },
    disambiguatingDescription: x.aviso_legal[L]
  };
  if (x.foto) trip.image = [x.foto.url].concat(x.galeria.map((f) => f.url));
  if (x.duracion[L]) trip.additionalProperty = [{ '@type': 'PropertyValue', name: L === 'es' ? 'Duración' : 'Duration', value: x.duracion[L] }];
  if (x.punto_salida[L]) trip.itinerary = { '@type': 'Place', name: x.punto_salida[L] };
  if (x.precio_ref_q != null) trip.offers = { '@type': 'Offer', price: x.precio_ref_q.toFixed(2), priceCurrency: 'GTQ', url,
    description: L === 'es' ? 'Precio de referencia por persona; lo confirma el operador.' : 'Reference price per person; confirmed by the operator.',
    offeredBy: { '@type': 'Organization', name: x.operador.nombre } };
  const out = [trip];
  if (x.faq.length) out.push({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: x.faq.map((q) => ({ '@type': 'Question', name: q.pregunta[L],
    acceptedAnswer: { '@type': 'Answer', text: q.respuesta[L] } })) });
  return out;
}

/**
 * Las fichas publicables, con el formato del sitio. experiencias y operadores: filas de la base; foto(id) → foto armada.
 * Devuelve { experiencias: [...], fuera: ['slug: motivo'] }.
 */
function armarExperiencias(experiencias, operadores, foto, tc, hoy) {
  const opPor = {}; operadores.forEach((o) => { opPor[o.id] = o; });
  const dos = (f, b) => ({ es: f[b + '_es'] || '', en: f[b + '_en'] || '' });
  const out = [], fuera = [];
  experiencias.filter((e) => e.activa).sort((a, b) => (a.orden - b.orden) || (a.id - b.id)).forEach((e) => {
    const op = opPor[e.operador_id];
    const p = operadorPublicable(op, hoy);
    if (!p.ok) { fuera.push(e.slug + ': ' + p.motivo); return; }
    const x = { id: e.id, orden: e.orden, slug: e.slug, ruta: { en: '/adventures/' + e.slug, es: '/es/adventures/' + e.slug },
      titulo: dos(e, 'titulo'), descripcion: dos(e, 'descripcion'), duracion: dos(e, 'duracion'), incluye: dos(e, 'incluye'),
      punto_salida: dos(e, 'punto_salida'), temporada: dos(e, 'temporada'), dificultad: e.dificultad, dificultad_texto: DIFICULTAD[e.dificultad],
      idiomas: e.idiomas || [], precio_ref_q: e.precio_ref_q == null ? null : Number(e.precio_ref_q), precio_usd_ref: e.precio_ref_q == null || !tc ? null : Math.round(e.precio_ref_q / tc),
      foto: foto(e.foto_id), galeria: (e.galeria || []).map(foto).filter(Boolean), faq: Array.isArray(e.faq) ? e.faq : [],
      operador: { id: op.id, nombre: op.nombre, licencia_inguat: op.licencia_inguat, codigo_referido: op.codigo_referido },
      aviso_legal: avisoLegal(op) };
    x.schema = { es: schemaExperiencia(x, 'es'), en: schemaExperiencia(x, 'en') };
    out.push(x);
  });
  return { experiencias: out, fuera };
}

// ---------------------------------------------------------------- servicio

/**
 * crearAdventures({ almacen, matriz, contenido, ganchos, ahora })
 *   contenido: el servicio de contenido-web.js (para la pausa automatica: publicarAjusteSistema)
 *   ganchos: { pipeline(lead) → { id }, avisarJuanma({ asunto, texto, lead? }) → any, crearReserva(cena) → { id, estado } }
 *            todos opcionales; en pruebas, dobles. Nunca se llaman con red desde aca.
 */
function crearAdventures(deps) {
  const al = deps.almacen;
  const ahora = () => (deps.ahora ? deps.ahora() : new Date());
  const M = () => (typeof deps.matriz === 'function' ? deps.matriz() : deps.matriz);
  const exigir = (u, accion) => { const r = P.puede(M(), u, 'web', accion); if (!r.ok) throw error(403, r.motivo); };
  const g = deps.ganchos || {};

  async function llamar(nombre, arg) {
    if (typeof g[nombre] !== 'function') return { estado: 'sin_gancho' };
    try { return Object.assign({ estado: 'ok' }, await g[nombre](arg)); } catch (e) { return { estado: 'error', detalle: String(e.message || e).slice(0, 300) }; }
  }

  /** La consulta del formulario publico. Solo para fichas que estan publicadas (o publicables) hoy. */
  async function consulta(d) {
    const x = d || {};
    const en = x.idioma !== 'es';
    const t = (es, ing) => (en ? ing : es);
    if (x.sitio_web) throw error(400, t('No se pudo.', 'Could not send.'));   // campo trampa
    const exp = await al.uno('web_experiencias', { slug: limpio(x.experiencia, 80).toLowerCase() });
    const op = exp && await al.uno('operadores_aliados', { id: exp.operador_id });
    const hoy = hoyGT(ahora());
    if (!exp || !exp.activa || !operadorPublicable(op, hoy).ok) throw error(404, t('Esa experiencia no está disponible.', 'That experience is not available.'));
    const lead = {
      experiencia_id: exp.id, operador_id: op.id, codigo_referido: op.codigo_referido,
      nombre: limpio(x.nombre, 120), email: limpio(x.email, 200).toLowerCase(), telefono: limpio(x.telefono, 30) || null, idioma: en ? 'en' : 'es',
      fecha_deseada: x.fecha ? String(x.fecha).slice(0, 10) : null, personas: x.personas ? Number(x.personas) : null, mensaje: limpio(x.mensaje, 1000),
      combinar_cena: !!x.cena, origen_trafico: x.origen && typeof x.origen === 'object' ? Object.fromEntries(Object.entries(x.origen).slice(0, 12).map(([k, v]) => [limpio(k, 40), limpio(v, 200)])) : {}
    };
    if (!lead.nombre || !correoValido(lead.email)) throw error(400, t('Falta tu nombre o un correo válido.', 'Your name and a valid email are required.'));
    if (lead.fecha_deseada && (!/^\d{4}-\d{2}-\d{2}$/.test(lead.fecha_deseada) || lead.fecha_deseada < hoy)) throw error(400, t('La fecha no es válida.', 'Invalid date.'));
    if (lead.personas !== null && !(Number.isInteger(lead.personas) && lead.personas >= 1 && lead.personas <= 50)) throw error(400, t('¿Cuántas personas? (1 a 50)', 'How many people? (1 to 50)'));
    if (lead.combinar_cena) {
      const c = x.cena || {};
      lead.cena_fecha = String(c.fecha || '').slice(0, 10); lead.cena_hora = String(c.hora || '').slice(0, 5); lead.cena_personas = Number(c.personas || lead.personas || 2);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(lead.cena_fecha) || lead.cena_fecha < hoy || !/^\d{2}:\d{2}$/.test(lead.cena_hora)) throw error(400, t('Falta la fecha y hora de la cena.', 'Please choose the dinner date and time.'));
      if (!(Number.isInteger(lead.cena_personas) && lead.cena_personas >= 1 && lead.cena_personas <= 50)) throw error(400, t('¿Para cuántos la cena?', 'Dinner for how many?'));
    }
    const fila = await al.insertar('leads_adventures', lead);
    // Ganchos (despues de guardar: si alguno falla, el lead no se pierde)
    const ganchos = {};
    const resumen = { id: Number(fila.id), tipo: 'adventure',   // Number: pg devuelve el bigserial como texto y rosanta-clientes exige un entero
      experiencia: exp.slug, titulo: exp.titulo_es, operador: op.nombre, codigo_referido: op.codigo_referido,
      nombre: lead.nombre, email: lead.email, telefono: lead.telefono, idioma: lead.idioma, fecha: lead.fecha_deseada, personas: lead.personas, mensaje: lead.mensaje,
      cena: lead.combinar_cena ? { fecha: lead.cena_fecha, hora: lead.cena_hora, personas: lead.cena_personas } : null, origen: lead.origen_trafico };
    ganchos.pipeline = await llamar('pipeline', resumen);
    const cambios = { pipeline_id: ganchos.pipeline.id ? String(ganchos.pipeline.id) : null };
    let cena = null;
    if (lead.combinar_cena) {
      ganchos.reserva = await llamar('crearReserva', { fecha: lead.cena_fecha, hora: lead.cena_hora, personas: lead.cena_personas, nombre: lead.nombre, email: lead.email,
        telefono: lead.telefono, idioma: lead.idioma, origen: 'adventures', codigo: op.codigo_referido, nota: 'Después de: ' + exp.titulo_es });
      const r = ganchos.reserva;
      cambios.cena_reserva_id = r.id ? String(r.id) : null;
      cambios.cena_estado = r.estado === 'ok' ? (r.id ? (r.pendiente ? 'pendiente' : 'reservada') : (r.motivo === 'sin_disponibilidad' ? 'sin_disponibilidad' : 'pendiente'))
        : (r.estado === 'sin_gancho' ? 'pendiente' : 'error');
      cena = { estado: cambios.cena_estado };
    }
    ganchos.aviso = await llamar('avisarJuanma', { asunto: 'Adventures: consulta por ' + exp.titulo_es, lead: resumen });
    cambios.ganchos = ganchos;
    cambios.actualizado = ahora().toISOString();
    await al.actualizar('leads_adventures', fila.id, cambios);
    return { ok: true, id: fila.id, cena, mensaje: t('¡Gracias! Te escribimos pronto con la propuesta del operador.', 'Thank you! We will write to you soon with the operator’s proposal.') };
  }

  async function leads(u, filtro) {
    exigir(u, 'ver');
    const f = {};
    if (filtro && filtro.estado && ESTADOS_LEAD.indexOf(filtro.estado) !== -1) f.estado = filtro.estado;
    if (filtro && filtro.operador_id) f.operador_id = Number(filtro.operador_id);
    return al.lista('leads_adventures', f, { orden: ['id DESC'], limite: 300 });
  }

  /** El dueño mueve el lead y registra la venta y la comision (si no la escribe, se calcula con el acuerdo). */
  async function actualizarLead(u, id, d) {
    exigir(u, 'ingresar');
    const x = d || {};
    return al.transaccion(async (tx) => {
      const lead = await tx.uno('leads_adventures', { id: Number(id) }, { bloquear: true });
      if (!lead) throw error(404, 'No existe esa consulta.');
      const c = {};
      if (x.estado !== undefined) { if (ESTADOS_LEAD.indexOf(x.estado) === -1) throw error(400, 'Estado inválido.'); c.estado = x.estado; }
      const num = (v, n) => { if (v === null || v === '') return null; const k = Number(String(v).replace(/[Q,\s]/g, '')); if (!(k >= 0)) throw error(400, n + ' inválido.'); return r2(k); };
      if (x.venta_q !== undefined) c.venta_q = num(x.venta_q, 'Monto de venta');
      if (x.comision_q !== undefined) c.comision_q = num(x.comision_q, 'Comisión');
      if (x.nota !== undefined) c.nota = limpio(x.nota, 1000);
      const estado = c.estado || lead.estado, venta = c.venta_q !== undefined ? c.venta_q : lead.venta_q;
      if (estado === 'vendido' && c.comision_q === undefined && lead.comision_q == null && venta != null) {
        const op = await tx.uno('operadores_aliados', { id: lead.operador_id });
        if (op && op.comision_tipo === 'porcentaje' && op.comision_valor != null) c.comision_q = r2(venta * op.comision_valor / 100);
        if (op && op.comision_tipo === 'fijo' && op.comision_valor != null) c.comision_q = r2(op.comision_valor * (lead.personas || 1));
      }
      if (c.comision_q != null && lead.comision_registrada == null) c.comision_registrada = ahora().toISOString();
      if (!Object.keys(c).length) throw error(400, 'No mandaste nada para cambiar.');
      c.actualizado = ahora().toISOString();
      const r = await tx.actualizar('leads_adventures', lead.id, c);
      await tx.insertar('web_bitacora', { quien: u.email, rol: String(u.rol || ''), accion: 'editar', tabla: 'leads_adventures', registro_id: String(lead.id), antes: r.antes, despues: r.despues });
      return r.despues;
    });
  }

  /** Comisiones y leads por operador (medicion de un sentido; el otro, reservas con origen + codigo, es del motor). */
  async function resumenOperadores(u) {
    exigir(u, 'ver');
    const [ops, ls] = await Promise.all([al.lista('operadores_aliados'), al.lista('leads_adventures')]);
    return ops.map((o) => {
      const mios = ls.filter((l) => l.operador_id === o.id);
      return { id: o.id, nombre: o.nombre, codigo_referido: o.codigo_referido, estado: o.estado, leads: mios.length,
        vendidos: mios.filter((l) => l.estado === 'vendido').length, comision_q: r2(mios.reduce((a, l) => a + (Number(l.comision_q) || 0), 0)),
        cenas: mios.filter((l) => l.cena_estado === 'reservada').length, publicable: operadorPublicable(o, hoyGT(ahora())) };
    });
  }

  /**
   * Tarea diaria. Aviso a 30 dias (una vez por fecha de vencimiento) y pausa si vencio. Si un operador se pausa y la
   * version publicada tiene fichas suyas, se publica de nuevo esa misma version sin ellas.
   */
  async function revisarVencimientos() {
    const hoy = hoyGT(ahora()), limite = masDias(hoy, DIAS_AVISO);
    const out = { avisos: [], pausados: [], republicada: null };
    for (const op of await al.lista('operadores_aliados')) {
      const fechas = [['licencia de INGUAT', dia(op.licencia_vence)], ['seguro', dia(op.seguro_vence)]].filter((f) => f[1]);
      const vencidos = fechas.filter((f) => f[1] < hoy);
      if (vencidos.length && op.estado === 'activo') {
        await al.actualizar('operadores_aliados', op.id, { estado: 'vencido', actualizado: ahora().toISOString(), actualizado_por: 'sistema' });
        await al.insertar('web_bitacora', { quien: 'sistema', rol: 'sistema', accion: 'editar', tabla: 'operadores_aliados', registro_id: String(op.id),
          antes: { estado: op.estado }, despues: { estado: 'vencido', motivo: vencidos.map((f) => f[0] + ' ' + f[1]).join(', ') } });
        const texto = op.nombre + ': venció ' + vencidos.map((f) => 'la ' + f[0] + ' (' + f[1] + ')').join(' y ') + '. Sus fichas salieron del sitio.';
        out.pausados.push({ id: op.id, nombre: op.nombre, texto });
        await llamar('avisarJuanma', { asunto: 'Adventures: operador pausado', texto });
        continue;
      }
      if (op.estado !== 'activo') continue;
      const proximo = fechas.filter((f) => f[1] <= limite).sort((a, b) => (a[1] < b[1] ? -1 : 1))[0];
      if (proximo && dia(op.aviso_vencimiento) !== proximo[1]) {
        const texto = op.nombre + ': la ' + proximo[0] + ' vence el ' + proximo[1] + '. Pedile la renovación; si vence, sus fichas salen del sitio solas.';
        await llamar('avisarJuanma', { asunto: 'Adventures: vence ' + proximo[0], texto });
        await al.actualizar('operadores_aliados', op.id, { aviso_vencimiento: proximo[1] });
        out.avisos.push({ id: op.id, nombre: op.nombre, texto });
      }
    }
    if (out.pausados.length && deps.contenido) {
      const pub = await deps.contenido.publicado();
      const ids = out.pausados.map((p) => p.id);
      if (pub && pub.adventures && pub.adventures.experiencias.some((x) => ids.indexOf(x.operador.id) !== -1)) {
        const c = JSON.parse(JSON.stringify(pub));
        ['version', 'publicada', 'huella'].forEach((k) => delete c[k]);
        c.adventures.experiencias = c.adventures.experiencias.filter((x) => ids.indexOf(x.operador.id) === -1);
        out.republicada = await deps.contenido.publicarAjusteSistema(c, 'Pausa automática: ' + out.pausados.map((p) => p.nombre).join(', ') + ' (licencia o seguro vencido)');
      }
    }
    return out;
  }

  return { consulta, leads, actualizarLead, resumenOperadores, revisarVencimientos };
}

module.exports = { crearAdventures, armarExperiencias, operadorPublicable, avisoLegal, schemaExperiencia, IDIOMAS, DIFICULTAD, REQUISITOS, ESTADOS_LEAD, DIAS_AVISO };
