// Google y base de mentira para las pruebas del maestro (proc-maestro y cierre de bancos). Datos inventados.
const assert = require('node:assert');
const { serieDeFecha } = require('../src/escribir-hoja');

// ---- Google de mentira: un solo almacen de hojas, que leen la cuenta y escribe la cuenta de servicio -------------
function letraANum(l) { return l.split('').reduce((a, c) => a * 26 + c.charCodeAt(0) - 64, 0); }
function aCelda(x) {
  if (x === '' || x === null || x === undefined) return null;
  if (x && typeof x === 'object' && 'f' in x) return { f: x.f, v: x.v === undefined ? '' : x.v };
  if (x instanceof Date) return { v: serieDeFecha(x), fmt: 'DATE' };
  return { v: x };
}
function apiCelda(c) {
  if (!c) return {};
  const o = {};
  if (c.v !== '' && c.v !== undefined && c.v !== null) {
    o.effectiveValue = typeof c.v === 'number' ? { numberValue: c.v } : typeof c.v === 'boolean' ? { boolValue: c.v } : { stringValue: c.v };
  }
  if (c.fmt) o.effectiveFormat = { numberFormat: { type: c.fmt } };
  if (c.f) o.userEnteredValue = { formulaValue: c.f };
  return o;
}
/** Como Sheets toma un valor USER_ENTERED (lo mismo que setValues de Apps Script con un texto). */
function teclear(x, previa) {
  const fmt = previa && previa.fmt;
  if (x === '' || x === null || x === undefined) return fmt ? { v: '', fmt } : null;
  if (typeof x === 'number' || typeof x === 'boolean') return { v: x, fmt };
  const s = String(x);
  if (fmt === 'TEXT') return { v: s, fmt };
  if (s[0] === '=') return { f: s, v: '', fmt };
  if (/^[+-]?\d+(\.\d+)?$/.test(s)) return { v: Number(s), fmt };
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return { v: serieDeFecha(new Date(+m[1], +m[2] - 1, +m[3])), fmt: fmt || 'DATE' };
  return { v: s, fmt };
}
function google(opciones) {
  const o = opciones || {};
  const L = {}, llamadas = [];
  function crear(id, tabs, extra) {
    const e = extra || {};
    L[id] = { zona: e.zona || 'America/Guatemala', orden: Object.keys(tabs), hojas: {} };
    Object.keys(tabs).forEach((t, i) => {
      const filas = tabs[t].map((r) => r.map(aCelda));
      L[id].hojas[t] = { sheetId: 100 + i, M: filas, filas: (e.filas && e.filas[t] !== undefined) ? e.filas[t] : filas.length + 50 };
    });
  }
  function rango(r) {
    const m = r.match(/^'((?:[^']|'')+)'(?:!([A-Z]+)(\d+):([A-Z]+)(\d+))?$/);
    if (!m) throw new Error('rango raro ' + r);
    return { tab: m[1].replace(/''/g, "'"), r0: m[2] ? +m[3] - 1 : null, c0: m[2] ? letraANum(m[2]) - 1 : null, r1: m[2] ? +m[5] : null, c1: m[2] ? letraANum(m[4]) : null };
  }
  const H = (id, tab) => { const h = L[id] && L[id].hojas[tab]; if (!h) throw new Error('Sheets 404 ' + id + ' ' + tab); return h; };
  const fijar = (h, r, c, cel) => {
    if (r >= h.filas) throw new Error('Range exceeds grid limits. Max rows: ' + h.filas);
    while (h.M.length <= r) h.M.push([]);
    while (h.M[r].length <= c) h.M[r].push(null);
    h.M[r][c] = cel;
  };
  const leer = (h, r, c) => (h.M[r] && h.M[r][c]) || null;
  const porSheetId = (id, sid) => Object.values(L[id].hojas).find((h) => h.sheetId === sid);
  const api = {
    L, llamadas, crear,
    spreadsheets: {
      async get(p) {
        llamadas.push(['get', p.spreadsheetId, p.ranges || null]);
        const B = L[p.spreadsheetId];
        if (!B) throw new Error('Sheets 404 ' + p.spreadsheetId);
        if (!p.includeGridData) return { data: { properties: { timeZone: B.zona }, sheets: B.orden.map((t) => ({ properties: { title: t, sheetId: B.hojas[t].sheetId, gridProperties: { rowCount: B.hojas[t].filas, columnCount: 26 } } })) } };
        return { data: { sheets: p.ranges.map((x) => {
          const g = rango(x), h = H(p.spreadsheetId, g.tab);
          const r0 = g.r0 === null ? 0 : g.r0, r1 = g.r1 === null ? h.M.length : g.r1;
          const c0 = g.c0 === null ? 0 : g.c0, c1 = g.c1 === null ? h.M.reduce((a, r) => Math.max(a, r.length), 0) : g.c1;
          const rowData = [];
          for (let r = r0; r < r1; r++) { const v = []; for (let c = c0; c < c1; c++) v.push(apiCelda(leer(h, r, c))); rowData.push({ values: v }); }
          return { properties: { title: g.tab }, data: [{ startRow: r0, startColumn: c0, rowData }] };
        }) } };
      },
      async batchUpdate(p) {
        llamadas.push(['batchUpdate', p.spreadsheetId, p.requestBody.requests]);
        p.requestBody.requests.forEach((q) => {
          if (q.appendDimension) { porSheetId(p.spreadsheetId, q.appendDimension.sheetId).filas += q.appendDimension.length; return; }
          const k = Object.keys(q)[0];
          const g = q[k].range || q[k].destination;
          const h = porSheetId(p.spreadsheetId, g.sheetId);
          if (k === 'repeatCell') {
            for (let r = g.startRowIndex; r < g.endRowIndex; r++) for (let c = g.startColumnIndex; c < g.endColumnIndex; c++) {
              fijar(h, r, c, Object.assign({ v: '' }, leer(h, r, c) || {}, { fmt: q.repeatCell.cell.userEnteredFormat.numberFormat.type }));
            }
          } else if (k === 'updateCells') {
            q.updateCells.rows.forEach((row, i) => row.values.forEach((c, j) => fijar(h, g.startRowIndex + i, g.startColumnIndex + j, { f: c.userEnteredValue.formulaValue, v: '' })));
          } else if (k === 'copyPaste') {
            const s = q.copyPaste.source;
            assert.strictEqual(q.copyPaste.pasteType, 'PASTE_FORMULA');
            for (let r = g.startRowIndex; r < g.endRowIndex; r++) for (let c = g.startColumnIndex; c < g.endColumnIndex; c++) {
              const orig = leer(h, s.startRowIndex, c), d = r - s.startRowIndex;
              fijar(h, r, c, { f: orig.f.replace(/([A-Z]{1,2})(\d+)/g, (m0, l, n) => l + (Number(n) + d)), v: '' });
            }
          } else throw new Error('pedido desconocido ' + k);
        });
        return { data: {} };
      },
      values: {
        async get(p) {
          llamadas.push(['values.get', p.spreadsheetId, p.range, p.valueRenderOption]);
          if (o.antesDeRevisar) o.antesDeRevisar(api);
          const g = rango(p.range), h = H(p.spreadsheetId, g.tab), out = [];
          for (let r = g.r0; r < g.r1; r++) { const x = []; for (let c = g.c0; c < g.c1; c++) { const cel = leer(h, r, c); x.push(!cel ? '' : p.valueRenderOption === 'FORMULA' && cel.f ? cel.f : cel.v); } out.push(x); }
          return { data: { values: out } };
        },
        async batchUpdate(p) {
          // la marca de carga del FEL (T1, texto tal cual): no es una escritura de datos
          if (p.requestBody.valueInputOption === 'RAW' && p.requestBody.data.length === 1 && /!T1$/.test(p.requestBody.data[0].range)) {
            llamadas.push(['marca', p.spreadsheetId, p.requestBody.data[0].values[0][0]]);
            return { data: {} };
          }
          llamadas.push(['values.batchUpdate', p.spreadsheetId, p.requestBody]);
          assert.strictEqual(p.requestBody.valueInputOption, 'USER_ENTERED');
          p.requestBody.data.forEach((d) => {
            const g = rango(d.range), h = H(p.spreadsheetId, g.tab);
            d.values.forEach((row, i) => row.forEach((x, j) => fijar(h, g.r0 + i, g.c0 + j, teclear(x, leer(h, g.r0 + i, g.c0 + j)))));
          });
          return { data: {} };
        }
      }
    }
  };
  return api;
}


function poolFalso(modo, registro) {
  const consultas = [];
  const reg = new Set(registro || []);
  return { consultas, reg, async query(sql, p) {
    consultas.push({ sql, p });
    if (/FROM interruptores/.test(sql)) return { rows: modo ? [{ modo }] : [] };
    if (/SELECT huella FROM maestro_archivos_procesados/.test(sql)) return { rows: [...reg].map((huella) => ({ huella })) };
    if (/INSERT INTO maestro_archivos_procesados/.test(sql)) { reg.add(p[0]); return { rows: [] }; }
    if (/INSERT INTO maestro_corridas/.test(sql)) return { rows: [] };
    throw new Error('SQL inesperado: ' + sql);
  } };
}

module.exports = { google, poolFalso, teclear };
