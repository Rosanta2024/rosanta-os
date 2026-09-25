/*
 * ============================================================
 *  ROSANTA · CRMSync.gs  ·  v5
 *  Toda captura de reserva, completa o incompleta, entra al CRM.
 *  Creado: 3 de agosto de 2026
 * ------------------------------------------------------------
 *  NUEVO EN v5 (4-ago-2026) · el consentimiento por fin viaja
 *  - intakeReserva lee "optin" del webhook y lo guarda en la
 *    novena columna de la pestaña reservas.
 *  - El bloque de RESERVAS de sincronizarCRM ya escribe opt_in en
 *    el CRM. Antes solo lo escribían los carritos, así que quien
 *    reservaba sin haber abandonado nunca tenía consentimiento.
 *  - actualizarFila_ gana una excepción para opt_in: la última
 *    respuesta manda. Antes, el primer valor quedaba grabado para
 *    siempre y un NO jamás podía corregir un SI. Eso es un
 *    requisito de cumplimiento, no una mejora.
 *  - esExcluido_ dejó de comparar por subcadena. Antes, cualquier
 *    correo con "test" adentro (protest@, latest@, contest@) se
 *    descartaba del CRM en silencio.
 *
 *  DE v4
 *  - Un contacto se busca por email Y por teléfono, no por uno solo.
 *    Antes, si el carrito traía solo teléfono y la reserva traía email,
 *    la misma persona se partía en dos filas del CRM. Ahora se fusionan.
 *
 *  DE v3
 *  - Recibe reservas de Wix (intakeReserva) y las guarda en la
 *    pestaña "reservas".
 *  - Cuando llega una reserva, marca como "Completado" el carrito
 *    de esa misma persona. Así se acaba el falso positivo del
 *    cliente que se tarda más de 4 minutos llenando el formulario.
 *
 *  DE v2
 *  - Columna K "fecha_alta" y columna L "ultimo_intento".
 *
 *  QUÉ NUNCA HACE
 *  - Jamás borra una fila ni reordena la hoja por su cuenta.
 *  - Jamás pisa un dato bueno. Cuatro excepciones sanas: el segmento
 *    sube de categoría, las fechas avanzan a la más reciente, el
 *    gasto sube al monto mayor y el consentimiento acepta la última
 *    respuesta del cliente.
 *  Es idempotente: correrlo dos veces no duplica nada.
 *
 *  DEPENDE de Code.gs: usa SCHEMA, readTab, upsert y TOKEN.
 *  OJO: jamás ejecutar setup() de Code.gs. Borra todas las pestañas.
 * ============================================================
 */

// ---------- CONFIGURACIÓN ----------
var CRM_SHEET_ID = '1VHg2GkmhGcVkxw0JZe1cBZzXOrsjzIk570yh7CyYwvM'; // Rosanta_CRM_Maestra
var MKT_SHEET_ID = '1wxsMm1Vx7tUci3ErQGa4SiGftZ21vTrxYqAObiEooyc'; // Rosanta Marketing OS
var TAB_CARRITOS = 'carritos';
var TAB_RESERVAS = 'reservas';
var TZ = 'America/Guatemala';

// Dominios y correos exactos que nunca entran al CRM
var EXCLUIR_DOMINIOS = ['@rosanta.rest', '@usermedia.co', '@example.com'];
var EXCLUIR_EXACTOS  = ['juanma.lemus@gmail.com'];

// Estados de carrito que ya NO son un abandono
var CARRITO_CERRADO = ['COMPLETADO', 'RECUPERADO'];

// Columnas del CRM maestro (1 = A)
var C = {
  first_name: 1, telefono: 2, email: 3, idioma: 4, fuente: 5,
  segmento: 6, ultima_reserva: 7, gasto_gtq: 8, opt_in: 9, notas: 10,
  fecha_alta: 11, ultimo_intento: 12
};
var TOTAL_COLS = 12;

var CAMPOS_FECHA = ['ultima_reserva', 'ultimo_intento', 'fecha_alta'];

var RANGO_SEGMENTO = {
  '': 0, 'Lead': 1, 'Carrito abandonado': 2, 'Cancelado': 3,
  'Reserva histórica': 4, 'Cliente que visitó': 5
};

