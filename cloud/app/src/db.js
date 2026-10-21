/**
 * Conexion a Cloud SQL (rosanta-db, Queretaro).
 *
 * La base no tiene ninguna red autorizada: solo se entra por el conector de Cloud SQL, que pide
 * un certificado temporal con la cuenta de Google de quien conecta (en Cloud Run, la cuenta de
 * servicio rosanta-nube; en la Mac, el token de gcloud de restaurante@rosanta.rest).
 */
const { Connector } = require('@google-cloud/cloud-sql-connector');
const { Pool } = require('pg');

const INSTANCIA = process.env.DB_INSTANCIA || 'rosanta-apps-script:northamerica-south1:rosanta-db';

/**
 * opciones: { usuario, clave, base, auth } — auth es opcional (un GoogleAuth o un OAuth2Client);
 * sin auth el conector usa las credenciales por defecto (las de Cloud Run).
 */
async function crearPool(opciones) {
  const o = opciones || {};
  const connector = new Connector(o.auth ? { auth: o.auth } : undefined);
  const cfg = await connector.getOptions({ instanceConnectionName: INSTANCIA, ipType: 'PUBLIC' });
  const pool = new Pool(Object.assign({}, cfg, {
    user: o.usuario || process.env.DB_USUARIO || 'app',
    password: o.clave || process.env.DB_CLAVE,
    database: o.base || process.env.DB_BASE || 'rosanta',
    max: Number(process.env.DB_MAX || 5)
  }));
  pool._conector = connector;
  return pool;
}

async function cerrarPool(pool) {
  if (!pool) return;
  await pool.end();
  if (pool._conector) pool._conector.close();
}

module.exports = { crearPool, cerrarPool, INSTANCIA };
