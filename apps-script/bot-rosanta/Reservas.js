/**
 * ROSANTA · BOT — CIERRE DE RESERVAS EN WIX
 * Archivo ADITIVO en el proyecto "Bot Rosanta". Prefijo rv en todo, para no
 * chocar con el scope global que Apps Script comparte entre archivos.
 *
 * QUE HACE: cuando Claude devuelve accion:"crear_reserva" con los datos
 * completos, llama al endpoint de Wix, crea la reserva de verdad y REEMPLAZA
 * la respuesta del bot por la confirmacion real. Si Wix no confirma, el bot
 * jamas dice que la reserva quedo hecha.
 *
 * NO toca Code.gs salvo tres lineas: las que envuelven askClaude (ver abajo).
 *
 * ANTES DE USAR, crear dos Propiedades del Script:
 *   WIX_RESERVAS_URL     https://www.rosanta.rest/_functions/reservaBot
 *   WIX_RESERVAS_SECRETO el mismo texto que guardaste en Wix como
 *                        BOT_RESERVAS_SECRETO
 *
 * COMO SE ENGANCHA (Code.gs, tres lugares, envolviendo la llamada que ya existe):
 *   linea ~129  const result = rvCerrar(askClaude('whatsapp', firstName, text, from), 'whatsapp', from);
 *   linea ~186  const result = rvCerrar(askClaude('instagram', (nombreIG||'').split(' ')[0]||'', text, senderId), 'instagram', senderId);
 *   linea ~262  const result = rvCerrar(askClaude('messenger', '', text, senderId), 'messenger', senderId);
 *
 * REGLAS DE NEGOCIO (decididas por Juanma, 6-sep-2026):
 *   - hasta 15 personas cierra el bot; mas que eso escala al equipo
 *   - confirma directo: la reserva queda RESERVED al instante
 *   - sin ventana minima: acepta reservas para dentro de una hora
 *   - siempre hay disponibilidad, salvo dias de evento privado: ese dia se
 *     cierra directamente en Wix y no devuelve ni una franja libre
 */

var RV_MAX_PERSONAS = 15;
var RV_MIN_ENTRE_INTENTOS = 3;   // minutos: evita crear dos veces la misma reserva

