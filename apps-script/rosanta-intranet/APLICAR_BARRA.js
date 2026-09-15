/**
 * APLICAR_BARRA.gs — Pone al dia el Banco de BARRA con el cierre. Lista blanca.
 *
 * Un archivo con UNA sola funcion, misma razon que APLICAR_SYNC.gs y REVERTIR_SYNC.gs.
 *
 * POR QUE EXISTE
 * El semaforo del 26-ago-2026 marco 8 alertas de ±10% en BARRA. No eran movimientos
 * de mercado: en los OCHO, COCINA ya estaba exactamente en el precio del cierre y
 * BARRA seguia con precios viejos. O sea que la actualizacion del 24-ago toco cocina
 * y a barra no la sincronizo nadie.
 *
 *   producto          barra    cierre   cocina ya tenia
 *   AJO               Q30      Q18      Q18.00
 *   APIO              Q8       Q5       Q5.00
 *   CEBOLLA BLANCA    Q7.50    Q4       Q4.00
 *   CEBOLLA MORADA    Q8       Q5       Q5.00
 *   FRESAS            Q22      Q15      Q15.00
 *   LIMON             Q1.40    Q1       Q1.00
 *   SAL FINA          Q2       Q2.20    Q2.20
 *
 * FUERA DE LA LISTA — el sync NO puede arreglarlo
 *   AZUCAR BLANCA     Q108     Q4.22
 *     OJO: los cocteles de barra NUNCA estuvieron mal costeados. Lo que costea las
 *     recetas es el PRECIO POR UNIDAD DE RECETA, y barra lo tiene en 0.00952/g
 *     contra 0.0093/g de cocina: bien. El error vive solo en el precio de COMPRA
 *     (Q108, que es el de la arroba de 25 lb — Juanma confirmo Q105/arroba el
 *     26-ago-2026) y nunca llego al costo.
 *
 *     Las dos celdas son incoherentes entre si: 0.00952 / 108 da un factor que
 *     implicaria que una libra tiene 11.350 gramos. Y aplicarSincronizacion CONSERVA
 *     el factor, asi que escribir Q4.22 dejaria el precio por gramo en 0.00037 —
 *     el azucar 25 veces MAS BARATA de lo real, rompiendo el unico numero que hoy
 *     esta bien. El chequeo de CONTROL_BARRA freno exactamente eso el 26-ago-2026.
 *
 *     SE ARREGLA A MANO, dos celdas del Banco de BARRA, fila de AZUCAR BLANCA:
 *         precio de compra           Q108      ->  4.22
 *         precio por unidad receta   0.00952   ->  0.0093
 *     Asi queda igual que cocina y coherente consigo mismo (4.22/453.592 = 0.0093),
 *     y el producto desaparece solo de las propuestas del sync.
 *
 *     La unidad NO se toca: ya dice "lb", igual que el cierre. Ponerle "arroba"
 *     romperia el candado y el sync no volveria a mirar este producto nunca.
 *
 *     El candado de unidad compara UNIDADES, NO PLAUSIBILIDAD. Un precio 25 veces
 *     mayor con la unidad correcta pasa limpio. Por eso el Q108 vivio tanto.
 *
 * COMO SE USA
 *   1. Corré esto con CONFIRMAR_BARRA en false. Solo SIMULA.
 *   2. Si el plan esta bien, poné true y corré de nuevo.
 *   3. Anotate la corrida que devuelve. Para deshacer: REVERTIR_SYNC.gs.
 *   4. Dejá CONFIRMAR_BARRA en false otra vez.
 *
 * Es seguro correrlo dos veces: una vez aplicados, esos productos dejan de aparecer
 * entre los cambios propuestos y la segunda corrida no encuentra nada que hacer.
 */

var APROBADOS_BARRA = [
  'ajo',
  'apio',
  'cebolla blanca',
  'cebolla morada',
  'fresas',
  'limon',
  'sal fina'
];

/**
 * Donde tiene que aterrizar el precio por unidad de receta, para comprobar que el
 * factor de conversion del Banco de barra no este roto. Son los valores que cocina
 * ya usa hoy, leidos del INDICE_INSUMO_RECETA.
 *
 * Por que hace falta: aplicarSincronizacion CONSERVA el factor (dNuevo = precioNuevo
 * * dViejo/precioViejo). Si el factor de barra estuviera mal, corregir el precio de
 * compra dejaria el precio por gramo igual de mal, y nadie lo notaria porque el
 * numero visible —el de compra— habria quedado bien.
 */
