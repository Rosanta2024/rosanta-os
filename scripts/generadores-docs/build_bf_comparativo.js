const {Document,Packer,Paragraph,TextRun,ShadingType,Table,TableRow,TableCell,WidthType,BorderStyle,AlignmentType}=require('docx');
const fs=require('fs');
const VERDE="4A6741",COBRE="C9923F",MARRON="3D2B1F",TIERRA="A0785A";
const H=(t)=>new Paragraph({spacing:{before:240,after:70},children:[new TextRun({text:t,bold:true,size:24,color:VERDE,font:"Arial"})]});
const P=(t,o={})=>new Paragraph({spacing:{after:60},...o,children:[new TextRun({text:t,size:20,font:"Arial",color:MARRON})]});
const LBL=(lbl,t,color)=>new Paragraph({spacing:{after:40},children:[new TextRun({text:lbl+" ",bold:true,size:20,color:color||TIERRA,font:"Arial"}),new TextRun({text:t,size:20,font:"Arial",color:MARRON})]});
const bd={top:{style:BorderStyle.SINGLE,size:2,color:"D8CDB5"},bottom:{style:BorderStyle.SINGLE,size:2,color:"D8CDB5"},left:{style:BorderStyle.SINGLE,size:2,color:"D8CDB5"},right:{style:BorderStyle.SINGLE,size:2,color:"D8CDB5"},insideHorizontal:{style:BorderStyle.SINGLE,size:2,color:"D8CDB5"},insideVertical:{style:BorderStyle.SINGLE,size:2,color:"D8CDB5"}};
function cell(txt,{w,bold,fill,color,size}={}){return new TableCell({width:{size:w,type:WidthType.DXA},shading:fill?{type:ShadingType.CLEAR,fill:fill,color:"auto"}:undefined,margins:{top:50,bottom:50,left:90,right:90},children:[new Paragraph({children:[new TextRun({text:txt,bold:!!bold,size:size||18,color:color||MARRON,font:"Arial"})]})]});}
function tbl(headers,rows,widths){
 const hr=new TableRow({tableHeader:true,children:headers.map((h,i)=>cell(h,{w:widths[i],bold:true,fill:TIERRA,color:"FFFFFF"}))});
 const trs=rows.map(r=>new TableRow({children:r.map((c,i)=>cell(String(c),{w:widths[i]}))}));
 return new Table({width:{size:10080,type:WidthType.DXA},columnWidths:widths,borders:bd,rows:[hr,...trs]});
}
const doc=new Document({sections:[{
 properties:{page:{size:{width:12240,height:15840},margin:{top:900,bottom:900,left:1000,right:1000}}},
 children:[
  new Paragraph({spacing:{after:30},children:[new TextRun({text:"ROSANTA OS · Business Fundamentals (Curso 1)",bold:true,size:30,color:VERDE,font:"Arial"})]}),
  new Paragraph({spacing:{after:120},children:[new TextRun({text:"Comparativo: metodología del Scaling Engine vs. realidad de Rosanta · agosto 2026",italics:true,size:19,color:TIERRA,font:"Arial"})]}),
  P("Este documento cruza los 9 entregables del Curso 1 con el estado real de Rosanta hoy. Los puntajes son una propuesta basada en evidencia, para que los valides y ajustes. La regla del curso: se puntúa lo que EXISTE hoy operando, no lo que se planea construir.",{spacing:{after:120}}),

  H("Resumen: Six-Pillar Audit (propuesto)"),
  P("Puntaje 1-10 por pilar, según lo que hoy funciona en la operación."),
  tbl(["Pilar","Puntaje","Evidencia"],[
   ["1 · Business Fundamentals","6","Identidad de dueño en transición; metas ya en el Tablero; falta hub formal y lectura semanal del P&L."],
   ["2 · Management OS","6","Sistema construido (organigrama, escalera, procedimientos, M1), recién por implementar y validar con el equipo."],
   ["3 · Finance & Data","4","Maestro validado a abril 2026, pero sin KPIs semanales ni prime cost en vivo. Datos no accionables al instante."],
   ["4 · Profit","4","Recetario avanzado (CMV de varios platos) pero incompleto; sin matriz de rentabilidad, waste log ni SPLH."],
   ["5 · Marketing","7","Pauta activa (Meta/Google), CRM (GHL), contenido y marca fuertes. Falta CAC y dashboard formal."],
   ["6 · Expansion","2","Una unidad; sin test de readiness. Correcto: es el último pilar."],
   ["TOTAL","29","Pilares más débiles: Finanzas y Profit (4). Ahí está el foco tras Management OS."],
  ],[2600,1100,6380]),
  P("Lectura: el orden de la metodología calza con Rosanta. Con Fundamentos y Management ya montados, el siguiente pilar natural es Finance & Data OS (Curso 3), que además le da 'resultado de fuente independiente' al scorecard.",{spacing:{before:80}}),

  H("Los 9 entregables · Curso vs. Rosanta"),

  P("1 · Nivel de dueño",{spacing:{before:60}}),
  LBL("El curso pide:","evolucionar de Operador (Nivel 1) a Dueño (Nivel 3), que corre el sistema, no el restaurante."),
  LBL("Rosanta hoy:","Juanma es dueño-chef en transición (Nivel 1→2). Ya construye sistemas y trabaja desde datos primarios, pero aún es pieza clave de la operación."),
  LBL("Brecha → acción:","seguir soltando tareas operativas conforme se activan los procedimientos; el objetivo del año es Nivel 2 sólido.",COBRE),

  P("2 · Six-Pillar Audit",{spacing:{before:100}}),
  LBL("El curso pide:","calificar los 6 pilares 1-10 y atacar el más bajo primero."),
  LBL("Rosanta hoy:","hecho arriba. Total 29/60; más débiles Finanzas y Profit (4)."),
  LBL("Brecha → acción:","validar los puntajes y confirmar Finance & Data OS como próximo pilar.",COBRE),

  P("3 · Operations Hub",{spacing:{before:100}}),
  LBL("El curso pide:","un solo lugar (Drive/Notion) con 6 secciones, una por curso, y una base de logins y herramientas."),
  LBL("Rosanta hoy:","todo vive en Google Drive y en este proyecto, pero sin la estructura formal de 6 secciones. La base de logins ya la dejamos lista (archivo 1.3)."),
  LBL("Brecha → acción:","crear en Drive las 6 carpetas (una por OS) y mover cada entregable a la suya; compartir con José/Jeffry.",COBRE),

  P("4 · Trampa de identidad",{spacing:{before:100}}),
  LBL("El curso pide:","identificar la trampa (Técnico, Héroe o Perfeccionista) y una Stop Doing List de 5 tareas a delegar en 14 días."),
  LBL("Rosanta hoy:","perfil probable = Técnico (dueño-chef), con algo de Héroe en crisis. A validar."),
  LBL("Brecha → acción:","escribir la Stop Doing List: 5 tareas que Juanma suelta ya (p. ej. pedidos, cierre, parte del servicio) hacia José/Jeffry.",COBRE),

  P("5 · Auditoría de niveles de gerencia",{spacing:{before:100}}),
  LBL("El curso pide:","clasificar a cada mando en Nivel 1-4 con evidencia y objetivo de desarrollo."),
  LBL("Rosanta hoy:","hecho en el archivo 1.5 — José N2, Jeffry N2, Efraín N3, Marvin N3 (con potencial)."),
  tbl(["Persona","Puesto","Nivel","Objetivo"],[
   ["José","Jefe de Sala / M1","2","Cerrar el turno leyendo números → Nivel 1"],
   ["Jeffry","Jefe de Cocina / M1","2","Gestionar food cost con datos → Nivel 1"],
   ["Efraín","2º de Sala","3","Reportar resultados, no tareas → Nivel 2"],
   ["Marvin","Mixólogo / día bajo","3","Correr el Modo Día Bajo completo → Nivel 2"],
  ],[1500,3000,900,4680]),

  P("6 · Mapa de 5 elementos (Meta·Quién·Resultado·Análisis·Acción)",{spacing:{before:100}}),
  LBL("El curso pide:","tomar las 3 metas principales y verificar que cada una tenga los 5 elementos."),
  LBL("Rosanta hoy:","Meta y Quién ya están en el Tablero de Metas. Resultado ya puede venir de fuente independiente (POS/WIX). Análisis y Acción se aplican con RAA."),
  LBL("Brecha → acción:","escribir el mapa de las 3 metas top (ocupación entre semana, margen/prime cost, reseñas) con los 5 elementos completos.",COBRE),

  P("7 · Owner Dependency Score",{spacing:{before:100}}),
  LBL("El curso pide:","calificar 5 dimensiones 1-10 para estimar el valor transferible del negocio."),
  tbl(["Dimensión","Puntaje","Nota"],[
   ["Independencia operativa","4","Días bajos corren con 2 personas; finde y decisiones aún dependen de Juanma."],
   ["Sistemas documentados","6","Procedimientos de sala/barra/M1 listos; recetario en progreso; falta cocina."],
   ["Liderazgo entrenado","5","M1 definido (José/Jeffry), pendiente de validar y entrenar."],
   ["Transparencia financiera","5","Maestro sólido a abril; separación personal/negocio desde mayo; falta P&L a 10 días."],
   ["Marca transferible","7","Guía de marca, voz e identidad fuertes; experiencia consistente."],
   ["TOTAL","27","'Negocio con potencial de activo' (2-3.5x utilidad). Mayor dependencia: independencia operativa."],
  ],[3000,1100,5980]),

  P("8 · Los 5 números del P&L",{spacing:{before:100}}),
  LBL("El curso pide:","extraer Ventas, CMV, Mano de obra, Prime Cost y Utilidad neta de los últimos 3 meses, en % de ventas."),
  LBL("Rosanta hoy:","el Maestro v2 tiene la data (validada a abril 2026), pero no se leen estos 5 números por semana ni el prime cost en vivo. CMV objetivo = 30%."),
  LBL("Brecha → acción:","llenar el archivo 1.8 con los últimos 3 meses del Maestro. Este es literalmente el arranque del Finance & Data OS.",COBRE),
  tbl(["Número","Benchmark","Rosanta"],[
   ["Ventas","—","Extraer del Maestro"],
   ["CMV (COGS)","28-32%","Objetivo interno 30%; pendiente el % global real"],
   ["Mano de obra","25-30%","Pendiente de extraer"],
   ["Prime Cost","< 60%","Pendiente — el número clave a vigilar"],
   ["Utilidad neta","10-15%","Pendiente de extraer"],
  ],[2400,1800,5880]),

  P("9 · Auditoría del stack tecnológico",{spacing:{before:100}}),
  LBL("El curso pide:","calificar cada herramienta en calidad de datos (1-5) e integración, e identificar el gap #1."),
  LBL("Rosanta hoy:","registrado en el archivo 1.3. Fuertes: GHL, Meta Ads. Débiles: costeo/inventario en Excel (2), y no existe herramienta de programación/SPLH (1)."),
  LBL("Gap #1 → acción:","no hay inventario que ligue a costeo (teórico vs. real) ni control de labor por hora-hombre. Eso bloquea el Profit OS. El bookkeeping sin P&L semanal bloquea el Finance OS.",COBRE),

  H("Priority Statement (propuesta)"),
  P("El pilar más débil de Rosanta es Finanzas y Datos (y Profit): el negocio produce datos pero todavía no los convierte en decisiones semanales — prime cost, KPIs, inventario teórico vs. real. Con Fundamentos y Management ya montados, el foco es instalar el Finance & Data OS: cierre mensual al día, los 5 números del P&L leídos por semana y un dashboard simple. Eso le da al scorecard y a las metas un resultado de fuente independiente, y prepara el terreno para el Profit OS.",{spacing:{after:80}}),
  new Paragraph({spacing:{before:120},children:[new TextRun({text:"Archivos que acompañan este comparativo: Rosanta_1.3_Logins_y_Herramientas · Rosanta_1.5_Auditoria_Niveles_Gerencia · Rosanta_1.8_Extraccion_5_Numeros_PL.",italics:true,size:17,color:"6B5A45",font:"Arial"})]}),
 ]
}]});
Packer.toBuffer(doc).then(b=>{fs.writeFileSync("/sessions/clever-hopeful-pascal/mnt/outputs/Rosanta_BusinessFundamentals_Comparativo.docx",b);console.log("guardado");});
