/**
 * Procesos.gs — Los procesos automaticos se vigilan entre ellos (auditoria 14-oct-2026).
 *
 * QUE RESUELVE
 * La auditoria encontro que el Latido mira los DATOS (carritos, reservas, pauta, resenas,
 * CRM) pero nadie mira a los PROCESOS: si el vigia, el calentador, el puente del reporte,
 * el correo del martes, la carga de ventas, los cierres de PosFile o los avisos de factura
 * de SAT dejaban de correr o fallaban todas las veces, solo quedaba en un Logger.log.
 *
 * COMO FUNCIONA
 *   · Cada proceso deja una marca al terminar: procMarcar_(nombre) si salio bien,
 *     procMarcar_(nombre, error) si fallo. Vive en las Propiedades del script (PROC_<nombre>).
 *   · procProblemas_() junta lo que esta mal: un proceso que dejo de correr (sin marca
 *     buena en mas de max_h horas) o que falla seguido (racha de errores de mas de racha_h).
 *   · procAvisar_() manda UN correo al dueño por dia con la lista, y otro solo si la lista
 *     cambia. Lo llaman el vigia (cada hora) y el calentador (cada 5 min): si se cae uno,
 *     el otro avisa. El Latido del lunes lo repite como septima señal, por si fallan los dos.
 *
 * Los umbrales son holgados a proposito (misma regla que Latido.gs): un monitor que avisa
 * por una corrida lenta de Drive se ignora, y un monitor ignorado no existe.
 */

var PROCESOS = {
  // max_h: horas sin una corrida buena para darlo por caido (0 = no corre en horario fijo).
  // racha_h: horas fallando seguido para avisar.
  vigia:     { nombre: 'Vigía (cada hora)',                      max_h: 3,  racha_h: 3 },
  calentar:  { nombre: 'Calentador de cachés (cada 5 min)',      max_h: 1,  racha_h: 2 },
  puente:    { nombre: 'Puente del reporte semanal',             max_h: 0,  racha_h: 3 },
  correo:    { nombre: 'Reporte semanal por correo (martes)',    max_h: 0,  racha_h: 3 },
  ventas:    { nombre: 'Carga de ventas del POS',                max_h: 0,  racha_h: 3 },
  cierres:   { nombre: 'Lectura de cierres de PosFile (6:00 y 10:00)', max_h: 30, racha_h: 24 },
  fel:       { nombre: 'Avisos de factura de SAT por correo',    max_h: 0,  racha_h: 6 },
  reservasWeb: { nombre: 'Latido de reservas web (8:00 y 14:00)', max_h: 30, racha_h: 6 },
  canales:   { nombre: 'Latido de canales del bot (9:00)',       max_h: 30, racha_h: 24 },
  eventosMes: { nombre: 'Informe mensual de eventos (día 3, 9:00)', max_h: 0, racha_h: 3 }
};

/** Deja la marca de un proceso. Sin error = corrida buena (y corta la racha de errores). */
function procMarcar_(clave, error) {
  try {
    var p = PropertiesService.getScriptProperties(), k = 'PROC_' + clave;
    var s = {};
    try { s = JSON.parse(p.getProperty(k) || '{}') || {}; } catch (e0) { s = {}; }
    var ahora = new Date().getTime();
    if (error) {
      if (!s.err) s.err = ahora;   // primer error de la racha: la racha se mide desde aca
      s.msg = String(error && error.message || error).slice(0, 300);
    } else {
      s.ok = ahora; delete s.err; delete s.msg;
    }
    p.setProperty(k, JSON.stringify(s));
  } catch (e) { /* sin Propiedades no hay marca: el Latido del lunes lo nota como "nunca corrio" */ }
}

/** Lo que esta mal hoy, en texto, uno por proceso. Lista vacia = todo bien. */
function procProblemas_(ahora, props) {   // los dos argumentos son para la bateria
  ahora = ahora || new Date().getTime();
  props = props || PropertiesService.getScriptProperties().getProperties();
  var out = [];
  Object.keys(PROCESOS).forEach(function (clave) {
    var cfg = PROCESOS[clave], s = {};
    try { s = JSON.parse(props['PROC_' + clave] || '{}') || {}; } catch (e) { s = {}; }
    var horas = function (t) { return Math.round((ahora - t) / 36e5); };
    if (s.err && ahora - s.err >= cfg.racha_h * 36e5) {
      out.push(cfg.nombre + ': falla desde hace ' + horas(s.err) + ' h · ' + (s.msg || 'sin detalle'));
    } else if (cfg.max_h && s.ok && ahora - s.ok >= cfg.max_h * 36e5) {
      out.push(cfg.nombre + ': no corre desde hace ' + horas(s.ok) + ' h (debería correr al menos cada ' + cfg.max_h + ' h). Revisá su activador.');
    }
    // Sin ninguna marca todavia no se opina: recien instalado no hay un "antes".
  });
  return out;
}

/** Un correo al dueño si algo esta mal: uno por dia, y otro solo si la lista cambia. */
function procAvisar_(desde) {
  try {
    var prob = procProblemas_();
    var p = PropertiesService.getScriptProperties();
    if (!prob.length) { p.deleteProperty('PROC_AVISO'); return 'procesos: al día'; }
    var hoy = Utilities.formatDate(new Date(), 'America/Guatemala', 'yyyy-MM-dd');
    var sello = hoy + '|' + prob.map(function (x) { return x.split(':')[0]; }).join('|');
    if (p.getProperty('PROC_AVISO') === sello) return 'procesos: ya avisado hoy';
    var texto = 'Uno o más procesos automáticos de la intranet no están funcionando:\n\n· ' + prob.join('\n· ') +
      '\n\nNada de esto se arregla solo. Si un proceso "no corre", revisá en el editor de Apps Script ' +
      '(Activadores, el reloj a la izquierda) que su activador siga ahí y sus últimas ejecuciones.' +
      '\n\nEste aviso lo mandó: ' + (desde || '?') + '. Llega una vez por día mientras siga el problema.';
    MailApp.sendEmail({ to: DUENO_CORREO_, subject: 'Rosanta · ' + prob.length + ' proceso(s) automático(s) con problemas',
                        body: texto, name: 'Rosanta · Procesos' });
    p.setProperty('PROC_AVISO', sello);
    return 'procesos: avisado (' + prob.length + ')';
  } catch (e) {
    return 'procesos: no pude avisar (' + String(e && e.message || e) + ')';
  }
}
