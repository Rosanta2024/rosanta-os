#!/usr/bin/env node
/**
 * Siembra el editor de "Contenido web" de la version de PRUEBA con los textos reales capturados de Wix, y los publica
 * como version 1 (23-oct-2026, AYUDANTE SV-NUBE). Asi Juanma ve sus textos de verdad en el editor de prueba.
 * NO SE HA CORRIDO: lo corre el coordinador.
 *
 *   node cloud/herramientas/sembrar-contenido.js --base rosanta_ensayo [--archivo web/sitio/data/contenido-capturado.json]
 *
 * - SOLO en una base de ensayo: rechaza "rosanta" (produccion) y cualquier nombre que no sea rosanta_<algo>; despues de
 *   conectar vuelve a preguntar current_database() por si acaso.
 * - Carga el borrador con sembrar() de cloud/app/src/contenido-web.js (solo si el borrador esta VACIO: si ya tiene
 *   paginas, no hace nada) y publica ese borrador como version 1 (solo si no hay ninguna version: no pisa nada).
 * - No llama al gancho que reconstruye el sitio (queda reconstruccion = sin_gancho), no sube fotos (quedan como
 *   externa/…, con la URL de donde se capturaron) y no manda nada a nadie.
 * - Necesita las migraciones 053, 055 y 056 aplicadas en esa base.
 */
const path = require('path');
const fs = require('fs');
const APP = path.join(__dirname, '..', 'app');
const RAIZ = path.join(__dirname, '..', '..');
const ARCHIVO_DEFECTO = path.join(RAIZ, 'web', 'sitio', 'data', 'contenido-capturado.json');
const NOTA = 'Semilla: textos capturados de www.rosanta.rest (Wix), contenido-capturado.json';

/** El nombre de la base: tiene que ser de ensayo. Tira un error si no. */
function revisarBase(nombre) {
  const b = String(nombre || '').trim();
  if (!b || b === 'rosanta' || !/^rosanta_[a-z0-9_]+$/.test(b)) {
    throw new Error('sembrar-contenido corre SOLO en una base de ensayo (--base rosanta_ensayo), nunca en "rosanta". Recibí: "' + b + '".');
  }
  return b;
}

/**
 * Siembra y publica la version 1. almacen: crearAlmacenPg(pool) o crearAlmacenMemoria() (pruebas).
 * Devuelve { ok, sembrado, version, faltan } o { ok: false, motivo } sin haber tocado nada.
 */
async function sembrarYPublicar(almacen, contenido, opciones) {
  const o = opciones || {};
  const W = require(path.join(APP, 'src', 'contenido-web'));
  const { hoyGT } = require(path.join(APP, 'src', 'giftcards'));
  if (!contenido || contenido.formato !== W.FORMATO || !contenido.paginas) return { ok: false, motivo: 'El archivo no tiene el formato ' + W.FORMATO + ' (web/contenido/FORMATO.md).' };
  if ((await almacen.lista('web_versiones', {}, { limite: 1 })).length) return { ok: false, motivo: 'Esta base ya tiene versiones publicadas: no se siembra encima.' };
  const s = await W.sembrar(almacen, contenido, o.quien || 'semilla');
  if (!s.sembrado) return { ok: false, motivo: s.motivo };
  // Sin permisos ni fotos ni gancho: solo se usa publicarAjusteSistema, que no pide usuario ni reconstruye el sitio.
  const C = W.crearContenidoWeb({ almacen, matriz: { permisos: new Map(), soloDueno: new Set() },
    fotos: { async guardar() { throw new Error('La semilla no sube fotos.'); } }, reconstruir: null, ahora: o.ahora });
  const c = await W.armarContenido(almacen, hoyGT(o.ahora ? o.ahora() : new Date()));
  const v = await C.publicarAjusteSistema(c, NOTA);
  return { ok: true, sembrado: s, version: v.version, reconstruccion: v.reconstruccion, faltan: W.faltantes(c) };
}

async function main() {
  const arg = (k) => { const i = process.argv.indexOf(k); return i > -1 ? process.argv[i + 1] : ''; };
  const BASE = revisarBase(arg('--base'));
  const archivo = path.resolve(arg('--archivo') || ARCHIVO_DEFECTO);
  const contenido = JSON.parse(fs.readFileSync(archivo, 'utf8'));
  const { execFileSync } = require('child_process');
  const { OAuth2Client } = require(path.join(APP, 'node_modules', 'google-auth-library'));
  const { crearPool, cerrarPool } = require(path.join(APP, 'src', 'db'));
  const { crearAlmacenPg } = require(path.join(APP, 'src', 'almacen-web'));
  // gcloud no esta en el PATH de todas las terminales: ruta completa
  const GCLOUD = process.env.GCLOUD || path.join(process.env.HOME, 'google-cloud-sdk', 'bin', 'gcloud');
  const gcloud = (a) => execFileSync(GCLOUD, a.concat(['--project', 'rosanta-apps-script']), { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  const auth = new OAuth2Client();
  auth.setCredentials({ access_token: gcloud(['auth', 'print-access-token']) });
  const pool = await crearPool({ usuario: 'app', clave: gcloud(['secrets', 'versions', 'access', 'latest', '--secret', 'db-app']), base: BASE, auth });
  try {
    const real = (await pool.query('SELECT current_database() AS b')).rows[0].b;
    revisarBase(real);
    if (real !== BASE) throw new Error('Conecté a "' + real + '" y no a "' + BASE + '".');
    const r = await sembrarYPublicar(crearAlmacenPg(pool), contenido, { quien: 'semilla' });
    if (!r.ok) { console.log('No se sembró: ' + r.motivo); process.exitCode = 2; return; }
    console.log('Base: ' + real + ' · archivo: ' + path.relative(RAIZ, archivo));
    console.table(r.sembrado);
    console.log('Publicada la versión ' + r.version + ' (reconstrucción: ' + r.reconstruccion + ').');
    if (r.faltan.length) console.log('Para publicar desde el editor, Juanma tiene que completar ' + r.faltan.length + ' cosas (la primera: ' + r.faltan[0] + ').');
  } finally { await cerrarPool(pool).catch(() => {}); }
}

if (require.main === module) main().catch((e) => { console.error('ERROR: ' + e.message); process.exit(1); });
module.exports = { revisarBase, sembrarYPublicar, ARCHIVO_DEFECTO };
