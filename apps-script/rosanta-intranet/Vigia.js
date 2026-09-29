/**
 * EL VIGIA (27-sep-2026) — la intranet proactiva.
 *
 * Juanma: "la intranet debe ser un proceso proactivo y no reactivo". Hasta hoy los
 * numeros solo existian si alguien entraba a mirarlos, y el semaforo se ponia rojo
 * cuando el problema ya habia pasado. El vigia hace cuatro cosas sin que nadie abra
 * nada:
 *   1. ANTICIPA: mide cada numero contra su ritmo, no contra el cierre (la venta del
 *      mes al ritmo de hoy, el dia en que la caja cruzaria cero).
 *   2. EMPUJA: cada persona recibe su numero y lo que tiene que hacer, por WhatsApp
 *      y por correo (decision de Juanma: los dos; WhatsApp es mas directo).
 *        Juanma  7:00 de lunes a viernes · José y Jeffry 12:00 todos los dias ·
 *        Vanessa 9:00 los lunes. Se cambia en la pestaña VIGIA_DESTINOS.
 *   3. PROPONE: cada regla que se rompe deja una accion SUGERIDA en ACCIONES, con
 *      dueño y fecha. El lunes Juanma la aprueba o la descarta (decision de Juanma).
 *   4. CIERRA EL CICLO: las acciones vencidas y los datos que faltan se le recuerdan
 *      a su dueño antes de que falten.
 *
 * No calcula nada nuevo: usa los motores (FinanzasDatos, CajaDatos, CrmDatos,
 * InventarioDatos) y el Sistema de Medicion (MedicionDatos).
 *
 * WHATSAPP. Meta solo deja escribirle a alguien que no le escribio al numero del
 * restaurante en las ultimas 24 horas con una PLANTILLA APROBADA. El vigia manda la
 * plantilla (propiedad WA_PLANTILLA_RESUMEN, por defecto 'rosanta_resumen', con 4
 * variables: nombre, numero, lo mas importante, enlace) y, si falla, prueba texto
 * libre (sirve dentro de la ventana de 24 h). El correo sale siempre. Cada envio queda
 * en VIGIA_LOG con su resultado: un mensaje que no salio se ve, no se supone.
 * Credenciales: WHATSAPP_TOKEN y WA_PHONE_NUMBER_ID en las propiedades del script
 * (copiadas del proyecto del bot). Nunca en el codigo.
 *
 * ACTIVADOR: uno solo, vigiaCadaHora, cada hora, creado A MANO en Editor › Activadores
 * (el manifiesto no declara script.scriptapp). Cada hora mira a quien le toca.
 *
 * AMBITO GLOBAL: todo empieza con vigia / _vig; lo privado termina en guion bajo.
 */

var VIG_DEST_HOJA_ = 'VIGIA_DESTINOS';
var VIG_DEST_COLS_ = ['NOMBRE', 'ROL', 'CORREO', 'WHATSAPP', 'CANAL', 'HORA', 'DIAS', 'ACTIVO'];
var VIG_LOG_HOJA_ = 'VIGIA_LOG';
var VIG_LOG_COLS_ = ['FECHA', 'NOMBRE', 'CANAL', 'OK', 'DETALLE', 'MENSAJE'];
var VIG_TZ_ = 'America/Guatemala';
var VIG_GRAPH_ = 'v21.0';
/* los horarios que decidio Juanma (27-sep-2026) */
var VIG_DEFECTO_ = { dueno: { hora: 7, dias: 'L-V' }, chef: { hora: 12, dias: 'L-D' },
                     sala: { hora: 12, dias: 'L-D' }, pauta: { hora: 9, dias: 'L' } };
var VIG_PAGINA_ = { dueno: 'tablero', chef: 'retiros', sala: 'sala', pauta: 'marketing' };

