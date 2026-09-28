/**
 * PruebasPauta.gs — grupo "pauta" de la bateria (27-sep-2026).
 *
 * Prueba el motor de PautaSistema.gs con casos armados a mano, sin llamar a Meta:
 * cada caso es una trampa que ya costo una mala decision. Si una de estas falla,
 * el sistema volvio a poder recomendar escalar tráfico barato sin reservas.
 */
function prPauta_(res) {
  var g = prGrupo_(res, '9. Sistema de pauta');
  var cfg = {};
  PS_REGLAS_BASE.forEach(function (r) { cfg[r[0]] = r[1]; });
  var hoy = '2026-09-28';

  prCorrer_(g, 'Lee el evento de una regla de pixel', function () {
    prIgual_(g, 'Lee el evento de una regla de pixel',
      psEventoDeRegla_('{"and":[{"event":{"eq":"PageView"}},{"or":[{"URL":{"i_contains":"reserv"}}]}]}'), 'PageView');
  });

  prCorrer_(g, 'Una conversión con regla PageView es vista de página', function () {
    var cc = { '2169262467156052': { name: 'Vista_Reservas', rule: '{"and":[{"event":{"eq":"PageView"}}]}' } };
    var q = psQueCuenta_({ optimization_goal: 'OFFSITE_CONVERSIONS',
      promoted_object: { pixel_id: '1', custom_conversion_id: '2169262467156052' } }, cc, cfg);
    prIgual_(g, 'Una conversión con regla PageView es vista de página', q.tipo, 'vista_pagina', q.nombre);
  });

  prCorrer_(g, 'NewReservation cuenta como conversión real', function () {
    var q = psQueCuenta_({ optimization_goal: 'OFFSITE_CONVERSIONS',
      promoted_object: { pixel_id: '1', custom_event_type: 'OTHER', custom_event_str: 'NewReservation' } }, {}, cfg);
    prIgual_(g, 'NewReservation cuenta como conversión real', q.tipo, 'conversion');
  });

  prCorrer_(g, 'Visitas al perfil son tráfico, no conversión', function () {
    prIgual_(g, 'Visitas al perfil son tráfico, no conversión',
      psQueCuenta_({ optimization_goal: 'PROFILE_VISIT' }, {}, cfg).tipo, 'trafico');
  });

  var base = { campana: 'Nuevo Retargeting (Reservas)', conjunto: 'Carrito', objetivo: 'OUTCOME_SALES',
               estado_meta: 'ACTIVE', gasto: 480, alcance: 10601, frecuencia: 3.8, ctr_enlace: 16.6,
               cpc_enlace: 0.07, audiencia_tam: 20, tipo_resultado: 'vista_pagina',
               resultado_nombre: 'vistas de página (Vista_Reservas)', evento: 'PageView' };

  prCorrer_(g, 'Detecta la vista de página disfrazada de reserva', function () {
    var al = psValidar_(base, { cfg: cfg, pixel: {} });
    prIgual_(g, 'Detecta la vista de página disfrazada de reserva',
      al.some(function (a) { return a.codigo === 'disfraz' && a.nivel === 'rojo'; }), true);
  });

  prCorrer_(g, 'Detecta la audiencia chica expandida a frío', function () {
    var al = psValidar_(base, { cfg: cfg, pixel: {} });
    prIgual_(g, 'Detecta la audiencia chica expandida a frío',
      al.some(function (a) { return a.codigo === 'expansion'; }), true);
  });

  prCorrer_(g, 'Un tamaño de audiencia desconocido (-1 de Meta) no dispara expansión', function () {
    var malos = [-4, -1, 'sin_dato'].every(function (v) {
      var h = Object.assign({}, base, { audiencia_tam: v });
      return !psValidar_(h, { cfg: cfg, pixel: {} }).some(function (a) { return a.codigo === 'expansion'; });
    });
    prIgual_(g, 'Un tamaño de audiencia desconocido (-1 de Meta) no dispara expansión', malos, true);
  });

  prCorrer_(g, 'CTR alto con CPC bajo es alarma, no logro', function () {
    var al = psValidar_(base, { cfg: cfg, pixel: {} });
    prIgual_(g, 'CTR alto con CPC bajo es alarma, no logro',
      al.some(function (a) { return a.codigo === 'clic_sin_intencion'; }), true);
  });

  prCorrer_(g, 'Detecta AddToCart que dispara en la home', function () {
    var pixel = { PageView: { conteo: 7157 }, AddToCart: { conteo: 5598, url_top: 'https://www.rosanta.rest/', pct_url_top: 99 } };
    var h = Object.assign({}, base, { tipo_resultado: 'intermedio', evento: 'AddToCart', audiencia_tam: '' });
    var al = psValidar_(h, { cfg: cfg, pixel: pixel });
    prIgual_(g, 'Detecta AddToCart que dispara en la home',
      al.some(function (a) { return a.codigo === 'contaminado'; }), true);
  });

  prCorrer_(g, 'Un conjunto en rojo queda en CORREGIR', function () {
    var h = Object.assign({}, base, { inicio: '2026-09-01', wk: 39 });
    h.alertas = psValidar_(h, { cfg: cfg, pixel: {} }).map(function (a) {
      return (a.nivel === 'rojo' ? '🔴 ' : '🟡 ') + a.texto; }).join('\n');
    var ev = psEvaluarConjunto_(h, [h], cfg, hoy, [], {});
    prIgual_(g, 'Un conjunto en rojo queda en CORREGIR', ev.estado, 'CORREGIR', ev.razon);
  });

  prCorrer_(g, 'Tráfico barato nunca se escala por su propia métrica', function () {
    var h = { tipo_resultado: 'trafico', resultado_nombre: 'visitas al perfil de IG', inicio: '2026-07-01',
              wk: 39, gasto: 838, ctr_enlace: 3.1, cpc_enlace: 0.41, alertas: '' };
    var ev = psEvaluarConjunto_(h, [h, h, h], cfg, hoy, [], {});
    prIgual_(g, 'Tráfico barato nunca se escala por su propia métrica', ev.estado, 'MANTENER', ev.regla);
  });

  /* R3 amarrada al Sistema de Medición (27-sep-2026): subir no alcanza. Hace falta
     volumen (reservas_min_escalar) y que el negocio esté en su META de comensales. */
  var mkC = function (wk, r) { return { tipo_resultado: 'conversion', inicio: '2026-08-01', wk: wk, gasto: 160,
                                         reservas_atribuidas: r, alertas: '', resultado_nombre: 'reservas' }; };
  var negOk = function () { return { 35: { reservas: 16 }, 36: { reservas: 16 }, 37: { reservas: 17 }, 38: { reservas: 18 },
                                     39: { reservas: 20, comensales: 150, clientes_nuevos: 3 } }; };
  var metasOk = { com_meta_sem: 131, clientes_meta_sem: 9.3, lectura: 18 };

  prCorrer_(g, 'Escala solo con volumen, reservas al alza y comensales en meta', function () {
    var serie = [mkC(37, 2), mkC(38, 4), mkC(39, 6)];
    var ev = psEvaluarConjunto_(serie[2], serie, cfg, hoy, [], negOk(), metasOk);
    prIgual_(g, 'Escala solo con volumen, reservas al alza y comensales en meta', ev.estado, 'ESCALAR', ev.razon);
  });

  prCorrer_(g, 'No escala si el negocio bajó', function () {
    var serie = [mkC(37, 2), mkC(38, 4), mkC(39, 6)], negocio = negOk();
    negocio[39].reservas = 12;
    var ev = psEvaluarConjunto_(serie[2], serie, cfg, hoy, [], negocio, metasOk);
    prIgual_(g, 'No escala si el negocio bajó', ev.estado, 'MANTENER', ev.razon);
  });

  prCorrer_(g, 'No escala con reservas atribuidas de ruido (0 → 1 → 2)', function () {
    var serie = [mkC(37, 0), mkC(38, 1), mkC(39, 2)];
    var ev = psEvaluarConjunto_(serie[2], serie, cfg, hoy, [], negOk(), metasOk);
    prIgual_(g, 'No escala con reservas atribuidas de ruido (0 → 1 → 2)', ev.regla, 'R3 · Volumen insuficiente', ev.razon);
  });

  prCorrer_(g, 'No escala con comensales bajo el ritmo de la meta', function () {
    var serie = [mkC(37, 2), mkC(38, 4), mkC(39, 6)], negocio = negOk();
    negocio[39].comensales = 100;
    var ev = psEvaluarConjunto_(serie[2], serie, cfg, hoy, [], negocio, metasOk);
    prIgual_(g, 'No escala con comensales bajo el ritmo de la meta', ev.estado, 'MANTENER', ev.razon);
  });

  prCorrer_(g, 'Sin meta de comensales no se escala', function () {
    var serie = [mkC(37, 2), mkC(38, 4), mkC(39, 6)];
    var ev = psEvaluarConjunto_(serie[2], serie, cfg, hoy, [], negOk(), {});
    prIgual_(g, 'Sin meta de comensales no se escala', ev.estado, 'MANTENER', ev.razon);
  });

  prCorrer_(g, 'Con lectura ≥50% los clientes nuevos también deciden', function () {
    var serie = [mkC(37, 2), mkC(38, 4), mkC(39, 6)];
    var ev = psEvaluarConjunto_(serie[2], serie, cfg, hoy, [], negOk(), { com_meta_sem: 131, clientes_meta_sem: 9.3, lectura: 80 });
    prIgual_(g, 'Con lectura ≥50% los clientes nuevos también deciden', ev.estado, 'MANTENER', ev.razon);
  });

  prCorrer_(g, 'Clientes nuevos no juzgan una prueba con lectura de Wix bajo 50%', function () {
    var row = function () { return { id: 'p2', estado: 'en_curso', metrica_juez: 'clientes_nuevos_negocio' }; };
    var previa = { id: 'p2', estado: 'propuesta' };
    var r = [];
    try { psReglasPrueba_(row(), previa, [], true, true, 18, cfg.lectura_min_juez); r.push('pasa'); } catch (e) { r.push('lanza'); }
    try { r.push(psReglasPrueba_(row(), previa, [], true, true, 80, cfg.lectura_min_juez)); } catch (e) { r.push('lanza: ' + e.message); }
    var sinAtrib = PS_METRICAS_JUEZ.reservas_atribuidas ? 'reservas_atribuidas sigue siendo juez' : 'ok';
    prIgual_(g, 'Clientes nuevos no juzgan una prueba con lectura de Wix bajo 50%', r.join('|') + '|' + sinAtrib, 'lanza|en_curso|ok');
  });

  prCorrer_(g, 'Apaga conversión con gasto y cero reservas', function () {
    var mk = function (wk) { return { tipo_resultado: 'conversion', inicio: '2026-08-01', wk: wk, gasto: 100,
                                      reservas_atribuidas: 0, alertas: '' }; };
    var serie = [mk(38), mk(39)];
    prIgual_(g, 'Apaga conversión con gasto y cero reservas',
      psEvaluarConjunto_(serie[1], serie, cfg, hoy, [], {}).estado, 'APAGAR');
  });

  prCorrer_(g, 'No se juzga antes de la ventana mínima', function () {
    var h = { tipo_resultado: 'conversion', inicio: '2026-09-25', wk: 39, gasto: 50, reservas_atribuidas: 0, alertas: '' };
    prIgual_(g, 'No se juzga antes de la ventana mínima',
      psEvaluarConjunto_(h, [h], cfg, hoy, [], {}).estado, 'ESPERAR');
  });

  prCorrer_(g, 'Una prueba en curso bloquea otra decisión', function () {
    var pruebas = [{ id: 'p1', estado: 'en_curso', hipotesis: 'x', fecha_lectura: '2026-10-05' }];
    var conj = [{ estado: 'AJUSTAR CREATIVO', conjunto: 'a', accion: 'rotar', gasto: 10 }];
    prIgual_(g, 'Una prueba en curso bloquea otra decisión',
      psDecisionSemana_(conj, pruebas, hoy, []).tipo, 'NO MOVER NADA');
  });

  prCorrer_(g, 'Una prueba vencida se lee antes de decidir otra cosa', function () {
    var pruebas = [{ id: 'p1', estado: 'en_curso', hipotesis: 'x', fecha_lectura: '2026-09-27' }];
    prIgual_(g, 'Una prueba vencida se lee antes de decidir otra cosa',
      psDecisionSemana_([], pruebas, hoy, []).tipo, 'LEER PRUEBA');
  });

  prCorrer_(g, 'Sin reservas del negocio no se mueve dinero', function () {
    var conj = [{ estado: 'ESCALAR', conjunto: 'a', accion: 'subir', gasto: 10 }];
    prIgual_(g, 'Sin reservas del negocio no se mueve dinero',
      psDecisionSemana_(conj, [], hoy, [{ nivel: 'rojo', texto: 'falta' }]).tipo, 'NO MOVER NADA');
  });

  /* El Panel de Asesores se retiró el 27-sep-2026 (Juanma): sus debates eran una tercera
     voz que contradecía a este sistema y al de Medición. Si vuelve a aparecer, falla. */
  prCorrer_(g, 'El Panel de Asesores sigue retirado', function () {
    var txt = HtmlService.createTemplateFromFile('Marketing').getRawContent();
    var restos = ['panelInvestigar', 'PANEL_PROMPT', 'data-tab="panel"', "'debates'", 'rosanta_deb', 'estRegen', 'LOOMER']
      .filter(function (x) { return txt.indexOf(x) !== -1; });
    if (typeof panelInvestigar === 'function') restos.push('panelInvestigar en el servidor');
    if (SCHEMA.debates) restos.push('debates en SCHEMA');
    prIgual_(g, 'El Panel de Asesores sigue retirado', restos.join(', '), '', restos.length ? 'vuelve a estar: ' + restos.join(', ') : '');
  });

  /* Estándar creativo de pauta (27-sep-2026): regla de la casa, sin personas. Si vuelve
     un nombre de experto, un talento que ya no está o un benchmark escrito a mano, falla. */
  prCorrer_(g, 'El estándar creativo de pauta no nombra personas', function () {
    var txt = HtmlService.createTemplateFromFile('Marketing').getRawContent();
    var m = txt.match(/const ESTANDAR_PAUTA=`([\s\S]*?)`;/);
    if (!m) { prAnotar_(g, 'El estándar creativo de pauta no nombra personas', 'FALLA', 'No encontré la constante ESTANDAR_PAUTA en Marketing.html.'); return; }
    var e = m[1].toLowerCase();
    var malos = ['savannah', 'sanchez', 'loomer', 'ciancio', 'kaushik', 'ritson', 'hormozi', 'wilson', 'http', 'lente']
      .filter(function (x) { return e.indexOf(x) !== -1; });
    ['de autor', 'signature', 'jardín santa rosa', 'leña de café', 'jeffry', 'maco']
      .forEach(function (x) { if (e.indexOf(x) === -1) malos.push('falta "' + x + '"'); });
    if (/\d+\s*%/.test(e)) malos.push('trae un porcentaje escrito a mano');
    if (/SAVANNAH\s*=|LOOMER\s*=/.test(txt)) malos.push('sigue viva una constante de lente');
    prIgual_(g, 'El estándar creativo de pauta no nombra personas', malos.join(', '), '', malos.length ? malos.join(' · ') : '');
  });

  prCorrer_(g, 'Registrar como prueba entra como propuesta y respeta una en curso a la vez', function () {
    var n = 'Registrar como prueba entra como propuesta y respeta una en curso a la vez';
    var nueva = { hipotesis: 'h', cambio: 'c', metrica_juez: 'reservas_negocio', estado: 'propuesta' };
    var enCurso = [{ id: 'p1', estado: 'en_curso', hipotesis: 'otra' }];
    var lanza = function (fn) { try { fn(); return ''; } catch (e) { return 'lanza'; } };
    var r = [
      psReglasPrueba_(Object.assign({}, nueva), null, enCurso, false, true),                            // propone con otra en curso
      lanza(function () { psReglasPrueba_(Object.assign({}, nueva, { estado: 'en_curso' }), null, [], false, true); }), // no dueño arranca
      lanza(function () { psReglasPrueba_({ id: 'p2', estado: 'en_curso', metrica_juez: 'reservas_negocio' },
                                          { id: 'p2', estado: 'propuesta' }, enCurso, true, true); }),     // segunda en curso
      psReglasPrueba_({ id: 'p2', estado: 'en_curso' }, { id: 'p2', estado: 'propuesta' }, [], true, true),  // dueño, sin otra
      lanza(function () { psReglasPrueba_(Object.assign({}, nueva), null, [], false, false); })             // solo lectura
    ].join('|');
    var txt = HtmlService.createTemplateFromFile('Marketing').getRawContent();
    var fn = (txt.match(/async function paRegistrar[\s\S]*?\n}/) || [''])[0];
    if (fn.indexOf("srv('psGuardarPrueba'") === -1 || fn.indexOf("estado:'propuesta'") === -1) r += '|el botón no manda una propuesta';
    prIgual_(g, n, r, 'propuesta|lanza|lanza|en_curso|lanza');
  });

  prCorrer_(g, 'Ninguna pestaña del Marketing OS se reemplaza completa desde el navegador', function () {
    var n = 'Ninguna pestaña del Marketing OS se reemplaza completa desde el navegador';
    var faltan = ['calendario', 'aprendizajes', 'carritos', 'piezas', 'propuestas'].filter(function (t) { return !TABS_SIN_REPLACE[t]; });
    var txt = HtmlService.createTemplateFromFile('Marketing').getRawContent();
    var mapa = (txt.match(/const OS_MAP=\{([^}]*)\}/) || ['', 'no encontrado'])[1].trim();
    prIgual_(g, n, (faltan.length ? 'sin guarda: ' + faltan.join(',') : 'ok') + ' | OS_MAP=' + (mapa || 'vacío'), 'ok | OS_MAP=vacío');
  });

  prCorrer_(g, 'srv() de Marketing solo llama funciones de su lista blanca', function () {
    var n = 'srv() de Marketing solo llama funciones de su lista blanca';
    var txt = HtmlService.createTemplateFromFile('Marketing').getRawContent();
    var lista = (txt.match(/const SRV_PERMITIDAS=new Set\(\[([\s\S]*?)\]\)/) || ['', ''])[1];
    var ok = {};
    (lista.match(/'([A-Za-z_]+)'/g) || []).forEach(function (x) { ok[x.slice(1, -1)] = 1; });
    var usadas = {};
    (txt.match(/srv\('([A-Za-z_]+)'/g) || []).forEach(function (x) { usadas[x.slice(5, -1)] = 1; });
    var fuera = Object.keys(usadas).filter(function (f) { return !ok[f]; });
    var inexistentes = Object.keys(ok).filter(function (f) { return typeof globalThis[f] !== 'function'; });
    var guarda = /function srv\(fn,[^)]*\)\{\s*if\(!SRV_PERMITIDAS\.has\(fn\)\)/.test(txt);
    prIgual_(g, n, [Object.keys(ok).length ? 'lista' : 'sin lista', guarda ? 'guarda' : 'sin guarda',
      'fuera:' + (fuera.join(',') || '-'), 'inexistentes:' + (inexistentes.join(',') || '-'),
      ok.mktReplace ? 'mktReplace permitido' : 'sin replace'].join(' | '),
      'lista | guarda | fuera:- | inexistentes:- | sin replace');
  });

  prCorrer_(g, 'Semana ISO', function () {
    var s = psSemanaDe_(new Date(2026, 8, 27, 12));
    prIgual_(g, 'Semana ISO', s.id + ' ' + s.desde + ' ' + s.hasta, '2026-W39 2026-09-21 2026-09-27');
  });
}
