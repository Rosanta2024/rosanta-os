/**
 * Piezas comunes para guardar en la base pestañas de Marketing OS escritas con el codigo real
 * (20-oct-2026; las usa marketing-vivo.js). Cada pestaña tiene una LLAVE por fila (por defecto la columna A).
 *
 *  - completarHojas: lo que el motor de la intranet no imita y Marketing usa (appendRow, deleteRow,
 *    getParent, insertSheet de una pestaña permitida), solo en pestañas que se pueden escribir.
 *  - diferencias: que filas cambiaron, cuales son nuevas y cuales salieron (por llave, no por posicion:
 *    deleteRow corre las filas).
 *  - planLlaves: el batchUpdate para la hoja (cambios en su lugar, bajas de abajo hacia arriba, altas al final).
 *  - importarEspejo: la hoja manda (salvo lo que el servidor no copio); lo que ya no esta se marca borrada.
 */
const C = require('../copia-hojas');

function completarHojas(m, libros, editables, crear) {
  const abrir = m.ctx.SpreadsheetApp.openById;
  m.ctx.SpreadsheetApp.openById = (id) => {
    const L = abrir(id);
    const ok = (n) => (editables[id] || []).indexOf(n) !== -1;
    const completar = (h) => {
      if (!h) return h;
      const n = h.getName(), R = libros[id][n];
      const no = () => { throw new Error('En el servidor nuevo la pestaña ' + n + ' es de solo lectura.'); };
      return Object.assign(h, {
        getParent: () => L,
        getMaxColumns: () => Math.max(h.getLastColumn(), 26),
        insertColumnsAfter: () => (ok(n) ? h : no()),
        appendRow: (fila) => { if (!ok(n)) no(); R.push(fila.slice()); return h; },
        deleteRow: (f) => { if (!ok(n)) no(); if (f < 2 || f > R.length) throw new Error('deleteRow fuera de rango'); R.splice(f - 1, 1); return h; },
        insertRowAfter: (f) => { if (!ok(n)) no(); R.splice(f, 0, []); return h; }
      });
    };
    const porNombre = L.getSheetByName, todas = L.getSheets;
    return Object.assign(L, {
      getSheetByName: (n) => completar(porNombre(n)),
      getSheets: () => todas().map(completar),
      insertSheet: (n) => {
        if (!(crear || []).includes(n) || !ok(n)) throw new Error('El servidor nuevo no crea pestañas (' + n + ').');
        libros[id][n] = libros[id][n] || [];
        return completar(porNombre(n));
      }
    });
  };
}

/** { cambios: [{ llave, fila, pos }], bajas: [llave] } entre dos matrices (con encabezado) de una pestaña. */
function diferencias(antes, despues, llaveDe) {
  const A = new Map();
  (antes || []).slice(1).forEach((f) => { const k = llaveDe(f); if (k) A.set(k, JSON.stringify(f)); });
  const vistos = new Set(), cambios = [];
  (despues || []).slice(1).forEach((f, i) => {
    const k = llaveDe(f);
    if (!k) return;
    vistos.add(k);
    if (A.get(k) !== JSON.stringify(f)) cambios.push({ llave: k, fila: f, pos: i + 1 });
  });
  const bajas = [...A.keys()].filter((k) => !vistos.has(k));
  return { cambios, bajas };
}

/** batchUpdate de una pestaña: altas, cambios y bajas por llave. Funcion pura. celda(x) → CellData. */
function planLlaves(valoresHoja, cambios, bajas, sheetId, llaveDe, celda) {
  const H = valoresHoja[0] || [];
  const ancho = Math.max(H.length, ...cambios.map((x) => x.fila.length));
  const donde = new Map();
  for (let r = 1; r < valoresHoja.length; r++) { const k = llaveDe(valoresHoja[r]); if (k && !donde.has(k)) donde.set(k, r); }
  const fila = (f) => ({ values: Array.from({ length: ancho }, (_, j) => celda(f[j] === undefined ? '' : f[j])) });
  const CAMPOS = 'userEnteredValue,userEnteredFormat.numberFormat';
  const requests = [], altas = [];
  cambios.forEach((x) => {
    const r = donde.get(x.llave);
    if (r === undefined) { altas.push(fila(x.fila)); return; }
    requests.push({ updateCells: { range: { sheetId, startRowIndex: r, endRowIndex: r + 1, startColumnIndex: 0, endColumnIndex: ancho }, rows: [fila(x.fila)], fields: CAMPOS } });
  });
  const filasBaja = bajas.map((k) => donde.get(k)).filter((r) => r !== undefined).sort((a, b) => b - a);
  filasBaja.forEach((r) => requests.push({ deleteDimension: { range: { sheetId, dimension: 'ROWS', startIndex: r, endIndex: r + 1 } } }));
  if (altas.length) requests.push({ appendCells: { sheetId, rows: altas, fields: CAMPOS } });
  return { requests, altas: altas.length, cambios: cambios.length - altas.length, bajas: filasBaja.length };
}

/**
 * La hoja manda: trae una pestaña a filas_clientes (c: cliente dentro de una transaccion). Filas con el servidor
 * todavia sin copiar (copiado_a_hoja NULL) no se tocan; lo que ya no esta en la hoja queda `borrada`.
 */
async function importarEspejo(c, pestana, hoja, llaveDe) {
  const base = new Map((await c.query('SELECT llave, celdas, borrada, copiado_a_hoja FROM filas_clientes WHERE pestana = $1 FOR UPDATE', [pestana])).rows.map((x) => [x.llave, x]));
  const vistos = new Set(), problemas = [];
  let nuevas = 0, actualizadas = 0, borradas = 0;
  for (let r = 1; r < hoja.length; r++) {
    const llave = llaveDe(hoja[r]);
    if (!llave) continue;
    if (vistos.has(llave)) { problemas.push('Llave repetida en ' + pestana + ' (fila ' + (r + 1) + '): no se importa la segunda.'); continue; }
    vistos.add(llave);
    const celdas = C.codificar([hoja[r]])[0];
    const b = base.get(llave);
    if (b && b.copiado_a_hoja === null) continue;   // del servidor (alta, cambio o baja) sin copiar todavia: manda la base
    if (!b) { await c.query("INSERT INTO filas_clientes (pestana, llave, celdas, orden, origen, copiado_a_hoja) VALUES ($1,$2,$3,$4,'hoja',now())", [pestana, llave, JSON.stringify(celdas), r]); nuevas++; continue; }
    if (JSON.stringify(b.celdas) === JSON.stringify(celdas) && !b.borrada) { await c.query('UPDATE filas_clientes SET orden = $3 WHERE pestana = $1 AND llave = $2', [pestana, llave, r]); continue; }
    await c.query("UPDATE filas_clientes SET celdas = $3, orden = $4, origen = 'hoja', actualizado = now(), copiado_a_hoja = now(), borrada = NULL WHERE pestana = $1 AND llave = $2", [pestana, llave, JSON.stringify(celdas), r]);
    actualizadas++;
  }
  for (const [llave, b] of base) {
    if (!vistos.has(llave) && !b.borrada && b.copiado_a_hoja !== null) { await c.query('UPDATE filas_clientes SET borrada = now() WHERE pestana = $1 AND llave = $2', [pestana, llave]); borradas++; }
  }
  return { pestana, filas_hoja: Math.max(hoja.length - 1, 0), nuevas, actualizadas, borradas, problemas };
}

module.exports = { completarHojas, diferencias, planLlaves, importarEspejo };