function _vigHoja_(nombre, cols) {
  var ss = SpreadsheetApp.openById(getSheetId_('CONFIG_SHEET_ID'));
  var sh = ss.getSheetByName(nombre);
  if (!sh) {
    sh = ss.insertSheet(nombre);
    sh.getRange(1, 1, 1, cols.length).setValues([cols]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}

/** Los destinos activos, leidos de la pestaña (la edita Juanma). */
function vigiaDestinos_() {
  var sh = SpreadsheetApp.openById(getSheetId_('CONFIG_SHEET_ID')).getSheetByName(VIG_DEST_HOJA_);
  if (!sh || sh.getLastRow() < 2) return [];
  return sh.getDataRange().getValues().slice(1).map(function (r) {
    return { nombre: String(r[0] || '').trim(), rol: normalizar_(r[1]), correo: String(r[2] || '').trim(),
             whatsapp: String(r[3] || '').replace(/\D/g, ''), canal: String(r[4] || 'ambos').toLowerCase().trim(),
             hora: Number(r[5]), dias: String(r[6] || 'L-D').toUpperCase().replace(/\s/g, ''),
             activo: String(r[7] || 'SI').toUpperCase().trim() !== 'NO' };
  }).filter(function (x) { return x.nombre && x.activo; });
}

/** Una vez: crea VIGIA_DESTINOS (desde USUARIOS) y VIGIA_LOG. No pisa lo que ya exista. */
function instalarVigia(auth) {
  var u = exigirModulo_(auth, 'finanzas');
  invExigirDueno_(u);
  var rep = [];
  var ss = SpreadsheetApp.openById(getSheetId_('CONFIG_SHEET_ID'));
  var existe = !!ss.getSheetByName(VIG_DEST_HOJA_);
  var sh = _vigHoja_(VIG_DEST_HOJA_, VIG_DEST_COLS_);
  if (!existe) {
    var us = ss.getSheetByName('USUARIOS').getDataRange().getValues().slice(1);
    var filas = [];
    us.forEach(function (r) {
      var rol = normalizar_(r[1]);
      if (!VIG_DEFECTO_[rol]) return;
      filas.push([String(r[4] || r[0]), rol, String(r[0] || ''), '', 'ambos', VIG_DEFECTO_[rol].hora, VIG_DEFECTO_[rol].dias, 'SI']);
    });
    if (filas.length) sh.getRange(2, 1, filas.length, VIG_DEST_COLS_.length).setValues(filas);
    rep.push('VIGIA_DESTINOS creada con ' + filas.length + ' personas (' + filas.map(function (f) { return f[0] + ' ' + f[5] + ':00 ' + f[6]; }).join(' · ') + ').');
    rep.push('Falta escribir el WhatsApp de cada uno (columna WHATSAPP, con 502 adelante). Sin numero sale solo el correo.');
  } else {
    rep.push('VIGIA_DESTINOS ya existia: no se toco.');
  }
  _vigHoja_(VIG_LOG_HOJA_, VIG_LOG_COLS_);
  rep.push('VIGIA_LOG lista.');
  var p = PropertiesService.getScriptProperties();
  rep.push('WhatsApp: ' + (p.getProperty('WHATSAPP_TOKEN') && p.getProperty('WA_PHONE_NUMBER_ID')
    ? 'credenciales presentes.' : 'FALTAN WHATSAPP_TOKEN y WA_PHONE_NUMBER_ID en las propiedades del script: hasta copiarlas, sale solo el correo.'));
  SpreadsheetApp.flush();
  return { ok: true, reporte: rep };
}

// --------------------------------------------------------------------- reglas

/** Todo lo que el vigia necesita, leido una vez por corrida. */
function _vigContexto_(hoy) {
  var d = _finDatos_(false), P = tabParametros_();
  var M = medMetasMes_(hoy.getFullYear(), hoy.getMonth() + 1, P);
  var c = medCascadaResumen_(d, P, M, hoy);
  var ctx = { hoy: hoy, d: d, P: P, M: M, c: c };
  try { var cj = _cajaDatos_(_cajaOpciones_({})); ctx.cruza_cero = cj.escenarios && cj.escenarios.base ? cj.escenarios.base.cruza_cero : null; } catch (e) { ctx.cruza_cero = null; }
  try { ctx.mesas = medMesasPorCerrar_(hoy); } catch (e2) { ctx.mesas = null; }
  try { ctx.retiros = medRetirosMes_(hoy.getFullYear(), hoy.getMonth() + 1); } catch (e3) { ctx.retiros = null; }
  try { ctx.inv = invEstadoCierre_(hoy, P.inventario_cierre_dia.valor); } catch (e4) { ctx.inv = null; }
  try { ctx.resenas = medResenas_(hoy); } catch (e5) { ctx.resenas = null; }
  try { var k = mktKpisMes_(d.anio, d); ctx.mkt = k.meses[hoy.getMonth() + 1] || null; } catch (e6) { ctx.mkt = null; }
  try { ctx.acciones = medAcciones_(null); } catch (e7) { ctx.acciones = []; }
  try { ctx.cierres = cieTodos_(); } catch (e8) { ctx.cierres = {}; }
  ctx.invBanco = {};
  ['COCINA', 'BARRA'].forEach(function (a) { try { ctx.invBanco[a] = invBancoContraInventario_(a); } catch (e9) { ctx.invBanco[a] = null; } });
  return ctx;
}

function _vigViernes_(hoy) {
  var d = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  d.setDate(d.getDate() + ((5 - d.getDay() + 7) % 7 || 7));
  return medFechaIso_(d);
}
/* 1 lunes … 7 domingo. Las fechas de Apps Script ya van en la zona del script (Guatemala). */
function _vigDia_(hoy) { return hoy.getDay() || 7; }

/**
 * Las reglas de anticipacion. Cada una devuelve, si se rompe: los avisos para cada
 * persona y, si corresponde, una accion SUGERIDA. Una regla = un "si pasa esto, se
 * hace esto". Se agregan aqui; el resto del vigia no cambia.
 */
function vigiaReglas_(ctx) {
  var out = { avisos: {}, sugerencias: [] };
  var hoy = ctx.hoy, M = ctx.M, c = ctx.c, d = ctx.d, P = ctx.P, vie = _vigViernes_(hoy), dia = _vigDia_(hoy);
  function aviso(quien, texto, urgente) { (out.avisos[quien] = out.avisos[quien] || []).push({ texto: texto, urgente: !!urgente }); }
  function sugerir(regla, pilar, dueno, accion) { out.sugerencias.push({ regla: regla, pilar: pilar, dueno: dueno, accion: accion, fecha: vie }); }

  // V1 · la venta del mes al ritmo de hoy
  if (M.venta_total && c.venta_proy !== null && c.dia_corte >= 5) {
    var falta = M.venta_total - c.venta_proy;
    if (M.minimo.valor && c.venta_proy < M.minimo.valor) {
      aviso('dueno', 'La venta de ' + M.mes + ' va a ' + medQ_(c.venta_proy) + ', bajo el mínimo (' + medQ_(M.minimo.valor) + '). Faltan ' + medQ_(falta) + ' para la meta en ' + (c.dias_mes - c.dia_corte) + ' días.', true);
      sugerir('V1-venta', 'fundamentos', 'Juanma', 'Faltan ' + medQ_(falta) + ' para la meta de ' + M.mes + ': seguimiento a las cotizaciones de eventos abiertas y reservas de grupo esta semana.');
    } else if (falta > 0) {
      aviso('dueno', 'La venta de ' + M.mes + ' va a ' + medQ_(c.venta_proy) + ' al ritmo de hoy; la meta es ' + medQ_(M.venta_total) + '.');
    }
  }
  // V2 · la caja cruza cero pronto
  if (ctx.cruza_cero) {
    var p = String(ctx.cruza_cero).split('/');
    var f = p.length === 3 ? new Date(Number(p[2]), Number(p[1]) - 1, Number(p[0])) : null;
    var dias = f ? Math.round((f - hoy) / 86400000) : null;
    if (dias !== null && dias < 0) {
      aviso('dueno', 'Con el banco cargado, el escenario base ya habría cruzado cero el ' + ctx.cruza_cero + '. Cargar el estado de cuenta para confirmar el saldo real.', true);
      sugerir('V2-caja', 'finanzas', 'Juanma', 'Cargar el banco y confirmar el saldo: el escenario base marca cruce de cero el ' + ctx.cruza_cero + '.');
    } else if (dias !== null && dias <= 14) {
      aviso('dueno', 'La caja cruza cero el ' + ctx.cruza_cero + ' (en ' + dias + ' días) en el escenario base.', true);
      sugerir('V2-caja', 'finanzas', 'Juanma', 'La caja cruza cero el ' + ctx.cruza_cero + ': decidir la palanca (cobrar anticipos de eventos, mover pagos o activar el costo operativo).');
    } else if (dias !== null && dias <= 30) {
      aviso('dueno', 'La caja cruzaría cero el ' + ctx.cruza_cero + ' si nada cambia (en ' + dias + ' días).');
    }
  }
  // V3 · mesas por cerrar en Wix y lectura del mes
  if (ctx.mesas) {
    var n = ctx.mesas.falta_consumo.length + ctx.mesas.sin_cerrar.length;
    if (n) aviso('sala', (n === 1 ? '1 mesa' : n + ' mesas') + ' de los últimos 7 días sin cerrar en Wix (' + ctx.mesas.sin_cerrar.length + ' en Reserved, ' + ctx.mesas.falta_consumo.length + ' sin consumo).', n >= 5);
    var lect = ctx.mkt ? ctx.mkt.lectura : null;
    if (lect !== null && lect < 50 && n) sugerir('V3-wix', 'management', 'José', 'Cerrar en Wix ' + (n === 1 ? 'la mesa pendiente' : 'las ' + n + ' mesas pendientes') + ' (Seated y consumo): la lectura del mes está en ' + lect + '% y sin ella no hay CAC.');
  }
  // V4 · food cost sobre el tramo dos semanas seguidas
  var S = (d.semanas || []).filter(function (s) { return !s.corta; }), tramo = M.food.valor || d.meta_cogs;
  if (S.length >= 2) {
    var a = S[S.length - 1], b = S[S.length - 2];
    if (a.cogs_m4 > tramo + 3 && b.cogs_m4 > tramo + 3) {
      aviso('chef', 'Food cost ' + a.cogs_m4 + '% contra un tramo de ≤' + tramo + '%, dos semanas seguidas.', true);
      sugerir('V4-food', 'profit', 'Jeffry', 'Food cost ' + a.cogs_m4 + '% dos semanas sobre el tramo (≤' + tramo + '%): revisar porciones y recepción de los 5 platos que más venden.');
    }
  }
  // V5 · retiros de cajero sin detalle de hace 3 dias o mas
  if (ctx.retiros) {
    var lim = medFechaIso_(new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - 3));
    var viejos = ctx.retiros.lista.filter(function (x) { return !x.detalle && x.fecha <= lim; });
    if (viejos.length) {
      aviso('chef', viejos.length + ' retiros de cajero sin detalle: anotar qué se compró en Profit OS › Cocina › Compras en efectivo.', viejos.length >= 5);
      if (viejos.length >= 3) sugerir('V5-retiros', 'profit', 'Jeffry', 'Anotar el detalle de ' + viejos.length + ' retiros de cajero de ' + ctx.retiros.mes + ' en Profit OS › Cocina › Compras en efectivo.');
    }
  }
  // V6 · inventario del mes anterior
  if (ctx.inv) {
    var diaMes = hoy.getDate(), lim6 = ctx.inv.dia_limite;
    [['COCINA', 'chef', 'Jeffry'], ['BARRA', 'sala', 'José']].forEach(function (x) {
      var r = ctx.inv.areas[x[0]];
      if (r.zona === 'verde') return;
      if (diaMes <= lim6) aviso(x[1], 'El inventario de ' + x[0].toLowerCase() + ' de ' + ctx.inv.esperado + ' se cierra antes del día ' + lim6 + '.', diaMes >= lim6 - 1);
      else {
        aviso(x[1], 'El inventario de ' + x[0].toLowerCase() + ' de ' + ctx.inv.esperado + ' sigue abierto (el límite era el día ' + lim6 + ').', true);
        sugerir('V6-inv-' + x[0].toLowerCase(), 'profit', x[2], 'Cerrar el inventario de ' + x[0].toLowerCase() + ' de ' + ctx.inv.esperado + ' en la intranet.');
      }
    });
  }
  // V7 · la carga del POS de la semana
  var ult = (d.integridad && d.integridad.ult && d.integridad.ult['02_Ventas_Maestro']) || '';
  var pu = ult.split('/');
  if (pu.length === 3 && dia >= 2) {
    var fu = new Date(Number(pu[2]), Number(pu[1]) - 1, Number(pu[0]));
    var domingo = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - (dia % 7));
    if (fu < new Date(domingo.getFullYear(), domingo.getMonth(), domingo.getDate() - 1)) aviso('dueno', 'El POS está cargado hasta el ' + ult + ': falta la semana pasada. Sin eso los números de esta semana no existen.', true);
  }
  // V8 · acciones vencidas
  (ctx.acciones || []).forEach(function (x) {
    if (x.estado === 'pendiente' && x.atrasada) aviso('persona:' + x.dueno, 'Acción vencida (' + x.fecha + '): ' + x.accion, true);
  });
  // V9 · clientes nuevos al ritmo del mes (Vanessa)
  if (ctx.mkt && ctx.mkt.altas !== null && c.dia_corte >= 7 && M.clientes.valor) {
    var ritmo = Math.round(ctx.mkt.altas / c.dia_corte * c.dias_mes);
    if (ritmo < M.clientes.valor * 0.9) {
      aviso('pauta', 'Clientes nuevos de ' + M.mes + ' al ritmo de hoy: ' + ritmo + ' (meta ' + M.clientes.valor + ').', true);
      if (dia === 1) sugerir('V9-clientes', 'marketing', 'Vanessa', 'Clientes nuevos van a ' + ritmo + ' contra ' + M.clientes.valor + ': revisar en ⚖️ Decisiones qué conjunto optimiza a reserva real y mover el gasto ahí.');
    }
  }
  // V11 · el cierre diario de PosFile de ayer no llego (el sistema de PosFile a veces se cae)
  if (ctx.cierres) {
    var ayer = medFechaIso_(new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - 1));
    var fechas = Object.keys(ctx.cierres).sort(), ult = fechas.length ? fechas[fechas.length - 1] : null;
    if (ult && !ctx.cierres[ayer]) aviso('dueno', 'No llegó el cierre de PosFile de ayer (el último es del ' + ult + '). La venta del mes queda hasta ese día.');
  }
  // V12 · la experiencia: el promedio de las reseñas nunca baja de 4.8 (piso duro de la vision)
  if (ctx.resenas && ctx.resenas.estrellas_4 !== null && ctx.resenas.estrellas_4 < MED_VISION_.resenas) {
    var tx = 'Las reseñas de las últimas 4 semanas promedian ' + ctx.resenas.estrellas_4 + '★: bajo el piso de ' + MED_VISION_.resenas + '★ de la visión.';
    aviso('dueno', tx, true); aviso('sala', tx + ' Revisar en el huddle qué se quejó el cliente.', true);
    sugerir('V12-experiencia', 'management', 'José', 'Reseñas en ' + ctx.resenas.estrellas_4 + '★ (piso 4.8): leer las reseñas bajas con el equipo y corregir la causa esta semana.');
  }
  // V13 · el Banco se aparto del ultimo inventario cerrado (p226): el precio que manda es
  //       el del inventario, y el cierre solo corrige lo que cambio en el conteo. Los de
  //       unidad distinta no se pueden comparar; se recuerdan solo los lunes.
  ['COCINA', 'BARRA'].forEach(function (a) {
    var r = ctx.invBanco && ctx.invBanco[a];
    if (!r || !r.mes) return;
    if (r.difieren.length) {
      aviso('dueno', 'Banco de ' + a.toLowerCase() + ' distinto al inventario de ' + r.mes + ' en ' + r.difieren.length +
        (r.difieren.length === 1 ? ' insumo' : ' insumos') + ' (10% o más): ' + r.difieren.slice(0, 5).map(invDifiereTexto_).join(' · ') +
        (r.difieren.length > 5 ? ' · y ' + (r.difieren.length - 5) + ' más' : '') + '. El precio que manda es el del inventario.');
    }
    if (dia === 1 && r.noComparables.length) {
      aviso('dueno', 'No comparables por unidad (' + a.toLowerCase() + ', ' + r.mes + '): ' +
        r.noComparables.map(function (x) { return x.producto + ' ' + x.enInventario + ' contra ' + x.enBanco; }).join(' · ') + '.');
    }
  });
  // V10 · reseñas de la semana, desde el jueves
  if (ctx.resenas && dia >= 4 && ctx.resenas.esta_semana < M.resenas.valor) {
    aviso('sala', 'Reseñas de Google esta semana: ' + ctx.resenas.esta_semana + ' de ' + M.resenas.valor + '. Pedirlas en el huddle de hoy.');
  }
  return out;
}

