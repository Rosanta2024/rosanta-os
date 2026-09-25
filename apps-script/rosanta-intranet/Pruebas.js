/**
 * Pruebas.gs — Bateria de chequeos de la intranet. NO ESCRIBE NADA.
 *
 * Por que existe: hasta hoy la unica forma de saber si la intranet esta sana era
 * que una persona mirara una pantalla y notara algo raro. Asi se descubrieron el
 * Camembert con valor viejo, el puente del POS que resolvia mal y el camote que se
 * leia como 12 gramos. Ninguno dio error. Los tres vivieron semanas.
 *
 * Como se corre:
 *   - desde el editor:   correrPruebas (con guarda de dueno). CORRER_PRUEBAS.gs se archivo el 15-sep-2026
 *   - desde la terminal: clasp run correrPruebasTexto   (necesita el proyecto de Cloud)
 *   - desde el navegador: la ruta ?page=pruebas
 *
 * Todo lo de aca dentro es privado (termina en _) menos tres, para no chocar con nada:
 * en Apps Script todos los .gs comparten un solo ambito global. Las publicas son
 * correrPruebas() —devuelve el objeto—, correrPruebasTexto() —devuelve el informe ya
 * armado, para leerlo desde la terminal con clasp run— y correrPruebasWeb() para la ruta.
 *
 * REGLA: ninguna prueba escribe. Si alguna necesitara escribir, va en otro archivo.
 */

var PRUEBAS_CFG = {
  /** Numeros que deben dar. Actualizar cuando cambie el recetario, a proposito. */
  esperado: {
    platosCocina:        35,
    preelaboradosCocina: 45,   // 22-sep-2026: 41 -> 45. Los que Jeffry y Juanma fueron
                               // creando desde la intranet (Aceite Albahaca, los dos
                               // yogures, Mousse Receta). No se habia vuelto a medir.
    conCmvCocina:        28,   // 22-sep-2026: 26 -> 28. Dos platos dejaron de costear en
                               // cero al entrar al Banco los pre-elaborados que les
                               // faltaban: MOUSSE DE CHOCOLATE es uno de ellos.
    vaciasCocina:         7,   // 22-sep-2026: 9 -> 7, por lo mismo
    platosMapeadosPOS:   35
  },

  /** CMV de control, en porcentaje SOBRE PRECIO SIN IVA. Tolerancia +-0.6 puntos.
      El 14-sep-2026 la ficha paso a medir sin IVA (decision de Juanma): son los
      valores de la v16 multiplicados por 1.12. La ensalada era 15.0. */
  control: {
    'ensalada rosanta'         : 16.8,   // v16: bajo de 15.9 a 15.0 (con IVA) al corregirse la gremolata
    'tabla de jamones y quesos': 25.3,
    'gratin de papas'          : 22.2,
    'mix de fritas'            : 26.4,
    'peras horneadas'          : 22.1
  },
  toleranciaCmv: 0.6,

  /**
   * Version del recetario que la intranet deberia estar leyendo.
   * Se compara contra el NOMBRE del documento. Si no coincide, media bateria
   * sale en rojo por la misma causa, y esta prueba lo dice de una vez.
   */
  recetarioEsperado: 'v16',

  /**
   * Lineas de ficha que apuntan a un producto que no esta en el Banco de su area.
   * No son cero y no deberian serlo todavia:
   *   COCINA 2:
   *     MOUSSE DE CHOCOLATE > Crema de Limon
   *        Falta la receta. Lo resuelve Jeffry.
   *     Zanahorias Rostizadas > ZANAHORIA BEBE
   *        Lo rompi yo en la v16: la fila del Banco se renombro a
   *        "ZZ DUP · Zanahoria Bebe" por duplicada, y la ficha dejo de
   *        encontrarla. NO afecta ningun costo: esa ficha trae el precio
   *        escrito a mano, no tiene fila propia en el Banco y ningun plato
   *        la consume. Se cierra cuando se decida si vale Q15 o Q10 la libra.
   *   BARRA 38 -> cordiales, sales y mermeladas de coctel que nunca se cargaron
   *               al Banco de barra. Es un trabajo aparte, no una regresion.
   * Si el numero SUBE, algo se rompio. Si BAJA, alguien avanzo: actualizar aca.
   */
  /* 22-sep-2026. COCINA 2 -> 1: la Crema de Limon del MOUSSE DE CHOCOLATE ya tiene su
     fila en el Banco; queda la ZANAHORIA BEBE de arriba, que sigue esperando decision.
     BARRA 38 -> 9: los 16 cordiales y macerados que estaban en el Banco con el precio
     vacio ahora lo calculan contra su ficha, y 7 mas que ni fila tenian entraron.
     Los 9 que quedan son nombres que no coinciden con el Banco, no filas faltantes:
     "Bitter Laurel", "GINSON", "CHLE PASA", "Viuda de Romero"... eso lo arregla quien
     sepa a que producto apunta cada uno. */
  huerfanos: { COCINA: 1, BARRA: 9 },

  /**
   * Lineas de ficha con cantidad pero SIN costo: la hoja no les puso numero.
   *
   * Por que hace falta aparte de `huerfanos`: son dos preguntas distintas.
   * `huerfanos` mide si el MODULO puede emparejar el nombre con el Banco. Esto
   * mide si la HOJA calculo un numero. Pueden discrepar, y cuando discrepan gana
   * el silencio: el VLOOKUP de las fichas viene envuelto en IFERROR(...,"") asi
   * que un fallo devuelve VACIO, no #N/A, y la prueba de formulas rotas —que
   * busca celdas que empiezan con '#'— no lo ve. El ingrediente queda en Q0.
   *
   * Asi vivieron sin que nadie los notara, hasta el 24-ago-2026. Los dos primeros
   * ya se corrigieron esa misma noche; quedan documentados porque explican para que
   * sirve esta prueba:
   *   Gremolata > PREJIL              50 g en Q0. El Banco tiene "Perejil"; la fila
   *                                   que se llamaba "Prejil" paso a "ZZ DUP · Prejil"
   *                                   al marcar duplicados y la ficha dejo de
   *                                   encontrarla. CORREGIDO: el batch paso de
   *                                   Q105.20 a Q110.20.
   *   Brisket Horneado > PIMENTA NEGRA 50 g en Q0, mismo caso con "Pimienta Negra".
   *                                   CORREGIDO: el batch paso de Q555.34 a Q568.57.
   *
   * Los 2 que quedan son las dos lineas del MOUSSE DE CHOCOLATE: falta el precio del
   * mousse base y la receta de la crema de limon. Eso lo destraba cocina, no un renombre.
   *
   * BARRA da 0, medido el 24-ago-2026. Vale la pena leerlo junto a sus 38
   * huerfanos: las fichas de barra traen el precio escrito a mano, asi que un
   * ingrediente que no engancha con el Banco igual queda costeado. Por eso alla
   * las dos pruebas miden cosas independientes y esos 38 no son plata invisible.
   * Con el esperado en 0, cualquier linea de barra que pierda su costo salta a FALLA.
   */
  /* COCINA 2 -> 0 el 22-sep-2026: las dos lineas del MOUSSE DE CHOCOLATE dejaron de
     valer cero. La Crema de Limon porque su ficha entro al Banco; el mousse base porque
     su fila del Banco, que estaba sin precio, se borro — ahora esa linea cuenta como
     huerfana, que es peor de ver y mejor de tener: un ingrediente "fuera del banco" se
     nota en la ficha, uno en Q0 no.

     BARRA 0 -> 1 el 23-sep-2026, con motivo y con dueno, no para que la prueba pase:
     CHARADA > CHILE PIMIENTO Y TE FERMENTADO. Juanma: que productos se retiran lo
     deciden Jose y Jeffry, y una linea sin precio significa que ese pre-elaborado o
     esta a medio costear o se va a eliminar. Es un pendiente de ellos, no una
     regresion del sistema.

     OJO AL CERRARLO: el 22-sep la ficha de CHILE PIMIENTO Y TE FERMENTADO SI tenia
     costo (Q0.03 por ml) y aun asi la linea de CHARADA vale cero. O sea que el coctel
     se esta costeando sin ese ingrediente y su CMV sale mas bajo de lo que es. Cuando
     Jose decida, correr revisarLineasSinCosto() —en este archivo— que abre las celdas
     y dice por que. Si el pre-elaborado se elimina, este numero vuelve a 0. */
  lineasSinCosto: { COCINA: 0, BARRA: 1 },

  /** Modulos validos en la hoja USUARIOS. Uno fuera de esta lista es un typo. */
  modulosValidos: ['finanzas', 'recetario', 'marketing', 'contenido', 'crm', 'consola', 'resenas'],

  /** Propiedades que tienen que existir si o si. */
  propsObligatorias: ['CONFIG_SHEET_ID', 'RECETARIO_COCINA_SHEET_ID'],
  // INTRANET_URL y POS_CATALOGO_FOLDER_ID estan aca desde el 30-ago-2026 porque las
  // dos fallan CALLADAS: sin la primera los enlaces internos apuntan al despliegue de
  // pruebas y contestan "You need access"; sin la segunda el catalogo del POS cae al
  // respaldo y la pantalla muestra costos viejos sin decir nada. Listarlas es la unica
  // forma de que se note que faltan.
  propsOpcionales:   ['RECETARIO_BARRA_SHEET_ID', 'COSTEO_SHEET_ID',
                      'POS_CATALOGO_SHEET_ID', 'POS_CATALOGO_FOLDER_ID',
                      'INTRANET_URL', 'RECETARIO_FOTOS_FOLDER_ID'],

  /** Las de red tardan y dependen de terceros. Se piden aparte. */
  incluirRed: false
};

// ---------------------------------------------------------------- infraestructura

/** Modelo de costeo cacheado en memoria: construirModelo_ es caro, se arma una vez. */
var PRUEBAS_MODELO_ = null;
function prModelo_() {
  if (!PRUEBAS_MODELO_) PRUEBAS_MODELO_ = construirModelo_();
  return PRUEBAS_MODELO_;
}

function prGrupo_(res, nombre) {
  var g = { nombre: nombre, pruebas: [] };
  res.grupos.push(g);
  return g;
}

/**
 * Registra un resultado.
 *   estado: 'OK' | 'FALLA' | 'AVISO' | 'SALTADA'
 * AVISO = algo que hay que mirar pero no rompe nada hoy.
 */
function prAnotar_(grupo, nombre, estado, detalle, leido, esperado) {
  grupo.pruebas.push({
    nombre: nombre, estado: estado, detalle: detalle || '',
    leido: leido === undefined ? null : leido,
    esperado: esperado === undefined ? null : esperado
  });
}

/**
 * Envuelve una prueba para que un error adentro no tumbe la bateria completa, y la
 * CRONOMETRA.
 *
 * El reloj se agrego el 23-sep-2026: la bateria entera tarda cinco minutos y no habia
 * forma de saber cual prueba se los comia. Optimizar a ojo es adivinar; con el tiempo
 * de cada una, el informe dice solo donde mirar. Se marca en el texto a partir de 3s,
 * para no llenarlo de ruido.
 */
function prCorrer_(grupo, nombre, fn) {
  var t0 = new Date().getTime(), desde = grupo.pruebas.length;
  try {
    fn();
  } catch (e) {
    prAnotar_(grupo, nombre, 'FALLA', 'Reviento: ' + String(e && e.message || e));
  }
  var ms = new Date().getTime() - t0;
  /* El tiempo es de la LLAMADA, no de cada resultado. Una sola prCorrer_ puede anotar
     cuatro pruebas —las cuatro salen del mismo modelo— y ponerle los 65s a cada una
     hacia que el total del grupo dijera 369s cuando la corrida entera tardo 174s.
     Un numero que se contradice con el de arriba enseña a desconfiar del informe.
     Va en la PRIMERA de las anotadas, y el grupo suma una sola vez. */
  grupo.ms = (grupo.ms || 0) + ms;
  if (grupo.pruebas.length > desde) grupo.pruebas[desde].ms = ms;
}

function prIgual_(grupo, nombre, leido, esperado, detalle) {
  prAnotar_(grupo, nombre, leido === esperado ? 'OK' : 'FALLA', detalle || '', leido, esperado);
}

// ---------------------------------------------------------------- 1. cimientos

