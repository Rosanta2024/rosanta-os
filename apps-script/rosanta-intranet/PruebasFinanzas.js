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

  /* La regla 9 se retiro el 23-sep-2026 y con ella esta prueba, que vigilaba su unico
     modo de falla: un proveedor de la lista que cobrara mas de lo que facturaba hacia
     desaparecer la diferencia del DRE. Ya no hay lista ni salto — la regla 15 casa cada
     pago con su factura antes de saltarlo, asi que un pago sin factura cuenta como
     gasto. Lo que ahora cubre ese terreno es "La factura manda: el pago con factura no
     suma", mas arriba en este mismo grupo. */
  prCorrer_(g, 'Los proveedores de la regla 9 siguen facturando', function () {
    var nombre = 'Los proveedores de la regla 9 siguen facturando';
    var viva = typeof FIN_PAGO_DE_FACTURA !== 'undefined';
    prAnotar_(g, nombre, viva ? 'AVISO' : 'OK',
      viva ? 'la regla 9 volvio a estar viva: esta prueba hay que reactivarla'
           : 'retirada el 23-sep-2026: la cubre la regla 15 (la factura manda)');
  });

  // --------------------------------------------------------- 4. equilibrio
  //
  // Un mes con margen de contribucion <= 0 NO es un fallo de calculo: es un mes
  // que no llega al equilibrio a ningun volumen. Desde el 22-sep-2026 el motor
  // devuelve bev null en ese caso y aca sale como AVISO, para que se vea en vez
  // de esconderse detras de un Q0.
  prCorrer_(g, 'El punto de equilibrio es un numero usable', function () {
    var nombre = 'El punto de equilibrio es un numero usable';
    var rotos = [], inalcanzables = [];
    d.meses.forEach(function (m) {
      if (!(m.fijo > 0) || m.mc === null || m.mc === undefined || m.mc >= 100) {
        rotos.push(m.mes);
      } else if (m.mc <= 0 || m.bev === null) {
        inalcanzables.push(m.mes);
      }
    });
    var buenos = d.meses.length - rotos.length - inalcanzables.length;
    prAnotar_(g, nombre,
      rotos.length ? 'FALLA' : (inalcanzables.length ? 'AVISO' : 'OK'),
      rotos.length
        ? 'meses sin fijo o con margen imposible: ' + rotos.join(', ')
        : (inalcanzables.length
            ? 'equilibrio no alcanzable a ningun volumen en: ' + inalcanzables.join(', ') +
              ' (margen de contribucion <= 0)'
            : d.meses.length + ' meses con fijo, margen y equilibrio'),
      buenos, d.meses.length);
  });

  // La prueba que faltaba, y por la que el error del margen vivio hasta el
  // 22-sep-2026: la de arriba verifica que el equilibrio sea CALCULABLE, no que
  // sea COHERENTE. Un mes que vendio por encima de su equilibrio tiene que
  // haber dado resultado positivo; si vendio por debajo, negativo. Cuando el
  // margen no restaba el gasto variable, los NUEVE meses daban holgura positiva
  // en un año que cerro en perdida, y la bateria seguia en verde.
  prCorrer_(g, 'El equilibrio concuerda con el resultado del mes', function () {
    var nombre = 'El equilibrio concuerda con el resultado del mes';
    var comparables = d.meses.filter(function (m) {
      // Sin equilibrio alcanzable o sin resultado no hay nada que comparar.
      if (m.bev === null || m.bev === undefined || !(m.bev > 0)) return false;
      if (m.netop === null || m.netop === undefined) return false;
      // Un mes que cae justo SOBRE el equilibrio no dice nada...
      if (Math.abs(m.ventas - m.bev) <= m.ventas * 0.02) return false;
      // ...y uno cuyo RESULTADO es practicamente cero, tampoco. Falto esta
      // mitad en la primera version (22-sep-2026): abril cerro en 0.0% —puede
      // ser +Q80 sobre Q159,917— y la prueba leyo ese signo como si fuera una
      // señal. Con el resultado en el ruido, el signo no informa nada, igual
      // que con la venta pegada al equilibrio. El umbral es medio punto de la
      // venta del mes.
      if (Math.abs(m.netop) < 0.5) return false;
      return true;
    });
    if (!comparables.length) {
      prAnotar_(g, nombre, 'SALTADA',
        'ningun mes tiene equilibrio alcanzable y resultado con que compararlo', 0, 0);
      return;
    }
    var fuera = d.meses.length - comparables.length;
    var mal = comparables.filter(function (m) {
      return (m.ventas > m.bev) !== (m.netop > 0);
    }).map(function (m) {
      // Con los NUMEROS. Un "vendio bajo el equilibrio y el resultado fue
      // positivo" sin cifras no se puede diagnosticar: no se sabe si es un mes
      // pegado al borde o una incoherencia de verdad, y obliga a adivinar.
      return m.mes + ': vendio Q' + Math.round(m.ventas).toLocaleString('es-GT') +
             ' contra un equilibrio de Q' + Math.round(m.bev).toLocaleString('es-GT') +
             ' (' + (m.ventas > m.bev ? '+' : '-') +
             'Q' + Math.round(Math.abs(m.ventas - m.bev)).toLocaleString('es-GT') + ')' +
             ' y el resultado fue ' + m.netop + '% (Q' +
             Math.round(m.ventas * m.netop / 100).toLocaleString('es-GT') + ')' +
             ' · fijo Q' + Math.round(m.fijo).toLocaleString('es-GT') +
             ' · margen ' + m.mc + '%';
    });
    prAnotar_(g, nombre, mal.length === 0 ? 'OK' : 'FALLA',
      mal.length ? 'meses incoherentes: ' + mal.join(', ')
                 : comparables.length + ' meses coherentes' +
                   (fuera ? ' · ' + fuera + ' fuera de comparacion (pegados al ' +
                            'equilibrio o con resultado en cero)' : ''),
      comparables.length - mal.length, comparables.length);
  });

  // -------------------------------------------------------- 4b. presupuesto
  //
  // La pestana PRESUPUESTO es OPCIONAL: sin ella la pantalla cae a la banda del
  // sector y lo dice. Lo que NO puede pasar en silencio es que este puesta y no
  // se aplique, que es lo que ocurre si el nombre de una seccion no calza
  // exacto con el bloque del DRE o si nace un bloque nuevo sin su fila.
  prCorrer_(g, 'El presupuesto por seccion calza con los bloques del DRE', function () {
    var nombre = 'El presupuesto por seccion calza con los bloques del DRE';
    var P = d.presupuesto;
    if (!P) {
      prAnotar_(g, nombre, 'FALLA',
        'getFinanzasData no devolvio presupuesto: falta _finPresupuesto_ en la salida', 0, 1);
      return;
    }
    if (P.error) {
      prAnotar_(g, nombre, 'FALLA', 'no se pudo leer: ' + P.error, 0, 1);
      return;
    }
    if (!P.existe) {
      prAnotar_(g, nombre, 'SALTADA',
        'la pestana ' + PRESU_HOJA + ' no existe todavia: correr instalarPresupuesto()', 0, 0);
      return;
    }
    var puestas = Object.keys(P.secciones || {});
    var bloques = Object.keys(FIN_REF);
    // Un bloque con gasto en el año y sin presupuesto no es una falla —Juanma
    // puede decidir no presupuestarlo— pero si es un aviso: se esta midiendo
    // contra la banda del sector sin haberlo elegido.
    var conGasto = d.bloques.filter(function (b) { return b.q > 0; })
      .map(function (b) { return b.bloque; });
    var sinPresu = conGasto.filter(function (b) { return puestas.indexOf(b) === -1; });

    if (P.desconocidas && P.desconocidas.length) {
      prAnotar_(g, nombre, 'FALLA',
        'la hoja tiene secciones que no son bloques del DRE y no se aplican a nada: ' +
        P.desconocidas.join(', ') + '. Los bloques validos son: ' + bloques.join(', '),
        puestas.length, puestas.length + P.desconocidas.length);
      return;
    }
    prAnotar_(g, nombre, sinPresu.length ? 'AVISO' : 'OK',
      sinPresu.length
        ? sinPresu.length + ' bloque(s) con gasto en el año y sin presupuesto, midiendose ' +
          'contra la banda del sector: ' + sinPresu.join(', ')
        : puestas.length + ' secciones presupuestadas, todas calzan con su bloque del DRE',
      conGasto.length - sinPresu.length, conGasto.length);
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
              'getComparativoData', 'getRaaData', 'guardarRaa', 'getCajaData', 'getCmvRealTeorico'];
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
    var destino = _finDestino_('ANULADA', '01_FEL_Maestro', false, false);
    var ok = _finEn_(FIN_FUERA, 'ANULADA') && destino === 'anulada en SAT';
    var an = (d.integridad && d.integridad.anuladas) || { n: 0, q: 0 };
    prAnotar_(g, nombre, ok ? 'OK' : 'FALLA',
      (ok ? '' : 'destino "' + destino + '" · ') + an.n + ' anuladas fuera del calculo por Q' + Math.round(an.q),
      ok ? 1 : 0, 1);
  });

  prCorrer_(g, 'Una factura ajena queda fuera a proposito', function () {
    var nombre = 'Una factura ajena queda fuera a proposito';
    // 21-sep-2026 (Juanma): FACTURA_AJENA no es del restaurante ni personal. Sin la
    // categoria en FIN_FUERA caeria en CATEGORIA DESCONOCIDA y saldria como fuga.
    var destino = _finDestino_('FACTURA_AJENA', '01_FEL_Maestro', false, false);
    var ok = _finEn_(FIN_FUERA, 'FACTURA_AJENA') && destino === 'fuera (a proposito)';
    prAnotar_(g, nombre, ok ? 'OK' : 'FALLA', 'destino "' + destino + '"', ok ? 1 : 0, 1);
  });

  prCorrer_(g, 'La factura manda: el pago con factura no suma', function () {
    var nombre = 'La factura manda: el pago con factura no suma';
    // Regla 15 (21-sep-2026, Juanma): prioridad a la factura; el banco solo si no hay
    // factura. Primero el casador con datos de juguete, con sus controles negativos;
    // despues el dato real, que no puede venir vacio.
    var F = [{ dia: 100, q: 2000, bloque: 'Prestadores y honorarios', llave: 'f1', orden: 1 },
             { dia: 100, q: 550,  bloque: 'Bienes de uso',            llave: 'f2', orden: 2 }];
    var P = [{ dia: 100, q: 2000, bloque: 'Prestadores y honorarios', llave: 'casa', orden: 1 },
             { dia: 101, q: 2000, bloque: 'Prestadores y honorarios', llave: 'segundo pago, misma factura', orden: 2 },
             { dia: 100, q: 550,  bloque: 'Mantencion',               llave: 'otro bloque', orden: 3 },
             { dia: 100 + FIN_FM_DIAS_ANTES + 1, q: 550, bloque: 'Bienes de uso', llave: 'fuera de ventana', orden: 4 },
             { dia: 100, q: 551,  bloque: 'Bienes de uso',            llave: 'otro monto', orden: 5 }];
    var c = _finCasarPagos_(F, P), llaves = Object.keys(c);
    var juguete = llaves.length === 1 && c['casa'] === 'f1';
    var fm = (d.integridad && d.integridad.factura_manda) || { n: 0, q: 0 };
    var destino = _finDestino_('SERVICIOS_PROFESIONALES', '03_Banco_Industrial', false, true);
    var espejo = destino === 'REGLA 15: tiene factura FEL';
    var ok = juguete && espejo && fm.n > 0;
    prAnotar_(g, nombre, ok ? 'OK' : 'FALLA',
      !juguete ? 'el casador caso ' + JSON.stringify(c) + ' y debia casar solo "casa" con f1'
      : !espejo ? 'destino "' + destino + '"'
      : !fm.n ? 'ningun pago del año caso con su factura: el casador no esta corriendo sobre el maestro'
      : fm.n + ' pagos con factura fuera del calculo por Q' + Math.round(fm.q),
      ok ? 1 : 0, 1);
  });

  // ------------------------------- 9. food cost sin servicio (tanda 3, 15-sep-2026)
  // Regla 14, decision de Juanma: la meta y las fichas no llevan el 10% de servicio y
  // la venta de Finanzas si. Medido contra la venta total, el food cost salia ~9% corto.
  prCorrer_(g, 'El food cost va sobre la venta sin servicio', function () {
    var nombre = 'El food cost va sobre la venta sin servicio';
    var t = d.total || {};
    if (!t.ventas_ss) {
      prAnotar_(g, nombre, 'FALLA', 'el calculo no trae la venta sin servicio (ventas_ss)', 0, '>0');
      return;
    }
    var factor = t.ventas / t.ventas_ss;
    var mal = d.meses.filter(function (m) {
      return !m.ventas_ss || Math.abs(m.cogsp - m.cogs / m.ventas_ss * 100) > 0.06;
    }).map(function (m) { return m.mes + ' ' + m.cogsp + '%'; });
    var ok = !mal.length && factor > 1.05 && factor < 1.15 &&
             Math.abs(t.cogsp - t.cogs / t.ventas_ss * 100) <= 0.06;
    prAnotar_(g, nombre, ok ? 'OK' : 'FALLA',
      (mal.length ? 'meses sobre otra base: ' + mal.join(', ') + ' · ' : '') +
      'venta total / sin servicio = ' + factor.toFixed(3) + ' · food cost del año ' + t.cogsp + '%',
      Math.round(factor * 1000) / 1000, '1.05 a 1.15');
  });

  prCorrer_(g, 'Semanas y meses usan la misma venta sin servicio', function () {
    var nombre = 'Semanas y meses usan la misma venta sin servicio';
    var suma = 0, n = 0;
    (d.semanas || []).forEach(function (s) { if (s.ventas_ss) { suma += s.ventas_ss; n++; } });
    if (!n) {
      prAnotar_(g, nombre, 'FALLA', 'ninguna semana trae la venta sin servicio', 0, '>0');
      return;
    }
    var dif = Math.abs(suma - (d.total.ventas_ss || 0));
    prAnotar_(g, nombre, dif < 5 ? 'OK' : 'FALLA',
      n + ' semanas · diferencia contra el año Q' + dif.toFixed(2), Math.round(dif * 100) / 100, '<5');
  });

  prCorrer_(g, 'El prime cost sigue sobre la venta total', function () {
    var nombre = 'El prime cost sigue sobre la venta total';
    var mal = d.meses.filter(function (m) {
      return Math.abs(m.primep - (m.cogs + m.labor) / m.ventas * 100) > 0.06;
    }).map(function (m) { return m.mes + ' ' + m.primep + '%'; });
    prAnotar_(g, nombre, mal.length ? 'FALLA' : 'OK',
      mal.length ? 'sobre otra base: ' + mal.join(', ') : d.meses.length + ' meses sobre la venta total',
      d.meses.length - mal.length, d.meses.length);
  });

  // p96 parte B: la tarjeta real contra teorico del tablero de Profit OS.
  prCorrer_(g, 'El CMV real contra teorico se calcula', function () {
    var nombre = 'El CMV real contra teorico se calcula';
    var rt = _cmvRealTeorico_();
    if (!rt.ok) { prAnotar_(g, nombre, 'FALLA', rt.error, 0, 'ok'); return; }
    var b = rt.bloque;
    var sano = b.meses >= 1 && b.venta > 0 && b.teorico_pct > 15 && b.teorico_pct < 60 &&
               b.real_pct > 15 && b.real_pct < 80;
    prAnotar_(g, nombre, sano ? 'OK' : 'FALLA',
      b.desde + ' a ' + b.hasta + ' · real ' + b.real_pct + '% · teórico ' + b.teorico_pct +
      '% · brecha ' + b.brecha_pts + ' pts' + (b.inv_cocina ? '' : ' · cocina sin inventario') +
      (b.inv_barra ? '' : ' · barra sin inventario'),
      b.meses, '>=1');
  });

  // ------------------------------------------------ 10. tanda 4 (15-sep-2026)
  prCorrer_(g, 'El RAA guarda con candado', function () {
    var nombre = 'El RAA guarda con candado';
    // M9: dos guardados a la vez elegian la misma fila libre y uno se perdia.
    var txt = String(guardarRaa);
    var ok = txt.indexOf('tryLock') !== -1 && txt.indexOf('releaseLock') !== -1;
    prAnotar_(g, nombre, ok ? 'OK' : 'FALLA',
      ok ? 'guardarRaa toma y suelta el candado' : 'guardarRaa escribe sin LockService', ok ? 1 : 0, 1);
  });

  prCorrer_(g, 'El comparativo compara contra el año anterior', function () {
    var nombre = 'El comparativo compara contra el año anterior';
    // M15: el año iba escrito a mano y el 1 de enero habria comparado contra 2025.
    var cmp = _finComparativo_(d, new Date());
    if (cmp.error) { prAnotar_(g, nombre, 'FALLA', cmp.error, 0, 'sin error'); return; }
    var ok = cmp.anio === d.anio && cmp.anio_ant === d.anio - 1 && cmp.filas.length === 12;
    prAnotar_(g, nombre, ok ? 'OK' : 'FALLA',
      cmp.anio + ' contra ' + cmp.anio_ant + ' · ' + cmp.total.meses + ' meses comparables',
      cmp.anio_ant, d.anio - 1);
  });

  prCorrer_(g, 'Las ventas del año se leen igual que el calculo', function () {
    var nombre = 'Las ventas del año se leen igual que el calculo';
    // En 2027 el comparativo va a leer 2026 con este mismo lector. Se prueba hoy contra
    // el año en curso, que el calculo ya tiene.
    var v = _finVentasAnio_(d.anio);
    if (!v) { prAnotar_(g, nombre, 'FALLA', 'no leyo ventas de ' + d.anio, 0, d.meses.length); return; }
    var mal = d.meses.filter(function (m) {
      var x = v[m.m];
      return !x || Math.abs(x.ventas - m.ventas) > 0.05 || x.tickets !== m.tickets;
    }).map(function (m) { return m.mes; });
    prAnotar_(g, nombre, mal.length ? 'FALLA' : 'OK',
      mal.length ? 'distintos: ' + mal.join(', ') : d.meses.length + ' meses iguales en venta y tickets',
      d.meses.length - mal.length, d.meses.length);
  });

  prCorrer_(g, 'La respuesta de Finanzas cabe en el cache', function () {
    var nombre = 'La respuesta de Finanzas cabe en el cache';
    // M26: CacheService topa en 100 KB por clave y cache.put falla en silencio. Hoy pesa
    // ~25 KB; la alarma salta en 80 KB, antes de que cada apertura recalcule sin avisar.
    var kb = Math.round(JSON.stringify(d).length / 102.4) / 10;
    prAnotar_(g, nombre, kb < 80 ? 'OK' : 'FALLA', kb + ' KB de 100 KB', kb, '<80');
  });

  // ------------------------------------------- 11. tanda 5 (p142 y A11, 15-sep-2026)
  /* p142: hasta hoy la bateria solo LEIA estas plantillas con getRawContent(), asi que un
     scriptlet mal cerrado pasaba en verde y la pagina no cargaba en produccion. Paso en la
     v81 (12-sep-2026) y se cubrio a mano compilando cada plantilla. Aca se EVALUAN con los
     mismos datos que les pasa doGet, en sus DOS modos: con el boton "Panel principal" y
     embebidas en el shell, que es como las ve el equipo. */
  prCorrer_(g, 'Las vistas de Finanzas se dibujan', function () {
    var nombre = 'Las vistas de Finanzas se dibujan';
    var u = { email: 'prueba@rosanta.rest', nombre: 'Prueba', rol: 'dueno',
              modulos: ['finanzas'], puedeEditar: true };
    var base = urlIntranet_(), tok = 'token-de-prueba';

    function dibujar(vista, datos) {
      var tpl = HtmlService.createTemplateFromFile(vista);
      Object.keys(datos).forEach(function (k) { tpl[k] = datos[k]; });
      return String(tpl.evaluate().getContent() || '');
    }

    var casos = [];
    ['FinanzasVista', 'MetasVista', 'ComparativoVista', 'EscenariosVista', 'CajaVista']
      .forEach(function (v) {
        [true, false].forEach(function (volver) {
          casos.push([v + (volver ? ' con boton' : ' embebida'), v,
                      { usuario: u, urlBase: base, authToken: tok, mostrarVolver: volver }]);
        });
      });
    ['semana', 'metas', 'comparativo', 'escenarios', 'caja'].forEach(function (sub) {
      casos.push(['SistemaFinanzas sub=' + sub, 'SistemaFinanzas',
                  { usuario: u, urlBase: base, authToken: tok, sub: sub }]);
    });

    // El control negativo va PRIMERO: si dibujar una vista que no existe no falla, el
    // barrido de abajo no esta probando nada y esta prueba quedaria en verde sin mirar.
    var evaluadorVivo = false;
    try { dibujar('NoExisteVistaDeFinanzas', {}); } catch (e) { evaluadorVivo = true; }
    if (!evaluadorVivo) {
      prAnotar_(g, nombre, 'FALLA',
        'Dibujar una vista inexistente NO fallo: el evaluador no esta probando nada.',
        0, casos.length);
      return;
    }

    var malas = [];
    casos.forEach(function (c) {
      var html = '';
      try { html = dibujar(c[1], c[2]); }
      catch (e) { malas.push(c[0] + ': ' + String(e && e.message || e).slice(0, 90)); return; }
      if (html.length < 500) malas.push(c[0] + ': salio con ' + html.length + ' caracteres');
      else if (html.indexOf(tok) === -1) malas.push(c[0] + ': la pagina no lleva el token');
      else if (html.indexOf('<?=') > -1 || html.indexOf('<?!=') > -1) {
        malas.push(c[0] + ': quedo un scriptlet sin evaluar');
      }
    });

    prAnotar_(g, nombre, malas.length ? 'FALLA' : 'OK',
      malas.length ? malas.join(' · ')
                   : casos.length + ' dibujos: 5 vistas en sus dos modos y el shell en sus 5 pestañas',
      casos.length - malas.length, casos.length);
  });

  prCorrer_(g, 'La meta que muestra Metas es la de PARAMETROS', function () {
    var nombre = 'La meta que muestra Metas es la de PARAMETROS';
    // A11: instalarMetas() congelo la meta en la columna META_FOOD_PCT y _finMeta_ la
    // prefería. Cambiar PARAMETROS movia La semana y el RAA, y la tarjeta de Metas se
    // quedaba en el numero viejo. Se arreglo el 14-sep-2026 y ninguna prueba lo cuidaba.
    var par = _finMetaFood_();
    var mt = getMetasData('', false);
    if (!mt || mt.error) {
      prAnotar_(g, nombre, 'FALLA', 'Metas no contesto: ' + ((mt && mt.error) || 'sin dato'), 0, par);
      return;
    }
    var ok = Math.abs(mt.meta_food - par) < 0.001;
    prAnotar_(g, nombre, ok ? 'OK' : 'FALLA',
      'Metas dice ' + mt.meta_food + '% y PARAMETROS ' + par + '%' +
      (ok ? '' : '. La columna META_FOOD_PCT de la pestaña METAS volvio a mandar.'),
      mt.meta_food, par);
  });

  prCorrer_(g, 'Los honorarios de marketing van al bloque Marketing', function () {
    var nombre = 'Los honorarios de marketing van al bloque Marketing';
    // 15-sep-2026: MARKETING_HONORARIOS existe para que el CAC de Marketing OS excluya los
    // honorarios POR CATEGORIA y no por el texto del banco (las transferencias a Vanessa
    // dicen "BANCA ELECTRONICA"). Tiene que caer en el MISMO bloque que la pauta: el DRE
    // no cambia, solo se separa la categoria.
    var h = FIN_MAP.MARKETING_HONORARIOS, p = FIN_MAP.MARKETING_DIGITAL;
    var ok = !!h && !!p && h[0] === 'Marketing' && p[0] === 'Marketing';
    var q = Math.round((d.total.bloques || {}).Marketing || 0);
    prAnotar_(g, nombre, ok ? 'OK' : 'FALLA',
      ok ? 'las dos van a "' + h[0] + '" · el bloque lleva Q' + q + ' en el año'
         : 'mapa: honorarios ' + JSON.stringify(h) + ' · pauta ' + JSON.stringify(p),
      ok ? 2 : 0, 2);
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
