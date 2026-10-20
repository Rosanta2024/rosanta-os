/**
 * ROSANTA · BOT — RESERVAS PEDIDAS POR EL RESTAURANTE (19-oct-2026)
 * Archivo ADITIVO. Prefijo rvm.
 *
 * Pedido de Juanma tras Louise ("asegúrate que esto no vuelve a pasar"): un cambio que pide el
 * restaurante (la Central o la consola) se hace con las MISMAS funciones de Wix que usa el bot
 * (consultarBot, cambiarBot, cancelarBot), no con el navegador en el panel de Wix.
 *
 *   POST <url del bot>/exec?accion=reserva
 *   { secreto: <WIX_RESERVAS_SECRETO>, accion: 'buscar' | 'cambiar' | 'cancelar', quien: 'Central', ... }
 *
 *   buscar   { nombre | email | telefono, fecha? }               → reservas vigentes con id, nombre, correo y nota
 *   cambiar  { id | email | telefono, fecha_actual?, hora_actual?, fecha?, hora?, personas?, nota?, avisar_cliente? }
 *   cancelar { email | telefono, fecha, hora?, avisar_cliente? }
 *
 * Al cliente NO se le escribe salvo avisar_cliente: true. Queda registro como el del bot: fila en
 * Leads (sale en el resumen de la noche), línea en Conversaciones y el aviso de siempre a Juanma.
 */

function rvmWeb_(e) {
  var salida = function (o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); };
  var p;
  try { p = JSON.parse((e.postData && e.postData.contents) || '{}'); } catch (x) { return salida({ ok: false, motivo: 'BODY_INVALIDO' }); }
  var sec = PropertiesService.getScriptProperties().getProperty('WIX_RESERVAS_SECRETO');
  if (!sec || String(p.secreto || '') !== sec) return salida({ ok: false, motivo: 'SECRETO_INVALIDO' });
  delete p.secreto;
  try { return salida(rvManual(p)); }
  catch (x) { Logger.log('rvManual: ' + x); return salida({ ok: false, motivo: 'excepcion', detalle: String(x).substring(0, 200) }); }
}

