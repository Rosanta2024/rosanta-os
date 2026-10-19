/**
 * ROSANTA · BOT — CANCELACION DE RESERVAS EN WIX
 * Archivo ADITIVO. Prefijo rv, igual que Reservas.gs, con el que comparte
 * rvFecha, rvFechaBonita y rvHistoria (Apps Script comparte scope global).
 *
 * Unico cambio en Reservas.gs: el desvio al inicio de rvCerrar, y la llamada
 * a rvCorreoCliente dentro de rvAvisar.
 * Endpoint: POST /_functions/cancelarBot   (mismo secreto que reservaBot)
 */

/* =====================================================================
 * CANCELACION
 * Reglas de Juanma (8-sep-2026): basta que coincida el TELEFONO o el CORREO,
 * y no hay ventana: cancela aunque falte media hora. El equipo se entera
 * siempre, y el cliente recibe correo.
 * ===================================================================== */

/** URL del endpoint. Se deriva de la de reservas si no hay Propiedad propia. */
function rvUrlCancelar() {
  var p = PropertiesService.getScriptProperties();
  var u = p.getProperty('WIX_CANCELAR_URL');
  if (u) return u;
  var base = p.getProperty('WIX_RESERVAS_URL') || '';
  return base ? base.replace(/\/[^\/]*$/, '/cancelarBot') : '';
}

function rvLlamarCancelar(d) {
  var url = rvUrlCancelar();
  var sec = PropertiesService.getScriptProperties().getProperty('WIX_RESERVAS_SECRETO');
  if (!url || !sec) return { ok: false, motivo: 'sin_configurar' };
  try {
    var res = UrlFetchApp.fetch(url, {
      method: 'post', contentType: 'application/json',
      payload: JSON.stringify({ secreto: sec, telefono: d.telefono, email: d.email, fecha: d.fecha, hora: d.hora || '', todas: d.todas === true }),
      muteHttpExceptions: true
    });
    var body = JSON.parse(res.getContentText() || '{}');
    var code = res.getResponseCode();
    if (code !== 200) return { ok: false, motivo: body.motivo || ('http_' + code), detalle: res.getContentText().slice(0, 200) };
    return body;
  } catch (e) {
    return { ok: false, motivo: 'excepcion', detalle: String(e) };
  }
}

