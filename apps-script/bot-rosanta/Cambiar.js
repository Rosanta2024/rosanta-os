/**
 * ROSANTA · BOT — CAMBIO DE RESERVA EN UN PASO (15-oct-2026)
 * Archivo ADITIVO. Prefijo rv, como Reservas.js y Cancelar.js.
 *
 * Antes: el bot cancelaba y después creaba; si la hora nueva no tenía lugar, el
 * cliente perdía su mesa. Ahora llama a /_functions/cambiarBot, que revisa lugar,
 * crea la nueva y recién entonces cancela la vieja. Si no hay lugar, no toca nada.
 */

var RV_SILENCIO = false;   // solo la prueba lo pone en true: sin avisos ni correos

function rvUrlCambiar() {
  var p = PropertiesService.getScriptProperties();
  var base = p.getProperty('WIX_RESERVAS_URL') || '';
  return base ? base.replace(/\/[^\/]*$/, '/cambiarBot') : '';
}

function rvLlamarCambiar(d) {
  var url = rvUrlCambiar();
  var sec = PropertiesService.getScriptProperties().getProperty('WIX_RESERVAS_SECRETO');
  if (!url || !sec) return { ok: false, motivo: 'sin_configurar' };
  try {
    var res = UrlFetchApp.fetch(url, {
      method: 'post', contentType: 'application/json', muteHttpExceptions: true,
      payload: JSON.stringify({ secreto: sec, telefono: d.telefono, email: d.email, fecha_actual: d.fecha_actual, hora_actual: d.hora_actual,
        fecha: d.fecha, hora: d.hora, personas: d.personas || '', canal: d.canal })
    });
    var body = JSON.parse(res.getContentText() || '{}');
    if (res.getResponseCode() !== 200) return { ok: false, motivo: body.motivo || ('http_' + res.getResponseCode()), antes: body.antes };
    return body;
  } catch (e) {
    return { ok: false, motivo: 'excepcion', detalle: String(e) };
  }
}

