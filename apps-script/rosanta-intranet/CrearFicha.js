/**
 * CrearFicha.gs — Crear una receta desde cero.
 *
 * Es la escritura mas grande del sistema: crea una PESTAÑA entera y, si es un plato,
 * agrega una fila a RESUMEN CMV. Por eso vive en su propio archivo y no dentro de
 * EdicionRecetario.gs: cuando algo salga mal, conviene que se sepa donde mirar.
 *
 * DECISION DE JUANMA (25-ago-2026): el POS es independiente y se agrega a mano.
 * Esta funcion NO toca el POS ni exige la llave. Las columnas H y I de RESUMEN CMV
 * quedan vacias hasta que alguien de de alta el producto en la caja.
 *
 * Las dos plantillas salen de fichas reales de la v16, no de una idea de como
 * deberian ser: el plato de ENSALADA ROSANTA, el pre-elaborado de Uvas Maceradas.
 * Si alguien cambia la forma de las fichas, hay que cambiarlas aca tambien.
 *
 * UN PRE-ELABORADO SON DOS COSAS (22-sep-2026): la ficha que lo cuesta y la fila del
 * BANCO DE DATOS que deja que las recetas lo nombren. Hasta hoy esta funcion creaba
 * solo la ficha, y el alta en el Banco quedaba de tarea manual. Nadie la hacia. Juanma
 * creo el Aceite Albahaca, lo fue a poner en una receta y no aparecia en la lista:
 * agregarLinea_ rechaza todo lo que no este en el Banco, y la lista de la pantalla se
 * arma con el Banco. La ficha existia y no servia para nada. Ahora las dos salen
 * juntas, y el precio del Banco es una FORMULA al COSTO POR PORCION de la ficha: se
 * actualiza sola cada vez que cambian los ingredientes, que es la otra mitad del
 * problema —la hoja pedia por escrito que alguien la actualizara a mano.
 */

var FICHA_NUEVA = {
  lineasPlato: 15,          // f5..f19 en las fichas de plato
  lineasPre:   10,          // f5..f14 en los pre-elaborados
  mermaPct:    10,          // la merma estandar de cocina
  // la meta de la fila "PRECIO SUGERIDO" sale de PARAMETROS: ver metasFoodCost_
  hojaResumen: 'RESUMEN CMV',

  // Con que datos entra un pre-elaborado al Banco. El proveedor es el mismo que
  // llevan los que ya estaban —"Produccion Rosanta"—, asi la linea de la receta se
  // ve igual que las demas. La unidad es la porcion porque es lo que rinde la hoja;
  // si cocina lo mide en gramos, se cambia la unidad en el Banco y la ficha sigue.
  categoriaPre: 'PRODUCCION ROSANTA',
  proveedorPre: 'Produccion Rosanta',
  unidadPre:    'porcion'
};

/** Nombre de pestaña seguro, o tira explicando por que no lo es. */
function validarNombreFicha_(ss, nombre) {
  var n = String(nombre || '').trim();
  if (!n) throw new Error('Falta el nombre de la receta.');
  if (n.length > 90) throw new Error('El nombre es demasiado largo (maximo 90 caracteres).');

  // Google Sheets no acepta estos caracteres en el nombre de una pestaña.
  if (/[\[\]\*\/\\\?:]/.test(n)) {
    throw new Error('El nombre no puede llevar  [ ] * / \\ ? :  — son caracteres que Sheets no acepta en una pestaña.');
  }

  // Chocar con una pestaña existente, aunque sea con otras mayusculas.
  var hojas = ss.getSheets();
  for (var i = 0; i < hojas.length; i++) {
    if (normalizar_(hojas[i].getName()) === normalizar_(n)) {
      throw new Error('Ya existe una pestaña que se llama "' + hojas[i].getName() + '".');
    }
  }

  // Si el nombre cae en la lista de hojas de control, la ficha se leeria como
  // hoja de control y no apareceria nunca en la grilla. Falla en silencio: por eso
  // se bloquea aca en vez de dejar que pase.
  if (esHojaDeControl_(n)) {
    throw new Error('Ese nombre lo lee el sistema como hoja de control, no como receta. Elegi otro.');
  }
  return n;
}

