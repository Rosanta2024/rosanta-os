/**
 * INFORME MENSUAL DEL EMBUDO DE EVENTOS (16-oct-2026)
 *
 * Por que existe: el Procedimiento_Seguimiento_Cotizaciones pide mirar una vez al mes la
 * tasa de cierre y los motivos, y nadie lo hacia. La pantalla Eventos muestra los mismos
 * numeros pero de TODO el historial junto; esto los corta por mes y compara con el anterior.
 *
 * Un solo motor: evmCalc_ (pura) arma el informe; lo usan la seccion "El mes" de la
 * pantalla (getInformeEventos), el correo del dia 3 (evmCadaHora_, colgado del vigia a las
 * 9:00) y la bateria (con filas inventadas). Lee la misma pestaña que la pantalla
 * (Rosanta Marketing OS › cotizaciones, evLeer_ de EventosDatos.js).
 *
 * En que mes cae cada fila:
 *   · entra: fecha_consulta (si falta, fecha_envio, y se cuenta como dato faltante)
 *   · se cierra: Ganada = deposito_fecha (o etapa_desde); Perdida = etapa_desde.
 *     La pantalla y la revision diaria ponen etapa_desde al cambiar de etapa.
 *   · una cerrada sin esa fecha no cae en ningun mes y sale en el aviso de datos.
 *
 * AMBITO GLOBAL: todo empieza con evm; lo privado termina en guion bajo.
 */

var EVM_ABIERTAS_ = ['consulta', 'porenviar', 'cotizada', 'conversacion', 'visita', 'reservada'];
var EVM_ETAPA_N_ = { consulta: 'Consulta', porenviar: 'Cotizada', cotizada: 'Cotizada', conversacion: 'En conversación',
  visita: 'Visita o degustación', reservada: 'Reservada', ganada: 'Ganada', perdida: 'Perdida', pausa: 'En pausa' };
var EVM_CANAL_N_ = { instagram: 'Instagram', web: 'Web', bot: 'Bot WhatsApp/IG', whatsapp: 'WhatsApp directo',
  correo: 'Correo', planner: 'Planner', referido: 'Referido', tripadvisor: 'TripAdvisor', otro: 'Otro' };
var EVM_MESES_ = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

function evmMesClave_(anio, mes) { return anio + '-' + (mes < 10 ? '0' : '') + mes; }
function evmMesMover_(anio, mes, d) { var m = anio * 12 + (mes - 1) + d; return { anio: Math.floor(m / 12), mes: (m % 12) + 1 }; }
function evmMesNombre_(anio, mes) { return EVM_MESES_[mes - 1] + ' ' + anio; }
function evmQ_(r) { var n = Number(r.monto_q != null ? r.monto_q : r.q); return isFinite(n) ? n : 0; }  // fila o evmMini_
function evmSuma_(lista) { return lista.reduce(function (a, r) { return a + evmQ_(r); }, 0); }
function evmEtapa_(r) { return String(r.etapa || r.estado || '').toLowerCase(); }

/** Fecha (AAAA-MM-DD) en que la fila se ganó o se perdió, o null. */
function evmFechaCierre_(r) {
  var e = evmEtapa_(r);
  if (e === 'ganada') return String(r.deposito_fecha || r.etapa_desde || '').slice(0, 10) || null;
  if (e === 'perdida') return String(r.etapa_desde || '').slice(0, 10) || null;
  return null;
}

