#!/usr/bin/env node
/**
 * Reproducir lo historico de reservas, carritos y CRM con el codigo de la nube (20-oct-2026, orden del dia
 * unico). SOLO LEE las hojas reales (Marketing OS y CRM Maestra, como rosanta-nube@ con permiso de lectura)
 * y no escribe en ningun lado. No imprime datos personales: las personas salen como e:… / t:… con 4 letras.
 *
 *   node cloud/herramientas/reproducir-crm.js [dias=30]
 *
 * A. sincronizarCRM corrido por la nube sobre las hojas de hoy NO cambia nada (el CRM de Apps Script es el
 *    que daria la nube). Es lo mismo que mide la comparacion de cada noche.
 * B. Cada reserva de los ultimos N dias, vuelta a pasar por intakeReserva como si llegara de nuevo (sin su
 *    fila), da la misma fila que esta en la hoja.
 * C. Cada carrito de los ultimos N dias, vuelto a pasar por intakeCarrito, da la misma fila (salvo el id,
 *    que es la hora de llegada).
 */
const path = require('path');
const { execFileSync } = require('child_process');
const APP = path.join(__dirname, '..', 'app');
const req = (m) => require(path.join(APP, 'node_modules', m));
const { OAuth2Client } = req('google-auth-library');
const { sheets } = req('@googleapis/sheets');
const C = require(path.join(APP, 'src', 'copia-hojas'));
const MC = require(path.join(APP, 'src', 'vivo-clientes', 'motor-crm'));
const CC = require(path.join(APP, 'src', 'vivo-clientes', 'copiar-clientes'));

if (process.env.TZ !== 'America/Guatemala') { console.error('Correr con TZ=America/Guatemala'); process.exit(1); }
const DIAS = Number(process.argv[2] || 30);
const GCLOUD = path.join(process.env.HOME, 'google-cloud-sdk', 'bin', 'gcloud');
const g = (a) => execFileSync(GCLOUD, a.concat(['--project', 'rosanta-apps-script']), { encoding: 'utf8' }).trim();
const tapar = (k) => String(k || '').slice(0, 6) + '…';
const txt = (x) => (x instanceof Date ? C.codificar([[x]])[0][0].$d.slice(0, 10) : x);
const igual = (a, b) => JSON.stringify(a.map(txt)) === JSON.stringify(b.map(txt));

