/**
 * ROSANTA · BOT — BOTONES, PASO A PERSONA Y FICHA DEL CLIENTE
 * Archivo ADITIVO (15-oct-2026). Prefijo bt / ficha en todo: Apps Script comparte
 * un solo scope global entre archivos.
 *
 * Decisiones de Juanma (15-oct-2026):
 *   - Botones: Reservar mesa · Ver menú · Evento privado · Hablar con alguien, en el
 *     primer mensaje y cuando el bot no sabe qué sigue. El texto libre sigue igual.
 *   - Juanma es la única persona que atiende el chat. Horario 9:00–21:00 todos los
 *     días. Promesa (19-oct-2026, Juanma: el bot NUNCA dice su nombre, es UNA sola frase y NO promete plazo):
 *     "Alguien del restaurante se pondrá en contacto contigo lo antes posible."
 *
 * Límites de Meta (documentación oficial, 15-oct-2026):
 *   WhatsApp: 3 reply buttons (título 20) o lista de 10 filas (título 24, botón 20);
 *             cuerpo 1024 con botones, 4096 con lista.
 *   Instagram y Messenger: 13 quick replies, título 20.
 *
 * Llave de encendido (Propiedades del script):
 *   BOTONES_MODO      'todos' = todos los clientes · 'prueba' = solo BOTONES_SOLO_PARA ·
 *                     cualquier otro valor o vacío = apagado (el bot se comporta como antes)
 *   BOTONES_SOLO_PARA ids separados por coma (número de WhatsApp, IGSID, PSID)
 *   BOTONES_CLAVE     palabra secreta: en modo prueba, mandarla desde un chat lo agrega
 *                     a BOTONES_SOLO_PARA (así Juanma registra su IG y su Messenger)
 */

var BT_TZ = 'America/Guatemala';
var BT_HORA_ABRE = 9;
var BT_HORA_CIERRA = 21;
// Desde el 19-oct-2026 al cliente se le dice UNA sola frase sin plazo; los tramos solo arman el plazo de ayuda del aviso a Juanma.
var BT_HORA_PROMESA_HASTA = 20;
var BT_MENU_URL = {
  es: 'https://www.rosanta.rest/men%C3%BA-espa%C3%B1ol',
  en: 'https://www.rosanta.rest/english-menu'
};

// Textos que ve el cliente. Revisados por revisor-marca (15-oct-2026).
var BT_TXT = {
  es: {
    reservar: 'Reservar mesa',
    menu: 'Ver menú',
    evento: 'Evento privado',
    humano: 'Hablar con alguien',
    lista: 'Elegir opción',
    pideReservar: 'Quiero reservar una mesa',
    pideEvento: 'Quiero cotizar un evento privado',
    pideMenu: 'Quiero ver el menú',
    pideHumano: 'Quiero hablar con alguien',
    respMenu: function () {
      return 'Aquí está la carta de temporada 🌿\n' + BT_MENU_URL.es + '\n\n¿Te ayudo con una mesa?';
    },
    respHumano: function (promesa) { return 'Listo. ' + promesa + ' Si quieres, adelántame qué necesitas.'; },
    // Frase de paso a persona definida por Juanma (19-oct-2026): UNA sola para todos los casos, sin plazo, con "contigo".
    promesaYa: 'Alguien del restaurante se pondrá en contacto contigo lo antes posible.',
    promesaManana: 'Alguien del restaurante se pondrá en contacto contigo lo antes posible.',
    promesaHoy: 'Alguien del restaurante se pondrá en contacto contigo lo antes posible.',
    fotoRecibida: 'Recibimos tu foto. Alguien del restaurante la revisa lo antes posible.',   // @65 (Juanma, 20-oct-2026)
    pruebaOk: 'Modo prueba de botones activado para este chat.'
  },
  en: {
    reservar: 'Book a table',
    menu: 'See the menu',
    evento: 'Private event',
    humano: 'Talk to someone',
    lista: 'Choose an option',
    pideReservar: "I'd like to book a table",
    pideEvento: "I'd like a quote for a private event",
    pideMenu: "I'd like to see the menu",
    pideHumano: "I'd like to talk to someone",
    respMenu: function () {
      return "Here's the seasonal menu 🌿\n" + BT_MENU_URL.en + '\n\nWant me to save you a table?';
    },
    respHumano: function (promesa) { return 'Got it. ' + promesa + ' Feel free to tell me what you need in the meantime.'; },
    promesaYa: 'Someone from the restaurant will get in touch with you as soon as possible.',
    promesaManana: 'Someone from the restaurant will get in touch with you as soon as possible.',
    promesaHoy: 'Someone from the restaurant will get in touch with you as soon as possible.',
    fotoRecibida: 'We got your photo. Someone from the restaurant will review it as soon as possible.',
    pruebaOk: 'Button test mode is on for this chat.'
  }
};