function rvCambiar(result, canal, contactoId) {
  var lead = result.lead;
  var d = {
    email: String(lead.email || '').trim().toLowerCase(),
    telefono: String(lead.telefono || '').replace(/\D/g, ''),
    fecha_actual: rvFecha(lead.fecha_actual),
    hora_actual: rvHora(lead.hora_actual),
    fecha: rvFecha(lead.fecha),
    hora: rvHora(lead.hora),
    personas: parseInt(lead.personas, 10) || 0,
    idioma: String(lead.idioma || 'es').toLowerCase().indexOf('en') === 0 ? 'en' : 'es',
    canal: canal
  };
  if (canal === 'whatsapp' && !d.telefono) d.telefono = String(contactoId || '').replace(/\D/g, '');
  // Por correo, la direccion de quien escribe identifica la reserva, como el numero en WhatsApp (19-oct-2026, Louise).
  if (canal === 'correo' && !d.email && /@/.test(String(contactoId || ''))) d.email = String(contactoId).trim().toLowerCase();
  result.lead.accion = 'responder_info';
  result.lead.requiere_humano = false;

  if (!d.telefono && !d.email) {
    result.respuesta = rvTextoCambio(d.idioma, 'correo', d);
    return result;
  }
  if (!d.fecha && !d.hora && !d.personas) {
    result.respuesta = rvTextoCambio(d.idioma, 'que', d);
    return result;
  }
  if (d.fecha && rvEsPasado(d.fecha)) {
    result.respuesta = rvTexto(d.idioma, 'FECHA_EN_PASADO', d);
    return result;
  }

  var r = rvLlamarCambiar(d);
  d.antes = r.antes || null;

  if (r.ok) {
    d.ahora = r.ahora; d.nombre = r.nombre || ''; d.email = r.email || d.email;
    result.respuesta = rvTextoCambio(d.idioma, 'ok', d);
    result.lead.tipo = 'reserva';
    result.lead.resumen = 'Reserva CAMBIADA por el bot: ' + r.antes.fecha + ' ' + r.antes.hora + ' → ' +
      r.ahora.fecha + ' ' + r.ahora.hora + ', ' + r.ahora.personas + ' personas' +
      (r.vieja_cancelada ? '' : ' (OJO: la vieja no se pudo cancelar: ' + (r.error_cancelar || '?') + ')');
    if (!r.vieja_cancelada) result.lead.requiere_humano = true;
    rvHistoria(contactoId, result, 'La reserva SÍ quedó cambiada en el sistema: ahora es ' + r.ahora.fecha + ' ' +
      r.ahora.hora + ', ' + r.ahora.personas + ' personas. La anterior (' + r.antes.fecha + ' ' + r.antes.hora +
      ') ya no existe. NO la vuelvas a cambiar ni a crear.');
    rvAvisarCambio(d, canal, r);
    rvCorreoCliente({ email: d.email, idioma: d.idioma, nombre: d.nombre, antes: r.antes, ahora: r.ahora,
      reemplazada: r.modo === 'reemplazada' }, 'cambiada');
    return result;
  }

  if (r.motivo === 'VARIAS') {
    d.opciones = r.opciones || [];
    result.respuesta = rvTextoCambio(d.idioma, 'varias', d);
    rvHistoria(contactoId, result, 'El cliente tiene ' + (r.cuantas || 0) + ' reservas activas; se le preguntó cuál cambiar ' +
      '(cuando conteste, pon su fecha en fecha_actual y su hora en hora_actual). NO se cambió nada todavía.');
    return result;
  }
  if (r.motivo === 'sin_disponibilidad' || r.motivo === 'sin_disponibilidad_dia') {
    d.alternativas = r.alternativas || [];
    result.respuesta = rvTextoCambio(d.idioma, d.alternativas.length ? 'alternativas' : 'lleno', d);
    rvHistoria(contactoId, result, 'NO hubo lugar para el cambio pedido. La reserva actual (' +
      (r.antes ? r.antes.fecha + ' ' + r.antes.hora : '') + ') SIGUE IGUAL. ' +
      (d.alternativas.length ? 'Se ofrecieron estas horas: ' + d.alternativas.join(', ') + '.' : ''));
    return result;
  }
  if (r.motivo === 'SIN_CAMBIOS') {
    result.respuesta = rvTextoCambio(d.idioma, 'igual', d);
    return result;
  }
  if (r.motivo === 'FECHA_EN_PASADO' || r.motivo === 'FECHA_INVALIDA') {
    result.respuesta = rvTexto(d.idioma, r.motivo, d);
    return result;
  }
  if (r.motivo === 'grupo_grande') {
    result.respuesta = rvTexto(d.idioma, 'grupo', d);
    result.lead.accion = 'escalar_humano';
    result.lead.requiere_humano = true;
    return result;
  }
  if (r.motivo === 'NO_ENCONTRADA' || r.motivo === 'SIN_COINCIDENCIA') {
    if (!d.email) {
      result.respuesta = rvTextoCambio(d.idioma, 'correo', d);
      rvHistoria(contactoId, result, 'No se encontró reserva con el teléfono. Se pidió el correo con el que reservó. ' +
        'Cuando lo dé, vuelve a marcar accion:"cambiar_reserva" con los mismos datos nuevos.');
      return result;
    }
    result.respuesta = rvTextoCancel(d.idioma, 'cancel_nada', d);
    result.lead.accion = 'escalar_humano';
    result.lead.requiere_humano = true;
    return result;
  }
  Logger.log('rvCambiar: falló. motivo=' + r.motivo + ' detalle=' + (r.detalle || ''));
  result.respuesta = rvTextoCambio(d.idioma, 'error', d);
  result.lead.accion = 'escalar_humano';
  result.lead.requiere_humano = true;
  rvHistoria(contactoId, result, 'Falló el sistema al cambiar (' + r.motivo + '). La reserva actual sigue igual y ya se avisó al restaurante.');
  return result;
}

