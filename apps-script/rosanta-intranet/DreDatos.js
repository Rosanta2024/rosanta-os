/**
 * EL DRE DE ROSANTA, EN SU FORMATO ORIGINAL (28-sep-2026)
 * ======================================================
 *
 * Juanma: "En que momento perdimos estos formatos. Vuelve a instaurarlos." El formato
 * es el de la plantilla de dgimenezcoach (DRE por trimestre de 2024) y el del DRE 2025
 * (Rosanta_DRE_2025.xlsx): ingresos por area, CMV, margen bruto, los 9 bloques del gasto
 * operativo con sus subconceptos, las columnas FIJO / FIJO MV / VARIABLE, el % de la
 * venta y el valor de referencia, el lucro neto y el punto de equilibrio.
 *
 * NO CALCULA: todo sale de _finDatos_ (FinanzasDatos.js), que desde el 28-sep-2026 arma
 * sus bloques en este formato. Esta funcion solo elige los campos de cada mes. La
 * pantalla (DreVista) suma los meses del periodo que se elija.
 *
 * Tres decisiones de Juanma del mismo dia, que el motor ya aplica:
 *   1. los impuestos pagados son gasto operativo (bloque 5);
 *   2. el aguinaldo, el Bono 14 y los bonos pagados por banco entran a Nomina, y la
 *      venta de eventos entra como "Otros ingresos";
 *   3. los 9 bloques mandan en todo Finanzas (el PRESUPUESTO los cubre por partidas).
 */
function getDreData(auth) {
  exigirModulo_(auth, 'finanzas');
  var d = _finDatos_(false);
  var mix = d.mix || FIN_MIX;
  var meses = (d.meses || []).map(function (m) {
    var cc = (d.compra && d.compra.cocina && d.compra.cocina.mes[m.m]) || 0;
    var cb = (d.compra && d.compra.barra && d.compra.barra.mes[m.m]) || 0;
    return {
      m: m.m, mes: m.mes,
      venta_cocina: _finR_(m.ventas * mix.cocina / 100), venta_bar: _finR_(m.ventas * mix.barra / 100),
      otros: m.eventos || 0,
      cmv_cocina: _finR_(cc), cmv_bar: _finR_(cb),
      // lo que el COGS trae sin area (no deberia haber: toda categoria de mercaderia la tiene)
      cmv_otros: _finR_((m.cogs || 0) - cc - cb),
      sub: m.sub || {}, bloques: m.bloques || {},
      neto: m.neto, com: m.com || 0,
      pe: m.bev, pe_sin_presupuesto: !!m.pe_sin_presupuesto, parte: m.pe_parte || 1,
      planilla_origen: m.labor_origen
    };
  });
  return {
    anio: d.anio, gen: d.gen, meses: meses, mix: mix,
    bloques: FIN_DRE.map(function (x) { return { b: x.b, ref: x.ref, subs: FIN_DRE_SUBS[x.b] || [] }; }),
    notas: [
      'Venta cocina y bar repartida con el mix del POS (cocina ' + mix.cocina + '% · bar ' + mix.barra + '%).',
      'La nomina es la planilla devengada del mes (con IGSS, aguinaldo, Bono 14 y bonos pagados por banco); jardineria y limpieza van en Servicios Externos, como en el formato original.',
      'El punto de equilibrio es el del PRESUPUESTO: fijos del presupuesto (con los anuales / 12) entre el margen de cada mes.'
    ]
  };
}
