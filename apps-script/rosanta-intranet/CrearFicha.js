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
 */

var FICHA_NUEVA = {
  lineasPlato: 15,          // f5..f19 en las fichas de plato
  lineasPre:   10,          // f5..f14 en los pre-elaborados
  mermaPct:    10,          // la merma estandar de cocina
  cmvObjetivo: 0.30,        // para la fila "PRECIO SUGERIDO"
  hojaResumen: 'RESUMEN CMV'
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
 * Devuelve { ok, pestana, tipo, filaResumen }.
 */
function crearFicha(datos, quien, rol, area) {
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

  var h = ss.insertSheet(nombre, ss.getSheets().length);
  try {
    if (tipo === 'plato') crearCuerpoPlato_(h, nombre, datos, precio);
    else                  crearCuerpoPre_(h, nombre, datos, rinde);
  } catch (e) {
    // Si el cuerpo falla a mitad de camino, no dejar una pestaña rota dando vueltas.
    ss.deleteSheet(h);
    throw e;
  }

  var filaResumen = null;
  if (tipo === 'plato') filaResumen = agregarAlResumen_(ss, nombre, datos, precio);

  bitacora_(quien, rol, 'crearFicha', conArea_(nombre, area), nombre, tipo, '',
            tipo === 'plato' ? ('Q' + precio + ' · ' + datos.categoria) : (rinde + ' porciones'),
            filaResumen ? ('RESUMEN CMV fila ' + filaResumen) : 'sin fila en RESUMEN CMV');
  invalidarCache_();
  return { ok: true, pestana: nombre, tipo: tipo, filaResumen: filaResumen };
}

/** El cuerpo de una ficha de plato. Copiado de ENSALADA ROSANTA. */
function crearCuerpoPlato_(h, nombre, datos, precio) {
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
  h.getRange(fSub + 1, 2).setValue('VARIACIÓN / MERMA (' + FICHA_NUEVA.mermaPct + '%)');
  h.getRange(fSub + 1, 6).setFormula('=IFERROR(F' + fSub + '*' + (FICHA_NUEVA.mermaPct / 100) + ',"")');
  h.getRange(fSub + 2, 2).setValue('COSTO TOTAL');
  h.getRange(fSub + 2, 6).setFormula('=IFERROR(F' + fSub + '+F' + (fSub + 1) + ',"")');
  h.getRange(fSub + 3, 2).setValue('PRECIO SUGERIDO (CMV ' + (FICHA_NUEVA.cmvObjetivo * 100) + '%)');
  h.getRange(fSub + 3, 6).setFormula('=IFERROR(F' + (fSub + 2) + '/' + FICHA_NUEVA.cmvObjetivo + ',"")');
  h.getRange(fSub + 4, 2).setValue('CMV % ACTUAL');
  h.getRange(fSub + 4, 6).setFormula('=IFERROR(F' + (fSub + 2) + '/E2,"")');
  h.getRange(fSub + 4, 6).setNumberFormat('0.0%');

  h.setColumnWidth(2, 260); h.setColumnWidth(4, 190); h.setColumnWidth(5, 150);
}

/** El cuerpo de un pre-elaborado. Copiado de Uvas Maceradas. */
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
    'Actualiza el precio en BANCO DE DATOS > PRODUCCION ROSANTA cada vez que cambien los ingredientes.');

  h.setColumnWidth(2, 260); h.setColumnWidth(4, 190); h.setColumnWidth(5, 150);
}

/**
 * Las dos formulas que lleva cada linea de ingrediente, en blanco.
 * Son EXACTAMENTE las que usan las fichas que ya existen: si se cambian aca y no
 * alla, las fichas nuevas van a costear distinto que las viejas sin que se note.
 */
function ponerFormulasDeLinea_(h, desde, hasta) {
  for (var r = desde; r <= hasta; r++) {
    h.getRange(r, 5).setFormula(
      '=IFERROR(VLOOKUP(B' + r + ",'BANCO DE DATOS'!$C:$D,2,0),\"\")");
    h.getRange(r, 6).setFormula(
      '=IFERROR(IF(AND(B' + r + '<>"",C' + r + '<>"",E' + r + '<>""),C' + r + '*E' + r + ',""),"")');
  }
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
