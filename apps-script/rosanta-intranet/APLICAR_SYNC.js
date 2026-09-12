/**
 * APLICAR_SYNC.gs — Escribe en el Banco SOLO lo que este en la lista de abajo.
 *
 * Un archivo con UNA sola funcion, misma razon que Diagnostico.gs.
 *
 * ESTO SI ESCRIBE. Pero es una lista blanca: lo que no este en APROBADOS no se toca,
 * aunque sincronizarPreciosDeCierre() lo proponga. Al revés de aplicar la propuesta
 * entera, que era el riesgo real.
 *
 * Para aprobar una linea, agregá su nombre en minusculas y sin acentos a APROBADOS.
 *
 * ---------------------------------------------------------------------------
 * Criterio de Juanma (24 ago 2026): lo registrado el 8/21 en la pestana PRECIOS
 * es correcto. Esas filas coinciden con el cierre de julio, asi que se aplican.
 *
 * APROBADAS
 *   aciete de oliva   Q100 -> Q111   ya aplicado el 24 ago
 *   vinagre blanco    Q50  -> Q38    UNICO de los 4 que mueve costos: lo usan
 *                                    Brocoli Escabechado, Rabanos Encurtidos,
 *                                    Cebolla Encurtida, Fresas y Uvas Maceradas
 *   albahaca seca     Q10  -> Q5     ninguna ficha lo usa: higiene del Banco
 *   cilantro          Q15  -> Q10    ninguna ficha lo usa: higiene del Banco
 *   perejil           Q10  -> Q5     ninguna ficha lo usa. OJO: Gremolata usa
 *                                    "Prejil" (fila 145), que es OTRA fila del
 *                                    Banco y NO la toca este cambio. Ver p50.
 *
 * RECHAZADAS — no estan en lo registrado el 8/21
 *   camote            Q9.50 -> Q8    correccion deliberada del 21 ago
 *   pimienta negra    Q120 -> Q45    duplicado del cierre, no una bajada
 *
 * PENDIENTE DE CONFIRMAR
 *   papa              Q7 -> Q3       el 8/21 quedo registrada a Q3, pero el Q7
 *                                    es decision documentada de administracion
 *                                    (p26). Ademas mueve el CMV del Gratin de
 *                                    Papas, que es uno de los controles de
 *                                    probarCosteo(). No se agrega sin confirmar.
 * ---------------------------------------------------------------------------
 */

var APROBADOS = [
  'aciete de oliva',
  'vinagre blanco',
  'albahaca seca',
  'cilantro',
  'perejil'
];

function APLICAR_SYNC() {
  var r = sincronizarPreciosDeCierre('COCINA');

  var ok = [], fuera = [];
  r.cambios.forEach(function (c) {
    if (APROBADOS.indexOf(normalizar_(c.producto)) !== -1) ok.push(c);
    else fuera.push(c);
  });

  Logger.log('propuestas: %s | aprobadas: %s | fuera de la lista: %s',
             r.cambios.length, ok.length, fuera.length);
  ok.forEach(function (c) {
    Logger.log('  APLICA  %s  Q%s -> Q%s / %s  (%s%%)', c.producto, c.precioViejo, c.precioNuevo, c.unidad, c.pct);
  });
  fuera.forEach(function (c) {
    Logger.log('  NO TOCA %s  Q%s -> Q%s  (%s%%)', c.producto, c.precioViejo, c.precioNuevo, c.pct);
  });

  if (!ok.length) { Logger.log('Nada aprobado. No se escribio.'); return; }

  var res = aplicarSincronizacion('COCINA', ok, Session.getActiveUser().getEmail() || 'APLICAR_SYNC');
  Logger.log('escritos: %s | saltados: %s', res.escritos, res.saltados);
  Logger.log('El historico quedo en la pestana SYNC_PRECIOS del libro de costeo.');
}