/** El corte de un mes, sin comparar. */
function evmCorte_(filas, anio, mes) {
  var k = evmMesClave_(anio, mes);
  var enMes = function (f) { return f && String(f).slice(0, 7) === k; };
  var nuevas = filas.filter(function (r) { return enMes(r.fecha_consulta || r.fecha_envio); });
  var ganadas = filas.filter(function (r) { return evmEtapa_(r) === 'ganada' && enMes(evmFechaCierre_(r)); });
  var perdidas = filas.filter(function (r) { return evmEtapa_(r) === 'perdida' && enMes(evmFechaCierre_(r)); });
  var cerradas = ganadas.concat(perdidas);
  var qG = evmSuma_(ganadas), qC = evmSuma_(cerradas);
  var cuenta = function (lista, fn) {
    var o = {}; lista.forEach(function (r) { var c = fn(r); o[c] = o[c] || { n: 0, q: 0 }; o[c].n++; o[c].q += evmQ_(r); });
    return Object.keys(o).map(function (c) { return { nombre: c, n: o[c].n, q: o[c].q }; })
      .sort(function (a, b) { return b.q - a.q || b.n - a.n; });
  };
  var canal = {};
  cerradas.forEach(function (r) {
    var c = EVM_CANAL_N_[r.canal] || 'Sin dato'; canal[c] = canal[c] || { g: 0, t: 0, q: 0 };
    canal[c].t++; if (evmEtapa_(r) === 'ganada') { canal[c].g++; canal[c].q += evmQ_(r); }
  });
  var conConsulta = nuevas.filter(function (r) { return enMes(r.fecha_consulta); });
  var horas = conConsulta.map(function (r) { return Number(r.respuesta_horas); })
    .filter(function (h) { return r_ok(h); }).sort(function (a, b) { return a - b; });
  function r_ok(h) { return typeof h === 'number' && isFinite(h) && h >= 0; }
  var med = horas.length ? (horas.length % 2 ? horas[(horas.length - 1) / 2] : (horas[horas.length / 2 - 1] + horas[horas.length / 2]) / 2) : null;
  var clave = function (lista) { return lista.filter(function (r) { return r.clave === true; }); };
  return {
    clave: k,
    nuevas: { n: nuevas.length, q: evmSuma_(nuevas), sin_consulta: nuevas.length - conConsulta.length,
              por_canal: cuenta(nuevas, function (r) { return EVM_CANAL_N_[r.canal] || 'Sin dato'; }) },
    ganadas: { n: ganadas.length, q: qG, filas: ganadas.map(evmMini_) },
    perdidas: { n: perdidas.length, q: evmSuma_(perdidas), filas: perdidas.map(evmMini_) },
    tasa: { n: cerradas.length ? ganadas.length / cerradas.length : null, q: qC ? qG / qC : null, cerradas: cerradas.length },
    perdidas_etapa: cuenta(perdidas, function (r) { return EVM_ETAPA_N_[String(r.etapa_max || '').toLowerCase()] || 'Sin dato'; }),
    motivos: cuenta(perdidas, function (r) { return r.motivo || 'sin motivo'; }),
    canal: Object.keys(canal).map(function (c) { return { nombre: c, ganadas: canal[c].g, cerradas: canal[c].t, q: canal[c].q }; })
      .sort(function (a, b) { return b.cerradas - a.cerradas; }),
    respuesta: { mediana_h: med, en_24h: horas.filter(function (h) { return h <= 24; }).length, con_dato: horas.length,
                 q_lentas: evmSuma_(conConsulta.filter(function (r) { return Number(r.respuesta_horas) > 24; })),
                 sin_dato: conConsulta.length - horas.length },
    claves: { nuevas: clave(nuevas).length, ganadas: clave(ganadas).length, perdidas: clave(perdidas).length,
              q_ganada: evmSuma_(clave(ganadas)), q_perdida: evmSuma_(clave(perdidas)) }
  };
}

function evmMini_(r) {
  return { id: r.id, cliente: r.cliente || r.id, q: evmQ_(r), canal: EVM_CANAL_N_[r.canal] || 'Sin dato', motivo: r.motivo || null,
           etapa_max: EVM_ETAPA_N_[String(r.etapa_max || '').toLowerCase()] || null, clave: r.clave === true,
           fecha_evento: r.fecha_evento || null, vence: r.vence || null };
}

/**
 * PURA. filas = las del pipeline; hoy = 'AAAA-MM-DD' (para el monto que vence y para
 * marcar un mes en curso). Devuelve el informe completo del mes con el anterior al lado.
 */