/** Escribe las acciones sugeridas en ACCIONES. Una por regla y por semana: no se repite. */
function _vigSugerir_(sugerencias) {
  if (!sugerencias.length) return 0;
  var sh = _vigHoja_(MED_ACC_HOJA_, MED_ACC_COLS_);
  var head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
  var iR = head.indexOf('REGLA');
  if (iR === -1) { iR = head.length; sh.getRange(1, iR + 1).setValue('REGLA').setFontWeight('bold'); }
  var v = sh.getDataRange().getValues(), sem = medSemanaClave_(new Date()), ya = {};
  for (var i = 1; i < v.length; i++) if (String(v[i][0]) === sem && v[i][iR]) ya[String(v[i][iR])] = true;
  var n = 0;
  sugerencias.forEach(function (s) {
    if (ya[s.regla]) return;
    var fila = [sem, s.pilar, s.accion, s.dueno, s.fecha, 'sugerida', 'Vigía', new Date(), ''];
    while (fila.length < iR) fila.push('');
    fila[iR] = s.regla;
    sh.appendRow(fila);
    ya[s.regla] = true; n++;
  });
  SpreadsheetApp.flush();
  return n;
}

// ------------------------------------------------------------------- mensajes

/** El mensaje de una persona: su numero, lo que tiene que hacer y sus acciones. */
function vigiaMensaje_(dest, ctx, reglas) {
  var rol = dest.rol, hoy = ctx.hoy;
  var u = { rol: rol, nombre: dest.nombre, email: dest.correo };
  var sem = null;
  try { sem = medMiSemana_(u, rol, null); } catch (e) { sem = null; }
  var items = (sem && sem.items) || [];
  var avisos = (reglas.avisos[rol] || []).concat(reglas.avisos['persona:' + dest.nombre] || []);
  avisos.sort(function (a, b) { return (b.urgente ? 1 : 0) - (a.urgente ? 1 : 0); });
  var mias = (ctx.acciones || []).filter(function (x) { return x.dueno === dest.nombre && x.estado === 'pendiente'; });
  var sugeridas = rol === 'dueno' ? (ctx.acciones || []).filter(function (x) { return x.estado === 'sugerida'; }).length : 0;
  var principal = items[0] ? items[0].nombre + ': ' + items[0].valor + ' (' + items[0].texto + ')' : 'sin dato';
  var top = avisos.length ? avisos[0].texto : (mias.length ? 'Tu acción de la semana: ' + mias[0].accion : 'Nada urgente hoy. Sigue con lo planeado.');
  var link = urlIntranet_() + '?page=' + (VIG_PAGINA_[rol] || 'tablero');
  var dias = ['', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'][_vigDia_(hoy)];
  var lineas = [];
  var ayerIso = medFechaIso_(new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - 1));
  var cAyer = ctx.cierres && ctx.cierres[ayerIso];
  lineas.push('Hola ' + dest.nombre + ', tu resumen del ' + dias + ' ' + hoy.getDate() + '/' + (hoy.getMonth() + 1) + '.');
  lineas.push('');
  if (cAyer && (rol === 'dueno' || rol === 'sala')) {
    lineas.push('Ayer: ' + medQ_(cAyer.sin_propina) + ' sin propina' + (cAyer.tickets ? ' en ' + cAyer.tickets + ' mesas' : '') +
      (cAyer.comensales_reserva ? ' · ' + cAyer.comensales_reserva + ' comensales con reserva' : '') +
      (rol === 'dueno' ? ' · tarjeta ' + medQ_(cAyer.tarjeta) + ' · efectivo ' + medQ_(cAyer.efectivo) : '') + '.');
    lineas.push('');
  }
  items.forEach(function (x) { lineas.push((x.zona === 'verde' ? '🟢 ' : x.zona === 'amarillo' ? '🟡 ' : x.zona === 'rojo' ? '🔴 ' : '⚪ ') + x.nombre + ': ' + x.valor + ' — ' + x.texto); });
  if (avisos.length) { lineas.push(''); lineas.push('Lo importante hoy:'); avisos.slice(0, 5).forEach(function (a) { lineas.push((a.urgente ? '⚠️ ' : '• ') + a.texto); }); }
  if (mias.length) { lineas.push(''); lineas.push('Tus acciones de la semana:'); mias.slice(0, 5).forEach(function (a) { lineas.push('☐ ' + a.accion + ' (' + a.fecha + ')'); }); }
  if (sugeridas) { lineas.push(''); lineas.push('El vigía dejó ' + sugeridas + ' acción(es) sugerida(s) para aprobar en el tablero.'); }
  lineas.push(''); lineas.push('Abrir: ' + link + ' (con tu enlace personal)');
  return { destino: dest.nombre, rol: rol, asunto: 'Rosanta · tu resumen del ' + dias + ' · ' + (items[0] ? items[0].nombre + ' ' + items[0].valor : ''),
           texto: lineas.join('\n'), principal: principal, top: top, link: link, avisos: avisos.length, sugeridas: sugeridas };
}

