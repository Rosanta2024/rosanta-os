#!/usr/bin/env node
/**
 * Ensayo del motor de reservas contra una base REAL de ensayo (nunca contra "rosanta"). NO SE HA CORRIDO.
 * Requiere la 050 y la 051 aplicadas en rosanta_ensayo y la carga desde Wix hecha (cargar-reservas-desde-wix.js).
 *
 *   node cloud/herramientas/ensayo-reservas.js --base rosanta_ensayo
 *       SOLO LEE: franjas libres de los proximos 14 dias para 2, 4, 6 y 10 personas (conteos por dia), para
 *       compararlas a ojo con GET /_functions/slots de Wix antes de la sombra automatica.
 *   node cloud/herramientas/ensayo-reservas.js --base rosanta_ensayo --escribir
 *       ademas crea una reserva INVENTADA (sin datos reales), la cambia de hora y la cancela, con el candado y el
 *       historial de verdad, y muestra el historial. No toca el interruptor motor_reservas: el motor de este
 *       ensayo escribe con escribirEnModoWix (opcion que solo usa este script).
 * Ningun gancho esta conectado: no sale ningun correo, WhatsApp, CAPI ni nada a Wix.
 */
const path = require('path');
const { execFileSync } = require('child_process');
const APP = path.join(__dirname, '..', 'app');
const { OAuth2Client } = require(path.join(APP, 'node_modules', 'google-auth-library'));
const { crearPool, cerrarPool } = require(path.join(APP, 'src', 'db'));
const { crearMotor } = require(path.join(APP, 'src', 'reservas', 'motor'));
const C = require(path.join(APP, 'src', 'reservas', 'comun'));

const GCLOUD = process.env.GCLOUD || path.join(process.env.HOME, 'google-cloud-sdk', 'bin', 'gcloud');
const ENV = Object.assign({}, process.env, {
  CLOUDSDK_PYTHON: process.env.CLOUDSDK_PYTHON || '/Library/Frameworks/Python.framework/Versions/3.14/bin/python3'
});
function gcloud(args) {
  return execFileSync(GCLOUD, args.concat(['--project', 'rosanta-apps-script']), { env: ENV, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
}
const iBase = process.argv.indexOf('--base');
const BASE = iBase > -1 ? process.argv[iBase + 1] : '';
if (!/^rosanta_[a-z0-9]+$/.test(BASE)) throw new Error('El ensayo corre SOLO en una base de ensayo (--base rosanta_ensayo), nunca en rosanta.');
const ESCRIBIR = process.argv.includes('--escribir');

(async () => {
  const auth = new OAuth2Client();
  auth.setCredentials({ access_token: gcloud(['auth', 'print-access-token']) });
  const pool = await crearPool({ usuario: 'app', clave: gcloud(['secrets', 'versions', 'access', 'latest', '--secret', 'db-app']), base: BASE, auth });
  const motor = crearMotor({ pool, escribirEnModoWix: ESCRIBIR, ganchos: {}, registrar: (m) => console.log(m) });
  try {
    console.log('motor_reservas =', await motor.modo());
    const hoy = C.diaGt(Date.now());
    const filas = [];
    for (let i = 0; i < 14; i++) {
      const f = C.sumarDias(hoy, i);
      const fila = { fecha: f };
      for (const p of [2, 4, 6, 10]) fila[p + 'p'] = (await motor.slotsWeb(f, p)).slots.length;
      filas.push(fila);
    }
    console.table(filas);
    if (!ESCRIBIR) return;
    const f = C.sumarDias(hoy, 7);
    const libres = (await motor.slotsWeb(f, 2)).slots;
    if (libres.length < 2) throw new Error('El ' + f + ' no tiene dos franjas libres para el ensayo.');
    const c = await motor.crear({ nombre: 'Ensayo', apellido: 'Motor', email: 'ensayo-motor@ejemplo.test', telefono: '+50200000000',
      inicio: libres[0].startDate, personas: 2, origen: 'sala', canal: 'ensayo' }, { canal: 'web', quien: 'ensayo-reservas' });
    if (!c.ok) throw new Error('No se pudo crear: ' + c.motivo);
    console.log('creada', c.reserva.id, C.horaGt(c.reserva.inicio), c.reserva.mesa_ids);
    const m = await motor.cambiar(c.reserva.id, { inicio: libres[1].startDate }, { canal: 'web', quien: 'ensayo-reservas' });
    console.log('cambiada', m.ok, m.reserva && C.horaGt(m.reserva.inicio));
    const x = await motor.cambiarEstado(c.reserva.id, 'cancelada', { quien: 'ensayo-reservas', motivo: 'ensayo' });
    console.log('cancelada', x.ok);
    console.table((await motor.historial(c.reserva.id)).map((h) => ({ quien: h.quien, evento: h.evento })));
  } finally { await cerrarPool(pool).catch(() => {}); }
})().catch((e) => { console.error('ERROR: ' + e.message); process.exit(1); });