function evmCalc_(filas, anio, mes, hoy) {
  filas = filas || [];
  var ant = evmMesMover_(anio, mes, -1), sig = evmMesMover_(anio, mes, 1);
  var act = evmCorte_(filas, anio, mes), prev = evmCorte_(filas, ant.anio, ant.mes);
  var kSig = evmMesClave_(sig.anio, sig.mes);
  var abiertas = filas.filter(function (r) { return EVM_ABIERTAS_.indexOf(evmEtapa_(r)) >= 0; });
  var vencen = abiertas.filter(function (r) { return String(r.vence || '').slice(0, 7) === kSig; })
    .map(evmMini_).sort(function (a, b) { return String(a.vence).localeCompare(String(b.vence)); });
  var abiertasClave = abiertas.filter(function (r) { return r.clave === true; });
  act.claves.abiertas = abiertasClave.length; act.claves.q_abierta = evmSuma_(abiertasClave);

  // Aviso de datos: lo que deja cojo el informe (de TODO el pipeline, para que se arregle).
  var falta = {
    consulta: filas.filter(function (r) { return !r.fecha_consulta; }).map(function (r) { return r.cliente || r.id; }),
    canal: filas.filter(function (r) { return !r.canal; }).map(function (r) { return r.cliente || r.id; }),
    cierre: filas.filter(function (r) { var e = evmEtapa_(r); return (e === 'ganada' || e === 'perdida') && !evmFechaCierre_(r); })
      .map(function (r) { return r.cliente || r.id; }),
    respuesta: filas.filter(function (r) { return r.fecha_consulta && !(typeof r.respuesta_horas === 'number' && isFinite(r.respuesta_horas)); })
      .map(function (r) { return r.cliente || r.id; })
  };
  var inf = {
    anio: anio, mes: mes, nombre: evmMesNombre_(anio, mes), anterior: evmMesNombre_(ant.anio, ant.mes),
    siguiente: evmMesNombre_(sig.anio, sig.mes),
    en_curso: !!(hoy && String(hoy).slice(0, 7) === act.clave), hoy: hoy || null,
    actual: act, previo: prev,
    vencen: { n: vencen.length, q: evmSuma_(vencen), filas: vencen },
    falta: falta, total_filas: filas.length
  };
  inf.recomendacion = evmRecomendar_(inf);
  return inf;
}

/**
 * UNA recomendación, con reglas fijas (sin IA). Cada regla dice cuántos quetzales toca y
 * gana la que más mueve. Si faltan datos de cierre, eso va primero: sin esa fecha el
 * informe no se puede leer.
 */
function evmRecomendar_(inf) {
  var a = inf.actual, c = [];
  var qfmt = function (q) { return 'Q' + Math.round(q).toLocaleString('en-US'); };
  if (inf.falta.cierre.length)
    return { regla: 'datos', texto: 'Antes que nada, completa la fecha de cierre de ' + inf.falta.cierre.join(', ') +
             ': sin esa fecha no se sabe en qué mes se ganaron o se perdieron, y el informe no compara.' };
  var sinResp = a.perdidas.filas.filter(function (r) { return r.motivo === 'sin respuesta'; });
  var sinRespCot = sinResp.filter(function (r) { return r.etapa_max === 'Cotizada'; });
  if (sinRespCot.length) c.push({ regla: 'callados', q: evmSuma_(sinRespCot),
    texto: function (q) { return 'Se fueron sin contestar ' + sinRespCot.length + ' cotización(es) que nunca pasaron de Cotizada (' + qfmt(q) +
      '). El mes que viene, el toque 2 lleva siempre un dato nuevo (una foto del montaje o un menú) y a las cuentas clave se les llama antes del último aviso.'; } });
  var precio = a.perdidas.filas.filter(function (r) { return r.motivo === 'precio'; });
  if (precio.length) c.push({ regla: 'precio', q: evmSuma_(precio),
    texto: function (q) { return precio.length + ' se perdieron por precio (' + qfmt(q) + '). En las que siguen abiertas, manda junto con la cotización una opción B más corta (otro menú o menos invitados).'; } });
  if (inf.vencen.n) c.push({ regla: 'vencen', q: inf.vencen.q,
    texto: function (q) { return 'En ' + inf.siguiente + ' vencen ' + inf.vencen.n + ' cotización(es) abierta(s) por ' + qfmt(q) + ' (' +
      inf.vencen.filas.slice(0, 4).map(function (r) { return r.cliente; }).join(', ') + (inf.vencen.n > 4 ? '…' : '') +
      '). Ten listo el último aviso de cada una para el jueves antes de que venza, con el monto del 50% para apartar.'; } });
  if (a.respuesta.mediana_h !== null && a.respuesta.mediana_h > 24) c.push({ regla: 'respuesta', q: a.respuesta.q_lentas,
    texto: function () { return 'La mediana de respuesta fue de ' + Math.round(a.respuesta.mediana_h) + ' h. La regla es menos de 24 h: contesta las consultas nuevas el mismo día, aunque la cotización salga después.'; } });
  if (!c.length) return { regla: 'nada', texto: 'No hay una pérdida ni un vencimiento que pidan algo especial. Sigue el ritmo de toques del procedimiento.' };
  c.sort(function (x, y) { return y.q - x.q; });
  return { regla: c[0].regla, texto: c[0].texto(c[0].q) };
}

