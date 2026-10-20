/**
 * Copiar a las hojas lo que el servidor guardo de reservas, carritos y CRM (20-oct-2026).
 *
 * Igual que escribir-hoja.js (cada celda con su tipo, como setValues), con dos diferencias que pide el
 * codigo real de Marketing OS:
 *  - reservas y carritos: lo nuevo va ARRIBA, justo debajo del encabezado (TABS_NUEVO_ARRIBA de Code.js);
 *  - CRM Maestra: no tiene columna id. Cada fila se encuentra por su correo o por los ultimos 8 del
 *    telefono (como construirIndice_ de CRMSync); el telefono va con formato texto (CRMSync: '@').
 */
const EH = require('../escribir-hoja');
const { llaveCrm } = require('./motor-crm');

/** Como EH.celda, pero una fecha sin hora va con formato de fecha (asi la deja Sheets al teclear 2026-10-20). */
function celda(x, texto) {
  if (x instanceof Date && !x.getHours() && !x.getMinutes() && !x.getSeconds()) return { userEnteredValue: { numberValue: EH.serieDeFecha(x) }, userEnteredFormat: { numberFormat: { type: 'DATE' } } };
  if (texto && typeof x === 'number') return { userEnteredValue: { stringValue: String(x) }, userEnteredFormat: { numberFormat: { type: 'TEXT' } } };
  return EH.celda(x, texto && x !== '' && x !== null && x !== undefined);
}
const filaCeldas = (H, f, texto) => ({ values: H.map((_, j) => celda(f[j] === undefined ? '' : f[j], texto.indexOf(j) !== -1)) });
const CAMPOS = 'userEnteredValue,userEnteredFormat.numberFormat';

/** Las llaves por las que se puede encontrar una fila del CRM (correo y telefono). */
function llavesCrm(f) {
  const out = [];
  const email = String(f[2] || '').trim().toLowerCase();
  const tel = String(f[1] || '').replace(/\D/g, '');
  if (email) out.push('e:' + email);
  if (tel.length >= 8) out.push('t:' + tel.slice(-8));
  return out;
}

/** reservas / carritos: las que ya estan se reescriben en su lugar; las nuevas se insertan arriba. Funcion pura. */
function planArriba(valoresHoja, filas, sheetId, opciones) {
  const o = opciones || {};
  const H = (valoresHoja[0] || []).map((h) => String(h || '').trim());
  const iId = H.indexOf(o.llave || 'id');
  if (iId < 0) throw new Error((o.pestana || 'La pestaña') + ' no tiene la columna ' + (o.llave || 'id') + '.');
  const donde = new Map();
  for (let r = 1; r < valoresHoja.length; r++) { const id = String(valoresHoja[r][iId] === undefined ? '' : valoresHoja[r][iId]).trim(); if (id && !donde.has(id)) donde.set(id, r); }
  const requests = [], nuevas = [];
  filas.forEach((x) => {
    const r = donde.get(String(x.id));
    if (r === undefined) { nuevas.push(filaCeldas(H, x.fila, [iId])); return; }
    requests.push({ updateCells: { range: { sheetId, startRowIndex: r, endRowIndex: r + 1, startColumnIndex: 0, endColumnIndex: H.length }, rows: [filaCeldas(H, x.fila, [iId])], fields: CAMPOS } });
  });
  // primero las actualizaciones (con las filas donde estan ahora), despues se abre lugar arriba
  if (nuevas.length) {
    requests.push({ insertDimension: { range: { sheetId, dimension: 'ROWS', startIndex: 1, endIndex: 1 + nuevas.length }, inheritFromBefore: false } });
    requests.push({ updateCells: { range: { sheetId, startRowIndex: 1, endRowIndex: 1 + nuevas.length, startColumnIndex: 0, endColumnIndex: H.length }, rows: nuevas, fields: CAMPOS } });
  }
  return { requests, nuevas: nuevas.length, actualizadas: filas.length - nuevas.length };
}

/** CRM: cada fila se busca por su llave guardada o por su correo/telefono; si no esta, va al final. Funcion pura. */
function planCrm(valoresHoja, filas, sheetId) {
  const H = valoresHoja[0] || [];
  const ancho = Math.max(H.length, 12);
  const indice = new Map();
  for (let r = 1; r < valoresHoja.length; r++) llavesCrm(valoresHoja[r]).forEach((k) => { if (!indice.has(k)) indice.set(k, r); });
  const requests = [], nuevas = [];
  const fila = (f) => filaCeldas(new Array(ancho).fill(0), f, [1]);   // B (telefono) como texto
  filas.forEach((x) => {
    const claves = [x.llave].concat(llavesCrm(x.fila));
    const r = claves.map((k) => indice.get(k)).find((v) => v !== undefined);
    if (r === undefined) { nuevas.push(fila(x.fila)); claves.forEach((k) => indice.set(k, -1)); return; }
    if (r === -1) return;   // ya va como nueva en esta misma copia
    requests.push({ updateCells: { range: { sheetId, startRowIndex: r, endRowIndex: r + 1, startColumnIndex: 0, endColumnIndex: ancho }, rows: [fila(x.fila)], fields: CAMPOS } });
  });
  if (nuevas.length) requests.push({ appendCells: { sheetId, rows: nuevas, fields: CAMPOS } });
  return { requests, nuevas: nuevas.length, actualizadas: requests.length - (nuevas.length ? 1 : 0) };
}

/** La pestaña del CRM: la primera con first_name en la fila 1 (como abrirPestanaCRM_). */
async function pestanaCrm(sheets, libroId) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId: libroId, fields: 'sheets.properties(sheetId,title)' });
  for (const s of meta.data.sheets) {
    const v = await sheets.spreadsheets.values.get({ spreadsheetId: libroId, range: "'" + s.properties.title + "'!A1:J1" });
    if (((v.data.values || [])[0] || []).join('|').toLowerCase().indexOf('first_name') > -1) return s.properties;
  }
  throw new Error('No encontré la pestaña del CRM (ninguna tiene first_name en la fila 1).');
}

/**
 * Copia a la hoja (una llamada de lectura y una de escritura). filas: reservas/carritos [{ id, fila }];
 * crm [{ llave, fila }]. opciones: { pestana: 'reservas'|'carritos'|'crm', llave }.
 */
async function copiar(sheets, libroId, filas, opciones) {
  const o = opciones || {};
  if (!filas.length) return { nuevas: 0, actualizadas: 0 };
  let props;
  if (o.pestana === 'crm') props = await pestanaCrm(sheets, libroId);
  else {
    const meta = await sheets.spreadsheets.get({ spreadsheetId: libroId, fields: 'sheets.properties(sheetId,title)' });
    const s = meta.data.sheets.find((x) => x.properties.title === o.pestana);
    if (!s) throw new Error('La hoja no tiene la pestaña ' + o.pestana + '.');
    props = s.properties;
  }
  const v = await sheets.spreadsheets.values.get({ spreadsheetId: libroId, range: "'" + props.title + "'", valueRenderOption: 'UNFORMATTED_VALUE' });
  const plan = o.pestana === 'crm' ? planCrm(v.data.values || [], filas, props.sheetId) : planArriba(v.data.values || [], filas, props.sheetId, o);
  if (plan.requests.length) await sheets.spreadsheets.batchUpdate({ spreadsheetId: libroId, requestBody: { requests: plan.requests } });
  return { nuevas: plan.nuevas, actualizadas: plan.actualizadas };
}

module.exports = { celda, planArriba, planCrm, llavesCrm, copiar, pestanaCrm, llaveCrm };
