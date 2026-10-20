/**
 * El CRM en la nube (20-oct-2026, orden del dia unico): corre el codigo REAL de Marketing OS
 * (mktos/Code.js: intakeCarrito, upsert; mktos/CRMSync.js: intakeReserva, sincronizarCRM) sobre una copia
 * en memoria de Marketing OS › carritos y reservas y de la CRM Maestra, y dice que filas cambiaron.
 *
 * Es lo que hoy hace Apps Script con cada aviso de Wix: guarda el carrito o la reserva (Code.js / CRMSync.js)
 * y despues sincroniza el CRM (el activador alCambiarMarketingOS → sincronizarCRM). Aca se hacen los dos
 * pasos en la misma corrida, en orden.
 *
 * Que se imita aparte del motor de la intranet (motor-pagos.js no se toca):
 *  - insertRowAfter (las reservas y los carritos nuevos van arriba), appendRow, getMaxColumns,
 *    insertColumnsAfter: solo en las pestañas que se pueden escribir.
 *  - sendToCAPI: no sale a Meta desde el codigo copiado; se anota y lo manda el servidor (capi).
 *
 * Como las filas se corren (insertRowAfter), los cambios no se sacan de las filas anotadas sino comparando
 * antes y despues: carritos y reservas por su id (columna A); el CRM por posicion (CRMSync nunca borra ni
 * reordena: solo cambia filas o agrega al final).
 */
const { crearMotor } = require('../motor-pagos');

const MKT_ID = '1wxsMm1Vx7tUci3ErQGa4SiGftZ21vTrxYqAObiEooyc';   // MKT_SHEET_ID / SHEET_ID del codigo real
const CRM_ID = '1VHg2GkmhGcVkxw0JZe1cBZzXOrsjzIk570yh7CyYwvM';   // CRM_SHEET_ID
const LISTAS = ['LISTA-VIVO-CRM.txt'];

const copiar = (m) => (m || []).map((r) => r.slice());

/**
 * Lo que queda en la celda cuando Apps Script hace setValues con un texto: Sheets lo interpreta como si
 * lo tecleara una persona. Medido en las hojas reales (20-oct-2026): reservas.fecha y carritos.fecha son
 * fecha, reservas.telefono numero (213 de 222), y en el CRM las fechas que escribio CRMSync son fecha; el
 * telefono del CRM es texto (CRMSync le pone formato '@'). textoCols: columnas con formato texto.
 */
function comoSetValues(fila, textoCols) {
  return fila.map((x, j) => {
    if (typeof x !== 'string' || (textoCols || []).indexOf(j) !== -1) return x;
    const t = x.trim();
    let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
    if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    if (/^-?\d+(\.\d+)?$/.test(t) && t.replace(/[-.]/g, '').length <= 15) return Number(t);
    return x;
  });
}

/** La llave de una fila del CRM: el correo, o los ultimos 8 del telefono (como construirIndice_). */
function llaveCrm(fila) {
  const email = String(fila[2] || '').trim().toLowerCase();
  if (email) return 'e:' + email;
  const tel = String(fila[1] || '').replace(/\D/g, '');
  return tel.length >= 8 ? 't:' + tel.slice(-8) : '';
}

/**
 * crearMotorCrm({ carritos, reservas, crm, crmPestana }) — matrices como getValues (con encabezado).
 * Devuelve { correr(nombre, args), cambios(), capi, ctx }.
 */
