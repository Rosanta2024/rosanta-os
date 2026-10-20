/**
 * "Contenido web": lo que Juanma y el equipo cambian del sitio nuevo sin programar (20-oct-2026, AYUDANTE 4).
 * Estudio "Web propia sin Wix" §3.1. Tablas: migracion 053. Formato que lee el sitio: web/contenido/FORMATO.md.
 *
 * - Las tablas web_* son el BORRADOR. Vanessa y Dani (rol pauta) y el dueño lo editan.
 * - "Publicar" (solo el dueño) arma el contenido entero, lo guarda como version nueva y llama al gancho que
 *   reconstruye el sitio. El sitio lee siempre la ultima version publicada.
 * - "Volver a esta version" (solo el dueño) publica de nuevo una version vieja y deja el borrador igual a ella.
 * - Cambiar un PRECIO es del dueño (accion precio_venta de la matriz), aunque el texto lo edite cualquiera.
 * - Cada cambio queda en web_bitacora. Nada se borra: retirar = activo false.
 *
 * Permisos (propuesta para la sesion C, ver permisos-web.js): parte 'web' (ver / ingresar = editar el
 * borrador) y la accion solo-dueño 'publicar_web'.
 */
const crypto = require('crypto');
const P = require('./permisos');
const { r2 } = require('./almacen-web');

const FORMATO = 1;

// Lista fija de alergenos (los 14 de la norma europea, que es la que reconocen los turistas) y etiquetas.
const ALERGENOS = {
  gluten: { es: 'Gluten', en: 'Gluten' }, crustaceos: { es: 'Crustáceos', en: 'Crustaceans' }, huevo: { es: 'Huevo', en: 'Egg' },
  pescado: { es: 'Pescado', en: 'Fish' }, cacahuate: { es: 'Cacahuate (maní)', en: 'Peanuts' }, soya: { es: 'Soya', en: 'Soy' },
  lacteos: { es: 'Lácteos', en: 'Dairy' }, frutos_secos: { es: 'Frutos secos', en: 'Tree nuts' }, apio: { es: 'Apio', en: 'Celery' },
  mostaza: { es: 'Mostaza', en: 'Mustard' }, sesamo: { es: 'Ajonjolí', en: 'Sesame' }, sulfitos: { es: 'Sulfitos', en: 'Sulphites' },
  altramuces: { es: 'Altramuces', en: 'Lupin' }, moluscos: { es: 'Moluscos', en: 'Molluscs' }
};
const ETIQUETAS = {
  vegetariano: { es: 'Vegetariano', en: 'Vegetarian' }, vegano: { es: 'Vegano', en: 'Vegan' }, sin_gluten: { es: 'Sin gluten', en: 'Gluten free' },
  picante: { es: 'Picante', en: 'Spicy' }, de_la_casa: { es: 'De la casa', en: 'House favorite' }
};

// Lo que se edita en la pantalla. campos: lo que el equipo puede cambiar; crear: lo que hace falta para crear.
const TIPOS = {
  paginas: { tabla: 'web_paginas', llave: 'clave', activo: 'activa', crearSoloDueno: true,
    crear: ['clave', 'ruta_en', 'ruta_es'], campos: ['titulo_en', 'titulo_es', 'descripcion_en', 'descripcion_es', 'foto_id', 'orden', 'ruta_en', 'ruta_es'] },
  bloques: { tabla: 'web_bloques', llave: 'id', activo: 'activo',
    crear: ['pagina', 'clave'], campos: ['tipo', 'texto_en', 'texto_es', 'enlace', 'foto_id', 'orden'] },
  secciones: { tabla: 'web_menu_secciones', llave: 'id', activo: 'activa',
    crear: ['clave', 'nombre_en', 'nombre_es'], campos: ['nombre_en', 'nombre_es', 'nota_en', 'nota_es', 'orden'] },
  platos: { tabla: 'web_menu_platos', llave: 'id', activo: 'activo',
    crear: ['seccion_id', 'nombre_en', 'nombre_es'], campos: ['seccion_id', 'nombre_en', 'nombre_es', 'descripcion_en', 'descripcion_es', 'precio_q', 'alergenos', 'etiquetas', 'foto_id', 'orden'] },
  faq: { tabla: 'web_faq', llave: 'id', activo: 'activa',
    crear: ['pregunta_en', 'pregunta_es', 'respuesta_en', 'respuesta_es'], campos: ['categoria', 'pregunta_en', 'pregunta_es', 'respuesta_en', 'respuesta_es', 'orden'] },
  eventos: { tabla: 'web_eventos', llave: 'id', activo: 'activo',
    crear: ['slug', 'titulo_en', 'titulo_es', 'inicio'], campos: ['titulo_en', 'titulo_es', 'descripcion_en', 'descripcion_es', 'inicio', 'fin', 'precio_q', 'cupo', 'foto_id', 'enlace', 'orden'] },
  fotos: { tabla: 'web_fotos', llave: 'id', activo: 'activa', sinCrear: true, campos: ['alt_es', 'alt_en'] }
};
const CAMPOS_PRECIO = ['precio_q'];

function error(status, msg) { const e = new Error(msg); e.status = status; return e; }

// ------------------------------------------------------------------------------------------------ validar