/** Envuelve el resultado de askClaude. Si no toca reservar, lo devuelve igual. */
function rvCerrar(result, canal, contactoId) {
  try {
    if (!result || !result.lead) return result; if (String(result.lead.accion || '') === 'cancelar_reserva') return rvCancelar(result, canal, contactoId);   // vive en Cancelar.gs

    // La fecha se revisa en cuanto aparece, sin esperar a tener los cinco datos.
    // Solo cuando el hilo va de reservar: si alguien menciona una fecha vieja
    // contando algo, no le corregimos nada.
    var fPre = rvFecha(result.lead.fecha);
    if (fPre && rvEsPasado(fPre) &&
        (String(result.lead.accion || '') === 'crear_reserva' || String(result.lead.tipo || '') === 'reserva')) {
      var dPre = { fecha: fPre, idioma: String(result.lead.idioma || 'es').toLowerCase().indexOf('en') === 0 ? 'en' : 'es' };
      Logger.log('rvCerrar: fecha en el pasado detectada de entrada. fecha=' + fPre);
      result.respuesta = rvTexto(dPre.idioma, 'FECHA_EN_PASADO', dPre);
      result.lead.accion = 'responder_info';
      result.lead.requiere_humano = false;
      rvHistoria(contactoId, result,
        'El sistema RECHAZO la fecha ' + fPre + ' porque ya paso, y le pidio al cliente otra fecha. ' +
        'NO se creo ninguna reserva. CONSERVA los demas datos que el cliente ya dio ' +
        '(nombre, correo, hora, personas) y NO se los vuelvas a pedir: cuando de la fecha nueva, ' +
        'completa la reserva con lo que ya tienes.');
      return result;
    }

    if (String(result.lead.accion || '') !== 'crear_reserva') return result;

    var d = rvDatos(result.lead, canal, contactoId);

    if (d.faltan.length) {                      // el modelo se adelanto: pedimos lo que falta
      Logger.log('rvCerrar: faltan datos ' + d.faltan.join(', ') + ' — no se crea nada.');
      result.respuesta = rvTexto(d.idioma, 'faltan', d);
      result.lead.accion = 'responder_info';
      result.lead.requiere_humano = false;
      return result;
    }

    if (d.personas > RV_MAX_PERSONAS) {
      result.respuesta = rvTexto(d.idioma, 'grupo', d);
      result.lead.accion = 'escalar_humano';
      result.lead.requiere_humano = true;
      return result;
    }

    if (rvYaIntentado(contactoId, d)) {          // mismo contacto, misma reserva, hace nada
      Logger.log('rvCerrar: intento repetido, se omite.');
      return result;
    }

    var r = rvLlamarWix(d);
    rvMarcarIntento(contactoId, d);

    if (r.ok) {
      result.respuesta = rvTexto(d.idioma, 'ok', d);
      result.lead.tipo = 'reserva';
      result.lead.urgencia = 'caliente';
      result.lead.requiere_humano = false;
      result.lead.resumen = 'Reserva creada en Wix: ' + d.fecha + ' ' + d.hora + ', ' + d.personas + ' personas';
      rvHistoria(contactoId, result,
        'La reserva SI quedo creada en Wix: ' + d.fecha + ' ' + d.hora + ', ' + d.personas +
        ' personas. Ya esta confirmada. NO la vuelvas a pedir ni a crear.');
      rvAvisar(d);
      return result;
    }

    if (r.motivo === 'sin_disponibilidad' && (r.alternativas || []).length) {
      d.alternativas = r.alternativas;
      result.respuesta = rvTexto(d.idioma, 'alternativas', d);
      result.lead.accion = 'responder_info';
      result.lead.requiere_humano = false;
      rvHistoria(contactoId, result,
        'Wix rechazo las ' + d.hora + ' del ' + d.fecha + '. NO se creo la reserva. Se le ofrecieron ' +
        'estas horas libres: ' + (r.alternativas || []).join(', ') + '. CONSERVA nombre, correo y ' +
        'personas: cuando elija hora, completa la reserva sin volver a pedir nada.');
      return result;
    }

    // Fecha imposible: no es falla del sistema, es un dato que hay que corregir.
    if (r.motivo === 'FECHA_EN_PASADO' || r.motivo === 'FECHA_INVALIDA') {
      Logger.log('rvCerrar: fecha rechazada. motivo=' + r.motivo + ' fecha=' + d.fecha);
      result.respuesta = rvTexto(d.idioma, r.motivo, d);
      result.lead.accion = 'responder_info';
      result.lead.requiere_humano = false;
      rvHistoria(contactoId, result,
        'El sistema RECHAZO la fecha ' + d.fecha + ' (' + r.motivo + '). NO se creo ninguna reserva. ' +
        'CONSERVA nombre, correo, hora y personas y NO se los vuelvas a pedir.');
      return result;
    }

    // Ni una sola franja libre en todo el dia: casi siempre es evento privado.
    // Se le dice al cliente, pero el equipo igual se entera por si Wix fallo.
    if (r.motivo === 'sin_disponibilidad' || r.motivo === 'FECHA_MUY_LEJANA') {
      Logger.log('rvCerrar: dia sin franjas. motivo=' + r.motivo + ' fecha=' + d.fecha);
      result.respuesta = rvTexto(d.idioma, r.motivo === 'FECHA_MUY_LEJANA' ? 'lejana' : 'cerrado', d);
      result.lead.accion = 'escalar_humano';
      result.lead.requiere_humano = true;
      rvHistoria(contactoId, result,
        'El ' + d.fecha + ' no hay ni una franja libre (' + r.motivo + '). NO se creo la reserva y ya ' +
        'se aviso al equipo. CONSERVA los datos que el cliente dio y NO se los vuelvas a pedir.');
      return result;
    }

    // Cualquier otro fallo: no mentimos, pasamos al equipo.
    Logger.log('rvCerrar: Wix no confirmo. motivo=' + r.motivo + ' detalle=' + (r.detalle || ''));
    result.respuesta = rvTexto(d.idioma, 'error', d);
    result.lead.accion = 'escalar_humano';
    result.lead.requiere_humano = true;
    rvHistoria(contactoId, result,
      'Wix fallo (' + r.motivo + '). NO se creo la reserva y ya se aviso al equipo. CONSERVA los datos ' +
      'que el cliente dio y NO se los vuelvas a pedir.');
    return result;

  } catch (err) {
    // Una falla aqui nunca debe tumbar la respuesta del bot.
    Logger.log('rvCerrar excepcion: ' + err);
    return result;
  }
}