function crearMotorCrm(datos) {
  const pestanaCrm = datos.crmPestana || 'CRM';
  const libros = {
    [MKT_ID]: { carritos: copiar(datos.carritos), reservas: copiar(datos.reservas) },
    [CRM_ID]: { [pestanaCrm]: copiar(datos.crm) }
  };
  const antes = { carritos: copiar(datos.carritos), reservas: copiar(datos.reservas), crm: copiar(datos.crm) };
  const editables = { [MKT_ID]: ['carritos', 'reservas'], [CRM_ID]: [pestanaCrm] };
  const m = crearMotor({ libros, configId: 'x', editables, listas: LISTAS });
  const capi = [];

  // Lo que el motor de la intranet no imita y Code.js / CRMSync.js usan, solo en pestañas escribibles
  const abrir = m.ctx.SpreadsheetApp.openById;
  m.ctx.SpreadsheetApp.openById = (id) => {
    const L = abrir(id);
    const completar = (h) => {
      if (!h) return h;
      const n = h.getName(), R = libros[id][n];
      const ok = (editables[id] || []).indexOf(n) !== -1;
      const no = () => { throw new Error('En el servidor nuevo la pestaña ' + n + ' es de solo lectura.'); };
      return Object.assign(h, {
        getMaxColumns: () => Math.max(h.getLastColumn(), 26),
        insertColumnsAfter: () => (ok ? h : no()),
        insertRowAfter: (f) => { if (!ok) no(); R.splice(f, 0, []); return h; },
        appendRow: (fila) => { if (!ok) no(); R.push(fila.slice()); return h; }
      });
    };
    const sheetByName = L.getSheetByName, sheets = L.getSheets;
    return Object.assign(L, { getSheetByName: (n) => completar(sheetByName(n)), getSheets: () => sheets().map(completar) });
  };
  // CAPI: lo manda el servidor con su secreto; el codigo copiado solo deja anotado que mandar
  m.ctx.sendToCAPI = (email, tel, valor) => { capi.push({ email, tel, valor }); return 'en cola (servidor)'; };

  function correr(nombre, args) {
    if (typeof m.ctx[nombre] !== 'function') throw new Error('Marketing OS no tiene la funcion ' + nombre + '.');
    m.ctx.__crm = () => m.ctx[nombre].apply(null, args || []);
    return m.correr(null, '__crm', []).resultado;
  }

  /** Lo que cambio desde que se armo el motor: { carritos: [{id, fila}], reservas: [...], crm: [{pos, llave, fila, nueva}] }. */
  function cambios() {
    const porId = (a, d) => {
      const viejo = new Map(a.slice(1).map((f) => [String(f[0]), JSON.stringify(f)]));
      return d.slice(1).filter((f) => String(f[0]) && viejo.get(String(f[0])) !== JSON.stringify(f)).map((f) => ({ id: String(f[0]), fila: comoSetValues(f) }));
    };
    const crmAntes = antes.crm, crmDesp = libros[CRM_ID][pestanaCrm];
    const crm = [];
    for (let i = 1; i < crmDesp.length; i++) {
      const f = crmDesp[i];
      if (i < crmAntes.length && JSON.stringify(crmAntes[i]) === JSON.stringify(f)) continue;
      crm.push({ pos: i, llave: llaveCrm(i < crmAntes.length ? crmAntes[i] : f) || llaveCrm(f), fila: comoSetValues(f, [1]), nueva: i >= crmAntes.length });
    }
    return { carritos: porId(antes.carritos, libros[MKT_ID].carritos), reservas: porId(antes.reservas, libros[MKT_ID].reservas), crm };
  }

  return { correr, cambios, capi, ctx: m.ctx, libros, pestanaCrm };
}

/**
 * Lo que hace Apps Script con un aviso de Wix, completo: guardar (intakeCarrito / intakeReserva) y
 * sincronizar el CRM. Devuelve { resultado (lo que se le contesta a Wix), sync, cambios, capi }.
 */
function procesarAviso(datos, hook, cuerpo) {
  const mc = crearMotorCrm(datos);
  const fn = hook === 'carrito' ? 'intakeCarrito' : hook === 'reserva' ? 'intakeReserva' : null;
  if (!fn) throw new Error('Aviso desconocido: ' + hook);
  const resultado = mc.correr(fn, [cuerpo]);
  const sync = resultado && resultado.error ? null : mc.correr('sincronizarCRM', []);
  return { resultado, sync, cambios: mc.cambios(), capi: mc.capi, libros: mc.libros };
}

module.exports = { crearMotorCrm, procesarAviso, llaveCrm, comoSetValues, MKT_ID, CRM_ID, LISTAS };