function _vigLimpia_(t) { return String(t || '').replace(/[\n\r\t]+/g, ' · ').replace(/ {4,}/g, '   ').slice(0, 900); }

/** WhatsApp: plantilla aprobada; si falla, texto libre (sirve dentro de las 24 h). */
function _vigWhatsApp_(dest, msg) {
  var p = PropertiesService.getScriptProperties();
  var token = p.getProperty('WHATSAPP_TOKEN'), pid = p.getProperty('WA_PHONE_NUMBER_ID');
  if (!token || !pid) return { ok: false, detalle: 'faltan WHATSAPP_TOKEN / WA_PHONE_NUMBER_ID en las propiedades del script' };
  if (!dest.whatsapp) return { ok: false, detalle: 'sin numero de WhatsApp en VIGIA_DESTINOS' };
  var url = 'https://graph.facebook.com/' + VIG_GRAPH_ + '/' + pid + '/messages';
  var H = { Authorization: 'Bearer ' + token };
  var plantilla = p.getProperty('WA_PLANTILLA_RESUMEN') || 'rosanta_resumen';
  var cuerpo = { messaging_product: 'whatsapp', to: dest.whatsapp, type: 'template',
    template: { name: plantilla, language: { code: 'es' }, components: [{ type: 'body', parameters: [
      { type: 'text', text: _vigLimpia_(dest.nombre) }, { type: 'text', text: _vigLimpia_(msg.principal) },
      { type: 'text', text: _vigLimpia_(msg.top) }, { type: 'text', text: _vigLimpia_(msg.link) }] }] } };
  var r = UrlFetchApp.fetch(url, { method: 'post', contentType: 'application/json', headers: H, payload: JSON.stringify(cuerpo), muteHttpExceptions: true });
  if (r.getResponseCode() === 200) return { ok: true, detalle: 'plantilla ' + plantilla };
  var errP = r.getContentText().slice(0, 200);
  var r2 = UrlFetchApp.fetch(url, { method: 'post', contentType: 'application/json', headers: H, muteHttpExceptions: true,
    payload: JSON.stringify({ messaging_product: 'whatsapp', to: dest.whatsapp, type: 'text', text: { body: msg.texto.slice(0, 4000) } }) });
  // Meta ACEPTA el texto libre siempre, pero solo lo ENTREGA si esa persona le escribio al
  // restaurante en las ultimas 24 h. Aceptado no es entregado: el log lo dice asi.
  if (r2.getResponseCode() === 200) return { ok: false, detalle: 'SIN GARANTIA: texto libre aceptado por Meta; solo llega si esta persona escribio al restaurante en las ultimas 24 h. Falta la plantilla aprobada (' + errP.slice(0, 120) + ')' };
  return { ok: false, detalle: 'plantilla: ' + errP + ' · texto: ' + r2.getContentText().slice(0, 200) };
}