// =================================================================
//  FUNCIÓN PRINCIPAL
// =================================================================
function sincronizarCRM() {
  var candado = LockService.getScriptLock();
  if (!candado.tryLock(30000)) return 'Otra corrida está en curso, esta se salta.';

  try {
    var inicio = new Date();
    var crm = abrirPestanaCRM_();
    asegurarColumnas_(crm);

    var datos = crm.getDataRange().getValues();
    var indice = construirIndice_(datos);
    var hoy = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');

    var res = { cNuevos: 0, cActual: 0, rNuevas: 0, rActual: 0, omitidos: 0 };
    var nuevas = [];

    // ---------- 1. CARRITOS · reservas incompletas ----------
    leerPestana_(MKT_SHEET_ID, TAB_CARRITOS).forEach(function (fila) {
      var fecha    = formatearFecha_(fila[1]);                   // B
      var nombre   = String(fila[2] || '').trim();               // C
      var valor    = Number(fila[4] || 0);                       // E
      var estadoC  = String(fila[5] || '').trim().toUpperCase(); // F
      var consent  = String(fila[6] || '').trim().toUpperCase(); // G
      var contacto = String(fila[7] || '').trim();               // H

      if (!contacto || esExcluido_(nombre + ' ' + contacto)) { res.omitidos++; return; }

      var esEmail = contacto.indexOf('@') > -1;
      var email   = esEmail ? contacto.toLowerCase() : '';
      var tel     = esEmail ? '' : soloDigitos_(contacto);
      var loc = buscarFila_(indice, email, tel);
      if (!loc.claves.length) { res.omitidos++; return; }

      // Si el carrito ya se completó, la persona entra igual pero NO como abandono
      var abandonado = CARRITO_CERRADO.indexOf(estadoC) === -1;
      var nota = (abandonado ? 'Intento ' : 'Intento recuperado ') + fecha + ' · Q' + valor;

      if (loc.fila > 0) {
        var cambios = { ultimo_intento: fecha, notas: nota,
                        opt_in: consent === 'SI' ? 'SI' : 'NO',
                        email: email, telefono: tel,
                        first_name: primerNombre_(nombre) };
        if (abandonado) cambios.segmento = 'Carrito abandonado';
        if (actualizarFila_(crm, loc.fila, datos, cambios)) res.cActual++;
        loc.claves.forEach(function (k) { if (!indice[k]) indice[k] = loc.fila; });

      } else if (loc.fila === 0) {
        nuevas.push(armarFila_({
          first_name: primerNombre_(nombre), telefono: tel, email: email,
          idioma: idiomaPorTelefono_(tel), fuente: 'Wix',
          segmento: abandonado ? 'Carrito abandonado' : '',
          ultima_reserva: '', gasto_gtq: 0,
          opt_in: consent === 'SI' ? 'SI' : 'NO', notas: nota,
          fecha_alta: hoy, ultimo_intento: fecha
        }));
        loc.claves.forEach(function (k) { indice[k] = -1; });
        res.cNuevos++;
      }
    });

    // ---------- 2. RESERVAS · reservas completas ----------
    leerPestana_(MKT_SHEET_ID, TAB_RESERVAS).forEach(function (fila) {
      var fecha  = formatearFecha_(fila[1]);
      var nombre = String(fila[2] || '').trim();
      var email  = String(fila[3] || '').trim().toLowerCase();
      var tel    = soloDigitos_(String(fila[4] || ''));
      var gasto  = Number(fila[6] || 0);
      var estado = String(fila[7] || '').trim().toUpperCase();
      var optin  = String(fila[8] || '').trim().toUpperCase();   // I · consentimiento

      if (esExcluido_(nombre + ' ' + email)) { res.omitidos++; return; }
      var loc = buscarFila_(indice, email, tel);
      if (!loc.claves.length) { res.omitidos++; return; }

      // Visita confirmada: consumo tecleado, o la mesa se marcó Seated/Finished en Wix
      // (23 sep 2026). Reserved y No-show quedan como "Reserva histórica": sin evidencia.
      var visito = gasto > 0 || estado === 'SEATED' || estado === 'FINISHED';
      var segmento = (estado.indexOf('CANCEL') > -1) ? 'Cancelado'
                   : (visito ? 'Cliente que visitó' : 'Reserva histórica');

      if (loc.fila > 0) {
        if (actualizarFila_(crm, loc.fila, datos, {
              segmento: segmento,
              ultima_reserva: fecha,
              gasto_gtq: gasto > 0 ? gasto : null,
              email: email, telefono: tel,
              first_name: primerNombre_(nombre),
              opt_in: optin
            })) res.rActual++;
        loc.claves.forEach(function (k) { if (!indice[k]) indice[k] = loc.fila; });
      } else if (loc.fila === 0) {
        nuevas.push(armarFila_({
          first_name: primerNombre_(nombre), telefono: tel, email: email,
          idioma: idiomaPorTelefono_(tel), fuente: 'Wix', segmento: segmento,
          ultima_reserva: fecha, gasto_gtq: gasto, opt_in: optin, notas: '',
          fecha_alta: hoy, ultimo_intento: ''
        }));
        loc.claves.forEach(function (k) { indice[k] = -1; });
        res.rNuevas++;
      }
    });

    // ---------- 3. ESCRIBIR LAS NUEVAS ----------
    if (nuevas.length) {
      var desde = crm.getLastRow() + 1;
      crm.getRange(desde, C.telefono, nuevas.length, 1).setNumberFormat('@');
      crm.getRange(desde, 1, nuevas.length, TOTAL_COLS).setValues(nuevas);
    }

    // ---------- 4. CLASIFICAR LO QUE QUEDÓ EN BLANCO ----------
    var repaso = clasificarPendientes_(crm);

    var seg = Math.round((new Date() - inicio) / 1000);
    var msg = 'CRM sincronizado en ' + seg + 's\n\n'
      + 'Carritos: ' + res.cNuevos + ' nuevos, ' + res.cActual + ' actualizados\n'
      + 'Reservas: ' + res.rNuevas + ' nuevas, ' + res.rActual + ' actualizadas\n'
      + 'Segmentos llenados: ' + repaso.segmentos + '\n'
      + 'Idiomas llenados: ' + repaso.idiomas + '\n'
      + 'Omitidos (prueba o sin contacto): ' + res.omitidos;
    Logger.log(msg);
    return msg;

  } finally {
    candado.releaseLock();
  }
}

