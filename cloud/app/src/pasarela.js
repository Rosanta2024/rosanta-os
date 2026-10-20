/**
 * Pasarela de pago INTERCAMBIABLE (AYUDANTE 4, 21-oct-2026). Decision de Juanma: la pasarela no esta decidida (cotiza
 * BAC Credomatic y NeoNet contra Recurrente). Todo cobro en linea pasa por esta interfaz; el proveedor se elige con
 *
 *   PASARELA = ninguna (por defecto) | recurrente | bac | neonet
 *
 * Con "ninguna" no se cobra nada: la compra en linea responde "no disponible" y la pagina de compra muestra
 * "escribenos". La emision manual por el dueño (venta por deposito), el canje y el reporte siguen igual.
 *
 * La interfaz (la misma para todos; la prueba "misma interfaz" lo revisa):
 *   proveedor, encendido, modo, capacidades { cobro, link, reembolso, preautorizacion }
 *   crearCobro({ concepto, referencia, descripcion, moneda: GTQ|USD, monto, url_exito, url_cancelar, vence }) → { id, url }
 *   crearLink(lo mismo) → { id, url }                         enlace de pago (anticipos, mas adelante)
 *   verificarWebhook(cuerpoCrudo: Buffer, cabeceras) → { ok, motivo, eventoId }
 *   interpretarEvento(json) → { tipo: pago_exitoso|pago_fallido|reembolso|ignorado, cobro_id, referencia, pago_id,
 *                               moneda, bruto, comision, otros, fecha, fel_url, motivo, reembolso{…} }
 *   reembolsar({ pago_id, monto?, clave? }) → { id, estado }
 *   preautorizar / capturar / liberar → 501 si el proveedor no lo tiene
 * Lo que no esta configurado responde 503 con un mensaje claro; nunca cobra a medias.
 */
const R = require('./recurrente');

const PROVEEDORES = ['ninguna', 'recurrente', 'bac', 'neonet'];
const NOMBRE = { ninguna: 'ninguna', recurrente: 'Recurrente', bac: 'BAC Credomatic', neonet: 'NeoNet' };
const METODOS = ['crearCobro', 'crearLink', 'verificarWebhook', 'interpretarEvento', 'reembolsar', 'preautorizar', 'capturar', 'liberar'];

function error(status, msg) { const e = new Error(msg); e.status = status; return e; }

/** Una pasarela que no cobra: "ninguna", o BAC / NeoNet mientras no esten integradas. */
function pasarelaApagada(proveedor) {
  const msg = proveedor === 'ninguna' ? 'Todavía no se cobra en línea.' : NOMBRE[proveedor] + ' no está configurado.';
  const no = async () => { throw error(503, msg); };
  return {
    proveedor, encendido: false, modo: 'apagado', capacidades: { cobro: false, link: false, reembolso: false, preautorizacion: false },
    crearCobro: no, crearLink: no, reembolsar: no, preautorizar: no, capturar: no, liberar: no,
    verificarWebhook: () => ({ ok: false, motivo: msg }),
    interpretarEvento: () => ({ tipo: 'ignorado', evento: '', cobro_id: null, referencia: null })
  };
}

/**
 * crearPasarela(env, o) — env: process.env (PASARELA, RECURRENTE_*). o.fetch para pruebas.
 * Un valor desconocido de PASARELA es un error de arranque (mejor no arrancar que cobrar con otra).
 */
function crearPasarela(env, o) {
  const e = env || {};
  const p = String(e.PASARELA || 'ninguna').trim().toLowerCase();
  if (PROVEEDORES.indexOf(p) === -1) throw new Error('PASARELA desconocida: ' + p + ' (ninguna, recurrente, bac o neonet).');
  if (p === 'recurrente') return R.crearRecurrente({ secretKey: e.RECURRENTE_SECRET_KEY, publicKey: e.RECURRENTE_PUBLIC_KEY, webhookSecret: e.RECURRENTE_WEBHOOK_SECRET,
    permitirVivo: e.RECURRENTE_VIVO === 'si', fetch: o && o.fetch });
  // BAC y NeoNet: sin documentacion publica de su API (Estudio §8.1). Se integran cuando Juanma elija y den la API.
  return pasarelaApagada(p);
}

module.exports = { crearPasarela, pasarelaApagada, PROVEEDORES, METODOS, NOMBRE };
