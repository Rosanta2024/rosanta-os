/**
 * Copia de lectura de las hojas de Google (Fase 1, 17-oct-2026).
 *
 * Lee cada pestaña con la API de Sheets y la deja IGUAL a lo que devuelve getValues() en Apps
 * Script: numeros como numeros, texto como texto, vacio como '' y las celdas con formato de fecha
 * como Date (en hora de Guatemala; el maestro esta en GMT-6 y Cloud Run corre con
 * TZ=America/Guatemala). Asi el codigo de la intranet no nota la diferencia.
 */

// Lo que Pagos lee (medido con el arnes de pagos el 17-oct-2026).
const LIBROS = {
  maestro: { id: '1_ZiUlIUG3HIDkYmcpXbykgJ7hh3vlhsu21b6aUOzEmk',
             pestanas: ['01_FEL_Maestro', '01c_FEL_Para_IVA', '03_Banco_Industrial', '04_Banco_BAC', '05_Tarjeta_Credito_BAC', '06_Tarjeta_Credito_BI'] },
  config: { id: '1OMFJUuW9TEp4cMaVculJgegDF1PqrsRJOQCT3VQX2Rw',
            pestanas: ['PAGOS_PROVEEDORES', 'FEL_CORREO', 'BANCO_CORREO'] },
  compras: { id: '1Py2KLc8o2GYzJhosnpi_R0OsDU76xa6d_F9B_UuUq0o', pestanas: '*' }   // todas: historial que ya no cambia
};

const TIPOS_FECHA = { DATE: 1, DATE_TIME: 1, TIME: 1 };

/** Numero de serie de Sheets (dias desde 1899-12-30, hora local de la hoja) → Date local. */
function fechaDeSerie(serie) {
  const ms = Math.round((serie - 25569) * 86400000);   // 25569 = 1970-01-01
  const u = new Date(ms);   // los componentes UTC de u son la hora "de pared" de la hoja
  return new Date(u.getUTCFullYear(), u.getUTCMonth(), u.getUTCDate(), u.getUTCHours(), u.getUTCMinutes(), u.getUTCSeconds());
}

/** Una celda de la API (effectiveValue + formato) → el valor que daria getValues(). */
function valorCelda(c) {
  if (!c || !c.effectiveValue) return '';
  const v = c.effectiveValue;
  if ('numberValue' in v) {
    const tipo = c.effectiveFormat && c.effectiveFormat.numberFormat && c.effectiveFormat.numberFormat.type;
    return TIPOS_FECHA[tipo] ? fechaDeSerie(v.numberValue) : v.numberValue;
  }
  if ('stringValue' in v) return v.stringValue;
  if ('boolValue' in v) return v.boolValue;
  if ('errorValue' in v) return ERRORES[v.errorValue.type] || '#ERROR!';   // getValues() devuelve el texto del error
  return '';
}
// Como los muestra Google Sheets (y los devuelve getValues en Apps Script).
const ERRORES = { ERROR: '#ERROR!', NULL_VALUE: '#NULL!', DIVIDE_BY_ZERO: '#DIV/0!', VALUE: '#VALUE!', REF: '#REF!', NAME: '#NAME?', NUM: '#NUM!', N_A: '#N/A', LOADING: '#LOADING' };

/** rowData de la API → matriz rectangular como getDataRange().getValues(). */
function matrizDeFilas(rowData) {
  const filas = (rowData || []).map((r) => (r.values || []).map(valorCelda));
  // getDataRange llega hasta la ultima fila y columna con algo
  let ultFila = -1, ancho = 0;
  filas.forEach((f, i) => {
    let u = -1;
    f.forEach((x, j) => { if (x !== '') u = j; });
    if (u >= 0) { ultFila = i; ancho = Math.max(ancho, u + 1); }
  });
  return filas.slice(0, ultFila + 1).map((f) => { const x = f.slice(0, ancho); while (x.length < ancho) x.push(''); return x; });
}

/** Para guardar en jsonb: Date → {$d}. Y al reves. */
function codificar(filas) {
  const p = (n) => (n < 10 ? '0' : '') + n;
  return filas.map((r) => r.map((x) => (x instanceof Date
    ? { $d: x.getFullYear() + '-' + p(x.getMonth() + 1) + '-' + p(x.getDate()) + 'T' + p(x.getHours()) + ':' + p(x.getMinutes()) + ':' + p(x.getSeconds()) }
    : x)));
}
function decodificar(filas) {
  return (filas || []).map((r) => r.map((x) => {
    if (x && typeof x === 'object' && '$d' in x) {
      const [d, t] = x.$d.split('T'); const [y, m, dd] = d.split('-').map(Number); const [hh, mm, ss] = t.split(':').map(Number);
      return new Date(y, m - 1, dd, hh, mm, ss);
    }
    return x === null || x === undefined ? '' : x;
  }));
}

/** Lee las pestañas de un libro. pestanas: lista o '*'. Devuelve { nombre: matriz }. */
async function leerLibro(sheets, id, pestanas) {
  let nombres = pestanas;
  if (pestanas === '*') {
    const m = await sheets.spreadsheets.get({ spreadsheetId: id, fields: 'sheets.properties.title' });
    nombres = m.data.sheets.map((s) => s.properties.title);
  }
  const r = await sheets.spreadsheets.get({
    spreadsheetId: id,
    ranges: nombres.map((n) => "'" + n.replace(/'/g, "''") + "'"),
    includeGridData: true,
    fields: 'sheets(properties.title,data.rowData.values(effectiveValue,effectiveFormat.numberFormat.type))'
  });
  const out = {};
  r.data.sheets.forEach((s) => { out[s.properties.title] = matrizDeFilas(((s.data || [])[0] || {}).rowData); });
  return out;
}

/** Lee todos los libros y los guarda en la base en una transaccion. Devuelve el resumen. */
async function refrescarCopia(sheets, pool) {
  const leido = {};
  for (const k of Object.keys(LIBROS)) leido[LIBROS[k].id] = await leerLibro(sheets, LIBROS[k].id, LIBROS[k].pestanas);
  const c = await pool.connect();
  const resumen = [];
  try {
    await c.query('BEGIN');
    for (const libro of Object.keys(leido)) {
      for (const pestana of Object.keys(leido[libro])) {
        const filas = leido[libro][pestana];
        await c.query(
          `INSERT INTO hojas_copia (libro, pestana, filas, n_filas, leida) VALUES ($1,$2,$3,$4, now())
           ON CONFLICT (libro, pestana) DO UPDATE SET filas = EXCLUDED.filas, n_filas = EXCLUDED.n_filas, leida = now()`,
          [libro, pestana, JSON.stringify(codificar(filas)), filas.length]);
        resumen.push({ libro, pestana, filas: filas.length });
      }
    }
    await c.query('COMMIT');
  } catch (e) { await c.query('ROLLBACK'); throw e; } finally { c.release(); }
  return resumen;
}

/** La copia completa desde la base: { libroId: { pestana: matriz } } y la hora de la lectura mas vieja. */
async function cargarCopia(pool) {
  const r = await pool.query('SELECT libro, pestana, filas, leida FROM hojas_copia');
  const out = {}; let masVieja = null;
  r.rows.forEach((x) => {
    (out[x.libro] = out[x.libro] || {})[x.pestana] = decodificar(x.filas);
    if (!masVieja || x.leida < masVieja) masVieja = x.leida;
  });
  return { libros: out, leida: masVieja };
}

module.exports = { LIBROS, fechaDeSerie, valorCelda, matrizDeFilas, codificar, decodificar, leerLibro, refrescarCopia, cargarCopia };