/** Se dispara sola apenas cambia el Marketing OS. */
function alCambiarMarketingOS(e) { sincronizarCRM(); }

// =================================================================
//  RECEPCIÓN DE RESERVAS DESDE WIX
// =================================================================

/**
 * Guarda una reserva en la pestaña "reservas". Si ya existe ese id,
 * la actualiza, así el consumo y el estado se completan al cerrar la
 * mesa. Además marca como Completado el carrito de esa persona.
 * La llama doPost cuando el webhook trae hook=reserva.
 */
function intakeReserva(body) {
  var id       = String(primero_(body.id, body._id, body.reservationId) || '').trim();
  var fecha    = formatearFecha_(primero_(body.fecha, body.startDate, body.date, new Date()));
  var nombre   = String(primero_(body.nombre, body.name, body.firstName) || '').trim();
  var email    = String(primero_(body.email) || '').trim().toLowerCase();
  var telefono = soloDigitos_(String(primero_(body.telefono, body.phone) || ''));
  var personas = Number(primero_(body.personas, body.partySize, 0)) || 0;
  var gasto    = Number(primero_(body.gasto, body.consumo, body.total, 0)) || 0;
  var estado   = String(primero_(body.estado, body.status) || '').trim().toUpperCase();

  // Consentimiento de contacto. Vacío significa "no sabemos", no "dijo que no".
  var optin = String(primero_(body.optin, body.consentimiento, body.consent) || '').trim().toUpperCase();
  if (optin) {
    optin = (optin === 'SI' || optin === 'SÍ' || optin === 'TRUE' ||
             optin === '1'  || optin === 'YES') ? 'SI' : 'NO';
  }

  if (!id && !email && !telefono) return { error: 'reserva sin id ni contacto' };
  if (!id) id = 'r' + fecha + '-' + (email || telefono);

  var candado = LockService.getScriptLock();
  candado.waitLock(20000);
  try {
    // Conserva lo que ya estaba si el envío nuevo viene incompleto
    var previas = readTab(TAB_RESERVAS).filter(function (r) {
      return String(r.id) === id;
    });
    if (previas.length) {
      var p = previas[0];
      if (!gasto && Number(p.gasto) > 0) gasto = Number(p.gasto);
      if (!nombre && p.nombre)     nombre = p.nombre;
      if (!email && p.email)       email = p.email;
      if (!telefono && p.telefono) telefono = String(p.telefono);
      if (!personas && p.personas) personas = Number(p.personas);
      if (!optin && p.optin)       optin = String(p.optin);
    }

    var resultado = upsert(TAB_RESERVAS, {
      id: id, fecha: fecha, nombre: nombre, email: email,
      telefono: telefono, personas: personas, gasto: gasto, estado: estado,
      optin: optin
    });

    // Una reserva que existe cierra el carrito de esa persona
    var carritos = 0;
    if (estado.indexOf('CANCEL') === -1) {
      carritos = marcarCarritoCompletado_(email, telefono);
    }

    return { ok: true, id: id, actualizada: resultado.updated,
             optin: optin, carritosCerrados: carritos };
  } finally {
    candado.releaseLock();
  }
}

