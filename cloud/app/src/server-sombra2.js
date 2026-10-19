/**
 * Arranque de rosanta-nube-sombra2 en Cloud Run (17-oct-2026): Caja chica, Compras en efectivo y
 * la seccion Clientes (eventos, CRM, reservas, carritos) y Marketing (contenido y pauta) en SOMBRA. Servicio aparte de rosanta-nube (Pagos): mismo codigo base, otro
 * punto de entrada (GOOGLE_ENTRYPOINT="node src/server-sombra2.js" al publicar).
 * Claves por Secret Manager (DB_CLAVE, CLAVE_TAREAS), nunca en el codigo.
 */
const { GoogleAuth } = require('google-auth-library');
const { sheets } = require('@googleapis/sheets');
const { crearPool } = require('./db');
const { crearServicioF2 } = require('./sombra2/servicio-f2');
const { crearAppF2 } = require('./sombra2/app-f2');
const { comparar } = require('./sombra2/comparar-f2');
const pantallas = require('./sombra2/pantallas-f2');

function clienteSheets() {
  return sheets({ version: 'v4', auth: new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'] }) });
}

async function main() {
  if (process.env.TZ !== 'America/Guatemala') throw new Error('El servidor tiene que correr con TZ=America/Guatemala (fechas del maestro).');
  const pool = await crearPool();
  const f2 = crearServicioF2(pool);
  await f2.cargar().catch((e) => console.error('La sombra 2 no cargo:', e.message));
  const html = { caja: pantallas.armarCaja(), compras: pantallas.armarCompras(), fotos: pantallas.armarFotos(),
    reservas: pantallas.armarReservas(), carritos: pantallas.armarCarritos() };
  const app = crearAppF2({
    pool,
    f2: { llamar: f2.llamar, estado: f2.estado, partes: f2.partes, puede: f2.puede, refrescar: () => f2.refrescar(clienteSheets()) },
    comparar: () => { const c = f2.copia(); return comparar({ pool, sheets: clienteSheets(), librosCopia: c.libros, copiaLeida: c.leida }); },
    pantallas: { caja: () => html.caja, compras: () => html.compras, eventos: (o) => pantallas.armarEventos(o), fotos: () => html.fotos,
      reservas: () => html.reservas, carritos: () => html.carritos, marketing: (o) => pantallas.armarMarketing(o), crm: (o) => pantallas.armarCrm(Object.assign({ consolaUrl: f2.consolaUrl() }, o)) },
    anotarTiempo: (t) => pool.query('INSERT INTO tiempos (accion, donde, ms, quien) VALUES ($1,$2,$3,$4)', [t.accion, t.donde, t.ms, t.quien]),
    claveTareas: process.env.CLAVE_TAREAS,
    version: process.env.K_REVISION || 'local'
  });
  const port = Number(process.env.PORT || 8080);
  app.listen(port, () => console.log('rosanta-nube-sombra2 escuchando en ' + port));
}

main().catch((e) => { console.error(e); process.exit(1); });
