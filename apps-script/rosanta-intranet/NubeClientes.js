/**
 * EL PIPELINE DE EVENTOS EN EL SERVIDOR NUEVO (19-oct-2026, migracion a la nube, Clientes).
 *
 * El interruptor es PARAMETROS › motor_eventos:
 *   sheets (o vacio) → todo como siempre: la pantalla Eventos guarda en Marketing OS › cotizaciones.
 *   base             → el pipeline se guarda en el servidor nuevo (Google Cloud), que copia cada guardado a
 *                      la hoja. Aca guardarEventos se niega, para que nadie escriba por dos lados (la
 *                      revision diaria tambien cambia: cotHook_ de Marketing OS se niega y cot.sh apunta al
 *                      servidor nuevo).
 * Volver atras = poner motor_eventos = sheets.
 * En el servidor nuevo (que corre EventosDatos.js) no aplica: alli NUBE_SERVIDOR_ existe y es el que guarda.
 */
/** El servicio definitivo de Clientes (20-oct-2026): pipeline, revision diaria, CRM y lo que guarda Marketing. */
var NUBE_CLIENTES_URL_ = 'https://rosanta-clientes-512086396641.northamerica-south1.run.app';
var NUBE_EVENTOS_URL_ = NUBE_CLIENTES_URL_ + '/clientes/eventos';

/** Eventos: PARAMETROS › motor_eventos (usa _nubeInterruptor_ de NubePagos.js, 1 minuto de cache). */
function eventosMotor_() { return _nubeInterruptor_('motor_eventos', 'ev_motor_v1'); }

/** La cerradura de guardarEventos: con base, se niega. */
function _evSoloConsulta_() {
  if (typeof NUBE_SERVIDOR_ !== 'undefined' && NUBE_SERVIDOR_) return;
  if (eventosMotor_() === 'base') {
    throw new Error('El pipeline se guarda ahora en la pantalla nueva: ' + NUBE_EVENTOS_URL_);
  }
}

/**
 * MARKETING (CONTENIDO Y PAUTA) EN EL SERVIDOR NUEVO (20-oct-2026). Interruptor PARAMETROS › motor_marketing.
 * La pantalla de Marketing SIGUE aca (Meta, Claude y Drive viven en Apps Script). Con base, las 6 funciones de
 * guardar (mktUpsert, mktDelete, calGuardarVersion, psGuardarRegla, psGuardarSupuesto, psGuardarPrueba) no
 * escriben en la hoja: le pasan el pedido al servidor nuevo, que corre este mismo codigo sobre la base y copia
 * a Marketing OS antes de contestar. Asi hay un solo escritor. Volver atras = motor_marketing = sheets.
 * La clave de tareas vive en las Propiedades del script (NUBE_CLAVE_TAREAS), nunca en el codigo.
 */
function marketingMotor_() { return _nubeInterruptor_('motor_marketing', 'mkt_motor_v1'); }

/** null = guardar aca como siempre; si no, { resultado } de lo que guardo el servidor nuevo. */
function _mktDesvio_(nombre, args, auth) {
  if (typeof NUBE_SERVIDOR_ !== 'undefined' && NUBE_SERVIDOR_) return null;
  if (marketingMotor_() !== 'base') return null;
  var u = resolverUsuario_(auth);
  if (!u) throw new Error('Tu correo no está en la hoja USUARIOS.');
  var clave = PropertiesService.getScriptProperties().getProperty('NUBE_CLAVE_TAREAS');
  if (!clave) throw new Error('Falta NUBE_CLAVE_TAREAS en las Propiedades del script.');
  var r = UrlFetchApp.fetch(NUBE_CLIENTES_URL_ + '/interno/marketing', { method: 'post', contentType: 'application/json',
    headers: { 'x-rosanta-tarea': clave }, payload: JSON.stringify({ fn: nombre, args: args, email: u.email }), muteHttpExceptions: true });
  var j = {};
  try { j = JSON.parse(r.getContentText()); } catch (e) { j = {}; }
  if (r.getResponseCode() !== 200) throw new Error(j.error || ('El servidor nuevo no guardó (' + r.getResponseCode() + '). Probá de nuevo en un minuto.'));
  return { resultado: j.resultado };
}
