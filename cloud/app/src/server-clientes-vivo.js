/**
 * Arranque del pipeline EN VIVO en Cloud Run (19-oct-2026). Hoy: solo el servicio de ENSAYO
 * rosanta-nube-clientes-ensayo (base rosanta_ensayo, hoja de ensayo). Punto de entrada aparte:
 * GOOGLE_ENTRYPOINT="node src/server-clientes-vivo.js".
 *
 * Variables: MKT_VIVO_ID (la hoja del pipeline: la de ensayo, o Marketing OS el dia del paso),
 * INTERRUPTOR_LIBRO (donde esta PARAMETROS con motor_eventos), DB_BASE, y por Secret Manager
 * DB_CLAVE, CLAVE_TAREAS y COTIZ_TOKEN_VIVO (la clave del hook de la revision diaria).
 */
const { GoogleAuth } = require('google-auth-library');
const { sheets } = require('@googleapis/sheets');
const C = require('./copia-hojas');
const { crearPool } = require('./db');
const { crearServicioVivo, interruptor } = require('./vivo-clientes/servicio');
const { crearAppVivo } = require('./vivo-clientes/app');
const { armarEventosVivo } = require('./vivo-clientes/pantalla');

const MKT = process.env.MKT_VIVO_ID;
const LIBRO_INT = process.env.INTERRUPTOR_LIBRO || MKT;
const REAL = '1wxsMm1Vx7tUci3ErQGa4SiGftZ21vTrxYqAObiEooyc';

function clienteSheets() {
  return sheets({ version: 'v4', auth: new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/spreadsheets'] }) });
}

async function main() {
  if (process.env.TZ !== 'America/Guatemala') throw new Error('El servidor tiene que correr con TZ=America/Guatemala.');
  if (!MKT) throw new Error('Falta MKT_VIVO_ID.');
  if (MKT === REAL && process.env.CLIENTES_VIVO_REAL !== 'si') throw new Error('MKT_VIVO_ID es Marketing OS real: hace falta CLIENTES_VIVO_REAL=si (dia del paso, con el si de Juanma).');
  const pool = await crearPool();
  const vivo = crearServicioVivo(pool, {
    mktId: MKT, sheets: clienteSheets,
    leerInterruptor: async () => { const L = await C.leerLibro(clienteSheets(), LIBRO_INT, ['PARAMETROS']); return interruptor(L.PARAMETROS); }
  });
  await vivo.cargar().catch((e) => console.error('No cargo:', e.message));
  const app = crearAppVivo({ pool, vivo, pantallaEventos: armarEventosVivo, claveTareas: process.env.CLAVE_TAREAS,
    claveHook: process.env.COTIZ_TOKEN_VIVO, version: process.env.K_REVISION || 'local' });
  app.listen(Number(process.env.PORT || 8080), () => console.log('clientes-vivo escuchando'));
}
main().catch((e) => { console.error(e); process.exit(1); });