/** El correo (y el resumen en texto). Corto, en tú, sin tablas. */
function evmTexto_(inf, url) {
  var a = inf.actual, p = inf.previo;
  var q = function (n) { return 'Q' + Math.round(n || 0).toLocaleString('en-US'); };
  var pct = function (x) { return x === null || x === undefined ? 'sin cierres' : Math.round(x * 100) + '%'; };
  var vs = function (x, y, fmt) { return fmt(x) + ' (' + inf.anterior.split(' ')[0] + ': ' + fmt(y) + ')'; };
  var lista = function (arr, fn) { return arr.length ? arr.map(fn).join(' · ') : 'ninguna'; };
  var L = [];
  L.push('Informe del embudo de eventos · ' + inf.nombre + (inf.en_curso ? ' (mes en curso, al ' + inf.hoy + ')' : ''));
  L.push('');
  var avisos = [];
  if (inf.falta.cierre.length) avisos.push('sin fecha de cierre: ' + inf.falta.cierre.join(', '));
  if (inf.falta.consulta.length) avisos.push('sin fecha de consulta: ' + inf.falta.consulta.join(', '));
  if (inf.falta.canal.length) avisos.push('sin canal: ' + inf.falta.canal.join(', '));
  if (avisos.length) { L.push('Datos que faltan: ' + avisos.join(' · ') + '.'); L.push(''); }
  L.push('1. Nuevas: ' + vs(a.nuevas.n, p.nuevas.n, String) + ' · ' + q(a.nuevas.q) +
         (a.nuevas.sin_consulta ? ' (' + a.nuevas.sin_consulta + ' contada(s) por la fecha de envío)' : ''));
  L.push('2. Ganadas: ' + a.ganadas.n + ' · ' + q(a.ganadas.q) + ' — ' + lista(a.ganadas.filas, function (r) { return r.cliente + ' ' + q(r.q); }));
  L.push('   Perdidas: ' + a.perdidas.n + ' · ' + q(a.perdidas.q) + ' — ' + lista(a.perdidas.filas, function (r) { return r.cliente + ' ' + q(r.q) + ' (' + (r.motivo || 'sin motivo') + ')'; }));
  L.push('3. Tasa de cierre: ' + vs(a.tasa.n, p.tasa.n, pct) + ' por cantidad · ' + vs(a.tasa.q, p.tasa.q, pct) + ' por quetzales' +
         (a.tasa.cerradas && a.tasa.cerradas < 5 ? '. Ojo: son ' + a.tasa.cerradas + ' cerradas, el porcentaje se mueve mucho' : '') + '.');
  L.push('4. Dónde se pierden (etapa más avanzada): ' + lista(a.perdidas_etapa, function (x) { return x.nombre + ' ' + x.n; }));
  L.push('5. Motivos: ' + lista(a.motivos, function (x) { return x.nombre + ' ' + x.n + ' (' + q(x.q) + ')'; }));
  L.push('6. Cierre por canal: ' + lista(a.canal, function (x) { return x.nombre + ' ' + x.ganadas + ' de ' + x.cerradas; }) +
         '. Nuevas por canal: ' + lista(a.nuevas.por_canal, function (x) { return x.nombre + ' ' + x.n; }));
  var r = a.respuesta, rp = p.respuesta;
  L.push('7. Respuesta: ' + (r.con_dato ? 'mediana ' + Math.round(r.mediana_h) + ' h, ' + r.en_24h + ' de ' + r.con_dato + ' en menos de 24 h' : 'sin datos') +
         (rp.con_dato ? ' (' + inf.anterior.split(' ')[0] + ': mediana ' + Math.round(rp.mediana_h) + ' h, ' + rp.en_24h + ' de ' + rp.con_dato + ')' : '') +
         (r.sin_dato ? '. ' + r.sin_dato + ' sin dato' : '') + '.');
  var k = a.claves;
  L.push('8. Planners y cuentas clave: ' + k.nuevas + ' nueva(s), ' + k.ganadas + ' ganada(s) ' + q(k.q_ganada) + ', ' + k.perdidas +
         ' perdida(s) ' + q(k.q_perdida) + '. Abiertas hoy: ' + k.abiertas + ' por ' + q(k.q_abierta) + '.');
  L.push('9. Vence en ' + inf.siguiente + ': ' + inf.vencen.n + ' abierta(s) por ' + q(inf.vencen.q) +
         (inf.vencen.n ? ' — ' + lista(inf.vencen.filas, function (x) { return x.cliente + ' ' + q(x.q) + ' (' + x.vence + ')'; }) : '') + '.');
  L.push('');
  L.push('Para ' + inf.siguiente.split(' ')[0] + ': ' + inf.recomendacion.texto);
  if (url) { L.push(''); L.push('El detalle está en la intranet: ' + url); }
  return L.join('\n');
}

