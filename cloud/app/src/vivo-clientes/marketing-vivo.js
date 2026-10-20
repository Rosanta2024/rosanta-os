/**
 * Marketing (contenido y pauta) EN VIVO (20-oct-2026, orden del dia unico). La pantalla de Marketing SIGUE
 * en la intranet: ahi estan Meta, Claude y Drive, que el servidor no tiene. Lo que cambia es QUIEN ESCRIBE:
 * con PARAMETROS › motor_marketing = base, las 6 funciones de guardar de la intranet (mktUpsert, mktDelete,
 * calGuardarVersion, psGuardarRegla, psGuardarSupuesto, psGuardarPrueba) le pasan el pedido a este servidor
 * (NubeClientes.js › _mktDesvio_, POST /interno/marketing con la clave de tareas), que corre el MISMO codigo
 * sobre la base, guarda lo que cambio y lo copia a Marketing OS ANTES de contestar (la pantalla relee la hoja).
 * Volver atras = motor_marketing = sheets (lo guardado ya esta en la hoja).
 *
 * Quien mas escribe esas pestañas y sigue en Apps Script: la captura semanal de Meta (hechos_semana,
 * pixel_semana, estados_semana: solo se LEEN aca), el Ads Script, WixReservasPauta, PosPauta y ClientesNuevos
 * (pauta_semanal), la skill de pauta (aprendizajes). Por eso la hoja manda al importar, salvo lo que el
 * servidor todavia no copio.
 */
const C = require('../copia-hojas');
const { crearMotor } = require('../motor-pagos');
const LB = require('./libro-base');
const EH = require('../escribir-hoja');
const CC = require('./copiar-clientes');

const MKT_ID = '1wxsMm1Vx7tUci3ErQGa4SiGftZ21vTrxYqAObiEooyc';
const LISTAS = ['LISTA.txt', 'LISTA-CLIENTES.txt', 'LISTA-MARKETING.txt'];
const ESCRIBE = ['calendario', 'calendario_versiones', 'piezas', 'propuestas', 'briefs', 'aprendizajes', 'pauta_semanal',
  'reglas', 'supuestos', 'bitacora_pruebas', 'papelera'];
const SOLO_LEE = ['hechos_semana', 'pixel_semana', 'estados_semana'];
const FUNCIONES = ['mktUpsert', 'mktDelete', 'calGuardarVersion', 'psGuardarRegla', 'psGuardarSupuesto', 'psGuardarPrueba'];
const CANDADO = 4242012;   // el mismo de Clientes: un guardado en Marketing OS por vez

/** La llave de una fila: la columna A, salvo calendario_versiones (version + id) y papelera (fecha + pestaña + id). */
function llaveDe(pestana) {
  const t = (x) => (x instanceof Date ? C.codificar([[x]])[0][0].$d : String(x === undefined || x === null ? '' : x).trim());
  if (pestana === 'calendario_versiones') return (f) => (t(f[0]) && t(f[2]) ? t(f[0]) + '|' + t(f[2]) : '');
  if (pestana === 'papelera') return (f) => (t(f[0]) ? t(f[0]) + '|' + t(f[2]) + '|' + t(f[3]) : '');
  return (f) => t(f[0]);
}

/** Como lo deja setValues: el texto que parece numero o fecha se vuelve numero o fecha (motor-crm.comoSetValues). */
const { comoSetValues } = require('./motor-crm');

/**
 * opciones: { leerMkt(pestanas) → matrices; leerConfig() → { PARAMETROS, METAS }; copiar(pestana, cambios, bajas, encabezado);
 *             configId }
 */