// Botones del evento privado (revisor-marca, 15-oct-2026, contra PRECIOS.md Lista 2027).
var BT_EVENTO = {
  es: { presupuesto: '¿Cuánto tienes en mente por persona, con bebidas incluidas? Así te propongo el menú que mejor te calce.',
        rangos: ['Hasta Q400', 'Q400 a Q550', 'Más de Q550', 'Aún no lo sé'],
        formatos: ['Servido', 'Para compartir', 'Tapas y barra libre'] },
  en: { presupuesto: 'What budget per person do you have in mind, drinks included? (Q7 is about US$1.) It helps me suggest the right menu.',
        rangos: ['Up to Q400', 'Q400 to Q550', 'Over Q550', 'Not sure yet'],
        formatos: ['Plated', 'Family style', 'Tapas & open bar'] }
};

function btIdioma_(v) {
  return String(v || 'es').toLowerCase().indexOf('en') === 0 ? 'en' : 'es';
}

/** Idioma de la última respuesta del bot a este contacto (para los textos de respaldo). */
function btIdiomaHistoria_(contactoId) {
  try {
    var h = getHistory(contactoId);
    for (var i = h.length - 1; i >= 0; i--) {
      if (h[i].role !== 'assistant') continue;
      var j = JSON.parse(h[i].content);
      if (j && j.lead && j.lead.idioma) return btIdioma_(j.lead.idioma);
    }
  } catch (e) {}
  return 'es';
}

// ============================================================
//  PASO A PERSONA — plazo y horario
// ============================================================
function btHoraGt_(ahora) {
  var d = ahora || new Date();
  return { h: Number(Utilities.formatDate(d, BT_TZ, 'H')), m: Number(Utilities.formatDate(d, BT_TZ, 'm')) };
}

/** 'ya' (9:00–19:59) · 'manana' (20:00–23:59) · 'hoy' (0:00–8:59) */
function btTramo_(ahora) {
  var h = btHoraGt_(ahora).h;
  if (h >= BT_HORA_ABRE && h < BT_HORA_PROMESA_HASTA) return 'ya';
  return h >= BT_HORA_PROMESA_HASTA ? 'manana' : 'hoy';
}

/** La frase que se le promete al cliente al pasar a persona. */
function btPromesa_(idioma, ahora) {
  var t = BT_TXT[btIdioma_(idioma)];
  var tramo = btTramo_(ahora);
  return tramo === 'ya' ? t.promesaYa : (tramo === 'manana' ? t.promesaManana : t.promesaHoy);
}

/** Para el aviso a Juanma (solo de ayuda para él: al cliente nunca se le promete un plazo, 19-oct-2026). */
function btLimite_(ahora) {
  var d = ahora || new Date();
  var tramo = btTramo_(d);
  if (tramo === 'ya') {
    return 'antes de las ' + Utilities.formatDate(new Date(d.getTime() + 3600000), BT_TZ, 'HH:mm');
  }
  return (tramo === 'manana' ? 'mañana' : 'hoy') + ' antes de las 10:00';
}

/** Un texto del sistema que pasa a persona: se le pega la promesa al final. */
function btConPromesa_(texto, idioma) {
  return String(texto || '').replace(/\s+$/, '') + ' ' + btPromesa_(idioma);
}

