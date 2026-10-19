/**
 * Arranque de rosanta-bot-sombra en Cloud Run (19-oct-2026): el bot de Rosanta como servicio aparte, en
 * SOMBRA. No recibe mensajes de Meta (Meta manda a una sola direccion: la del bot de produccion); prueba el
 * codigo real del bot reproduciendo los chats guardados. Claves por Secret Manager (DB_CLAVE,
 * CLAVE_TAREAS y, si existe, ANTHROPIC_SOMBRA), nunca en el codigo.
 */
const { GoogleAuth } = require('google-auth-library');
const { crearPool } = require('./db');
const { crearServicioBot, KB_DOC_ID } = require('./servicio-bot');
const { crearAppBot } = require('./app-bot');

/** El texto de la base de conocimiento (Google Doc compartido con el servidor como Lector). Cache 10 min, como el bot. */
function crearLectorKb() {
  const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/drive.readonly'] });
  let cache = null, hasta = 0;
  return async function kb() {
    if (cache && Date.now() < hasta) return cache;
    const cliente = await auth.getClient();
    const r = await cliente.request({ url: 'https://www.googleapis.com/drive/v3/files/' + KB_DOC_ID + '/export?mimeType=text/plain', responseType: 'text' });
    cache = String(r.data).replace(/^﻿/, '');
    hasta = Date.now() + 600000;
    return cache;
  };
}

async function main() {
  if (process.env.TZ !== 'America/Guatemala') throw new Error('El servidor tiene que correr con TZ=America/Guatemala.');
  const pool = await crearPool();
  const claveModelo = process.env.ANTHROPIC_SOMBRA || '';
  const servicio = crearServicioBot({ pool, kb: crearLectorKb(), claveModelo });
  const app = crearAppBot({ servicio, claveTareas: process.env.CLAVE_TAREAS, version: process.env.K_REVISION || 'local', modeloEncendido: !!claveModelo });
  const port = Number(process.env.PORT || 8080);
  app.listen(port, () => console.log('rosanta-bot-sombra escuchando en ' + port));
}

main().catch((e) => { console.error(e); process.exit(1); });
