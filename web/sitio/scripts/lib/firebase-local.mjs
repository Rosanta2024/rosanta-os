// Simula cómo respondería Firebase Hosting con dist/ y firebase.json, sin desplegar nada.
// Lo usan las pruebas y probar-301.mjs --local. Reglas que imita: trailingSlash false,
// redirects exactos (301), rewrites /api/**, cleanUrls (/x → x.html) y 404.
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { RAIZ } from './comun.mjs';

export function cargarFirebase() {
  return JSON.parse(readFileSync(path.join(RAIZ, 'firebase.json'), 'utf8')).hosting;
}

export function resolver(rutaPedida, hosting = cargarFirebase(), dist = path.join(RAIZ, hosting.public)) {
  const [crudo] = rutaPedida.split('?');
  let ruta;
  try { ruta = decodeURI(crudo).normalize('NFC'); } catch { ruta = crudo; }
  if (ruta.length > 1 && ruta.endsWith('/')) return { estado: 301, destino: ruta.replace(/\/+$/, '') };
  for (const r of hosting.redirects || []) {
    let src = r.source;
    try { src = decodeURI(src).normalize('NFC'); } catch { /* nada */ }
    if (src === ruta) return { estado: r.type || 301, destino: r.destination };
  }
  for (const r of hosting.rewrites || []) {
    if (r.source.endsWith('/**') && ruta.startsWith(r.source.slice(0, -3))) return { estado: 200, api: r.run };
  }
  const candidatos = ruta === '/' ? ['index.html'] : [ruta.slice(1), ruta.slice(1) + '.html', path.join(ruta.slice(1), 'index.html')];
  for (const c of candidatos) {
    const f = path.join(dist, c);
    if (existsSync(f) && statSync(f).isFile()) return { estado: 200, archivo: f };
  }
  return { estado: 404 };
}

/** Sigue las 301 (máximo 5) y devuelve la cadena. */
export function seguir(ruta, hosting = cargarFirebase()) {
  const cadena = [];
  let actual = ruta;
  for (let i = 0; i < 6; i++) {
    const r = resolver(actual, hosting);
    cadena.push({ ruta: actual, ...r });
    if (r.estado >= 300 && r.estado < 400) actual = r.destino;
    else break;
  }
  return cadena;
}
