const {Document,Packer,Paragraph,TextRun,HeadingLevel,Table,TableRow,TableCell,WidthType,BorderStyle,ShadingType,AlignmentType,PositionalTab,PositionalTabAlignment,PositionalTabLeader,LevelFormat}=require('docx');
const fs=require('fs');
const VERDE="4A6741",COBRE="C9923F",MARRON="3D2B1F",TIERRA="A0785A",CREMA="F5EFE0";
const H=(t)=>new Paragraph({spacing:{before:220,after:80},children:[new TextRun({text:t,bold:true,size:26,color:VERDE,font:"Arial"})]});
const P=(runs,opts={})=>new Paragraph({spacing:{after:80},...opts,children:Array.isArray(runs)?runs:[new TextRun({text:runs,size:20,font:"Arial",color:MARRON})]});
const B=(t)=>new Paragraph({numbering:{reference:"vinetas",level:0},spacing:{after:40},children:[new TextRun({text:t,size:20,font:"Arial",color:MARRON})]});
function cell(text,{bold=false,shade=null,color=MARRON,w}={}){
  return new TableCell({width:{size:w,type:WidthType.DXA},margins:{top:60,bottom:60,left:90,right:90},
    shading:shade?{type:ShadingType.CLEAR,fill:shade,color:"auto"}:undefined,
    children:[new Paragraph({children:[new TextRun({text,bold,size:18,font:"Arial",color})]})]});
}
const W=[520,2400,4300,1900]; const TW=W.reduce((a,b)=>a+b,0);
function hrow(cells){return new TableRow({tableHeader:true,children:cells.map((t,i)=>cell(t,{bold:true,color:"FFFFFF",shade:VERDE,w:W[i]}))});}
function row(cells,shade){return new TableRow({children:cells.map((t,i)=>cell(t,{w:W[i],shade}))});}

const pasos=[
 ["1","Cantidad","Compara lo asignado ayer vs. lo realmente hecho. Di: 'Revisemos su lista de ayer, ¿qué quedó completo?'. Califica Excelente/Bueno/Malo/Terrible.","Lista de tareas del especialista"],
 ["2","Calidad","Separa cantidad de calidad: pudo terminar todo pero mal. Pregunta: '¿cómo quedó hecho?'. Ejemplo: 'terminó todo, pero el mise en place quedó disparejo'.","Observación / revisión física"],
 ["3","Horas","Horas programadas vs. horas realmente productivas. Anota desfases (ej. 8 prog / 7 real).","Horario vs. reloj / observación"],
 ["4","Result. Operativos","Resultados NO financieros del turno, Plan vs. Real. Sala: rotación, ticket, upsell. Cocina: tiempo de salida, % merma.","POS · panel-reseñas · inventario"],
 ["5","Result. Financieros","Aporte financiero del turno, Plan vs. Real. CMV cocina 30% / barra 20%, ventas del turno.","POS · recetario · maestro"],
 ["6","Categoría (1-5)","Con base en 1-5, clasifica al especialista para decidir cómo manejarlo.","Tu juicio con el dato"],
 ["7","Plan de Acción","El paso clave: traduce el análisis en un plan concreto para mañana. Resultado → Análisis → Acción.","Lo defines tú y el M1"],
];

const doc=new Document({
 numbering:{config:[{reference:"vinetas",levels:[{level:0,format:LevelFormat.BULLET,text:"•",alignment:AlignmentType.LEFT,style:{run:{color:COBRE}},paragraph:{indent:{left:360,hanging:200}}}]}]},
 sections:[{
  properties:{page:{size:{width:12240,height:15840},margin:{top:900,bottom:900,left:1000,right:1000}}},
  children:[
   new Paragraph({spacing:{after:40},children:[new TextRun({text:"ROSANTA · Guion de Entrenamiento",bold:true,size:34,color:VERDE,font:"Arial"})]}),
   new Paragraph({spacing:{after:160},children:[new TextRun({text:"Scorecard de 7 Pasos — para entrenar a Jeffry (Cocina) y José (Sala) · Cocina con Carisma",italics:true,size:19,color:TIERRA,font:"Arial"})]}),

   H("1 · Objetivo y cuándo"),
   P("Enséñales a revisar, calificar y planear el desempeño de cada especialista, todos los días. Toma 30 min entrenar, y luego 5–7 min por persona al día. Es la disciplina que genera el dato del que se alimenta todo lo demás (Sync semanal, Controlador, revisión mensual)."),

   H("2 · Antes de sentarte (ten esto a mano)"),
   B("El archivo del Scorecard abierto (hojas SALA y COCINA)."),
   B("Un especialista real de ejemplo: uno de cocina para entrenar a Jeffry, uno de sala para José."),
   B("El dato del día de ese especialista (de fuente independiente: POS, reseñas, inventario)."),

   H("3 · Di esto primero — la regla de oro (RAA)"),
   P([new TextRun({text:"“Aquí no adivinamos. Primero el RESULTADO —qué pasó—, luego el ANÁLISIS —por qué—, y luego la ACCIÓN —qué haremos mañana. Ese orden no se negocia. Y el resultado nunca lo pone la persona que estamos midiendo: viene de una fuente independiente, y es 100% correcto.”",italics:true,size:20,color:MARRON,font:"Arial"})]),

   H("4 · Recorrido en vivo — los 7 pasos con el especialista de ejemplo"),
   P("Hazlo CON ellos, no para ellos. Recorran juntos un especialista real, paso por paso:"),
   new Table({width:{size:TW,type:WidthType.DXA},columnWidths:W,
     rows:[hrow(["#","Paso","Qué decir / cómo hacerlo","Dónde sacar el dato"]),
       ...pasos.map((p,i)=>row(p, i%2? "FFFFFF":CREMA))]}),

   H("5 · Las 5 categorías (paso 6, rápido)"),
   B("1 = Buenos resultados + Trabajador → jugador A. Protégelo."),
   B("2 = Buenos resultados + Flojo → talento que no da el 100%. Déjalo traer utilidad."),
   B("3 = Malos resultados + Trabajador + Aprendiendo → invierte en capacitarlo."),
   B("4 = Malos resultados + Trabajador + No mejora → déjalo ir."),
   B("5 = Malos resultados + Flojo → despide de inmediato."),

   H("6 · Cierre del entrenamiento (la asignación)"),
   P("Termina asignando: “Desde mañana, cada uno corre este scorecard con su equipo, todos los días. Yo reviso su documentación a diario las primeras dos semanas y les doy coaching. En la tercera semana, lo presentan en el Sync.”"),

   H("7 · Errores a evitar"),
   B("Saltarse pasos por estar ocupados: el sistema ahorra tiempo, no lo cuesta."),
   B("No documentar: si no está escrito, no pasó."),
   B("Fijarse solo en resultados (4-5) e ignorar el esfuerzo (1-3)."),
   B("Tolerar categorías 4 y 5: contaminan al equipo y espantan a tus jugadores A."),

   H("8 · Cronograma de instalación (4 semanas)"),
   B("Semana 1: entrena (este guion) y recorre un ejemplo en vivo con cada M1."),
   B("Semana 2: Jeffry y José lo corren solos; tú revisas a diario y coacheas."),
   B("Semana 3: presentan su categorización y planes en el Sync semanal."),
   B("Semana 4+: revisas semanal, no diario. Coacheas en categorizar y planear (pasos 6-7)."),
  ]
 }]
});
Packer.toBuffer(doc).then(b=>{fs.writeFileSync("/sessions/clever-hopeful-pascal/mnt/outputs/Rosanta_Guion_Entrenamiento_Scorecard.docx",b);console.log("guardado");});
