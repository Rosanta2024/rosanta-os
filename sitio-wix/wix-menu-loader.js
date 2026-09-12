#!/usr/bin/env node
/**
 * Cargador del menú de Rosanta a la app Wix Restaurants Menus.
 *
 * ⚠️ JUBILADO COMO ESCRITOR (17-ago-2026). La migración terminó: la fuente de
 * verdad del menú es el DASHBOARD de Wix. GitHub queda como respaldo de los
 * textos (sobre todo el español, que alimenta las traducciones). Los modos que
 * escriben (probe/load/asignar/rollback) exigen WIX_PERMITIR_ESCRITURA=si.
 * `extract` sigue siendo el modo útil: lectura pura, sin riesgo.
 *
 * Fuente de datos: el array MENU dentro de index.html del menú de GitHub.
 *
 * MODOS
 *   node wix-menu-loader.js extract            Extrae el menú a menu-rosanta.json. Sin red, sin riesgo.
 *   node wix-menu-loader.js probe              Crea UNA sección y UN plato de prueba y muestra la respuesta cruda.
 *   node wix-menu-loader.js load               Carga el menú completo.
 *   node wix-menu-loader.js asignar <archivo>  Asigna los items a sus secciones (Section.itemIds), usando el registro de `load`.
 *   node wix-menu-loader.js rollback <archivo> Borra lo creado, usando el registro que deja `load`.
 *
 * ANTES DE `probe` O `load`:
 *   export WIX_API_KEY="..."          API key de Wix (Dashboard - Settings - API Keys)
 *   export WIX_SITE_ID="..."          Site ID del sitio de Rosanta
 *
 * POR QUÉ EXISTE `probe`:
 *   La documentación de Wix confirma los endpoints y los campos del objeto Item,
 *   pero no publica el cuerpo exacto de las peticiones bulk. `probe` lo averigua
 *   contra la API real con dos registros desechables, en vez de asumirlo y
 *   descubrir el error a mitad de una carga de 74 platos.
 *
 *   Además: Bulk Create Sections está marcado por Wix como Developer Preview,
 *   o sea que puede cambiar sin aviso. Una razón más para probar antes.
 */

'use strict';

const fs = require('fs');

const FUENTE = 'https://raw.githubusercontent.com/rosanta2024/rosanta-menu/main/index.html';

const API = {
  menus:    'https://www.wixapis.com/restaurants/menus/v1/menus',
  secBulk:  'https://www.wixapis.com/restaurants/menus-section/v1/bulk/sections/create',
  itemBulk: 'https://www.wixapis.com/restaurants/menus-item/v1/bulk/items/create',
  seccion:  'https://www.wixapis.com/restaurants/menus-section/v1/sections',
  item:     'https://www.wixapis.com/restaurants/menus-item/v1/items',
  variante: 'https://www.wixapis.com/restaurants/item-variants/v1/variants',
  label:    'https://www.wixapis.com/restaurants/item-labels/v1/labels'
};

// Wix no tiene campo para maridaje: se anexa a la descripción (decisión de Juanma).
const INCLUIR_MARIDAJE = true;

// Las notas ❀ ya NO van a la descripción por defecto (15-ago-2026): se convierten
// en labels de Wix según labels-map-rosanta.json. Las excepciones (notas con
// información sustantiva que sí se quedan en la descripción) están en el mismo mapa.
const INCLUIR_NOTAS    = false;

// El sitio tiene INGLÉS como idioma principal (decisión 15-ago-2026: no se cambia
// para no mover URLs indexadas). La carga entra en inglés y el español se agrega
// después como traducción en el Translation Manager.
const IDIOMA_PRINCIPAL = 'en';
const MAPA = fs.existsSync(__dirname + '/labels-map-rosanta.json')
  ? JSON.parse(fs.readFileSync(__dirname + '/labels-map-rosanta.json', 'utf8'))
  : { labels: {}, notasQuedan: [] };

/* ------------------------------------------------------------------ */
/* 1 · Extracción                                                      */
/* ------------------------------------------------------------------ */

