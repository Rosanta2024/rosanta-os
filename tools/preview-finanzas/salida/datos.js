/* Datos de mentira calcados de la pantalla real del 21-09-2026 (S38).
   Sirven SOLO para ver el diseño local; no salen de ningún Sheet. */
var MOCK_FIN = {
  anio: 2026, gen: '21/09/2026 12:14', meta_cogs: 28.0,
  caja: 24011, gasto_dia: 5034, dias_caja: 4.8,
  total: { ventas: 1308046, eventos: 38785, com: 5012, cogsp: 38.9, laborp: 20.7,
           primep: 55.9, netop: -3.9, tipo: { F: 299557, S: 311318, V: 380796 } },
  bloques: [
    { bloque:'Nomina y salarios',      q:271055, pct:20.7, min:25, max:30, zona:'bajo',  sobre_mes:0 },
    { bloque:'Inmueble y ocupacion',   q:188063, pct:14.4, min:6,  max:10, zona:'rojo',  sobre_mes:6395 },
    { bloque:'Comisiones y cargos',    q:85679,  pct:6.6,  min:3,  max:5,  zona:'rojo',  sobre_mes:2325 },
    { bloque:'Impuestos',              q:80127,  pct:6.1,  min:0,  max:0,  zona:'gris',  sobre_mes:0 },
    { bloque:'Bienes de uso',          q:70606,  pct:5.4,  min:3,  max:5,  zona:'rojo',  sobre_mes:581 },
    { bloque:'Prestadores y honorarios',q:62713, pct:4.8,  min:1,  max:3,  zona:'rojo',  sobre_mes:2616 },
    { bloque:'Tarifas y servicios',    q:59425,  pct:4.5,  min:4,  max:6,  zona:'verde', sobre_mes:0 },
    { bloque:'Propinas al equipo',     q:55514,  pct:4.2,  min:0,  max:0,  zona:'gris',  sobre_mes:0 },
    { bloque:'Marketing',              q:51446,  pct:3.9,  min:4,  max:8,  zona:'bajo',  sobre_mes:0 },
    { bloque:'Mantencion',             q:51202,  pct:3.9,  min:2,  max:4,  zona:'verde', sobre_mes:0 },
    { bloque:'Uniformes',              q:2750,   pct:0.2,  min:0,  max:0,  zona:'gris',  sobre_mes:0 }
  ],
  meses: [
    {mes:'Ene',ventas:143277,eventos:0,    com:597,cogsp:43.5,laborp:20.1,primep:59.6,netop:-9.7, labor_origen:'planilla'},
    {mes:'Feb',ventas:184852,eventos:11536,com:732,cogsp:37.1,laborp:16.7,primep:50.4,netop:14.9, labor_origen:'planilla'},
    {mes:'Mar',ventas:162337,eventos:0,    com:647,cogsp:37.1,laborp:18.2,primep:51.9,netop:-2.5, labor_origen:'planilla'},
    {mes:'Abr',ventas:159917,eventos:0,    com:477,cogsp:31.5,laborp:18.2,primep:46.8,netop:0.0,  labor_origen:'planilla'},
    {mes:'May',ventas:183896,eventos:2607, com:702,cogsp:32.0,laborp:18.5,primep:47.6,netop:-1.8, labor_origen:'planilla'},
    {mes:'Jun',ventas:129807,eventos:7813, com:518,cogsp:34.8,laborp:24.6,primep:56.3,netop:-6.8, labor_origen:'planilla'},
    {mes:'Jul',ventas:118663,eventos:7167, com:508,cogsp:42.7,laborp:26.1,primep:64.3,netop:-19.0,labor_origen:'planilla'},
    {mes:'Ago',ventas:137739,eventos:9662, com:546,cogsp:55.7,laborp:24.3,primep:74.2,netop:-30.1,labor_origen:'planilla'},
    {mes:'Sep',ventas:87558, eventos:0,    com:285,cogsp:40.9,laborp:25.5,primep:62.7,netop:17.5, labor_origen:'estimada',labor_desde:'Ago',labor_parte:0.67}
  ],
  semanas: [
    {w:26,ini:'22/06',ventas:32882,dv:-29.0,com:142,tp:232,cogsp:38.9,cogs_m4:31.0,prime_m4:50.2,caja:13742},
    {w:27,ini:'29/06',ventas:24013,dv:-27.0,com:99, tp:243,cogsp:41.5,cogs_m4:32.2,prime_m4:51.2,caja:27876},
    {w:28,ini:'06/07',ventas:22957,dv:-4.4, com:97, tp:237,cogsp:43.8,cogs_m4:32.5,prime_m4:51.2,caja:31185},
    {w:29,ini:'13/07',ventas:32703,dv:42.5, com:131,tp:250,cogsp:50.5,cogs_m4:43.8,prime_m4:63.7,caja:25821},
    {w:30,ini:'20/07',ventas:27850,dv:-14.8,com:124,tp:225,cogsp:39.3,cogs_m4:44.1,prime_m4:64.6,caja:22206},
    {w:31,ini:'27/07',ventas:28634,dv:2.8,  com:133,tp:215,cogsp:46.2,cogs_m4:45.3,prime_m4:64.0,caja:22627},
    {w:32,ini:'03/08',ventas:29050,dv:1.5,  com:123,tp:236,cogsp:44.8,cogs_m4:45.4,prime_m4:63.4,caja:11341},
    {w:33,ini:'10/08',ventas:31302,dv:7.8,  com:118,tp:265,cogsp:76.9,cogs_m4:52.5,prime_m4:70.6,caja:17992},
    {w:34,ini:'17/08',ventas:36114,dv:15.4, com:139,tp:260,cogsp:61.3,cogs_m4:58.0,prime_m4:74.7,caja:27620},
    {w:35,ini:'24/08',ventas:27383,dv:-24.2,com:100,tp:274,cogsp:48.2,cogs_m4:58.5,prime_m4:75.9,caja:15532},
    {w:36,ini:'31/08',ventas:41707,dv:52.3, com:118,tp:353,cogsp:31.9,cogs_m4:53.2,prime_m4:69.1,caja:24011},
    {w:37,ini:'07/09',ventas:27628,dv:-33.8,com:89, tp:310,cogsp:58.1,cogs_m4:48.7,prime_m4:64.2,caja:24011},
    {w:38,ini:'14/09',ventas:19309,dv:-30.1,com:82, tp:235,cogsp:37.7,cogs_m4:42.9,prime_m4:60.1,caja:24011}
  ],
  integridad: {
    por_clasificar:2, factura_pct:54.7, dias_atraso:1, sin_identificar:10375, sin_mapear:0,
    ult:{'01_FEL_Maestro':'18/09/2026','03_Tarjeta_Credito_BAC':'31/08/2026','04_Banco_BAC':'31/08/2026',
         '05_Banco_Industrial':'20/09/2026','02_Ventas_Maestro':'20/09/2026'},
    planilla:{}, fugas:{'01_FEL_Maestro':370},
    cobertura:{'01_FEL_Maestro':{'alquiler por banco: no suma':275175,'COGS':263725,
      'DRE · Comisiones y cargos':77555,'DRE · Prestadores y honorarios':51662,
      'DRE · Tarifas y servicios':51398,'DRE · Bienes de uso':42571,'DRE · Mantencion':28165,
      'personal':22991,'anulada en SAT':7536,'DRE · Marketing':3279,'POR CLASIFICAR':370},
      '03_Tarjeta_Credito_BAC':{'COGS':84210,'DRE · Marketing':16521,'personal':61200},
      '04_Banco_BAC':{'COGS':43100,'personal':75346,'DRE · Comisiones y cargos':8124},
      '05_Banco_Industrial':{'NOMINA':271055,'COGS':160400,'DRE · Inmueble y ocupacion':188063}},
    desconocidas:{}
  }
};
/* EscenariosVista lee total.bloques (mapa nombre -> quetzales del año) y
   total.cogs. Se derivan de lo de arriba para que el preview no invente otra
   cifra distinta de la de la lista de bloques. */