function crearMarketingVivo(pool, opciones) {
  const o = opciones || {};
  const configId = o.configId || 'CONFIG';
  let encabezados = {}, config = null, ultimaImportacion = null;
  let cola = Promise.resolve();
  const enCola = (fn) => { const p = cola.then(fn, fn); cola = p.catch(() => {}); return p; };

  async function matriz(q, p) {
    const r = await q.query('SELECT celdas FROM filas_clientes WHERE pestana = $1 AND borrada IS NULL ORDER BY orden NULLS LAST, llave', [p]);
    if (!encabezados[p] && !r.rows.length) return null;   // la pestaña no existe (papelera, hasta el primer borrado)
    return [(encabezados[p] || []).slice()].concat(C.decodificar(r.rows.map((x) => x.celdas)));
  }

  /** Trae las hojas a la base (y Config a memoria). Primero copia lo pendiente. */
  function importar() {
    return enCola(() => importarSinCola());
  }
  async function importarSinCola() {
    await copiarPendientes();
    const hojas = await o.leerMkt(ESCRIBE.concat(SOLO_LEE));
    config = await o.leerConfig();
    const out = [];
    const c = await pool.connect();
    try {
      await c.query('BEGIN');
      await c.query('SELECT pg_advisory_xact_lock(' + CANDADO + ')');
      for (const p of ESCRIBE.concat(SOLO_LEE)) {
        if (!hojas[p]) continue;   // la pestaña no existe en la hoja
        if (hojas[p][0]) encabezados[p] = hojas[p][0].map(String);
        out.push(await LB.importarEspejo(c, p, hojas[p], llaveDe(p)));
      }
      for (const x of out) {
        await c.query('INSERT INTO filas_clientes_importaciones (pestana, filas_hoja, nuevas, actualizadas, problemas) VALUES ($1,$2,$3,$4,$5)',
          [x.pestana, x.filas_hoja, x.nuevas, x.actualizadas, JSON.stringify(x.problemas)]);
      }
      await c.query('COMMIT');
    } catch (e) { await c.query('ROLLBACK'); throw e; } finally { c.release(); }
    ultimaImportacion = new Date();
    return out;
  }

  /** Copia a la hoja altas, cambios y bajas que el servidor guardo y todavia no estan alla. */
  async function copiarPendientes() {
    if (!o.copiar) return { copiadas: 0 };
    let copiadas = 0;
    for (const p of ESCRIBE) {
      const r = await pool.query('SELECT llave, celdas, borrada, actualizado::text AS act FROM filas_clientes WHERE pestana = $1 AND copiado_a_hoja IS NULL ORDER BY orden NULLS LAST, llave', [p]);
      if (!r.rows.length) continue;
      const cambios = r.rows.filter((x) => !x.borrada).map((x) => ({ llave: x.llave, fila: C.decodificar([x.celdas])[0] }));
      const bajas = r.rows.filter((x) => x.borrada).map((x) => x.llave);
      await o.copiar(p, cambios, bajas, encabezados[p]);
      for (const x of r.rows) await pool.query('UPDATE filas_clientes SET copiado_a_hoja = now() WHERE pestana = $1 AND llave = $2 AND actualizado::text = $3', [p, x.llave, x.act]);
      copiadas += r.rows.length;
    }
    return { copiadas };
  }

  /**
   * Una de las 6 funciones de guardar, como `usuario` (de la tabla usuarios). Devuelve lo que devuelve la funcion
   * de la intranet. La copia a la hoja va ANTES de contestar: la pantalla de la intranet relee la hoja.
   */
  function guardar(usuario, nombre, args) {
    if (FUNCIONES.indexOf(nombre) === -1) { const e = new Error('Esa función no se guarda en el servidor.'); e.status = 404; return Promise.reject(e); }
    return enCola(async () => {
      if (!config) await importarSinCola();   // recien arrancado: sin encabezados ni Config todavia
      const c = await pool.connect();
      let resultado;
      try {
        await c.query('BEGIN');
        await c.query('SELECT pg_advisory_xact_lock(' + CANDADO + ')');
        const libro = {};
        for (const p of ESCRIBE.concat(SOLO_LEE, ['carritos', 'reservas'])) { const M = await matriz(c, p); if (M) libro[p] = M; }
        const antes = Object.fromEntries(Object.keys(libro).map((p) => [p, libro[p].map((f) => f.slice())]));
        const editables = ESCRIBE.concat(['carritos']);
        const m = crearMotor({ libros: { [MKT_ID]: libro, [configId]: config }, configId, editables: { [MKT_ID]: editables }, listas: LISTAS });
        LB.completarHojas(m, { [MKT_ID]: libro, [configId]: config }, { [MKT_ID]: editables }, ['papelera']);
        // el token va AL FINAL en las funciones de Marketing (como correrUltimo de la sombra 2)
        m.ctx.__mkt = () => m.ctx[nombre].apply(null, (args || []).concat(['(token-verificado-por-el-servidor)']));
        resultado = m.correr(usuario, '__mkt', []).resultado;
        for (const p of editables) {
          if (!libro[p]) continue;
          if (!encabezados[p] && libro[p][0] && libro[p][0].length) encabezados[p] = libro[p][0].map(String);   // papelera recien creada
          const d = LB.diferencias(antes[p] || [libro[p][0]], libro[p], llaveDe(p));
          for (const x of d.cambios) {
            const fila = comoSetValues(x.fila);
            await c.query(`INSERT INTO filas_clientes (pestana, llave, celdas, origen, orden, actualizado, copiado_a_hoja)
              VALUES ($1,$2,$3,'servidor',$4,now(),NULL)
              ON CONFLICT (pestana, llave) DO UPDATE SET celdas = EXCLUDED.celdas, origen = 'servidor', actualizado = now(), copiado_a_hoja = NULL, borrada = NULL`,
            [p, x.llave, JSON.stringify(C.codificar([fila])[0]), x.pos]);
          }
          for (const k of d.bajas) {
            await c.query("UPDATE filas_clientes SET borrada = now(), origen = 'servidor', actualizado = now(), copiado_a_hoja = NULL WHERE pestana = $1 AND llave = $2", [p, k]);
          }
        }
        await c.query('COMMIT');
      } catch (e) { await c.query('ROLLBACK'); throw e; } finally { c.release(); }
      await copiarPendientes();
      return resultado;
    });
  }

  return { guardar, importar, copiarPendientes, estado: () => ({ ultima_importacion: ultimaImportacion, config: !!config }) };
}