async function traerFuente() {
  const r = await fetch(FUENTE);
  if (!r.ok) throw new Error('No se pudo leer la fuente: HTTP ' + r.status);
  return r.text();
}

function extraerMENU(html) {
  const ini = html.indexOf('const MENU = [');
  if (ini < 0) throw new Error('No se encontró "const MENU = [" en la fuente. ¿Cambió el archivo?');

  // Recorre balanceando corchetes, respetando comillas, para hallar el cierre real.
  const desde = html.indexOf('[', ini);
  let prof = 0, comilla = null, fin = -1;
  for (let i = desde; i < html.length; i++) {
    const c = html[i], prev = html[i - 1];
    if (comilla) { if (c === comilla && prev !== '\\') comilla = null; continue; }
    if (c === "'" || c === '"' || c === '`') { comilla = c; continue; }
    if (c === '[') prof++;
    else if (c === ']') { prof--; if (prof === 0) { fin = i; break; } }
  }
  if (fin < 0) throw new Error('El array MENU quedó sin cerrar.');

  const src = html.slice(desde, fin + 1);
  return new Function('return ' + src)();
}

function precioDe(q) {
  // Contrato verificado con `probe` el 15-ago-2026: la API espera un string
  // decimal y toma la moneda del sitio. {value, currency} devuelve 400.
  return { price: Number(q).toFixed(2) };
}

/** Convierte 'Normal: Q75 | Lomito: Q100' en variantes de precio de Wix. */
function variantesDe(txt) {
  return String(txt).split('|').map(p => {
    const m = p.match(/^\s*(.+?)\s*:\s*Q\s*([\d.,]+)\s*$/);
    if (!m) return null;
    return { name: m[1].trim(), priceInfo: precioDe(m[2].replace(',', '')) };
  }).filter(Boolean);
}

/** nombreEs: clave estable del plato en el mapa de labels, siempre en español. */
function descripcionDe(loc, L, nombreEs) {
  const partes = [loc.d, loc.x].filter(Boolean);
  if (INCLUIR_MARIDAJE && loc.m) partes.push((L === 'en' ? 'Suggested pairing: ' : 'Maridaje sugerido: ') + loc.m);
  if (Array.isArray(loc.notas) && loc.notas.length &&
      (INCLUIR_NOTAS || MAPA.notasQuedan.includes(nombreEs))) partes.push(loc.notas.join(' '));
  if (loc.link && loc.link.t) partes.push(loc.link.t);
  return partes.join(' ').trim().slice(0, 1500); // Wix: máximo 1500 caracteres.
}

