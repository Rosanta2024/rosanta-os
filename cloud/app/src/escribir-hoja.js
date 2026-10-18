/**
 * Copiar a la hoja PAGOS_PROVEEDORES los pagos guardados en el servidor nuevo (modo en vivo, 18-oct-2026).
 *
 * En vivo la base manda; la hoja queda como copia para que la intranet (Caja chica, Compras, Balance,
 * el contador) la siga leyendo. Cada celda se escribe con su tipo exacto, como lo haria setValues de
 * Apps Script: texto como texto (el ID con formato texto, para que no se vuelva un numero), numeros
 * como numeros y fechas como fecha. Asi, cuando la importacion de cada 15 min vuelve a leer la fila,
 * la encuentra identica a la de la base y no hay conflictos falsos.
 *
 * Una fila que ya esta en la hoja (mismo ID) se reescribe en su lugar; una nueva va al final.
 */

const PESTANA = 'PAGOS_PROVEEDORES';

/** Date local (hora de Guatemala) → numero de serie de Sheets, sin milisegundos. */
function serieDeFecha(d) {
  const ms = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds());
  return ms / 86400000 + 25569;
}

/** Un valor (como getValues) → CellData de la API. esId: la columna ID va con formato texto. */
function celda(x, esId) {
  if (x instanceof Date) return { userEnteredValue: { numberValue: serieDeFecha(x) }, userEnteredFormat: { numberFormat: { type: 'DATE_TIME' } } };
  if (esId) return { userEnteredValue: { stringValue: String(x) }, userEnteredFormat: { numberFormat: { type: 'TEXT' } } };
  if (x === '' || x === null || x === undefined) return { userEnteredValue: null };
  if (typeof x === 'number') return { userEnteredValue: { numberValue: x } };
  if (typeof x === 'boolean') return { userEnteredValue: { boolValue: x } };
  return { userEnteredValue: { stringValue: String(x) } };
}

/**
 * planCopia(valoresHoja, filas, sheetId) → requests de batchUpdate.
 * valoresHoja: la pestaña como esta ahora (encabezado + filas). filas: [{ id, fila }] con la fila completa
 * en el orden del encabezado. Funcion pura.
 */
function planCopia(valoresHoja, filas, sheetId, opciones) {
  const o = opciones || {};
  const col = o.llave || 'ID';
  const H = (valoresHoja[0] || []).map((h) => String(h || '').trim());
  const iId = H.indexOf(col);
  if (iId < 0) throw new Error((o.pestana || PESTANA) + ' no tiene la columna ' + col + '.');
  // la llave de cada fila de la hoja; una fecha (FECHA de un cierre) viene como numero de serie
  const llaveHoja = (x) => (o.llaveEsFecha && typeof x === 'number'
    ? (() => { const d = new Date(Math.round((x - 25569) * 86400000)); return d.toISOString().slice(0, 10); })()
    : String(x === undefined ? '' : x).trim());
  const dondeEsta = new Map();
  for (let r = 1; r < valoresHoja.length; r++) {
    const id = llaveHoja(valoresHoja[r][iId]);
    if (id && !dondeEsta.has(id)) dondeEsta.set(id, r);
  }
  // la columna llave va con formato texto solo si es un ID (una FECHA va como fecha)
  const fila = (f) => ({ values: H.map((_, j) => celda(f[j] === undefined ? '' : f[j], j === iId && col === 'ID')) });
  const requests = [], nuevas = [];
  let actualizadas = 0;
  filas.forEach((x) => {
    const r = dondeEsta.get(String(x.id));
    if (r === undefined) { nuevas.push(fila(x.fila)); return; }
    actualizadas++;
    requests.push({ updateCells: { range: { sheetId, startRowIndex: r, endRowIndex: r + 1, startColumnIndex: 0, endColumnIndex: H.length },
      rows: [fila(x.fila)], fields: 'userEnteredValue,userEnteredFormat.numberFormat' } });
  });
  if (nuevas.length) requests.push({ appendCells: { sheetId, rows: nuevas, fields: 'userEnteredValue,userEnteredFormat.numberFormat' } });
  return { requests, nuevas: nuevas.length, actualizadas };
}

/** Copia las filas a la hoja (una sola llamada a la API). filas: [{ id, fila }]. */
async function copiarFilas(sheets, libroId, filas, opciones) {
  const o = Object.assign({ pestana: PESTANA, llave: 'ID' }, opciones || {});
  if (!filas.length) return { nuevas: 0, actualizadas: 0 };
  const meta = await sheets.spreadsheets.get({ spreadsheetId: libroId, fields: 'sheets.properties(sheetId,title)' });
  let hoja = meta.data.sheets.find((s) => s.properties.title === o.pestana);
  if (!hoja && o.encabezado && o.encabezado.length) {
    // la intranet crea RETIROS_SOLICITUDES (y otras) con el primer movimiento: aca igual, con su encabezado
    const r = await sheets.spreadsheets.batchUpdate({ spreadsheetId: libroId, requestBody: { requests: [
      { addSheet: { properties: { title: o.pestana, gridProperties: { frozenRowCount: 1 } } } }] } });
    hoja = { properties: r.data.replies[0].addSheet.properties };
    await sheets.spreadsheets.values.update({ spreadsheetId: libroId, range: "'" + o.pestana + "'!A1", valueInputOption: 'RAW',
      requestBody: { values: [o.encabezado.map(String)] } });
  }
  if (!hoja) throw new Error('La hoja no tiene la pestaña ' + o.pestana + '.');
  const v = await sheets.spreadsheets.values.get({ spreadsheetId: libroId, range: "'" + o.pestana + "'", valueRenderOption: 'UNFORMATTED_VALUE' });
  const plan = planCopia(v.data.values || [], filas, hoja.properties.sheetId, o);
  await sheets.spreadsheets.batchUpdate({ spreadsheetId: libroId, requestBody: { requests: plan.requests } });
  return { nuevas: plan.nuevas, actualizadas: plan.actualizadas };
}

module.exports = { PESTANA, serieDeFecha, celda, planCopia, copiarFilas };
