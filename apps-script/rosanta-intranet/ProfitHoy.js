/**
 * HOY (13-oct-2026). La primera pantalla de Profit OS para cada persona: lo que le toca hoy,
 * con un boton que lleva a donde se resuelve. Juanma: "los chicos no entenderán" el sistema;
 * con esto no tienen que entenderlo para usarlo.
 *
 * Cada pendiente sale de la misma fuente que ya usa su pantalla (no se calcula nada nuevo):
 *   Pagos         facturas con fecha de pagar hasta hoy y las que siguen por pagar (pagEstado_)
 *   Caja chica    la caja de anoche: sin contar, con descuadre o sin cierre (cchEstado_)
 *   Inventarios   el mes anterior sin cerrar (invEstadoCierre_, mismo dia limite que el vigia)
 *   Compras       efectivo retirado sin compras registradas y cargos de debito sin registro (cpeCuadre_)
 *   SAT           (dueño) un dia habil completo sin avisos de factura por correo (fecUltimoAviso_)
 *   Por devolver  lo que se le debe a cada uno (_pagPorDevolver_)
 *   Acciones      las acciones de la semana a nombre de la persona (medAcciones_)
 * Cada bloque va en su try: si una fuente falla, la lista lo dice y sigue con el resto.
 * vista: la pestaña de la barra lateral que abre el boton (data-view de CosteoVista).
 *
 * AMBITO GLOBAL: todo empieza con hoy / _hoy.
 */