MOCK_FIN.total.bloques = {};
MOCK_FIN.bloques.forEach(function (b) { MOCK_FIN.total.bloques[b.bloque] = b.q; });
/* El resto de total, derivado para que cierre con los porcentajes de arriba:
   ventas_ss = venta sin servicio (factor del año 0.8929, regla 14);
   neto = ventas - cogs - gop, con gop incluyendo la nomina. */
MOCK_FIN.total.ventas_ss = 1167955;
MOCK_FIN.total.cogs = 454335;
MOCK_FIN.total.labor = 270765;
MOCK_FIN.total.gop = 904725;
MOCK_FIN.total.neto = -51014;
MOCK_FIN.total.pers = 136546;
MOCK_FIN.total.dev = 100325;


/* EscenariosVista calcula el punto de equilibrio por mes: necesita de cada mes
   su cogs, su gop y el reparto fijo/semivariable/variable. Se derivan de los
   porcentajes ya declarados arriba. */
MOCK_FIN.meses.forEach(function (m) {
  m.ventas_ss = Math.round(m.ventas * 0.8929);
  m.cogs  = Math.round(m.ventas_ss * m.cogsp / 100);
  m.labor = Math.round(m.ventas * m.laborp / 100);
  m.neto  = Math.round(m.ventas * m.netop / 100);
  m.gop   = m.ventas - m.cogs - m.neto;
  m.tipo  = { F: Math.round(m.gop * 0.30), S: Math.round(m.gop * 0.31),
              V: m.gop - Math.round(m.gop * 0.30) - Math.round(m.gop * 0.31) };
  m.m = MOCK_FIN.meses.indexOf(m) + 1;
  m.bloques = {};
  // Punto de equilibrio, con la MISMA formula del servidor (FinanzasDatos.js:856):
  // fijo = F + S/2 · mc = (ventas - cogs)/ventas · bev = fijo / mc
  m.fijo = Math.round(m.tipo.F + m.tipo.S * 0.5);
  m.variable = Math.round(m.tipo.V + m.tipo.S * 0.5);
  m.mc   = Math.round((m.ventas - m.cogs - m.variable) / m.ventas * 1000) / 10;
  m.bev  = (m.ventas - m.cogs - m.variable) > 0
    ? Math.round(m.fijo / ((m.ventas - m.cogs - m.variable) / m.ventas)) : null;
  m.tickets = m.com;
});

