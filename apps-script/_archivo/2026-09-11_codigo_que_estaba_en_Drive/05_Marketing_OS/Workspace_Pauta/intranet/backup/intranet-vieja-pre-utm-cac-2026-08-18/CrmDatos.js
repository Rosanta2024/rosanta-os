/**
 * CrmDatos.gs — capa de datos de la vista CRM (contactos ↔ conversación).
 *
 * Dos fuentes, ninguna nueva:
 *   - Contactos: Sheet "Rosanta_CRM_Maestra" (la misma que usa el menú CRM Rosanta).
 *   - Conversaciones: Sheet "Rosanta Leads", pestaña "Conversaciones" — la misma
 *     que lee la Consola de chats. Sólo LECTURA: responder sigue siendo trabajo
 *     de la consola, que es quien encola en "Salientes" para el bot.
 *
 * El cruce contacto ↔ conversación se hace por teléfono. En "Conversaciones" el
 * ContactoID es el teléfono (WhatsApp) o un id de Instagram; en la maestra el
 * teléfono viene en E.164 (+502…). Se comparan sólo los dígitos y por los
 * últimos 8 (el largo de un número guatemalteco), así que +502 5555-1234,
 * 50255551234 y 55551234 son el mismo contacto.
 *
 * Actualizado 3-ago-2026: la maestra ganó dos columnas que llena CRMSync.
 *   - fecha_alta: el día en que el contacto entró al CRM.
 *   - ultimo_intento: el día del último intento de reserva sin completar.
 * Ambas viajan a la vista para poder ordenar por lo más reciente y filtrar
 * por rango. Si la hoja aún no las tiene, llegan vacías y nada se rompe.
 */

var CRM_SHEET_ID = '1VHg2GkmhGcVkxw0JZe1cBZzXOrsjzIk570yh7CyYwvM'; // Rosanta_CRM_Maestra

function requiereCrm_() {
  var u = getUsuarioActual();
  if (!u) throw new Error('Tu correo no está en la hoja USUARIOS.');
  if (!usuarioTieneModulo(u, 'crm')) throw new Error('Tu usuario no tiene el módulo CRM.');
  return u;
}

/**
 * Id de la Sheet "Rosanta Leads". La Consola la guarda en SUS propiedades, que
 * este proyecto no puede leer, así que: property propia -> si no, la busca en
 * Drive por nombre y la cachea. Así no hay que configurar nada a mano.
 */
function leadsSheetId_() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('LEADS_SHEET_ID');
  if (id) return id;

  var it = DriveApp.getFilesByName('Rosanta Leads');
  while (it.hasNext()) {
    var f = it.next();
    if (f.getMimeType() === MimeType.GOOGLE_SHEETS) {
      props.setProperty('LEADS_SHEET_ID', f.getId());
      return f.getId();
    }
  }
  throw new Error('No encontré la Sheet "Rosanta Leads". Cargá su ID en Propiedades del script como LEADS_SHEET_ID.');
}

/** Deja sólo dígitos y se queda con los últimos 8. '' si no parece teléfono. */
function telClave_(v) {
  var d = String(v || '').replace(/[^0-9]/g, '');
  if (d.length < 8) return '';
  return d.slice(-8);
}

/** Fecha de celda a texto yyyy-MM-dd, que es lo que ordena y filtra la vista. */
function fechaTxt_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, 'America/Guatemala', 'yyyy-MM-dd');
  return String(v == null ? '' : v).trim();
}