/**
 * Busca carritos pendientes de esa persona y los pasa a Completado.
 * Devuelve cuántos cerró. Así el abandono deja de ser un falso positivo
 * y el porcentaje de recuperación se vuelve medible.
 */
function marcarCarritoCompletado_(email, telefono) {
  var hoja = SpreadsheetApp.openById(MKT_SHEET_ID).getSheetByName(TAB_CARRITOS);
  if (!hoja || hoja.getLastRow() < 2) return 0;

  var ultimo8 = telefono ? soloDigitos_(telefono).slice(-8) : '';
  var filas = hoja.getRange(2, 1, hoja.getLastRow() - 1, 8).getValues();
  var cerrados = 0;

  for (var i = 0; i < filas.length; i++) {
    var estado   = String(filas[i][5] || '').trim().toUpperCase();
    if (CARRITO_CERRADO.indexOf(estado) > -1) continue;

    var contacto = String(filas[i][7] || '').trim().toLowerCase();
    if (!contacto) continue;

    var coincide = (email && contacto === email) ||
                   (ultimo8 && soloDigitos_(contacto).slice(-8) === ultimo8);
    if (coincide) {
      hoja.getRange(i + 2, 6).setValue('Completado');
      cerrados++;
    }
  }
  return cerrados;
}

function primero_() {
  for (var i = 0; i < arguments.length; i++) {
    var v = arguments[i];
    if (v !== undefined && v !== null && v !== '') return v;
  }
  return '';
}

// =================================================================
//  AYUDANTES
// =================================================================

function abrirPestanaCRM_() {
  var hojas = SpreadsheetApp.openById(CRM_SHEET_ID).getSheets();
  for (var i = 0; i < hojas.length; i++) {
    var enc = hojas[i].getRange(1, 1, 1, 10).getValues()[0].join('|').toLowerCase();
    if (enc.indexOf('first_name') > -1) return hojas[i];
  }
  throw new Error('No encontré la pestaña del CRM (ninguna tiene first_name en la fila 1).');
}

/** Crea los encabezados K y L si aún no existen. Jamás toca A-J. */
function asegurarColumnas_(hoja) {
  if (hoja.getMaxColumns() < TOTAL_COLS) {
    hoja.insertColumnsAfter(hoja.getMaxColumns(), TOTAL_COLS - hoja.getMaxColumns());
  }
  var enc = hoja.getRange(1, C.fecha_alta, 1, 2).getValues()[0];
  if (!String(enc[0] || '').trim()) hoja.getRange(1, C.fecha_alta).setValue('fecha_alta');
  if (!String(enc[1] || '').trim()) hoja.getRange(1, C.ultimo_intento).setValue('ultimo_intento');
}

function leerPestana_(idLibro, nombrePestana) {
  var hoja = SpreadsheetApp.openById(idLibro).getSheetByName(nombrePestana);
  if (!hoja || hoja.getLastRow() < 2) return [];
  return hoja.getRange(2, 1, hoja.getLastRow() - 1, hoja.getLastColumn()).getValues();
}

function construirIndice_(datos) {
  var idx = {};
  for (var f = 1; f < datos.length; f++) {
    var email = String(datos[f][C.email - 1] || '').trim().toLowerCase();
    var tel   = soloDigitos_(String(datos[f][C.telefono - 1] || ''));
    if (email) idx['e:' + email] = f + 1;
    if (tel.length >= 8) idx['t:' + tel.slice(-8)] = f + 1;
  }
  return idx;
}

