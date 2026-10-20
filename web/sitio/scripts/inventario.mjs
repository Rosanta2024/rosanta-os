// 1. INVENTARIO de todas las direcciones de www.rosanta.rest (Wix).
// Fuentes: sitemap.xml y es_es-sitemap.xml (con sus sub-mapas) + direcciones conocidas
// (redirecciones de Wix y del Plan_301), en inglés (raíz) y español (/es/...).
// SOLO LECTURA: GET sin seguir redirecciones, para anotar el código y el destino.
//
// Uso: node scripts/inventario.mjs   → data/inventario.json
import path from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { DATA, ORIGEN, pedir, pedirTexto, normRuta, urlDe, escribirJSON, leerJSON, enLotes } from './lib/comun.mjs';

const MAPAS = ['/sitemap.xml', '/es_es-sitemap.xml'];

function locs(xml) {
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim().replace(/&amp;/g, '&'));
}

async function leerMapas() {
  const urls = []; // { ruta, query, mapa }
  const mapas = [];
  for (const m of MAPAS) {
    const indice = await pedirTexto(ORIGEN + m, { refrescar: true });
    const hijos = /<sitemapindex/.test(indice) ? locs(indice) : [ORIGEN + m];
    for (const h of hijos) {
      const xml = h === ORIGEN + m ? indice : await pedirTexto(h, { refrescar: true });
      const lista = locs(xml);
      mapas.push({ indice: m, mapa: new URL(h).pathname, urls: lista.length });
      for (const u of lista) {
        const x = new URL(u);
        urls.push({ ruta: normRuta(x.pathname), query: x.search, mapa: new URL(h).pathname });
      }
    }
  }
  return { urls, mapas };
}

function variantes(ruta) {
  const r = normRuta(ruta);
  if (r === '/es' || r.startsWith('/es/')) return [r, r === '/es' ? '/' : r.slice(3)];
  return [r, r === '/' ? '/es' : '/es' + r];
}

async function sondear(rutaConQuery) {
  const [ruta, q = ''] = rutaConQuery.split('?');
  const url = urlDe(ruta) + (q ? '?' + q : '');
  const cadena = [];
  let actual = url;
  for (let i = 0; i < 6; i++) {
    const r = await pedir(actual);
    const loc = r.headers.get('location');
    cadena.push({ url: actual, estado: r.status, destino: loc ? new URL(loc, actual).href : null });
    await r.body?.cancel?.();
    if (r.status >= 300 && r.status < 400 && loc) actual = new URL(loc, actual).href;
    else break;
  }
  const primero = cadena[0];
  const ultimo = cadena[cadena.length - 1];
  return {
    ruta: normRuta(ruta) + (q ? '?' + q : ''),
    estado: primero.estado,
    destino: primero.destino ? normRuta(new URL(primero.destino).pathname) + new URL(primero.destino).search : null,
    estado_final: ultimo.estado,
    ruta_final: normRuta(new URL(ultimo.url).pathname) + new URL(ultimo.url).search,
    saltos: cadena.length - 1,
  };
}

async function main() {
  const { urls, mapas } = await leerMapas();
  const conocidas = await leerJSON(path.join(DATA, 'direcciones-conocidas.json'));
  const extra = Object.entries(conocidas).filter(([k]) => !k.startsWith('_')).flatMap(([grupo, l]) => l.map((r) => ({ r, grupo })));

  const origenDe = new Map(); // ruta → set de orígenes
  const agregar = (r, o) => { if (!origenDe.has(r)) origenDe.set(r, new Set()); origenDe.get(r).add(o); };
  for (const u of urls) {
    agregar(u.ruta + u.query, 'sitemap:' + u.mapa);
    if (!u.query) for (const v of variantes(u.ruta)) agregar(v, 'variante-idioma');
  }
  for (const { r, grupo } of extra) {
    const [p, q] = r.split('?');
    for (const v of variantes(p)) agregar(v + (q ? '?' + q : ''), 'conocida:' + grupo);
  }

  // Copias textuales de robots.txt y llms.txt de Wix (la copia los reproduce y las pruebas comparan).
  for (const f of ['robots.txt', 'llms.txt']) {
    const t = await pedirTexto(ORIGEN + '/' + f, { refrescar: true });
    await mkdir(path.join(DATA, 'wix'), { recursive: true });
    await writeFile(path.join(DATA, 'wix', f), t);
  }

  const rutas = [...origenDe.keys()].sort();
  console.log(`Sondeando ${rutas.length} direcciones en ${ORIGEN} (GET, solo lectura)…`);
  const filas = await enLotes(rutas, 4, async (r) => ({ ...(await sondear(r)), origen: [...origenDe.get(r)].sort() }));

  const publicadas = filas.filter((f) => f.estado === 200 && !f.ruta.includes('?')).map((f) => f.ruta);
  const redirecciones = filas.filter((f) => f.estado >= 300 && f.estado < 400);
  const resumen = {
    total: filas.length,
    publicadas_200: publicadas.length,
    redirecciones: redirecciones.length,
    no_existen: filas.filter((f) => f.estado >= 400).length,
  };
  await escribirJSON(path.join(DATA, 'inventario.json'), {
    generado: new Date().toISOString(),
    origen: ORIGEN,
    mapas,
    resumen,
    paginas_publicadas: publicadas,
    direcciones: filas,
  });
  console.log(resumen);
  for (const f of filas) console.log(String(f.estado).padEnd(4), f.ruta, f.destino ? '→ ' + f.destino + ` (${f.estado_final})` : '');
}

main().catch((e) => { console.error(e); process.exit(1); });