/** Normaliza y valida lo que Claude extrajo de la conversacion. */
function rvDatos(lead, canal, contactoId) {
  var d = {
    nombre:   String(lead.nombre || '').trim(),
    email:    String(lead.email || '').trim().toLowerCase(),
    fecha:    rvFecha(lead.fecha),
    hora:     rvHora(lead.hora),
    personas: parseInt(lead.personas, 10) || 0,
    idioma:   String(lead.idioma || 'es').toLowerCase().indexOf('en') === 0 ? 'en' : 'es',
    canal:    canal,
    telefono: String(lead.telefono || '').replace(/\D/g, '')
  };
  // En WhatsApp el numero del remitente ES el telefono. En IG/Messenger no.
  if (canal === 'whatsapp' && !d.telefono) d.telefono = String(contactoId || '').replace(/\D/g, '');

  d.faltan = [];
  if (!d.nombre)              d.faltan.push('nombre');
  if (!d.email)               d.faltan.push('correo');
  if (!d.fecha)               d.faltan.push('fecha');
  if (!d.hora)                d.faltan.push('hora');
  if (!d.personas)            d.faltan.push('personas');
  if (d.telefono.length < 8)  d.faltan.push('telefono');
  return d;
}

/** Acepta 2026-09-12, 12/09/2026 o 12.09.2026. Devuelve YYYY-MM-DD o cadena vacia. */
function rvFecha(v) {
  var s = String(v || '').trim();
  var m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return s;
  m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (m) return m[3] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2);
  return '';
}

/** Acepta 20:00, 8:00 pm, 8pm. Devuelve HH:mm en 24h o cadena vacia. */
function rvHora(v) {
  var s = String(v || '').trim().toLowerCase().replace(/\s+/g, '');
  var m = s.match(/^(\d{1,2}):?(\d{2})?(am|pm)?$/);
  if (!m) return '';
  var h = parseInt(m[1], 10), min = m[2] ? parseInt(m[2], 10) : 0;
  if (m[3] === 'pm' && h < 12) h += 12;
  if (m[3] === 'am' && h === 12) h = 0;
  if (h > 23 || min > 59) return '';
  return ('0' + h).slice(-2) + ':' + ('0' + min).slice(-2);
}

function rvLlamarWix(d) {
  var p = PropertiesService.getScriptProperties();
  var url = p.getProperty('WIX_RESERVAS_URL');
  var sec = p.getProperty('WIX_RESERVAS_SECRETO');
  if (!url || !sec) return { ok: false, motivo: 'sin_configurar' };

  var partes = d.nombre.split(/\s+/);
  var payload = {
    secreto: sec,
    nombre: partes[0],
    apellido: partes.slice(1).join(' '),
    email: d.email,
    telefono: d.telefono,
    fecha: d.fecha,
    hora: d.hora,
    personas: d.personas,
    optin: 'SI',                       // escribio al restaurante por su cuenta
    canal: d.canal
  };
  try {
    var res = UrlFetchApp.fetch(url, {
      method: 'post', contentType: 'application/json',
      payload: JSON.stringify(payload), muteHttpExceptions: true
    });
    var body = JSON.parse(res.getContentText() || '{}');
    var code = res.getResponseCode();
    // Wix manda un motivo util incluso en 400 (FECHA_EN_PASADO, etc). No lo tiramos.
    if (code !== 200) return { ok: false, motivo: body.motivo || ('http_' + code), detalle: res.getContentText().slice(0, 200) };
    return body;
  } catch (e) {
    return { ok: false, motivo: 'excepcion', detalle: String(e) };
  }
}