MOCK_FIN.ultima = MOCK_FIN.semanas[MOCK_FIN.semanas.length - 1];
MOCK_FIN.ultima.w = 38; MOCK_FIN.ultima.fin = '20/09';
MOCK_FIN.ultima.cogs = 6612; MOCK_FIN.ultima.prime = 60.9; MOCK_FIN.ultima.laborp = 26.6;


/* getMetasData: la meta del mes y la de cada semana. Septiembre 2026 con la
   regla del codigo (piso = promedio de los 3 ultimos meses cerrados). */
var MOCK_METAS = {
  anio:2026, m:9, mes:'Septiembre', gen:'21/09/2026 12:14',
  sin_datos_del_mes:false, meta_food:28,
  meta:{ venta:128736, food:28, automatica:true, manda_piso:true,
    origen:'Promedio de los ultimos 3 meses (Q128,736). Manda el piso porque el +20% sobre Septiembre 2025 daria solo Q28,926.' },
  dias:{ total:30, corridos:20, restantes:10 },
  acumulado:87558, comensales:285, ultima_carga:'20/09/2026',
  esperado:85824, brecha:1734, avance:68.0, falta:41178,
  necesario_dia:4118, necesario_semana:28825,
  proyeccion:131337, proyeccion_pct:102.0,
  piso:128736, por_anio_pasado:28926, anio_ant:2025,
  base_anterior:{ ventas:24105 },
  compra_tope:7205, factor_sin_servicio:0.8929,
  semanas:[
    {w:36,ini:'1/9', fin:'6/9', dias:6,dias_corridos:6,ventas:40621,com:140,cerrada:true, en_curso:false,futura:false,meta:25747,meta_acum:25747,acum:40621,meta_hoy:25747,dif:14874,cumple:157.8,falta:0},
    {w:37,ini:'7/9', fin:'13/9',dias:7,dias_corridos:7,ventas:27628,com:89, cerrada:true, en_curso:false,futura:false,meta:30038,meta_acum:55785,acum:68249,meta_hoy:30038,dif:-2410,cumple:92.0,falta:2410},
    {w:38,ini:'14/9',fin:'20/9',dias:7,dias_corridos:7,ventas:19309,com:82, cerrada:true, en_curso:false,futura:false,meta:30038,meta_acum:85823,acum:87558,meta_hoy:30038,dif:-10729,cumple:64.3,falta:10729},
    {w:39,ini:'21/9',fin:'27/9',dias:7,dias_corridos:0,ventas:0,    com:0,  cerrada:false,en_curso:false,futura:true, meta:30038,meta_acum:115861,acum:87558,meta_hoy:0,dif:null,cumple:null,falta:30038},
    {w:40,ini:'28/9',fin:'30/9',dias:3,dias_corridos:0,ventas:0,    com:0,  cerrada:false,en_curso:false,futura:true, meta:12874,meta_acum:128735,acum:87558,meta_hoy:0,dif:null,cumple:null,falta:12874}
  ]
};


