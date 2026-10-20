// 6a. PRUEBA DE DIRECCIONES: pide CADA dirección del inventario (las de los sitemaps, las
// variantes /es/ y las redirecciones conocidas) y exige:
//   - las páginas publicadas → 200 (salvo las que pasan a 301 en data/mejoras-seo.json);
//   - las redirecciones → 301 a su destino EXACTO (una a una, nunca a la portada) y luego 200;
//   - las que no existían en Wix → 404 (no se inventan redirecciones);
//   - /reservas/ con barra final → 301 a /reservas.
// Uso:
//   node scripts/probar-301.mjs --local                       (dist/ + firebase.json, sin red)
//   node scripts/probar-301.mjs --base https://nuevo.rosanta.rest   (la copia publicada)
//   node scripts/probar-301.mjs --base https://www.rosanta.rest     (el 17-nov, antes y después del DNS)
// Solo hace GET. Código de salida 1 si algo falla.
import path from 'node:path';
import { DATA, leerJSON, pedir, urlDe, normRuta, enLotes } from './lib/comun.mjs';
import { seguir } from './lib/firebase-local.mjs';

const args = process.argv.slice(2);
const LOCAL = args.includes('--local');
const BASE = args.includes('--base') ? args[args.indexOf('--base') + 1] : null;

export async function esperado() {
  const inv = await leerJSON(path.join(DATA, 'inventario.json'));
  const mejoras = await leerJSON(path.join(DATA, 'mejoras-seo.json'));
  const redir = mejoras.redirigir || {};
  return inv.direcciones.map((d) => {
    const ruta = d.ruta.split('?')[0];
    if (redir[ruta]) return { ruta: d.ruta, estado: 301, destino: redir[ruta] };
    if (d.estado === 200) return { ruta: d.ruta, estado: 200 };
    if (d.estado >= 300 && d.estado < 400) return { ruta: d.ruta, estado: 301, destino: normRuta(d.ruta_final.split('?')[0]) };
    return { ruta: d.ruta, estado: 404 };
  });
}

async function cadenaRemota(ruta) {
  const cadena = [];
  let actual = urlDe(ruta.split('?')[0], BASE) + (ruta.includes('?') ? '?' + ruta.split('?')[1] : '');
  for (let i = 0; i < 6; i++) {
    const r = await pedir(actual);
    await r.body?.cancel?.();
    const loc = r.headers.get('location');
    const u = new URL(actual);
    cadena.push({ ruta: normRuta(u.pathname), estado: r.status, destino: loc ? normRuta(new URL(loc, actual).pathname) : null });
    if (r.status >= 300 && r.status < 400 && loc) actual = new URL(loc, actual).href;
    else break;
  }
  return cadena;
}

export async function probar(obtenerCadena) {
  const casos = await esperado();
  casos.push({ ruta: '/reservas/', estado: 301, destino: '/reservas' });
  const res = await enLotes(casos, 4, async (c) => {
    const cadena = await obtenerCadena(c.ruta);
    const p = cadena[0];
    const f = cadena[cadena.length - 1];
    let ok = p.estado === c.estado;
    let nota = '';
    if (ok && c.estado === 301) {
      ok = p.destino === c.destino && f.estado === 200 && cadena.length === 2;
      if (p.destino === '/' || p.destino === '/es') { ok = false; nota = 'redirige a la portada'; }
      if (!ok && !nota) nota = `destino ${p.destino} (${f.estado}, ${cadena.length - 1} saltos), se esperaba ${c.destino}`;
    }
    if (!ok && !nota) nota = `responde ${p.estado}${p.destino ? ' → ' + p.destino : ''}, se esperaba ${c.estado}`;
    return { ...c, ok, nota, obtenido: cadena };
  });
  return res;
}

async function main() {
  if (!LOCAL && !BASE) {
    console.error('Uso: --local  o  --base https://...');
    process.exit(2);
  }
  const res = await probar(LOCAL ? async (r) => seguir(r) : cadenaRemota);
  const malos = res.filter((r) => !r.ok);
  for (const r of res) console.log(r.ok ? '✓' : '✗', String(r.estado).padEnd(4), r.ruta, r.destino ? '→ ' + r.destino : '', r.ok ? '' : '  ← ' + r.nota);
  console.log(`\n${res.length} direcciones · ${res.length - malos.length} bien · ${malos.length} mal (${LOCAL ? 'simulación local de Firebase' : BASE})`);
  process.exitCode = malos.length ? 1 : 0;
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch((e) => { console.error(e); process.exit(1); });
