/**
 * Arranque en Cloud Run. Las claves llegan como variables de entorno desde Secret Manager
 * (DB_CLAVE, CLAVE_TAREAS); nunca estan en el codigo.
 */
const { GoogleAuth } = require('google-auth-library');
const { sheets } = require('@googleapis/sheets');
const { crearApp } = require('./app');
const { crearPool } = require('./db');
const { crearServicioPagos } = require('./servicio-pagos');
const pantalla = require('./pantalla-pagos');
const { comparar } = require('./comparar-pagos');
const { conciliarMes } = require('./conciliar');

async function leerUsuariosHoja() {
  const id = process.env.CONFIG_SHEET_ID;
  if (!id) throw new Error('Falta CONFIG_SHEET_ID.');
  const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'] });
  const s = sheets({ version: 'v4', auth });
  const r = await s.spreadsheets.values.get({ spreadsheetId: id, range: 'USUARIOS!A1:F' });
  return r.data.values || [];
}

/**
 * Reintentos (19-oct-2026): la cuenta rosanta-nube@ comparte la cuota de Sheets (60 lecturas por minuto) con
 * todos los servicios; con un 429, Google rechaza el pedido sin hacerlo y se puede reintentar con espera.
 * Las LECTURAS reintentan tambien un 5xx. Las ESCRITURAS solo un 429: un 5xx puede llegar despues de que Google
 * ya escribio, y reintentar un "agregar fila" la duplicaria (la copia a la hoja se reintenta sola en el
 * proximo refresco, sin duplicar, porque escribe por ID).
 */
const REINTENTOS = (codigos) => ({ retryConfig: { retry: 4, retryDelay: 2000, statusCodesToRetry: codigos,
  httpMethodsToRetry: ['GET', 'HEAD', 'PUT', 'POST', 'OPTIONS'], noResponseRetries: 0 } });
const LECTURA_CON_REINTENTOS = REINTENTOS([[429, 429], [500, 599]]);
const ESCRITURA_CON_REINTENTOS = REINTENTOS([[429, 429]]);

function clienteSheets() {
  return sheets(Object.assign({ version: 'v4', auth: new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'] }) }, LECTURA_CON_REINTENTOS));
}

/** La cuenta de restaurante@ (secreto gmail-restaurante-oauth → GMAIL_OAUTH), una sola por servidor. Sin el secreto, null. */
let cuentaUnica = null;
function cuentaGoogle() {
  if (!process.env.GMAIL_OAUTH) return null;
  if (!cuentaUnica) cuentaUnica = require('./google-cuenta').crearCuenta({ credencial: process.env.GMAIL_OAUTH });
  return cuentaUnica;
}

async function main() {
  if (process.env.TZ !== 'America/Guatemala') throw new Error('El servidor tiene que correr con TZ=America/Guatemala (fechas del maestro).');
  const pool = await crearPool();
  // MODO_PAGOS=vivo solo PERMITE el modo en vivo; lo enciende PARAMETROS › motor_pagos = base en la hoja.
  const pagos = crearServicioPagos(pool, { modo: process.env.MODO_PAGOS || 'sombra',
    sheetsEscritura: process.env.MODO_PAGOS === 'vivo' ? () => sheets(Object.assign({ version: 'v4', auth: new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/spreadsheets'] }) }, ESCRITURA_CON_REINTENTOS)) : null });
  await pagos.cargar().catch((e) => console.error('Pagos no cargo:', e.message));
  const htmlSombra = pantalla.armar({ sombra: true }), htmlVivo = pantalla.armar({ sombra: false });
  const htmlCajaSombra = pantalla.armarCaja(true), htmlCajaVivo = pantalla.armarCaja(false);
  const htmlComprasSombra = pantalla.armarCompras(true), htmlComprasVivo = pantalla.armarCompras(false);
  const htmlFotos = pantalla.armarFotos();
  const app = crearApp({
    pool,
    pagos: { llamar: pagos.llamar, estado: pagos.estado, guardarCierre: pagos.guardarCierre, copia: pagos.copia, refrescar: () => pagos.refrescar(clienteSheets()) },
    // procesos de fondo (20-oct): la cuenta de restaurante@ (Gmail/Drive) y el permiso de escribir la Config
    cuentaGoogle: cuentaGoogle,
    resenas: { sheets: clienteSheets, gbp: require('./resenas-nube').gbpDelEntorno(process.env) },
    encuesta: {},
    // pauta_semanal (20-oct): los escritores de los lunes, con la cuenta de restaurante@ (Drive/Sheets) y la llave de Wix
    procPauta: cuentaGoogle() && { sheetsLectura: require('./proc-pauta').sheetsDeCuenta(cuentaGoogle()), drive: require('./proc-pauta').crearDrive(cuentaGoogle()),
      sheetsEscritura: sheets(Object.assign({ version: 'v4', auth: new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/spreadsheets'] }) }, ESCRITURA_CON_REINTENTOS)),
      env: { WIX_API_KEY: process.env.WIX_API_KEY, WIX_SITE_ID: process.env.WIX_SITE_ID } },
    sheetsEscritura: process.env.MODO_PAGOS === 'vivo' ? () => sheets(Object.assign({ version: 'v4', auth: new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/spreadsheets'] }) }, ESCRITURA_CON_REINTENTOS)) : null,
    pantallaPagos: () => (pagos.estado().modo === 'vivo' ? htmlVivo : htmlSombra),
    pantallaCaja: () => (pagos.estado().en_vivo.caja ? htmlCajaVivo : htmlCajaSombra),
    pantallaCompras: () => (pagos.estado().en_vivo.caja ? htmlComprasVivo : htmlComprasSombra),
    pantallaFotos: () => htmlFotos,
    compararPagos: () => { const c = pagos.copia(); return comparar({ pool, sheets: clienteSheets(), librosCopia: c.libros, copiaLeida: c.leida, enVivo: pagos.estado().en_vivo }); },
    conciliarMes: (mes) => conciliarMes({ pool, sheets: clienteSheets(), mes, exigir07: pagos.estado().en_vivo.caja }),
    anotarTiempo: (t) => pool.query('INSERT INTO tiempos (accion, donde, ms, quien) VALUES ($1,$2,$3,$4)', [t.accion, t.donde, t.ms, t.quien]),
    leerUsuariosHoja,
    claveTareas: process.env.CLAVE_TAREAS,
    version: process.env.K_REVISION || 'local'
  });
  const port = Number(process.env.PORT || 8080);
  app.listen(port, () => console.log('rosanta-nube escuchando en ' + port));
}

main().catch((e) => { console.error(e); process.exit(1); });