// ============================================================
//  ENCENDIDO
// ============================================================
function btActivo_(contactoId) {
  var modo = String(PROPS.getProperty('BOTONES_MODO') || '').toLowerCase();
  if (modo === 'todos') return true;
  if (modo !== 'prueba') return false;
  return btListaPrueba_().indexOf(String(contactoId)) >= 0;
}
function btListaPrueba_() {
  return String(PROPS.getProperty('BOTONES_SOLO_PARA') || '')
    .split(',').map(function (x) { return x.trim(); }).filter(String);
}

/** En modo prueba, la palabra secreta agrega el chat a la lista. Devuelve true si la usó. */
function btClavePrueba_(contactoId, texto) {
  var clave = String(PROPS.getProperty('BOTONES_CLAVE') || '').trim();
  if (!clave || String(texto || '').trim() !== clave) return false;
  if (String(PROPS.getProperty('BOTONES_MODO') || '').toLowerCase() !== 'prueba') return false;
  var lista = btListaPrueba_();
  if (lista.indexOf(String(contactoId)) < 0) lista.push(String(contactoId));
  PROPS.setProperty('BOTONES_SOLO_PARA', lista.join(','));
  return true;
}

/** EDITOR: modo prueba, solo para el WhatsApp de Juanma (OWNER_WA) y los chats que manden la clave. */
function btModoPrueba() {
  var clave = PROPS.getProperty('BOTONES_CLAVE');
  if (!clave) {
    clave = 'prueba-botones-' + Math.floor(1000 + Math.random() * 9000);
    PROPS.setProperty('BOTONES_CLAVE', clave);
  }
  var lista = btListaPrueba_();
  var owner = String(PROPS.getProperty('OWNER_WA') || '').trim();
  if (owner && lista.indexOf(owner) < 0) lista.push(owner);
  PROPS.setProperty('BOTONES_SOLO_PARA', lista.join(','));
  PROPS.setProperty('BOTONES_MODO', 'prueba');
  console.log('Botones en MODO PRUEBA. Ven botones: ' + (lista.join(', ') || '(nadie todavía)') +
    '\nPara sumar tu Instagram o Messenger, manda desde ahí este texto exacto: ' + clave);
}
/** EDITOR: botones para todos los clientes. */
function btAbrirATodos() {
  PROPS.setProperty('BOTONES_MODO', 'todos');
  console.log('Botones ENCENDIDOS para todos los clientes.');
}
/** EDITOR: apagar los botones (el bot vuelve a ser solo texto). */
function btApagar() {
  PROPS.setProperty('BOTONES_MODO', 'apagado');
  console.log('Botones APAGADOS.');
}

// ============================================================
//  QUÉ BOTONES LLEVA UNA RESPUESTA
// ============================================================
function btOpcionesMenu_(idioma, sinVerMenu) {
  var l = btIdioma_(idioma), t = BT_TXT[l];
  var ops = [
    { id: 'BTN_RESERVAR_' + l, titulo: t.reservar },
    { id: 'BTN_MENU_' + l, titulo: t.menu },
    { id: 'BTN_EVENTO_' + l, titulo: t.evento },
    { id: 'BTN_HUMANO_' + l, titulo: t.humano }
  ];
  return sinVerMenu ? ops.filter(function (o) { return o.id.indexOf('BTN_MENU_') !== 0; }) : ops;
}

/** Opciones que propone el modelo (lead.opciones): el título vuelve tal cual como texto del cliente. */
function btOpcionesModelo_(lista, idioma) {
  var l = btIdioma_(idioma), vistos = {};
  return (Array.isArray(lista) ? lista : [])
    .map(function (x) { return String(x || '').replace(/\s+/g, ' ').trim().substring(0, 20).trim(); })
    .filter(function (x) { if (!x || vistos[x]) return false; vistos[x] = 1; return true; })
    .slice(0, 10)
    .map(function (x) { return { id: 'OPT|' + l + '|' + x, titulo: x }; });
}

/**
 * Decide los botones de una respuesta ya cerrada por rvCerrar.
 * respuestaModelo = lo que escribió el modelo antes de rvCerrar: si el sistema la
 * reemplazó (reserva creada, fecha rechazada…), las opciones del modelo ya no aplican.
 */