function prCimientos_(res) {
  var g = prGrupo_(res, '1. Cimientos');
  var props = PropertiesService.getScriptProperties();

  PRUEBAS_CFG.propsObligatorias.forEach(function (clave) {
    prCorrer_(g, clave, function () {
      var id = props.getProperty(clave);
      if (!id) { prAnotar_(g, clave, 'FALLA', 'La propiedad no existe'); return; }
      var ss = SpreadsheetApp.openById(id);          // tira si el archivo se borro
      prAnotar_(g, clave, 'OK', '', ss.getName());
    });
  });

  PRUEBAS_CFG.propsOpcionales.forEach(function (clave) {
    prCorrer_(g, clave, function () {
      var id = props.getProperty(clave);
      if (!id) { prAnotar_(g, clave, 'SALTADA', 'Sin configurar'); return; }
      if (clave.indexOf('URL') > -1) {
        /* INTRANET_URL no es un ID: es una direccion. Entro a propsOpcionales el
           30-ago-2026 y desde entonces caia en la rama de openById, que reventaba
           con "Illegal spreadsheet id or key" pasara lo que pasara. La prueba no
           medía nada: fallaba por su propia forma de preguntar. */
        var esUrl = /^https:\/\/script\.google\.com\//.test(id);
        prAnotar_(g, clave, esUrl ? 'OK' : 'FALLA',
                  esUrl ? id : 'No parece una URL de Apps Script: ' + id, id);
      } else if (clave.indexOf('FOLDER') > -1) {
        prAnotar_(g, clave, 'OK', '', DriveApp.getFolderById(id).getName());
      } else {
        prAnotar_(g, clave, 'OK', '', SpreadsheetApp.openById(id).getName());
      }
    });
  });

  prCorrer_(g, 'Version del recetario', function () {
    var ss = abrirPorClave_('RECETARIO_COCINA_SHEET_ID');
    if (!ss) { prAnotar_(g, 'Version del recetario', 'FALLA', 'No abre'); return; }
    var nombre = ss.getName();
    var ok = nombre.indexOf(PRUEBAS_CFG.recetarioEsperado) > -1;
    prAnotar_(g, 'Version del recetario', ok ? 'OK' : 'FALLA',
      ok ? '' : 'RAIZ: mientras la intranet lea esta version, los numeros de control y ' +
                'las tres pruebas del puente con el POS van a salir en rojo. La columna K ' +
                '(pestana de la ficha) existe desde la ' + PRUEBAS_CFG.recetarioEsperado + '.',
      nombre, PRUEBAS_CFG.recetarioEsperado);
  });

  /* 10-sep-2026: las seis tarjetas del panel repartian
     ...exec?page=costeo%26u%3d<token>. El & y el = venian codificados porque el
     scriptlet que imprime la query usaba el escapado contextual, que dentro de un
     href codifica los reservados. Resultado: UN solo parametro "page" con todo el
     texto adentro, ningun parametro u, y doGet cayendo en getUsuarioActual(). A
     todo el que entra con Gmail personal —Jeffry, Jose— le servia "Esta puerta
     esta cerrada" apenas tocaba una tarjeta. Se veia igual en incognito: nunca fue
     la sesion, era el enlace. Esta prueba mira el HTML que sale de verdad. */
  prCorrer_(g, 'Las tarjetas del panel conservan el token', function () {
    var nombre = 'Las tarjetas del panel conservan el token';
    var filas = SpreadsheetApp.openById(getSheetId_('CONFIG_SHEET_ID'))
                  .getSheetByName('USUARIOS').getDataRange().getValues();
    var token = '';
    for (var i = 1; i < filas.length && !token; i++) token = String(filas[i][5] || '').trim();
    if (!token) { prAnotar_(g, nombre, 'SALTADA', 'Nadie tiene token en USUARIOS'); return; }

    var u = getUsuarioPorToken_(token);
    if (!u) { prAnotar_(g, nombre, 'FALLA', 'El primer token de USUARIOS no resuelve'); return; }

    var tpl = HtmlService.createTemplateFromFile('Index');
    tpl.usuario = u; tpl.urlBase = urlIntranet_(); tpl.authToken = token;
    var html = tpl.evaluate().getContent();
    var hrefs = html.match(/href="[^"]*page=[^"]*"/g) || [];

    var rotos = hrefs.filter(function (h) { return h.indexOf('%26') > -1 || h.indexOf('%3d') > -1 || h.indexOf('%3D') > -1; });
    var conToken = hrefs.filter(function (h) { return h.indexOf('&amp;u=') > -1 || h.indexOf('&u=') > -1; });

    if (rotos.length) {
      prAnotar_(g, nombre, 'FALLA',
        'Hay ' + rotos.length + ' enlace(s) con el & o el = codificados: el token no ' +
        'llega como parametro y quien entra con Gmail personal ve "Esta puerta esta ' +
        'cerrada". Imprimir la query con el scriptlet SIN escapar. ' + rotos[0],
        rotos.length, 0);
    } else if (!hrefs.length) {
      prAnotar_(g, nombre, 'SALTADA', 'El panel no genero enlaces con page= para ese rol');
    } else if (conToken.length !== hrefs.length) {
      prAnotar_(g, nombre, 'FALLA',
        (hrefs.length - conToken.length) + ' de ' + hrefs.length + ' tarjetas salieron sin ?u=',
        conToken.length, hrefs.length);
    } else {
      prAnotar_(g, nombre, 'OK', hrefs.length + ' tarjetas, todas con el token intacto',
                conToken.length, hrefs.length);
    }
  });

  /* La prueba de arriba cuida la plantilla de HOY. Esta cuida los enlaces de AYER.
     Los que se repartieron rotos por WhatsApp no se pueden retirar, y el 10-sep-2026
     Jeffry siguio topandose con la puerta cerrada despues de arreglar la plantilla
     porque hacia clic en el enlace viejo que tenia mas arriba en el chat. doGet
     desarma "page=costeo&u=<token>" y recupera el token. Si alguien simplifica ese
     bloque, los enlaces viejos vuelven a morir y nadie se entera hasta que un chef
     lo reporte. */
  prCorrer_(g, 'Los enlaces viejos con el token pegado siguen entrando', function () {
    var nombre = 'Los enlaces viejos con el token pegado siguen entrando';
    var filas = SpreadsheetApp.openById(getSheetId_('CONFIG_SHEET_ID'))
                  .getSheetByName('USUARIOS').getDataRange().getValues();
    var token = '', mods = '';
    for (var i = 1; i < filas.length && !token; i++) {
      if (String(filas[i][5] || '').trim() && String(filas[i][2] || '').indexOf('recetario') > -1) {
        token = String(filas[i][5]).trim();
        mods = String(filas[i][2]);
      }
    }
    if (!token) { prAnotar_(g, nombre, 'SALTADA', 'Nadie con recetario y token en USUARIOS'); return; }

    var html = doGet({ parameter: { page: 'costeo&u=' + token } }).getContent();
    var cerrada = html.indexOf('Esta puerta esta cerrada') > -1;
    var esRecetario = html.indexOf('Recetario') > -1;

    if (cerrada) {
      prAnotar_(g, nombre, 'FALLA',
        'Un enlace de los viejos (page=costeo con el token pegado) recibe la puerta ' +
        'cerrada. El rescate de doGet dejo de funcionar: revisar el bloque que ' +
        'parte "pagina" por el &.');
    } else if (!esRecetario) {
      prAnotar_(g, nombre, 'FALLA',
        'El enlace viejo entra pero no abre el recetario: el token se recupero y la ' +
        'pagina no, o al reves.');
    } else {
      prAnotar_(g, nombre, 'OK', 'El enlace viejo se rescata y abre el recetario');
    }
  });

  /* Entrar al modulo no alcanza: cada google.script.run es una peticion nueva y llega
     sin identidad. Si una llamada sale sin el token, cae en getUsuarioActual() y a quien
     entra con Gmail personal le contesta que no lo identifica.

     POR QUE ESTA PRUEBA ENUMERA Y NO USA UNA LISTA
     La primera version traia los seis nombres escritos a mano. El 11-sep-2026 Jeffry
     reporto "entro pero no puedo editar nada" y resulto que SIETE llamadas mandaban ''
     en vez de AUTH —entre ellas webEstadoEdicion, la que decide si los botones de
     edicion aparecen— y esta prueba pasaba en VERDE, porque ninguno de esos siete
     nombres estaba en su lista. Una prueba que revisa una lista escrita a mano solo
     encuentra lo que el que la escribio ya sabia. Ahora enumera las funciones publicas
     del servidor y barre las diez vistas: lo que se agregue despues entra solo. */
  prCorrer_(g, 'Las llamadas de las vistas pasan el token', function () {
    var nombre = 'Las llamadas de las vistas pasan el token';
    var VISTAS = ['Index', 'CosteoVista', 'MetasVista', 'ComparativoVista', 'FinanzasVista',
                  'SistemaMarketing', 'Marketing', 'CrmVista', 'PruebasVista', 'Denied',
                  // Los parciales de CosteoVista (partido el 12-sep-2026). Sus llamadas
                  // se fueron con ellos: si no se leen aca, dejan de estar protegidas.
                  'CosteoJs_Base', 'CosteoJs_Recetas', 'CosteoJs_Insumos', 'CosteoJs_Proveedores',
                  'CosteoJs_Menu', 'CosteoJs_Inicio', 'CosteoJs_HigieneGuia', 'CosteoJs_Pintar',
                  'CosteoJs_Paneles', 'CosteoJs_Acciones', 'CosteoJs_Inventario',
                  // FinanzasGastoVista nacio el 22-sep-2026 al partir "La semana" en
                  // dos. Sin su nombre aca, sus llamadas a google.script.run quedan
                  // sin revisar y la prueba sigue en verde: el punto ciego de siempre.
                  'SistemaFinanzas', 'EscenariosVista', 'CajaVista', 'FinanzasGastoVista', 'FinanzasGastoVista'];
    var MINIMO = 15;

    var publicas = [];
    Object.keys(this).forEach(function (k) {
      if (typeof this[k] !== 'function') return;
      if (k.charAt(k.length - 1) === '_') return;
      publicas.push(k);
    }, this);

    var vacias = [], total = 0, ilegibles = [], sinSoporte = [];
    VISTAS.forEach(function (v) {
      var txt = '';
      try { txt = HtmlService.createTemplateFromFile(v).getRawContent(); }
      catch (e) { ilegibles.push(v); return; }
      publicas.forEach(function (fn) {
        var todas = txt.match(new RegExp('\\.' + fn + '\\(', 'g')) || [];
        if (!todas.length) return;
        total += todas.length;

        // Solo es un bug si la funcion ACEPTA token y la llamada no lo pasa. Hay
        // funciones que no lo aceptan (las del CRM y marketing resuelven con
        // getUsuarioActual()): llamarlas sin argumentos es correcto para su firma, y
        // que no acepten token es otra discusion — se reporta aparte, no como falla.
        var primerParam = (String(this[fn]).match(/^function\s+\w+\s*\(\s*(\w+)/) || [])[1] || '';
        if (primerParam !== 'auth') { sinSoporte.push(fn + ' (' + v + ')'); return; }

        var malas = txt.match(new RegExp('\\.' + fn + '\\(\\s*(\\)|\'\'|"")', 'g')) || [];
        if (malas.length) vacias.push(fn + ' en ' + v + ' (' + malas.length + ')');
      }, this);

      // Marketing.html no llama con .nombre(: pasa por su dispatcher srv('nombre', ...),
      // que la busqueda de arriba no ve. Ahi la regla es otra: srv() agrega AUTH como
      // ULTIMO argumento, asi que la funcion tiene que tener auth al final y la llamada
      // tiene que pasar exactamente los demas. Con uno de menos, el token cae en otro
      // parametro y la guarda recibe undefined sin que nada falle a la vista.
      var srv = prLlamadasSrv_(txt);
      if (!srv.sitios.length) return;
      total += srv.sitios.length;
      if (!prSrvPasaToken_(txt)) {
        vacias.push('srv() de ' + v + ' ya no agrega AUTH al final (' + srv.sitios.length + ' llamadas)');
        return;
      }
      srv.sitios.forEach(function (s) {
        var f = this[s.fn];
        if (typeof f !== 'function' || s.fn.charAt(s.fn.length - 1) === '_') {
          vacias.push('srv(\'' + s.fn + '\') en ' + v + ' linea ' + s.linea + ': esa funcion no existe en el servidor');
          return;
        }
        var params = prParametros_(f);
        if (params[params.length - 1] !== 'auth') { sinSoporte.push(s.fn + ' (' + v + ', via srv)'); return; }
        if (s.args !== params.length - 1) {
          vacias.push(s.fn + ' en ' + v + ' linea ' + s.linea + ': pasa ' + s.args +
                      ' argumento(s) y espera ' + (params.length - 1) + ' antes de auth');
        }
      }, this);
    }, this);

    if (ilegibles.length) {
      prAnotar_(g, nombre, 'FALLA',
        'No pude leer estas vistas: ' + ilegibles.join(', ') + '. Sus llamadas no se revisaron.');
      return;
    }
    if (total < MINIMO) {
      prAnotar_(g, nombre, 'FALLA',
        'Encontre ' + total + ' sitios de llamada y esperaba al menos ' + MINIMO +
        '. El barrido dejo de funcionar y esta prueba estaria en verde sin revisar nada.',
        total, MINIMO);
      return;
    }
    if (vacias.length) {
      prAnotar_(g, nombre, 'FALLA',
        vacias.length + ' llamada(s) salen sin token: ' + vacias.join(' · ') +
        '. Quien entra con Gmail personal no va a poder usar esa parte.',
        total - vacias.length, total);
    } else if (sinSoporte.length) {
      prAnotar_(g, nombre, 'AVISO',
        'Los sitios que aceptan token lo pasan (' + total + ' en total), pero ' +
        sinSoporte.length + ' funcion(es) no aceptan token y resuelven por sesion de ' +
        'dominio: ' + sinSoporte.join(' · ') + '. Quien entra con Gmail personal no puede ' +
        'usar esa parte. Inofensivo mientras solo Juanma tenga esos modulos.',
        total - sinSoporte.length, total);
    } else {
      prAnotar_(g, nombre, 'OK', 'los ' + total + ' sitios de llamada pasan el token',
                total, total);
    }
  });

  prCorrer_(g, 'La web app esta desplegada', function () {
    var url = ScriptApp.getService().getUrl();
    prAnotar_(g, 'La web app esta desplegada', url ? 'OK' : 'FALLA', url || 'Sin URL');
  });

  /* Que la web app EXISTA no alcanza: hasta el 30-ago-2026 esta prueba pasaba en
     verde mientras la intranet armaba todos sus enlaces contra el despliegue de
     pruebas, y volver al panel contestaba "You need access". Lo que hay que mirar
     es a DONDE apunta urlIntranet_(), que es de donde salen el boton de volver,
     las tarjetas del panel y los enlaces personales con ?u=token. */
  prCorrer_(g, 'Los enlaces internos apuntan al despliegue publicado', function () {
    var url = String(urlIntranet_() || '');
    var fija = PropertiesService.getScriptProperties().getProperty('INTRANET_URL');
    var estado, detalle;
    if (!fija) {
      estado = 'FALLA';
      detalle = 'Falta la propiedad INTRANET_URL. Sin ella se cae en getUrl(), que ' +
                'devuelve el despliegue de @HEAD en /dev: todo el que no sea editor ' +
                'del script recibe "You need access" al volver al panel, y los ' +
                'enlaces con ?u=token nacen rotos. Se pone en Configuracion del ' +
                'proyecto > Propiedades de la secuencia de comandos.';
    } else if (url.slice(-5) !== '/exec') {
      estado = 'FALLA';
      detalle = 'INTRANET_URL no termina en /exec. /dev exige permiso de editor y no ' +
                'se puede enmarcar.';
    } else if (url.indexOf('script.google.com/a/') > -1) {
      /* 10-sep-2026: la propiedad tenia la forma con dominio
         (script.google.com/a/macros/rosanta.rest/s/.../exec). Esa URL redirige al
         login EXCLUSIVO del dominio y le pide una contraseña @rosanta.rest a quien
         entra con Gmail personal — o sea, a Jeffry y a Jose, que son justamente
         para quienes existen los enlaces con ?u=token. La prueba de /exec pasaba
         en verde con la URL rota, igual que en agosto pasaba en verde apuntando a
         /dev. La forma buena no lleva /a/: https://script.google.com/macros/s/<ID>/exec */
      estado = 'FALLA';
      detalle = 'INTRANET_URL lleva prefijo de dominio (/a/). Esa forma manda al login ' +
                'de rosanta.rest y rechaza los Gmail personales, que son los que usan ' +
                'los enlaces con ?u=token. Quitar el /a/...: dejarla como ' +
                'https://script.google.com/macros/s/<ID>/exec. Se arregla con ' +
                'fijarUrlIntranet(url), que valida antes de escribir.';
    } else {
      estado = 'OK';
      detalle = url;
    }
    prAnotar_(g, 'Los enlaces internos apuntan al despliegue publicado', estado, detalle,
              url || '(vacia)', 'una URL /exec en INTRANET_URL');
  });
  /* 12-sep-2026: la prueba de arriba vigila SOLO INTRANET_URL. CONSOLA_URL y
     RESENAS_URL estan escritas a mano en Config.gs y Code.gs se las entrega al
     navegador del usuario, y las dos tenian la forma con dominio. Un Gmail personal
     que hiciera clic en Consola o en Resenas chocaba con el mismo login de
     rosanta.rest, y ninguna prueba lo veia. Se corrigieron y esta prueba existe para
     que no vuelvan a torcerse. */
  prCorrer_(g, 'Las URLs escritas en Config apuntan fuera del dominio', function () {
    var malas = [];
    [['CONSOLA_URL', CONFIG.CONSOLA_URL], ['RESENAS_URL', CONFIG.RESENAS_URL]]
      .forEach(function (par) {
        var nombre = par[0], u = String(par[1] || '');
        if (!u) { malas.push(nombre + ' esta vacia'); return; }
        if (u.indexOf('script.google.com/a/') > -1) {
          malas.push(nombre + ' lleva prefijo de dominio (/a/): rechaza los Gmail personales');
        }
        if (u.slice(-5) !== '/exec') {
          malas.push(nombre + ' no termina en /exec');
        }
      });

    prAnotar_(g, 'Las URLs escritas en Config apuntan fuera del dominio',
              malas.length ? 'FALLA' : 'OK',
              malas.length
                ? malas.join(' · ') + '. La forma buena es ' +
                  'https://script.google.com/macros/s/<ID>/exec, sin el /a/.'
                : 'CONSOLA_URL y RESENAS_URL: /exec y sin /a/',
              malas.length ? malas.length + ' con problema' : 'las 2 bien',
              'CONSOLA_URL y RESENAS_URL sin /a/ y terminadas en /exec');
  });
}

// ---------------------------------------------------------------- 2. recetario

function prRecetario_(res) {
  var g = prGrupo_(res, '2. Recetario de cocina');
  var e = PRUEBAS_CFG.esperado;

  prCorrer_(g, 'Conteos', function () {
    var m = prModelo_();
    var coc = m.recetas.filter(function (r) { return r.area === 'COCINA'; });
    var platos = coc.filter(function (r) { return r.tipo === 'plato'; });
    var vacias = platos.filter(function (r) { return !r.ingredientes.length; });
    var conCmv = platos.filter(function (r) { return r.cmv != null && r.cmv > 0; });

    prIgual_(g, 'Fichas de plato',   platos.length,             e.platosCocina);
    prIgual_(g, 'Pre-elaborados',    coc.length - platos.length, e.preelaboradosCocina);
    prIgual_(g, 'Platos con CMV',    conCmv.length,             e.conCmvCocina);
    prAnotar_(g, 'Platos sin costear',
      vacias.length === e.vaciasCocina ? 'OK' : 'AVISO',
      vacias.map(function (r) { return r.nombre; }).join(' · '),
      vacias.length, e.vaciasCocina);
  });

  prCorrer_(g, 'Numeros de control', function () {
    var m = prModelo_();
    Object.keys(PRUEBAS_CFG.control).forEach(function (clave) {
      var esp = PRUEBAS_CFG.control[clave];
      var r = m.recetas.filter(function (x) { return normalizar_(x.nombre) === clave; })[0];
      if (!r) { prAnotar_(g, 'CMV ' + clave, 'FALLA', 'La ficha no aparece en el modelo'); return; }
      if (r.cmv == null) { prAnotar_(g, 'CMV ' + clave, 'FALLA', 'Sin CMV', null, esp); return; }
      var ok = Math.abs(r.cmv - esp) < PRUEBAS_CFG.toleranciaCmv;
      prAnotar_(g, 'CMV ' + clave, ok ? 'OK' : 'FALLA',
        ok ? '' : 'Se movio ' + (r.cmv - esp).toFixed(1) + ' puntos',
        Number(r.cmv.toFixed(1)), esp);
    });
  });

  prCorrer_(g, 'Ingredientes sin match en el Banco', function () {
    // Se cuentan POR AREA: la barra arrastra 38 de siempre (cordiales y sales que
    // nunca se cargaron a su Banco) y mezclarlas con cocina tapaba lo que importa.
    var m = prModelo_(), porArea = {};
    m.recetas.forEach(function (r) {
      r.ingredientes.forEach(function (i) {
        if (i.insumo !== null) return;
        if (!porArea[r.area]) porArea[r.area] = [];
        porArea[r.area].push(r.nombre + ' > ' + i.nombre);
      });
    });
    Object.keys(PRUEBAS_CFG.huerfanos).forEach(function (area) {
      var lista = porArea[area] || [], esp = PRUEBAS_CFG.huerfanos[area];
      var estado = lista.length > esp ? 'FALLA' : (lista.length < esp ? 'AVISO' : 'OK');
      var detalle = lista.slice(0, 12).join(' · ');
      if (lista.length < esp) detalle = 'Bajaron. Actualizar el numero en PRUEBAS_CFG. ' + detalle;
      prAnotar_(g, 'Sin match en el Banco de ' + area, estado, detalle, lista.length, esp);
    });
  });

  prCorrer_(g, 'Lineas con cantidad pero sin costo', function () {
    // Distinto de 'sin match en el Banco': aca no se pregunta si el nombre
    // engancha, sino si la hoja puso un numero. Un VLOOKUP que no encuentra
    // devuelve "" por el IFERROR y la linea vale Q0 sin avisar.
    var m = prModelo_(), porArea = {};
    m.recetas.forEach(function (r) {
      r.ingredientes.forEach(function (i) {
        if (typeof i.cantidad !== 'number' || !(i.cantidad > 0)) return;
        if (typeof i.total === 'number' && i.total > 0) return;
        if (!porArea[r.area]) porArea[r.area] = [];
        porArea[r.area].push(r.nombre + ' > ' + i.nombre);
      });
    });
    Object.keys(PRUEBAS_CFG.lineasSinCosto).forEach(function (area) {
      var lista = porArea[area] || [], esp = PRUEBAS_CFG.lineasSinCosto[area];
      var detalle = lista.slice(0, 12).join(' · ');
      if (esp === null) {
        prAnotar_(g, 'Sin costo en ' + area, 'AVISO',
          'Primera medicion. Anotar este numero en PRUEBAS_CFG.lineasSinCosto. ' + detalle,
          lista.length, null);
        return;
      }
      var estado = lista.length > esp ? 'FALLA' : (lista.length < esp ? 'AVISO' : 'OK');
      if (lista.length < esp) detalle = 'Bajaron. Actualizar el numero en PRUEBAS_CFG. ' + detalle;
      prAnotar_(g, 'Sin costo en ' + area, estado, detalle, lista.length, esp);
    });
  });

  prCorrer_(g, 'Hojas de control leidas como receta', function () {
    var m = prModelo_();
    // Una hoja que no es ficha se cuela cuando falta en COSTEO.tabsNoReceta.
    // Se nota porque queda sin ingredientes Y sin precio.
    // Salvo un pre-elaborado recien creado: nunca lleva precio y nace sin ingredientes,
    // pero trae su RINDE. El 14-sep-2026 la Salsa Romesco de Jeffry cayo aca como basura.
    var basura = m.recetas.filter(function (r) {
      if (r.tipo === 'preelaborado' && r.rinde) return false;
      return !r.ingredientes.length && r.precio === null;
    });
    prAnotar_(g, 'Hojas de control leidas como receta',
      basura.length === 0 ? 'OK' : 'FALLA',
      basura.map(function (r) { return r.area + ' > ' + r.nombre; }).join(' · '),
      basura.length, 0);
  });

  /* Un pre-elaborado con ficha y sin fila en el Banco existe para el recetario y no
     existe para las recetas: no sale en la lista de ingredientes y agregarLinea_ lo
     rechaza. Vivio asi hasta el 22-sep-2026, cuando Juanma creo el Aceite Albahaca y
     no lo pudo poner en ninguna receta. Ninguna prueba lo notaba: la ficha se leia
     bien, costeaba bien, y el agujero estaba en lo que NO se habia escrito.
     Se repara con darDeAltaPreelaboradosSinBanco() desde el editor. */
  prCorrer_(g, 'Pre-elaborados que ninguna receta puede usar', function () {
    var lista = preelaboradosSinBanco_(prModelo_());
    prAnotar_(g, 'Pre-elaborados que ninguna receta puede usar',
      lista.length === 0 ? 'OK' : 'FALLA',
      lista.length
        ? (lista.slice(0, 12).map(function (p) { return p.area + ' > ' + p.nombre; }).join(' · ') +
           ' · se reparan con darDeAltaPreelaboradosSinBanco() desde el editor')
        : '',
      lista.length, 0);
  });

  // Agregar un ingrediente arranca por bloqueFicha_. Si no ubica el bloque, la ficha
  // queda solo lectura para cocina y barra, y NINGUNA otra prueba lo nota porque
  // ninguna escribe. Asi pasaron el 13-sep-2026 el Bok Choy y la Salsa Romesco: 48
  // fichas de cocina rechazaban ingredientes y la bateria salia sana.
  // Solo LEE. Recorre las dos areas.
  prCorrer_(g, 'Todas las fichas aceptan ingredientes', function () {
    var rotas = [], vistas = 0;
    COSTEO.areas.forEach(function (cfg) {
      var ss = abrirPorClave_(cfg.clave);
      if (!ss) return;
      ss.getSheets().forEach(function (hoja) {
        var t = normalizar_(hoja.getName());
        if (t.indexOf('banco de datos') === 0 || esHojaDeControl_(hoja.getName())) return;
        vistas++;
        try {
          var b = bloqueFicha_(hoja);
          fichaDe_(ss, hoja.getName().trim());   // la vista manda el nombre recortado; tira si no la encuentra
          if (!(b.primera > b.filaHeader && b.ultima < b.filaSubtotal && b.primera <= b.ultima)) {
            rotas.push(cfg.area + ' > ' + hoja.getName() + ' (rango ' + b.primera + '-' + b.ultima + ')');
          }
        } catch (e) {
          rotas.push(cfg.area + ' > ' + hoja.getName() + ': ' + (e && e.message || e));
        }
      });
    });
    prAnotar_(g, 'Todas las fichas aceptan ingredientes',
      rotas.length === 0 ? 'OK' : 'FALLA',
      rotas.length ? rotas.slice(0, 15).join(' · ') : vistas + ' fichas en cocina y barra',
      rotas.length, 0);
  });

  prCorrer_(g, 'Formulas rotas en las fichas', function () {
    var ss = abrirPorClave_('RECETARIO_COCINA_SHEET_ID');
    if (!ss) { prAnotar_(g, 'Formulas rotas en las fichas', 'SALTADA', 'Sin recetario'); return; }
    var rotas = prEscanearErrores_(ss);
    prAnotar_(g, 'Formulas rotas en las fichas',
      rotas.length === 0 ? 'OK' : 'FALLA',
      rotas.slice(0, 15).join(' · '), rotas.length, 0);
  });
}

/** Recorre las hojas y devuelve las celdas con error de formula (#REF!, #N/A, #VALUE!...). */
function prEscanearErrores_(ss) {
  var malas = [];
  ss.getSheets().forEach(function (hoja) {
    var datos = hoja.getDataRange().getValues();
    for (var i = 0; i < datos.length; i++) {
      for (var j = 0; j < datos[i].length; j++) {
        var v = datos[i][j];
        if (typeof v === 'string' && v.length > 1 && v.charAt(0) === '#' && v.indexOf('!') > -1) {
          malas.push(hoja.getName() + '!' + String.fromCharCode(65 + j) + (i + 1) + ' ' + v);
        }
      }
    }
  });
  return malas;
}

// ---------------------------------------------------------------- 3. puente POS

function prPuentePOS_(res) {
  var g = prGrupo_(res, '3. Puente con el POS');

  prCorrer_(g, 'El mapa carga', function () {
    var m = mapaPOS_(true);
    prIgual_(g, 'Platos mapeados', Object.keys(m.platos).length,
             PRUEBAS_CFG.esperado.platosMapeadosPOS);

    var sinPestana = [];
    for (var p in m.platos) if (!m.platos[p].pestana) sinPestana.push(p);
    prAnotar_(g, 'Todos tienen pestana (columna K)',
      sinPestana.length === 0 ? 'OK' : 'FALLA', sinPestana.join(' · '), sinPestana.length, 0);
  });

  prCorrer_(g, 'nombrePOS_ resuelve por pestana', function () {
    // Este es el que fallaba callado: comparaba el nombre de la pestana contra la
    // columna B por coincidencia exacta y nunca coincidia, porque las pestanas van
    // en MAYUSCULAS y 13 platos tienen ademas otro nombre de fondo.
    var ss = abrirPorClave_('RECETARIO_COCINA_SHEET_ID');
    var m = mapaPOS_(), ok = 0, rotos = [], sinHoja = [];
    for (var plato in m.platos) {
      var pest = m.platos[plato].pestana;
      if (!pest) continue;
      if (ss && !ss.getSheetByName(pest)) { sinHoja.push(plato + ' -> "' + pest + '"'); continue; }
      if (nombrePOS_(pest) === m.platos[plato].pos) ok++;
      else rotos.push(pest + ' devolvio "' + nombrePOS_(pest) + '"');
    }
    prIgual_(g, 'Nombres resueltos', ok, PRUEBAS_CFG.esperado.platosMapeadosPOS,
             rotos.slice(0, 10).join(' · '));
    prAnotar_(g, 'La pestana existe en el documento',
      sinHoja.length === 0 ? 'OK' : 'FALLA', sinHoja.join(' · '), sinHoja.length, 0);
  });

  prCorrer_(g, 'La vuelta: del POS a la ficha', function () {
    // Varios platos comparten un mismo producto del POS: los cuatro postres se
    // venden por un unico boton de Q65 y la receta rota. Con esos, la vuelta no
    // puede devolver el mismo plato, y no tiene por que. Lo que importa es que
    // devuelva UNO que use ese nombre. Pedir identidad marcaba 3 fallas falsas.
    var m = mapaPOS_(), ok = 0, rotos = [], compartidos = 0, cuantos = {};
    for (var p in m.platos) {
      var kp = normalizar_(m.platos[p].pos);
      cuantos[kp] = (cuantos[kp] || 0) + 1;
    }
    for (var plato in m.platos) {
      var pos = m.platos[plato].pos;
      if (cuantos[normalizar_(pos)] > 1) compartidos++;
      var vuelta = fichaDesdePOS_(pos);
      if (vuelta && m.platos[vuelta] && m.platos[vuelta].pos === pos) ok++;
      else rotos.push(pos);
    }
    prIgual_(g, 'La vuelta: del POS a la ficha', ok, Object.keys(m.platos).length,
             rotos.length ? rotos.slice(0, 10).join(' · ')
                          : compartidos + ' platos comparten boton en el POS (los postres)');
  });

  prCorrer_(g, 'Precios recetario vs POS', function () {
    // El catalogo vigente, el mismo que usa el aviso del tablero (15-sep-2026). Antes
    // esta prueba comparaba contra el respaldo fijo, un export viejo.
    var id = null;
    try { id = catalogoInfo_().id; } catch (e) { id = null; }
    if (!id) {
      prAnotar_(g, 'Precios recetario vs POS', 'SALTADA',
                'Falta POS_CATALOGO_SHEET_ID. Subir el catalogo del POS y guardar su ID.');
      return;
    }
    var r = verificarNombresPOS_(id);
    prAnotar_(g, 'Nombres vivos en el POS', r.rotos.length === 0 ? 'OK' : 'FALLA',
              r.rotos.slice(0, 10).join(' · '), r.rotos.length, 0);
    prAnotar_(g, 'Precios iguales', r.precios.length === 0 ? 'OK' : 'AVISO',
              r.precios.slice(0, 10).join(' · '), r.precios.length, 0);
  });

  /* fechaVenta_ corre UNA VEZ POR FILA sobre las 9.502 de VENTAS x PLATO. Hasta el
     10-sep-2026 usaba Utilities.formatDate, que no es JavaScript sino una llamada al
     servicio: cada una cruza el puente a Java. Leer las ventas costaba entre 10 y 97
     segundos —el tiempo bailaba con la carga de Google, no con el calculo— y el
     tablero se lo comia entero cada vez que un cambio de precio invalidaba el cache.
     Jeffry lo reporto como "el panel carga lento". Con aritmetica pura bajo a 1.2 s.
     Es la misma trampa del 30-ago-2026 (28.000 JSON.parse en un bucle): en Apps
     Script lo caro no es el codigo pesado, son las llamadas a servicio adentro de un
     bucle. Esta prueba cuida las dos mitades: que no vuelva la llamada, y que la
     fecha siga saliendo igual. */
  prCorrer_(g, 'fechaVenta_ no llama al servicio y da la fecha de Guatemala', function () {
    var nombre = 'fechaVenta_ no llama al servicio y da la fecha de Guatemala';
    var src = String(fechaVenta_);
    if (src.replace(/\/\/[^\n]*/g, '').indexOf('Utilities.') > -1) {
      prAnotar_(g, nombre, 'FALLA',
        'fechaVenta_ volvio a llamar a Utilities: corre una vez por fila sobre 9.502 ' +
        'filas y el tablero vuelve a tardar decenas de segundos en abrir.');
      return;
    }
    // Guatemala es UTC-6 fijo. Las 05:00 UTC del dia 2 son todavia el dia 1 alla.
    var casos = [
      [new Date(Date.UTC(2026, 7, 23, 18, 0, 0)), '2026-08-23', 'tarde, mismo dia'],
      [new Date(Date.UTC(2026, 7, 24,  5, 0, 0)), '2026-08-23', 'madrugada UTC: alla es el dia anterior'],
      [new Date(Date.UTC(2026, 7, 24,  6, 0, 0)), '2026-08-24', 'justo al cruzar la medianoche de Guatemala'],
      [new Date(Date.UTC(2026, 0,  1,  7, 0, 0)), '2026-01-01', 'ano nuevo'],
      ['23/08/2026', '2026-08-23', 'texto DD/MM/YYYY'],
      ['2026-08-23', '2026-08-23', 'texto ya normalizado'],
      ['', '', 'vacio']
    ];
    var malos = [];
    casos.forEach(function (c) {
      var dio = fechaVenta_(c[0]);
      if (dio !== c[1]) malos.push(c[2] + ': esperaba ' + c[1] + ' y dio ' + dio);
    });
    if (malos.length) {
      prAnotar_(g, nombre, 'FALLA', malos.join(' · '), casos.length - malos.length, casos.length);
    } else {
      prAnotar_(g, nombre, 'OK', 'los ' + casos.length + ' casos, incluida la medianoche de Guatemala',
                casos.length, casos.length);
    }
  });

  /* Los avisos se cachean 30 min porque recorren Drive y costaban 7.3 s. Un cache
     esta bien mientras diga lo mismo que el calculo, y mientras el aviso se borre
     cuando la accion que lo resuelve ya se hizo: si cargarVentasPorProducto() deja
     de limpiarlo, el aviso "hay exports sin cargar" queda colgado media hora
     despues de haberlos cargado, y eso es peor que la lentitud que vino a
     arreglar. Las dos mitades se cuidan aca. */
  prCorrer_(g, 'El cache de avisos dice lo mismo y se limpia al resolverlos', function () {
    var nombre = 'El cache de avisos dice lo mismo y se limpia al resolverlos';
    if (typeof olvidarAvisosDashboard_ !== 'function') {
      prAnotar_(g, nombre, 'FALLA', 'No existe olvidarAvisosDashboard_: nadie puede limpiar el cache');
      return;
    }
    var src = String(cargarVentasPorProducto_);   // el nucleo: el publico es solo la guarda de editor (15-sep-2026)
    if (src.indexOf('olvidarAvisosDashboard_') === -1) {
      prAnotar_(g, nombre, 'FALLA',
        'cargarVentasPorProducto ya no limpia el cache de avisos: el aviso "exports sin ' +
        'cargar" va a quedar colgado hasta media hora despues de haberlos cargado.');
      return;
    }
    olvidarAvisosDashboard_();
    var calc = getAvisosDashboardCalculado_();
    var frio = getAvisosDashboard();          // recalcula y guarda
    var caliente = getAvisosDashboard();      // deberia salir del cache
    if (!caliente.deCache) {
      prAnotar_(g, nombre, 'AVISO', 'La segunda llamada no salio del cache: no se esta guardando');
      return;
    }
    if (JSON.stringify(calc.avisos) !== JSON.stringify(caliente.avisos)) {
      prAnotar_(g, nombre, 'FALLA',
        'El cache devuelve avisos distintos del calculo: [' +
        (caliente.avisos || []).map(function (a) { return a.clave; }).join(',') + '] contra [' +
        (calc.avisos || []).map(function (a) { return a.clave; }).join(',') + ']');
      return;
    }
    prAnotar_(g, nombre, 'OK',
      (frio.avisos || []).length + ' avisos, iguales desde el cache, y se limpian al cargar ventas',
      (caliente.avisos || []).length, (calc.avisos || []).length);
  });

  /* calentarCaches() corre desde un activador cada 5 minutos para que nadie se tope
     con el cache frio (46.7 s contra 0.3 s, medido el 10-sep-2026). Lo que lo hace
     viable es que NO reconstruya cuando ya esta caliente: asi la mayoria de las 288
     corridas diarias cuestan ~0.1 s y solo se paga la construccion cuando de verdad
     falta. Si alguien le quita esa guarda, el activador reconstruye el recetario
     entero cada cinco minutos y se come la cuota del proyecto entero — incluido el
     latido, que es el que avisa cuando algo muere. Por eso esto se prueba. */
  prCorrer_(g, 'El calentador no reconstruye si el cache ya esta caliente', function () {
    var nombre = 'El calentador no reconstruye si el cache ya esta caliente';
    if (typeof calentarCaches !== 'function') {
      prAnotar_(g, nombre, 'FALLA', 'No existe calentarCaches: nadie calienta el cache');
      return;
    }
    getCosteoData();          // deja el caro servido
    getProfitOS('', 13);
    getAvisosDashboard();
    _finDatos_(false);        // tanda 4 de Finanzas (M26): el calentador tambien los calienta
    getCmvRealTeorico('');

    var a = new Date().getTime();
    var linea = String(calentarCaches() || '');
    var segs = (new Date().getTime() - a) / 1000;

    if (linea.indexOf('reconstruido: nada') === -1) {
      prAnotar_(g, nombre, 'FALLA',
        'Reconstruyo con el cache caliente (' + segs.toFixed(1) + ' s): cada 5 minutos ' +
        'va a rehacer el recetario entero y quemar la cuota del proyecto. ' + linea);
    } else if (segs > 5) {
      prAnotar_(g, nombre, 'AVISO',
        'No reconstruyo pero tardo ' + segs.toFixed(1) + ' s: revisar que comprobar el ' +
        'cache no cueste casi tanto como rehacerlo.');
    } else {
      prAnotar_(g, nombre, 'OK', 'no reconstruyo nada y tardo ' + segs.toFixed(2) + ' s');
    }
  });

  /* TODA funcion que una vista puede llamar tiene que tener cerradura propia.
     doGet decide que PAGINA se sirve, y eso NO protege a la funcion: son dos puertas
     al mismo cuarto. El 10-sep-2026 cuatro funciones tenian una sola —getProfitOS,
     getAvisosDashboard, getMetasData y getComparativoData—, y las dos de finanzas
     leen el maestro entero. Esta prueba hace sola el barrido que las encontro.

     COMO BUSCA, Y POR QUE ASI
     No parsea la cadena de google.script.run. Se intento y salio mal: la cadena se
     escribe en varias lineas y cualquier regex razonable corta en el primer punto y
     coma, que casi siempre esta DENTRO del callback. Encontraba 2 de 21 y la prueba
     pasaba en verde. Aca se invierte: se enumeran las funciones publicas del servidor
     (google.script.run solo puede llamar esas) y se busca cada nombre en el texto
     crudo de cada vista. Sin cadenas que parsear, no hay nada que se corte.

     TRES RESGUARDOS CONTRA EL VERDE FALSO, que es el peor resultado posible aca:
       · si una vista no se puede leer, FALLA (no se la saltea en silencio);
       · si encuentra menos de MINIMO llamadas, FALLA: el barrido se rompio;
       · leer con getRawContent y NO createHtmlOutputFromFile, que SANITIZA: sobre
         CosteoVista devolvia 108.722 de 121.691 caracteres y sobre Marketing tiraba
         "Malformed HTML content".

     Si agregas una vista nueva, sumala a VISTAS: lo que no se lee, no se protege. */
  /* Desde sep-2026 (S36) los reportes del POS se suben ya convertidos a hoja de
     Google: se decidio no usar mas .xlsx. Un origen nativo NO hay que copiarlo. Sin
     el atajo, cada corrida creaba un "~nativa <nombre>" de un archivo que ya estaba
     en el formato bueno; es la misma basura del 30-ago-2026, cuando habia NUEVE
     copias para cuatro exports. Pero el camino del .xlsx tiene que seguir vivo: S35
     y todo lo anterior son .xlsx y hay que poder releerlos. Esta prueba cuida las dos
     mitades — que el nativo no se copie y que el .xlsx no se quede sin camino. */
  prCorrer_(g, 'Un reporte ya nativo se lee sin copiarlo', function () {
    var nombre = 'Un reporte ya nativo se lee sin copiarlo';
    var src = String(cargarVentasPorProducto_);   // el nucleo: el publico es solo la guarda de editor (15-sep-2026)
    if (src.indexOf('a.nativa') === -1) {
      prAnotar_(g, nombre, 'FALLA',
        'cargarVentasPorProducto ya no mira si el archivo es nativo: va a duplicar en ' +
        'Drive cada reporte que ya venga convertido.');
      return;
    }
    if (src.indexOf('ventasConvertirANativa_') === -1) {
      prAnotar_(g, nombre, 'FALLA',
        'Se perdio el camino del .xlsx: S35 y los reportes anteriores no se podrian releer.');
      return;
    }
    var archivos = [];
    try { archivos = ventasArchivosEnDrive_(); }
    catch (e) { prAnotar_(g, nombre, 'SALTADA', 'No pude leer Drive: ' + e.message); return; }
    if (!archivos.length) { prAnotar_(g, nombre, 'SALTADA', 'No hay reportes en Drive'); return; }

    var sinMarca = archivos.filter(function (a) { return a.nativa === undefined; });
    if (sinMarca.length) {
      prAnotar_(g, nombre, 'FALLA',
        sinMarca.length + ' archivo(s) llegan sin la marca "nativa": el cargador no puede ' +
        'distinguir y va a copiar de mas.', archivos.length - sinMarca.length, archivos.length);
      return;
    }
    var nat = archivos.filter(function (a) { return a.nativa; }).length;
    prAnotar_(g, nombre, 'OK',
      archivos.length + ' reportes vistos · ' + nat + ' nativos (se leen directo) · ' +
      (archivos.length - nat) + ' en .xlsx (se convierten)', archivos.length, archivos.length);
  });

  prCorrer_(g, 'Toda llamada de las vistas verifica identidad', function () {
    var nombre = 'Toda llamada de las vistas verifica identidad';
    var VISTAS = ['Index', 'CosteoVista', 'MetasVista', 'ComparativoVista', 'FinanzasVista',
                  'SistemaMarketing', 'Marketing', 'CrmVista', 'PruebasVista', 'Denied',
                  // Los parciales de CosteoVista (partido el 12-sep-2026). Sus llamadas
                  // se fueron con ellos: si no se leen aca, dejan de estar protegidas.
                  'CosteoJs_Base', 'CosteoJs_Recetas', 'CosteoJs_Insumos', 'CosteoJs_Proveedores',
                  'CosteoJs_Menu', 'CosteoJs_Inicio', 'CosteoJs_HigieneGuia', 'CosteoJs_Pintar',
                  'CosteoJs_Paneles', 'CosteoJs_Acciones', 'CosteoJs_Inventario',
                  // FinanzasGastoVista nacio el 22-sep-2026 al partir "La semana" en
                  // dos. Sin su nombre aca, sus llamadas a google.script.run quedan
                  // sin revisar y la prueba sigue en verde: el punto ciego de siempre.
                  'SistemaFinanzas', 'EscenariosVista', 'CajaVista', 'FinanzasGastoVista', 'FinanzasGastoVista'];
    // Piso de alarma, no meta: el 10-sep-2026 habia 21. Si de golpe caen a menos de
    // 15, lo que se rompio es el barrido, no es que hayan quitado pantallas.
    var MINIMO = 15;
    // Las guardas del proyecto, por convencion de nombre: exigirX_ y requiereX_ ademas
    // de las explicitas. Asi una guarda nueva que siga la convencion cuenta sola.
    var GUARDA = /(resolverUsuario_|getUsuarioActual|edicionQuien_|edicionCorrer_|exigir[A-Z]\w*_|requiere[A-Z]\w*_)\s*\(/;

    var publicas = [];
    Object.keys(this).forEach(function (k) {
      if (typeof this[k] !== 'function') return;
      if (k.charAt(k.length - 1) === '_') return;   // privada: la vista no la alcanza
      publicas.push(k);
    }, this);

    var usadas = {}, ilegibles = [], dinamicas = [];
    VISTAS.forEach(function (v) {
      var txt = '';
      try { txt = HtmlService.createTemplateFromFile(v).getRawContent(); }
      catch (e) { ilegibles.push(v + ' (' + String(e && e.message || e).slice(0, 50) + ')'); return; }
      publicas.forEach(function (fn) {
        if (txt.indexOf('.' + fn + '(') > -1) (usadas[fn] = usadas[fn] || []).push(v);
      });
      // Marketing.html llama por su dispatcher srv('nombre', ...), que la busqueda de
      // arriba no ve. Hasta el 12-sep-2026 sus 11 funciones no entraban en esta cuenta:
      // tenian guarda, pero una nueva sin guarda habria dejado esta prueba en verde.
      var srv = prLlamadasSrv_(txt);
      srv.sitios.forEach(function (s) {
        if (publicas.indexOf(s.fn) === -1) return;   // inexistente: lo marca la prueba del token
        var donde = (usadas[s.fn] = usadas[s.fn] || []);
        if (donde.indexOf(v) === -1) donde.push(v);
      });
      srv.dinamicas.forEach(function (n) { dinamicas.push(v + ' linea ' + n); });
    });

    if (ilegibles.length) {
      prAnotar_(g, nombre, 'FALLA',
        'No pude leer estas vistas: ' + ilegibles.join(', ') +
        '. Mientras no se lean, sus llamadas no se estan revisando.');
      return;
    }
    if (dinamicas.length) {
      prAnotar_(g, nombre, 'FALLA',
        'srv() con el nombre en una variable: ' + dinamicas.join(' · ') +
        '. Esa llamada no se puede revisar: escribir el nombre literal, srv(\'nombre\', ...).');
      return;
    }

    var nombres = Object.keys(usadas);
    if (nombres.length < MINIMO) {
      prAnotar_(g, nombre, 'FALLA',
        'El barrido encontro ' + nombres.length + ' llamadas y esperaba al menos ' + MINIMO +
        '. No es que falten pantallas: la busqueda dejo de funcionar y esta prueba ' +
        'estaria pasando en verde sin revisar casi nada.', nombres.length, MINIMO);
      return;
    }

    var sinCerradura = [];
    nombres.forEach(function (fn) {
      if (!GUARDA.test(String(this[fn]))) sinCerradura.push(fn + ' (' + usadas[fn].join(', ') + ')');
    }, this);

    if (sinCerradura.length) {
      prAnotar_(g, nombre, 'FALLA',
        sinCerradura.length + ' funcion(es) que las vistas llaman NO verifican quien las ' +
        'llama: ' + sinCerradura.join(' · ') + '. doGet protege la pagina, no la funcion.',
        nombres.length - sinCerradura.length, nombres.length);
    } else {
      prAnotar_(g, nombre, 'OK', 'las ' + nombres.length + ' llamadas de las vistas tienen cerradura',
                nombres.length, nombres.length);
    }
  });

  /* Reemplaza a la prueba de corchetes del grupo de Finanzas (5 vistas, retirada el
     12-sep-2026) y revisa TODAS las vistas: run['nombre']() es invisible para los dos
     barridos de arriba, y asi
     vivio getFinanzasData sin guarda hasta el 12-sep-2026. La deteccion es
     _prLlamadasConCorchetes_ (PruebasFinanzas.js), que solo marca un corchete pegado a
     google.script.run o al ultimo with...Handler(...), no uno dentro del handler.

     UNA EXCEPCION, EXPLICITA: el dispatcher srv() de Marketing.html, que termina en
     [fn](...args, AUTH). Se reconoce por ese texto, no por numero de linea. No queda
     tolerada a ciegas: sus llamadas srv('nombre', ...) las revisan los dos barridos
     de arriba, y si ese barrido deja de ver al menos MIN_SRV, la excepcion ya no esta
     cubierta y esta prueba FALLA. */
  prCorrer_(g, 'Ninguna vista llama al servidor con el nombre en una variable', function () {
    var nombre = 'Ninguna vista llama al servidor con el nombre en una variable';
    var VISTAS = ['Index', 'CosteoVista', 'MetasVista', 'ComparativoVista', 'FinanzasVista',
                  'SistemaMarketing', 'Marketing', 'CrmVista', 'PruebasVista', 'Denied',
                  'CosteoJs_Base', 'CosteoJs_Recetas', 'CosteoJs_Insumos', 'CosteoJs_Proveedores',
                  'CosteoJs_Menu', 'CosteoJs_Inicio', 'CosteoJs_HigieneGuia', 'CosteoJs_Pintar',
                  'CosteoJs_Paneles', 'CosteoJs_Acciones', 'CosteoJs_Inventario',
                  'SistemaFinanzas', 'EscenariosVista', 'CajaVista', 'FinanzasGastoVista',
                  // sin llamadas hoy, pero son vistas: lo que no se lee, no se revisa
                  'CosteoEstilos', 'Estilos', 'Logo'];
    var MINIMO = 25;    // el 12-sep-2026 habia 36 google.script.run en estas vistas
    var MIN_SRV = 10;   // y 14 llamadas srv('nombre') en Marketing
    var EXCEPCION = /\[\s*fn\s*\]\s*\(\s*\.\.\.\s*args\s*,\s*AUTH\s*\)/;

    if (typeof _prLlamadasConCorchetes_ !== 'function') {
      prAnotar_(g, nombre, 'FALLA', 'No existe _prLlamadasConCorchetes_ (PruebasFinanzas.js): no hay con que buscar.');
      return;
    }
    var culpables = [], ilegibles = [], sitios = 0, excepciones = 0, srvMarketing = 0;
    VISTAS.forEach(function (v) {
      var txt = '';
      try { txt = HtmlService.createTemplateFromFile(v).getRawContent(); }
      catch (e) { ilegibles.push(v); return; }
      sitios += (txt.match(/google\.script\.run\b/g) || []).length;
      var lineas = txt.split('\n');
      _prLlamadasConCorchetes_(txt).forEach(function (n) {
        if (v === 'Marketing' && EXCEPCION.test(lineas[n - 1] || '')) { excepciones++; return; }
        culpables.push(v + ' linea ' + n);
      });
      if (v === 'Marketing') srvMarketing = prLlamadasSrv_(txt).sitios.length;
    });

    if (ilegibles.length) {
      prAnotar_(g, nombre, 'FALLA', 'No pude leer estas vistas: ' + ilegibles.join(', ') +
        '. Sus llamadas no se revisaron.');
      return;
    }
    if (sitios < MINIMO) {
      prAnotar_(g, nombre, 'FALLA', 'Encontre ' + sitios + ' google.script.run y esperaba al menos ' +
        MINIMO + '. La lectura de las vistas se rompio.', sitios, MINIMO);
      return;
    }
    if (culpables.length) {
      prAnotar_(g, nombre, 'FALLA', 'llaman con el nombre en una variable: ' + culpables.join(' · ') +
        '. Los barridos de token e identidad no ven esas llamadas.', culpables.length, 0);
      return;
    }
    if (excepciones && srvMarketing < MIN_SRV) {
      prAnotar_(g, nombre, 'FALLA', 'El dispatcher srv() de Marketing sigue, pero el barrido de srv(\'nombre\') ' +
        've ' + srvMarketing + ' llamadas (minimo ' + MIN_SRV + '): la excepcion ya no esta cubierta.',
        srvMarketing, MIN_SRV);
      return;
    }
    if (!excepciones) {
      prAnotar_(g, nombre, 'AVISO', sitios + ' google.script.run sin corchetes, pero el dispatcher srv() ' +
        'de Marketing ya no aparece: la excepcion de esta prueba sobra, quitarla.', 0, 1);
      return;
    }
    prAnotar_(g, nombre, 'OK', sitios + ' google.script.run en ' + VISTAS.length + ' vistas · 1 excepcion: ' +
      'srv() de Marketing, cubierto (' + srvMarketing + ' llamadas srv revisadas)', culpables.length, 0);
  });
}

/* Llamadas por el dispatcher srv('nombre', ...args) de Marketing.html, que termina en
   google.script.run...[fn](...args, AUTH). Los barridos que buscan .nombre( no las ven.
   Devuelve { sitios: [{fn, linea, args}], dinamicas: [linea] }: args es cuantos
   argumentos van DESPUES del nombre (-2 si los parentesis no cierran); dinamicas son
   las srv(variable, ...), que ningun barrido de texto puede revisar. */
function prLlamadasSrv_(txt) {
  var sitios = [], dinamicas = [], re = /\bsrv\s*\(/g, m;
  function linea(i) { return txt.slice(0, i).split('\n').length; }
  while ((m = re.exec(txt))) {
    if (/function\s+$/.test(txt.slice(Math.max(0, m.index - 12), m.index))) continue;  // la definicion
    var abre = m.index + m[0].length - 1;
    var lit = /^\s*(['"])([A-Za-z_$][\w$]*)\1/.exec(txt.slice(abre + 1, abre + 120));
    if (!lit) { dinamicas.push(linea(m.index)); continue; }
    sitios.push({ fn: lit[2], linea: linea(m.index), args: prContarArgs_(txt, abre) - 1 });
  }
  return { sitios: sitios, dinamicas: dinamicas };
}

/* Cuantos argumentos tiene la llamada cuyo parentesis abre en txt[i]. Balancea ( [ {
   y salta lo que va entre comillas, para que una coma dentro de un objeto o de un
   texto no cuente. -1 si no cierra. */
function prContarArgs_(txt, i) {
  var prof = 0, cita = null, comas = 0, hay = false;
  for (; i < txt.length; i++) {
    var c = txt.charAt(i);
    if (cita) { if (c === '\\') i++; else if (c === cita) cita = null; continue; }
    if (c === '"' || c === "'" || c === '`') { cita = c; hay = true; continue; }
    if (c === '(' || c === '[' || c === '{') { prof++; if (prof > 1) hay = true; continue; }
    if (c === ')' || c === ']' || c === '}') { prof--; if (prof === 0) return hay ? comas + 1 : 0; continue; }
    if (prof === 1 && c === ',') { comas++; continue; }
    if (prof === 1 && !/\s/.test(c)) hay = true;
  }
  return -1;
}

/* true si la vista define srv() y ese dispatcher agrega AUTH como ultimo argumento. */
function prSrvPasaToken_(txt) {
  return /function\s+srv\s*\([^)]*\)\s*\{[\s\S]{0,600}?\]\s*\(\s*\.\.\.\s*args\s*,\s*AUTH\s*\)/.test(txt);
}

/* Nombres de los parametros de una funcion del servidor, en orden. */
function prParametros_(f) {
  var m = String(f).match(/^function\s+[\w$]+\s*\(([^)]*)\)/);
  return m ? m[1].split(',').map(function (p) { return p.trim(); }).filter(String) : [];
}

// ---------------------------------------------------------------- 4. accesos

function prAccesos_(res) {
  var g = prGrupo_(res, '4. Accesos');

  prCorrer_(g, 'La hoja USUARIOS', function () {
    var ss = SpreadsheetApp.openById(getSheetId_('CONFIG_SHEET_ID'));
    var hoja = ss.getSheetByName('USUARIOS');
    if (!hoja) { prAnotar_(g, 'La hoja USUARIOS', 'FALLA', 'No existe'); return; }
    var filas = hoja.getDataRange().getValues();
    prAnotar_(g, 'La hoja USUARIOS', 'OK', (filas.length - 1) + ' personas', filas.length - 1);

    var sinRol = [], sinModulos = [], modulosRaros = [], sinToken = [];
    for (var i = 1; i < filas.length; i++) {
      var correo = String(filas[i][0] || '').trim();
      if (!correo) continue;
      if (!String(filas[i][1] || '').trim()) sinRol.push(correo);

      var mods = String(filas[i][2] || '').split(',')
        .map(function (m) { return m.trim(); }).filter(function (m) { return m; });
      if (!mods.length) sinModulos.push(correo);
      mods.forEach(function (m) {
        if (PRUEBAS_CFG.modulosValidos.indexOf(m) === -1) modulosRaros.push(correo + ' > "' + m + '"');
      });

      // Sin correo del dominio, la sesion no identifica: el token es la unica puerta.
      if (correo.indexOf('@rosanta.rest') === -1 && !String(filas[i][5] || '').trim()) {
        sinToken.push(correo);
      }
    }
    prAnotar_(g, 'Todos con rol',     sinRol.length      === 0 ? 'OK' : 'FALLA', sinRol.join(' · '));
    prAnotar_(g, 'Todos con modulos', sinModulos.length  === 0 ? 'OK' : 'FALLA', sinModulos.join(' · '));
    prAnotar_(g, 'Sin modulos con typo', modulosRaros.length === 0 ? 'OK' : 'FALLA', modulosRaros.join(' · '));
    prAnotar_(g, 'Cuentas de Gmail con token', sinToken.length === 0 ? 'OK' : 'FALLA',
      sinToken.length ? 'Sin token no pueden entrar: ' + sinToken.join(' · ') : '');
  });

  prCorrer_(g, 'Cada token resuelve a su persona', function () {
    var hoja = SpreadsheetApp.openById(getSheetId_('CONFIG_SHEET_ID')).getSheetByName('USUARIOS');
    var filas = hoja.getDataRange().getValues(), ok = 0, rotos = [];
    for (var i = 1; i < filas.length; i++) {
      var t = String(filas[i][5] || '').trim();
      if (!t) continue;
      var u = getUsuarioPorToken_(t);
      if (u && u.email === String(filas[i][0]).toLowerCase().trim()) ok++;
      else rotos.push(String(filas[i][0]));
    }
    prAnotar_(g, 'Cada token resuelve a su persona', rotos.length === 0 ? 'OK' : 'FALLA',
              rotos.join(' · '), ok);
  });

  /* El area es la mitad del candado y se rompe igual de callada que los permisos:
     si un rol no figura en areasPorRol, areasDe_ devuelve lista vacia y esa persona
     no puede escribir en ningun lado, sin un solo mensaje. Y al reves —si alguien
     le pone ['COCINA','BARRA'] a "sala" para "destrabar" algo— nadie se entera
     hasta que Jose edita una ficha de Jeffry. */
  prCorrer_(g, 'Cada rol tiene su area, y solo la suya', function () {
    if (typeof EDIT === 'undefined' || !EDIT.permisos || !EDIT.areasPorRol) {
      prAnotar_(g, 'Cada rol tiene su area, y solo la suya', 'SALTADA',
                'EdicionRecetario.gs no esta instalado');
      return;
    }
    var problemas = [];
    Object.keys(EDIT.permisos).forEach(function (rol) {
      var as = areasDe_(rol);
      if (!as.length) problemas.push('"' + rol + '" no tiene ningun area: no puede escribir en ningun lado');
    });

    // Lo que de verdad importa: que chef NO pueda barra y sala NO pueda cocina.
    var cruces = [['chef', 'BARRA'], ['sala', 'COCINA']];
    cruces.forEach(function (par) {
      if (!EDIT.permisos[par[0]]) return;            // el rol ya no existe: no aplica
      var paso = false;
      try { exigirArea_(par[0], par[1]); paso = true; } catch (e) {}
      if (paso) problemas.push('AGUJERO: el rol "' + par[0] + '" escribe en ' + par[1]);
    });

    // Y que cada uno si pueda la suya, o el candado seria una traba.
    [['chef', 'COCINA'], ['sala', 'BARRA'], ['dueno', 'COCINA'], ['dueno', 'BARRA']].forEach(function (par) {
      if (!EDIT.permisos[par[0]]) return;
      try { exigirArea_(par[0], par[1]); }
      catch (e) { problemas.push('"' + par[0] + '" no puede escribir en ' + par[1] + ', y deberia'); }
    });

    prAnotar_(g, 'Cada rol tiene su area, y solo la suya',
              problemas.length ? 'FALLA' : 'OK', problemas.join(' · '),
              Object.keys(EDIT.areasPorRol).map(function (r) {
                return r + '=' + EDIT.areasPorRol[r].join('+');
              }).join(' '),
              'chef=COCINA sala=BARRA dueno=COCINA+BARRA');
  });

  /* Que ninguna escritura se saltee el candado. areaDeLaPagina_ es el unico lugar
     por donde pasan las nueve, y es donde vive exigirArea_. Una funcion web* que
     resuelva el area de otra forma seria una puerta lateral, y no se ve mirando
     el diff de a un archivo por vez. */
  prCorrer_(g, 'Ninguna escritura resuelve el area por su cuenta', function () {
    if (typeof webEditarCantidad === 'undefined') {
      prAnotar_(g, 'Ninguna escritura resuelve el area por su cuenta', 'SALTADA',
                'EdicionWeb.gs no esta instalado');
      return;
    }
    // Referencias directas y no this[nombre]: en Apps Script el `this` de una
    // funcion suelta no es el ambito global de forma fiable, y una lista de
    // strings que no resuelve daria la prueba en verde por el motivo equivocado.
    var escrituras = [
      ['webEditarCantidad',      webEditarCantidad],
      ['webAgregarLinea',        webAgregarLinea],
      ['webQuitarLinea',         webQuitarLinea],
      ['webCambiarPrecioMenu',   webCambiarPrecioMenu],
      ['webCrearFicha',          webCrearFicha],
      ['webCrearInsumo',         webCrearInsumo],
      ['webCambiarPrecioInsumo', webCambiarPrecioInsumo],
      ['webAsignarProveedor',    webAsignarProveedor]
    ];
    var sueltas = [];
    escrituras.forEach(function (par) {
      if (String(par[1]).indexOf('areaDeLaPagina_(area, u)') === -1) sueltas.push(par[0]);
    });
    prAnotar_(g, 'Ninguna escritura resuelve el area por su cuenta',
              sueltas.length ? 'FALLA' : 'OK',
              sueltas.length ? 'No pasan por areaDeLaPagina_(area, u): ' + sueltas.join(', ')
                             : escrituras.length + ' escrituras, todas por el mismo lugar',
              escrituras.length - sueltas.length, escrituras.length);
  });

  prCorrer_(g, 'Los roles de USUARIOS existen en la capa de escritura', function () {
    // El hueco que esto caza: la hoja USUARIOS tiene a la direccion como "dueno"
    // y EDIT.permisos solo conocia chef, cocina, administracion y direccion.
    // puede_('dueno', ...) devolvia lista vacia, o sea false para todo: el dueño
    // del restaurante habria quedado sin poder tocar nada el dia que se cablee
    // la interfaz. No daba error, simplemente no dejaba hacer nada.
    if (typeof EDIT === 'undefined' || !EDIT.permisos) {
      prAnotar_(g, 'Los roles de USUARIOS existen en la capa de escritura', 'SALTADA',
                'EdicionRecetario.gs no esta instalado');
      return;
    }
    var hoja = SpreadsheetApp.openById(getSheetId_('CONFIG_SHEET_ID')).getSheetByName('USUARIOS');
    var filas = hoja.getDataRange().getValues(), huerfanos = [], vistos = {};
    for (var i = 1; i < filas.length; i++) {
      var rol = String(filas[i][1] || '').trim();
      if (!rol) continue;

      // Solo cuentan los roles de quien puede LLEGAR al recetario. Marketing y
      // contenido (roles "equipo" y "pauta") entran a Marketing OS y no tocan el
      // documento de costos: que no tengan permisos de escritura es lo correcto,
      // no un hueco. Sin este filtro la prueba los marcaba como falla.
      var mods = String(filas[i][2] || '').split(',').map(function (m) { return normalizar_(m); });
      if (mods.indexOf('recetario') === -1) continue;

      if (vistos[normalizar_(rol)]) continue;
      vistos[normalizar_(rol)] = true;
      if (!EDIT.permisos[normalizar_(rol)]) {
        huerfanos.push('"' + rol + '" (' + String(filas[i][0]).trim() + ')');
      }
    }
    prAnotar_(g, 'Los roles de USUARIOS existen en la capa de escritura',
      huerfanos.length === 0 ? 'OK' : 'FALLA',
      huerfanos.length ? 'Sin permisos definidos, no van a poder hacer nada: ' + huerfanos.join(' · ') : '',
      huerfanos.length, 0);
  });

  prCorrer_(g, 'Quien corre las pruebas se identifica', function () {
    var u = getUsuarioActual();
    prAnotar_(g, 'Quien corre las pruebas se identifica', u ? 'OK' : 'AVISO',
      u ? u.email + ' · ' + u.rol : 'La sesion no devuelve correo (normal fuera del dominio)');
  });
}

// ---------------------------------------------------------------- 5. modulos

function prModulos_(res) {
  var g = prGrupo_(res, '5. Los modulos responden');

  prCorrer_(g, 'Recetario (getCosteoData)', function () {
    var d = getCosteoData();
    var n = d && d.recetas ? d.recetas.length : 0;
    prAnotar_(g, 'Recetario (getCosteoData)', n > 0 ? 'OK' : 'FALLA', n + ' recetas', n);
  });

  prCorrer_(g, 'Proveedores (getReporteHigiene)', function () {
    var h = getReporteHigiene();
    prAnotar_(g, 'Proveedores (getReporteHigiene)', h ? 'OK' : 'FALLA', h ? 'responde' : 'vacio');
  });

  prCorrer_(g, 'CRM (crmContactos)', function () {
    var c = crmContactos();
    var n = c && c.length ? c.length : 0;
    prAnotar_(g, 'CRM (crmContactos)', n >= 0 ? 'OK' : 'FALLA', n + ' contactos', n);
  });

  // El semaforo del Excel del cierre se retiro el 15-sep-2026 (auditoria A6): los precios
  // entran por el cierre de inventario de la intranet, que mira el grupo 8. Esta prueba
  // leia el .xlsx y avisaba precios que ya ningun camino aplica.
  prCorrer_(g, 'Precios del Excel del cierre', function () {
    prAnotar_(g, 'Precios del Excel del cierre', SEMAFORO.retirado ? 'OK' : 'AVISO',
              SEMAFORO.retirado ? 'retirado: los precios entran por el cierre de inventario (grupo 8)'
                                : 'el semaforo del Excel sigue activo');
  });

  if (PRUEBAS_CFG.incluirRed) {
    prCorrer_(g, 'Meta (red)', function () {
      var d = metaDiagnosticoJson_();
      prAnotar_(g, 'Meta (red)', d && d.ok !== false ? 'OK' : 'FALLA',
                d && d.error ? String(d.error) : 'responde');
    });
  } else {
    prAnotar_(g, 'Meta (red)', 'SALTADA', 'Tarda y depende de terceros. PRUEBAS_CFG.incluirRed = true para incluirla.');
  }
}

// ---------------------------------------------------------------- 6. capa web

/**
 * La puerta entre el navegador y la escritura.
 *
 * La prueba que importa es la segunda: ninguna funcion web* puede recibir el rol
 * como parametro. google.script.run deja que el CLIENTE ponga los parametros, asi
 * que una web* que acepte "rol" le estaria preguntando al que toca la puerta quien
 * es. La identidad se resuelve del lado del servidor con resolverUsuario_().
 *
 * Se verifica leyendo el codigo fuente de cada funcion, no su documentacion: si
 * alguien agrega manana una web* con rol adentro, esto lo caza en la siguiente
 * corrida aunque el comentario diga otra cosa.
 */
function prCapaWeb_(res) {
  var g = prGrupo_(res, '6. Puerta del navegador');

  var esperadas = ['webEstadoEdicion', 'webEditarCantidad', 'webAgregarLinea',
                   'webQuitarLinea', 'webCambiarPrecioMenu', 'webCrearFicha',
                   'webCrearInsumo', 'webCambiarPrecioInsumo', 'webCrearProveedor',
                   'webAsignarProveedor', 'webBuscarSimilares', 'webContenidosTipicos',
                   'webProbarConversion'];

  prCorrer_(g, 'Las funciones web existen', function () {
    var faltan = esperadas.filter(function (n) { return typeof globalThis[n] !== 'function'; });
    prAnotar_(g, 'Las funciones web existen', faltan.length === 0 ? 'OK' : 'FALLA',
              faltan.join(' · '), esperadas.length - faltan.length, esperadas.length);
  });

  prCorrer_(g, 'Ninguna acepta el rol del cliente', function () {
    var culpables = [];
    esperadas.forEach(function (n) {
      var fn = globalThis[n];
      if (typeof fn !== 'function') return;
      var m = String(fn).match(/^function\s+\w+\s*\(([^)]*)\)/);
      if (!m) return;
      m[1].split(',').forEach(function (p) {
        var t = normalizar_(p);
        if (t === 'rol' || t === 'quien' || t === 'email') culpables.push(n + '(' + t + ')');
      });
    });
    prAnotar_(g, 'Ninguna acepta el rol del cliente',
      culpables.length === 0 ? 'OK' : 'FALLA',
      culpables.length ? 'AGUJERO: el cliente podria decir que es dueno. ' + culpables.join(' · ')
                       : 'la identidad se resuelve en el servidor',
      culpables.length, 0);
  });

  // El area viaja del navegador hasta la hoja. Antes del 27-ago-2026 las 11 escrituras
  // abrian cocina a mano: editar el ajo de BARRA encontraba el de COCINA y le escribia
  // encima, sin error, porque hay ocho productos que se llaman igual en las dos areas.
  // Si alguien saca el areaDeLaPagina_ de una de estas, vuelve el agujero — y es
  // invisible, porque solo aparece escribiendo y ninguna prueba escribe.
  prCorrer_(g, 'Las que escriben resuelven el area', function () {
    var escriben = ['webEditarCantidad', 'webAgregarLinea', 'webQuitarLinea',
                    'webCambiarPrecioMenu', 'webCambiarRinde', 'webCrearFicha', 'webCrearInsumo',
                    'webCambiarPrecioInsumo', 'webAsignarProveedor',
                    'webArchivarFicha', 'webArchivarInsumo'];
    var sinArea = escriben.filter(function (n) {
      var fn = globalThis[n];
      if (typeof fn !== 'function') return true;
      return String(fn).indexOf('areaDeLaPagina_') === -1;
    });
    prAnotar_(g, 'Las que escriben resuelven el area',
      sinArea.length === 0 ? 'OK' : 'FALLA',
      sinArea.length ? 'ESCRIBIRIAN SOBRE COCINA CREYENDO OTRA AREA: ' + sinArea.join(' · ')
                     : 'las ' + escriben.length + ' resuelven el area antes de escribir',
      escriben.length - sinArea.length, escriben.length);
  });

  // Ninguna escritura puede quedar clavada a un recetario: para eso esta recetarioDe_.
  prCorrer_(g, 'Ninguna escritura abre un recetario a mano', function () {
    var capa = ['editarCantidad_', 'agregarLinea_', 'quitarLinea_', 'cambiarPrecioMenu_',
                'cambiarRinde_', 'crearFicha_', 'crearInsumo_', 'cambiarPrecioInsumo_',
                'asignarProveedor_', 'archivarFicha_', 'archivarInsumo_',
                'buscarSimilares_', 'contenidosTipicos_'];
    var clavadas = capa.filter(function (n) {
      var fn = globalThis[n];
      if (typeof fn !== 'function') return true;
      return String(fn).indexOf('RECETARIO_COCINA_SHEET_ID') !== -1;
    });
    prAnotar_(g, 'Ninguna escritura abre un recetario a mano',
      clavadas.length === 0 ? 'OK' : 'FALLA',
      clavadas.length ? 'CLAVADAS A COCINA: ' + clavadas.join(' · ')
                      : 'las ' + capa.length + ' pasan por recetarioDe_(area)',
      capa.length - clavadas.length, capa.length);
  });

  /* LA PUERTA TRASERA (15-sep-2026). Las pruebas de arriba miran las funciones que las
     vistas NOMBRAN. Pero cualquier pagina del despliegue deja llamar a cualquier funcion
     global sin guion bajo al final, la nombre una vista o no: el 14-sep habia 85 asi, y
     todas pasaban en verde porque ninguna vista las nombraba. Esta enumera TODAS. */
  prCorrer_(g, 'Ninguna funcion publica queda abierta', function () {
    var nombre = 'Ninguna funcion publica queda abierta';
    var G = (typeof globalThis !== 'undefined') ? globalThis : this;
    // exigirPermiso_ NO cuenta: mira el rol que le pasan, y si lo pasa el navegador no protege nada.
    var IDENTIDAD = /(resolverUsuario_|getUsuarioActual|edicionQuien_|edicionCorrer_|exigirModulo_|soloDueno_|invExigirDueno_|requiere[A-Z]\w*_)\s*\(/;
    var LIBRES = {
      doGet: 'la puerta: decide la pagina con la identidad',
      include: 'la usan las plantillas; devuelve el HTML de una vista',
      usuarioTieneModulo: 'pura: no lee nada',
      getUsuarioActual: 'devuelve solo la fila de quien llama',
      calentarCaches: 'activador cada 5 minutos',
      latido: 'activador',
      refrescarSemaforoPrecios: 'activador mensual; tambien la llama el aviso del tablero'
    };
    var abiertas = [], conRol = [], n = 0;
    Object.keys(G).forEach(function (k) {
      var fn = G[k];
      if (typeof fn !== 'function' || k.slice(-1) === '_') return;
      n++;
      var s = String(fn).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
      var m = s.match(/^function\s+[\w$]+\s*\(([^)]*)\)/);
      var params = (m ? m[1] : '').split(',').map(function (p) { return p.trim(); });
      if (params.indexOf('rol') !== -1 || params.indexOf('quien') !== -1) conRol.push(k + ' (recibe el rol del navegador)');
      if (!LIBRES.hasOwnProperty(k) && !IDENTIDAD.test(s)) abiertas.push(k);
    });
    if (n < 40) {
      prAnotar_(g, nombre, 'FALLA', 'Solo vi ' + n + ' funciones publicas: el barrido no esta leyendo el proyecto.', n, '>40');
      return;
    }
    var mal = abiertas.concat(conRol);
    prAnotar_(g, nombre, mal.length ? 'FALLA' : 'OK',
      mal.length ? 'Se pueden llamar desde cualquier pagina sin identificarse: ' + mal.join(' · ') +
                   '. Guion bajo al final si nadie la corre desde el editor; si no, soloDueno_() en la primera linea.'
                 : n + ' funciones publicas: todas con guarda, salvo ' + Object.keys(LIBRES).length + ' libres a proposito',
      mal.length, 0);
  });

  prCorrer_(g, 'La puerta reconoce a quien corre las pruebas', function () {
    var r = webEstadoEdicion('');
    if (!r || r.ok !== true) {
      prAnotar_(g, 'La puerta reconoce a quien corre las pruebas', 'FALLA',
                r && r.error ? r.error : 'sin respuesta');
      return;
    }
    var d = r.resultado, n = 0;
    for (var k in d.puede) if (d.puede[k]) n++;
    prAnotar_(g, 'La puerta reconoce a quien corre las pruebas', 'OK',
              d.email + ' · ' + d.rol + ' · ' + n + ' acciones permitidas', d.rol);
  });

  prCorrer_(g, 'Un token inventado no entra', function () {
    var r = webEstadoEdicion('token-que-no-existe-' + PRUEBAS_CFG.recetarioEsperado);
    // Con un token falso, resolverUsuario_ cae en la sesion. Desde el editor eso es
    // el dueño, asi que aca no se puede probar el rechazo: lo que SI se verifica es
    // que nunca devuelva el rol que venga en el token.
    var ok = r && (r.ok === false || (r.resultado && r.resultado.rol && r.resultado.email));
    prAnotar_(g, 'Un token inventado no entra', ok ? 'OK' : 'FALLA',
      r && r.ok === false ? 'rechazado: ' + r.error
                          : 'cae en la sesion del editor, que es lo correcto');
  });
}

// ---------------------------------------------------------------- entrada

/**
 * Corre todo y devuelve el resultado como objeto. No escribe nada, no imprime nada.
 * La usan PRUEBAS() (editor y clasp run) y la ruta ?page=pruebas del navegador.
 */
/* Para correr desde el EDITOR (con guarda de dueño). El codigo que la usa por dentro
   —activador, pantalla, bateria— llama a correrPruebas_(), que no tiene guarda.

   ESCRIBE EL INFORME EN EL LOG desde el 23-sep-2026. Decia "para correr desde el
   EDITOR" y desde el editor no mostraba nada: devolvia el objeto, y el editor enseña
   el Log, no lo que una funcion devuelve. Juanma la eligio dos veces del desplegable
   creyendo que corria la bateria con informe y se quedo esperando cuatro minutos para
   ver seis lineas sueltas. La culpa no era de el: el nombre y el comentario prometian
   una cosa y la funcion hacia otra. */
function correrPruebas() {
  soloDueno_();
  var res = correrPruebas_();
  pruebasATexto_(res).split('\n').forEach(function (linea) { Logger.log(linea); });
  return res;
}

/**
 * Los grupos, por clave. Cada uno es autonomo: arma su propio grupo de resultados y
 * hace su propia preparacion, asi que se pueden correr sueltos.
 *
 * Existe desde el 23-sep-2026 y la razon es de uso, no de diseño: la bateria entera
 * tarda cinco minutos, y ese dia Juanma la corrio cuatro veces seguidas para mirar dos
 * numeros del recetario. Una herramienta de control que cuesta cinco minutos se deja
 * de usar, y una bateria que no se corre no protege nada.
 */
var PRUEBAS_GRUPOS_ = {
  cimientos:  prCimientos_,
  recetario:  prRecetario_,
  pos:        prPuentePOS_,
  accesos:    prAccesos_,
  modulos:    prModulos_,
  web:        prCapaWeb_,
  sync:       prSyncPrecios_,
  inventario: prInventario_,
  finanzas:   prFinanzas_        // pilar 3, en PruebasFinanzas.gs
};
var PRUEBAS_ORDEN_ = ['cimientos','recetario','pos','accesos','modulos','web','sync','inventario','finanzas'];

/**
 * `claves` (opcional): lista de grupos a correr. Sin nada, la bateria entera — que es
 * lo que corre el activador y la pantalla, y lo que hay que mirar antes de publicar.
 */
function correrPruebas_(claves) {
  var arranque = new Date().getTime();
  PRUEBAS_MODELO_ = null;                       // modelo fresco en cada corrida

  var res = { grupos: [], fecha: new Date().toISOString() };

  var lista = PRUEBAS_ORDEN_;
  if (claves && claves.length) {
    lista = [].concat(claves).filter(function (k) { return PRUEBAS_GRUPOS_[k]; });
    var malas = [].concat(claves).filter(function (k) { return !PRUEBAS_GRUPOS_[k]; });
    if (malas.length) throw new Error('No existe el grupo de pruebas: ' + malas.join(', ') +
                                      '. Los que hay: ' + PRUEBAS_ORDEN_.join(', ') + '.');
    res.parcial = lista.join(', ');
  }
  lista.forEach(function (k) { PRUEBAS_GRUPOS_[k](res); });

  var n = 0, ok = 0, mal = 0, avisos = 0, saltadas = 0;
  res.grupos.forEach(function (g) {
    g.pruebas.forEach(function (p) {
      n++;
      if (p.estado === 'OK') ok++;
      else if (p.estado === 'FALLA') mal++;
      else if (p.estado === 'AVISO') avisos++;
      else saltadas++;
    });
  });

  res.total = n; res.ok = ok; res.fallas = mal; res.avisos = avisos; res.saltadas = saltadas;
  res.sana = (mal === 0);
  res.ms = new Date().getTime() - arranque;
  return res;
}

/** El resultado en texto plano. Lo usan el editor y la vista del navegador. */
function pruebasATexto_(res) {
  var l = [];
  l.push(res.sana ? (res.parcial ? 'SIN FALLAS en lo corrido' : 'INTRANET SANA')
                  : 'HAY ' + res.fallas + ' FALLA(S)');
  // Un verde parcial NO es "la intranet esta sana": hay que poder distinguirlos de un
  // vistazo, o alguien va a publicar confiando en media bateria.
  if (res.parcial) l.push('CORRIDA PARCIAL · solo: ' + res.parcial);
  l.push(res.ok + ' OK · ' + res.fallas + ' fallas · ' + res.avisos + ' avisos · ' +
         res.saltadas + ' saltadas · ' + (res.ms / 1000).toFixed(1) + 's');
  res.grupos.forEach(function (g) {
    l.push('');
    l.push(g.nombre + (g.ms >= 3000 ? '   [' + (g.ms / 1000).toFixed(0) + 's]' : ''));
    g.pruebas.forEach(function (p) {
      var marca = p.estado === 'OK' ? '  OK  ' : p.estado === 'FALLA' ? ' FALLA' :
                  p.estado === 'AVISO' ? ' AVISO' : '  --  ';
      var linea = marca + '  ' + p.nombre;
      if (p.esperado != null && p.leido !== p.esperado) {
        linea += '   (leido ' + p.leido + ', esperado ' + p.esperado + ')';
      } else if (p.leido != null) {
        linea += '   ' + p.leido;
      }
      if (p.ms >= 3000) linea += '   [' + (p.ms / 1000).toFixed(0) + 's]';
      l.push(linea);
      if (p.detalle) l.push('          ' + p.detalle);
    });
  });
  return l.join('\n');
}

/**
 * Envoltorio para el navegador. Lo llama PruebasVista.html por google.script.run.
 * Solo direccion: el resultado expone IDs de documentos y correos del equipo.
 *
 * Usa resolverUsuario_(auth) y no getUsuarioActual() a proposito: asi funciona
 * igual para una cuenta del dominio y para un enlace con token.
 */
/**
 * Igual que correrPruebas() pero DEVUELVE el informe legible en vez del objeto.
 *
 * Existe para `clasp run correrPruebasTexto`: la terminal muestra lo que la funcion
 * devuelve, no lo que escribe en el Log, asi que sin esto se ve el resumen pero no
 * que prueba fallo. No escribe nada.
 */
function correrPruebasTexto() {
  soloDueno_();
  return pruebasATexto_(correrPruebas_());
}

/**
 * Igual que correrPruebasTexto() pero ESCRIBE el informe en el Log.
 *
 * Para correr la bateria DESDE EL EDITOR y poder leerla: el editor muestra el Log,
 * no lo que la funcion devuelve, asi que correrPruebas() dejaba el informe adentro de
 * un objeto que nadie veia y correrPruebasTexto() esta hecha para la terminal. Hasta
 * el 15-sep-2026 eso lo cubria CORRER_PRUEBAS.gs, que se archivo. No escribe nada.
 *
 * La ruta ?page=pruebas del navegador sigue siendo la version linda, pero corre la
 * version PUBLICADA: si se acaba de tocar el codigo y todavia no se saco version
 * nueva, muestra la bateria vieja. Esta corre lo que hay en el editor.
 */
function correrPruebasLog() {
  // El candado va ACA tambien, aunque correrPruebas() lo tenga: cada funcion publica
  // se defiende sola. Heredarlo de la que llama funciona hoy y deja la puerta abierta
  // el dia que alguien toque la de adentro, sin un solo error. La prueba "Ninguna
  // funcion publica queda abierta" lo exige por eso, y tiene razon (23-sep-2026).
  soloDueno_();
  // Una sola implementacion del informe, no una copia: dos terminan divergiendo y
  // nadie se entera hasta que dicen cosas distintas.
  return pruebasATexto_(correrPruebas());
}

/**
 * Herramienta de editor: POR QUE una linea con cantidad quedo sin costo. Solo LEE.
 *
 * La prueba "Sin costo en ..." dice CUALES son, y con eso no alcanza: el VLOOKUP de las
 * fichas viene envuelto en IFERROR(...,"") asi que un fallo devuelve VACIO y no #N/A, y
 * desde afuera no se distingue un producto que no esta en el Banco de uno que esta con
 * precio cero, de una cantidad escrita como texto, o de una formula que alguien piso a
 * mano. Esto abre las tres celdas —la de la ficha, su formula, y la fila del Banco— y
 * las imprime crudas. Nacio el 22-sep-2026 persiguiendo CHARADA > CHILE PIMIENTO Y TE
 * FERMENTADO, que aparecio despues de tocar el Banco y no se dejaba explicar de lejos.
 */
function revisarLineasSinCosto() {
  soloDueno_();
  var m = construirModelo_(), casos = [];

  m.recetas.forEach(function (r) {
    r.ingredientes.forEach(function (g) {
      if (typeof g.cantidad !== 'number' || !(g.cantidad > 0)) return;
      if (typeof g.total === 'number' && g.total > 0) return;
      casos.push({ area: r.area, ficha: r.nombre, fila: g.fila, nombre: g.nombre,
                   cantidad: g.cantidad, unidad: g.unidad, enBanco: g.insumo !== null });
    });
  });

  if (!casos.length) { Logger.log('Ninguna linea con cantidad quedo sin costo.'); return 0; }
  Logger.log('%s linea(s) con cantidad y sin costo:', casos.length);

  casos.forEach(function (c) {
    var ss = recetarioDe_(c.area);
    var h = fichaDe_(ss, c.ficha);
    var b = bloqueFicha_(h);
    var rango = h.getRange(c.fila, b.colBase, 1, 5);
    Logger.log('');
    Logger.log('%s > %s · fila %s · "%s" %s %s', c.area, c.ficha, c.fila, c.nombre, c.cantidad, c.unidad || '');
    Logger.log('   la ficha dice:  %s', JSON.stringify(rango.getValues()[0]));
    Logger.log('   sus formulas:   %s', JSON.stringify(rango.getFormulas()[0]));

    if (!c.enBanco) { Logger.log('   el Banco:       NO tiene ese producto (por eso el precio viene vacio)'); return; }
    var hb = ss.getSheetByName(EDIT.hojaBanco), rb = hb.getDataRange();
    var v = rb.getValues(), fx = rb.getFormulas(), k = normalizar_(c.nombre);
    for (var i = EDIT.filaPrimerDato - 1; i < v.length; i++) {
      if (normalizar_(v[i][EDIT.col.producto - 1]) !== k) continue;
      Logger.log('   el Banco fila %s: precio=%s · formula=%s · unidad=%s', i + 1,
                 JSON.stringify(v[i][EDIT.col.precioReceta - 1]),
                 fx[i][EDIT.col.precioReceta - 1] || '(no es formula, es un valor)',
                 JSON.stringify(v[i][EDIT.col.unidadReceta - 1]));
      return;
    }
    Logger.log('   el Banco:       el modelo lo enlazo pero no encuentro la fila por nombre exacto');
  });
  return casos.length;
}

/**
 * Los dos atajos que se usan de verdad, para no pagar cinco minutos por mirar un
 * numero. Son los dos frentes donde se trabaja: el recetario y el dinero.
 *
 * NO reemplazan a correrPruebasLog(). Un grupo verde no dice que la intranet este
 * sana —el informe lo avisa con "CORRIDA PARCIAL"— y antes de publicar hay que correr
 * la bateria entera. Esto es para el ida y vuelta mientras se trabaja.
 *
 * Deliberadamente son dos y no nueve: un atajo que nadie usa es una puerta mas que
 * alguien tiene que mantener y mirar.
 */
function pruebasRecetario() {
  soloDueno_();
  var texto = pruebasATexto_(correrPruebas_(['recetario']));
  texto.split('\n').forEach(function (linea) { Logger.log(linea); });
  return texto;
}

function pruebasFinanzas() {
  soloDueno_();
  var texto = pruebasATexto_(correrPruebas_(['finanzas']));
  texto.split('\n').forEach(function (linea) { Logger.log(linea); });
  return texto;
}

function correrPruebasWeb(auth) {
  var u = resolverUsuario_(auth);
  if (!u) throw new Error('Sin acceso');
  if (String(u.rol || '').toLowerCase() !== 'dueno') throw new Error('Solo direccion');
  return correrPruebas_();
}

/* ==========================================================================
   7. SYNC DE PRECIOS: DESHACER, SEMAFORO Y RASTRO
   --------------------------------------------------------------------------
   Todo lo de este grupo LEE. Ninguna prueba llama a refrescarSemaforoPrecios(),
   aplicarSincronizacion_() ni a revertirSync_ sin simular: los tres escriben.

   Las dos pruebas de introspeccion son las importantes. No miran datos, miran el
   CODIGO, y existen porque los dos arreglos que cubren son invisibles cuando se
   rompen: si alguien saca el bitacora_ de un camino que escribe precios, todo sigue
   funcionando y el cambio simplemente deja de quedar registrado. Nadie se entera
   hasta que hace falta averiguar quien tocó algo, y ya es tarde.
   ========================================================================== */
function prSyncPrecios_(res) {
  var g = prGrupo_(res, '7. Sync de precios: deshacer y rastro');

  var nuevas = ['revertirSync_', 'listarCorridasSync', 'nuevaCorrida_', 'hojaLogSync_',
                'leerCorridas_', 'refrescarSemaforoPrecios', 'aprobadosDelSemaforo_',
                'esAprobable_', 'estaTildado_', 'historialDe', 'leerBitacora_',
                'refrescarResumenBitacora', 'bitacoraLote_'];

  prCorrer_(g, 'Las piezas nuevas existen', function () {
    var faltan = nuevas.filter(function (n) { return typeof globalThis[n] !== 'function'; });
    prAnotar_(g, 'Las piezas nuevas existen', faltan.length === 0 ? 'OK' : 'FALLA',
              faltan.length ? 'faltan: ' + faltan.join(' · ') : 'las ' + nuevas.length,
              nuevas.length - faltan.length, nuevas.length);
  });

  // El desplegable del editor elige solo y ya corrio una funcion que escribia.
  // Lo que escribe en lote tiene que ser privado y llamarse desde su propio archivo.
  prCorrer_(g, 'Lo que escribe en lote no esta en el desplegable', function () {
    // Hasta el 15-sep-2026 esta prueba miraba si los nombres DE SU PROPIA LISTA terminaban
    // en guion bajo, y pasaba siempre. Ahora mira el codigo: la privada tiene que existir y
    // no puede quedar una publica con el mismo nombre sin el guion.
    var deberianSerPrivadas = ['revertirSync_', 'aprobadosDelSemaforo_', 'hojaLogSync_',
                               'aplicarSincronizacion_', 'sincronizarPreciosDeCierre_'];
    var expuestas = deberianSerPrivadas.filter(function (n) {
      return typeof globalThis[n] !== 'function' || typeof globalThis[n.slice(0, -1)] === 'function';
    });
    prAnotar_(g, 'Lo que escribe en lote no esta en el desplegable',
              expuestas.length === 0 ? 'OK' : 'FALLA',
              expuestas.length ? 'expuestas: ' + expuestas.join(' · ')
                               : 'revertirSync_ solo se llama desde webInventarioDeshacerPrecios, con guarda de dueno',
              expuestas.length, 0);
  });

  // INTROSPECCION 1 — el rastro unico.
  prCorrer_(g, 'Todo camino que escribe un precio deja rastro en BITACORA', function () {
    var caminos = ['registrarPrecio', 'cambiarPrecioInsumo_', 'aplicarSincronizacion_', 'revertirSync_'];
    var mudos = caminos.filter(function (n) {
      var fn = globalThis[n];
      if (typeof fn !== 'function') return true;
      return String(fn).indexOf('bitacora') === -1;
    });
    prAnotar_(g, 'Todo camino que escribe un precio deja rastro en BITACORA',
      mudos.length === 0 ? 'OK' : 'FALLA',
      mudos.length ? 'ESCRIBEN SIN DEJAR RASTRO: ' + mudos.join(' · ')
                   : 'los ' + caminos.length + ' escriben en BITACORA',
      caminos.length - mudos.length, caminos.length);
  });

  // INTROSPECCION 2 — el agujero que se cerro el 26-ago-2026.
  // registrarPrecio escribe las mismas celdas que cambiarPrecioInsumo. Cuando solo
  // pedia el modulo 'recetario', el rol cocina —que en EDIT.permisos solo puede
  // editarCantidad— podia cambiar precios de compra por ese camino.
  prCorrer_(g, 'registrarPrecio exige el permiso del rol, no solo el modulo', function () {
    var src = typeof registrarPrecio === 'function' ? String(registrarPrecio) : '';
    var pideModulo = src.indexOf('usuarioTieneModulo') !== -1;
    var pidePermiso = src.indexOf('exigirPermiso_') !== -1;
    prAnotar_(g, 'registrarPrecio exige el permiso del rol, no solo el modulo',
      (pideModulo && pidePermiso) ? 'OK' : 'FALLA',
      pidePermiso ? 'modulo + exigirPermiso_(cambiarPrecio)'
                  : 'AGUJERO: dos puertas al mismo cuarto con cerraduras distintas',
      pidePermiso ? 1 : 0, 1);
  });

  prCorrer_(g, 'Las pestanas de servicio no se leen como recetas', function () {
    var servicio = [SYNC.hojaLog, SEMAFORO.hoja, EDIT.hojaBitacora, BIT.hojaResumen];
    var coladas = servicio.filter(function (h) { return !esHojaDeControl_(h); });
    prAnotar_(g, 'Las pestanas de servicio no se leen como recetas',
      coladas.length === 0 ? 'OK' : 'FALLA',
      coladas.length ? 'aparecerian como receta basura en la grilla: ' + coladas.join(' · ')
                     : servicio.join(' · '),
      servicio.length - coladas.length, servicio.length);
  });

  prCorrer_(g, 'El log del sync tiene las columnas del deshacer', function () {
    var h = hojaCosteo_().getSheetByName(SYNC.hojaLog);
    if (!h) {
      prAnotar_(g, 'El log del sync tiene las columnas del deshacer', 'SALTADA',
                'todavia no hay pestana ' + SYNC.hojaLog + ': nunca se aplico una sincronizacion');
      return;
    }
    var enc = h.getRange(1, 1, 1, h.getLastColumn()).getValues()[0].map(normalizar_);
    var faltan = ['d anterior', 'proveedor anterior', 'corrida'].filter(function (c) {
      return enc.indexOf(c) === -1;
    });
    prAnotar_(g, 'El log del sync tiene las columnas del deshacer',
      faltan.length === 0 ? 'OK' : 'FALLA',
      faltan.length ? 'sin estas el deshacer no puede devolver los valores: ' + faltan.join(' · ')
                    : h.getLastColumn() + ' columnas',
      h.getLastColumn(), SYNC.colsLog.length);
  });

  prCorrer_(g, 'Las corridas del sync se pueden listar y deshacer', function () {
    var todo = leerCorridas_(false);                 // false = no migra, no escribe
    if (!todo.orden.length) {
      prAnotar_(g, 'Las corridas del sync se pueden listar y deshacer', 'SALTADA',
                'todavia no hay corridas registradas');
      return;
    }
    var reversibles = 0;
    todo.orden.forEach(function (k) {
      var c = todo.corridas[k];
      if (!c.esReversion && c.ok) reversibles++;
    });
    prAnotar_(g, 'Las corridas del sync se pueden listar y deshacer', 'OK',
      todo.orden.length + ' corrida(s), ' + reversibles + ' reversible(s)', reversibles);
  });

  prCorrer_(g, 'La bitacora se puede leer de vuelta', function () {
    var b = leerBitacora_();
    if (!b.length) {
      prAnotar_(g, 'La bitacora se puede leer de vuelta', 'SALTADA', 'la bitacora esta vacia');
      return;
    }
    var conFecha = b.filter(function (m) { return !!m.fecha; }).length;
    prAnotar_(g, 'La bitacora se puede leer de vuelta',
      conFecha === b.length ? 'OK' : 'AVISO',
      b.length + ' movimientos · el mas nuevo: ' + b[0].accion + ' sobre ' + b[0].referencia +
      (conFecha === b.length ? '' : ' · ' + (b.length - conFecha) + ' sin fecha'),
      b.length);
  });

  // INDICE_INSUMO_RECETA es una FOTO, no una vista viva: nada del modulo la lee
  // —construirModelo_() arma todo de cero— pero es la tabla que se consulta a mano
  // desde Sheets. Una foto vieja no da error, MIENTE. El 26-ago-2026 tenia 310 filas,
  // todas de cocina y ninguna de barra, porque se saco antes de que barra entrara al
  // modelo. Nadie lo noto hasta que se fue a medir el impacto de un cambio de precio
  // en los cocteles y no habia con que.
  prCorrer_(g, 'El indice insumo-receta cubre las mismas areas que el modelo', function () {
    var h = hojaCosteo_().getSheetByName(COSTEO.hojas.indice);
    if (!h || h.getLastRow() < 2) {
      prAnotar_(g, 'El indice insumo-receta cubre las mismas areas que el modelo', 'SALTADA',
                'la pestana ' + COSTEO.hojas.indice + ' esta vacia. Correr REGENERAR_INDICE.');
      return;
    }
    var enIndice = {};
    h.getRange(2, 3, h.getLastRow() - 1, 1).getValues().forEach(function (f) {
      var a = String(f[0] || '').trim();
      if (a) enIndice[a] = (enIndice[a] || 0) + 1;
    });
    var enModelo = {};
    prModelo_().recetas.forEach(function (r) { enModelo[r.area] = (enModelo[r.area] || 0) + 1; });

    var faltan = Object.keys(enModelo).filter(function (a) { return !enIndice[a]; });
    var detalle = Object.keys(enModelo).map(function (a) {
      return a + ': ' + (enIndice[a] || 0) + ' filas de indice / ' + enModelo[a] + ' recetas';
    }).join(' · ');

    prAnotar_(g, 'El indice insumo-receta cubre las mismas areas que el modelo',
      faltan.length === 0 ? 'OK' : 'FALLA',
      faltan.length ? 'el indice NO tiene nada de: ' + faltan.join(', ') +
                      '. Esta viejo — correr REGENERAR_INDICE. ' + detalle
                    : detalle,
      Object.keys(enIndice).length, Object.keys(enModelo).length);
  });

  // Retirado el 15-sep-2026 (A6). Lo que importa ahora es que nadie lo reviva: los dos
  // APLICAR escribian en el Banco desde el Excel.
  prCorrer_(g, 'El semaforo del Excel quedo retirado', function () {
    var vivos = ['APLICAR_SEMAFORO', 'APLICAR_BARRA'].filter(function (n) { return typeof globalThis[n] === 'function'; });
    prAnotar_(g, 'El semaforo del Excel quedo retirado',
      SEMAFORO.retirado && !vivos.length ? 'OK' : 'FALLA',
      vivos.length ? 'siguen en el proyecto: ' + vivos.join(' · ') + ' (escriben precios desde el Excel)'
                   : SEMAFORO.retirado ? 'sin APLICAR_SEMAFORO ni APLICAR_BARRA; el activador mensual ya no lee el Excel'
                                       : 'SEMAFORO.retirado no esta en true',
      vivos.length, 0);
  });
}

// ---------------------------------------------------------------- 8. inventario

/**
 * Tanda 2 de la auditoria (15-sep-2026): cierre, aprobacion y catalogo del inventario.
 * SOLO LEE. Las escrituras (cerrar, aprobar, alta, reactivar) se probaron en un
 * simulador de hojas fuera de la intranet; aca se mira la data real.
 */
function prInventario_(res) {
  var g = prGrupo_(res, '8. Inventario: cierre y precios');

  prCorrer_(g, 'Las piezas del cierre existen', function () {
    var piezas = ['invPreciosEditados_', 'invPreciosDeBitacora_', 'invPropuestaPrecios_', 'invBuscarEnBanco_',
                  'invElegirPendientes_', 'invMesDeCelda_', 'invMismoPrecio_'];
    var faltan = piezas.filter(function (n) { return typeof globalThis[n] !== 'function'; });
    prAnotar_(g, 'Las piezas del cierre existen', faltan.length === 0 ? 'OK' : 'FALLA',
              faltan.length ? 'faltan: ' + faltan.join(' · ') : 'las ' + piezas.length,
              piezas.length - faltan.length, piezas.length);
  });

  ['COCINA', 'BARRA'].forEach(function (area) {
    var nombre = 'Inventario de ' + area.toLowerCase() + ': el cierre solo propone precios cambiados en el conteo';
    var nombreMes = 'Inventario de ' + area.toLowerCase() + ': ULTIMO MES del catalogo se lee como mes';
    prCorrer_(g, nombre, function () {
      var ss = abrirPorClave_(INV_DATOS.propiedad[area]);
      if (!ss) { prAnotar_(g, nombre, 'SALTADA', 'falta ' + INV_DATOS.propiedad[area]); return; }
      var cat = invCatalogo_(ss);

      // A10: una fecha en ULTIMO MES rompia reactivar un producto de barra
      var malos = [];
      if (cat.c['ultimo mes'] != null) {
        cat.filas.forEach(function (f) {
          var v = f[cat.c['ultimo mes']];
          if (v === '' || v == null) return;
          if (!/^\d{4}-\d{2}$/.test(invMesDeCelda_(v))) malos.push(invTexto_(f[cat.c['id']]) + ' "' + invTexto_(v) + '"');
        });
      }
      prAnotar_(g, nombreMes, malos.length ? 'AVISO' : 'OK',
                malos.length ? malos.slice(0, 10).join(' · ') : cat.filas.length + ' productos', malos.length, 0);

      var ab = invMesAbierto_(ss);
      if (!ab) { prAnotar_(g, nombre, 'SALTADA', 'no hay un mes abierto'); return; }
      var d = ab.d, c = invColumnas_(d[INV_DATOS.filaEncabezadoMes - 1]), filas = [], sinPrecio = 0;
      for (var i = INV_DATOS.filaEncabezadoMes; i < d.length; i++) {
        if (!invTexto_(d[i][c['id']])) { if (normalizar_(d[i][c['producto']]) === 'total') break; continue; }
        filas.push(i);
        if (invNumero_(d[i][c['existencia']]) > 0 && !(invNumero_(d[i][c['precio']]) > 0)) sinPrecio++;
      }
      var delMes = filas.map(function (k) { return d[k]; });
      var editados = invPreciosEditados_(ss, area, ab.mes, d, c, filas);
      var ahora = invPropuestaPrecios_(area, delMes, c, cat, editados);
      var antes = invPropuestaPrecios_(area, delMes, c, cat);        // la regla vieja, para comparar
      var nAhora = ahora.auto.length + ahora.aprobar.length, nAntes = antes.auto.length + antes.aprobar.length;
      var viejas = {};
      antes.auto.concat(antes.aprobar).forEach(function (x) { viejas[normalizar_(x.producto)] = 1; });
      // lo nuevo tiene que ser un recorte de lo viejo; la unica excepcion legitima son dos
      // productos del inventario conectados al mismo del Banco
      var raras = ahora.auto.concat(ahora.aprobar).filter(function (x) { return !viejas[normalizar_(x.producto)]; });
      var repetidos = antes.otros.filter(function (t) { return t.indexOf('no se adivina') !== -1; });
      prAnotar_(g, nombre, raras.length || repetidos.length ? 'AVISO' : 'OK',
        ab.mes + ': ' + Object.keys(editados).length + ' precio(s) cambiados en el conteo · si se cerrara hoy irian ' +
        nAhora + ' al Banco (' + ahora.auto.length + ' solos, ' + ahora.aprobar.length + ' a aprobar) · con la regla vieja irian ' + nAntes +
        (sinPrecio ? ' · ' + sinPrecio + ' contados sin precio' : '') +
        (repetidos.length ? ' · Banco con nombres repetidos: ' + repetidos.slice(0, 5).join(' · ') : '') +
        (raras.length ? ' · propuestas que la regla vieja no hacia: ' + raras.map(function (x) { return x.producto; }).join(' · ') : ''),
        nAhora, null);
    });
  });

  var nPend = 'Precios por aprobar: cada pendiente se encuentra por su identidad';
  prCorrer_(g, nPend, function () {
    var h = hojaCosteo_().getSheetByName(INV_DATOS.hojaPorAprobar);
    if (!h || h.getLastRow() < 2) { prAnotar_(g, nPend, 'OK', 'no hay nada por aprobar'); return; }
    var d = h.getDataRange().getValues(), c = invColumnas_(d[0]), pedidos = [], vistos = {}, dobles = [];
    for (var i = 1; i < d.length; i++) {
      if (invTexto_(d[i][c['estado']]).toUpperCase() !== 'PENDIENTE') continue;
      var p = { fila: i + 1, area: invTexto_(d[i][c['area']]).toUpperCase(), mes: invMesDeCelda_(d[i][c['mes']]),
                producto: invTexto_(d[i][c['producto']]), nuevo: invNumero_(d[i][c['precio nuevo']]) };
      pedidos.push(p);
      var k = p.area + '|' + normalizar_(p.producto);
      if (vistos[k]) dobles.push(p.producto); else vistos[k] = 1;
    }
    if (!pedidos.length) { prAnotar_(g, nPend, 'OK', 'no hay nada por aprobar'); return; }
    var sel = invElegirPendientes_(d, c, pedidos);
    var bien = !sel.perdidos.length && sel.filas.length === pedidos.length &&
               sel.filas.every(function (r, j) { return r === pedidos[j].fila; });
    prAnotar_(g, nPend, !bien ? 'FALLA' : (dobles.length ? 'AVISO' : 'OK'),
              pedidos.length + ' pendiente(s)' + (dobles.length ? ' · mas de uno pendiente para: ' + dobles.join(' · ') : '') +
              (sel.perdidos.length ? ' · no encontrados: ' + sel.perdidos.join(' · ') : ''),
              sel.filas.length, pedidos.length);
  });
}