function llaveDe_(email, tel) {
  if (email && email.indexOf('@') > -1) return 'e:' + email;
  if (tel && tel.length >= 8) return 't:' + tel.slice(-8);
  return '';
}

/**
 * Busca a la persona por SUS DOS llaves (email y teléfono) en vez de una sola.
 * Devuelve { fila, claves }: fila > 0 si ya existe en el CRM, 0 si es nueva,
 * -1 si ya quedó encolada en esta misma corrida.
 */
function buscarFila_(indice, email, tel) {
  var claves = [];
  if (email && email.indexOf('@') > -1) claves.push('e:' + email);
  var t = soloDigitos_(tel);
  if (t.length >= 8) claves.push('t:' + t.slice(-8));

  var fila = 0;
  for (var i = 0; i < claves.length; i++) {
    var v = indice[claves[i]];
    if (v === -1) return { fila: -1, claves: claves };
    if (v > 0 && !fila) fila = v;
  }
  return { fila: fila, claves: claves };
}

function actualizarFila_(hoja, numFila, datos, campos) {
  var actual = datos[numFila - 1] || hoja.getRange(numFila, 1, 1, TOTAL_COLS).getValues()[0];
  var escribio = false;

  Object.keys(campos).forEach(function (campo) {
    var valor = campos[campo];
    if (valor === null || valor === '' || valor === undefined) return;
    var col = C[campo];
    var vieja = actual[col - 1];
    var debeEscribir;

    if (campo === 'segmento') {
      debeEscribir = (RANGO_SEGMENTO[valor] || 0) > (RANGO_SEGMENTO[String(vieja || '').trim()] || 0);

    } else if (CAMPOS_FECHA.indexOf(campo) > -1) {
      var viejaTxt = formatearFecha_(vieja);
      debeEscribir = !viejaTxt || valor > viejaTxt;

    } else if (campo === 'gasto_gtq') {
      debeEscribir = Number(valor) > Number(vieja || 0);

    } else if (campo === 'opt_in') {
      // La última respuesta manda: un NO debe poder corregir un SI previo.
      // Es requisito de cumplimiento, no una preferencia.
      debeEscribir = String(vieja || '').trim().toUpperCase() !==
                     String(valor).trim().toUpperCase();

    } else if (campo === 'notas') {
      debeEscribir = String(vieja || '').indexOf(valor) === -1;
      if (debeEscribir && String(vieja || '').trim()) valor = vieja + ' | ' + valor;

    } else {
      debeEscribir = (vieja === '' || vieja === null || vieja === undefined);
    }

    if (debeEscribir) {
      hoja.getRange(numFila, col).setValue(valor);
      actual[col - 1] = valor;
      escribio = true;
    }
  });
  return escribio;
}

function clasificarPendientes_(hoja) {
  var ultima = hoja.getLastRow();
  if (ultima < 2) return { segmentos: 0, idiomas: 0, altas: 0 };
  var rango = hoja.getRange(2, 1, ultima - 1, TOTAL_COLS);
  var datos = rango.getValues();
  var segs = 0, idis = 0, altas = 0;

  for (var f = 0; f < datos.length; f++) {
    if (!String(datos[f][C.segmento - 1] || '').trim()) {
      var gasto  = Number(datos[f][C.gasto_gtq - 1] || 0);
      var fechaR = String(datos[f][C.ultima_reserva - 1] || '').trim();
      datos[f][C.segmento - 1] = gasto > 0 ? 'Cliente que visitó'
                               : (fechaR ? 'Reserva histórica' : 'Lead');
      segs++;
    }
    if (!String(datos[f][C.idioma - 1] || '').trim()) {
      var tel = soloDigitos_(String(datos[f][C.telefono - 1] || ''));
      if (tel) { datos[f][C.idioma - 1] = idiomaPorTelefono_(tel); idis++; }
    }
    if (!String(datos[f][C.fecha_alta - 1] || '').trim()) {
      var pista = formatearFecha_(datos[f][C.ultimo_intento - 1])
               || formatearFecha_(datos[f][C.ultima_reserva - 1]);
      if (pista) { datos[f][C.fecha_alta - 1] = pista; altas++; }
    }
  }
  if (segs || idis || altas) rango.setValues(datos);
  return { segmentos: segs, idiomas: idis, altas: altas };
}

