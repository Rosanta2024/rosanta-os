#!/usr/bin/env node
/**
 * Importa el historial de reservas de Wix a rosanta-db (tablas wix_*, migracion 050). SOLO LEE Wix.
 *
 * Donde corre (recomendado por el Estudio): como Cloud Run Job "importar-wix-reservas" con la cuenta
 * rosanta-web@, con los secretos montados como variables:
 *   WIX_API_KEY = wix-api-key:latest   DB_CLAVE = db-app:latest
 *
 * Crear el job (lo hace el Estudio, una vez; misma imagen que rosanta-nube, sin sello aparte porque no sirve trafico):
 *   gcloud run jobs deploy importar-wix-reservas --source cloud/app --region northamerica-south1 \
 *     --service-account rosanta-web@rosanta-apps-script.iam.gserviceaccount.com \
 *     --command node --args src/importar-wix-reservas.js \
 *     --set-secrets WIX_API_KEY=wix-api-key:latest,DB_CLAVE=db-app:latest \
 *     --set-env-vars DB_BASE=rosanta_ensayo,WIX_SECO=1 --max-retries 0 --task-timeout 15m
 *   gcloud run jobs execute importar-wix-reservas --region northamerica-south1 --wait
 *   (despues: WIX_SECO=0 en ensayo; y DB_BASE=rosanta con el si del Estudio)
 * Cuenta: rosanta-web@ (acordado con el Estudio el 20-oct; el le da lectura de wix-api-key al crearla).
 *
 * Tambien corre en la Mac (cloud/herramientas/importar-wix-reservas.js), con el gcloud de Juanma.
 *
 * Opciones (argumentos o variables):
 *   --seco               lee Wix y la base, compara y muestra el resumen; NO escribe nada   (WIX_SECO=1)
 *   --base <nombre>      rosanta (por defecto) o rosanta_ensayo                            (DB_BASE)
 *   --desde AAAA-MM-DD   primer mes a leer (por defecto 2022-12-01, alta del dominio)       (WIX_DESDE)
 *   --hasta AAAA-MM-DD   ultimo dia (por defecto hoy + 18 meses)                            (WIX_HASTA)
 *   --cambios-desde/--cambios-hasta ISO   ids creados o cambiados en esa ventana (para Fase 2)
 *       por defecto: 20-oct-2026 7:58–8:26 hora de Guatemala (Marketing OS sin permisos)
 *
 * Lo que imprime: conteos e ids de Wix. Nunca nombres, correos ni telefonos, y nunca la llave.
 */
const H = require('./wix-historial');

function arg(nombre, env, def) {
  const i = process.argv.indexOf('--' + nombre);
  if (i > -1) return process.argv[i + 1];
  return process.env[env] || def;
}
function hoyMas(meses) { const d = new Date(); d.setUTCMonth(d.getUTCMonth() + meses); return d.toISOString().slice(0, 10); }

async function credenciales(secreto) {
  const llave = process.env.WIX_API_KEY || (secreto ? secreto('wix-api-key') : '');
  if (!llave) throw new Error('Falta la llave de Wix (secreto wix-api-key). Llega el viernes 23.');
  return { llave: llave.trim(), sitio: process.env.WIX_SITE_ID || H.SITIO_POR_DEFECTO };
}

/** extra = { secreto(nombre), auth } cuando corre en la Mac; en Cloud Run va vacio. */
async function principal(extra) {
  const x = extra || {};
  const seco = process.argv.includes('--seco') || process.env.WIX_SECO === '1';
  const sinBase = process.argv.includes('--sin-base');
  const base = arg('base', 'DB_BASE', 'rosanta');
  if (!/^rosanta(_[a-z0-9]+)?$/.test(base)) throw new Error('Nombre de base invalido: ' + base);
  const desde = arg('desde', 'WIX_DESDE', '2022-12-01');
  const hasta = arg('hasta', 'WIX_HASTA', hoyMas(18));
  const ventanaCambios = [arg('cambios-desde', 'WIX_CAMBIOS_DESDE', '2026-10-20T07:58:00-06:00'),
    arg('cambios-hasta', 'WIX_CAMBIOS_HASTA', '2026-10-20T08:26:59-06:00')];

  const cred = await credenciales(x.secreto);
  let pool = null;
  if (!sinBase) {
    const { crearPool } = require('./db');
    const clave = process.env.DB_CLAVE || (x.secreto ? x.secreto('db-app') : undefined);
    pool = await crearPool({ usuario: 'app', clave, base, auth: x.auth });
  }
  try {
    const r = await H.importar({ cred, pool, desde, hasta, seco, ventanaCambios });
    console.log(JSON.stringify(Object.assign({ base: sinBase ? null : base, desde, hasta }, r), null, 2));
    return r;
  } finally {
    if (pool) { const { cerrarPool } = require('./db'); await cerrarPool(pool).catch(() => {}); }
  }
}

if (require.main === module) {
  principal().catch((e) => { console.error('ERROR: ' + e.message); process.exit(1); });
}
module.exports = { principal };