function rvCancelar(result, canal, contactoId) {
  var d = {
    email:    String(result.lead.email || '').trim().toLowerCase(),
    fecha:    rvFecha(result.lead.fecha),
    hora:     rvHora(result.lead.hora),
    telefono: String(result.lead.telefono || '').replace(/\D/g, ''),
    idioma:   String(result.lead.idioma || 'es').toLowerCase().indexOf('en') === 0 ? 'en' : 'es'
  };
  if (canal === 'whatsapp' && !d.telefono) d.telefono = String(contactoId || '').replace(/\D/g, '');
  // Por correo, la direccion de quien escribe identifica la reserva, como el numero en WhatsApp (19-oct-2026, Louise).
  if (canal === 'correo' && !d.email && /@/.test(String(contactoId || ''))) d.email = String(contactoId).trim().toLowerCase();

  // Sin ninguna llave de identidad no se busca nada.
  if (!d.telefono && !d.email) {
    result.respuesta = rvTextoCancel(d.idioma, 'cancel_correo', d);
    result.lead.accion = 'responder_info';
    result.lead.requiere_humano = false;
    return result;
  }

  var r = rvLlamarCancelar(d);

  if (r.ok) {
    var c = r.cancelada || {};
    d.fecha = c.fecha || d.fecha;
    d.hora = c.hora || '';
    d.personas = c.personas || '';
    d.nombre = c.nombre || '';
    d.email = c.email || d.email;          // el de la reserva manda: puede que no lo haya dado en el chat
    result.respuesta = rvTextoCancel(d.idioma, 'cancelada', d);
    result.lead.tipo = 'reserva';
    result.lead.accion = 'responder_info';
    result.lead.requiere_humano = false;
    result.lead.resumen = 'Reserva CANCELADA por el bot: ' + d.fecha + ' ' + d.hora + ', ' + d.personas + ' personas';
    rvHistoria(contactoId, result,
      'La reserva del ' + d.fecha + ' ' + d.hora + ' SI quedo cancelada en Wix. Ya no existe. ' +
      'Si el cliente quiere otra fecha, tomale una reserva nueva.');
    rvAvisarCancel(d, canal);
    rvCorreoCliente(d, 'cancelada');
    return result;
  }

  if (r.motivo === 'VARIAS') {
    d.opciones = r.opciones || [];
    result.respuesta = rvTextoCancel(d.idioma, 'cancel_varias', d);
    result.lead.accion = 'responder_info';
    result.lead.requiere_humano = false;
    rvHistoria(contactoId, result,
      'El cliente tiene ' + (r.cuantas || 0) + ' reservas activas y se le pregunto cual cancelar. ' +
      'NO se cancelo ninguna todavia. Cuando conteste, marca cancelar_reserva con esa fecha y esa hora.');
    return result;
  }

  // No aparece. Si aun no dio correo, se le pide: es la segunda llave de identidad.
  if (r.motivo === 'NO_ENCONTRADA' || r.motivo === 'SIN_COINCIDENCIA') {
    if (!d.email) {
      result.respuesta = rvTextoCancel(d.idioma, 'cancel_correo', d);
      result.lead.accion = 'responder_info';
      result.lead.requiere_humano = false;
      rvHistoria(contactoId, result,
        'No se encontro reserva con el telefono. Se le pidio el correo con el que reservo. ' +
        'NO se cancelo nada. Cuando lo de, vuelve a marcar accion:"cancelar_reserva".');
      return result;
    }
    result.respuesta = rvTextoCancel(d.idioma, 'cancel_nada', d);
    result.lead.accion = 'escalar_humano';
    result.lead.requiere_humano = true;
    rvHistoria(contactoId, result,
      'No se encontro ninguna reserva activa ni por telefono ni por correo (' + r.motivo + '). ' +
      'NO se cancelo nada y ya se aviso al equipo.');
    return result;
  }

  Logger.log('rvCancelar: fallo. motivo=' + r.motivo + ' detalle=' + (r.detalle || ''));
  result.respuesta = rvTextoCancel(d.idioma, 'cancel_error', d);
  result.lead.accion = 'escalar_humano';
  result.lead.requiere_humano = true;
  rvHistoria(contactoId, result,
    'Fallo el sistema al cancelar (' + r.motivo + '). NO se cancelo nada y ya se aviso al equipo.');
  return result;
}

/** El equipo se entera de toda cancelacion hecha por el bot. */
function rvAvisarCancel(d, canal) {
  if (RV_SILENCIO) return;   // prueba
  var texto = '❌ Reserva CANCELADA (bot ' + (canal || '') + ')\n' +
    (d.nombre || '') + ' · ' + d.personas + ' personas\n' +
    rvFechaBonita(d.fecha, false) + ' · ' + d.hora + '\n' +
    'Tel ' + d.telefono + (d.email ? ' · ' + d.email : '');
  var p = PropertiesService.getScriptProperties();
  try {
    var owner = p.getProperty('OWNER_WA');
    var pid = p.getProperty('WA_PHONE_NUMBER_ID');
    if (owner && pid) sendWhatsApp(pid, owner, texto);
  } catch (e) { Logger.log('rvAvisarCancel WhatsApp: ' + e); }
  try {
    MailApp.sendEmail({
      to: 'restaurante@rosanta.rest',
      subject: 'Reserva CANCELADA por el bot - ' + d.fecha + ' ' + d.hora,
      body: texto
    });
  } catch (e) { Logger.log('rvAvisarCancel correo: ' + e); }
}

/**
 * CORREO AL CLIENTE. Sale por Apps Script, NO por Wix.
 *
 * Wix manda sus correos por bounces.wixemails.com y hoy no llegan porque la
 * autenticacion del dominio esta rota. Este sale directo desde la cuenta de
 * Google del restaurante, asi que no depende de arreglar el DNS primero.
 *
 * caso: 'creada' | 'cancelada'
 */