function _vigCorreo_(dest, msg) {
  if (!dest.correo) return { ok: false, detalle: 'sin correo' };
  try {
    var html = '<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.55;color:#1a1a1a">' +
      msg.texto.split('\n').map(function (l) { return l ? String(l).replace(/[&<>]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]; }) : '&nbsp;'; }).join('<br>') + '</div>';
    MailApp.sendEmail({ to: dest.correo, subject: msg.asunto, body: msg.texto, htmlBody: html, name: 'Rosanta · Vigía' });
    return { ok: true, detalle: 'correo' };
  } catch (e) { return { ok: false, detalle: String(e && e.message || e) }; }
}

function _vigLog_(dest, canal, res, msg) {
  try {
    _vigHoja_(VIG_LOG_HOJA_, VIG_LOG_COLS_).appendRow([new Date(), dest.nombre, canal, res.ok ? 'SI' : 'NO', res.detalle, msg.texto.slice(0, 1500)]);
  } catch (e) { /* sin log no se frena el envio */ }
}

/* Decision de Juanma (27-sep-2026): el vigia manda por CORREO. WhatsApp queda apagado
   (sin plantilla aprobada Meta acepta el mensaje pero no lo entrega) y se enciende con la
   propiedad del script VIGIA_WHATSAPP = SI, cuando exista una plantilla aprobada. Los
   numeros de VIGIA_DESTINOS se quedan guardados para ese dia. */