function btDecidir_(result, contactoId, esPrimero, respuestaModelo) {
  if (!result || !btActivo_(contactoId)) return null;
  var lead = result.lead || {};
  var idioma = btIdioma_(lead.idioma);
  if (result.respuesta !== respuestaModelo) return null;
  var ops = btOpcionesModelo_(lead.opciones, idioma);
  if (lead.requiere_humano) {
    // Un evento escala en cuanto hay básicos, pero el bot sigue preguntando presupuesto y menú.
    return (lead.tipo === 'evento' && ops.length >= 2) ? ops : null;
  }
  if (ops.length >= 2) return ops;
  // En el primer mensaje el menú sale salvo que el bot esté juntando datos (mostrar_menu:false),
  // como pasó en la prueba de Juanma del 15-oct 16:37 con una reserva.
  if (lead.mostrar_menu === true || (esPrimero && lead.mostrar_menu !== false)) return btOpcionesMenu_(idioma);
  return null;
}

// ============================================================
//  LO QUE LLEGA: texto o botón
// ============================================================
/** Traduce el id de un botón a lo que el bot entiende. */
function btLeerBoton_(id, tituloRecibido) {
  id = String(id || '');
  var m = id.match(/^BTN_(RESERVAR|MENU|EVENTO|HUMANO)_(es|en)$/);
  if (m) {
    var t = BT_TXT[m[2]];
    var accion = { RESERVAR: null, MENU: 'menu', EVENTO: null, HUMANO: 'humano' }[m[1]];
    var texto = { RESERVAR: t.pideReservar, MENU: t.pideMenu, EVENTO: t.pideEvento, HUMANO: t.pideHumano }[m[1]];
    var titulo = { RESERVAR: t.reservar, MENU: t.menu, EVENTO: t.evento, HUMANO: t.humano }[m[1]];
    return { id: id, idioma: m[2], accion: accion, texto: texto, titulo: titulo };
  }
  var o = id.match(/^OPT\|(es|en)\|(.+)$/);
  if (o) return { id: id, idioma: o[1], accion: null, texto: o[2], titulo: o[2] };
  var txt = String(tituloRecibido || '').trim();
  return txt ? { id: id, idioma: '', accion: null, texto: txt, titulo: txt } : null;
}

/** WhatsApp: {texto, log, boton} o null si no es algo que el bot atienda. */
function btEntradaWhatsApp_(msg) {
  if (!msg) return null;
  if (msg.type === 'text' && msg.text) return { texto: msg.text.body, log: msg.text.body, boton: null };
  // @65 (20-oct-2026, Juanma): las fotos ya no se pierden. Con texto: se contesta el texto, sabiendo que vino una foto.
  // Sin texto: se anota, a Juanma le llega el aviso y al cliente se le dice que la revisamos (btFotoSinTexto_).
  if (msg.type === 'image' && msg.image) {
    var cap = String(msg.image.caption || '').trim();
    if (cap) return { texto: cap + '\n\n' + BT_FOTO_NOTA, log: '📷 [Foto] ' + cap, boton: null, foto: true };
    return { texto: '', log: '📷 [Foto sin texto]', boton: null, foto: true, sinTexto: true };
  }
  if (msg.type === 'interactive' && msg.interactive) {
    var r = msg.interactive.button_reply || msg.interactive.list_reply;
    if (!r) return null;
    var b = btLeerBoton_(r.id, r.title);
    return b ? { texto: b.texto, log: '🔘 ' + b.titulo, boton: b } : null;
  }
  return null;
}

var BT_FOTO_NOTA = '[Nota del sistema: el cliente mandó una foto junto con este mensaje. No puedes verla: contesta el texto y no digas qué hay en la foto.]';
var BT_FOTO_MIN = 10;   // una ráfaga de fotos sin texto: una sola respuesta y un solo aviso cada 10 minutos

/**
 * Foto sin texto (WhatsApp desde la @65; Instagram y Messenger desde la @66): respuesta corta al cliente (si el chat no
 * está en manos de Juanma), registro y aviso. canal: 'whatsapp' | 'instagram' | 'messenger'; pid: el número de WhatsApp.
 */