var CONTROL_BARRA = {
  'azucar blanca': { porUnidad: 0.0093, unidad: 'g', tolerancia: 0.0004 }
};

/** En false SIMULA. Recien en true escribe. */
var CONFIRMAR_BARRA = false;

function APLICAR_BARRA() {
  soloDueno_();
  var r = sincronizarPreciosDeCierre_('BARRA');      // propone, nunca escribe

  var ok = [], fuera = [];
  r.cambios.forEach(function (c) {
    if (APROBADOS_BARRA.indexOf(normalizar_(c.producto)) !== -1) ok.push(c);
    else fuera.push(c);
  });

  Logger.log('BARRA — propuestas: %s | en la lista: %s | fuera: %s',
             r.cambios.length, ok.length, fuera.length);
  ok.forEach(function (c) {
    Logger.log('  APLICA  %s  Q%s -> Q%s / %s  (%s%%)',
               c.producto, c.precioViejo, c.precioNuevo, c.unidad, c.pct);
  });
  fuera.forEach(function (c) {
    Logger.log('  NO TOCA %s  Q%s -> Q%s  (%s%%)',
               c.producto, c.precioViejo, c.precioNuevo, c.pct);
  });

  // Aviso, no error: que un aprobado no aparezca puede significar que ya se aplico.
  var vistos = {};
  r.cambios.forEach(function (c) { vistos[normalizar_(c.producto)] = true; });
  var sinPropuesta = APROBADOS_BARRA.filter(function (n) { return !vistos[n]; });
  if (sinPropuesta.length) {
    Logger.log('OJO: %s de la lista ya no figuran entre los cambios (¿ya se aplicaron?): %s',
               sinPropuesta.length, sinPropuesta.join(', '));
  }

  // Chequeo del factor. Se hace ANTES de escribir: si el factor esta roto, corregir
  // el precio de compra no arregla nada y encima lo esconde.
  var factorRoto = [];
  ok.forEach(function (c) {
    var ctrl = CONTROL_BARRA[normalizar_(c.producto)];
    if (!ctrl) return;
    var mismaUni = normalizar_(c.unidadReceta) === normalizar_(ctrl.unidad);
    var aterriza = Math.abs(c.dNuevo - ctrl.porUnidad) <= ctrl.tolerancia;
    Logger.log('  factor de %s: %s %s -> %s %s  (cocina usa %s %s)',
               c.producto, c.dViejo, c.unidadReceta, c.dNuevo, c.unidadReceta,
               ctrl.porUnidad, ctrl.unidad);
    if (!mismaUni || !aterriza) {
      factorRoto.push(c.producto + ' (queda en ' + c.dNuevo + '/' + c.unidadReceta +
                      ', cocina usa ' + ctrl.porUnidad + '/' + ctrl.unidad + ')');
    }
  });
  if (factorRoto.length) {
    Logger.log('');
    Logger.log('FRENO: el factor de conversion no aterriza donde cocina. NO se escribio.');
    factorRoto.forEach(function (t) { Logger.log('  ' + t); });
    Logger.log('Corregir a mano el precio por unidad de receta en el Banco de BARRA y volver a correr.');
    return { escritos: 0, factorRoto: factorRoto };
  }

  if (!ok.length) { Logger.log('Nada que aplicar. No se escribio.'); return { escritos: 0 }; }

  if (!CONFIRMAR_BARRA) {
    Logger.log('SIMULACION — se aplicarian %s. No se escribio nada.', ok.length);
    Logger.log('Para aplicarlo, poné CONFIRMAR_BARRA = true.');
    return { simulado: true, aplicarian: ok.length };
  }

  var quien = Session.getActiveUser().getEmail() || 'APLICAR_BARRA';
  var res = aplicarSincronizacion_('BARRA', ok, quien);
  Logger.log('escritos: %s | saltados: %s | corrida %s', res.escritos, res.saltados, res.corrida);
  Logger.log('Queda en SYNC_PRECIOS y en BITACORA.');
  Logger.log('Para deshacer: poné %s en CORRIDA_A_REVERTIR de REVERTIR_SYNC.gs.', res.corrida);
  Logger.log('Acordate de dejar CONFIRMAR_BARRA en false.');
  return res;
}