/** Escapa el nombre para usarlo dentro de una formula. */
function nombreEnFormula_(n) {
  return "'" + String(n).replace(/'/g, "''") + "'";
}

/**
 * Crea una ficha vacia, lista para que cocina le cargue los ingredientes.
 *
 *   tipo      'plato' | 'preelaborado'
 *   categoria solo para plato: "Para empezar", "Algo mas fuerte", "Guarnicion"...
 *   precio    solo para plato: precio de carta
 *   rinde     solo para pre-elaborado: en cuantas porciones rinde el batch
 *
 * Devuelve { ok, pestana, tipo, filaResumen, filaBanco }.
 */
function crearFicha_(datos, quien, rol, area) {
  exigirPermiso_(rol, 'crearFicha');
  datos = datos || {};

  var tipo = normalizar_(datos.tipo) === 'preelaborado' ? 'preelaborado' : 'plato';
  var ss = recetarioDe_(area);

  // Los 35 platos usan MAYUSCULAS en la pestaña; los pre-elaborados, no.
  var nombre = validarNombreFicha_(ss, tipo === 'plato'
    ? String(datos.nombre || '').trim().toUpperCase()
    : String(datos.nombre || '').trim());

  var precio = Number(datos.precio), rinde = Number(datos.rinde);
  if (tipo === 'plato') {
    if (!(precio > 0)) throw new Error('El precio de carta tiene que ser mayor que cero.');
    if (!String(datos.categoria || '').trim()) throw new Error('Falta la categoria del plato.');
  } else {
    if (!(rinde > 0)) throw new Error('El rinde tiene que ser mayor que cero.');
  }

  var cfg = configArea_(areaValida_(area));
  var h = ss.insertSheet(nombre, ss.getSheets().length);
  var filaResumen = null, filaBanco = null, bancoYaEstaba = false;
  try {
    if (tipo === 'plato') {
      crearCuerpoPlato_(h, nombre, datos, precio, cfg);
      // RESUMEN CMV es de cocina. El recetario de barra no la tiene: sus platos se leen
      // directo de la ficha. Antes esto tiraba y la pestaña ya creada quedaba huerfana,
      // asi que el segundo intento contestaba "Ya existe una pestaña".
      if (ss.getSheetByName(FICHA_NUEVA.hojaResumen)) {
        filaResumen = agregarAlResumen_(ss, nombre, datos, precio);
      }
    } else {
      var celdaCosto = crearCuerpoPre_(h, nombre, datos, rinde);
      // El alta en el Banco va DENTRO del try, igual que la fila de RESUMEN CMV: un
      // pre-elaborado sin fila en el Banco es una ficha que ninguna receta puede usar,
      // y preferimos no crear nada antes que dejar esa media cosa.
      var alta = altaPreEnBanco_(ss, nombre, celdaCosto, FICHA_NUEVA.unidadPre);
      filaBanco = alta.fila;
      bancoYaEstaba = alta.yaEstaba;
    }
  } catch (e) {
    // Si algo falla a mitad de camino, no dejar una pestaña rota dando vueltas.
    ss.deleteSheet(h);
    throw e;
  }

  bitacora_(quien, rol, 'crearFicha', conArea_(nombre, area), nombre, tipo, '',
            tipo === 'plato' ? ('Q' + precio + ' · ' + datos.categoria) : (rinde + ' porciones'),
            tipo === 'plato'
              ? (filaResumen ? ('RESUMEN CMV fila ' + filaResumen) : 'sin fila en RESUMEN CMV')
              // Si ya habia una fila con ese nombre no se toco, y eso hay que poder verlo:
              // el precio que van a usar las recetas es el de esa fila, no el de la ficha.
              : ('BANCO DE DATOS fila ' + filaBanco + (bancoYaEstaba ? ' · ya existia, no se toco' : '')));
  // Un solo toque con las dos cosas: la pestaña nueva y la fila nueva del Banco. Sin el
  // `insumo` la pantalla no se entera del alta y el pre-elaborado no aparece en la
  // lista de ingredientes hasta la proxima recarga entera. Ver conCambiosDeModelo_.
  invalidarCache_(tipo === 'plato'
    ? { ficha: nombre, area: area }
    : { ficha: nombre, insumo: nombre, area: area });
  return { ok: true, pestana: nombre, tipo: tipo, filaResumen: filaResumen, filaBanco: filaBanco };
}

/**
 * Da de alta el pre-elaborado en el BANCO DE DATOS. Es lo que deja que las recetas lo
 * nombren: la lista de ingredientes de la pantalla se arma con el Banco, y agregarLinea_
 * rechaza cualquier producto que no este ahi.
 *
 * EL PRECIO ES UNA FORMULA, no un numero: apunta al COSTO POR PORCION de la ficha. Asi
 * el dia que cocina le cambie un ingrediente al pre-elaborado, todos los platos que lo
 * usan se recuestan solos. Con un numero escrito habria que acordarse de actualizarlo
 * —la propia hoja lo pedia por escrito y nadie lo hacia, que es como el Camembert
 * quedo con valor viejo.
 *
 * N() es lo que convierte el "" de una ficha todavia vacia en 0: leerBanco_ se saltea
 * las filas cuyo precio no sea un numero, y una fila salteada seria otra vez un
 * pre-elaborado que no aparece en la lista.
 *
 * PRECIO DE COMPRA y UNIDAD DE COMPRA quedan VACIAS a proposito. Es lo que hace que el
 * cierre de inventario y la sincronizacion de precios se lo salteen: un pre-elaborado
 * no se compra, se produce, y su precio sale de su ficha y de ningun otro lado.
 */
function altaPreEnBanco_(ss, pestana, celdaCosto, unidad) {
  var h = ss.getSheetByName(EDIT.hojaBanco);
  if (!h) throw new Error('El recetario no tiene la hoja ' + EDIT.hojaBanco + '.');
  if (!celdaCosto) {
    throw new Error('No pude ubicar el COSTO POR PORCION en la ficha "' + pestana + '".');
  }

  /* NO DUPLICAR. Se mira contra la HOJA, no contra el modelo, y por las dos vias con
     las que el Banco puede nombrar a una ficha:

       1. el mismo nombre. Si ya existe, no se toca: pisarla borraria un precio real.
          Puede estar ahi y ser invisible para el modelo —leerBanco_ saltea las filas
          cuyo precio no sea un numero—, y ese caso hay que verlo, no taparlo con una
          fila nueva. Por eso el aviso dice si la fila que ya esta tiene precio o no.

       2. un ALIAS de COSTEO.aliasSubReceta. El Banco dice "Pan de la casa" y la
          pestaña se llama "Pan de la Casa1". Sin este chequeo el alta agregaria una
          segunda entrada para el mismo pan, y de ahi en adelante habria dos precios
          para la misma preparacion sin que nadie sepa cual usa cada receta. */
  var f = h.getDataRange().getValues();
  var kPestana = normalizar_(pestana);
  for (var i = EDIT.filaPrimerDato - 1; i < f.length; i++) {
    var nombreFila = String(f[i][EDIT.col.producto - 1] || '').trim();
    if (!nombreFila) continue;
    var kFila = normalizar_(nombreFila);
    var alias = COSTEO.aliasSubReceta[kFila];
    if (kFila !== kPestana && !(alias && normalizar_(alias) === kPestana)) continue;
    return {
      fila: i + 1, yaEstaba: true, nombreEnBanco: nombreFila,
      porAlias: kFila !== kPestana,
      conPrecio: typeof f[i][EDIT.col.precioReceta - 1] === 'number'
    };
  }

  var u = String(unidad || FICHA_NUEVA.unidadPre).trim() || FICHA_NUEVA.unidadPre;
  var fila = h.getLastRow() + 1;
  h.getRange(fila, EDIT.col.categoria).setValue(FICHA_NUEVA.categoriaPre);
  h.getRange(fila, EDIT.col.producto).setValue(pestana);
  h.getRange(fila, EDIT.col.precioReceta).setFormula(
    '=IFERROR(N(' + nombreEnFormula_(pestana) + '!' + celdaCosto + '),0)');
  h.getRange(fila, EDIT.col.unidadReceta).setValue(u);
  h.getRange(fila, EDIT.col.conversion).setValue(
    'Costo por ' + u + ' de la ficha ' + pestana + ' (' + celdaCosto + '). Lo calcula la hoja: no se escribe a mano.');
  h.getRange(fila, EDIT.col.proveedor).setValue(FICHA_NUEVA.proveedorPre);
  return { fila: fila, yaEstaba: false };
}

/** La configuracion de un area (merma y meta de CMV) desde COSTEO.areas. */
function configArea_(area) {
  for (var i = 0; i < COSTEO.areas.length; i++) if (COSTEO.areas[i].area === area) return COSTEO.areas[i];
  throw new Error('Area desconocida: "' + area + '".');
}

/**
 * El cuerpo de una ficha de plato. Copiado de ENSALADA ROSANTA.
 * La merma sale del area (cocina 10%, barra 3%) y la meta de PARAMETROS (cocina 28%,
 * barra 20% al 14-sep-2026). La formula de la hoja sigue siendo sobre precio con IVA,
 * igual que en las demas fichas: la intranet calcula el suyo sin IVA. Antes iban
 * fijas en 10 y 30, y un coctel nuevo nacia costeado con la vara de cocina.
 */
function crearCuerpoPlato_(h, nombre, datos, precio, cfg) {
  var mermaPct = cfg ? cfg.merma : FICHA_NUEVA.mermaPct;
  var cmvObjetivo = metaDeArea_(cfg ? cfg.area : 'COCINA') / 100;
  var n = FICHA_NUEVA.lineasPlato, prim = 5, ult = prim + n - 1;   // 5..19
  var fSub = ult + 2;                                             // 21

  h.getRange('B1').setValue('FICHA DE RECETA — ' + nombre).setFontWeight('bold');
  h.getRange('B2').setValue(String(datos.categoria || '').trim());
  h.getRange('D2').setValue('PRECIO MENÚ:');
  h.getRange('E2').setValue(precio);
  if (String(datos.nota || '').trim()) h.getRange('B3').setValue(String(datos.nota).trim());

  h.getRange(4, 2, 1, 5).setValues([['INGREDIENTE', 'CANTIDAD', 'UNIDAD (= Banco de Datos)',
                                     'PRECIO UNIT. (auto)', 'TOTAL (Q.)']]).setFontWeight('bold');
  ponerFormulasDeLinea_(h, prim, ult);

  h.getRange(fSub,     2).setValue('SUBTOTAL MATERIA PRIMA');
  h.getRange(fSub,     6).setFormula('=SUM(F' + prim + ':F' + ult + ')');
  h.getRange(fSub + 1, 2).setValue('VARIACIÓN / MERMA (' + mermaPct + '%)');
  h.getRange(fSub + 1, 6).setFormula('=IFERROR(F' + fSub + '*' + (mermaPct / 100) + ',"")');
  h.getRange(fSub + 2, 2).setValue('COSTO TOTAL');
  h.getRange(fSub + 2, 6).setFormula('=IFERROR(F' + fSub + '+F' + (fSub + 1) + ',"")');
  h.getRange(fSub + 3, 2).setValue('PRECIO SUGERIDO (CMV ' + Math.round(cmvObjetivo * 100) + '%)');
  h.getRange(fSub + 3, 6).setFormula('=IFERROR(F' + (fSub + 2) + '/' + cmvObjetivo + ',"")');
  h.getRange(fSub + 4, 2).setValue('CMV % ACTUAL');
  h.getRange(fSub + 4, 6).setFormula('=IFERROR(F' + (fSub + 2) + '/E2,"")');
  h.getRange(fSub + 4, 6).setNumberFormat('0.0%');

  h.setColumnWidth(2, 260); h.setColumnWidth(4, 190); h.setColumnWidth(5, 150);
}

/**
 * El cuerpo de un pre-elaborado. Copiado de Uvas Maceradas.
 * Devuelve la celda del COSTO POR PORCION ('F18'): es a donde apunta la formula de
 * precio que altaPreEnBanco_ le pone a su fila del Banco.
 */
function crearCuerpoPre_(h, nombre, datos, rinde) {
  var n = FICHA_NUEVA.lineasPre, prim = 5, ult = prim + n - 1;    // 5..14
  var fBatch = ult + 2;                                           // 16

  h.getRange('B1').setValue('PRE-ELABORADO — ' + nombre.toUpperCase()).setFontWeight('bold');
  h.getRange('B2').setValue('PRODUCCION ROSANTA');
  h.getRange('D2').setValue('RINDE:');
  h.getRange('E2').setValue(rinde + ' porciones');
  if (String(datos.nota || '').trim()) h.getRange('B3').setValue(String(datos.nota).trim());

  h.getRange(4, 2, 1, 5).setValues([['INGREDIENTE', 'CANTIDAD', 'UNIDAD',
                                     'PRECIO UNIT. (auto)', 'TOTAL (Q.)']]).setFontWeight('bold');
  ponerFormulasDeLinea_(h, prim, ult);

  h.getRange(fBatch,     2).setValue('COSTO TOTAL DEL BATCH');
  h.getRange(fBatch,     6).setFormula('=SUM(F' + prim + ':F' + ult + ')');
  h.getRange(fBatch + 1, 2).setValue('RINDE (porciones)');
  h.getRange(fBatch + 1, 6).setValue(rinde);
  h.getRange(fBatch + 2, 2).setValue('COSTO POR PORCION');
  h.getRange(fBatch + 2, 6).setFormula('=IFERROR(F' + fBatch + '/F' + (fBatch + 1) + ',"")');
  h.getRange(fBatch + 4, 2).setValue(
    'El precio de este pre-elaborado en BANCO DE DATOS sale de esta celda por formula: no se escribe a mano.');

  h.setColumnWidth(2, 260); h.setColumnWidth(4, 190); h.setColumnWidth(5, 150);
  return h.getRange(fBatch + 2, 6).getA1Notation();
}

/**
 * Las dos formulas que lleva cada linea de ingrediente, en blanco.
 * Son EXACTAMENTE las que usan las fichas que ya existen: si se cambian aca y no
 * alla, las fichas nuevas van a costear distinto que las viejas sin que se note.
 */
function ponerFormulasDeLinea_(h, desde, hasta) {
  var filas = [];
  for (var r = desde; r <= hasta; r++) {
    filas.push([
      '=IFERROR(VLOOKUP(B' + r + ",'BANCO DE DATOS'!$C:$D,2,0),\"\")",
      '=IFERROR(IF(AND(B' + r + '<>"",C' + r + '<>"",E' + r + '<>""),C' + r + '*E' + r + ',""),"")'
    ]);
  }
  // Una sola escritura para todas (14-sep-2026). Eran dos setFormula por linea: 30
  // llamadas al servicio para una ficha de plato. Las formulas no cambiaron.
  h.getRange(desde, 5, filas.length, 2).setFormulas(filas);
}

/**
 * Agrega el plato a RESUMEN CMV, justo despues del ultimo plato.
 *
 * No se puede usar appendRow: abajo de la tabla hay filas de nota, y el plato
 * quedaria despues de ellas. Se busca la ultima fila que tenga pestaña en la
 * columna K y se inserta ahi.
 */
function agregarAlResumen_(ss, pestana, datos, precio) {
  var hR = ss.getSheetByName(FICHA_NUEVA.hojaResumen);
  if (!hR) throw new Error('El recetario no tiene la hoja ' + FICHA_NUEVA.hojaResumen + '.');
  var f = hR.getDataRange().getValues();

  var ultima = null;
  for (var i = 0; i < f.length; i++) if (String(f[i][10] || '').trim()) ultima = i + 1;  // K
  if (!ultima) throw new Error('No pude ubicar donde termina la tabla de ' + FICHA_NUEVA.hojaResumen + '.');

  hR.insertRowAfter(ultima);
  var fila = ultima + 1, ref = nombreEnFormula_(pestana);

  hR.getRange(fila, 2).setValue(String(datos.nombreVisible || pestana).trim());
  hR.getRange(fila, 3).setValue(String(datos.categoria || '').trim());
  hR.getRange(fila, 4).setValue(precio);
  hR.getRange(fila, 5).setFormula('=IFERROR(' + ref + '!F23,0)');
  hR.getRange(fila, 6).setFormula('=IFERROR(' + ref + '!F23/' + ref + '!E2,"")');
  hR.getRange(fila, 6).setNumberFormat('0.0%');
  // H (nombre en el POS) e I (llave) quedan VACIAS: el POS se maneja aparte.
  hR.getRange(fila, 10).setValue('por costear');
  hR.getRange(fila, 11).setValue(pestana);
  return fila;
}

/* ==========================================================================
   LOS PRE-ELABORADOS QUE NADIE PUEDE USAR — 22-sep-2026

   Hasta hoy crear un pre-elaborado creaba la ficha y nada mas. Los que se crearon
   asi existen en el recetario y no existen para las recetas: no estan en el Banco,
   no aparecen en la lista de ingredientes y agregarLinea_ los rechaza. El Aceite
   Albahaca es el que lo hizo notar; abajo estan las dos herramientas para verlos y
   para darles el alta que les falto. La bateria de pruebas los vigila de ahora en
   mas ("Pre-elaborados que ninguna receta puede usar", grupo 2).
   ========================================================================== */

/**
 * La celda donde la ficha tiene su costo unitario, y con que nombre lo llama.
 * En las fichas nuevas es siempre F18, pero las 41 que ya estaban las escribio gente
 * distinta en momentos distintos: cocina dice "COSTO POR PORCION" y barra "COSTO POR
 * ml" o "COSTO POR GRAMO", y no siempre en la misma fila. Se busca por etiqueta, igual
 * que leerFicha_, y nunca por posicion.
 *
 * Devuelve { a1, unidad } o null si la ficha no tiene esa fila.
 */
function celdaCostoPorUnidad_(hoja) {
  var rango = hoja.getDataRange();
  var f = rango.getValues(), fx = rango.getFormulas();
  for (var i = 0; i < f.length; i++) {
    for (var j = 0; j < f[i].length; j++) {
      if (normalizar_(f[i][j]).indexOf('costo por') !== 0) continue;
      for (var c = j + 1; c < f[i].length; c++) {
        // el numero o la formula que lo calcula: cualquiera de las dos sirve de ancla
        if (typeof f[i][c] === 'number' || String(fx[i][c] || '').trim()) {
          var u = String(f[i][j]).replace(/costo\s+por/i, '').replace(/[():]/g, '').trim();
          return { a1: hoja.getRange(i + 1, c + 1).getA1Notation(), unidad: u || FICHA_NUEVA.unidadPre };
        }
      }
    }
  }
  return null;
}

/**
 * Los pre-elaborados que tienen ficha y no tienen fila en el Banco. Solo LEE.
 *
 * El enlace no se mira por nombre a mano: se usa el que ya arma el modelo. insumo.sub
 * es la ficha a la que apunta cada fila del Banco, directo o por COSTEO.aliasSubReceta,
 * asi que un pre-elaborado que el Banco nombra distinto ("Pan de la casa" contra la
 * pestaña "Pan de la Casa1") NO cuenta como huerfano y no se duplica.
 *
 * `modelo` es para quien ya tiene uno armado —la bateria de pruebas—: construirlo
 * cuesta las dos hojas enteras y no hay por que hacerlo dos veces.
 *
 * SIN modelo se CONSTRUYE uno, no se usa el cacheado. La diferencia costo un error
 * real el 22-sep-2026: el caché tenía una foto vieja del Banco donde "Pan de la casa"
 * todavia no enganchaba con su ficha, esta funcion lo reporto como huerfano y el alta
 * le creo una fila duplicada. Una herramienta que despues ESCRIBE no puede decidir
 * sobre una lectura de hace horas; que tarde los 40 segundos que tenga que tardar.
 */
function preelaboradosSinBanco_(modelo) {
  var m = modelo || construirModelo_();
  var alcanzada = {};
  m.insumos.forEach(function (i) { if (i.sub !== null) alcanzada[i.sub] = true; });
  return m.recetas.filter(function (r) {
    return r.tipo === 'preelaborado' && !alcanzada[r.id];
  }).map(function (r) {
    return { area: r.area, nombre: r.nombre, rinde: r.rinde,
             costoUnit: r.costoUnit, unidadCosto: r.unidadCosto || FICHA_NUEVA.unidadPre };
  });
}

/** Herramienta de editor: los lista y no toca nada. */
function revisarPreelaboradosSinBanco() {
  soloDueno_();
  var lista = preelaboradosSinBanco_();
  if (!lista.length) {
    Logger.log('Todos los pre-elaborados tienen su fila en el Banco. No hay nada que hacer.');
    return lista;
  }
  Logger.log('%s pre-elaborado(s) que ninguna receta puede usar:', lista.length);
  lista.forEach(function (p) {
    Logger.log('  %s > %s%s', p.area, p.nombre,
               p.costoUnit != null
                 ? (' · Q' + (Math.round(p.costoUnit * 100) / 100) + ' por ' + p.unidadCosto)
                 : ' · todavia sin costo');
  });
  Logger.log('Para darles el alta: darDeAltaPreelaboradosSinBanco()');
  return lista;
}

/**
 * Herramienta de editor: les da de alta la fila del Banco a los que salen arriba.
 * ESCRIBE. Correr antes revisarPreelaboradosSinBanco() y mirar la lista.
 *
 * `soloEstos` (opcional) limita el alta a uno o varios nombres. Desde el editor no se
 * pueden pasar parametros, asi que sin nada hace toda la lista: por eso el dry run va
 * primero y no al reves. Barra tiene su propia deuda de cordiales y mermeladas que
 * nunca entraron al Banco (ver PRUEBAS_CFG.huerfanos), y eso conviene mirarlo antes
 * de darle el alta a todo junto.
 *
 * Una ficha sin fila de COSTO POR ... se saltea y se reporta: sin esa celda no hay a
 * donde apuntar la formula, y un precio inventado es peor que ninguno.
 */
function darDeAltaPreelaboradosSinBanco(soloEstos) {
  soloDueno_();
  var filtro = null;
  if (soloEstos) {
    filtro = {};
    [].concat(soloEstos).forEach(function (n) { filtro[normalizar_(n)] = true; });
  }
  var lista = preelaboradosSinBanco_().filter(function (p) {
    return !filtro || filtro[normalizar_(p.nombre)];
  });
  var hechos = [], saltados = [];

  lista.forEach(function (p) {
    try {
      var ss = recetarioDe_(p.area);
      var hoja = fichaDe_(ss, p.nombre);
      var celda = celdaCostoPorUnidad_(hoja);
      if (!celda) { saltados.push(p.area + ' > ' + p.nombre + ': la ficha no tiene fila de COSTO POR ...'); return; }
      var alta = altaPreEnBanco_(ss, hoja.getName().trim(), celda.a1, celda.unidad);
      if (alta.yaEstaba) {
        // Que diga POR QUE se salteo y que mirar: una fila que ya esta y no tiene
        // precio es un problema distinto —y peor— que una que si lo tiene.
        saltados.push(p.area + ' > ' + p.nombre + ': el Banco ya lo nombra en la fila ' + alta.fila +
          ' como "' + alta.nombreEnBanco + '"' + (alta.porAlias ? ' (por alias)' : '') +
          (alta.conPrecio ? ' · esa fila tiene precio, no se toco'
                          : ' · ESA FILA NO TIENE PRECIO NUMERICO: por eso el modelo no la ve. Revisala a mano.'));
        return;
      }
      hechos.push(p.area + ' > ' + hoja.getName().trim() + ' · fila ' + alta.fila + ' · por ' + celda.unidad);
      bitacora_(DUENO_CORREO_, 'dueno', 'altaPreEnBanco', conArea_(EDIT.hojaBanco, p.area),
                hoja.getName().trim(), 'alta', '', 'costo por ' + celda.unidad,
                'reparacion: la ficha existia sin fila en el Banco');
    } catch (e) {
      saltados.push(p.area + ' > ' + p.nombre + ': ' + String(e && e.message || e));
    }
  });

  if (hechos.length) olvidarModeloCosteo_();
  Logger.log('Dados de alta: %s', hechos.length ? hechos.join(' · ') : 'ninguno');
  if (saltados.length) Logger.log('Saltados: %s', saltados.join(' · '));
  return { alta: hechos, saltados: saltados };
}

/**
 * Herramienta de editor: las filas del Banco que EXISTEN y el modelo NO VE, y los
 * nombres duplicados por alias. Solo LEE.
 *
 * Nacio el 22-sep-2026, de la reparacion de los pre-elaborados: 16 filas de barra se
 * saltearon con un "ya habia una fila con ese nombre" y sin embargo ninguna receta
 * podia usarlas. Una fila puede estar escrita en la hoja y ser invisible para todo el
 * sistema —leerBanco_ la saltea— y eso no daba error en ningun lado: el ingrediente
 * simplemente no aparecia, igual que si no existiera.
 *
 * Repite el criterio de leerBanco_ a proposito: si alla cambia una regla, aca tambien,
 * o este diagnostico empieza a mentir.
 */
function revisarBancoInvisible() {
  soloDueno_();
  var total = 0;

  COSTEO.areas.forEach(function (cfg) {
    var ss = abrirPorClave_(cfg.clave);
    if (!ss) return;
    var h = ss.getSheetByName(EDIT.hojaBanco);
    if (!h) { Logger.log('%s: no tiene hoja %s', cfg.area, EDIT.hojaBanco); return; }

    var f = h.getDataRange().getValues(), colDe = null, filaHeader = -1;
    for (var i = 0; i < f.length && colDe === null; i++) {
      for (var j = 0; j < f[i].length; j++) {
        if (normalizar_(f[i][j]) === 'categoria' && normalizar_(f[i][j + 1]) === 'producto') {
          colDe = j; filaHeader = i; break;
        }
      }
    }
    if (colDe === null) { Logger.log('%s: no encuentro el encabezado CATEGORIA/PRODUCTO', cfg.area); return; }

    var invisibles = [], separadoras = [], vistos = {}, porNombre = {};
    for (i = filaHeader + 1; i < f.length; i++) {
      var categoria = String(f[i][colDe] || '').trim();
      var producto  = String(f[i][colDe + 1] || '').trim();
      var precio    = f[i][colDe + 2];
      if (!producto) continue;                                   // fila en blanco: no es un caso
      var k = normalizar_(producto);
      (porNombre[k] = porNombre[k] || []).push(i + 1);

      var motivo = null;
      if (!categoria)                                   motivo = 'SIN CATEGORIA';
      else if (normalizar_(categoria) === k) {
        /* leerBanco_ las saltea como "fila separadora de categoria". Se reportan
           aparte y no como error: casi siempre lo son. Pero una fila de PRODUCTO a la
           que alguien le repitio el nombre en CATEGORIA cae aca y desaparece del
           sistema igual que las otras, sin ruido. Taparlas fue un hueco del primer
           diagnostico (22-sep-2026): el "Pan de la casa" se escondia justo ahi. */
        separadoras.push('fila ' + (i + 1) + ' · ' + producto);
        motivo = null;
      }
      else if (typeof precio !== 'number' || isNaN(precio)) {
        motivo = 'PRECIO NO NUMERICO (' + (precio === '' ? 'vacio' : '"' + String(precio) + '"') + ')';
      }
      else if (vistos.hasOwnProperty(k))                motivo = 'DUPLICADO: manda la fila ' + vistos[k];
      else vistos[k] = i + 1;

      if (motivo) invisibles.push('fila ' + (i + 1) + ' · ' + producto + ' · ' + motivo);
    }

    Logger.log('--- %s · %s filas invisibles para el modelo', cfg.area, invisibles.length);
    invisibles.forEach(function (x) { Logger.log('   %s', x); });
    total += invisibles.length;

    if (separadoras.length) {
      Logger.log('   (%s filas que el lector toma como separadora de categoria, porque CATEGORIA = PRODUCTO:)', separadoras.length);
      separadoras.forEach(function (x) { Logger.log('      %s', x); });
    }

    // El mismo pre-elaborado nombrado dos veces: la fila con el nombre que usa el
    // Banco y la fila con el nombre de la pestaña. Las recetas no saben cual usar.
    Object.keys(COSTEO.aliasSubReceta).forEach(function (clave) {
      var valor = normalizar_(COSTEO.aliasSubReceta[clave]);
      // Muchos alias son identidades ('fresas maceradas' -> 'Fresas Maceradas'): la
      // clave y el valor normalizan igual y la fila se comparaba contra si misma.
      // Salian doce duplicados que no existian (22-sep-2026).
      if (valor === clave) return;
      if (porNombre[clave] && porNombre[valor]) {
        Logger.log('   DUPLICADO POR ALIAS en %s: "%s" (fila %s) y "%s" (fila %s) son la misma preparacion',
                   cfg.area, clave, porNombre[clave].join('/'), valor, porNombre[valor].join('/'));
        total++;
      }
    });
  });

  Logger.log('Total de casos: %s', total);
  return total;
}

/* ==========================================================================
   LAS FILAS QUE EXISTEN Y ESTAN VACIAS — 22-sep-2026

   La otra mitad del mismo problema. Un pre-elaborado puede fallar de dos formas:
   no tener fila en el Banco (lo resuelve darDeAltaPreelaboradosSinBanco) o TENERLA
   con el precio en blanco. Lo segundo es peor porque parece estar: la fila se ve en
   la hoja, y leerBanco_ la saltea sin decir nada porque su precio no es un numero.
   Asi vivian 16 pre-elaborados de barra —cordiales, bitters, macerados— y el mousse
   base de cocina. Ninguna receta los podia nombrar y ninguna prueba lo notaba.

   El arreglo es el mismo que usa una ficha nueva: el precio pasa a ser una formula
   al COSTO POR ... de su ficha. Nunca un numero escrito a mano.
   ========================================================================== */

/**
 * Filas del Banco con el precio VACIO que corresponden a un pre-elaborado con ficha.
 * Solo LEE. Devuelve [{ area, fila, producto, ficha, celda, unidad }].
 *
 * Tres candados, porque esto despues escribe:
 *   - la celda del precio tiene que estar vacia de verdad: ni numero ni formula. Una
 *     fila con precio es una fila que alguien decidio, y no se toca.
 *   - el nombre tiene que resolver a una ficha de PRE-ELABORADO de la misma area,
 *     directo o por alias. Sin esto "Mousse de Chocolate" engancharia con el PLATO
 *     del mismo nombre y le pondriamos a un insumo el costo de un plato entero.
 *   - la ficha tiene que tener su fila de COSTO POR ...: es a donde apunta la formula.
 */
function preciosVaciosDePreelaborados_() {
  // construirModelo_ y no modeloCosteo_: mismo motivo que en preelaboradosSinBanco_.
  // Lo que sale de aca termina en una escritura, asi que se lee la hoja de verdad.
  var m = construirModelo_(), pendientes = [];
  var fichaPre = {};
  m.recetas.forEach(function (r) {
    if (r.tipo === 'preelaborado') fichaPre[r.area + '|' + normalizar_(r.nombre)] = r.nombre;
  });

  COSTEO.areas.forEach(function (cfg) {
    var ss = abrirPorClave_(cfg.clave);
    if (!ss) return;
    var h = ss.getSheetByName(EDIT.hojaBanco);
    if (!h) return;
    var rango = h.getDataRange();
    var f = rango.getValues(), fx = rango.getFormulas();

    for (var i = EDIT.filaPrimerDato - 1; i < f.length; i++) {
      var producto = String(f[i][EDIT.col.producto - 1] || '').trim();
      if (!producto) continue;
      var precio = f[i][EDIT.col.precioReceta - 1];
      if (typeof precio === 'number' && !isNaN(precio)) continue;          // ya tiene precio
      if (String(fx[i][EDIT.col.precioReceta - 1] || '').trim()) continue; // ya tiene formula

      var k = normalizar_(producto);
      var nombreFicha = fichaPre[cfg.area + '|' + k];
      if (!nombreFicha) {
        var alias = COSTEO.aliasSubReceta[k];
        if (alias) nombreFicha = fichaPre[cfg.area + '|' + normalizar_(alias)];
      }
      if (!nombreFicha) continue;

      var celda = celdaCostoPorUnidad_(fichaDe_(ss, nombreFicha));
      if (!celda) continue;
      pendientes.push({ area: cfg.area, fila: i + 1, producto: producto,
                        ficha: nombreFicha, celda: celda.a1, unidad: celda.unidad });
    }
  });
  return pendientes;
}

/** Herramienta de editor: las lista y no toca nada. */
function revisarPreciosVaciosDePreelaborados() {
  soloDueno_();
  var lista = preciosVaciosDePreelaborados_();
  if (!lista.length) {
    Logger.log('Ninguna fila de pre-elaborado quedo sin precio. No hay nada que hacer.');
    return lista;
  }
  Logger.log('%s fila(s) del Banco con el precio vacio que son un pre-elaborado con ficha:', lista.length);
  lista.forEach(function (p) {
    Logger.log('   %s fila %s · %s  ->  ficha "%s" %s (costo por %s)',
               p.area, p.fila, p.producto, p.ficha, p.celda, p.unidad);
  });
  Logger.log('Para llenarlas: rellenarPreciosVaciosDePreelaborados()');
  return lista;
}

/**
 * Herramienta de editor: les pone la formula al COSTO POR ... de su ficha. ESCRIBE.
 * Correr antes revisarPreciosVaciosDePreelaborados() y mirar la lista.
 *
 * Tambien escribe la UNIDAD DE RECETA si estaba vacia: un precio por ml sin decir que
 * es por ml es media informacion, y agregarLinea_ copia esa unidad a la receta.
 */
function rellenarPreciosVaciosDePreelaborados(soloEstos) {
  soloDueno_();
  var filtro = null;
  if (soloEstos) {
    filtro = {};
    [].concat(soloEstos).forEach(function (n) { filtro[normalizar_(n)] = true; });
  }
  var lista = preciosVaciosDePreelaborados_().filter(function (p) {
    return !filtro || filtro[normalizar_(p.producto)];
  });
  var hechos = [];

  lista.forEach(function (p) {
    var h = recetarioDe_(p.area).getSheetByName(EDIT.hojaBanco);
    h.getRange(p.fila, EDIT.col.precioReceta).setFormula(
      '=IFERROR(N(' + nombreEnFormula_(p.ficha) + '!' + p.celda + '),0)');
    if (!String(h.getRange(p.fila, EDIT.col.unidadReceta).getValue() || '').trim()) {
      h.getRange(p.fila, EDIT.col.unidadReceta).setValue(p.unidad);
    }
    hechos.push(p.area + ' fila ' + p.fila + ' · ' + p.producto + ' · por ' + p.unidad);
    bitacora_(DUENO_CORREO_, 'dueno', 'precioDeFicha', conArea_(EDIT.hojaBanco, p.area),
              p.producto, 'precio unidad receta', '', 'formula a ' + p.ficha + '!' + p.celda,
              'reparacion: la fila existia con el precio vacio');
  });

  if (hechos.length) olvidarModeloCosteo_();
  Logger.log('Llenadas: %s', hechos.length ? hechos.length : 'ninguna');
  hechos.forEach(function (x) { Logger.log('   %s', x); });
  return hechos;
}