/** Aplana MENU a { secciones: [ { id, nombre, intro, items:[...] } ] } por idioma. */
function normalizar(MENU, idioma) {
  const L = idioma; // 'es' | 'en'
  const salida = [];

  for (const sec of MENU) {
    const meta = sec[L] || sec.es || {};
    const items = [];
    // Reconciliación 17-ago-2026: el dashboard (reorganizado a mano por Juanma)
    // es la referencia de nombres: cejas en MAYÚSCULAS y prefijos por familia.
    const CEJA = String(meta.eyebrow || '').toUpperCase();
    const conCeja = (titulo) => [CEJA, titulo].filter(Boolean).join(' · ');

    // a) Platos normales
    for (const it of (sec.items || [])) {
      const loc = it[L] || it.es || {};
      if (!loc.n) continue;
      const nombreEs = (it.es || {}).n || loc.n;
      const item = { name: loc.n, description: descripcionDe(loc, L, nombreEs), visible: true };
      const vars = []
        .concat(loc.p  ? variantesDe(loc.p)  : [])
        .concat(loc.p2 ? variantesDe(loc.p2) : []);
      if (it.q != null) item.priceInfo = precioDe(it.q);
      if (vars.length) item.priceVariants = { variants: vars };
      if (it.q == null && !vars.length) item._sinPrecio = true;
      const lbls = MAPA.labels[nombreEs] || [];
      if (lbls.length) item._labels = (L === 'en') ? lbls.map(n => (MAPA.labelsEn || {})[n] || n) : lbls;
      items.push(item);
    }

    // b) Bloques en rejilla: bebidas, y el anexo de "Algo más fuerte".
    //    grid = { es?, en?, groups: [ { es, en, items: [ { q, es, en, d? } ] } ] }
    //    Decisión 17-ago-2026 (ampliada): si la sección TAMBIÉN tiene platos
    //    regulares (los sides de "Algo más fuerte"), la rejilla sale como UNA
    //    sección "Side Dishes"/"Para Acompañar". Si es pura rejilla (Bebidas),
    //    CADA GRUPO sale como sección propia con su nombre de los datos
    //    (Café de Guatemala, Refrescos de la casa, Cervezas, etc.).
    const itemsGrid = [];
    const esRejillaPura = !!(sec.grid && sec.grid.groups && sec.grid.groups.length) && !items.length;
    if (esRejillaPura) {
      // Orden del dashboard para las secciones de bebidas (por título EN).
      const ORDEN_BEBIDAS = ['House refreshments', 'Coffee from Guatemala', 'Garden herb teas', 'Artisan tea infusions', 'Beers', 'Craft beers', 'Digestifs'];
      const grupos = [...sec.grid.groups].sort((a, b) => {
        const ia = ORDEN_BEBIDAS.indexOf(a.en || ''), ib = ORDEN_BEBIDAS.indexOf(b.en || '');
        return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
      });
      grupos.forEach((g, idx) => {
        const titulo = g[L] || g.es || '';
        const grupoItems = [];
        for (const li of (g.items || [])) {
          const nombre = li[L] || li.es;
          if (!nombre) continue;
          grupoItems.push({
            name: nombre,
            description: (li.d || '').slice(0, 1500),
            priceInfo: li.q != null ? precioDe(li.q) : undefined,
            visible: true
          });
        }
        if (grupoItems.length) salida.push({
          id: sec.id + '-g' + (idx + 1),
          nombre: conCeja(titulo),
          intro: idx === 0 ? (meta.intro || '') : '',
          items: grupoItems
        });
      });
    } else {
      for (const g of ((sec.grid && sec.grid.groups) || [])) {
        const titulo = g[L] || g.es || '';
        for (const li of (g.items || [])) {
          const nombre = li[L] || li.es;
          if (!nombre) continue;
          itemsGrid.push({
            name: nombre,
            description: (li.d || '').slice(0, 1500),
            priceInfo: li.q != null ? precioDe(li.q) : undefined,
            visible: true,
            _grupo: titulo
          });
        }
      }
    }

    // c) Cócteles: subgrupos por precio → cada subgrupo es una SECCIÓN propia
    //    (decisión 17-ago-2026, espejo de la estructura de la carta y de GBP).
    //    subs = [ { q, es:{t,n}, en:{t,n}, items: [ { es:{n,d,m}, en:{...} } ] } ]
    //    El precio vive en el subgrupo, no en el cóctel.
    if (sec.subs && sec.subs.length) {
      // Nombres EN de los grupos de cócteles según el dashboard.
      const COCTELES_EN = { 'Los Imperdibles': 'The Essentials', 'Cosecha de Temporada': 'Seasonal Harvest', 'Raíces de la Casa': 'House Roots' };
      sec.subs.forEach((sub, idx) => {
        const tituloEs = ((sub.es || {}).t) || '';
        const titulo = (L === 'en') ? (COCTELES_EN[tituloEs] || ((sub.en || {}).t) || tituloEs) : tituloEs;
        const subItems = [];
        for (const it of (sub.items || [])) {
          const loc = it[L] || it.es || {};
          if (!loc.n) continue;
          subItems.push({
            name: loc.n,
            description: descripcionDe(loc, L, (it.es || {}).n || loc.n),
            priceInfo: sub.q != null ? precioDe(sub.q) : undefined,
            visible: true,
            _sinPrecio: sub.q == null
          });
        }
        salida.push({
          id: sec.id + '-' + (idx + 1),
          nombre: conCeja(titulo),
          intro: idx === 0 ? (meta.intro || '') : '',
          items: subItems
        });
      });
    }

    // d) Vinos: copa y botella entran como variantes de precio, y cada grupo
    //    sale como sección propia según el dashboard: Reds → "WINES · Red Wines",
    //    Whites + Rosé se FUSIONAN en "WINES · White Wine & Rose", Cava → "CAVA".
    if (sec.vinos && sec.vinos.length) {
      const DESTINO = {
        'Reds':   { en: 'WINES · Red Wines',        es: 'VINOS · Tintos' },
        'Whites': { en: 'WINES · White Wine & Rose', es: 'VINOS · Blancos y Rosados' },
        'Rosé':   { en: 'WINES · White Wine & Rose', es: 'VINOS · Blancos y Rosados' },
        'Cava':   { en: 'CAVA',                      es: 'CAVA' }
      };
      const seccionesVino = [];
      for (const g of sec.vinos) {
        const dest = DESTINO[g.en || ''] || { en: conCeja(g.en || ''), es: conCeja(g.es || '') };
        const nombreSec = (L === 'en') ? dest.en : dest.es;
        let secVino = seccionesVino.find(s => s.nombre === nombreSec);
        if (!secVino) {
          secVino = { id: sec.id + '-v' + (seccionesVino.length + 1), nombre: nombreSec, intro: seccionesVino.length === 0 ? (meta.intro || '') : '', items: [] };
          seccionesVino.push(secVino);
        }
        for (const w of (g.items || [])) {
          const vars = [];
          if (w.copa != null) vars.push({ name: L === 'en' ? 'Glass'  : 'Copa',    priceInfo: precioDe(w.copa) });
          if (w.bot  != null) vars.push({ name: L === 'en' ? 'Bottle' : 'Botella', priceInfo: precioDe(w.bot) });
          secVino.items.push({
            name: w.n,
            description: [w.uva, (L === 'en' ? w.zEn : w.zEs)].filter(Boolean).join(' · '),
            priceVariants: vars.length ? { variants: vars } : undefined,
            visible: true,
            _sinPrecio: vars.length === 0
          });
        }
      }
      salida.push(...seccionesVino);
    }

    if (items.length) {
      salida.push({
        id: sec.id,
        nombre: conCeja(meta.title),
        intro: meta.intro || '',
        items
      });
    }

    // Sides: la rejilla de una sección mixta sale como sección propia, justo después,
    // con la ceja de la sección madre ("SOMETHING STRONGER · Side Dishes").
    if (itemsGrid.length && items.length && items[0] !== itemsGrid[0] && !items.includes(itemsGrid[0])) {
      salida.push({
        id: sec.id + '-sides',
        nombre: conCeja(L === 'en' ? 'Side Dishes' : 'Para Acompañar'),
        intro: '',
        items: itemsGrid
      });
    }
  }
  return salida;
}