function _vigWhatsAppActivo_() {
  return String(PropertiesService.getScriptProperties().getProperty('VIGIA_WHATSAPP') || '').toUpperCase().trim() === 'SI';
}

function _vigEnviar_(dest, msg) {
  var res = [];
  var wa = _vigWhatsAppActivo_();
  if (wa && (dest.canal === 'ambos' || dest.canal === 'whatsapp')) { var w = _vigWhatsApp_(dest, msg); _vigLog_(dest, 'whatsapp', w, msg); res.push('WhatsApp: ' + (w.ok ? 'enviado' : 'NO · ' + w.detalle)); }
  if (!wa || dest.canal === 'ambos' || dest.canal === 'correo' || (dest.canal === 'whatsapp' && !dest.whatsapp)) { var c = _vigCorreo_(dest, msg); _vigLog_(dest, 'correo', c, msg); res.push('Correo: ' + (c.ok ? 'enviado' : 'NO · ' + c.detalle)); }
  return res;
}

/** Quien ya recibio hoy su resumen (por el log), para no repetir. */
function _vigYaHoy_() {
  var sh = SpreadsheetApp.openById(getSheetId_('CONFIG_SHEET_ID')).getSheetByName(VIG_LOG_HOJA_);
  var hoy = Utilities.formatDate(new Date(), VIG_TZ_, 'yyyy-MM-dd'), out = {};
  if (!sh || sh.getLastRow() < 2) return out;
  sh.getDataRange().getValues().slice(1).forEach(function (r) {
    if (r[0] instanceof Date && Utilities.formatDate(r[0], VIG_TZ_, 'yyyy-MM-dd') === hoy && String(r[3]) === 'SI') out[String(r[1])] = true;
  });
  return out;
}