/* getComparativoData: 2026 contra 2025, numeros inventados con la forma real. */
var MOCK_CMP = {
  anio:2026, anio_ant:2025, gen:'21/09/2026 12:14', tope:190000,
  filas:[
    {mes:'Enero',     v25:88000, v26:143277,dif:55277, pct:62.8, t25:410,t26:597,tp25:214.63,tp26:239.99},
    {mes:'Febrero',   v25:96000, v26:184852,dif:88852, pct:92.6, t25:455,t26:732,tp25:210.99,tp26:252.53},
    {mes:'Marzo',     v25:99000, v26:162337,dif:63337, pct:64.0, t25:470,t26:647,tp25:210.64,tp26:250.91},
    {mes:'Abril',     v25:101000,v26:159917,dif:58917, pct:58.3, t25:430,t26:477,tp25:234.88,tp26:335.25},
    {mes:'Mayo',      v25:104000,v26:183896,dif:79896, pct:76.8, t25:498,t26:702,tp25:208.84,tp26:261.96},
    {mes:'Junio',     v25:79000, v26:129807,dif:50807, pct:64.3, t25:392,t26:518,tp25:201.53,tp26:250.59},
    {mes:'Julio',     v25:72000, v26:118663,dif:46663, pct:64.8, t25:366,t26:508,tp25:196.72,tp26:233.59},
    {mes:'Agosto',    v25:83000, v26:137739,dif:54739, pct:65.9, t25:401,t26:546,tp25:207.11,tp26:252.27},
    {mes:'Septiembre',v25:24105, v26:87558, dif:null,  pct:null, t25:120,t26:285,tp25:200.88,tp26:307.22,parcial:true},
    {mes:'Octubre',   v25:91000, v26:null,  dif:null,  pct:null, t25:430,t26:null,tp25:211.63,tp26:0},
    {mes:'Noviembre', v25:112000,v26:null,  dif:null,  pct:null, t25:520,t26:null,tp25:215.38,tp26:0},
    {mes:'Diciembre', v25:134000,v26:null,  dif:null,  pct:null, t25:600,t26:null,tp25:223.33,tp26:0}
  ],
  total:{ meses:8, v25:722000, v26:1220488, dif:498488, pct:69.0,
          t25:3422, t26:4727, tp25:210.99, tp26:258.20 }
};

var MOCK_RAA = { semana: 'S38', tarjetas: [
  { ind:'food', nombre:'Food cost (móvil 4)', valor:42.9, zona:'rojo',
    resultado:'Food cost móvil 4 de la S38 en 42.9% contra una meta de 28.0%. Semana cruda 37.7% (Q6,612 de compra sobre Q17,545 de venta sin servicio).',
    costo:11358, costo_txt:'Cada punto sobre la meta son Q762 al mes.', analisis:'', accion:'', responsable:'' },
  { ind:'prime', nombre:'Prime cost (móvil 4)', valor:60.1, zona:'amarillo',
    resultado:'Prime cost móvil 4 de la S38 en 60.1%. Verde bajo 60%, rojo sobre 65%. Mano de obra de la semana 26.6%.',
    costo:84, costo_txt:'Medido contra el 60% que separa el verde del amarillo.', analisis:'', accion:'', responsable:'' },
  { ind:'caja', nombre:'Caja', valor:4.8, zona:'rojo',
    resultado:'Caja al cierre de la S38: Q24,011, o sea 4.8 días de gasto a Q5,034 por día.',
    costo:81550, costo_txt:'No es un costo: es lo que falta para el colchón de 21 días.', analisis:'', accion:'', responsable:'' },
  { ind:'ventas', nombre:'Ventas contra la semana anterior', valor:-30.1, zona:'rojo',
    resultado:'Ventas de la S38: Q19,309, -30.1% contra la semana anterior. 82 comensales, ticket Q235.',
    costo:25254, costo_txt:'La caída de la semana, llevada a un mes.', analisis:'', accion:'', responsable:'' }
], equipo:['Juanma','Jeffry','Fernanda'], historial:[] };

/* El reparto fijo/extra de cada mes: numeros REALES leidos de la hoja
   "Planilla 2026" (columna Puesto = "Extra"). Es lo unico de este archivo que
   no es inventado. */