function rvManual(p) {
  p = p || {};
  var accion = String(p.accion || '');
  var quien = String(p.quien || 'restaurante').substring(0, 40);
  var d = {
    id: String(p.id || '').trim(),
    nombre: String(p.nombre || '').trim(),
    email: String(p.email || '').trim().toLowerCase(),
    telefono: String(p.telefono || '').replace(/\D/g, ''),
    fecha_actual: rvFecha(p.fecha_actual), hora_actual: rvHora(p.hora_actual),
    fecha: rvFecha(p.fecha), hora: rvHora(p.hora),
    personas: parseInt(p.personas, 10) || 0,
    nota: String(p.nota || '').trim().substring(0, 500),
    idioma: String(p.idioma || 'es').toLowerCase().indexOf('en') === 0 ? 'en' : 'es',
    canal: 'restaurante'
  };
  if (accion === 'buscar') {
    if (!d.nombre && !d.email && !d.telefono) return { ok: false, motivo: 'FALTAN_DATOS', campos: ['nombre', 'email', 'telefono'] };
    return rvmLlamar_('consultarBot', { nombre: d.nombre, email: d.email, telefono: d.telefono, fecha: d.fecha, detalle: true });
  }
  if (accion === 'cambiar') {
    if (!d.id && !d.email && !d.telefono) return { ok: false, motivo: 'FALTAN_DATOS', campos: ['id', 'email', 'telefono'] };
    if (!d.fecha && !d.hora && !d.personas && !d.nota) return { ok: false, motivo: 'SIN_CAMBIOS' };
    if (d.fecha && rvEsPasado(d.fecha)) return { ok: false, motivo: 'FECHA_EN_PASADO' };
    var r = rvmLlamar_('cambiarBot', { id: d.id, email: d.email, telefono: d.telefono, fecha_actual: d.fecha_actual,
      hora_actual: d.hora_actual, fecha: d.fecha, hora: d.hora, personas: d.personas || '', nota: d.nota, canal: 'restaurante' });
    if (!r.ok) return r;
    d.nombre = r.nombre || d.nombre; d.email = r.email || d.email;
    var resumen = (r.modo === 'nota' ? 'Reserva: NOTA agregada por el restaurante (' + quien + '): ' + r.antes.fecha + ' ' + r.antes.hora :
      'Reserva CAMBIADA por el restaurante (' + quien + '): ' + r.antes.fecha + ' ' + r.antes.hora + ' → ' +
      r.ahora.fecha + ' ' + r.ahora.hora + ', ' + r.ahora.personas + ' personas') +
      (d.nota ? ' · Nota: ' + d.nota : '') +
      (r.vieja_cancelada ? '' : ' (OJO: la vieja no se pudo cancelar: ' + (r.error_cancelar || '?') + ')');
    rvmRegistrar_(d, resumen, !r.vieja_cancelada);
    if (r.modo !== 'nota') rvAvisarCambio(d, 'restaurante · ' + quien, r);
    if (p.avisar_cliente === true && r.modo !== 'nota') {
      rvCorreoCliente({ email: d.email, idioma: d.idioma, nombre: d.nombre, antes: r.antes, ahora: r.ahora, reemplazada: r.modo === 'reemplazada' }, 'cambiada');
    }
    r.registro = resumen;
    return r;
  }
  if (accion === 'cancelar') {
    if (!d.email && !d.telefono) return { ok: false, motivo: 'FALTAN_DATOS', campos: ['email', 'telefono'] };
    if (!d.fecha) return { ok: false, motivo: 'FALTAN_DATOS', campos: ['fecha'] };   // nunca "todas" desde aquí
    var c = rvmLlamar_('cancelarBot', { email: d.email, telefono: d.telefono, fecha: d.fecha, hora: d.hora || '' });
    if (!c.ok) return c;
    var x = c.cancelada || {};
    d.fecha = x.fecha || d.fecha; d.hora = x.hora || d.hora; d.personas = x.personas || ''; d.nombre = x.nombre || d.nombre;
    d.email = x.email || d.email;
    var res2 = 'Reserva CANCELADA por el restaurante (' + quien + '): ' + d.fecha + ' ' + d.hora + ', ' + d.personas + ' personas';
    rvmRegistrar_(d, res2, false);
    rvAvisarCancel(d, 'restaurante · ' + quien);
    if (p.avisar_cliente === true) rvCorreoCliente(d, 'cancelada');
    c.registro = res2;
    return c;
  }
  return { ok: false, motivo: 'ACCION_DESCONOCIDA' };
}

/** POST a la función de Wix con el secreto de siempre. */
function rvmLlamar_(funcion, datos) {
  var props = PropertiesService.getScriptProperties();
  var base = props.getProperty('WIX_RESERVAS_URL') || '', sec = props.getProperty('WIX_RESERVAS_SECRETO');
  if (!base || !sec) return { ok: false, motivo: 'sin_configurar' };
  datos.secreto = sec;
  try {
    var res = UrlFetchApp.fetch(base.replace(/\/[^\/]*$/, '/' + funcion), {
      method: 'post', contentType: 'application/json', payload: JSON.stringify(datos), muteHttpExceptions: true
    });
    var body = JSON.parse(res.getContentText() || '{}');
    if (res.getResponseCode() !== 200 && body.ok !== false) return { ok: false, motivo: 'http_' + res.getResponseCode() };
    return body;
  } catch (e) {
    return { ok: false, motivo: 'excepcion', detalle: String(e).substring(0, 200) };
  }
}

/** El mismo registro que deja el bot: Leads (resumen de la noche) y Conversaciones (la consola lo ve en el chat del cliente). */
function rvmRegistrar_(d, resumen, requiereHumano) {
  try {
    logLead({ canal: 'restaurante', idioma: d.idioma, nombre: d.nombre, telefono: d.telefono, email: d.email, tipo: 'reserva',
      resumen: resumen, accion: 'reserva_manual', requiere_humano: !!requiereHumano }, '', d.email || d.telefono, '');
  } catch (e) { Logger.log('rvmRegistrar_ Leads: ' + e); }
  if (d.email || d.telefono) {
    logMensaje(d.email ? 'correo' : 'whatsapp', d.email || d.telefono, d.nombre, 'out', 'restaurante', '[Hecho en Wix por el restaurante] ' + resumen);
  }
}