function btFotoSinTexto_(canal, pid, from, nombre, pausado) {
  var cache = CacheService.getScriptCache(), clave = 'foto_' + from;
  var etiqueta = { whatsapp: 'WhatsApp', instagram: 'Instagram', messenger: 'Messenger' }[canal] || canal;
  pid = pid || PROPS.getProperty('WA_PHONE_NUMBER_ID');
  if (cache.get(clave)) return;
  cache.put(clave, '1', BT_FOTO_MIN * 60);
  var l = btIdiomaHistoria_(from), t = BT_TXT[l];
  if (!pausado) {
    btEnviar_(canal, from, t.fotoRecibida, null, pid);
    logMensaje(canal, from, nombre, 'out', 'bot', t.fotoRecibida);
  }
  logLead({ canal: canal, idioma: l, nombre: nombre || '', telefono: canal === 'whatsapp' ? from : '', tipo: 'consulta', urgencia: 'tibio',
    resumen: 'Mandó una foto sin texto', accion: 'escalar_humano', requiere_humano: true }, '📷 [Foto sin texto]', from, pausado ? '' : t.fotoRecibida);
  var consola = PROPS.getProperty('CONSOLE_URL') || ('https://docs.google.com/spreadsheets/d/' + CONFIG.SHEET_ID + '/edit');
  var texto = '📷 Foto de cliente (' + etiqueta + ')\n' + (nombre || 'Cliente') + ' · ' + from + '\n' +
    (pausado ? 'El chat ya está en tus manos: al cliente no se le contestó.' : 'Al cliente se le dijo que la revisamos.') + '\n👉 ' + consola;
  try { MailApp.sendEmail({ to: 'restaurante@rosanta.rest', subject: '📷 Foto de cliente (' + etiqueta + ') — ' + (nombre || from), body: texto }); }
  catch (e) { Logger.log('btFotoSinTexto_ correo: ' + e); }
  avisoJuanma_({ canal: canal, contacto: from, nombre: nombre, tema: 'foto', limite: Date.now() + AVISO_VENTANA_H * 3600000, texto: texto, urgente: false });
}

/** Instagram y Messenger: el quick reply trae su payload además del texto. */
function btEntradaMeta_(message) {
  if (!message) return null;
  if (message.quick_reply && message.quick_reply.payload) {
    var b = btLeerBoton_(message.quick_reply.payload, message.text);
    if (b) return { texto: b.texto, log: '🔘 ' + b.titulo, boton: b };
  }
  // @66 (20-oct-2026, Juanma): fotos en Instagram y Messenger, igual que en WhatsApp (@65).
  var foto = (message.attachments || []).some(function (a) { return a && a.type === 'image'; });
  if (message.text && foto) return { texto: message.text + '\n\n' + BT_FOTO_NOTA, log: '📷 [Foto] ' + message.text, boton: null, foto: true };
  if (message.text) return { texto: message.text, log: message.text, boton: null };
  if (foto) return { texto: '', log: '📷 [Foto sin texto]', boton: null, foto: true, sinTexto: true };
  return null;
}

// ============================================================
//  ATENDER — un solo camino para los tres canales
// ============================================================
function btAtender_(canal, contactoId, nombre, entrada) {
  var esPrimero = getHistory(contactoId).length === 0;
  var result;
  if (entrada.boton && entrada.boton.accion) {
    result = btResultadoDirecto_(entrada.boton, canal, contactoId);
  } else {
    var r0 = askClaude(canal, nombre, entrada.texto, contactoId);
    var respuestaModelo = r0 && r0.respuesta;
    var modelo = { accion: String((r0 && r0.lead && r0.lead.accion) || ''), tipo: String((r0 && r0.lead && r0.lead.tipo) || '') };
    result = rvCerrar(r0, canal, contactoId);
    result._modelo = modelo;   // lo usa Humano.js: con el bot callado, solo sale si es de reservas
    result.botones = btDecidir_(result, contactoId, esPrimero, respuestaModelo);
  }
  result.lead = result.lead || {};
  if (entrada.boton) result.lead.ultimo_boton = entrada.boton.id;
  // @70 (Ashley, 21-oct): si la respuesta promete que una persona se pondrá en contacto, el aviso sale siempre,
  // aunque el modelo no haya marcado requiere_humano. Lo decide el código, no el modelo.
  if (!result.lead.requiere_humano && AVISO_PROMESA_RE.test(String(result.respuesta || ''))) {
    result.lead.requiere_humano = true;
    result.lead.promesa_sin_marca = true;
  }
  return result;
}