/** La maestra se adapta por ENCABEZADO, igual que el menú CRM Rosanta. */
function crmContactos() {
  requiereCrm_();
  var ss = SpreadsheetApp.openById(CRM_SHEET_ID);
  var hojas = ss.getSheets();
  var sh = null;
  for (var i = 0; i < hojas.length; i++) {
    var h = hojas[i].getRange(1, 1, 1, hojas[i].getLastColumn()).getValues()[0].map(String);
    if (h.indexOf('first_name') >= 0 && h.indexOf('telefono') >= 0) { sh = hojas[i]; break; }
  }
  if (!sh) throw new Error('No encontré la hoja maestra (necesita columnas first_name y telefono).');
  if (sh.getLastRow() < 2) return [];

  var vals = sh.getDataRange().getValues();
  var head = vals.shift().map(function (x) { return String(x).trim(); });
  var col = function (n) { return head.indexOf(n); };
  var iNom = col('first_name'), iTel = col('telefono'), iMail = col('email');
  var iSeg = col('segmento'), iIdi = col('idioma'), iFue = col('fuente');
  var iUlt = col('ultima_reserva'), iGas = col('gasto_gtq');
  if (iGas < 0) iGas = col('gasto_total'); // el brief la nombra de las dos formas
  var iAlta = col('fecha_alta'), iInt = col('ultimo_intento'); // columnas nuevas

  var pick = function (r, i) { return i >= 0 ? r[i] : ''; };
  var out = [];
  for (var j = 0; j < vals.length; j++) {
    var r = vals[j];
    var tel = String(pick(r, iTel) || '').trim();
    var mail = String(pick(r, iMail) || '').trim();
    if (!tel && !mail) continue;
    out.push({
      nombre: String(pick(r, iNom) || '').trim() || '(sin nombre)',
      telefono: tel,
      email: mail,
      segmento: String(pick(r, iSeg) || '').trim(),
      idioma: String(pick(r, iIdi) || '').trim(),
      fuente: String(pick(r, iFue) || '').trim(),
      ultimaReserva: fechaTxt_(pick(r, iUlt)),
      fechaAlta: fechaTxt_(pick(r, iAlta)),
      ultimoIntento: fechaTxt_(pick(r, iInt)),
      gasto: Number(String(pick(r, iGas) || '0').replace(/[^0-9.]/g, '')) || 0,
      clave: telClave_(tel)
    });
  }
  return out;
}

/**
 * Claves de teléfono que TIENEN conversación. El cliente la usa para marcar
 * qué contactos tienen chat sin pedir los mensajes de cada uno.
 */
function crmClavesConChat() {
  requiereCrm_();
  var sh = SpreadsheetApp.openById(leadsSheetId_()).getSheetByName('Conversaciones');
  if (!sh || sh.getLastRow() < 2) return [];
  var vals = sh.getRange(2, 3, sh.getLastRow() - 1, 1).getValues(); // col C = ContactoID
  var set = {};
  for (var i = 0; i < vals.length; i++) {
    var k = telClave_(vals[i][0]);
    if (k) set[k] = 1;
  }
  return Object.keys(set);
}

/* crmConversacion() se elimino: la vista CRM ahora embebe la Consola real, que
   lee las conversaciones por su cuenta. crmClavesConChat() sigue en uso — marca
   que contactos tienen chat sin traer los mensajes de cada uno. */

// ==================== IMPORTAR CSV a la maestra ====================
// Escribe en Rosanta_CRM_Maestra. Misma normalizacion y dedup que el menu
// "CRM Rosanta" del proyecto ligado a la Sheet, para que las dos vias sean
// consistentes. Solo AGREGA contactos nuevos: los que ya existen (por telefono
// o email) se omiten, nunca se sobrescribe data buena sin que lo pidas.

/** Importar requiere el modulo CRM Y permiso de edicion (columna puede_editar). */
function requiereEdicionCrm_() {
  var u = requiereCrm_();
  if (!u.puedeEditar) throw new Error('Tu usuario es de solo lectura: no puede importar contactos.');
  return u;
}

function normEmailCrm_(v) {
  v = String(v || '').trim().toLowerCase();
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v) ? v : '';
}

/** Telefono a E.164. GT (+502) si son 8 digitos; misma logica que el menu CRM. */
function normPhoneCrm_(raw) {
  var d = String(raw || '').replace(/\D/g, '');
  if (d.indexOf('00') === 0) d = d.slice(2);
  if (!d) return '';
  if (d.indexOf('502') === 0 && d.length === 11) return '+' + d;
  if (d.length === 8) return '+502' + d;
  if (d.charAt(0) === '1' && d.length === 11) return '+' + d;
  if (d.length === 10) return (d.charAt(0) === '3' ? '+57' : '+1') + d;
  if (d.length >= 11 && d.length <= 15) return '+' + d;
  return '';
}

function idiomaAutoCrm_(phone) { return phone.indexOf('+502') === 0 ? 'ES' : (phone ? 'EN' : ''); }