function rvCorreoCliente(d, caso) {
  if (RV_SILENCIO) return;   // prueba
  var email = String(d.email || '').trim();
  if (!email || email.indexOf('@') < 0) {
    Logger.log('rvCorreoCliente: sin correo del cliente, no se manda nada.');
    return;
  }
  var en = d.idioma === 'en';
  var fecha = d.fecha ? rvFechaBonita(d.fecha, en) : '';
  var nombre = String(d.nombre || '').split(/\s+/)[0] || '';
  var asunto, cuerpo;

  if (caso === 'cambiada') {
    // Revisado por revisor-marca (15-oct-2026). d.antes / d.ahora = {fecha, hora, personas}; d.reemplazada si Wix
    // no dejó modificarla y tuvo que cancelar la vieja (al cliente le llega un aviso de cancelación de Wix).
    var linea = function (x) {
      var n = Number(x.personas);
      return en
        ? rvFechaEn_(x.fecha) + ' at ' + rvHora12_(x.hora) + ', ' + n + (n === 1 ? ' guest' : ' guests')
        : rvFechaBonita(x.fecha, false) + ' a las ' + x.hora + ', ' + n + (n === 1 ? ' persona' : ' personas');
    };
    asunto = en ? 'Your booking has been updated' : 'Tu reserva cambió';
    cuerpo = (en ? 'Hi ' : 'Hola ') + (nombre || (en ? 'there' : '')) + ',\n\n' +
      (en ? 'Your booking is updated. Same table, new details:\n\nWas: ' + linea(d.antes) + '\nNow: ' + linea(d.ahora)
          : 'Tu reserva queda actualizada. Es la misma mesa, solo cambian los datos:\n\nAntes: ' + linea(d.antes) + '\nAhora: ' + linea(d.ahora)) +
      (d.reemplazada
        ? (en ? '\n\nIf you got a cancellation notice, it comes from this same change. Your table is still confirmed with the details above.'
              : '\n\nSi te llegó un aviso de cancelación, viene de este mismo cambio. Tu mesa sigue confirmada con los datos de arriba.')
        : '') +
      (en ? '\n\nSee you at Rosanta, Antigua Guatemala.\n\nTo change or cancel it, message us on WhatsApp and we\'ll sort it out.'
          : '\n\nTe esperamos en Rosanta, Antigua Guatemala.\n\nPara cambiarla o cancelarla, respondes por WhatsApp y se resuelve.');
  } else if (caso === 'cancelada') {
    asunto = en ? 'Your reservation is cancelled' : 'Tu reserva quedó cancelada';
    cuerpo = (nombre ? nombre + ',\n\n' : '') +
      (en
        ? 'Your reservation for ' + fecha + ' at ' + d.hora + ' is cancelled. Nothing is pending on your side.\n\n' +
          'Whenever you want to come back, you book here: https://www.rosanta.rest/reservations\n\nSee you soon.'
        : 'Tu reserva del ' + fecha + ' a las ' + d.hora + ' quedó cancelada. No queda nada pendiente de tu parte.\n\n' +
          'Cuando quieras volver, reservas aquí: https://www.rosanta.rest/reservas\n\nTe esperamos pronto.');
  } else {
    asunto = en ? 'Your table is confirmed' : 'Tu mesa queda confirmada';
    cuerpo = (nombre ? nombre + ',\n\n' : '') +
      (en
        ? 'Your table is confirmed.\n\nDate: ' + fecha + '\nTime: ' + d.hora + '\nGuests: ' + d.personas +
          '\n\nWe wait for you at Rosanta, Antigua Guatemala.\n\n' +
          'To change or cancel it, you reply on WhatsApp and it is done.'
        : 'Tu mesa queda confirmada.\n\nFecha: ' + fecha + '\nHora: ' + d.hora + '\nPersonas: ' + d.personas +
          '\n\nTe esperamos en Rosanta, Antigua Guatemala.\n\n' +
          'Para cambiarla o cancelarla, respondes por WhatsApp y se resuelve.');
    if (CORREO_SIN_CORREO_CLIENTE) {   // llegó por correo: se contesta en el hilo (plantilla revisada por marca, 17-oct-2026)
      cuerpo = (en ? 'Hi ' : 'Hola ') + (nombre || (en ? 'there' : '')) + ',\n\n' +
        (en
          ? 'Your table is confirmed:\n\nDate: ' + fecha + '\nTime: ' + d.hora + '\nGuests: ' + d.personas +
            '\n\nSee you in the garden.\n\nTo change or cancel it, just reply to this email.'
          : 'Tu mesa queda confirmada:\n\nFecha: ' + fecha + '\nHora: ' + d.hora + '\nPersonas: ' + d.personas +
            '\n\nTe esperamos en el jardín.\n\nPara cambiarla o cancelarla, responde a este correo.');
    }
  }

  // Canal de correo: no se manda aparte. Reserva creada, cambio y cancelación hechos en Wix se contestan en el
  // mismo hilo sin pasar por Juanma (decisiones de Juanma, 15 y 17-oct-2026); lo demás queda como borrador.
  if (CORREO_SIN_CORREO_CLIENTE) {
    if (caso === 'cambiada' || caso === 'cancelada' || caso === 'creada') CORREO_AUTO = { caso: caso, asunto: asunto, cuerpo: cuerpo + '\n\nRosanta\nAntigua Guatemala' };
    return;
  }

  try {
    MailApp.sendEmail({
      to: email,
      subject: asunto,
      body: cuerpo + '\n\nRosanta\nAntigua Guatemala',
      name: 'Rosanta'
    });
    Logger.log('rvCorreoCliente enviado (' + caso + ') a ...' + email.slice(-12));
  } catch (e) {
    Logger.log('rvCorreoCliente ' + caso + ': ' + e);
  }
}