/* ------------------------------------------------------------------ */
/* 2 · Cliente de la API                                               */
/* ------------------------------------------------------------------ */

function credenciales() {
  const key = process.env.WIX_API_KEY, site = process.env.WIX_SITE_ID;
  if (!key || !site) {
    throw new Error('Faltan WIX_API_KEY y/o WIX_SITE_ID en el entorno. Ver el runbook.');
  }
  return { Authorization: key, 'wix-site-id': site, 'Content-Type': 'application/json' };
}

async function llamar(metodo, url, cuerpo) {
  const r = await fetch(url, {
    method: metodo,
    headers: credenciales(),
    body: cuerpo ? JSON.stringify(cuerpo) : undefined
  });
  const texto = await r.text();
  let json = null;
  try { json = JSON.parse(texto); } catch (_) {}
  return { ok: r.ok, status: r.status, json, texto };
}

/* ------------------------------------------------------------------ */
/* 3 · Modos                                                           */
/* ------------------------------------------------------------------ */

async function modoExtract() {
  const MENU = extraerMENU(await traerFuente());
  const datos = { generado: new Date().toISOString(), fuente: FUENTE,
                  es: normalizar(MENU, 'es'), en: normalizar(MENU, 'en') };

  fs.writeFileSync('menu-rosanta.json', JSON.stringify(datos, null, 2), 'utf8');

  for (const L of ['es', 'en']) {
    const secs = datos[L];
    const n = secs.reduce((a, s) => a + s.items.length, 0);
    console.log(`${L.toUpperCase()}: ${secs.length} secciones, ${n} items`);
    secs.forEach(s => console.log(`   · ${s.nombre} (${s.items.length})`));
  }
  const sinPrecio = datos.es.flatMap(s => s.items.filter(i => i._sinPrecio).map(i => i.name));
  if (sinPrecio.length) console.log('\nOJO, sin precio detectado: ' + sinPrecio.join(', '));
  console.log('\nEscrito: menu-rosanta.json');
}