/** Textos al cliente. Afirmativos, cortos, en su idioma. */
function rvTexto(idioma, caso, d) {
  var en = idioma === 'en';
  var fechaBonita = rvFechaBonita(d.fecha, en);

  if (caso === 'ok') {
    return en
      ? 'All set, ' + d.nombre + ' 🌿\n\n📅 ' + fechaBonita + '\n🕗 ' + d.hora + '\n👥 ' + d.personas +
        '\n\nYour table is confirmed. The confirmation email goes to ' + d.email + '.'
      : 'Listo, ' + d.nombre + ' 🌿\n\n📅 ' + fechaBonita + '\n🕗 ' + d.hora + '\n👥 ' + d.personas +
        '\n\nTu mesa queda confirmada. Te llega el correo de confirmación a ' + d.email + '.';
  }
  if (caso === 'alternativas') {
    var lista = (d.alternativas || []).join(' · ');
    return en
      ? 'That time is taken. These are open on ' + fechaBonita + ': ' + lista +
        '\n\nWhich one works for you?'
      : 'Esa hora ya está tomada. Estas quedan libres el ' + fechaBonita + ': ' + lista +
        '\n\n¿Cuál te sirve?';
  }
  if (caso === 'faltan') {
    var etiquetas = { nombre:['*Tu nombre:*','*Your name:*'], correo:['*Correo:*','*Email:*'],
                      fecha:['*Fecha:*','*Date:*'], hora:['*Hora:*','*Time:*'],
                      personas:['*Personas:*','*People:*'], telefono:['*Teléfono:*','*Phone:*'] };
    var pide = d.faltan.map(function (k) { return (etiquetas[k] || [k, k])[en ? 1 : 0]; }).join('\n');
    return (en ? 'To lock in your table I just need:\n\n' : 'Para dejar tu mesa lista me falta:\n\n') + pide;
  }
  if (caso === 'FECHA_EN_PASADO') {
    return en
      ? fechaBonita + ' already passed. Which date do you want?'
      : 'El ' + fechaBonita + ' ya pasó. ¿Qué fecha quieres?';
  }
  if (caso === 'FECHA_INVALIDA') {
    return en
      ? 'That date does not add up. Send it as day/month/year, for example 13/10/2026.'
      : 'Esa fecha no me cuadra. Mándala como día/mes/año, por ejemplo 13/10/2026.';
  }
  if (caso === 'cerrado') {
    return en
      ? 'The restaurant is not taking reservations on ' + fechaBonita + '. Usually it is a private event. Which other date works?'
      : 'El ' + fechaBonita + ' el restaurante no está tomando reservas. Suele ser por un evento privado. ¿Qué otra fecha te sirve?';
  }
  if (caso === 'lejana') {
    return en
      ? 'That date is beyond what the system opens. Someone from the team takes care of it 🙌'
      : 'Esa fecha va más allá de lo que el sistema abre. Alguien del equipo lo ve 🙌';
  }
  if (caso === 'grupo') {
    return en
      ? 'For ' + d.personas + ' people someone from the team takes care of it directly. They write to you shortly 🙌'
      : 'Para ' + d.personas + ' personas lo ve alguien del equipo directamente. Te escriben en breve 🙌';
  }
  return en
    ? 'I could not complete the booking in the system. Someone from the team writes to you to confirm 🙌'
    : 'No pude cerrar la reserva en el sistema. Alguien del equipo te escribe para confirmarte 🙌';
}

function rvFechaBonita(iso, en) {
  var p = String(iso).split('-');
  var d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
  var dias = en ? ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
                : ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
  var mes  = en ? ['January','February','March','April','May','June','July','August','September','October','November','December']
                : ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  return dias[d.getDay()] + ' ' + d.getDate() + ' ' + (en ? '' : 'de ') + mes[d.getMonth()];
}