function _vigTocaHoy_(dias, dia) {
  if (dias === 'L-D' || dias === 'TODOS') return true;
  if (dias === 'L-V') return dia <= 5;
  if (dias === 'L-S') return dia <= 6;
  var mapa = { L: 1, MA: 2, MI: 3, J: 4, V: 5, S: 6, D: 7 };
  return dias.split(',').some(function (x) { return mapa[x] === dia; });
}

// ------------------------------------------------------------------ entradas

/**
 * El activador (cada hora). A las 6 deja las acciones sugeridas del dia; en cada hora
 * manda el resumen a quien le toca y todavia no lo recibio hoy.
 * Guarda: soloDueno_ — un activador corre como Juanma; desde el navegador de otra
 * persona tira, asi nadie puede disparar envios.
 */
function vigiaCadaHora() {
  soloDueno_();
  // Puente con el reporte semanal (28-sep-2026): importa las acciones que propuso la tarea
  // del lunes y exporta METAS y ACCIONES para la proxima corrida. Nunca frena al vigia.
  try { Logger.log(puenteReporte_()); } catch (eP) { Logger.log('Puente del reporte: ' + eP); }
  // El reporte semanal por correo a los supervisores, martes 12:00 (28-sep-2026).
  try { Logger.log(repCorreoCadaHora_(new Date())); } catch (eR) { Logger.log('Reporte por correo: ' + eR); }
  var hoy = new Date(), hora = hoy.getHours(), dia = _vigDia_(hoy);
  var destinos = vigiaDestinos_();
  var ya = _vigYaHoy_();
  var toca = destinos.filter(function (x) { return x.hora === hora && _vigTocaHoy_(x.dias, dia) && !ya[x.nombre]; });
  if (!toca.length && hora !== 6) return 'Nadie le toca a las ' + hora + ':00.';
  if (hora === 6 || hora === 7) { try { cieLeer_(7); } catch (eC) { /* sin Gmail: sigue con la carga del lunes */ } }
  var ctx = _vigContexto_(hoy), reglas = vigiaReglas_(ctx);
  if (hora === 6 || hora === 7) { _vigSugerir_(reglas.sugerencias); ctx.acciones = medAcciones_(null); }
  var log = [];
  toca.forEach(function (dest) { log.push(dest.nombre + ': ' + _vigEnviar_(dest, vigiaMensaje_(dest, ctx, reglas)).join(' · ')); });
  return log.join('\n') || 'Sugerencias del día escritas.';
}

