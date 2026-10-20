/**
 * Arranque de Clientes EN VIVO en Cloud Run (19-oct-2026). Desde el 20-oct es tambien el arranque del servicio
 * DEFINITIVO rosanta-clientes (pipeline + /hooks/cotizaciones + reservas, carritos y CRM con CRM_VIVO=si;
 * variables CRM_LIBRO y, por Secret Manager con el si de Juanma, META_CAPI_TOKEN). Hoy: solo el servicio de ENSAYO
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
const { crearCrmVivo } = require('./vivo-clientes/crm-vivo');
const CC = require('./vivo-clientes/copiar-clientes');
const { crearCapi } = require('./vivo-clientes/capi');
const { crearMarketingVivo, copiarMarketing } = require('./vivo-clientes/marketing-vivo');

const MKT = process.env.MKT_VIVO_ID;
// Reservas, carritos y CRM (20-oct-2026): CRM_LIBRO = la CRM Maestra (o una de ensayo); CRM_VIVO=si los monta.
const CRM_LIBRO = process.env.CRM_LIBRO || '1VHg2GkmhGcVkxw0JZe1cBZzXOrsjzIk570yh7CyYwvM';
const LIBRO_INT = process.env.INTERRUPTOR_LIBRO || MKT;
const REAL = '1wxsMm1Vx7tUci3ErQGa4SiGftZ21vTrxYqAObiEooyc';

// La cuota de Sheets (60 por minuto) es de la cuenta rosanta-nube@ y la comparten todos los servicios: con un
// 429 Google no hizo nada y se puede reintentar. Lecturas: 429 y 5xx. Escrituras: SOLO 429 (un 5xx puede llegar
// despues de que Google agrego la fila, y reintentarlo la duplicaria). Misma regla que server.js (Estudio, 6f04aa3).
const REINTENTOS = (codigos) => ({ retryConfig: { retry: 4, retryDelay: 2000, statusCodesToRetry: codigos,
  httpMethodsToRetry: ['GET', 'HEAD', 'PUT', 'POST', 'OPTIONS'], noResponseRetries: 0 } });
const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
function clienteSheets() { return sheets(Object.assign({ version: 'v4', auth }, REINTENTOS([[429, 429], [500, 599]]))); }
function clienteSheetsEscritura() { return sheets(Object.assign({ version: 'v4', auth }, REINTENTOS([[429, 429]]))); }

async function main() {
  if (process.env.TZ !== 'America/Guatemala') throw new Error('El servidor tiene que correr con TZ=America/Guatemala.');
  if (!MKT) throw new Error('Falta MKT_VIVO_ID.');
  if (MKT === REAL && process.env.CLIENTES_VIVO_REAL !== 'si') throw new Error('MKT_VIVO_ID es Marketing OS real: hace falta CLIENTES_VIVO_REAL=si (dia del paso, con el si de Juanma).');
  const pool = await crearPool();
  const vivo = crearServicioVivo(pool, {
    mktId: MKT, sheets: clienteSheets, sheetsEscritura: clienteSheetsEscritura,
    leerInterruptor: async () => { const L = await C.leerLibro(clienteSheets(), LIBRO_INT, ['PARAMETROS']); return interruptor(L.PARAMETROS); }
  });
  await vivo.cargar().catch((e) => console.error('No cargo:', e.message));
  let crm = null;
  if (process.env.CRM_VIVO === 'si') {
    crm = crearCrmVivo(pool, {
      leerMkt: (pestanas) => C.leerLibro(clienteSheets(), MKT, pestanas),
      leerCrm: async () => { const p = await CC.pestanaCrm(clienteSheets(), CRM_LIBRO); return (await C.leerLibro(clienteSheets(), CRM_LIBRO, [p.title]))[p.title]; },
      copiar: (pestana, filas) => CC.copiar(clienteSheetsEscritura(), pestana === 'crm' ? CRM_LIBRO : MKT, filas, { pestana, llave: 'id' }),
      capi: crearCapi({ token: process.env.META_CAPI_TOKEN || '' })
    });
  }
  // Marketing (contenido y pauta), con MARKETING_VIVO=si: interruptor PARAMETROS › motor_marketing (30 s de cache)
  let marketing = null, leerModoMarketing = null;
  if (process.env.MARKETING_VIVO === 'si') {
    const CONFIG = LIBRO_INT;   // Config (PARAMETROS y METAS); en ensayo, la hoja de ensayo
    const existentes = async (id, ps) => { const m = await clienteSheets().spreadsheets.get({ spreadsheetId: id, fields: 'sheets.properties.title' }); const t = m.data.sheets.map((x) => x.properties.title); return ps.filter((p) => t.includes(p)); };
    marketing = crearMarketingVivo(pool, {
      configId: CONFIG,
      leerMkt: async (ps) => C.leerLibro(clienteSheets(), MKT, await existentes(MKT, ps)),
      leerConfig: async () => C.leerLibro(clienteSheets(), CONFIG, await existentes(CONFIG, ['PARAMETROS', 'METAS'])),
      copiar: (pestana, cambios, bajas, enc) => copiarMarketing(clienteSheetsEscritura(), MKT, pestana, cambios, bajas, enc)
    });
    let cacheModo = { t: 0, v: 'sheets' };
    leerModoMarketing = async () => {
      if (Date.now() - cacheModo.t < 30000) return cacheModo.v;
      const L = await C.leerLibro(clienteSheets(), CONFIG, ['PARAMETROS']);
      cacheModo = { t: Date.now(), v: interruptor(L.PARAMETROS, 'motor_marketing') };
      return cacheModo.v;
    };
  }
  const hoy = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Guatemala' }).format(new Date());
  const app = crearAppVivo({ pool, vivo, crm, marketing, leerModoMarketing, hoy, pantallaEventos: armarEventosVivo, claveTareas: process.env.CLAVE_TAREAS,
    claveHook: process.env.COTIZ_TOKEN_VIVO, version: process.env.K_REVISION || 'local' });
  app.listen(Number(process.env.PORT || 8080), () => console.log('clientes-vivo escuchando'));
}
main().catch((e) => { console.error(e); process.exit(1); });
