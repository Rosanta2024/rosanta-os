/**
 * REVERTIR_SYNC.gs — Deshace una corrida de aplicarSincronizacion().
 *
 * Un archivo con UNA sola funcion, misma razon que APLICAR_SYNC.gs y Diagnostico.gs:
 * el desplegable del editor elige solo, y ya paso que eligiera una funcion que escribe.
 *
 * COMO SE USA
 *   1. Corré listarCorridasSync() (esa NO escribe) y copiá la clave de la corrida.
 *   2. Pegala abajo en CORRIDA_A_REVERTIR.
 *   3. Corré REVERTIR_SYNC() con CONFIRMAR_REVERSION en false. Solo SIMULA: dice que haria.
 *   4. Si el plan esta bien, poné CONFIRMAR_REVERSION en true y corré de nuevo.
 *   5. Volvé a dejar CORRIDA_A_REVERTIR vacia y CONFIRMAR_REVERSION en false.
 *
 * Deshacer NO es peligroso por si mismo —devuelve valores que el propio log guardo—
 * pero sigue siendo una escritura en lote sobre el Banco de Datos. El paso de
 * simulacion no es tramite: es donde se ve si algun producto se salta y por que.
 */

/** Clave de la corrida, tal cual la muestra listarCorridasSync(). Vacio = no hace nada. */
var CORRIDA_A_REVERTIR = '';

/** En false SIMULA. Recien en true escribe. */
var CONFIRMAR_REVERSION = false;

function REVERTIR_SYNC() {
  if (!CORRIDA_A_REVERTIR) {
    Logger.log('CORRIDA_A_REVERTIR esta vacia. Corré listarCorridasSync() y pegá una clave.');
    listarCorridasSync();
    return;
  }

  var quien = Session.getActiveUser().getEmail() || 'REVERTIR_SYNC';

  if (!CONFIRMAR_REVERSION) {
    var sim = revertirSync_(CORRIDA_A_REVERTIR, quien, { simular: true });
    Logger.log('SIMULACION de %s — revertirian %s, saltarian %s',
               sim.corrida, sim.revertirian, sim.saltarian);
    sim.plan.forEach(function (p) {
      if (p.accion) Logger.log('  %s', p.accion);
      else Logger.log('  REVIERTE %s (fila %s)  Q%s -> Q%s  %s',
                      p.producto, p.fila, p.de, p.a, p.nota || '');
    });
    Logger.log('No se escribio nada. Para aplicarlo, poné CONFIRMAR_REVERSION = true.');
    return sim;
  }

  var r = revertirSync_(CORRIDA_A_REVERTIR, quien, { simular: false });
  Logger.log('REVERTIDO %s — %s filas devueltas, %s saltadas', r.corrida, r.revertidos, r.saltados);
  r.plan.forEach(function (p) {
    if (p.accion) Logger.log('  %s', p.accion);
    else Logger.log('  %s  Q%s -> Q%s  %s', p.producto, p.de, p.a, p.nota || '');
  });
  Logger.log('La reversion quedo en SYNC_PRECIOS como la corrida %s.', r.reversion);
  Logger.log('Acordate de dejar CORRIDA_A_REVERTIR vacia y CONFIRMAR_REVERSION en false.');
  return r;
}
