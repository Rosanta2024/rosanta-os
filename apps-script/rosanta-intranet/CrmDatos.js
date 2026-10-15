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

/* El token va como primer argumento, igual que en el resto de los módulos: quien
   entra con Gmail personal no tiene sesión de Google que lo identifique. Sin auth
   cae en la sesión del dominio, así que la batería y el editor siguen funcionando. */
function requiereCrm_(auth) {
  var u = resolverUsuario_(auth);
  if (!u) throw new Error('No pude identificarte. Volvé a entrar con tu enlace.');
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
function crmContactos(auth) {
  requiereCrm_(auth);
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
function crmClavesConChat(auth) {
  requiereCrm_(auth);
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

/* ============================================================================
 * FICHA DE CLIENTE (15-oct-2026)
 * ----------------------------------------------------------------------------
 * Todo lo que se sabe de UNA persona, de las fuentes que ya existen (solo lectura):
 *   · reservas y visitas: Marketing OS › reservas (el webhook de Wix);
 *   · chats del bot: Rosanta Leads › Conversaciones (últimos 20 mensajes);
 *   · lo que el bot entendió: Rosanta Leads › Fichas (pestaña de la sesión del bot,
 *     15-oct-2026; si todavía no existe, se omite) y las consultas de evento de Leads;
 *   · cotizaciones: Marketing OS › cotizaciones, cuando el Pipeline de Eventos se mude
 *     a Sheets (decisión de Juanma del 15-oct-2026). Mientras no exista, "sin datos".
 * La persona (nombre, segmento, idioma…) ya la tiene la pantalla: viene de crmContactos.
 * Cruce por los últimos 8 dígitos del teléfono (telClave_) o por el email.
 * ============================================================================ */
function crmFicha(auth, clave, email) {
  requiereCrm_(auth);
  clave = telClave_(clave);
  email = normEmailCrm_(email);
  if (!clave && !email) throw new Error('Ese contacto no tiene teléfono ni email para cruzar.');
  var cache = CacheService.getScriptCache(), ck = 'crm_ficha_v1_' + clave + '_' + email;
  try { var c = cache.get(ck); if (c) return JSON.parse(c); } catch (e0) {}
  var es = function (tel, mail) {
    return (clave && telClave_(tel) === clave) || (email && String(mail || '').trim().toLowerCase() === email);
  };
  var out = { reservas: [], chats: [], bot: null, consultas: [], cotizaciones: null, avisos: [] };

  // ---- reservas y visitas
  try {
    out.reservas = crmReservasFilas_().filter(function (r) { return es(r.telefono, r.email); })
      .map(function (r) { return { fecha: r.fecha, personas: r.personas, estado: r.estado, gasto: r.gasto }; })
      .sort(function (a, b) { return a.fecha < b.fecha ? 1 : -1; });
  } catch (e1) { out.avisos.push('Reservas: ' + (e1 && e1.message || e1)); }

  // ---- Rosanta Leads: chats, Fichas del bot y consultas de evento
  var ss = null;
  try { ss = SpreadsheetApp.openById(leadsSheetId_()); } catch (e2) { out.avisos.push('Leads: ' + (e2 && e2.message || e2)); }
  if (ss && clave) {
    try {
      var sc = ss.getSheetByName('Conversaciones');
      if (sc && sc.getLastRow() > 1) {
        var V = sc.getRange(2, 1, sc.getLastRow() - 1, 7).getValues();   // Fecha/Hora, Canal, ContactoID, Nombre, Direccion, Autor, Texto
        for (var i = 0; i < V.length; i++) {
          if (telClave_(V[i][2]) !== clave) continue;
          out.chats.push({ fecha: V[i][0] instanceof Date ? Utilities.formatDate(V[i][0], 'America/Guatemala', 'yyyy-MM-dd HH:mm') : String(V[i][0] || ''),
                           canal: String(V[i][1] || ''), dir: String(V[i][4] || ''), autor: String(V[i][5] || ''),
                           texto: String(V[i][6] || '').slice(0, 600) });
        }
        out.chats_total = out.chats.length;
        out.chats = out.chats.slice(-20);
      }
    } catch (e3) { out.avisos.push('Conversaciones: ' + (e3 && e3.message || e3)); }
  }
  if (ss) {
    try {
      var sf = ss.getSheetByName('Fichas');
      if (sf && sf.getLastRow() > 1) {
        var F = sf.getDataRange().getValues(), hf = F.shift().map(function (x) { return String(x).trim().toLowerCase(); });
        var col = function (n) { return hf.indexOf(n); };
        var CAMPOS = ['canal', 'nombre', 'idioma', 'tipo', 'tipo_evento', 'fecha', 'personas', 'presupuesto',
                      'formato_menu', 'es_evento', 'fecha_consulta', 'etapa_pipeline', 'ultimo_boton', 'resumen',
                      'primer_contacto', 'actualizado'];
        for (var j = F.length - 1; j >= 0; j--) {
          var tel = col('telefono') >= 0 ? F[j][col('telefono')] : '', cid = col('contacto_id') >= 0 ? F[j][col('contacto_id')] : '';
          if (!(es(tel, col('email') >= 0 ? F[j][col('email')] : '') || (clave && telClave_(cid) === clave))) continue;
          var b = {};
          CAMPOS.forEach(function (n) {
            if (col(n) < 0) return;
            var v = F[j][col(n)];
            b[n] = v instanceof Date ? Utilities.formatDate(v, 'America/Guatemala', 'yyyy-MM-dd') : String(v == null ? '' : v);
          });
          out.bot = b;
          break;
        }
      }
    } catch (e4) { out.avisos.push('Fichas del bot: ' + (e4 && e4.message || e4)); }
    try {
      var sl = ss.getSheetByName('Leads');
      if (sl && sl.getLastRow() > 1) {
        var L = sl.getRange(2, 1, sl.getLastRow() - 1, 16).getValues();   // A Fecha · B Canal · C Idioma · E Teléfono · F Tipo · H Resumen · L ID destino · O Email
        for (var k = 0; k < L.length; k++) {
          if (String(L[k][5] || '').trim().toLowerCase() !== 'evento') continue;
          if (!(es(L[k][4], L[k][14]) || (clave && telClave_(L[k][11]) === clave))) continue;
          out.consultas.push({ fecha: L[k][0] instanceof Date ? Utilities.formatDate(L[k][0], 'America/Guatemala', 'yyyy-MM-dd') : String(L[k][0] || '').slice(0, 10),
                               canal: String(L[k][1] || ''), resumen: String(L[k][7] || '').slice(0, 300) });
        }
        out.consultas = out.consultas.slice(-10).reverse();
      }
    } catch (e5) { out.avisos.push('Leads: ' + (e5 && e5.message || e5)); }
  }

  // ---- cotizaciones (cuando el pipeline viva en Marketing OS)
  try {
    var sq = SpreadsheetApp.openById(MKT_SHEET_ID).getSheetByName('cotizaciones');
    if (sq && sq.getLastRow() > 1) {
      var Q = sq.getDataRange().getValues(), hq = Q.shift().map(function (x) { return String(x).trim().toLowerCase(); });
      var q = function (r, n) { var i = hq.indexOf(n); return i < 0 ? '' : r[i]; };
      out.cotizaciones = Q.filter(function (r) { return es(q(r, 'telefono'), q(r, 'email')); }).map(function (r) {
        var f = q(r, 'fecha_evento');
        return { evento: String(q(r, 'evento') || ''), fecha_evento: f instanceof Date ? Utilities.formatDate(f, 'America/Guatemala', 'yyyy-MM-dd') : String(f || ''),
                 pax: q(r, 'pax'), monto_q: Number(q(r, 'monto_q')) || 0, etapa: String(q(r, 'etapa') || '') };
      });
    }
  } catch (e6) { out.avisos.push('Cotizaciones: ' + (e6 && e6.message || e6)); }

  // ---- totales
  var T = { visitas: 0, noShows: 0, canceladas: 0, gasto: 0, conGasto: 0 };
  out.reservas.forEach(function (r) {
    if (r.estado.indexOf('CANCEL') >= 0 || r.estado.indexOf('DECLIN') >= 0) T.canceladas++;
    else if (r.gasto > 0 || r.estado === 'SEATED' || r.estado === 'FINISHED') T.visitas++;
    else if (r.estado === 'NO_SHOW') T.noShows++;
    if (r.gasto > 0) { T.gasto += r.gasto; T.conGasto++; }
  });
  T.ticket = T.conGasto ? Math.round(T.gasto / T.conGasto) : null;
  out.totales = T;
  try { cache.put(ck, JSON.stringify(out), 300); } catch (e7) {}
  return out;
}

// ==================== IMPORTAR CSV a la maestra ====================
// Escribe en Rosanta_CRM_Maestra. Misma normalizacion y dedup que el menu
// "CRM Rosanta" del proyecto ligado a la Sheet, para que las dos vias sean
// consistentes. Solo AGREGA contactos nuevos: los que ya existen (por telefono
// o email) se omiten, nunca se sobrescribe data buena sin que lo pidas.

/** Importar requiere el modulo CRM Y permiso de edicion (columna puede_editar). */
function requiereEdicionCrm_(auth) {
  var u = requiereCrm_(auth);
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
function crmImportarContactos(auth, filas) {
  requiereEdicionCrm_(auth);
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

/* ------------------------------------------------------ altas por mes (p10) ----
 * El DENOMINADOR del CAC, por mes del año. Decision de Juanma del 23-sep-2026:
 * cuentan solo las altas con segmento "Cliente que visitó". Al lado va la tasa de
 * lectura = visitó / (visitó + Reserva histórica), que dice si el mes se puede leer:
 *   >= 90%  comparable · 50-90%  inflado, publicar con aviso · < 50%  no se publica.
 * Solo LEE la maestra; el mes sale de fecha_alta (col K). Sin acentos ni mayusculas al
 * comparar el segmento: la hoja la escriben personas y el sync.
 */
function crmAltasPorMes_(anio) {
  var ss = SpreadsheetApp.openById(CRM_SHEET_ID);
  var hojas = ss.getSheets(), sh = null;
  for (var i = 0; i < hojas.length; i++) {
    var h = hojas[i].getRange(1, 1, 1, hojas[i].getLastColumn()).getValues()[0].map(String);
    if (h.indexOf('first_name') >= 0 && h.indexOf('fecha_alta') >= 0) { sh = hojas[i]; break; }
  }
  if (!sh) throw new Error('No encontré la hoja maestra con fecha_alta.');
  var vals = sh.getDataRange().getValues();
  var head = vals.shift().map(function (x) { return String(x).trim(); });
  var iSeg = head.indexOf('segmento'), iAlta = head.indexOf('fecha_alta');
  var out = {};
  for (var m = 1; m <= 12; m++) out[m] = { visito: 0, historica: 0, otras: 0, lectura: null };
  for (var j = 0; j < vals.length; j++) {
    var f = vals[j][iAlta];
    var d = (f instanceof Date) ? f
          : (/^\d{4}-\d{2}-\d{2}/.test(String(f || '')) ? new Date(String(f).slice(0, 10) + 'T12:00:00') : null);
    if (!d || isNaN(d.getTime()) || d.getFullYear() !== anio) continue;
    var seg = _finSinAcentos_(String(vals[j][iSeg] || '')).toLowerCase().trim();
    var M = out[d.getMonth() + 1];
    if (seg === 'cliente que visito') M.visito++;
    else if (seg === 'reserva historica') M.historica++;
    else M.otras++;
  }
  // La lectura ya no sale de las altas (15-oct-2026): se mide por RESERVA, con la fecha
  // de la mesa. Ver crmLecturaCalc_. visito/historica se quedan: visito es el CAC.
  var res = crmReservasFilas_();
  Object.keys(out).forEach(function (m) {
    var M = out[m];
    var L = crmLecturaCalc_(res, new Date(anio, m - 1, 1), new Date(anio, m, 1), new Date());
    M.lectura = L.base ? Math.round(L.lectura * 1000) / 10 : null;
    M.lectura_base = L.base;
    M.publicable = M.lectura === null ? false : M.lectura >= 50;
    M.comparable = M.lectura !== null && M.lectura >= 90;
  });
  return out;
}

/* ============================================================================
 * LECTURA DEL CRM, POR RESERVA (15-oct-2026)
 * ----------------------------------------------------------------------------
 * Antes la lectura era visitó / (visitó + Reserva histórica) sobre las ALTAS del
 * mes (fecha_alta = el día en que la persona reservó). Eso contaba como "no sabemos":
 *   · reservas para fechas que todavía no llegan (una alta del 11-oct para el 22-ene);
 *   · reservas canceladas, porque el segmento del CRM nunca baja de rango.
 * Octubre daba 35% con el salón cerrando 26 de 27 mesas. Ahora se mide en la pestaña
 * `reservas` del Marketing OS, por la fecha de la mesa:
 *   base   = reservas con fecha en [desde, hasta), ya pasadas hace más de 3 días
 *            (el consumo se teclea al terminar o al día siguiente) y no canceladas.
 *   leídas = consumo > 0, SEATED o FINISHED, o NO_SHOW desde el 15-oct-2026.
 *            Antes de esa fecha un NO_SHOW quería decir "no sabemos" (regla del 23-sep).
 * ============================================================================ */
var CRM_LECTURA_GRACIA_DIAS = 3;
var CRM_NOSHOW_CONFIABLE_DESDE = '2026-10-15';

/** Filas de la pestaña reservas del Marketing OS, como objetos. */
function crmReservasFilas_() {
  var v = mktSheet_('reservas').getDataRange().getValues();
  var h = v.shift().map(function (x) { return String(x).trim().toLowerCase(); });
  var iF = h.indexOf('fecha'), iE = h.indexOf('estado'), iG = h.indexOf('gasto'),
      iId = h.indexOf('id'), iN = h.indexOf('nombre'), iM = h.indexOf('email'),
      iT = h.indexOf('telefono'), iP = h.indexOf('personas');
  if (iF < 0 || iE < 0) throw new Error('La pestaña reservas no tiene fecha o estado.');
  return v.map(function (r) {
    return {
      id: iId >= 0 ? String(r[iId] || '') : '', fecha: fechaTxt_(r[iF]).slice(0, 10),
      estado: String(r[iE] || '').trim().toUpperCase(), gasto: Number(r[iG]) || 0,
      nombre: iN >= 0 ? String(r[iN] || '') : '', email: iM >= 0 ? String(r[iM] || '').trim().toLowerCase() : '',
      telefono: iT >= 0 ? String(r[iT] || '') : '', personas: iP >= 0 ? Number(r[iP]) || 0 : 0
    };
  });
}

/** Cálculo puro (lo prueba la batería con datos de juguete). desde, hasta y hoy son Date. */
function crmLecturaCalc_(filas, desde, hasta, hoy) {
  var tz = 'America/Guatemala';
  var dTxt = Utilities.formatDate(desde, tz, 'yyyy-MM-dd'), hTxt = Utilities.formatDate(hasta, tz, 'yyyy-MM-dd');
  var corte = Utilities.formatDate(new Date(hoy.getTime() - CRM_LECTURA_GRACIA_DIAS * 86400000), tz, 'yyyy-MM-dd');
  var out = { base: 0, visito: 0, noShow: 0, leidas: 0, lectura: 0 };
  filas.forEach(function (r) {
    var f = r.fecha;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(f) || f < dTxt || f >= hTxt || f >= corte) return;
    var e = r.estado;
    if (e.indexOf('CANCEL') >= 0 || e.indexOf('DECLIN') >= 0) return;
    out.base++;
    if (r.gasto > 0 || e === 'SEATED' || e === 'FINISHED') { out.visito++; out.leidas++; }
    else if (e === 'NO_SHOW' && f >= CRM_NOSHOW_CONFIABLE_DESDE) { out.noShow++; out.leidas++; }
  });
  out.lectura = out.base ? out.leidas / out.base : 0;
  return out;
}

/** La lectura de una ventana [desde, hasta) contra hoy. La usa el Latido. */
function crmLecturaReservas_(desde, hasta) {
  return crmLecturaCalc_(crmReservasFilas_(), desde, hasta, new Date());
}