function armarFila_(o) {
  return [o.first_name, o.telefono, o.email, o.idioma, o.fuente,
          o.segmento, o.ultima_reserva, o.gasto_gtq, o.opt_in, o.notas,
          o.fecha_alta, o.ultimo_intento];
}

function soloDigitos_(s) { return String(s || '').replace(/\D/g, ''); }
function primerNombre_(n) { return String(n || '').trim().split(/\s+/)[0] || ''; }

function idiomaPorTelefono_(tel) {
  if (!tel) return '';
  if (tel.length === 8) return 'ES';
  if (tel.indexOf('502') === 0 && tel.length === 11) return 'ES';
  return 'EN';
}

/**
 * Excluye pruebas internas sin llevarse clientes reales por delante.
 * OJO: hasta el 4-ago-2026 esto comparaba por subcadena, así que
 * correos como protest@ o latest@ se descartaban en silencio.
 */
function esExcluido_(texto) {
  var t = String(texto || '').toLowerCase();

  for (var i = 0; i < EXCLUIR_DOMINIOS.length; i++) {
    if (t.indexOf(EXCLUIR_DOMINIOS[i]) > -1) return true;
  }
  for (var j = 0; j < EXCLUIR_EXACTOS.length; j++) {
    if (t.indexOf(EXCLUIR_EXACTOS[j]) > -1) return true;
  }
  // "prueba" o "test" solo como palabra suelta, no dentro de otra palabra
  if (/(^|[\s@._-])(prueba|test)([\s@._-]|$)/.test(t)) return true;

  return false;
}

function formatearFecha_(f) {
  if (f === '' || f === null || f === undefined) return '';
  if (f instanceof Date) return Utilities.formatDate(f, TZ, 'yyyy-MM-dd');
  var t = String(f).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  var d = new Date(t);
  return isNaN(d.getTime()) ? '' : Utilities.formatDate(d, TZ, 'yyyy-MM-dd');
}

// =================================================================
//  UTILIDADES DE UNA SOLA VEZ
// =================================================================

/** Simulacro: dice qué haría, sin escribir nada. */
function ensayoCRM() {
  var crm = abrirPestanaCRM_();
  var indice = construirIndice_(crm.getDataRange().getValues());
  var carritos = leerPestana_(MKT_SHEET_ID, TAB_CARRITOS);
  var reservas = leerPestana_(MKT_SHEET_ID, TAB_RESERVAS);
  var nuevos = 0, existentes = 0, omitidos = 0;

  carritos.forEach(function (fila) {
    var nombre = String(fila[2] || ''), contacto = String(fila[7] || '').trim();
    if (!contacto || esExcluido_(nombre + ' ' + contacto)) { omitidos++; return; }
    var esEmail = contacto.indexOf('@') > -1;
    var llave = llaveDe_(esEmail ? contacto.toLowerCase() : '',
                         esEmail ? '' : soloDigitos_(contacto));
    if (!llave) { omitidos++; return; }
    indice[llave] ? existentes++ : nuevos++;
  });

  var msg = 'ENSAYO · nada se escribió\n\n'
    + 'Pestaña carritos: ' + carritos.length + ' filas\n'
    + 'Pestaña reservas: ' + reservas.length + ' filas\n'
    + 'Contactos del CRM indexados: ' + Object.keys(indice).length + '\n\n'
    + 'De los carritos: ' + nuevos + ' entrarían como nuevos, '
    + existentes + ' actualizarían a alguien que ya está, '
    + omitidos + ' se omiten por prueba o falta de contacto.';
  Logger.log(msg);
  return msg;
}

/** Crea la pestaña "reservas" con sus encabezados. Segura: jamás borra nada. */
function crearPestanaReservas() {
  var libro = SpreadsheetApp.openById(MKT_SHEET_ID);
  if (libro.getSheetByName(TAB_RESERVAS)) return 'La pestaña reservas ya existe.';
  var hoja = libro.insertSheet(TAB_RESERVAS);
  hoja.getRange(1, 1, 1, 9).setValues([[
    'id', 'fecha', 'nombre', 'email', 'telefono', 'personas', 'gasto', 'estado', 'optin'
  ]]).setFontWeight('bold');
  hoja.setFrozenRows(1);
  return 'Pestaña reservas creada con sus 9 encabezados.';
}