/** Lo que le toca hoy a quien entra. Lo pide la pestaña Hoy de Profit OS. */
function getHoyProfit(auth) {
  var u = exigirModulo_(auth, 'recetario');
  var rol = normalizar_(u.rol), nombre = u.nombre || u.email || '';
  var esDueno = rol === 'dueno', puedePagos = esDueno || usuarioTieneModulo(u, 'pagos');
  var hoy = new Date(), hoyIso = medFechaIso_(hoy), items = [], fallas = [];
  var Q = function (n) { return medQ_(n); };
  var add = function (o) { items.push(o); };
  var intentar = function (que, fn) { try { fn(); } catch (e) { fallas.push(que + ': ' + String(e && e.message || e)); } };
  var areas = esDueno ? ['COCINA', 'BARRA'] : rol === 'chef' ? ['COCINA'] : rol === 'sala' ? ['BARRA'] : [];

  // 1. Caja chica (Maco y el dueño): la caja de anoche
  if (esDueno || (rol === 'sala' && puedePagos)) intentar('Caja chica', function () {
    var E = cchEstado_(false), ayer = medFechaIso_(new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - 1));
    var A = E.dias.filter(function (d) { return d.fecha === ayer; })[0];
    if (A && A.estado === 'Sin conteo') add({ urgente: true, texto: 'Contar la caja de anoche', detalle: 'Debería haber ' + Q(A.esperado) + '.', vista: 'caja', sub: 'contar:' + ayer, boton: 'Contar' });
    if (A && (A.estado === 'Faltante' || A.estado === 'Sobrante')) add({ urgente: true, texto: 'La caja de anoche no cuadra: ' + A.estado.toLowerCase() + ' de ' + Q(Math.abs(A.abierta)),
      detalle: A.pistas[0] || 'Revisá los pagos del día y las cuentas cerradas con otra forma de pago.', vista: 'caja', sub: 'dia:' + ayer, boton: 'Revisar' });
    if (A && A.estado === 'Falta el cierre') add({ urgente: !esDueno, texto: 'No llegó el cierre de PosFile de anoche', detalle: 'Tocá Leer cierres en la Caja chica; si no llega, escribí el efectivo del cierre impreso.', vista: 'caja', sub: 'dia:' + ayer, boton: 'Abrir caja' });
    var otros = E.dias.filter(function (d) { return d.fecha !== ayer && d.fecha !== hoyIso && ((d.estado === 'Sin conteo' && !d.cubierto) || d.abierta); });
    if (otros.length) add({ urgente: false, texto: otros.length + (otros.length === 1 ? ' día anterior' : ' días anteriores') + ' de la caja sin cerrar bien',
      detalle: otros.map(function (d) { return d.fecha.slice(8, 10) + '/' + d.fecha.slice(5, 7) + ' ' + d.estado.toLowerCase(); }).slice(0, 4).join(' · '), vista: 'caja', sub: 'dia:' + otros[0].fecha, boton: 'Ver' });
  });

  // 2. Pagos: lo que hay que pagar hoy y lo que sigue pendiente en sus areas
  if (puedePagos) intentar('Pagos', function () {
    var misAreas = esDueno ? ['COCINA', 'BARRA', 'ADMIN'] : areas;
    var E = pagEstado_();
    var abiertas = E.facturas.filter(function (f) { return f.saldo > 0.01 && !f.mercado && misAreas.indexOf(f.area) !== -1; });
    // las del mercado se cierran en Compras (19-oct-2026): van con su boton, no como "por pagar"
    var merc = E.facturas.filter(function (f) { return f.saldo > 0.01 && f.mercado && misAreas.indexOf(f.area) !== -1; });
    if (merc.length) add({ urgente: false, texto: merc.length + (merc.length === 1 ? ' factura del mercado' : ' facturas del mercado') + ' para cerrar en Compras',
      detalle: 'Ya se pagaron en efectivo: asignalas a su compra o tocá "Ya se pagó en efectivo".', vista: 'compras', boton: 'Cerrar' });
    var hoyToca = abiertas.filter(function (f) { return f.fecha_pagar && f.fecha_pagar <= hoyIso; });
    var suma = function (l) { return l.reduce(function (a, f) { return a + f.saldo; }, 0); };
    if (hoyToca.length) add({ urgente: true, texto: hoyToca.length + (hoyToca.length === 1 ? ' factura para pagar hoy' : ' facturas para pagar hoy') + ' (' + Q(suma(hoyToca)) + ')',
      detalle: hoyToca.slice(0, 3).map(function (f) { return f.proveedor; }).join(', ') + (hoyToca.length > 3 ? '…' : ''), vista: 'pagos', sub: 'pagar', boton: 'Pagar' });
    // el dueño: cargos del banco o de la tarjeta que parecen el pago de una factura (13-oct-2026)
    if (esDueno && E.posibles && E.posibles.length) add({ urgente: false, texto: E.posibles.length + (E.posibles.length === 1 ? ' posible pago del banco' : ' posibles pagos del banco') + ' para confirmar',
      detalle: 'Cargos con el monto exacto de una factura pendiente. Si es el pago, la factura sale de Por pagar.', vista: 'pagos', sub: 'posibles', boton: 'Revisar' });
    var resto = abiertas.filter(function (f) { return hoyToca.indexOf(f) === -1; });
    if (resto.length) {
      var vieja = resto.reduce(function (a, f) { return !a || f.fecha < a.fecha ? f : a; }, null);
      add({ urgente: false, texto: resto.length + (resto.length === 1 ? ' factura por pagar' : ' facturas por pagar') + ' (' + Q(suma(resto)) + ')',
        detalle: 'La más vieja es de ' + vieja.proveedor + ', del ' + vieja.fecha.slice(8, 10) + '/' + vieja.fecha.slice(5, 7) + '. Si ya la pagaste, marcala.', vista: 'pagos', sub: 'pagar', boton: 'Ver' });
    }
  });

  // 2b. SAT sin avisar (14-oct-2026): si SAT deja de mandar los avisos, las facturas nuevas no
  //     entran a Pagos hasta el FEL del lunes. Solo el dueño: es quien lo revisa en la Agencia Virtual.
  if (esDueno) intentar('Avisos de SAT', function () {
    var U = fecUltimoAviso_(), n = U ? fecDiasSinAviso_(U.leido, hoy) : 0;
    var cuando = U ? Utilities.formatDate(U.leido, 'America/Guatemala', 'dd/MM') + ' a las ' + Utilities.formatDate(U.leido, 'America/Guatemala', 'HH:mm') : '';
    if (n >= 1) add({ urgente: n >= 2, texto: 'SAT no avisa facturas desde el ' + cuando,
      detalle: (n === 1 ? 'Pasó un día hábil completo' : 'Pasaron ' + n + ' días hábiles completos') + ' sin avisos al correo (el último fue ' + U.proveedor + ', ' + Q(U.monto) +
        '). Las facturas nuevas no entran a Pagos hasta el FEL del lunes: revisá los recibidos en la Agencia Virtual de SAT.', vista: 'pagos', boton: 'Ver Pagos' });
    // si la lectura de las 10:00 fallo, lo avisa "Correos del dia" (abajo)
  });

  // 3. Inventarios: el mes anterior cerrado antes del dia limite
  if (areas.length) intentar('Inventarios', function () {
    var I = invEstadoCierre_(hoy, _finParametro_('inventario_cierre_dia', 5));
    areas.forEach(function (a) {
      var r = I.areas[a];
      if (!r || r.estado_esperado === 'CERRADO') return;
      var nom = a === 'COCINA' ? 'cocina' : 'barra';
      var mes = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre',
                 'noviembre', 'diciembre'][Number(I.esperado.slice(5, 7)) - 1] || I.esperado;
      add({ urgente: r.zona === 'rojo', texto: 'Cerrar el inventario de ' + nom + ' de ' + mes,
        detalle: r.zona === 'rojo' ? 'Se pasó del día ' + I.dia_limite + ' (' + r.dias_atraso + ' días de atraso).' : 'Hay plazo hasta el día ' + I.dia_limite + '.', vista: 'inventario', boton: 'Abrir inventario' });
    });
  });

  // 4. Compras en efectivo y con debito (14-oct-2026, ComprasEfectivo.js): el efectivo retirado
  //    que nadie registro y los cargos de la tarjeta de debito sin compra ni factura
  if (puedePagos && (esDueno || rol === 'chef' || rol === 'sala')) intentar('Compras', function () {
    var C = cpeCuadre_(SpreadsheetApp.openById(FIN_MAESTRO_ID), pagEstado_());
    var R = C.resumen, sinJ = C.retiros.filter(function (r) { return !r.ok && _cpeDias_(r.fecha, hoyIso) >= 1; });
    if (R.por_justificar > 0.01 && sinJ.length) add({ urgente: sinJ.length >= 2,
      texto: 'Registrar las compras de ' + Q(R.por_justificar) + ' en efectivo',
      detalle: sinJ.length + (sinJ.length === 1 ? ' retiro de cajero' : ' retiros de cajero') + ' sin compras que lo cubran. Sin eso el food cost no se puede auditar.',
      vista: 'compras', boton: 'Registrar' });
    if (R.debito_sin_registro) add({ urgente: false,
      texto: R.debito_sin_registro + (R.debito_sin_registro === 1 ? ' cargo' : ' cargos') + ' de la tarjeta de débito sin registrar (' + Q(R.q_debito_sin_registro) + ')',
      // desde el 14-oct-2026 el debito se anota en Pagos (Compras quedo solo para el efectivo)
      detalle: 'En Pagos: pagá su factura con Tarjeta › Tarjeta débito BI, o anotala en + Compra de mercado.', vista: 'pagos', boton: 'Ir a Pagos' });
  });

  // 5. Por devolver
  if (puedePagos && (esDueno || rol === 'chef' || rol === 'sala')) intentar('Por devolver', function () {
    var PD = _pagPorDevolver_({ rol: rol });
    if (esDueno) {
      var deb = PD.filter(function (x) { return x.pendiente > 0.01; });
      if (deb.length) add({ urgente: false, texto: 'Devolver al equipo ' + Q(deb.reduce(function (a, x) { return a + x.pendiente; }, 0)),
        detalle: deb.map(function (x) { return x.nombre + ' ' + Q(x.pendiente); }).join(' · '), vista: 'adm-equipo', boton: 'Ver' });
    } else {
      var miNombre = (PAG_EQUIPO_.filter(function (e) { return e.rol === rol; })[0] || {}).nombre;
      var mio = PD.filter(function (x) { return x.nombre === miNombre; })[0];
      if (mio && mio.pendiente > 0.01) add({ urgente: false, texto: 'Rosanta te debe ' + Q(mio.pendiente), detalle: 'Si pagaste algo más de tu bolsa, agregalo en Por devolver.', vista: 'adm-equipo', boton: 'Ver' });
    }
  });

  // 6. Las acciones de la semana a su nombre
  intentar('Acciones', function () {
    medAcciones_(null).filter(function (x) { return x.estado === 'pendiente' && normalizar_(x.dueno) === normalizar_(String(u.nombre || '').split(' ')[0]); }).forEach(function (x) {
      // con "Listo" (14-oct-2026): cada uno marca las suyas desde Hoy (marcarAccionHoy)
      add({ urgente: !!x.atrasada, texto: x.accion, detalle: (x.atrasada ? 'Venció el ' : 'Para el ') + x.fecha.slice(8, 10) + '/' + x.fecha.slice(5, 7) + '. Acción de la semana.', vista: '', boton: '',
            accion: { fila: x.fila, texto: x.accion } });
    });
  });

  // 7. La lectura de los correos de las 10:00 (cierres de PosFile y FEL): si fallo, el dueño lo ve
  if (esDueno) intentar('Correos del día', function () {
    var C = JSON.parse(PropertiesService.getScriptProperties().getProperty('CORREOS_DEL_DIA') || 'null');
    if (!C) return;
    var err = [].concat((C.cierres && C.cierres.errores) || [], (C.fel && C.fel.errores) || []);
    if (err.length) add({ urgente: true, texto: 'La lectura de correos de las 10:00 tuvo ' + err.length + (err.length === 1 ? ' error' : ' errores'),
      detalle: err.slice(0, 2).join(' · '), vista: 'caja', boton: 'Ver caja' });
  });

  items.sort(function (a, b) { return (b.urgente ? 1 : 0) - (a.urgente ? 1 : 0); });
  return { nombre: nombre.split(' ')[0], rol: rol, fecha: hoyIso, items: items, fallas: fallas,
           gen: Utilities.formatDate(hoy, 'America/Guatemala', 'dd/MM/yyyy HH:mm') };
}

