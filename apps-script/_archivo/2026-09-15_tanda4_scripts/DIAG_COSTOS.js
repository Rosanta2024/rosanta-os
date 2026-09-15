/**
 * DIAG_COSTOS.gs — Que costos faltan en los dos recetarios. Solo lectura.
 *
 * UNA sola funcion en el archivo, por la misma razon que Diagnostico.gs y
 * EstadoRecetarios.gs: el desplegable del editor no fija la seleccion y Run
 * termina corriendo la primera funcion del archivo abierto.
 *
 * Responde tres preguntas, por area:
 *   1. Que fichas de venta NO tienen costo (o lo tienen en cero).
 *   2. Que fichas no tienen precio de menu, y por tanto no tienen CMV.
 *   3. Que insumos del BANCO DE DATOS estan sin precio o con precio sospechoso.
 *
 * OJO con las SUB-RECETAS: cordiales, siropes, macerados e infusiones tienen
 * costo pero NO precio de menu, y eso es correcto: no se venden, se usan. Se
 * listan aparte para no confundirlas con un hueco.
 */
function verCostosFaltantes() {
  soloDueno_();
  var L = [];
  function log(s) { L.push(s); Logger.log(s); }

  var props = PropertiesService.getScriptProperties().getProperties();
  [['COCINA', 'RECETARIO_COCINA_SHEET_ID'], ['BARRA', 'RECETARIO_BARRA_SHEET_ID']]
    .forEach(function (par) {
      var area = par[0], id = props[par[1]];
      log('');
      log('===== ' + area + ' =====');
      if (!id) { log('  falta la propiedad ' + par[1]); return; }

      var ss;
      try { ss = SpreadsheetApp.openById(id); }
      catch (e) { log('  no se pudo abrir: ' + e.message); return; }
      log('  ' + ss.getName());

      var sinCosto = [], sinPrecio = [], subrecetas = [], lineasCero = [], ok = 0;

      ss.getSheets().forEach(function (h) {
        var nom = h.getName();
        if (_dcNoEsFicha_(nom)) return;

        var v = h.getRange(1, 1, Math.min(h.getLastRow(), 60),
                           Math.min(h.getLastColumn(), 8)).getValues();
        var precio = null, costo = null, cmv = null;
        for (var r = 0; r < v.length; r++) {
          for (var c = 0; c < v[r].length; c++) {
            var t = String(v[r][c] || '').toUpperCase();
            var nums = [];
            for (var k = c + 1; k < v[r].length; k++) {
              if (typeof v[r][k] === 'number') nums.push(v[r][k]);
            }
            if ((t.indexOf('PRECIO MEN') === 0 || t.indexOf('PRECIO MENU') === 0) && nums.length) precio = nums[0];
            if (t.indexOf('COSTO TOTAL') === 0 && nums.length) costo = nums[nums.length - 1];
            if (t.indexOf('CMV % ACTUAL') === 0 && nums.length) cmv = nums[nums.length - 1];
          }
        }

        // Si un insumo no tiene precio en el BANCO, su linea cuesta CERO y el
        // plato sale mas barato de lo que es. No rompe nada visible: el CMV se
        // calcula igual, solo que mintiendo hacia abajo. Se busca aqui mismo,
        // sobre los valores YA leidos: releer las 60 pestañas revienta el
        // servicio de Spreadsheets.
        var cIng = -1, cCant = -1, cTot = -1;
        for (var r3 = 0; r3 < v.length && cIng < 0; r3++) {
          for (var c3 = 0; c3 < v[r3].length; c3++) {
            var u3 = String(v[r3][c3] || '').toUpperCase();
            if (u3.indexOf('INGREDIENTE') === 0) cIng = c3;
            if (u3.indexOf('CANTIDAD') === 0) cCant = c3;
            if (u3.indexOf('TOTAL') === 0) cTot = c3;
          }
        }
        if (cIng >= 0 && cCant >= 0 && cTot >= 0) {
          for (var r4 = 0; r4 < v.length; r4++) {
            var ing = String(v[r4][cIng] || '').trim();
            if (!ing) continue;
            if (ing.toUpperCase().indexOf('SUBTOTAL') === 0) break;
            var cant4 = v[r4][cCant], tot4 = v[r4][cTot];
            if (typeof cant4 === 'number' && cant4 > 0 && (!tot4 || tot4 === 0)) {
              lineasCero.push(nom + '  ->  ' + ing + '  (cantidad ' + cant4 + ')');
            }
          }
        }

        if (!costo) { sinCosto.push(nom); return; }        // costo cero o ausente: ESO es el hueco
        if (!precio) { subrecetas.push(nom + ' (costo Q' + costo.toFixed(2) + ')'); return; }
        if (cmv === null) { sinPrecio.push(nom); return; }
        ok++;
      });

      log('  fichas con costo Y precio Y CMV: ' + ok);

      log('');
      log('  LINEAS DE FICHA QUE CUESTAN CERO (' + lineasCero.length + '):');
      log('     Cada una hace que su plato salga mas barato de lo que es.');
      if (!lineasCero.length) log('     ninguna');
      lineasCero.slice(0, 60).forEach(function (x) { log('     ' + x); });

      log('');
      log('  SIN COSTO (' + sinCosto.length + ') - estas SI son un hueco:');
      if (!sinCosto.length) log('     ninguna');
      sinCosto.forEach(function (n) { log('     ' + n); });

      log('');
      log('  con costo pero SIN precio de menu (' + subrecetas.length + '):');
      log('     Son sub-recetas si no se venden. Si alguna SI se vende, le falta el precio.');
      subrecetas.forEach(function (n) { log('     ' + n); });

      if (sinPrecio.length) {
        log('');
        log('  con costo y precio pero SIN celda de CMV (' + sinPrecio.length + '):');
        sinPrecio.forEach(function (n) { log('     ' + n); });
      }

      // ---- el banco de datos
      var banco = ss.getSheetByName('BANCO DE DATOS');
      if (!banco) { log(''); log('  no hay pestana BANCO DE DATOS'); return; }
      var b = banco.getDataRange().getValues();
      var cab = -1;
      for (var i = 0; i < Math.min(b.length, 10); i++) {
        for (var j = 0; j < b[i].length; j++) {
          if (String(b[i][j]).toUpperCase().indexOf('PRODUCTO') === 0) { cab = i; break; }
        }
        if (cab >= 0) break;
      }
      if (cab < 0) { log(''); log('  no se hallo el encabezado del BANCO DE DATOS'); return; }

      var col = {};
      b[cab].forEach(function (t, j) {
        var u = String(t).toUpperCase();
        if (u.indexOf('PRODUCTO') === 0) col.prod = j;
        if (u.indexOf('PRECIO / UNIDAD') === 0 || u.indexOf('PRECIO/UNIDAD') === 0) col.pu = j;
        if (u.indexOf('PRECIO COMPRA') === 0) col.pc = j;
      });

      var sinP = [], vistos = {}, repetidos = [], duplicados = [];
      for (var r2 = cab + 1; r2 < b.length; r2++) {
        var nom2 = String(b[r2][col.prod] || '').trim();
        if (!nom2) continue;
        var pu = b[r2][col.pu], pc = b[r2][col.pc];
        if (!(typeof pu === 'number' && pu > 0)) sinP.push(nom2);
        var k2 = nom2.toUpperCase();

        // Dos correcciones del 10-sep-2026, encontradas cuando MARILUNA salio
        // reportada "con precio distinto" teniendo Q101.19 en las dos filas:
        //   1. La presencia se registra APARTE del precio. Antes la condicion era
        //      `if (dup[k2])`, que evalua el precio guardado: un producto repetido
        //      cuyo primer precio fuera 0, vacio o texto no se detectaba nunca.
        //   2. Ahora si se comparan los precios, y se separan en dos listas. No es
        //      el mismo problema: precios distintos es una ambiguedad que ensucia
        //      el costo, precios iguales es solo una fila que sobra.
        if (vistos.hasOwnProperty(k2)) {
          if (_dcMismoPrecio_(vistos[k2], pc)) {
            duplicados.push(nom2 + '  ->  fila repetida, ambas Q' + _dcQ_(pc));
          } else {
            repetidos.push(nom2 + '  ->  Q' + _dcQ_(vistos[k2]) + '  y  Q' + _dcQ_(pc));
          }
        } else {
          vistos[k2] = pc;
        }
      }

      log('');
      log('  BANCO DE DATOS: ' + (b.length - cab - 1) + ' insumos');
      log('  SIN precio por unidad de receta (' + sinP.length + '):');
      // En una sola linea y de a cinco: uno por linea el registro se vuelve
      // imposible de leer completo sin desplazarse veinte veces.
      if (!sinP.length) log('     ninguno');
      for (var z = 0; z < sinP.length; z += 5) {
        log('     ' + sinP.slice(z, z + 5).join('  ·  '));
      }

      log('  REPETIDOS con precio DISTINTO (' + repetidos.length + '):');
      log('     El VLOOKUP resuelve a uno de los dos y nadie sabe a cual.');
      if (!repetidos.length) log('     ninguno');
      repetidos.slice(0, 30).forEach(function (n) { log('     ' + n); });

      log('  REPETIDOS con el MISMO precio (' + duplicados.length + '):');
      log('     No mueven ningun costo. Es limpieza: sobra una fila.');
      if (!duplicados.length) log('     ninguno');
      duplicados.slice(0, 30).forEach(function (n) { log('     ' + n); });
    });

  return L.join('\n');
}

/** Q con dos decimales, y que se note cuando la celda viene vacia en vez de imprimir "Q". */
function _dcQ_(v) {
  if (typeof v === 'number') return v.toFixed(2);
  var s = String(v == null ? '' : v).trim();
  return s === '' ? '(vacio)' : s;
}

/** Dos precios son "el mismo" con tolerancia de medio centavo: comparar numeros
 *  con === falla por decimales que la hoja no muestra. */
function _dcMismoPrecio_(a, b) {
  if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b) < 0.005;
  return String(a == null ? '' : a).trim() === String(b == null ? '' : b).trim();
}

function _dcNoEsFicha_(nombre) {
  var n = String(nombre).toLowerCase().trim();
  var fuera = COSTEO.tabsNoReceta || [];
  for (var i = 0; i < fuera.length; i++) {
    if (n.indexOf(String(fuera[i]).toLowerCase()) === 0) return true;
  }
  return n.indexOf(String(COSTEO.prefijoArchivo || 'zz archivo').toLowerCase()) === 0;
}