/** Deja todo corriendo solo: cada 5 minutos y al cambiar la hoja. */
function instalarTriggersCRM() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    var f = t.getHandlerFunction();
    if (f === 'sincronizarCRM' || f === 'alCambiarMarketingOS') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('sincronizarCRM').timeBased().everyMinutes(5).create();
  ScriptApp.newTrigger('alCambiarMarketingOS')
           .forSpreadsheet(MKT_SHEET_ID).onChange().create();
  return 'Listo: sincronizarCRM corre cada 5 minutos y también apenas cambia el Marketing OS.';
}

/**
 * PRUEBA · simula una reserva que llega dos veces: primero al reservar
 * y luego al cerrar la mesa con consumo. Incluye el consentimiento.
 */
function probarReserva() {
  var r1 = intakeReserva({
    id: 'PRUEBA-001', fecha: '2026-08-02', nombre: 'Chad Prueba',
    email: 'chad.prueba@example.com', telefono: '+1 305 555 0142',
    personas: 2, gasto: 0, estado: 'RESERVED', optin: 'SI'
  });
  var r2 = intakeReserva({
    id: 'PRUEBA-001', fecha: '2026-08-02', nombre: 'Chad Prueba',
    email: 'chad.prueba@example.com', telefono: '+1 305 555 0142',
    personas: 2, gasto: 745, estado: 'FINISHED', optin: 'NO'
  });
  var msg = 'PRUEBA DE RESERVA\n\n'
    + 'Primer envío: ' + JSON.stringify(r1) + '\n'
    + 'Segundo envío con consumo: ' + JSON.stringify(r2) + '\n\n'
    + 'Espera: una sola fila en reservas, gasto 745, estado FINISHED, optin NO.\n'
    + 'El optin cambió de SI a NO: la retractación funciona.\n'
    + 'El contacto no entra al CRM porque el correo es @example.com.';
  Logger.log(msg);
  return msg;
}

/** Borra las filas de prueba de la pestaña reservas. */
function limpiarPruebaReserva() {
  var hoja = SpreadsheetApp.openById(MKT_SHEET_ID).getSheetByName(TAB_RESERVAS);
  if (!hoja || hoja.getLastRow() < 2) return 'Nada que limpiar.';
  var ids = hoja.getRange(2, 1, hoja.getLastRow() - 1, 1).getValues();
  var n = 0;
  for (var i = ids.length - 1; i >= 0; i--) {
    if (String(ids[i][0]).indexOf('PRUEBA-') === 0) { hoja.deleteRow(i + 2); n++; }
  }
  return n + ' fila(s) de prueba eliminadas.';
}
/**
 * UNA VEZ: normaliza la columna opt_in del CRM maestro.
 * Empieza en simulacro: no escribe nada hasta que pongas SOLO_SIMULACRO en false.
 */
function normalizarOptInCRM() {
  var SOLO_SIMULACRO = false;
  var CERO_SIGNIFICA = '';     // '' = no sabemos · 'NO' = tratarlo como negativa

  var hoja = abrirPestanaCRM_();
  var ultima = hoja.getLastRow();
  if (ultima < 2) return 'Nada que normalizar.';

  var rango = hoja.getRange(2, C.opt_in, ultima - 1, 1);
  var vals = rango.getValues();
  var conteo = {}, cambios = 0;

  for (var i = 0; i < vals.length; i++) {
    var orig = String(vals[i][0]).trim();
    var v = orig.toUpperCase();
    var nuevo = orig;

    if (v === '1' || v === 'TRUE' || v === 'SÍ' || v === 'YES') nuevo = 'SI';
    else if (v === '0' || v === 'FALSE')                        nuevo = CERO_SIGNIFICA;
    else if (v === 'SI' || v === 'NO' || v === '')               nuevo = orig;
    else                                                         nuevo = '';

    conteo[orig || '(vacío)'] = (conteo[orig || '(vacío)'] || 0) + 1;
    if (nuevo !== orig) { vals[i][0] = nuevo; cambios++; }
  }

  if (!SOLO_SIMULACRO && cambios) rango.setValues(vals);

  var msg = (SOLO_SIMULACRO ? 'SIMULACRO · no se escribió nada\n\n' : 'APLICADO\n\n')
          + 'Filas revisadas: ' + vals.length + '\n'
          + 'Cambios: ' + cambios + '\n'
          + 'Valores encontrados: ' + JSON.stringify(conteo);
  Logger.log(msg);
  return msg;
}