/** Tablero › Metas y ajustes: lo que el vigia diria HOY a cada uno, sin mandar nada. */
function vigiaVistaPrevia(auth) {
  var u = exigirModulo_(auth, 'finanzas');
  invExigirDueno_(u);
  var hoy = new Date(), ctx = _vigContexto_(hoy), reglas = vigiaReglas_(ctx);
  var destinos = vigiaDestinos_();
  var p = PropertiesService.getScriptProperties();
  var log = [];
  try {
    var sh = SpreadsheetApp.openById(getSheetId_('CONFIG_SHEET_ID')).getSheetByName(VIG_LOG_HOJA_);
    if (sh && sh.getLastRow() > 1) log = sh.getRange(Math.max(2, sh.getLastRow() - 11), 1, Math.min(12, sh.getLastRow() - 1), 5).getValues().reverse()
      .map(function (r) { return { fecha: r[0] instanceof Date ? Utilities.formatDate(r[0], VIG_TZ_, 'dd/MM HH:mm') : String(r[0]), nombre: r[1], canal: r[2], ok: r[3], detalle: r[4] }; });
  } catch (e) { log = []; }
  return {
    instalado: destinos.length > 0,
    whatsapp_listo: !!(p.getProperty('WHATSAPP_TOKEN') && p.getProperty('WA_PHONE_NUMBER_ID')),
    whatsapp_activo: _vigWhatsAppActivo_(),
    plantilla: p.getProperty('WA_PLANTILLA_RESUMEN') || 'rosanta_resumen',
    destinos: destinos.map(function (x) { return { nombre: x.nombre, rol: x.rol, hora: x.hora, dias: x.dias, canal: x.canal,
      whatsapp: x.whatsapp ? '…' + x.whatsapp.slice(-4) : '', correo: x.correo }; }),
    mensajes: destinos.map(function (x) { return vigiaMensaje_(x, ctx, reglas); }),
    sugerencias: reglas.sugerencias,
    log: log
  };
}

/** Tablero: manda YA el resumen de una persona (para probar). Solo el dueño. */
function vigiaEnviarAhora(auth, nombre) {
  var u = exigirModulo_(auth, 'finanzas');
  invExigirDueno_(u);
  var dest = vigiaDestinos_().filter(function (x) { return x.nombre === nombre; })[0];
  if (!dest) throw new Error('No hay destino con el nombre ' + nombre + ' en VIGIA_DESTINOS.');
  var ctx = _vigContexto_(new Date()), reglas = vigiaReglas_(ctx);
  return _vigEnviar_(dest, vigiaMensaje_(dest, ctx, reglas));
}

/** Tablero: escribe ya las sugerencias de hoy (normalmente lo hace el activador a las 6). */
function vigiaSugerirAhora(auth) {
  var u = exigirModulo_(auth, 'finanzas');
  invExigirDueno_(u);
  var ctx = _vigContexto_(new Date()), reglas = vigiaReglas_(ctx);
  return { escritas: _vigSugerir_(reglas.sugerencias), total: reglas.sugerencias.length };
}
