/**
 * PruebasFinanzas.gs — grupo de pruebas del pilar 3, Finance & Data OS.
 *
 * Va en archivo aparte de Pruebas.gs a proposito: el 12-sep-2026 habia tres
 * sesiones editando este proyecto a la vez y Pruebas.gs es el archivo que todas
 * tocan. Asi este grupo entra con UNA linea en correrPruebas().
 *
 * Lo que cuida, y por que cada una existe:
 *
 *   1. LA META EN UN SOLO LUGAR. Hasta hoy la intranet calculaba 27.8 (la
 *      mezclada del mix) mientras generar_finanzas.py y PARAMETROS decian 30.
 *      Nadie lo vio porque ninguna prueba comparaba las dos.
 *   2. LA PLANILLA EN UN SOLO LUGAR. Estaba a mano aca y en el Python, y los
 *      dos se quedaron en agosto.
 *   3. LAS DOS LOGICAS ESPEJO CUADRAN. _finDestino_() repite las reglas de
 *      _finCalcular_() para el panel de cobertura. Si se separan, el panel
 *      miente justo sobre el dinero que se cae en silencio. La prueba las
 *      enfrenta en cada corrida.
 *
 * Ninguna escribe. La de guardarRaa prueba los rechazos, que es lo unico que se
 * puede probar sin dejar una fila de mentira en la hoja.
 */

