/**
 * p187 — Precios de evento viejos en el Doc que lee el bot. 23-sep-2026.
 *
 * COMO SE CORRE: abrir el editor de Apps Script de CUALQUIER proyecto de Rosanta
 * (o uno nuevo en blanco), pegar este archivo, elegir arreglarPreciosBot y Run.
 * La primera vez pide permiso de Documentos.
 *
 * POR QUE ASI Y NO A MANO: el conector de Drive no escribe el cuerpo de un Doc, y
 * el Buscar y reemplazar del navegador ya escribio DENTRO del documento dos veces
 * (p154). Esto reemplaza texto exacto y no toca nada mas.
 *
 * OJO CON Q350 y Q200: los dos numeros aparecen tambien en la carta de vinos
 * ("botella Q350") y en la capacidad ("200 personas"). Por eso cada reemplazo lleva
 * su frase entera como ancla, nunca el numero suelto.
 */
var DOC_BOT = '1a85WPjmr5e_Lybc8Mzw1YH38cBWsGc5mSgK00cmeY6I';

var CAMBIOS = [
  ['Combo Q350/persona',                      'Combo Q375/persona'],
  ['solo barra Q200/persona',                 'solo barra Q225/persona'],
  ['Última actualización: 14 de junio de 2026','Última actualización: 23 de septiembre de 2026'],
  ['Gratin de papas',                          'Gratín de papas']
];

function arreglarPreciosBot() {
  var cuerpo = DocumentApp.openById(DOC_BOT).getBody();
  var hechos = [], faltantes = [];

  CAMBIOS.forEach(function (c) {
    var viejo = c[0], nuevo = c[1];
    // findText toma regex: se escapan los metacaracteres del texto ancla.
    var patron = viejo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (!cuerpo.findText(patron)) {
      faltantes.push(viejo);
      return;
    }
    cuerpo.replaceText(patron, nuevo);
    hechos.push(viejo + '  ->  ' + nuevo);
  });

  // Verificacion: releer y confirmar que el viejo ya no esta y el nuevo si.
  var cuerpo2 = DocumentApp.openById(DOC_BOT).getBody();
  var mal = [];
  CAMBIOS.forEach(function (c) {
    var pv = c[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    var pn = c[1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (cuerpo2.findText(pv)) mal.push('SIGUE EL VIEJO: ' + c[0]);
    if (!cuerpo2.findText(pn)) mal.push('NO APARECE EL NUEVO: ' + c[1]);
  });

  Logger.log('CAMBIADOS (%s):\n  %s', hechos.length, hechos.join('\n  ') || 'ninguno');
  if (faltantes.length) {
    Logger.log('NO ENCONTRADOS (alguien ya los cambio, o el texto es otro):\n  %s',
               faltantes.join('\n  '));
  }
  Logger.log(mal.length ? 'VERIFICACION CON PROBLEMAS:\n  ' + mal.join('\n  ')
                        : 'VERIFICACION OK: los cuatro quedaron como deben.');
  Logger.log('El bot lee el Doc en vivo con cache de 10 minutos: esperar ese rato antes de probar.');
}