/**
 * La copia de verdad (Sheets API): una lectura y un batchUpdate por pestaña. Crea la pestaña si no existe
 * (papelera, con el primer borrado). reservas/carritos no pasan por aca (copiar-clientes.js).
 */
async function copiarMarketing(sheets, libroId, pestana, cambios, bajas, encabezado) {
  if (pestana === 'carritos') return CC.copiar(sheets, libroId, cambios.map((x) => ({ id: x.llave, fila: x.fila })), { pestana, llave: 'id' });
  const meta = await sheets.spreadsheets.get({ spreadsheetId: libroId, fields: 'sheets.properties(sheetId,title)' });
  let s = meta.data.sheets.find((x) => x.properties.title === pestana);
  if (!s) {
    const r = await sheets.spreadsheets.batchUpdate({ spreadsheetId: libroId, requestBody: { requests: [{ addSheet: { properties: { title: pestana, gridProperties: { frozenRowCount: 1 } } } }] } });
    s = { properties: r.data.replies[0].addSheet.properties };
    await sheets.spreadsheets.values.update({ spreadsheetId: libroId, range: "'" + pestana + "'!A1", valueInputOption: 'RAW', requestBody: { values: [(encabezado || []).map(String)] } });
  }
  // leida como getValues (fechas como fecha): asi la llave de cada fila se arma igual que en la base
  const valores = (await C.leerLibro(sheets, libroId, [pestana]))[pestana] || [];
  const plan = LB.planLlaves(valores, cambios, bajas, s.properties.sheetId, llaveDe(pestana), (x) => CC.celda(x, false));
  if (plan.requests.length) await sheets.spreadsheets.batchUpdate({ spreadsheetId: libroId, requestBody: { requests: plan.requests } });
  return plan;
}

module.exports = { crearMarketingVivo, copiarMarketing, llaveDe, ESCRIBE, SOLO_LEE, FUNCIONES, LISTAS, MKT_ID };
