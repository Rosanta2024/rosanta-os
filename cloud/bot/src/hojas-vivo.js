/**
 * Espejo de Rosanta Leads para el bot en vivo (19-oct-2026, APAGADO hasta el sí de Juanma).
 *
 * El bot lee y escribe Conversaciones, Leads, Fichas y Salientes como si fueran hojas de Apps Script.
 * En vivo el servidor tiene esas pestañas en memoria (un solo servidor, una cosa a la vez) y copia a la
 * hoja de verdad cada cambio que hizo el bot, en el mismo orden, apenas termina cada mensaje. Así la
 * consola, el CRM, la revisión diaria del pipeline y la intranet siguen leyendo la hoja sin notar nada.
 *
 * Salientes la escribe además la consola (Apps Script): se vuelve a leer antes de cada vuelta del minuto.
 */
const PESTANAS = ['Conversaciones', 'Leads', 'Fichas', 'Salientes', 'Salientes_Historico'];

/** Una celda tal como la manda la hoja (FORMATTED: fechas como texto) → valor para el bot. */
function leerCelda(v) {
  if (typeof v !== 'string') return v;
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0));   // TZ=America/Guatemala en el servidor
  return v;
}

/** Un valor del bot → lo que se escribe en la hoja (USER_ENTERED: la fecha queda como fecha en la hoja). */
function escribirCelda(v) {
  if (v instanceof Date) {
    const p = (n) => String(n).padStart(2, '0');
    return v.getFullYear() + '-' + p(v.getMonth() + 1) + '-' + p(v.getDate()) + ' ' + p(v.getHours()) + ':' + p(v.getMinutes()) + ':' + p(v.getSeconds());
  }
  if (v === null || v === undefined) return '';
  return v;
}

function letra(n) { let s = ''; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; }

/**
 * crearEspejo({ sheets, id }) — sheets: cliente de @googleapis/sheets con permiso de escritura (solo en vivo).
 * { cargar(pestanas), libro, aplicar(ops) }
 */
function crearEspejo(deps) {
  const libro = {};
  const idsHoja = {};

  async function cargar(pestanas) {
    const lista = pestanas || PESTANAS;
    const meta = await deps.sheets.spreadsheets.get({ spreadsheetId: deps.id, fields: 'sheets.properties(sheetId,title)' });
    (meta.data.sheets || []).forEach((h) => { idsHoja[h.properties.title] = h.properties.sheetId; });
    const existen = lista.filter((n) => idsHoja[n] !== undefined);
    if (!existen.length) return;
    const r = await deps.sheets.spreadsheets.values.batchGet({ spreadsheetId: deps.id, ranges: existen.map((n) => "'" + n + "'"),
      valueRenderOption: 'FORMATTED_VALUE', dateTimeRenderOption: 'FORMATTED_STRING' });
    (r.data.valueRanges || []).forEach((vr, i) => { libro[existen[i]] = (vr.values || []).map((f) => f.map(leerCelda)); });
  }

  /** Copia a la hoja real los cambios del bot, en orden. Devuelve cuantos aplico. */
  async function aplicar(ops) {
    let n = 0;
    for (const op of ops || []) {
      const rango = (fila, col) => "'" + op.hoja + "'!" + letra(col) + fila;   // la celda de arriba a la izquierda: la hoja abre el resto
      if (op.op === 'crear') {
        const r = await deps.sheets.spreadsheets.batchUpdate({ spreadsheetId: deps.id, requestBody: { requests: [{ addSheet: { properties: { title: op.hoja } } }] } });
        idsHoja[op.hoja] = r.data.replies[0].addSheet.properties.sheetId;
      } else if (op.op === 'agregar' || op.op === 'fijar') {
        await deps.sheets.spreadsheets.values.update({ spreadsheetId: deps.id, range: rango(op.fila, op.col || 1),
          valueInputOption: 'USER_ENTERED', requestBody: { values: op.valores.map((f) => f.map(escribirCelda)) } });
      } else if (op.op === 'borrar') {
        await deps.sheets.spreadsheets.batchUpdate({ spreadsheetId: deps.id, requestBody: { requests: [{ deleteDimension: {
          range: { sheetId: idsHoja[op.hoja], dimension: 'ROWS', startIndex: op.fila - 1, endIndex: op.fila - 1 + op.n } } }] } });
      } else continue;
      n++;
    }
    return n;
  }

  return { cargar, aplicar, libro, idsHoja };
}

module.exports = { crearEspejo, leerCelda, escribirCelda, letra, PESTANAS };