/**
 * "Listo" en una accion de la semana, desde Hoy (14-oct-2026). marcarAccion (el tablero) es solo
 * del dueño; aca cada uno marca las SUYAS: la fila tiene que estar a su nombre. Se verifica el
 * texto, como en marcarAccion: si alguien inserto una fila, no se marca otra.
 */
function marcarAccionHoy(auth, fila, textoEsperado) {
  var u = exigirModulo_(auth, 'recetario');
  var rol = normalizar_(u.rol), yo = normalizar_(String(u.nombre || '').split(' ')[0]);
  fila = Number(fila);
  if (!(fila >= 2) || fila !== Math.floor(fila)) throw new Error('Esa acción no existe. Tocá Actualizar.');   // la fila 1 es el encabezado
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var sh = SpreadsheetApp.openById(getSheetId_('CONFIG_SHEET_ID')).getSheetByName(MED_ACC_HOJA_);
    if (!sh) throw new Error('No hay acciones.');
    var f = sh.getRange(Number(fila), 1, 1, MED_ACC_COLS_.length).getValues()[0];
    if (String(f[2]) !== String(textoEsperado)) throw new Error('Esa acción cambió. Tocá Actualizar.');
    if (rol !== 'dueno' && normalizar_(String(f[3])) !== yo) throw new Error('Esa acción es de ' + f[3] + ': la marca esa persona.');
    sh.getRange(Number(fila), 6).setValue('hecha');
    sh.getRange(Number(fila), 9).setValue(new Date());
    SpreadsheetApp.flush();
  } finally { lock.releaseLock(); }
  return getHoyProfit(auth);
}
