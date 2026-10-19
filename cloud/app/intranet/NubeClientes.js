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
var NUBE_EVENTOS_URL_ = 'https://rosanta-nube-sombra2-512086396641.northamerica-south1.run.app/clientes/eventos';

/** Eventos: PARAMETROS › motor_eventos (usa _nubeInterruptor_ de NubePagos.js, 1 minuto de cache). */
function eventosMotor_() { return _nubeInterruptor_('motor_eventos', 'ev_motor_v1'); }

/** La cerradura de guardarEventos: con base, se niega. */
function _evSoloConsulta_() {
  if (typeof NUBE_SERVIDOR_ !== 'undefined' && NUBE_SERVIDOR_) return;
  if (eventosMotor_() === 'base') {
    throw new Error('El pipeline se guarda ahora en la pantalla nueva: ' + NUBE_EVENTOS_URL_);
  }
}