async function modoProbe() {
  console.log('Probando el contrato real de la API con registros desechables.\n');

  console.log('1. Listando menús existentes...');
  const menus = await llamar('GET', API.menus);
  console.log('   HTTP ' + menus.status + ' · ' + menus.texto.slice(0, 400) + '\n');
  if (!menus.ok) {
    console.log('Si esto da 403, falta el permiso "Manage Restaurants" en la API key.');
    console.log('Si da 404, falta instalar la app Wix Restaurants Menus.');
    return;
  }

  console.log('2. Creando UNA sección de prueba (bulk)...');
  const s = await llamar('POST', API.secBulk, {
    sections: [{ name: 'ZZZ PRUEBA BORRAR', visible: false }], returnEntity: true
  });
  console.log('   HTTP ' + s.status + ' · ' + s.texto.slice(0, 600) + '\n');

  console.log('3. Creando UN plato de prueba (bulk)...');
  const i = await llamar('POST', API.itemBulk, {
    items: [{ name: 'ZZZ PRUEBA BORRAR', description: 'Prueba de contrato.',
              priceInfo: precioDe(1), visible: false }], returnEntity: true
  });
  console.log('   HTTP ' + i.status + ' · ' + i.texto.slice(0, 600) + '\n');

  console.log('Revisa arriba el nombre real del campo raíz y de los IDs devueltos.');
  console.log('Los dos registros quedaron ocultos y se llaman "ZZZ PRUEBA BORRAR". Bórralos.');
}

/**
 * Las variantes de precio ("Copa", "Botella", "Normal"...) son entidades
 * propias en Wix: se crean en el API de Item Variants y los items las
 * referencian por variantId. Contrato verificado con `probe` el 15-ago-2026.
 * Reusa las que ya existan con el mismo nombre y crea las que falten.
 */
async function resolverVariantes(secciones, registro) {
  const nombres = new Set();
  for (const sec of secciones)
    for (const it of sec.items)
      for (const v of ((it.priceVariants && it.priceVariants.variants) || []))
        nombres.add(v.name);
  if (!nombres.size) return;

  const lista = await llamar('GET', API.variante);
  if (!lista.ok) throw new Error('No se pudieron listar las variantes: HTTP ' + lista.status);
  const mapa = {};
  for (const v of ((lista.json && lista.json.variants) || [])) mapa[v.name] = v.id;

  for (const n of nombres) {
    if (mapa[n]) continue;
    const r = await llamar('POST', API.variante, { variant: { name: n } });
    if (!r.ok) throw new Error('No se pudo crear la variante "' + n + '": HTTP ' + r.status + ' ' + r.texto.slice(0, 200));
    mapa[n] = r.json.variant.id;
    registro.variantes.push({ id: mapa[n], nombre: n });
    console.log('· variante nueva: ' + n + '  ->  ' + mapa[n]);
  }

  for (const sec of secciones)
    for (const it of sec.items)
      for (const v of ((it.priceVariants && it.priceVariants.variants) || [])) {
        v.variantId = mapa[v.name];
        delete v.name;
      }
}

/**
 * Igual que resolverVariantes pero para las labels (distintivos) de los items.
 * Contrato verificado el 15-ago-2026: POST {variant|label:{name}} y el item
 * las referencia como labels:[{id}]. Reusa las existentes por nombre.
 */
