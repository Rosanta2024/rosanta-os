/**
 * ROSANTA · BOT — CONSULTAR UNA RESERVA (16-oct-2026)
 * "¿A qué hora era mi reserva?". SOLO LEE: no cambia ni cancela nada.
 * Antes el modelo lo mandaba a cancelar_reserva (Carolina, 10-oct) y pasaba a Juanma.
 * Endpoint: POST /_functions/consultarBot   (mismo secreto que reservaBot)
 */

function rvUrlConsultar() {
  var p = PropertiesService.getScriptProperties();
  var u = p.getProperty('WIX_CONSULTAR_URL');
  if (u) return u;
  var base = p.getProperty('WIX_RESERVAS_URL') || '';
  return base ? base.replace(/\/[^\/]*$/, '/consultarBot') : '';
}

function rvLlamarConsultar(d) {
  var url = rvUrlConsultar();
  var sec = PropertiesService.getScriptProperties().getProperty('WIX_RESERVAS_SECRETO');
  if (!url || !sec) return { ok: false, motivo: 'sin_configurar' };
  try {
    var res = UrlFetchApp.fetch(url, {
      method: 'post', contentType: 'application/json',
      payload: JSON.stringify({ secreto: sec, telefono: d.telefono, email: d.email, fecha: d.fecha }),
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

function rvConsultar(result, canal, contactoId) {
  var d = {
    email:    String(result.lead.email || '').trim().toLowerCase(),
    fecha:    rvFecha(result.lead.fecha),
    telefono: String(result.lead.telefono || '').replace(/\D/g, ''),
    idioma:   String(result.lead.idioma || 'es').toLowerCase().indexOf('en') === 0 ? 'en' : 'es'
  };
  if (canal === 'whatsapp' && !d.telefono) d.telefono = String(contactoId || '').replace(/\D/g, '');
  // Por correo, la direccion de quien escribe identifica la reserva, como el numero en WhatsApp (19-oct-2026, Louise).
  if (canal === 'correo' && !d.email && /@/.test(String(contactoId || ''))) d.email = String(contactoId).trim().toLowerCase();
  result.lead.tipo = 'reserva';
  result.lead.accion = 'responder_info';
  result.lead.requiere_humano = false;

  if (!d.telefono && !d.email) {
    result.respuesta = rvTextoConsulta(d.idioma, 'correo', d);
    return result;
  }

  var r = rvLlamarConsultar(d);

  if (r.ok && r.reservas && r.reservas.length) {
    d.reservas = r.reservas;
    d.nombre = r.nombre || '';
    result.respuesta = rvTextoConsulta(d.idioma, 'ok', d);
    result.lead.resumen = 'Consultó su reserva: ' + r.reservas.map(function (x) {
      return x.fecha + ' ' + x.hora + ' (' + x.personas + ')';
    }).join(', ');
    rvHistoria(contactoId, result, 'Se le dijo al cliente su reserva vigente: ' + result.lead.resumen.replace('Consultó su reserva: ', '') +
      '. NO se cambió ni se canceló nada.');
    return result;
  }

  if (r.motivo === 'NO_ENCONTRADA' || r.motivo === 'SIN_COINCIDENCIA') {
    if (!d.email) {
      result.respuesta = rvTextoConsulta(d.idioma, 'correo', d);
      rvHistoria(contactoId, result, 'No se encontró reserva con el teléfono. Se pidió el correo con el que reservó. ' +
        'Cuando lo dé, vuelve a marcar accion:"consultar_reserva".');
      return result;
    }
    result.respuesta = rvTextoConsulta(d.idioma, 'nada', d);
    result.lead.resumen = 'Consultó su reserva y no apareció (ni por teléfono ni por correo)';
    rvHistoria(contactoId, result, 'No apareció ninguna reserva activa ni por teléfono ni por correo. Se le ofreció hacer una nueva.');
    return result;
  }

  Logger.log('rvConsultar: falló. motivo=' + r.motivo + ' detalle=' + (r.detalle || ''));
  result.respuesta = rvTextoConsulta(d.idioma, 'error', d);
  result.lead.accion = 'escalar_humano';
  result.lead.requiere_humano = true;
  result.lead.resumen = 'Consultó su reserva y falló el sistema (' + r.motivo + ')';
  return result;
}

function rvTextoConsulta(idioma, caso, d) {
  var en = idioma === 'en';
  if (caso === 'ok') {
    var lineas = d.reservas.map(function (x) {
      return '📅 ' + rvFechaBonita(x.fecha, en) + ' 🕗 ' + x.hora + ' 👥 ' + x.personas;
    });
    if (lineas.length === 1) {
      return (en ? 'Here it is:\n' : 'Aquí está:\n') + lineas[0] +
        (en ? '\n\nNeed to change anything? Just tell me.' : '\n\n¿Quieres cambiar algo? Dime y lo vemos.');
    }
    return (en ? 'You have these reservations:\n' : 'Tienes estas reservas:\n') + lineas.join('\n') +
      (en ? '\n\nNeed to change any of them? Just tell me.' : '\n\n¿Quieres cambiar alguna? Dime y lo vemos.');
  }
  if (caso === 'correo') {
    return en
      ? 'What email did you book with? I\'ll look it up.'
      : '¿Con qué correo hiciste la reserva? Con eso la busco.';
  }
  if (caso === 'nada') {
    return en
      ? "I can't find an active reservation with those details. Did you book with a different email or phone? If not, I can book one for you now."
      : 'No encuentro una reserva activa con esos datos. ¿La hiciste con otro correo o teléfono? Si no, te hago una de una vez.';
  }
  return en
    ? btConPromesa_("I couldn't look it up from here.", 'en')
    : btConPromesa_('No logré buscarla desde aquí.', 'es');
}
