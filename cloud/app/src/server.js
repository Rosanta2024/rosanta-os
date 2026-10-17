/**
 * Arranque en Cloud Run. Las claves llegan como variables de entorno desde Secret Manager
 * (DB_CLAVE, CLAVE_TAREAS); nunca estan en el codigo.
 */
const { GoogleAuth } = require('google-auth-library');
const { sheets } = require('@googleapis/sheets');
const { crearApp } = require('./app');
const { crearPool } = require('./db');

async function leerUsuariosHoja() {
  const id = process.env.CONFIG_SHEET_ID;
  if (!id) throw new Error('Falta CONFIG_SHEET_ID.');
  const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'] });
  const s = sheets({ version: 'v4', auth });
  const r = await s.spreadsheets.values.get({ spreadsheetId: id, range: 'USUARIOS!A1:F' });
  return r.data.values || [];
}

async function main() {
  const pool = await crearPool();
  const app = crearApp({
    pool,
    leerUsuariosHoja,
    claveTareas: process.env.CLAVE_TAREAS,
    version: process.env.K_REVISION || 'local'
  });
  const port = Number(process.env.PORT || 8080);
  app.listen(port, () => console.log('rosanta-nube escuchando en ' + port));
}

main().catch((e) => { console.error(e); process.exit(1); });