async function resolverLabels(secciones, registro) {
  const nombres = new Set();
  for (const sec of secciones)
    for (const it of sec.items)
      for (const n of (it._labels || [])) nombres.add(n);
  if (!nombres.size) return;

  const lista = await llamar('GET', API.label);
  if (!lista.ok) throw new Error('No se pudieron listar las labels: HTTP ' + lista.status);
  const mapa = {};
  for (const l of ((lista.json && lista.json.labels) || [])) mapa[l.name] = l.id;

  for (const n of nombres) {
    if (mapa[n]) continue;
    const r = await llamar('POST', API.label, { label: { name: n } });
    if (!r.ok) throw new Error('No se pudo crear la label "' + n + '": HTTP ' + r.status + ' ' + r.texto.slice(0, 200));
    mapa[n] = r.json.label.id;
    registro.labels.push({ id: mapa[n], nombre: n });
    console.log('· label nueva: ' + n + '  ->  ' + mapa[n]);
  }

  for (const sec of secciones)
    for (const it of sec.items) {
      if (it._labels) it.labels = it._labels.map(n => ({ id: mapa[n] }));
      delete it._labels;
    }
}

async function modoLoad() {
  const MENU = extraerMENU(await traerFuente());
  const secciones = normalizar(MENU, IDIOMA_PRINCIPAL);
  const registro = { fecha: new Date().toISOString(), secciones: [], items: [], variantes: [], labels: [] };

  await resolverVariantes(secciones, registro);
  await resolverLabels(secciones, registro);

  console.log('Cargando ' + secciones.length + ' secciones...\n');

  for (const sec of secciones) {
    const r = await llamar('POST', API.secBulk, {
      sections: [{ name: sec.nombre, description: sec.intro, visible: true }],
      returnEntity: true
    });
    if (!r.ok) { console.log('FALLÓ la sección "' + sec.nombre + '": HTTP ' + r.status + ' ' + r.texto.slice(0, 300)); break; }

    const secId = buscarId(r.json);
    registro.secciones.push({ id: secId, nombre: sec.nombre });
    console.log('· ' + sec.nombre + '  ->  ' + secId);

    const limpios = sec.items.map(({ _grupo, _sinPrecio, _labels, ...x }) => x);
    for (let k = 0; k < limpios.length; k += 20) {
      const lote = limpios.slice(k, k + 20);
      const ri = await llamar('POST', API.itemBulk, { items: lote, returnEntity: true });
      if (!ri.ok) { console.log('  FALLÓ un lote: HTTP ' + ri.status + ' ' + ri.texto.slice(0, 300)); break; }
      for (const res of ((ri.json && ri.json.results) || [])) {
        const id = res.itemMetadata && res.itemMetadata.id;
        if (id) registro.items.push({ id, seccion: sec.nombre });
      }
      console.log('  + ' + lote.length + ' items');
    }
  }

  const arch = 'carga-' + Date.now() + '.json';
  fs.writeFileSync(arch, JSON.stringify(registro, null, 2), 'utf8');
  console.log('\nRegistro para deshacer: ' + arch);
  console.log('Las secciones quedaron creadas pero los items NO están asignados a ellas todavía.');
  console.log('Eso se termina en el dashboard, arrastrando, o con Update Section.');
}

function buscarId(json) {
  if (!json) return null;
  const j = JSON.stringify(json);
  const m = j.match(/"id"\s*:\s*"([0-9a-f-]{36})"/);
  return m ? m[1] : null;
}

/**
 * Asigna los items a sus secciones vía Section.itemIds (máx 300 por sección).
 * Contrato verificado el 15-ago-2026: PATCH /sections/{id} con
 * {section:{id, revision, itemIds}}. La revision se lee en vivo, así que
 * este modo es re-ejecutable sin conflicto.
 */