function rvTextoCambio(idioma, caso, d) {
  var en = idioma === 'en';
  if (caso === 'ok') {
    var a = d.ahora;
    return en
      ? 'Done, your table is moved 🌿\n\n📅 ' + rvFechaBonita(a.fecha, true) + '\n🕗 ' + a.hora + '\n👥 ' + a.personas +
        '\n\nThe new confirmation goes to ' + d.email + '.'
      : 'Listo, tu mesa quedó cambiada 🌿\n\n📅 ' + rvFechaBonita(a.fecha, false) + '\n🕗 ' + a.hora + '\n👥 ' + a.personas +
        '\n\nTe llega la nueva confirmación a ' + d.email + '.';
  }
  if (caso === 'alternativas') {
    var dia = d.fecha || (d.antes && d.antes.fecha) || '';
    return en
      ? 'That time is taken on ' + rvFechaBonita(dia, true) + '. Your current booking stays as it is. These are open: ' +
        d.alternativas.join(' · ') + '\n\nWhich one works for you?'
      : 'Esa hora ya está tomada el ' + rvFechaBonita(dia, false) + '. Tu reserva actual sigue igual. Quedan libres: ' +
        d.alternativas.join(' · ') + '\n\n¿Cuál te sirve?';
  }
  if (caso === 'lleno') {
    return en
      ? "There's no table at that time or later that day. Your current booking stays as it is. Want to try another time or date?"
      : 'Ese día no hay mesa a esa hora ni más tarde. Tu reserva actual sigue igual. ¿Probamos otra hora u otra fecha?';
  }
  if (caso === 'varias') {
    var ops = (d.opciones || []).map(function (o) { return rvFechaBonita(o.fecha, en) + ' ' + o.hora + ' (' + o.personas + ')'; }).join('\n');
    return (en ? 'You have more than one booking:\n' : 'Tienes más de una reserva:\n') + ops +
      (en ? '\n\nWhich one do I change?' : '\n\n¿Cuál cambio?');
  }
  if (caso === 'correo') {
    return en ? 'What email did you book with? With that I find it and change it.'
              : '¿Con qué correo reservaste? Con eso la ubico y la cambio.';
  }
  if (caso === 'que') {
    return en ? 'Sure. What do you want to change: the date, the time or the number of people?'
              : 'Claro. ¿Qué quieres cambiar: la fecha, la hora o el número de personas?';
  }
  if (caso === 'igual') {
    return en ? 'Your booking already has those details, nothing to change 🙌'
              : 'Tu reserva ya tiene esos datos, no hay nada que cambiar 🙌';
  }
  return en
    ? btConPromesa_("I couldn't change it from here, so your current booking stays as it is.", 'en')
    : btConPromesa_('No logré cambiarla desde aquí, así que tu reserva actual sigue igual.', 'es');
}

function rvAvisarCambio(d, canal, r) {
  if (RV_SILENCIO) return;
  var texto = '🔁 Reserva CAMBIADA (bot ' + (canal || '') + ')\n' + (d.nombre || '') + '\n' +
    'Antes: ' + rvFechaBonita(r.antes.fecha, false) + ' · ' + r.antes.hora + ' · ' + r.antes.personas + 'p\n' +
    'Ahora: ' + rvFechaBonita(r.ahora.fecha, false) + ' · ' + r.ahora.hora + ' · ' + r.ahora.personas + 'p\n' +
    'Tel ' + d.telefono + (d.email ? ' · ' + d.email : '') +
    (r.vieja_cancelada ? '' : '\n⚠️ La reserva vieja NO se pudo cancelar: cancélala a mano en Wix.');
  var p = PropertiesService.getScriptProperties();
  try {
    var owner = p.getProperty('OWNER_WA'), pid = p.getProperty('WA_PHONE_NUMBER_ID');
    if (owner && pid) sendWhatsApp(pid, owner, texto);
  } catch (e) { Logger.log('rvAvisarCambio WhatsApp: ' + e); }
  try {
    MailApp.sendEmail({ to: 'restaurante@rosanta.rest',
      subject: 'Reserva CAMBIADA por el bot - ' + r.ahora.fecha + ' ' + r.ahora.hora, body: texto });
  } catch (e) { Logger.log('rvAvisarCambio correo: ' + e); }
}