/** Textos de cancelacion. Aparte de rvTexto para no tocar Reservas.gs. */
function rvTextoCancel(idioma, caso, d) {
  var en = idioma === 'en';
  var fechaBonita = d.fecha ? rvFechaBonita(d.fecha, en) : '';

  if (caso === 'cancelada') {
    return en
      ? 'Done. Your reservation for ' + fechaBonita + ' at ' + d.hora + ' is cancelled. Want another date? Tell me and I set it up.'
      : 'Listo. Tu reserva del ' + fechaBonita + ' a las ' + d.hora + ' queda cancelada. Si quieres otra fecha, dime y la dejamos lista.';
  }
  if (caso === 'cancel_correo') {
    return en
      ? 'What is the email you booked with? With that I find it and cancel it.'
      : '¿Cuál es el correo con el que reservaste? Con eso la ubico y la cancelo.';
  }
  if (caso === 'cancel_varias') {
    var ops = (d.opciones || []).map(function (o) {
      return rvFechaBonita(o.fecha, en) + ' ' + o.hora + ' (' + o.personas + ')';
    }).join('\n');
    return (en ? 'You have more than one active reservation:\n' : 'Tienes más de una reserva activa:\n') +
      ops + (en ? '\n\nWhich one do I cancel?' : '\n\n¿Cuál cancelo?');
  }
  if (caso === 'cancel_nada') {
    return en
      ? btConPromesa_("I can't find an active booking with those details.", 'en')
      : btConPromesa_('No encuentro una reserva activa con esos datos.', 'es');
  }
  return en
    ? btConPromesa_("I couldn't cancel it from here, so it's still active for now.", 'en')
    : btConPromesa_('No logré cancelarla desde aquí, así que por ahora sigue activa.', 'es');
}
/** "Tuesday, October 20" (formato de las cotizaciones en inglés). */
function rvFechaEn_(iso) {
  var p = String(iso).split('-');
  var d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
  return ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][d.getDay()] + ', ' +
    ['January','February','March','April','May','June','July','August','September','October','November','December'][d.getMonth()] + ' ' + d.getDate();
}
/** "19:30" -> "7:30 pm" */
function rvHora12_(h) {
  var m = String(h || '').match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return h;
  var hh = Number(m[1]), ap = hh >= 12 ? 'pm' : 'am';
  hh = hh % 12 || 12;
  return hh + ':' + m[2] + ' ' + ap;
}
