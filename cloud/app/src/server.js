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

async function leerUsuariosHoja() {
  const id = process.env.CONFIG_SHEET_ID;
  if (!id) throw new Error('Falta CONFIG_SHEET_ID.');
  const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'] });
  const s = sheets({ version: 'v4', auth });
  const r = await s.spreadsheets.values.get({ spreadsheetId: id, range: 'USUARIOS!A1:F' });
  return r.data.values || [];
}

function clienteSheets() {
  return sheets({ version: 'v4', auth: new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'] }) });
}

async function main() {
  if (process.env.TZ !== 'America/Guatemala') throw new Error('El servidor tiene que correr con TZ=America/Guatemala (fechas del maestro).');
  const pool = await crearPool();
  const pagos = crearServicioPagos(pool, { modo: process.env.MODO_PAGOS || 'sombra' });
  await pagos.cargar().catch((e) => console.error('Pagos no cargo:', e.message));
  const htmlPagos = pantalla.armar({ sombra: (process.env.MODO_PAGOS || 'sombra') === 'sombra' });
  const htmlFotos = pantalla.armarFotos();
  const app = crearApp({
    pool,
    pagos: { llamar: pagos.llamar, estado: pagos.estado, refrescar: () => pagos.refrescar(clienteSheets()) },
    pantallaPagos: () => htmlPagos,
    pantallaFotos: () => htmlFotos,
    compararPagos: () => { const c = pagos.copia(); return comparar({ pool, sheets: clienteSheets(), librosCopia: c.libros, copiaLeida: c.leida }); },
    anotarTiempo: (t) => pool.query('INSERT INTO tiempos (accion, donde, ms, quien) VALUES ($1,$2,$3,$4)', [t.accion, t.donde, t.ms, t.quien]),
    leerUsuariosHoja,
    claveTareas: process.env.CLAVE_TAREAS,
    version: process.env.K_REVISION || 'local'
  });
  const port = Number(process.env.PORT || 8080);
  app.listen(port, () => console.log('rosanta-nube escuchando en ' + port));
}

main().catch((e) => { console.error(e); process.exit(1); });