/** "Ver menú" y "Hablar con alguien" no necesitan al modelo. */
function btResultadoDirecto_(b, canal, contactoId) {
  var l = btIdioma_(b.idioma), t = BT_TXT[l], r;
  if (b.accion === 'menu') {
    r = {
      respuesta: t.respMenu(),
      lead: { canal: canal, idioma: l, tipo: 'consulta', urgencia: 'frio',
        resumen: 'Pidió ver el menú (botón)', accion: 'responder_info', requiere_humano: false },
      botones: btActivo_(contactoId) ? btOpcionesMenu_(l, true) : null
    };
  } else {
    r = {
      respuesta: t.respHumano(btPromesa_(l)),
      lead: { canal: canal, idioma: l, tipo: 'otro', urgencia: 'tibio',
        resumen: 'Pidió hablar con una persona (botón)', accion: 'escalar_humano', requiere_humano: true },
      botones: null
    };
  }
  saveHistory(contactoId, b.texto, JSON.stringify({ respuesta: r.respuesta, lead: r.lead }));
  return r;
}

// ============================================================
//  ENVIAR — texto con botones; si Meta rechaza los botones, sale el texto solo
// ============================================================
function btEnviar_(canal, contactoId, texto, botones, phoneNumberId) {
  var ok = false;
  if (botones && botones.length) {
    try {
      if (canal === 'whatsapp') ok = btEnviarWhatsApp_(phoneNumberId, contactoId, texto, botones);
      else ok = btEnviarQuickReplies_(canal, contactoId, texto, botones);
    } catch (e) { Logger.log('btEnviar_ (' + canal + '): ' + e); }
    if (!ok) Logger.log('btEnviar_: Meta rechazó los botones, sale solo el texto.');
  }
  if (ok) return;
  if (canal === 'whatsapp') sendWhatsApp(phoneNumberId, contactoId, texto);
  else if (canal === 'instagram') sendInstagram(contactoId, texto);
  else sendMessenger(contactoId, texto);
}

/** Construye el mensaje interactivo de WhatsApp (separado para poder probarlo). */
function btPayloadWhatsApp_(to, texto, botones, idioma) {
  texto = String(texto || '');
  if (botones.length <= 3 && texto.length <= 1024) {
    return {
      messaging_product: 'whatsapp', recipient_type: 'individual', to: to, type: 'interactive',
      interactive: {
        type: 'button',
        body: { text: texto },
        action: { buttons: botones.map(function (b) {
          return { type: 'reply', reply: { id: b.id.substring(0, 256), title: b.titulo.substring(0, 20) } };
        }) }
      }
    };
  }
  return {
    messaging_product: 'whatsapp', recipient_type: 'individual', to: to, type: 'interactive',
    interactive: {
      type: 'list',
      body: { text: texto.substring(0, 4096) },
      action: {
        button: BT_TXT[btIdioma_(idioma)].lista,
        sections: [{ rows: botones.slice(0, 10).map(function (b) {
          return { id: b.id.substring(0, 200), title: b.titulo.substring(0, 24) };
        }) }]
      }
    }
  };
}

function btEnviarWhatsApp_(phoneNumberId, to, texto, botones) {
  var idioma = (String(botones[0].id).match(/_(en)$|\|(en)\|/) ? 'en' : 'es');
  var url = 'https://graph.facebook.com/' + CONFIG.GRAPH_VERSION + '/' + phoneNumberId + '/messages';
  var resp = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + CONFIG.WHATSAPP_TOKEN },
    payload: JSON.stringify(btPayloadWhatsApp_(to, texto, botones, idioma)),
    muteHttpExceptions: true
  });
  if (resp.getResponseCode() >= 300) {
    Logger.log('btEnviarWhatsApp_ HTTP ' + resp.getResponseCode() + ': ' + resp.getContentText().substring(0, 300));
    return false;
  }
  return true;
}