/**
 * Agrega contactos a la maestra desde filas ya mapeadas por el cliente.
 * Cada fila: {first_name, telefono, email, idioma, fuente, segmento,
 *             ultima_reserva, gasto_gtq, opt_in, notas} (todas opcionales).
 * Devuelve {leidas, agregados, omitidos, invalidos}.
 */
function crmImportarContactos(filas) {
  requiereEdicionCrm_();
  filas = filas || [];

  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var ss = SpreadsheetApp.openById(CRM_SHEET_ID);
    var hojas = ss.getSheets();
    var sh = null;
    for (var i = 0; i < hojas.length; i++) {
      var h0 = hojas[i].getRange(1, 1, 1, hojas[i].getLastColumn()).getValues()[0].map(String);
      if (h0.indexOf('first_name') >= 0 && h0.indexOf('telefono') >= 0) { sh = hojas[i]; break; }
    }
    if (!sh) throw new Error('No encontré la hoja maestra (necesita columnas first_name y telefono).');

    // Índice de columnas por encabezado, y qué gasto usa la hoja.
    var head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(function (x) { return String(x).trim(); });
    var col = {}; head.forEach(function (n, i) { col[n] = i; });
    var gastoCol = (col.gasto_gtq !== undefined) ? 'gasto_gtq' : (col.gasto_total !== undefined ? 'gasto_total' : null);

    // Dedup contra lo que ya hay: teléfono E.164 y email en minúsculas.
    var lr = sh.getLastRow();
    var existentes = lr >= 2 ? sh.getRange(2, 1, lr - 1, head.length).getValues() : [];
    var byPhone = {}, byEmail = {};
    existentes.forEach(function (r) {
      var p = String(r[col.telefono] || '').trim();
      var e = String(r[col.email] || '').trim().toLowerCase();
      if (p) byPhone[p] = 1;
      if (e) byEmail[e] = 1;
    });

    // Los importados también nacen con fecha de alta, así aparecen arriba en la
    // vista ordenada por lo más reciente igual que los que entran por CRMSync.
    var hoy = Utilities.formatDate(new Date(), 'America/Guatemala', 'yyyy-MM-dd');

    var nuevas = [], agregados = 0, omitidos = 0, invalidos = 0;
    for (var k = 0; k < filas.length; k++) {
      var f = filas[k] || {};
      var phone = normPhoneCrm_(f.telefono);
      var email = normEmailCrm_(f.email);
      if (!phone && !email) { invalidos++; continue; }             // sin contacto usable
      if ((phone && byPhone[phone]) || (email && byEmail[email])) { omitidos++; continue; }

      // Reservar la llave para que un CSV con duplicados internos no los meta dos veces.
      if (phone) byPhone[phone] = 1;
      if (email) byEmail[email] = 1;

      var idioma = (f.idioma === 'ES' || f.idioma === 'EN') ? f.idioma : idiomaAutoCrm_(phone);
      var gasto = Math.max(0, parseInt(String(f.gasto_gtq || '0').replace(/[^\d]/g, ''), 10) || 0);
      var campos = {
        first_name: String(f.first_name || '').trim(),
        telefono: phone, email: email, idioma: idioma,
        fuente: String(f.fuente || 'import-csv').trim(),
        segmento: String(f.segmento || 'Lead').trim(),
        ultima_reserva: String(f.ultima_reserva || '').trim(),
        opt_in: String(f.opt_in || '').trim(),
        notas: String(f.notas || '').trim(),
        fecha_alta: String(f.fecha_alta || '').trim() || hoy
      };
      if (gastoCol) campos[gastoCol] = gasto || '';

      var arr = new Array(head.length).fill('');
      Object.keys(campos).forEach(function (name) {
        if (col[name] !== undefined) arr[col[name]] = campos[name];
      });
      nuevas.push(arr);
      agregados++;
    }

    if (nuevas.length) {
      sh.getRange(sh.getLastRow() + 1, 1, nuevas.length, head.length).setValues(nuevas);
    }
    return { leidas: filas.length, agregados: agregados, omitidos: omitidos, invalidos: invalidos };
  } finally {
    lock.releaseLock();
  }
}