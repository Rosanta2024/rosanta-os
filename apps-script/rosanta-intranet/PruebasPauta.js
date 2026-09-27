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

  prCorrer_(g, 'Escala solo si las reservas atribuidas suben y el negocio no baja', function () {
    var mk = function (wk, r) { return { tipo_resultado: 'conversion', inicio: '2026-08-01', wk: wk, gasto: 160,
                                         reservas_atribuidas: r, alertas: '', resultado_nombre: 'reservas' }; };
    var serie = [mk(37, 2), mk(38, 4), mk(39, 6)];
    var negocio = { 35: { reservas: 16 }, 36: { reservas: 16 }, 37: { reservas: 17 }, 38: { reservas: 18 }, 39: { reservas: 20 } };
    var ev = psEvaluarConjunto_(serie[2], serie, cfg, hoy, [], negocio);
    prIgual_(g, 'Escala solo si las reservas atribuidas suben y el negocio no baja', ev.estado, 'ESCALAR', ev.razon);
    negocio[39].reservas = 12;
    var ev2 = psEvaluarConjunto_(serie[2], serie, cfg, hoy, [], negocio);
    prIgual_(g, 'No escala si el negocio bajó', ev2.estado, 'MANTENER', ev2.razon);
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

  prCorrer_(g, 'Semana ISO', function () {
    var s = psSemanaDe_(new Date(2026, 8, 27, 12));
    prIgual_(g, 'Semana ISO', s.id + ' ' + s.desde + ' ' + s.hasta, '2026-W39 2026-09-21 2026-09-27');
  });
}
