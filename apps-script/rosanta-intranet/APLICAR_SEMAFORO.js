/**
 * APLICAR_SEMAFORO.gs — Aplica lo que quedo tildado en la pestana SEMAFORO_PRECIOS.
 *
 * Un archivo con UNA sola funcion, misma razon que APLICAR_SYNC.gs y REVERTIR_SYNC.gs.
 *
 * QUE RESUELVE
 *   Hasta ahora, aprobar un precio significaba EDITAR CODIGO: agregar el nombre al
 *   arreglo APROBADOS de APLICAR_SYNC.gs y correr la funcion. Aprobar un precio no
 *   deberia requerir tocar codigo. Ahora se tilda una casilla en la pestana.
 *
 * LA REGLA QUE HACE QUE ESTO SEA SEGURO
 *   La pestana dice QUE productos, NUNCA cuanto. Los numeros se releen del cierre en
 *   el momento de aplicar. SEMAFORO_PRECIOS es una hoja que edita un humano: si los
 *   precios salieran de ahi, cualquiera podria escribir 3 en una celda y que el
 *   sistema lo tomara como el precio del lomito. El tilde es una lista blanca de
 *   nombres, igual que APROBADOS — nada mas.
 *
 * COMO SE USA
 *   1. Corré refrescarSemaforoPrecios() (o esperá al activador mensual).
 *   2. En la pestana SEMAFORO_PRECIOS, tildá la casilla APROBAR de lo que quieras.
 *   3. Corré APLICAR_SEMAFORO con CONFIRMAR_APLICAR en false. Solo SIMULA.
 *   4. Si el plan esta bien, poné CONFIRMAR_APLICAR en true y corré de nuevo.
 *   5. Volvé a dejarlo en false.
 *
 * Si algo sale mal: listarCorridasSync() y REVERTIR_SYNC.gs deshacen la corrida.
 *
 * APLICAR_SYNC.gs sigue existiendo y sirve igual; su lista APROBADOS documenta las
 * decisiones del 24-ago y no conviene borrarla. Para el dia a dia, usá este.
 */

/** En false SIMULA. Recien en true escribe. */
var CONFIRMAR_APLICAR = false;

function APLICAR_SEMAFORO() {
  var quien = Session.getActiveUser().getEmail() || 'APLICAR_SEMAFORO';
  var aprobados = aprobadosDelSemaforo_();
  var areas = Object.keys(aprobados);

  if (!areas.length) {
    Logger.log('No hay nada tildado en %s. Nada que hacer.', SEMAFORO.hoja);
    return { aplicados: 0 };
  }

  var totalOk = 0, totalSaltados = 0, corridas = [];

  for (var i = 0; i < areas.length; i++) {
    var area = areas[i];
    var tildados = aprobados[area];
    Logger.log('--- %s: %s tildado(s) ---', area, tildados.length);

    // Se relee la propuesta del cierre. Esta es la fuente de los numeros.
    var r = sincronizarPreciosDeCierre(area);
    var porNombre = {};
    r.cambios.forEach(function (c) { porNombre[normalizar_(c.producto)] = c; });

    var aplicar = [];
    for (var t = 0; t < tildados.length; t++) {
      var pedido = tildados[t];
      var c = porNombre[normalizar_(pedido.producto)];

      if (!c) {
        Logger.log('  SALTA  %s — ya no esta entre los cambios propuestos (¿ya se aplico?)', pedido.producto);
        totalSaltados++;
        continue;
      }

      // CANDADO DEL SEMAFORO: lo que se tildo tiene que ser lo que se aprobo. Si el
      // cierre se movio desde que se refresco la pestana, el numero que viste no es
      // el que se escribiria.
      var mismoDe = (typeof pedido.esperadoDe !== 'number') || Math.abs(pedido.esperadoDe - c.precioViejo) < 0.005;
      var mismoA  = (typeof pedido.esperadoA  !== 'number') || Math.abs(pedido.esperadoA  - c.precioNuevo) < 0.005;
      if (!mismoDe || !mismoA) {
        Logger.log('  SALTA  %s — la propuesta cambio: tildaste Q%s->Q%s y ahora es Q%s->Q%s. Refrescá y volvé a mirar.',
                   pedido.producto, pedido.esperadoDe, pedido.esperadoA, c.precioViejo, c.precioNuevo);
        totalSaltados++;
        continue;
      }

      Logger.log('  APLICA %s  Q%s -> Q%s / %s  (%s%%)', c.producto, c.precioViejo, c.precioNuevo, c.unidad, c.pct);
      aplicar.push(c);
    }

    if (!aplicar.length) { Logger.log('  nada aplicable en %s', area); continue; }

    if (!CONFIRMAR_APLICAR) { totalOk += aplicar.length; continue; }

    var res = aplicarSincronizacion(area, aplicar, quien);
    Logger.log('  escritos: %s | saltados: %s | corrida %s', res.escritos, res.saltados, res.corrida);
    totalOk += res.escritos;
    totalSaltados += res.saltados;
    corridas.push(res.corrida);
  }

  if (!CONFIRMAR_APLICAR) {
    Logger.log('SIMULACION — se aplicarian %s, se saltarian %s. No se escribio nada.', totalOk, totalSaltados);
    Logger.log('Para aplicarlo, poné CONFIRMAR_APLICAR = true.');
    return { simulado: true, aplicarian: totalOk, saltarian: totalSaltados };
  }

  // La pestana tiene que reflejar la realidad de nuevo, y los tildes ya aplicados
  // caen solos: el producto deja de estar entre los cambios propuestos.
  refrescarSemaforoPrecios();

  Logger.log('APLICADO — %s escritos, %s saltados. Corrida(s): %s', totalOk, totalSaltados, corridas.join(', ') || '(ninguna)');
  Logger.log('Para deshacer: poné la corrida en CORRIDA_A_REVERTIR de REVERTIR_SYNC.gs.');
  Logger.log('Acordate de dejar CONFIRMAR_APLICAR en false.');
  return { simulado: false, aplicados: totalOk, saltados: totalSaltados, corridas: corridas };
}