function btPayloadQuickReplies_(recipientId, texto, botones) {
  return {
    recipient: { id: recipientId },
    message: {
      text: texto,
      quick_replies: botones.slice(0, 13).map(function (b) {
        return { content_type: 'text', title: b.titulo.substring(0, 20), payload: b.id.substring(0, 1000) };
      })
    }
  };
}

function btEnviarQuickReplies_(canal, recipientId, texto, botones) {
  var ig = canal === 'instagram';
  var url = ig ? 'https://graph.instagram.com/' + CONFIG.GRAPH_VERSION + '/me/messages'
               : 'https://graph.facebook.com/' + (CONFIG.GRAPH_VERSION || 'v21.0') + '/me/messages';
  var resp = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + (ig ? CONFIG.IG_TOKEN : CONFIG.MESSENGER_TOKEN) },
    payload: JSON.stringify(btPayloadQuickReplies_(recipientId, texto, botones)),
    muteHttpExceptions: true
  });
  if (resp.getResponseCode() >= 300) {
    Logger.log('btEnviarQuickReplies_ HTTP ' + resp.getResponseCode() + ': ' + resp.getContentText().substring(0, 300));
    return false;
  }
  marcarEnvioBot(recipientId, texto);   // el eco no debe pausar al bot
  return true;
}

/** Lo que queda en Conversaciones: el texto y, si hubo, los botones ofrecidos. */
function btTextoLog_(result) {
  var t = result.respuesta || '';
  if (result.botones && result.botones.length) {
    t += '\n[Botones: ' + result.botones.map(function (b) { return b.titulo; }).join(' · ') + ']';
  }
  return t;
}

// ============================================================
//  FICHA DEL CLIENTE — pestaña "Fichas" de Rosanta Leads, una fila por contacto.
//  La lee la consola del equipo (panel "Lo que ya sabe el bot") y la revisión
//  diaria del Pipeline de Eventos (filas con es_evento = Sí). Nunca se borra un
//  dato: solo se completa con lo nuevo que no venga vacío.
// ============================================================
var FICHA_COLS = ['clave', 'canal', 'contacto_id', 'nombre', 'telefono', 'email', 'idioma', 'tipo',
  'fecha', 'hora', 'personas', 'presupuesto', 'tipo_evento', 'formato_menu', 'es_evento',
  'fecha_consulta', 'evento_avisado', 'etapa_pipeline', 'ultimo_boton', 'resumen',
  'primer_contacto', 'actualizado', 'estado_bot'];

function fichaHoja_() {
  var ss = CONFIG.SHEET_ID ? SpreadsheetApp.openById(CONFIG.SHEET_ID) : SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName('Fichas');
  if (!sh) {
    sh = ss.insertSheet('Fichas');
    sh.appendRow(FICHA_COLS);
    sh.setFrozenRows(1);
  }
  return sh;
}