var MOCK_PLANILLA = {
  Ene:{fija:21950,extra:6900,n_extra:2,c:0,   b:6900, s:0},
  Feb:{fija:23200,extra:5675,n_extra:3,c:1925,b:3750, s:0},
  Mar:{fija:22800,extra:4800,n_extra:3,c:1000,b:3800, s:0},
  Abr:{fija:22800,extra:4300,n_extra:4,c:2800,b:1500, s:0},
  May:{fija:23900,extra:8025,n_extra:5,c:2825,b:5200, s:0},
  Jun:{fija:22800,extra:7100,n_extra:5,c:1100,b:6000, s:0},
  Jul:{fija:21950,extra:7060,n_extra:5,c:660, b:6400, s:0},
  Ago:{fija:23700,extra:7750,n_extra:6,c:2150,b:5600, s:0},
  Sep:{fija:20250,extra:2100,n_extra:5,c:500, b:1600, s:0, fin:3000}
};
MOCK_FIN.meses.forEach(function (m) {
  var P = MOCK_PLANILLA[m.mes];
  m.planilla = P ? { fija:P.fija, extra:P.extra, n_extra:P.n_extra, cuadra:true,
                     extra_cocina:P.c, extra_barra:P.b, extra_sin_area:P.s, finiquito:P.fin||0,
                     origen: m.labor_origen === 'estimada' ? 'estimada' : 'planilla',
                     desde: m.m } : null;
});

/* La compra de mercaderia por area y las secciones del DRE, por semana. Son
   INVENTADAS: reparten la mercaderia de cada semana 72/28 entre cocina y barra
   (el mix del año) y siembran unos bloques con ruido para poder ver la vista. */
var MOCK_BLOQ = ['Nomina y salarios','Inmueble y ocupacion','Comisiones y cargos',
  'Tarifas y servicios','Mantencion','Marketing','Bienes de uso','Prestadores y honorarios'];
MOCK_FIN.semanas.forEach(function (s, i) {
  s.ventas_ss = Math.round(s.ventas * 0.8929);
  if (!s.cogs) s.cogs = Math.round(s.ventas_ss * s.cogsp / 100);
  s.cocina = Math.round(s.cogs * 0.72);
  s.barra  = s.cogs - s.cocina;
  s.bloques = {};
  MOCK_BLOQ.forEach(function (b, j) {
    var base = [6200, 4300, 1950, 1350, 1150, 1180, 1600, 1430][j];
    var f = 1 + Math.sin((i * 7 + j * 3)) * 0.35;      // ruido estable, sin azar
    s.bloques[b] = Math.round(base * f);
  });
});
// La ultima semana con Mantencion disparada, para ver la fila marcada.
MOCK_FIN.semanas[MOCK_FIN.semanas.length - 1].bloques['Mantencion'] = 4200;
MOCK_FIN.meses.forEach(function (m) {
  m.bloques = {};
  MOCK_BLOQ.forEach(function (b, j) { m.bloques[b] = [27000,18800,8500,5900,5000,5100,7000,6200][j]; });
});

/* El techo por area del mes en curso, con la forma que devuelve getMetasData. */
MOCK_METAS.techo = {
  cocina: { area:'cocina', mix:77.9, meta:28, venta_semana:20560, venta_mes:89530,
            semana:5757, mes:25068, gastado_mes:21400, saldo_mes:3668, consumo_pct:23.9,
            familias:[{k:'SIN_FACTURA',nombre:'Compra sin factura',anio:186400,pct:47.9,semana:2758}],
            sin_clasificar:4.2 },
  barra:  { area:'barra', mix:22.1, meta:20, venta_semana:5833, venta_mes:25400,
            semana:1167, mes:5080, gastado_mes:5390, saldo_mes:-310, consumo_pct:21.2,
            familias:[{k:'SIN_FACTURA',nombre:'Compra sin factura',anio:21300,pct:33.6,semana:392}],
            sin_clasificar:6.1 }
};

/* La pestaña PRESUPUESTO, como la devolveria _finPresupuesto_(). Cambiar
   existe:false para ver como se comporta la pantalla sin presupuesto. */
MOCK_FIN.presupuesto = {
  existe: true, desconocidas: [], sin_tipo: [], error: '',
  secciones: {
    'Inmueble y ocupacion':     { tipo:'fijo',   valor:20212.5, meses:{} },
    'Nomina y salarios':        { tipo:'fijo',   valor:29000,   meses:{} },
    'Tarifas y servicios':      { tipo:'fijo',   valor:6600,    meses:{} },
    'Prestadores y honorarios': { tipo:'fijo',   valor:5500,    meses:{} },
    'Marketing':                { tipo:'fijo',   valor:5700,    meses:{11:9000,12:9000} },
    'Propinas al equipo':       { tipo:'%venta', valor:4.24,    meses:{} },
    'Comisiones y cargos':      { tipo:'%venta', valor:6.5,     meses:{} },
    'Uniformes':                { tipo:'anual',  valor:3700,    meses:{} },
    'Bienes de uso':            { tipo:'anual',  valor:70000,   meses:{} },
    'Mantencion':               { tipo:'anual',  valor:60000,   meses:{} },
    'Impuestos':                { tipo:'anual',  valor:107000,  meses:{} }
  }
};