const LARGO = { titulo_en: 120, titulo_es: 120, descripcion_en: 320, descripcion_es: 320, texto_en: 6000, texto_es: 6000, nota_en: 400, nota_es: 400,
  nombre_en: 120, nombre_es: 120, pregunta_en: 300, pregunta_es: 300, respuesta_en: 3000, respuesta_es: 3000, alt_en: 200, alt_es: 200, categoria: 40 };

/** Un valor que manda la pantalla → el valor para la base (o error 400 en cristiano). */
function limpiarCampo(campo, v) {
  if (v === undefined) return undefined;
  if (['foto_id', 'seccion_id', 'cupo'].indexOf(campo) !== -1) {
    if (v === null || v === '') return null;
    const n = Number(v); if (!Number.isInteger(n) || n <= 0) throw error(400, campo + ': tiene que ser un número entero.');
    return n;
  }
  if (campo === 'orden') { const n = Number(v); if (!Number.isInteger(n)) throw error(400, 'El orden es un número entero.'); return n; }
  if (campo === 'precio_q') {
    if (v === null || v === '') return null;
    const n = Number(String(v).replace(/[Q,\s]/g, '')); if (!isFinite(n) || n < 0 || n > 100000) throw error(400, 'Precio inválido: ' + v);
    return r2(n);
  }
  if (campo === 'alergenos' || campo === 'etiquetas') {
    const lista = Array.isArray(v) ? v : String(v || '').split(',');
    const permitidos = campo === 'alergenos' ? ALERGENOS : ETIQUETAS;
    const out = Array.from(new Set(lista.map((x) => String(x).trim()).filter(Boolean)));
    const mal = out.filter((x) => !permitidos[x]);
    if (mal.length) throw error(400, 'No conozco: ' + mal.join(', ') + '. Usá: ' + Object.keys(permitidos).join(', '));
    return out;
  }
  if (campo === 'inicio' || campo === 'fin') {
    if (v === null || v === '') { if (campo === 'inicio') throw error(400, 'Falta la fecha del evento.'); return null; }
    // "2026-12-31T19:30" (hora de Guatemala) o ISO con zona
    const s = String(v);
    const d = /[zZ]|[+-]\d\d:\d\d$/.test(s) ? new Date(s) : new Date(s + (s.length <= 10 ? 'T00:00' : '') + ':00-06:00');
    if (isNaN(d)) throw error(400, 'Fecha inválida: ' + s);
    return d.toISOString();
  }
  if (campo === 'enlace') {
    if (v === null || v === '') return null;
    const s = String(v).trim();
    if (!/^(https:\/\/|\/|mailto:|tel:)/.test(s) || /^\/\//.test(s)) throw error(400, 'El enlace empieza con https://, con / (una página del sitio), mailto: o tel:.');
    return s.slice(0, 500);
  }
  if (campo === 'tipo') { if (['texto', 'parrafo', 'foto', 'enlace'].indexOf(v) === -1) throw error(400, 'Tipo de bloque inválido.'); return v; }
  if (campo === 'clave' || campo === 'slug' || campo === 'pagina') {
    const s = String(v || '').trim().toLowerCase();
    if (!/^[a-z0-9][a-z0-9_.-]*$/.test(s) || s.length > 60) throw error(400, campo + ': solo minúsculas, números y guiones.');
    return s;
  }
  if (campo === 'ruta_en' || campo === 'ruta_es') {
    const s = String(v || '').trim();
    if (!/^\/[^\s?#]*$/.test(s)) throw error(400, 'La ruta empieza con /.');
    return s;
  }
  // texto
  const s = String(v === null ? '' : v).replace(/\r\n/g, '\n');
  if (LARGO[campo] && s.length > LARGO[campo]) throw error(400, campo + ': máximo ' + LARGO[campo] + ' caracteres.');
  return s;
}

// ------------------------------------------------------------------------------------------------ armar

const dosIdiomas = (f, base) => ({ es: f[base + '_es'] || '', en: f[base + '_en'] || '' });
const porOrden = (a, b) => (a.orden - b.orden) || (String(a.id || a.clave) < String(b.id || b.clave) ? -1 : 1);
const usd = (q, tc) => (q == null || !tc ? null : Math.round(q / tc));

/** Lee el borrador y arma el contenido con el formato del sitio (FORMATO.md). Solo lo activo. */
async function armarContenido(al) {
  const [paginas, bloques, fotos, secciones, platos, faq, eventos, ajustes] = await Promise.all([
    al.lista('web_paginas'), al.lista('web_bloques'), al.lista('web_fotos'), al.lista('web_menu_secciones'),
    al.lista('web_menu_platos'), al.lista('web_faq'), al.lista('web_eventos'), al.lista('web_ajustes')]);
  const aj = {}; ajustes.forEach((a) => { aj[a.clave] = a.valor; });
  const tc = Number(aj.tipo_cambio_usd && aj.tipo_cambio_usd.q_por_usd) || null;
  const fotoPorId = {}; fotos.forEach((f) => { fotoPorId[f.id] = f; });
  const foto = (id) => {
    const f = id && fotoPorId[id];
    if (!f || !f.activa) return null;
    return { id: f.id, url: f.url, url_chica: f.url_chica || f.url, ancho: f.ancho, alto: f.alto, alt: dosIdiomas(f, 'alt') };
  };
  const out = { formato: FORMATO, ajustes: { tipo_cambio_usd: tc }, paginas: {}, menu: [], faq: [], eventos: [], alergenos: ALERGENOS, etiquetas: ETIQUETAS };
  paginas.filter((p) => p.activa).sort(porOrden).forEach((p) => {
    const bl = {};
    bloques.filter((b) => b.activo && b.pagina === p.clave).sort(porOrden).forEach((b) => {
      const x = { id: b.id, tipo: b.tipo, orden: b.orden, es: b.texto_es, en: b.texto_en };
      if (b.tipo === 'enlace') x.enlace = b.enlace;
      if (b.tipo === 'foto') x.foto = foto(b.foto_id);
      bl[b.clave] = x;
    });
    out.paginas[p.clave] = { orden: p.orden, ruta: { en: p.ruta_en, es: p.ruta_es }, seo: { titulo: dosIdiomas(p, 'titulo'), descripcion: dosIdiomas(p, 'descripcion'), foto: foto(p.foto_id) }, bloques: bl };
  });
  secciones.filter((s) => s.activa).sort(porOrden).forEach((s) => {
    out.menu.push({ id: s.id, clave: s.clave, orden: s.orden, nombre: dosIdiomas(s, 'nombre'), nota: dosIdiomas(s, 'nota'),
      platos: platos.filter((p) => p.activo && p.seccion_id === s.id).sort(porOrden).map((p) => ({
        id: p.id, orden: p.orden, nombre: dosIdiomas(p, 'nombre'), descripcion: dosIdiomas(p, 'descripcion'),
        precio_q: p.precio_q == null ? null : Number(p.precio_q), precio_usd_ref: usd(p.precio_q, tc),
        alergenos: p.alergenos || [], etiquetas: p.etiquetas || [], foto: foto(p.foto_id) })) });
  });
  faq.filter((f) => f.activa).sort(porOrden).forEach((f) => out.faq.push({ id: f.id, orden: f.orden, categoria: f.categoria, pregunta: dosIdiomas(f, 'pregunta'), respuesta: dosIdiomas(f, 'respuesta') }));
  eventos.filter((e) => e.activo).sort((a, b) => (new Date(a.inicio) - new Date(b.inicio)) || porOrden(a, b)).forEach((e) => out.eventos.push({
    id: e.id, orden: e.orden, slug: e.slug, titulo: dosIdiomas(e, 'titulo'), descripcion: dosIdiomas(e, 'descripcion'),
    inicio: new Date(e.inicio).toISOString(), fin: e.fin ? new Date(e.fin).toISOString() : null,
    precio_q: e.precio_q == null ? null : Number(e.precio_q), precio_usd_ref: usd(e.precio_q, tc), cupo: e.cupo, foto: foto(e.foto_id), enlace: e.enlace }));
  if (aj.giftcards) out.giftcards = aj.giftcards;
  return out;
}

/** Lo que falta para publicar (textos sin traducir, fotos rotas). Lista vacia = se puede. */
function faltantes(c) {
  const f = [];
  const par = (x, donde) => { if (!String(x.es || '').trim() || !String(x.en || '').trim()) f.push(donde + ': falta ' + (!String(x.es || '').trim() ? 'el español' : 'el inglés')); };
  Object.keys(c.paginas).forEach((k) => {
    const p = c.paginas[k];
    par(p.seo.titulo, 'Página ' + k + ' › título');
    Object.keys(p.bloques).forEach((b) => {
      const x = p.bloques[b];
      if (x.tipo === 'foto') { if (!x.foto) f.push('Página ' + k + ' › ' + b + ': falta la foto'); }
      else par(x, 'Página ' + k + ' › ' + b);
      if (x.tipo === 'enlace' && !x.enlace) f.push('Página ' + k + ' › ' + b + ': falta a dónde lleva el botón');
    });
  });
  c.menu.forEach((s) => { par(s.nombre, 'Menú › ' + s.clave); s.platos.forEach((p) => par(p.nombre, 'Menú › ' + s.clave + ' › plato ' + p.id)); });
  c.faq.forEach((q) => { par(q.pregunta, 'Pregunta ' + q.id); par(q.respuesta, 'Pregunta ' + q.id + ' › respuesta'); });
  c.eventos.forEach((e) => par(e.titulo, 'Evento ' + e.slug));
  return f;
}

function jsonEstable(x) {
  if (Array.isArray(x)) return '[' + x.map(jsonEstable).join(',') + ']';
  if (x && typeof x === 'object') return '{' + Object.keys(x).sort().map((k) => JSON.stringify(k) + ':' + jsonEstable(x[k])).join(',') + '}';
  return JSON.stringify(x === undefined ? null : x);
}
const huella = (c) => crypto.createHash('sha256').update(jsonEstable(c)).digest('hex');

// ------------------------------------------------------------------------------------------------ servicio

/**
 * crearContenidoWeb({ almacen, matriz, fotos, reconstruir, ahora })
 *   almacen: crearAlmacenPg(pool) o crearAlmacenMemoria()
 *   matriz:  la de permisos.js (cargarDeBase) — con las filas de 'web' (propuesta en permisos-web.js)
 *   fotos:   adaptador { guardar(ruta, buffer, tipo) → url } (adaptadores-web.js)
 *   reconstruir: adaptador { reconstruir({ version_id, huella }) → { estado, detalle } }
 */
function crearContenidoWeb(deps) {
  const al = deps.almacen;
  const M = () => (typeof deps.matriz === 'function' ? deps.matriz() : deps.matriz);
  const rolDe = (u) => String(u && u.rol || '');
  const exigir = (u, accion) => {
    const r = P.puede(M(), u, 'web', accion);
    if (!r.ok) throw error(403, r.motivo);
  };
  const quien = (u) => u.email;
  const anotar = (tx, u, accion, tabla, id, antes, despues) => tx.insertar('web_bitacora', { quien: quien(u), rol: rolDe(u), accion, tabla, registro_id: String(id), antes: antes || null, despues: despues || null });

  function tipo(nombre) { const t = TIPOS[nombre]; if (!t) throw error(404, 'No existe ' + nombre + '.'); return t; }

  /** Todo el borrador, para la pantalla (incluye lo retirado). */
  async function borrador(u) {
    exigir(u, 'ver');
    const out = {};
    for (const k of Object.keys(TIPOS)) out[k] = await al.lista(TIPOS[k].tabla, {}, { orden: TIPOS[k].llave === 'clave' ? ['orden', 'clave'] : ['orden', 'id'] });
    const aj = await al.lista('web_ajustes');
    out.ajustes = Object.fromEntries(aj.map((a) => [a.clave, a.valor]));
    out.alergenos = ALERGENOS; out.etiquetas = ETIQUETAS;
    const ult = await al.lista('web_versiones', {}, { orden: ['id DESC'], limite: 1 });
    out.ultima_version = ult[0] ? { id: ult[0].id, publicada: ult[0].publicada, publicada_por: ult[0].publicada_por, huella: ult[0].huella } : null;
    out.cambios_sin_publicar = !ult[0] || huella(await armarContenido(al)) !== ult[0].huella;
    const pm = P.puede(M(), u, 'web', 'publicar_web'), pr = P.puede(M(), u, 'web', 'precio_venta');
    out.yo = { puede_editar: P.puede(M(), u, 'web', 'ingresar').ok, puede_publicar: pm.ok, puede_precios: pr.ok };
    return out;
  }

  async function crear(u, nombre, datos) {
    const t = tipo(nombre);
    if (t.sinCrear) throw error(400, 'Las fotos se agregan subiéndolas.');
    exigir(u, 'ingresar');
    if (t.crearSoloDueno) exigir(u, 'publicar_web');
    const fila = {};
    t.crear.concat(t.campos).forEach((c) => { const v = limpiarCampo(c, (datos || {})[c]); if (v !== undefined) fila[c] = v; });
    t.crear.forEach((c) => { if (fila[c] === undefined || fila[c] === null || fila[c] === '') throw error(400, 'Falta ' + c + '.'); });
    if (CAMPOS_PRECIO.some((c) => fila[c] !== undefined && fila[c] !== null)) exigir(u, 'precio_venta');
    fila.actualizado_por = quien(u);
    return al.transaccion(async (tx) => {
      await chequearReferencias(tx, fila);
      let nueva;
      try { nueva = await tx.insertar(t.tabla, fila); } catch (e) { if (e.code === '23505') throw error(409, 'Ya existe uno con esa clave.'); throw e; }
      await anotar(tx, u, 'crear', t.tabla, nueva[t.llave], null, nueva);
      return nueva;
    });
  }

  async function chequearReferencias(tx, fila) {
    if (fila.foto_id) { const f = await tx.uno('web_fotos', { id: fila.foto_id }); if (!f || !f.activa) throw error(400, 'Esa foto no existe o está retirada.'); }
    if (fila.seccion_id) { const s = await tx.uno('web_menu_secciones', { id: fila.seccion_id }); if (!s) throw error(400, 'Esa sección del menú no existe.'); }
    if (fila.pagina) { const p = await tx.uno('web_paginas', { clave: fila.pagina }); if (!p) throw error(400, 'Esa página no existe.'); }
  }

  async function editar(u, nombre, llave, datos) {
    const t = tipo(nombre);
    exigir(u, 'ingresar');
    const cambios = {};
    t.campos.forEach((c) => { const v = limpiarCampo(c, (datos || {})[c]); if (v !== undefined) cambios[c] = v; });
    if (!Object.keys(cambios).length) throw error(400, 'No mandaste nada para cambiar.');
    const id = t.llave === 'id' ? Number(llave) : String(llave);
    return al.transaccion(async (tx) => {
      const antes = await tx.uno(t.tabla, { [t.llave]: id }, { bloquear: true });
      if (!antes) throw error(404, 'No existe.');
      const cambiaPrecio = CAMPOS_PRECIO.some((c) => c in cambios && cambios[c] !== (antes[c] == null ? null : Number(antes[c])));
      if (cambiaPrecio) exigir(u, 'precio_venta');
      if (['paginas'].indexOf(nombre) !== -1 && ('ruta_en' in cambios || 'ruta_es' in cambios) && (cambios.ruta_en !== antes.ruta_en || cambios.ruta_es !== antes.ruta_es)) exigir(u, 'publicar_web');
      await chequearReferencias(tx, cambios);
      if (t.tabla !== 'web_fotos') { cambios.actualizado = new Date().toISOString(); cambios.actualizado_por = quien(u); }
      const r = await tx.actualizar(t.tabla, id, cambios);
      await anotar(tx, u, 'editar', t.tabla, id, r.antes, r.despues);
      return r.despues;
    });
  }

  async function activar(u, nombre, llave, activo) {
    const t = tipo(nombre);
    exigir(u, 'ingresar');
    if (nombre === 'paginas') exigir(u, 'publicar_web');
    const id = t.llave === 'id' ? Number(llave) : String(llave);
    return al.transaccion(async (tx) => {
      const antes = await tx.uno(t.tabla, { [t.llave]: id }, { bloquear: true });
      if (!antes) throw error(404, 'No existe.');
      const cambios = { [t.activo]: !!activo };
      if (t.tabla !== 'web_fotos') { cambios.actualizado = new Date().toISOString(); cambios.actualizado_por = quien(u); }
      const r = await tx.actualizar(t.tabla, id, cambios);
      await anotar(tx, u, activo ? 'reactivar' : 'retirar', t.tabla, id, r.antes, r.despues);
      return r.despues;
    });
  }

  /** Ajustes: tipo de cambio de referencia (dueño, precio_venta). */
  async function ajustar(u, clave, valor) {
    exigir(u, 'precio_venta');
    if (clave === 'tipo_cambio_usd') {
      const q = Number(valor && valor.q_por_usd);
      if (!(q > 5 && q < 12)) throw error(400, 'El tipo de cambio va en quetzales por dólar (por ejemplo 7.70).');
      valor = { q_por_usd: Math.round(q * 10000) / 10000, fecha: new Date().toISOString().slice(0, 10) };
    } else if (clave === 'giftcards') {
      valor = require('./giftcards').validarAjustesGiftcards(valor);
    } else throw error(400, 'Ajuste desconocido: ' + clave);
    return al.transaccion(async (tx) => {
      const antes = await tx.uno('web_ajustes', { clave }, { bloquear: true });
      const r = antes ? (await tx.actualizar('web_ajustes', clave, { valor, actualizado: new Date().toISOString(), actualizado_por: quien(u) })).despues
        : await tx.insertar('web_ajustes', { clave, valor, actualizado_por: quien(u) });
      await anotar(tx, u, 'ajuste', 'web_ajustes', clave, antes ? antes.valor : null, valor);
      return r;
    });
  }

  /**
   * Sube una foto ya achicada por el navegador. buffer: los bytes; tipo: image/webp|jpeg|png.
   * La misma foto dos veces (misma huella) devuelve la que ya estaba.
   */
  async function subirFoto(u, buffer, o) {
    exigir(u, 'ingresar');
    const opc = o || {};
    const tipoReal = tipoDeImagen(buffer);
    if (!tipoReal) throw error(400, 'Eso no es una foto (JPG, PNG o WebP).');
    if (buffer.length > 5 * 1024 * 1024) throw error(413, 'La foto pesa más de 5 MB: la pantalla la tendría que haber achicado.');
    const dims = medidas(buffer, tipoReal) || { ancho: Number(opc.ancho) || null, alto: Number(opc.alto) || null };
    if (dims.ancho && (dims.ancho > 4000 || dims.alto > 4000)) throw error(400, 'La foto es demasiado grande (máximo 4000 px).');
    const h = crypto.createHash('sha256').update(buffer).digest('hex');
    if (opc.chicaDe) {
      const madre = await al.uno('web_fotos', { id: Number(opc.chicaDe) });
      if (!madre) throw error(404, 'No existe esa foto.');
      const ruta = madre.ruta.replace(/\.(webp|jpg|png)$/, '') + '-chica.' + ext(tipoReal);
      const url = await deps.fotos.guardar(ruta, buffer, tipoReal);
      return al.transaccion(async (tx) => {
        const r = await tx.actualizar('web_fotos', madre.id, { url_chica: url });
        await anotar(tx, u, 'subir_foto', 'web_fotos', madre.id, r.antes, r.despues);
        return r.despues;
      });
    }
    const ya = await al.uno('web_fotos', { huella: h });
    if (ya) return ya;
    const d = new Date();
    const ruta = 'web/fotos/' + d.getUTCFullYear() + '/' + String(d.getUTCMonth() + 1).padStart(2, '0') + '/' + h.slice(0, 20) + '.' + ext(tipoReal);
    const url = await deps.fotos.guardar(ruta, buffer, tipoReal);
    return al.transaccion(async (tx) => {
      const f = await tx.insertar('web_fotos', { ruta, url, ancho: dims.ancho, alto: dims.alto, bytes: buffer.length, tipo: tipoReal, huella: h,
        alt_es: limpiarCampo('alt_es', opc.alt_es || ''), alt_en: limpiarCampo('alt_en', opc.alt_en || ''), subida_por: quien(u) });
      await anotar(tx, u, 'subir_foto', 'web_fotos', f.id, null, f);
      return f;
    });
  }

  /** Vista previa: el contenido del borrador con el mismo formato que el sitio, y lo que falta. */
  async function vistaPrevia(u) {
    exigir(u, 'ver');
    const c = await armarContenido(al);
    return { contenido: c, faltan: faltantes(c), huella: huella(c) };
  }

  async function guardarVersion(u, contenido, nota, restauradaDe) {
    const h = huella(contenido);
    const v = await al.transaccion(async (tx) => {
      const ult = await tx.lista('web_versiones', {}, { orden: ['id DESC'], limite: 1 });
      if (ult[0] && ult[0].huella === h && !restauradaDe) throw error(409, 'No hay cambios desde la versión ' + ult[0].id + '.');
      const fila = await tx.insertar('web_versiones', { publicada_por: quien(u), nota: String(nota || '').slice(0, 300), formato: FORMATO, contenido, huella: h, restaurada_de: restauradaDe || null });
      await anotar(tx, u, restauradaDe ? 'volver_atras' : 'publicar', 'web_versiones', fila.id, restauradaDe ? { version: restauradaDe } : null, { version: fila.id, huella: h });
      return fila;
    });
    // El gancho va DESPUES de guardar: si falla, la version queda y se puede volver a pedir.
    let rec;
    try { rec = deps.reconstruir ? await deps.reconstruir.reconstruir({ version_id: v.id, huella: h }) : { estado: 'sin_gancho' }; }
    catch (e) { rec = { estado: 'error', detalle: String(e.message || e).slice(0, 500) }; }
    const est = ['pedida', 'error', 'sin_gancho'].indexOf(rec.estado) !== -1 ? rec.estado : 'pedida';
    await al.actualizar('web_versiones', v.id, { reconstruccion: est, reconstruccion_detalle: rec.detalle || null });
    return { version: v.id, huella: h, reconstruccion: est, detalle: rec.detalle || null };
  }

  /** Publicar: solo el dueño. Falla (400) si falta algo, con la lista. */
  async function publicar(u, nota) {
    exigir(u, 'publicar_web');
    const c = await armarContenido(al);
    const f = faltantes(c);
    if (f.length) { const e = error(400, 'Antes de publicar falta: ' + f.slice(0, 8).join(' · ') + (f.length > 8 ? ' (y ' + (f.length - 8) + ' más)' : '')); e.faltan = f; throw e; }
    return guardarVersion(u, c, nota, null);
  }

  /** Volver a una version vieja: se publica de nuevo y el borrador queda igual a ella. Solo el dueño. */
  async function volverA(u, versionId, nota) {
    exigir(u, 'publicar_web');
    const v = await al.uno('web_versiones', { id: Number(versionId) });
    if (!v) throw error(404, 'No existe la versión ' + versionId + '.');
    await al.transaccion(async (tx) => { await restaurarBorrador(tx, u, v.contenido); });
    return guardarVersion(u, v.contenido, nota || ('Vuelta a la versión ' + v.id), v.id);
  }

  /** Deja las tablas del borrador como dice `c` (lo que no esta en c queda retirado). */
  async function restaurarBorrador(tx, u, c) {
    const actualizar = async (tabla, llave, id, cambios) => {
      const antes = await tx.uno(tabla, { [llave]: id }, { bloquear: true });
      if (!antes) return;   // (no pasa: nada se borra)
      const distinto = Object.keys(cambios).some((k) => jsonEstable(norm(antes[k])) !== jsonEstable(norm(cambios[k])));
      if (!distinto) return;
      if (tabla !== 'web_fotos') { cambios.actualizado = new Date().toISOString(); cambios.actualizado_por = quien(u); }
      const r = await tx.actualizar(tabla, id, cambios);
      await anotar(tx, u, 'volver_atras', tabla, id, r.antes, r.despues);
    };
    const norm = (x) => (x instanceof Date ? x.toISOString() : (typeof x === 'string' && /^\d{4}-\d\d-\d\dT/.test(x) ? new Date(x).toISOString() : x));
    const fid = (f) => (f ? f.id : null);
    // paginas y bloques
    for (const p of await tx.lista('web_paginas')) {
      const x = c.paginas[p.clave];
      await actualizar('web_paginas', 'clave', p.clave, x ? { activa: true, orden: x.orden, ruta_en: x.ruta.en, ruta_es: x.ruta.es, titulo_en: x.seo.titulo.en, titulo_es: x.seo.titulo.es,
        descripcion_en: x.seo.descripcion.en, descripcion_es: x.seo.descripcion.es, foto_id: fid(x.seo.foto) } : { activa: false });
    }
    const bloquesEn = {}; Object.keys(c.paginas).forEach((k) => { const bl = c.paginas[k].bloques; Object.keys(bl).forEach((cl, i) => { bloquesEn[bl[cl].id] = Object.assign({ clave: cl, i }, bl[cl]); }); });
    for (const b of await tx.lista('web_bloques')) {
      const x = bloquesEn[b.id];
      await actualizar('web_bloques', 'id', b.id, x ? { activo: true, tipo: x.tipo, texto_es: x.es, texto_en: x.en, enlace: x.tipo === 'enlace' ? x.enlace : b.enlace, foto_id: x.tipo === 'foto' ? fid(x.foto) : b.foto_id, orden: x.orden } : { activo: false });
    }
    const secEn = {}, platoEn = {};
    c.menu.forEach((s, i) => { secEn[s.id] = Object.assign({ i }, s); s.platos.forEach((p, j) => { platoEn[p.id] = Object.assign({ j, seccion_id: s.id }, p); }); });
    for (const s of await tx.lista('web_menu_secciones')) {
      const x = secEn[s.id];
      await actualizar('web_menu_secciones', 'id', s.id, x ? { activa: true, orden: x.orden, nombre_es: x.nombre.es, nombre_en: x.nombre.en, nota_es: x.nota.es, nota_en: x.nota.en } : { activa: false });
    }
    for (const p of await tx.lista('web_menu_platos')) {
      const x = platoEn[p.id];
      await actualizar('web_menu_platos', 'id', p.id, x ? { activo: true, orden: x.orden, seccion_id: x.seccion_id, nombre_es: x.nombre.es, nombre_en: x.nombre.en, descripcion_es: x.descripcion.es, descripcion_en: x.descripcion.en,
        precio_q: x.precio_q, alergenos: x.alergenos, etiquetas: x.etiquetas, foto_id: fid(x.foto) } : { activo: false });
    }
    const faqEn = {}; c.faq.forEach((q) => { faqEn[q.id] = q; });
    for (const q of await tx.lista('web_faq')) {
      const x = faqEn[q.id];
      await actualizar('web_faq', 'id', q.id, x ? { activa: true, orden: x.orden, categoria: x.categoria, pregunta_es: x.pregunta.es, pregunta_en: x.pregunta.en, respuesta_es: x.respuesta.es, respuesta_en: x.respuesta.en } : { activa: false });
    }
    const evEn = {}; c.eventos.forEach((e) => { evEn[e.id] = e; });
    for (const e of await tx.lista('web_eventos')) {
      const x = evEn[e.id];
      await actualizar('web_eventos', 'id', e.id, x ? { activo: true, orden: x.orden, titulo_es: x.titulo.es, titulo_en: x.titulo.en, descripcion_es: x.descripcion.es, descripcion_en: x.descripcion.en,
        inicio: x.inicio, fin: x.fin, precio_q: x.precio_q, cupo: x.cupo, foto_id: fid(x.foto), enlace: x.enlace } : { activo: false });
    }
  }

  async function versiones(u) {
    exigir(u, 'ver');
    const v = await al.lista('web_versiones', {}, { orden: ['id DESC'], limite: 50 });
    return v.map((x) => ({ id: x.id, publicada: x.publicada, publicada_por: x.publicada_por, nota: x.nota, huella: x.huella, restaurada_de: x.restaurada_de, reconstruccion: x.reconstruccion, reconstruccion_detalle: x.reconstruccion_detalle }));
  }

  async function bitacora(u, limite) {
    exigir(u, 'ver');
    return al.lista('web_bitacora', {}, { orden: ['id DESC'], limite: Math.min(Number(limite) || 100, 500) });
  }

  /** Lo que lee el sitio: la ultima version publicada (o una en particular). Sin identificarse. */
  async function publicado(versionId) {
    const v = versionId ? await al.uno('web_versiones', { id: Number(versionId) }) : (await al.lista('web_versiones', {}, { orden: ['id DESC'], limite: 1 }))[0];
    if (!v) return null;
    return Object.assign({}, v.contenido, { version: v.id, publicada: new Date(v.publicada).toISOString(), huella: v.huella });
  }

  return { borrador, crear, editar, activar, ajustar, subirFoto, vistaPrevia, publicar, volverA, versiones, bitacora, publicado };
}

// ------------------------------------------------------------------------------------------------ sembrar

/**
 * Carga el borrador desde un contenido con el formato del sitio (FORMATO.md), p. ej. lo que el AYUDANTE 3
 * copie del sitio de Wix. Solo sobre tablas VACIAS (si ya hay paginas, no hace nada y lo dice).
 * Las fotos que vienen por url (sin subir todavia) se anotan con ruta "externa/…": conviene volver a subirlas.
 */
async function sembrar(al, c, quien) {
  if ((await al.lista('web_paginas', {}, { limite: 1 })).length) return { sembrado: false, motivo: 'El borrador ya tiene páginas.' };
  const por = quien || 'semilla';
  return al.transaccion(async (tx) => {
    const n = { paginas: 0, bloques: 0, fotos: 0, secciones: 0, platos: 0, faq: 0, eventos: 0 };
    const fotos = {};
    const foto = async (f) => {
      if (!f || !f.url) return null;
      if (fotos[f.url]) return fotos[f.url];
      const h = crypto.createHash('sha256').update('externa:' + f.url).digest('hex');
      const ext = (String(f.url).match(/\.(webp|png|jpe?g)(\?|$)/i) || [])[1] || 'jpg';
      const tipo = { webp: 'image/webp', png: 'image/png' }[ext.toLowerCase()] || 'image/jpeg';
      const fila = await tx.insertar('web_fotos', { ruta: 'externa/' + h.slice(0, 20), url: f.url, url_chica: f.url_chica || null, ancho: f.ancho || null, alto: f.alto || null,
        tipo, huella: h, alt_es: (f.alt && f.alt.es) || '', alt_en: (f.alt && f.alt.en) || '', subida_por: por });
      n.fotos++; fotos[f.url] = fila.id; return fila.id;
    };
    const tx2 = (x) => ({ es: (x && x.es) || '', en: (x && x.en) || '' });
    let i = 0;
    for (const clave of Object.keys(c.paginas || {})) {
      const p = c.paginas[clave], seo = p.seo || {};
      await tx.insertar('web_paginas', { clave: limpiarCampo('clave', clave), ruta_en: p.ruta.en, ruta_es: p.ruta.es, titulo_en: tx2(seo.titulo).en, titulo_es: tx2(seo.titulo).es,
        descripcion_en: tx2(seo.descripcion).en, descripcion_es: tx2(seo.descripcion).es, foto_id: await foto(seo.foto), orden: p.orden != null ? p.orden : i++, actualizado_por: por });
      n.paginas++;
      let j = 0;
      for (const bc of Object.keys(p.bloques || {})) {
        const b = p.bloques[bc];
        await tx.insertar('web_bloques', { pagina: clave, clave: limpiarCampo('clave', bc), tipo: b.tipo || 'texto', texto_es: b.es || '', texto_en: b.en || '', enlace: b.enlace || null,
          foto_id: await foto(b.foto), orden: b.orden != null ? b.orden : j++, actualizado_por: por });
        n.bloques++;
      }
    }
    i = 0;
    for (const s of c.menu || []) {
      const sec = await tx.insertar('web_menu_secciones', { clave: limpiarCampo('clave', s.clave), nombre_es: tx2(s.nombre).es, nombre_en: tx2(s.nombre).en, nota_es: tx2(s.nota).es, nota_en: tx2(s.nota).en,
        orden: s.orden != null ? s.orden : i++, actualizado_por: por });
      n.secciones++;
      let j = 0;
      for (const p of s.platos || []) {
        await tx.insertar('web_menu_platos', { seccion_id: sec.id, nombre_es: tx2(p.nombre).es, nombre_en: tx2(p.nombre).en, descripcion_es: tx2(p.descripcion).es, descripcion_en: tx2(p.descripcion).en,
          precio_q: limpiarCampo('precio_q', p.precio_q), alergenos: limpiarCampo('alergenos', p.alergenos || []), etiquetas: limpiarCampo('etiquetas', p.etiquetas || []),
          foto_id: await foto(p.foto), orden: p.orden != null ? p.orden : j++, actualizado_por: por });
        n.platos++;
      }
    }
    i = 0;
    for (const q of c.faq || []) {
      await tx.insertar('web_faq', { categoria: q.categoria || 'general', pregunta_es: tx2(q.pregunta).es, pregunta_en: tx2(q.pregunta).en, respuesta_es: tx2(q.respuesta).es, respuesta_en: tx2(q.respuesta).en,
        orden: q.orden != null ? q.orden : i++, actualizado_por: por });
      n.faq++;
    }
    i = 0;
    for (const e of c.eventos || []) {
      await tx.insertar('web_eventos', { slug: limpiarCampo('slug', e.slug), titulo_es: tx2(e.titulo).es, titulo_en: tx2(e.titulo).en, descripcion_es: tx2(e.descripcion).es, descripcion_en: tx2(e.descripcion).en,
        inicio: limpiarCampo('inicio', e.inicio), fin: limpiarCampo('fin', e.fin), precio_q: limpiarCampo('precio_q', e.precio_q), cupo: e.cupo || null, foto_id: await foto(e.foto),
        enlace: limpiarCampo('enlace', e.enlace), orden: e.orden != null ? e.orden : i++, actualizado_por: por });
      n.eventos++;
    }
    if (c.ajustes && c.ajustes.tipo_cambio_usd) await tx.insertar('web_ajustes', { clave: 'tipo_cambio_usd', valor: { q_por_usd: Number(c.ajustes.tipo_cambio_usd) }, actualizado_por: por });
    await tx.insertar('web_bitacora', { quien: por, rol: 'sistema', accion: 'crear', tabla: 'web_paginas', registro_id: 'semilla', antes: null, despues: n });
    return Object.assign({ sembrado: true }, n);
  });
}

// ------------------------------------------------------------------------------------------------ imagenes

function tipoDeImagen(b) {
  if (!Buffer.isBuffer(b) || b.length < 16) return null;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (b.slice(0, 4).toString('ascii') === 'RIFF' && b.slice(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
  return null;
}
const ext = (t) => ({ 'image/webp': 'webp', 'image/jpeg': 'jpg', 'image/png': 'png' })[t];

/** Ancho y alto leidos del archivo (PNG, WebP VP8/VP8L/VP8X y JPEG). null si no se pudo. */
function medidas(b, t) {
  try {
    if (t === 'image/png') return { ancho: b.readUInt32BE(16), alto: b.readUInt32BE(20) };
    if (t === 'image/webp') {
      const tipo = b.slice(12, 16).toString('ascii');
      if (tipo === 'VP8X') return { ancho: 1 + b.readUIntLE(24, 3), alto: 1 + b.readUIntLE(27, 3) };
      if (tipo === 'VP8L') { const bits = b.readUInt32LE(21); return { ancho: 1 + (bits & 0x3fff), alto: 1 + ((bits >> 14) & 0x3fff) }; }
      if (tipo === 'VP8 ') return { ancho: b.readUInt16LE(26) & 0x3fff, alto: b.readUInt16LE(28) & 0x3fff };
    }
    if (t === 'image/jpeg') {
      let i = 2;
      while (i < b.length - 9) {
        if (b[i] !== 0xff) { i++; continue; }
        const m = b[i + 1];
        if (m >= 0xc0 && m <= 0xcf && [0xc4, 0xc8, 0xcc].indexOf(m) === -1) return { alto: b.readUInt16BE(i + 5), ancho: b.readUInt16BE(i + 7) };
        i += 2 + b.readUInt16BE(i + 2);
      }
    }
  } catch (e) { /* archivo raro: se usan las medidas que mando la pantalla */ }
  return null;
}

module.exports = { crearContenidoWeb, armarContenido, sembrar, faltantes, huella, limpiarCampo, tipoDeImagen, medidas, TIPOS, ALERGENOS, ETIQUETAS, FORMATO };