/** Completa la ficha del contacto con lo que el bot averiguó en este mensaje. Nunca rompe el bot. */
function fichaActualizar_(canal, contactoId, nombre, lead, extra) {
  var lock = LockService.getScriptLock();
  try {
    if (!contactoId || !lead || lead.tipo === 'spam') return;
    lock.waitLock(10000);
    var sh = fichaHoja_();
    var clave = canal + '|' + contactoId;
    var hoy = Utilities.formatDate(new Date(), BT_TZ, 'yyyy-MM-dd');
    var ahora = Utilities.formatDate(new Date(), BT_TZ, 'yyyy-MM-dd HH:mm');
    var celda = sh.getRange('A:A').createTextFinder(clave).matchEntireCell(true).findNext();
    var fila = celda ? celda.getRow() : 0;
    var v = fila ? sh.getRange(fila, 1, 1, FICHA_COLS.length).getValues()[0]
                 : FICHA_COLS.map(function () { return ''; });
    var pon = function (col, valor) {
      var i = FICHA_COLS.indexOf(col);
      if (valor !== undefined && valor !== null && String(valor).trim() !== '') v[i] = String(valor).trim();
    };
    pon('clave', clave);
    pon('canal', canal);
    pon('contacto_id', String(contactoId));
    pon('nombre', lead.nombre || nombre);
    pon('telefono', lead.telefono || (canal === 'whatsapp' ? contactoId : ''));
    pon('email', lead.email);
    pon('idioma', lead.idioma);
    if (lead.tipo && lead.tipo !== 'otro') pon('tipo', lead.tipo);
    pon('fecha', lead.fecha);
    pon('hora', lead.hora);
    pon('personas', lead.personas);
    pon('presupuesto', lead.presupuesto);
    pon('tipo_evento', lead.tipo_evento);
    pon('formato_menu', lead.formato_menu);
    if (lead.tipo === 'evento') {
      pon('es_evento', 'Sí');
      if (!v[FICHA_COLS.indexOf('fecha_consulta')]) pon('fecha_consulta', hoy);
    }
    pon('ultimo_boton', lead.ultimo_boton);
    pon('resumen', lead.resumen);
    if (!v[FICHA_COLS.indexOf('primer_contacto')]) pon('primer_contacto', ahora);   // con hora: el pipeline mide respuesta_horas
    if (extra) Object.keys(extra).forEach(function (k) { pon(k, extra[k]); });
    pon('actualizado', ahora);
    if (fila) sh.getRange(fila, 1, 1, FICHA_COLS.length).setValues([v]);
    else sh.appendRow(v);
  } catch (e) {
    Logger.log('fichaActualizar_: ' + e);
  } finally {
    try { lock.releaseLock(); } catch (e2) {}
  }
}

/** Un valor de la ficha del contacto, o '' si no hay. */
function fichaValor_(canal, contactoId, col) {
  try {
    var sh = fichaHoja_();
    var celda = sh.getRange('A:A').createTextFinder(canal + '|' + contactoId).matchEntireCell(true).findNext();
    if (!celda) return '';
    return String(sh.getRange(celda.getRow(), FICHA_COLS.indexOf(col) + 1).getDisplayValue() || '');
  } catch (e) { return ''; }
}

// ============================================================
//  BLOQUE PARA EL PIPELINE DE EVENTOS (va en el correo "🔔 Lead para atender")
//  La revisión diaria lo lee y crea la fila con etapa "consulta" y canal "bot".
// ============================================================
function btBloquePipeline_(canal, lead, idDestino) {
  lead = lead || {};
  // fecha_consulta = el día del PRIMER mensaje del cliente, no el del aviso (pedido del Pipeline, 15-oct).
  var primero = fichaValor_(canal, idDestino, 'primer_contacto') ||
    Utilities.formatDate(new Date(), BT_TZ, 'yyyy-MM-dd HH:mm');
  var contacto = [lead.telefono || (canal === 'whatsapp' ? idDestino : ''), lead.email]
    .filter(String).join(' · ') || (canal + ' ' + idDestino);
  return '\n---DATOS_PIPELINE---\n' +
    'cliente: ' + (lead.nombre || '') + '\n' +
    'contacto: ' + contacto + '\n' +
    'email: ' + (lead.email || '') + '\n' +
    'canal: bot\n' +
    'canal_detalle: ' + canal + '\n' +
    'primer_contacto: ' + primero + '\n' +
    'fecha_consulta: ' + String(primero).substring(0, 10) + '\n' +
    'fecha_evento: ' + (rvFecha(lead.fecha) || '') + '\n' +
    'pax: ' + (parseInt(lead.personas, 10) || '') + '\n' +
    'presupuesto: ' + (lead.presupuesto || '') + '\n' +
    'formato_menu: ' + (lead.formato_menu || '') + '\n' +
    'idioma: ' + btIdioma_(lead.idioma) + '\n' +
    'evento: ' + (lead.tipo_evento || 'evento') + '\n' +
    'id_chat: ' + canal + '|' + idDestino + '\n' +
    '---FIN---\n';
}