/** Pantalla Eventos › El mes. anio/mes vacíos = el mes en curso. */
function getInformeEventos(auth, anio, mes) {
  requiereEventos_(auth);
  var hoy = Utilities.formatDate(new Date(), 'America/Guatemala', 'yyyy-MM-dd');
  anio = Number(anio) || Number(hoy.slice(0, 4)); mes = Number(mes) || Number(hoy.slice(5, 7));
  if (mes < 1 || mes > 12 || anio < 2026 || anio > 2100) throw new Error('Mes inválido.');
  var inf = evmCalc_(evLeer_(), anio, mes, hoy);
  inf.texto = evmTexto_(inf, null);
  return inf;
}

/** Vigía, cada hora: el día 3 a las 9:00 (o hasta las 12:00 si falló) manda el informe del mes anterior. */
function evmCadaHora_(ahora) {
  ahora = ahora || new Date();
  var tz = 'America/Guatemala';
  var dia = Number(Utilities.formatDate(ahora, tz, 'd')), hora = Number(Utilities.formatDate(ahora, tz, 'H'));
  if (dia !== 3 || hora < 9 || hora > 12) return 'Informe de eventos: no toca.';
  var hoy = Utilities.formatDate(ahora, tz, 'yyyy-MM-dd');
  var m = evmMesMover_(Number(hoy.slice(0, 4)), Number(hoy.slice(5, 7)), -1);
  var llave = 'EVM_AVISO_' + evmMesClave_(m.anio, m.mes).replace('-', '');
  var p = PropertiesService.getScriptProperties();
  if (p.getProperty(llave)) return 'Informe de eventos: ya salió.';
  return evmEnviar_(m.anio, m.mes, hoy, false, llave);
}

function evmEnviar_(anio, mes, hoy, prueba, llave) {
  var inf = evmCalc_(evLeer_(), anio, mes, hoy);
  MailApp.sendEmail({ to: DUENO_CORREO_, name: 'Rosanta · Eventos',
    subject: (prueba ? '[PRUEBA] ' : '') + 'Rosanta · Eventos: informe de ' + inf.nombre,
    body: evmTexto_(inf, urlIntranet_() + '?page=eventos') });
  if (!prueba) { PropertiesService.getScriptProperties().setProperty(llave, hoy); procMarcar_('eventosMes'); }
  return 'Informe de eventos de ' + inf.nombre + (prueba ? ' [PRUEBA]' : '') + ' enviado.';
}

/** EDITOR (solo dueño): manda "[PRUEBA]" con el mes en curso, sin tocar la llave ni la marca. */
function evmProbarInforme() {
  soloDueno_();
  var hoy = Utilities.formatDate(new Date(), 'America/Guatemala', 'yyyy-MM-dd');
  var r = evmEnviar_(Number(hoy.slice(0, 4)), Number(hoy.slice(5, 7)), hoy, true, null);
  Logger.log(r);
  return r;
}