/** Evita crear dos veces la misma reserva si el modelo repite la accion. */
function rvClave(contactoId, d) {
  return 'rv_' + String(contactoId).replace(/\D/g, '') + '_' + d.fecha + '_' + d.hora + '_' + d.personas;
}
function rvYaIntentado(contactoId, d) {
  var v = PropertiesService.getScriptProperties().getProperty(rvClave(contactoId, d));
  if (!v) return false;
  return (Date.now() - Number(v)) < RV_MIN_ENTRE_INTENTOS * 60000;
}
function rvMarcarIntento(contactoId, d) {
  PropertiesService.getScriptProperties().setProperty(rvClave(contactoId, d), String(Date.now()));
}

/** Hoy en Guatemala, en AAAA-MM-DD. Comparar cadenas basta en ese formato. */
function rvEsPasado(iso) {
  return String(iso) < Utilities.formatDate(new Date(), 'America/Guatemala', 'yyyy-MM-dd');
}

/**
 * Deja el historial contando la verdad.
 *
 * askClaude guarda en cache la respuesta del MODELO antes de que rvCerrar la
 * reemplace. Sin esto el modelo cree que ya confirmo la mesa, nunca se entera
 * de que el sistema rechazo la fecha, y en el turno siguiente vuelve a pedir
 * datos que el cliente ya dio. La nota le dice que paso de verdad.
 */
function rvHistoria(contactoId, result, nota) {
  try {
    var k = 'hist_' + String(contactoId);
    var c = CacheService.getScriptCache();
    var raw = c.get(k);
    if (!raw) return;
    var hist = JSON.parse(raw);
    if (!hist.length || hist[hist.length - 1].role !== 'assistant') return;
    var j;
    try { j = JSON.parse(hist[hist.length - 1].content); } catch (e) { j = {}; }
    j.respuesta = result.respuesta;          // lo que el cliente vio de verdad
    j.lead = result.lead;
    j.nota_sistema = nota;                   // lo que el sistema hizo de verdad
    hist[hist.length - 1].content = JSON.stringify(j);
    c.put(k, JSON.stringify(hist), 1800);    // mismo TTL que saveHistory
  } catch (e) { Logger.log('rvHistoria: ' + e); }
}

/** Aviso al equipo cuando el bot cierra una reserva. No es escalamiento: es para enterarse. */
function rvAvisar(d) {
  var texto = '✅ Reserva nueva (bot ' + (d.canal || '') + ')\n' +
    d.nombre + ' · ' + d.personas + ' personas\n' +
    rvFechaBonita(d.fecha, false) + ' · ' + d.hora + '\n' +
    'Tel ' + d.telefono + (d.email ? ' · ' + d.email : '');
  var p = PropertiesService.getScriptProperties();
  try {
    var owner = p.getProperty('OWNER_WA');
    var pid = p.getProperty('WA_PHONE_NUMBER_ID');
    if (owner && pid) sendWhatsApp(pid, owner, texto);
    else Logger.log('rvAvisar: falta OWNER_WA o WA_PHONE_NUMBER_ID, solo sale el correo.');
  } catch (e) { Logger.log('rvAvisar WhatsApp: ' + e); }
  try {
    MailApp.sendEmail({
      to: 'restaurante@rosanta.rest',
      subject: 'Reserva nueva por el bot - ' + d.fecha + ' ' + d.hora + ' - ' + d.personas + 'p',
      body: texto
    });
  } catch (e) { Logger.log('rvAvisar correo: ' + e); }
  rvCorreoCliente(d, 'creada');   // vive en Cancelar.gs
}

/** Prueba de punta a punta SIN pasar por Claude. Cambia los datos y corre. */
function rvProbar() {
  var falso = {
    respuesta: 'Dame un segundo.',
    lead: { accion: 'crear_reserva', idioma: 'es', nombre: 'Prueba Bot',
            email: 'restaurante@rosanta.rest', fecha: '', hora: '20:00', personas: 2 }
  };
  var hoy = new Date();
  falso.lead.fecha = Utilities.formatDate(hoy, 'America/Guatemala', 'yyyy-MM-dd');
  var r = rvCerrar(falso, 'whatsapp', '50230795252');
  Logger.log('RESPUESTA AL CLIENTE:\n' + r.respuesta + '\n\nLEAD: ' + JSON.stringify(r.lead));
  return r.respuesta;
}