function prFinanzas_(res) {
  var g = prGrupo_(res, '8. Finanzas & Data OS');

  var d = null;
  prCorrer_(g, 'El maestro se lee', function () {
    d = _finDatos_(false);
    prAnotar_(g, 'El maestro se lee', (d && d.meses && d.meses.length) ? 'OK' : 'FALLA',
      d && d.meses ? d.meses.length + ' meses con venta · datos al ' + d.gen : 'sin datos',
      d && d.meses ? d.meses.length : 0, '>0');
  });
  if (!d || !d.meses) return;

  // ---------------------------------------------------------------- 1. meta
  prCorrer_(g, 'La meta de food cost sale de PARAMETROS', function () {
    var par = _finMetaFood_();
    prIgual_(g, 'La meta de food cost sale de PARAMETROS', d.meta_cogs, par,
      'la pantalla usa ' + d.meta_cogs + '% y PARAMETROS dice ' + par + '%');
  });

  prCorrer_(g, 'La meta ya no es la mezclada del mix', function () {
    var nombre = 'La meta ya no es la mezclada del mix';
    // 27.8 = 77.9 x 30 + 22.1 x 20. Era la meta hasta el 10-sep-2026 y quedo
    // descartada por decision de Juanma: es fija (30, y 28 desde el 14-sep-2026).
    var mezclada = (d.mix.cocina * d.meta_area.cocina + d.mix.barra * d.meta_area.barra) / 100;
    prAnotar_(g, nombre, Math.abs(d.meta_cogs - mezclada) > 0.05 ? 'OK' : 'FALLA',
      'meta ' + d.meta_cogs + '% · la mezclada del mix daria ' + Math.round(mezclada * 10) / 10 + '%',
      d.meta_cogs, 'distinta de ' + Math.round(mezclada * 10) / 10);
  });

  // ------------------------------------------------------------ 2. planilla
  prCorrer_(g, 'La planilla se lee del Sheet, no del codigo', function () {
    var nombre = 'La planilla se lee del Sheet, no del codigo';
    var p = _finPlanilla_();
    var delSheet = [], delRespaldo = [];
    Object.keys(p.origen).forEach(function (m) {
      (p.origen[m] === 'sheet' ? delSheet : delRespaldo).push(m);
    });
    if (p.error) {
      prAnotar_(g, nombre, 'FALLA', 'no se pudo abrir el Sheet de planilla: ' + p.error,
                0, 'al menos 1 mes');
      return;
    }
    prAnotar_(g, nombre, delSheet.length ? 'OK' : 'FALLA',
      delSheet.length + ' mes(es) del Sheet · ' + delRespaldo.length + ' del respaldo del codigo' +
      (delRespaldo.length ? ' (meses ' + delRespaldo.join(', ') + ')' : ''),
      delSheet.length, 'al menos 1 mes');
  });

  prCorrer_(g, 'El Sheet de planilla y el respaldo no se contradicen', function () {
    var nombre = 'El Sheet de planilla y el respaldo no se contradicen';
    var p = _finPlanilla_();
    var choques = [], comunes = 0;
    Object.keys(FIN_PLANILLA_RESPALDO).map(Number).forEach(function (m) {
      if (p.origen[m] !== 'sheet') return;
      comunes++;
      var dif = Math.abs(p.valores[m] - FIN_PLANILLA_RESPALDO[m]);
      // Q1 de tolerancia: el respaldo esta redondeado a quetzales enteros.
      if (dif > 1) {
        choques.push('mes ' + m + ': Sheet Q' + Math.round(p.valores[m]) +
                     ' vs codigo Q' + FIN_PLANILLA_RESPALDO[m]);
      }
    });
    // Con CERO meses en comun no hay nada que comparar, y "0 choques" no es un
    // OK: es una prueba que no midio. El 12-sep-2026 salio en verde asi, con el
    // lector de pestanas roto. Ahora se declara SALTADA y se dice por que.
    if (!comunes) {
      prAnotar_(g, nombre, 'SALTADA',
        'ningun mes vino del Sheet: no hay con que comparar (ver la prueba anterior)', 0, '>0');
      return;
    }
    // AVISO y no FALLA: manda el Sheet, asi que el numero de la pantalla es el
    // bueno igual. Lo que avisa es que el respaldo del codigo quedo viejo.
    prAnotar_(g, nombre, choques.length ? 'AVISO' : 'OK',
      choques.length ? choques.join(' · ')
                     : comunes + ' mes(es) comparados, todos coinciden',
      choques.length, 0);
  });

  prCorrer_(g, 'Un mes sin planilla no se cuenta como rentable', function () {
    var nombre = 'Un mes sin planilla no se cuenta como rentable';
    // La pantalla los pinta en blanco. Aca solo se comprueba que el dato venga
    // marcado: sin la marca, la vista no tiene con que apagarlos.
    var sinMarca = d.meses.filter(function (m) { return m.devengado === undefined; });
    var sin = d.meses.filter(function (m) { return !m.devengado; });
    prAnotar_(g, nombre, sinMarca.length === 0 ? 'OK' : 'FALLA',
      sin.length ? sin.length + ' mes(es) sin planilla: ' +
        sin.map(function (m) { return m.mes; }).join(', ') + ' (van marcados)'
        : 'todos los meses traen su planilla',
      sinMarca.length, 0);
  });

  // ----------------------------------------------------------- 3. cobertura
  prCorrer_(g, 'La cobertura cubre todas las hojas del calculo', function () {
    var nombre = 'La cobertura cubre todas las hojas del calculo';
    var faltan = FIN_LIBROS.filter(function (L) {
      return !d.integridad.cobertura || !d.integridad.cobertura[L.hoja];
    }).map(function (L) { return L.hoja; });
    prAnotar_(g, nombre, faltan.length === 0 ? 'OK' : 'FALLA',
      faltan.length ? 'sin cobertura: ' + faltan.join(' · ') : 'las ' + FIN_LIBROS.length + ' hojas',
      FIN_LIBROS.length - faltan.length, FIN_LIBROS.length);
  });

  prCorrer_(g, 'Las dos logicas espejo dan el mismo dinero perdido', function () {
    var nombre = 'Las dos logicas espejo dan el mismo dinero perdido';
    // _finCalcular acumula sinMapear cuando una categoria no esta en FIN_MAP.
    // _finDestino la llama CATEGORIA DESCONOCIDA. Son dos caminos distintos al
    // mismo dinero: si no coinciden, una de las dos cambio sin la otra.
    var porEspejo = 0;
    var desc = d.integridad.desconocidas || {};
    Object.keys(desc).forEach(function (k) { porEspejo += desc[k]; });
    var dif = Math.abs(porEspejo - d.integridad.sin_mapear);
    var vacio = porEspejo < 1 && d.integridad.sin_mapear < 1;
    prAnotar_(g, nombre, dif < 1 ? 'OK' : 'FALLA',
      'el calculo dice Q' + Math.round(d.integridad.sin_mapear) +
      ' y la cobertura Q' + Math.round(porEspejo) +
      (dif >= 1 ? ' — _finDestino_() y _finCalcular_() se separaron'
                : (vacio ? ' (0 contra 0: correcto hoy, pero no ejercita el espejo; ' +
                           'lo mide la prueba siguiente, con dinero de verdad)' : '')),
      Math.round(porEspejo), Math.round(d.integridad.sin_mapear));
  });

  prCorrer_(g, 'El espejo cuadra bloque por bloque con dinero real', function () {
    var nombre = 'El espejo cuadra bloque por bloque con dinero real';
    // La de arriba compara el dinero PERDIDO, que hoy es cero en los dos
    // caminos: pasa igual si los dos estan bien o si los dos estan rotos.
    // Esta compara cada bloque del DRE, que mueve cientos de miles de
    // quetzales por las dos logicas. Si _finDestino_() y _finCalcular_() se
    // separan en una sola categoria, aca aparece el bloque y la diferencia.
    //
    // Se excluye Nomina y salarios: en el total del año se reemplaza por la
    // planilla devengada (regla 4) y ya no es el dinero del banco.
    //
    // Limite conocido: el total del año solo suma meses CON VENTA y la
    // cobertura suma todo el año. Un gasto fechado en un mes sin ventas haria
    // saltar esta prueba sin que las reglas se hayan separado; el detalle lo
    // deja ver porque dice cuanto difiere cada bloque.
    var porCob = {};
    Object.keys(d.integridad.cobertura || {}).forEach(function (h) {
      var c = d.integridad.cobertura[h];
      Object.keys(c).forEach(function (k) {
        if (k.indexOf('DRE \u00b7 ') !== 0) return;
        var b = k.slice(6);
        porCob[b] = (porCob[b] || 0) + c[k];
      });
    });
    var mal = [], revisados = 0, movido = 0;
    var bloques = {};
    Object.keys(d.total.bloques || {}).forEach(function (b) { bloques[b] = true; });
    Object.keys(porCob).forEach(function (b) { bloques[b] = true; });
    Object.keys(bloques).forEach(function (b) {
      if (b === 'Nomina y salarios') return;
      var calc = d.total.bloques[b] || 0, cob = porCob[b] || 0;
      revisados++;
      movido += calc;
      if (Math.abs(calc - cob) > 1) {
        mal.push(b + ': calculo Q' + Math.round(calc) + ' vs cobertura Q' + Math.round(cob));
      }
    });
    if (!revisados || movido < 1) {
      prAnotar_(g, nombre, 'FALLA', 'no hubo bloques con dinero que comparar', revisados, '>0');
      return;
    }
    prAnotar_(g, nombre, mal.length ? 'FALLA' : 'OK',
      mal.length ? mal.join(' · ')
                 : revisados + ' bloques · Q' + Math.round(movido).toLocaleString('es-GT') +
                   ' pasaron por las dos logicas y cuadran',
      revisados - mal.length, revisados);
  });

  prCorrer_(g, 'Las fugas son la suma de lo que nadie decidio', function () {
    var nombre = 'Las fugas son la suma de lo que nadie decidio';
    var mal = [];
    Object.keys(d.integridad.fugas || {}).forEach(function (h) {
      var suma = 0, dd = d.integridad.cobertura[h] || {};
      FIN_PERDIDO.forEach(function (k) { suma += (dd[k] || 0); });
      if (Math.abs(suma - d.integridad.fugas[h]) > 1) mal.push(h);
    });
    prAnotar_(g, nombre, mal.length === 0 ? 'OK' : 'FALLA', mal.join(' · '), mal.length, 0);
  });

  prCorrer_(g, 'Los proveedores de la regla 9 siguen facturando', function () {
    var nombre = 'Los proveedores de la regla 9 siguen facturando';
    // La regla 9 salta el pago de banco y tarjeta de estos proveedores porque su
    // factura ya entra por FEL. Si uno deja de facturar, la regla borra gasto
    // real sin avisar. El 1.3 deja margen a un pago que cubre una factura del
    // año anterior (Edwin: Q4,000 de facturas de 2025).
    var pf = d.integridad.pago_factura || {};
    var provs = Object.keys(pf);
    var mal = provs.filter(function (p) { return pf[p].pago > 1.3 * pf[p].factura; })
      .map(function (p) {
        return p + ' paga Q' + Math.round(pf[p].pago) + ' y factura Q' + Math.round(pf[p].factura);
      });
    prAnotar_(g, nombre, provs.length && !mal.length ? 'OK' : 'FALLA',
      !provs.length ? 'el calculo no trae el resumen de la regla 9'
        : mal.length ? mal.join(' · ') + ': sacarlo de FIN_PAGO_DE_FACTURA'
        : provs.length + ' proveedores · ninguno paga mas de 1.3 veces lo que factura',
      provs.length - mal.length, provs.length);
  });

  // --------------------------------------------------------- 4. equilibrio
  prCorrer_(g, 'El punto de equilibrio es un numero usable', function () {
    var nombre = 'El punto de equilibrio es un numero usable';
    var mal = d.meses.filter(function (m) {
      return !(m.bev > 0) || !(m.mc > 0 && m.mc < 100) || !(m.fijo > 0);
    }).map(function (m) { return m.mes; });
    prAnotar_(g, nombre, mal.length === 0 ? 'OK' : 'FALLA',
      mal.length ? 'meses sin equilibrio calculable: ' + mal.join(', ')
                 : d.meses.length + ' meses con fijo, margen y equilibrio',
      d.meses.length - mal.length, d.meses.length);
  });

  // ---------------------------------------------------------------- 5. RAA
  prCorrer_(g, 'La pestana RAA existe', function () {
    var nombre = 'La pestana RAA existe';
    var hoja = SpreadsheetApp.openById(getSheetId_('CONFIG_SHEET_ID')).getSheetByName(RAA_HOJA);
    if (!hoja) {
      prAnotar_(g, nombre, 'FALLA', 'falta: correr instalarRAA() una vez', 0, 1);
      return;
    }
    var cab = hoja.getRange(1, 1, 1, RAA_COLS.length).getValues()[0].join(',');
    prIgual_(g, nombre, cab, RAA_COLS.join(','), Math.max(hoja.getLastRow() - 1, 0) + ' filas');
  });

  prCorrer_(g, 'Las cuatro tarjetas del RAA se arman', function () {
    var nombre = 'Las cuatro tarjetas del RAA se arman';
    var t = _raaTarjetas_(d);
    var ZONAS = ['verde', 'amarillo', 'rojo', 'gris'];
    var malas = t.filter(function (x) {
      return ZONAS.indexOf(x.zona) === -1 || !x.resultado || x.costo === undefined;
    });
    prAnotar_(g, nombre, (t.length === 4 && malas.length === 0) ? 'OK' : 'FALLA',
      t.map(function (x) { return x.ind + ':' + x.zona; }).join(' · '), t.length, 4);
  });

  prCorrer_(g, 'El RAA no acepta una accion sin responsable', function () {
    var nombre = 'El RAA no acepta una accion sin responsable';
    // Prueba de RECHAZO: si pasa, no se escribio nada. Si algun dia deja de
    // reventar, la hoja se llena de acciones sin dueño y volvemos al "todos son
    // responsables", que es lo mismo que nadie.
    var rechazo = '';
    try {
      guardarRaa('', { ind: 'food', analisis: 'prueba', accion: 'prueba', responsable: '' });
    } catch (e) {
      rechazo = String(e && e.message || e);
    }
    prAnotar_(g, nombre, rechazo ? 'OK' : 'FALLA',
      rechazo || 'ACEPTO una fila sin responsable', rechazo ? 'rechazado' : 'aceptado', 'rechazado');
  });

  prCorrer_(g, 'El RAA no acepta un indicador inventado', function () {
    var nombre = 'El RAA no acepta un indicador inventado';
    var rechazo = '';
    try {
      guardarRaa('', { ind: 'loquesea', analisis: 'x', accion: 'x', responsable: 'Juanma' });
    } catch (e) {
      rechazo = String(e && e.message || e);
    }
    prAnotar_(g, nombre, rechazo ? 'OK' : 'FALLA',
      rechazo || 'ACEPTO un indicador que no existe', rechazo ? 'rechazado' : 'aceptado', 'rechazado');
  });

  // ------------------------------------------------- 6. la puerta de finanzas
  prCorrer_(g, 'Las funciones de finanzas piden el token primero', function () {
    var nombre = 'Las funciones de finanzas piden el token primero';
    // Se lee el CODIGO, no la documentacion. getFinanzasData vivio sin control
    // de acceso hasta el 12-sep-2026 y la bateria no lo vio porque la vista la
    // llamaba con notacion de corchetes —run['getFinanzasData']()— y el barrido
    // de Pruebas.gs solo reconoce run.nombre(). Esta prueba mira la funcion.
    var FN = ['getFinanzasData', 'refrescarFinanzas', 'getMetasData',
              'getComparativoData', 'getRaaData', 'guardarRaa', 'getCajaData'];
    var sinGuarda = FN.filter(function (n) {
      var fn = globalThis[n];
      if (typeof fn !== 'function') return true;
      return String(fn).indexOf('exigirModulo_') === -1;
    });
    prAnotar_(g, nombre, sinGuarda.length === 0 ? 'OK' : 'FALLA',
      sinGuarda.length ? 'sin exigirModulo_: ' + sinGuarda.join(' · ') : FN.length + ' funciones',
      FN.length - sinGuarda.length, FN.length);
  });

  // ------------------------------------ 7. tanda 1 de Finanzas, 15-sep-2026
  prCorrer_(g, 'Toda categoria de mercaderia tiene area', function () {
    var nombre = 'Toda categoria de mercaderia tiene area';
    // C6 de la auditoria: LICORES sumaba al food cost y no entraba en ningun techo de
    // compra, porque _compra() descarta en silencio lo que no tiene area.
    var cats = FIN_COGS_CATS.concat(FIN_EFECTIVO);
    if (!cats.length) {
      prAnotar_(g, nombre, 'FALLA', 'las listas de categorias estan vacias', 0, '>0');
      return;
    }
    var faltan = cats.filter(function (c) { return !FIN_AREA_CAT[c]; });
    prAnotar_(g, nombre, faltan.length ? 'FALLA' : 'OK',
      faltan.length ? 'sin area: ' + faltan.join(' · ') : cats.length + ' categorias, todas con area',
      cats.length - faltan.length, cats.length);
  });

  prCorrer_(g, 'Un numero escrito como texto se lee', function () {
    var nombre = 'Un numero escrito como texto se lee';
    // M17: Number('1,234.50') es NaN y se volvia 0 sin avisar.
    var casos = [['1,234.50', 1234.5], ['Q 1,000', 1000], [' 250 ', 250], [1234.5, 1234.5],
                 ['', 0], ['abc', 0]];
    var mal = casos.filter(function (c) { return _finNum_(c[0]) !== c[1]; })
      .map(function (c) { return JSON.stringify(c[0]) + ' dio ' + _finNum_(c[0]); });
    prAnotar_(g, nombre, mal.length ? 'FALLA' : 'OK',
      mal.length ? mal.join(' · ') : casos.length + ' casos', casos.length - mal.length, casos.length);
  });

  prCorrer_(g, 'Una fecha con hora cae en su dia verdadero', function () {
    var nombre = 'Una fecha con hora cae en su dia verdadero';
    // p120: las filas guardadas a las 22:00/23:00 son del dia siguiente (verificado
    // contra el POS y la SAT). Datos de prueba, no del maestro.
    var casos = [[new Date(2026, 2, 31, 23, 0), '01/04/2026'], [new Date(2026, 0, 24, 22, 0), '25/01/2026'],
                 [new Date(2026, 8, 7, 0, 0), '07/09/2026'], [new Date(2026, 8, 7, 2, 0), '07/09/2026']];
    var mal = casos.filter(function (c) { return _finFecha_(_finDia_(c[0])) !== c[1]; })
      .map(function (c) { return c[1] + ' dio ' + _finFecha_(_finDia_(c[0])); });
    prAnotar_(g, nombre, mal.length ? 'FALLA' : 'OK',
      mal.length ? mal.join(' · ') : casos.length + ' casos', casos.length - mal.length, casos.length);
  });

  prCorrer_(g, 'Ninguna fecha del maestro trae hora', function () {
    var nombre = 'Ninguna fecha del maestro trae hora';
    // El calculo ya las lleva a su dia (regla 10): esto no cambia numeros. Avisa que
    // hay dato sucio, o que la zona horaria del Sheet dejo de ser la del script.
    var ss = SpreadsheetApp.openById(FIN_MAESTRO_ID);
    var total = 0, conHora = [];
    [['01_FEL_Maestro', 1], ['02_Ventas_Maestro', 2], ['03_Banco_Industrial', 1],
     ['04_Banco_BAC', 1], ['05_Tarjeta_Credito_BAC', 1]].forEach(function (H) {
      var sh = ss.getSheetByName(H[0]);
      if (!sh || sh.getLastRow() < FIN_PRIMERA_FILA) return;
      var col = sh.getRange(FIN_PRIMERA_FILA, H[1], sh.getLastRow() - FIN_PRIMERA_FILA + 1, 1).getValues();
      var n = 0;
      col.forEach(function (x) {
        if (!_finEsFecha_(x[0])) return;
        total++;
        if (x[0].getHours() || x[0].getMinutes()) n++;
      });
      if (n) conHora.push(H[0] + ': ' + n);
    });
    if (!total) {
      prAnotar_(g, nombre, 'SALTADA', 'no se leyo ninguna fecha', 0, '>0');
      return;
    }
    prAnotar_(g, nombre, conHora.length ? 'AVISO' : 'OK',
      conHora.length
        ? conHora.join(' · ') + ' de ' + total + ' fechas. Correr revisarFechasConHora() en el maestro; ' +
          'si son casi todas, cambio la zona horaria del Sheet.'
        : total + ' fechas, todas a medianoche',
      conHora.length, 0);
  });

  prCorrer_(g, 'Un mes sin planilla usa la ultima cargada', function () {
    var nombre = 'Un mes sin planilla usa la ultima cargada';
    // A14, decision de Juanma del 15-sep-2026. Datos de prueba, no del maestro.
    var v = { 1: 100, 2: 200, 5: 500 };
    var casos = [[v, 2, 200, 'planilla'], [v, 3, 200, 'estimada'], [v, 12, 500, 'estimada'],
                 [{ 4: 40 }, 2, 40, 'estimada'], [{}, 6, 0, 'sin dato']];
    var mal = casos.filter(function (c) {
      var r = _finUltimoDevengado_(c[0], c[1]);
      return r.valor !== c[2] || r.origen !== c[3];
    }).map(function (c) { return 'mes ' + c[1] + ' dio ' + JSON.stringify(_finUltimoDevengado_(c[0], c[1])); });
    var est = d.meses.filter(function (m) { return m.labor_origen === 'estimada'; })
      .map(function (m) { return m.mes + ' con la de ' + m.labor_desde; });
    prAnotar_(g, nombre, mal.length ? 'FALLA' : 'OK',
      mal.length ? mal.join(' · ')
                 : casos.length + ' casos' + (est.length ? ' · hoy se estima ' + est.join(', ') : ''),
      casos.length - mal.length, casos.length);
  });

  prCorrer_(g, 'UNIFORMES es un bloque propio', function () {
    var nombre = 'UNIFORMES es un bloque propio';
    // M20: dentro de Nomina y salarios se perdia, porque esa nomina se reemplaza por la
    // planilla devengada. Juanma, 15-sep-2026: bloque propio.
    var ok = !!(FIN_MAP.UNIFORMES && FIN_MAP.UNIFORMES[0] === 'Uniformes' && FIN_REF.Uniformes);
    prAnotar_(g, nombre, ok ? 'OK' : 'FALLA',
      ok ? 'Uniformes Q' + Math.round((d.total.bloques || {}).Uniformes || 0) + ' en el año'
         : 'FIN_MAP.UNIFORMES = ' + JSON.stringify(FIN_MAP.UNIFORMES), ok ? 1 : 0, 1);
  });

  prCorrer_(g, 'Una factura anulada no suma', function () {
    var nombre = 'Una factura anulada no suma';
    // Regla 13 (15-sep-2026): el calculo leia el FEL sin mirar la columna Estado y
    // sumaba como gasto las facturas anuladas en SAT. Las formulas del maestro ya
    // filtraban "Vigente" desde el 2-sep; este motor y generar_finanzas.py no.
    var destino = _finDestino_('ANULADA', '01_FEL_Maestro', false, '');
    var ok = _finEn_(FIN_FUERA, 'ANULADA') && destino === 'anulada en SAT';
    var an = (d.integridad && d.integridad.anuladas) || { n: 0, q: 0 };
    prAnotar_(g, nombre, ok ? 'OK' : 'FALLA',
      (ok ? '' : 'destino "' + destino + '" · ') + an.n + ' anuladas fuera del calculo por Q' + Math.round(an.q),
      ok ? 1 : 0, 1);
  });

  // ------------------------------------------- 8. caja (tanda 2, 15-sep-2026)
  var cj = null;
  prCorrer_(g, 'La proyeccion de caja se calcula', function () {
    var nombre = 'La proyeccion de caja se calcula';
    cj = _cajaDatos_(_cajaOpciones_({ forzar: true }));
    var n = (cj && cj.fechas) ? cj.fechas.length : 0;
    prAnotar_(g, nombre, (cj && !cj.error && n >= 90) ? 'OK' : 'FALLA',
      (cj && cj.error) ? cj.error
        : n + ' dias desde el ' + (cj && cj.corte) + ' · el escenario base ' +
          ((cj && cj.escenarios.base.cruza_cero) ? 'cruza cero el ' + cj.escenarios.base.cruza_cero : 'no cruza cero'),
      n, '>=90');
  });
  if (cj && !cj.error) {
    prCorrer_(g, 'La caja arranca del saldo de los bancos', function () {
      var nombre = 'La caja arranca del saldo de los bancos';
      // La pantalla de la semana lee la columna Saldo; la caja lo reconstruye con los
      // movimientos. Si no coinciden, alguna fila del banco quedo sin cargar o fuera de orden.
      if (!d.caja) { prAnotar_(g, nombre, 'SALTADA', 'la semana no trae saldo con que comparar', 0, '>0'); return; }
      var dif = Math.abs(cj.saldo_inicial - d.caja);
      prAnotar_(g, nombre, dif <= 1 ? 'OK' : 'AVISO',
        'caja Q' + Math.round(cj.saldo_inicial) + ' · semana Q' + Math.round(d.caja) +
        (dif <= 1 ? '' : ' · la ultima semana con venta puede tener otro dia de cierre'), Math.round(dif), '<=1');
    });

    prCorrer_(g, 'Cada debito del banco cae en un grupo de la caja', function () {
      var nombre = 'Cada debito del banco cae en un grupo de la caja';
      var c = cj.supuestos.cobertura || {};
      if (!c.debitos) { prAnotar_(g, nombre, 'SALTADA', 'no hay debitos en la ventana de calibracion', 0, '>0'); return; }
      var dif = Math.abs(c.debitos - c.agrupados);
      prAnotar_(g, nombre, dif <= 1 ? 'OK' : 'FALLA',
        'Q' + Math.round(c.debitos) + ' de debitos · Q' + Math.round(c.agrupados) + ' en grupos o fuera', Math.round(dif), '<=1');
    });

    prCorrer_(g, 'Las semanas de la caja llevan su año', function () {
      var nombre = 'Las semanas de la caja llevan su año';
      var s = cj.semanas || [];
      if (!s.length) { prAnotar_(g, nombre, 'SALTADA', 'la proyeccion no trae semanas', 0, '>0'); return; }
      var mal = s.filter(function (x) { return x.clave !== x.anio * 100 + x.w || x.anio < 2026; });
      prAnotar_(g, nombre, mal.length ? 'FALLA' : 'OK',
        mal.length ? 'sin año correcto: ' + mal.map(function (x) { return x.clave; }).join(', ') : s.length + ' semanas con su año',
        s.length - mal.length, s.length);
    });

    prCorrer_(g, 'Los compromisos de la caja se leen de su pestana', function () {
      var nombre = 'Los compromisos de la caja se leen de su pestana';
      if ((cj.compromisos_avisos || []).length) {
        prAnotar_(g, nombre, 'FALLA', cj.compromisos_avisos.join(' · '), cj.compromisos_avisos.length, 0);
      } else if (cj.compromisos_origen !== 'hoja') {
        prAnotar_(g, nombre, 'AVISO', 'falta la pestana COMPROMISOS: se usan los de por defecto. Correr ' +
          'instalarCompromisos() una vez desde el editor', 0, 1);
      } else {
        prAnotar_(g, nombre, 'OK', cj.compromisos.length + ' compromisos de la pestana', cj.compromisos.length, '>0');
      }
    });
  }

  // La prueba 'Ninguna vista llama al servidor con corchetes' (5 vistas de este
  // pilar) se retiro el 12-sep-2026 por decision de Juanma: la reemplaza 'Ninguna
  // vista llama al servidor con el nombre en una variable', en Pruebas.js, que usa
  // _prLlamadasConCorchetes_ (abajo) sobre las 25 vistas.
}


