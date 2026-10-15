/**
 * TIEMPOS DE GUARDADO (15-oct-2026, Juanma: en Pagos y Recetas "tarda mucho y no sabes si
 * está cargando o no"). Antes de acelerar, medir: cada guardado deja aca cuanto tardo y en
 * que tramo (validar, escribir, recalcular). Se guarda en CacheService, un anillo con los
 * ultimos TIE_MAX_ guardados: ~20 ms, no escribe ninguna hoja y nunca rompe a quien lo llama.
 *
 * Se ve en ?page=tiempos (solo dueño), junto con "Medir lectura", que corre SOLO lecturas.
 */
var TIE_CLAVE_ = 'tiempos_guardado_v1';
var TIE_MAX_ = 60;

/** Un cronometro: t.tramo('validar') cierra el tramo que venia corriendo; t.fin() lo guarda. */
function tiempoInicio_(accion, quien) {
  var t0 = Date.now(), ult = t0, tramos = {};
  return {
    tramo: function (nombre) { var a = Date.now(); tramos[nombre] = (tramos[nombre] || 0) + (a - ult); ult = a; },
    fin: function (extra) {
      var a = Date.now();
      tiempoAnotar_(Object.assign({ accion: String(accion || '').slice(0, 80), quien: String(quien || '').slice(0, 40),
        ms: a - t0, tramos: tramos }, extra || {}));
      return a - t0;
    }
  };
}

/** Agrega una medicion al anillo. Nunca lanza. */
function tiempoAnotar_(x) {
  // Sin candado a proposito: el de Pagos y el del recetario son el mismo ScriptLock, y soltarlo
  // aca soltaria el de quien llama. Dos guardados en el mismo instante pueden perder una medicion.
  try {
    var c = CacheService.getScriptCache(), lista = [];
    try { lista = JSON.parse(c.get(TIE_CLAVE_) || '[]'); } catch (e) { lista = []; }
    x.cuando = Utilities.formatDate(new Date(), 'America/Guatemala', 'dd/MM HH:mm:ss');
    lista.push(x);
    if (lista.length > TIE_MAX_) lista = lista.slice(-TIE_MAX_);
    c.put(TIE_CLAVE_, JSON.stringify(lista), 6 * 60 * 60);
  } catch (e) { /* medir nunca rompe un guardado */ }
}

function exigirDuenoTiempos_(auth) {
  var u = resolverUsuario_(auth);
  if (!u || normalizar_(u.rol) !== 'dueno') throw new Error('Los tiempos los ve el dueño.');
  return u;
}

/** Los ultimos guardados, el mas nuevo primero. Solo dueño. */
function getTiemposGuardado(auth) {
  exigirDuenoTiempos_(auth);
  var lista = [];
  try { lista = JSON.parse(CacheService.getScriptCache().get(TIE_CLAVE_) || '[]'); } catch (e) { lista = []; }
  return lista.reverse();
}

/** El tiempo que sintio la persona (ida y vuelta, medido en la pantalla). Cualquiera con sesion. */
function anotarTiempoPantalla(auth, accion, ms) {
  var u = resolverUsuario_(auth);
  if (!u) return false;
  ms = Math.round(Number(ms));
  if (!(ms >= 0 && ms < 600000)) return false;
  tiempoAnotar_({ accion: 'pantalla · ' + String(accion || '').slice(0, 60), quien: String(u.nombre || u.email || '').slice(0, 40), ms: ms, tramos: {} });
  return true;
}

/**
 * Medir lectura: SOLO LEE. Separa lo que cuesta cada pieza de la pantalla de Pagos y del
 * recetario, en esta misma ejecucion (lo primero en frio, despues el recalculo con todo leido).
 */
function medirLectura(auth) {
  exigirDuenoTiempos_(auth);
  var out = [], t = Date.now();
  var paso = function (nombre, fn) {
    var a = Date.now(), nota = '';
    try { var r = fn(); nota = r == null ? '' : String(r); } catch (e) { nota = 'ERROR: ' + (e && e.message || e); }
    out.push({ paso: nombre, ms: Date.now() - a, nota: nota.slice(0, 120) });
  };
  _pagOlvidar_(true); _PAG_LEIDO_.escribio = false;
  var ss = null;
  paso('Pagos · abrir el maestro', function () { ss = _pagMaestro_(); return ''; });
  paso('Pagos · leer 01_FEL_Maestro', function () { var v = _pagValores_(ss, '01_FEL_Maestro'); return v ? v.length + ' filas' : 'no existe'; });
  paso('Pagos · leer 03_Banco_Industrial', function () { var v = _pagValores_(ss, '03_Banco_Industrial'); return v ? v.length + ' filas' : 'no existe'; });
  paso('Pagos · leer 04_Banco_BAC', function () { var v = _pagValores_(ss, '04_Banco_BAC'); return v ? v.length + ' filas' : 'no existe'; });
  paso('Pagos · leer las tarjetas', function () {
    return FIN_LIBROS.filter(function (L) { return /^0[56]_Tarjeta/.test(L.hoja); })
      .map(function (L) { var v = _pagValores_(ss, L.hoja); return L.hoja + ' ' + (v ? v.length : 0); }).join(' · ');
  });
  paso('Pagos · leer PAGOS_PROVEEDORES', function () { return pagMovimientos_().length + ' movimientos'; });
  paso('Pagos · leer facturas del correo (hoja)', function () { return fecFacturas_().length + ' avisos'; });
  paso('Pagos · COMPRAS_2026 (con caché)', function () { return Object.keys(_pagPagadasCompras_()).length + ' DTE'; });
  paso('Pagos · calcular el estado (todo ya leído)', function () { var E = pagEstado_(); return E.facturas.length + ' facturas'; });
  paso('Pagos · releer movimientos + calcular (lo que hace hoy después de guardar)', function () {
    _PAG_LEIDO_.movs = null; var E = pagEstado_(); return E.posibles.length + ' posibles';
  });
  paso('Pagos · pantalla completa (getPagosProveedores, ya leído)', function () {
    _PAG_LEIDO_.movs = null; _PAG_LEIDO_.escribio = true;   // sin Gmail, como despues de guardar
    var d = getPagosProveedores(auth); return Math.round(JSON.stringify(d).length / 1024) + ' KB';
  });
  _pagOlvidar_(true); _PAG_LEIDO_.escribio = false;
  paso('Recetario · modelo desde el caché', function () {
    var m = leerModeloCacheado_(CacheService.getScriptCache());
    return m ? m.recetas.length + ' recetas (en caché)' : 'CACHÉ VACÍO: el próximo guardado de precio pide recargar todo';
  });
  ['COCINA', 'BARRA'].forEach(function (a) {
    paso('Recetario · leer el Banco entero de ' + a + ' (lo hace cada cambio de producto o precio)', function () {
      var lista = [], indice = {}, cfg = configArea_(a);
      recetarioDe_(a).getSheets().forEach(function (hoja) {
        if (normalizar_(hoja.getName()).indexOf('banco de datos') === 0) leerBanco_(hoja, cfg, lista, indice);
      });
      return lista.length + ' productos';
    });
  });
  return { total_ms: Date.now() - t, pasos: out };
}