async function modoAsignar(archivo) {
  if (!archivo || !fs.existsSync(archivo)) throw new Error('Pasa el archivo de registro que generó `load`.');
  const reg = JSON.parse(fs.readFileSync(archivo, 'utf8'));

  const lista = await llamar('GET', API.seccion + '?paging.limit=100');
  if (!lista.ok) throw new Error('No se pudieron listar las secciones: HTTP ' + lista.status);
  const revs = {};
  for (const s of ((lista.json && lista.json.sections) || [])) revs[s.id] = s.revision;

  for (const sec of reg.secciones) {
    const ids = reg.items.filter(i => i.seccion === sec.nombre).map(i => i.id);
    if (!revs[sec.id]) { console.log('OJO: la sección "' + sec.nombre + '" ya no existe en Wix, la salto.'); continue; }
    const r = await llamar('PATCH', API.seccion + '/' + sec.id, {
      section: { id: sec.id, revision: revs[sec.id], itemIds: ids }
    });
    console.log((r.ok ? '· ' : 'FALLÓ HTTP ' + r.status + '  ') + sec.nombre + '  ->  ' + ids.length + ' items');
    if (!r.ok) console.log('  ' + r.texto.slice(0, 300));
  }

  const check = await llamar('GET', API.seccion + '?paging.limit=100');
  let total = 0;
  for (const sec of reg.secciones) {
    const s = ((check.json && check.json.sections) || []).find(x => x.id === sec.id);
    const n = s ? (s.itemIds || []).length : 0;
    total += n;
    console.log('verificado  ' + sec.nombre + ': ' + n);
  }
  console.log('Total asignado: ' + total);
}

async function modoRollback(archivo) {
  if (!archivo || !fs.existsSync(archivo)) throw new Error('Pasa el archivo de registro que generó `load`.');
  const reg = JSON.parse(fs.readFileSync(archivo, 'utf8'));
  for (const it of (reg.items || [])) {
    if (!it.id) continue;
    const r = await llamar('DELETE', API.item + '/' + it.id);
    console.log((r.ok ? 'borrado item  ' : 'FALLÓ ' + r.status + '  item ') + it.id + '  (' + (it.seccion || '') + ')');
  }
  for (const s of (reg.secciones || [])) {
    if (!s.id) continue;
    const r = await llamar('DELETE', API.seccion + '/' + s.id);
    console.log((r.ok ? 'borrada seccion  ' : 'FALLÓ ' + r.status + '  seccion ') + s.nombre);
  }
  for (const v of (reg.variantes || [])) {
    if (!v.id) continue;
    const r = await llamar('DELETE', API.variante + '/' + v.id);
    console.log((r.ok ? 'borrada variante  ' : 'FALLÓ ' + r.status + '  variante ') + v.nombre);
  }
  for (const l of (reg.labels || [])) {
    if (!l.id) continue;
    const r = await llamar('DELETE', API.label + '/' + l.id);
    console.log((r.ok ? 'borrada label  ' : 'FALLÓ ' + r.status + '  label ') + l.nombre);
  }
}

/* ------------------------------------------------------------------ */

// SEGURO (17-ago-2026): la migración terminó y la fuente de verdad del menú
// es el DASHBOARD de Wix (ahí edita Juanma precios y estructura, sin commits).
// Este script queda como herramienta de LECTURA y RESPALDO (extract).
// Los modos que escriben o borran en Wix exigen la variable de entorno
// WIX_PERMITIR_ESCRITURA=si — sin ella, correrlos por accidente no hace nada.
const ESCRIBEN = ['probe', 'load', 'asignar', 'rollback'];

(async () => {
  const modo = process.argv[2] || 'extract';
  try {
    if (ESCRIBEN.includes(modo) && process.env.WIX_PERMITIR_ESCRITURA !== 'si') {
      console.error('DETENIDO: el modo "' + modo + '" escribe/borra en Wix, y desde el 17-ago-2026');
      console.error('la fuente de verdad del menú es el dashboard de Wix, no GitHub.');
      console.error('Correr esto sobreescribiría los cambios manuales hechos en el dashboard.');
      console.error('Si de verdad lo necesitas: WIX_PERMITIR_ESCRITURA=si node wix-menu-loader.js ' + modo);
      process.exit(2);
    }
    if (modo === 'extract')       await modoExtract();
    else if (modo === 'probe')    await modoProbe();
    else if (modo === 'load')     await modoLoad();
    else if (modo === 'asignar')  await modoAsignar(process.argv[3]);
    else if (modo === 'rollback') await modoRollback(process.argv[3]);
    else console.log('Modos: extract | probe | load | asignar <archivo> | rollback <archivo>');
  } catch (e) {
    console.error('\nError: ' + e.message);
    process.exit(1);
  }
})();