/**
 * Lineas donde una vista llama al servidor con el nombre en una variable:
 * google.script.run.withSuccessHandler(...)[nombre](...).
 *
 * POR QUE NO ES UNA REGEX. La primera version buscaba un corchete dentro de los
 * 400 caracteres siguientes a google.script.run. Corrida sobre las 25 vistas del
 * proyecto (12-sep-2026) dio 4 coincidencias y 3 eran falsas: el corchete de un
 * array o de un objeto DENTRO del handler (`conChat[k] = 1`,
 * `window.__POS_CACHE__[semanas]`). Una prueba que grita por lo que no es deja
 * de mirarse, y asi se murio el barrido anterior.
 *
 * Esta recorre la cadena de handlers con los parentesis balanceados (saltando lo
 * que va entre comillas) y marca SOLO si el primer caracter despues del ultimo
 * parentesis es un corchete. Sobre las mismas 25 vistas: 1 coincidencia, la
 * real. Y sigue cazando el bug original de FinanzasVista, que tenia un
 * withFailureHandler de varias lineas antes del corchete.
 */
function _prLlamadasConCorchetes_(txt) {
  var out = [], re = /google\.script\.run\b/g, m;
  function linea(i) { return txt.slice(0, i).split('\n').length; }
  while ((m = re.exec(txt))) {
    var i = m.index + m[0].length;
    for (;;) {
      while (i < txt.length && /\s/.test(txt.charAt(i))) i++;
      var h = /^\.\s*(withSuccessHandler|withFailureHandler|withUserObject)\s*\(/.exec(txt.slice(i, i + 40));
      if (!h) break;
      i += h[0].length;
      var prof = 1, cita = null;
      for (; i < txt.length && prof > 0; i++) {
        var c = txt.charAt(i);
        if (cita) { if (c === '\\') i++; else if (c === cita) cita = null; continue; }
        if (c === '"' || c === "'" || c === '`') { cita = c; continue; }
        if (c === '(') prof++; else if (c === ')') prof--;
      }
    }
    while (i < txt.length && /\s/.test(txt.charAt(i))) i++;
    if (txt.charAt(i) === '[') out.push(linea(i));
  }
  return out;
}