(async () => {
  const r = await fetch('https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/rosanta-nube@rosanta-apps-script.iam.gserviceaccount.com:generateAccessToken',
    { method: 'POST', headers: { Authorization: 'Bearer ' + g(['auth', 'print-access-token']), 'Content-Type': 'application/json' }, body: JSON.stringify({ scope: ['https://www.googleapis.com/auth/spreadsheets.readonly'], lifetime: '900s' }) });
  const a = new OAuth2Client(); a.setCredentials({ access_token: (await r.json()).accessToken });
  const S = sheets({ version: 'v4', auth: a });
  const mkt = await C.leerLibro(S, MC.MKT_ID, ['reservas', 'carritos']);
  const p = await CC.pestanaCrm(S, MC.CRM_ID);
  const crm = (await C.leerLibro(S, MC.CRM_ID, [p.title]))[p.title];
  const hoy = { reservas: mkt.reservas, carritos: mkt.carritos, crm, crmPestana: p.title };
  console.log('Leido: reservas ' + (mkt.reservas.length - 1) + ', carritos ' + (mkt.carritos.length - 1) + ', CRM ' + (crm.length - 1) + ' (pestaña ' + p.title + ')');

  // A
  const mA = MC.crearMotorCrm(hoy);
  mA.correr('sincronizarCRM', []);
  const cA = mA.cambios().crm;
  console.log('\nA. sincronizarCRM de la nube sobre lo de hoy: ' + cA.length + ' filas cambiarían');
  const porQue = {};
  cA.forEach((x) => {
    const antes = x.nueva ? null : crm[x.pos];
    const cols = antes ? MC.comoSetValues(x.fila, [1]).map((v, j) => (txt(v) !== txt(antes[j]) ? crm[0][j] : null)).filter(Boolean) : ['(nueva)'];
    const k = cols.join('+'); (porQue[k] = porQue[k] || []).push(tapar(x.llave));
  });
  Object.keys(porQue).forEach((k) => console.log('   ' + k + ': ' + porQue[k].length + '  ej. ' + porQue[k].slice(0, 3).join(' ')));

  // B y C
  const corte = new Date(); corte.setDate(corte.getDate() - DIAS); corte.setHours(0, 0, 0, 0);
  for (const pest of ['reservas', 'carritos']) {
    const M = mkt[pest], H = M[0].map(String), iF = H.indexOf('fecha');
    const recientes = M.slice(1).filter((f) => f[iF] instanceof Date && f[iF] >= corte);
    let iguales = 0; const difs = {};
    for (const f of recientes) {
      const sin = { reservas: mkt.reservas, carritos: mkt.carritos, crm, crmPestana: p.title };
      sin[pest] = [M[0]].concat(M.slice(1).filter((x) => x !== f));
      const o = Object.fromEntries(H.map((h, j) => [h, txt(f[j])]));
      let cuerpo;
      if (pest === 'reservas') cuerpo = { id: o.id, fecha: o.fecha, nombre: o.nombre, email: o.email, telefono: String(o.telefono || ''), personas: o.personas, gasto: o.gasto, estado: o.estado, optin: o.optin };
      else {
        const esEmail = String(o.contacto).indexOf('@') > -1;
        // la hoja guarda UN contacto (correo si habia): si el canal es WhatsApp, la persona tambien dejo telefono
        // (no queda en la hoja; con cualquiera da el mismo carrito)
        const telAparte = esEmail && o.canal === 'WhatsApp' ? '00000000' : '';
        cuerpo = { nombre: o.nombre === '(sin nombre)' ? '' : o.nombre, email: esEmail ? o.contacto : '', telefono: esEmail ? telAparte : String(o.contacto || ''), valor: o.valor, consentimiento: o.consentimiento, fecha: o.fecha };
      }
      const m = MC.crearMotorCrm(sin);
      const fn = pest === 'reservas' ? 'intakeReserva' : 'intakeCarrito';
      const res = m.correr(fn, [cuerpo]);
      const nueva = m.cambios()[pest].find((x) => (pest === 'reservas' ? x.id === o.id : true));
      if (!nueva) { (difs['no se guardó: ' + JSON.stringify(res && res.error || '')] = difs['no se guardó: ' + JSON.stringify(res && res.error || '')] || []).push(tapar(o.id)); continue; }
      const a1 = nueva.fila.slice(), b1 = f.slice();
      if (pest === 'carritos') { a1[0] = b1[0]; a1[5] = b1[5]; }   // id = hora de llegada; estado lo cambian despues las reservas
      if (pest === 'reservas') { a1[7] = b1[7]; a1[6] = b1[6]; }   // estado y gasto los cambian avisos posteriores (al sentarse, al cerrar la mesa)
      if (igual(a1, b1)) { iguales++; continue; }
      const cols = a1.map((v, j) => (txt(v) !== txt(b1[j]) ? H[j] + '(' + typeof txt(v) + '/' + typeof txt(b1[j]) + ')' : null)).filter(Boolean).join('+');
      (difs[cols] = difs[cols] || []).push(tapar(o.id));
    }
    console.log('\n' + (pest === 'reservas' ? 'B' : 'C') + '. ' + pest + ' de los ultimos ' + DIAS + ' dias: ' + recientes.length + ', iguales ' + iguales);
    Object.keys(difs).forEach((k) => console.log('   distinta en ' + k + ': ' + difs[k].length + '  ej. ' + difs[k].slice(0, 3).join(' ')));
  }
})().catch((e) => { console.error(e.message); process.exit(1); });
