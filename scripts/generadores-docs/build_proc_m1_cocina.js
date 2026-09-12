const {Document,Packer,Paragraph,TextRun,ShadingType,Table,TableRow,TableCell,WidthType,BorderStyle}=require('docx');
const fs=require('fs');
const VERDE="4A6741",COBRE="C9923F",MARRON="3D2B1F",TIERRA="A0785A";
const H=(t)=>new Paragraph({spacing:{before:230,after:70},children:[new TextRun({text:t,bold:true,size:25,color:VERDE,font:"Arial"})]});
const P=(t,o={})=>new Paragraph({spacing:{after:60},...o,children:[new TextRun({text:t,size:20,font:"Arial",color:MARRON})]});
const S=(n,t)=>new Paragraph({spacing:{after:50},indent:{left:340,hanging:250},children:[new TextRun({text:n+". ",bold:true,size:20,color:VERDE,font:"Arial"}),new TextRun({text:t,size:20,font:"Arial",color:MARRON})]});
function box(lines){
 return new Table({width:{size:10080,type:WidthType.DXA},columnWidths:[10080],
  borders:{top:{style:BorderStyle.SINGLE,size:2,color:"E2D8C4"},bottom:{style:BorderStyle.SINGLE,size:2,color:"E2D8C4"},left:{style:BorderStyle.SINGLE,size:12,color:COBRE},right:{style:BorderStyle.SINGLE,size:2,color:"E2D8C4"}},
  rows:[new TableRow({children:[new TableCell({shading:{type:ShadingType.CLEAR,fill:"F7F1E4",color:"auto"},margins:{top:80,bottom:80,left:140,right:140},
   children:lines.map(l=>new Paragraph({spacing:{after:30},children:[new TextRun({text:l,size:19,font:"Arial",color:"5a4a38"})]}))})]})]});
}
const doc=new Document({sections:[{
 properties:{page:{size:{width:12240,height:15840},margin:{top:900,bottom:900,left:1000,right:1000}}},
 children:[
  new Paragraph({spacing:{after:30},children:[new TextRun({text:"ROSANTA · Procedimiento del M1 de Cocina (Jefe de cocina)",bold:true,size:30,color:VERDE,font:"Arial"})]}),
  new Paragraph({spacing:{after:120},children:[new TextRun({text:"Procedimiento de gestión · Titular: Jeffry · Cocina con Carisma · v1",italics:true,size:19,color:TIERRA,font:"Arial"})]}),

  P("Alcance: cómo el M1 de cocina dirige la producción y a su equipo (cocineros de línea/prep y lavaplatos). El M1 no cocina una estación fija: gestiona el pase, la calidad y el food cost, y solo apoya cuando algo se traba. Titular: Jeffry. En su ausencia, Nadia (2ª de cocina) cubre la supervisión.",{spacing:{after:100}}),

  H("0 · Configuración del turno"),
  box([
   "En cada turno siempre hay 3 personas en cocina; en fin de semana se agrega un lavaplatos.",
   "Equipo: Jeffry (jefe), Nadia (2ª), Fernanda (3ª) y 2 ayudantes que rotan turnos.",
   "M1 de cocina = Jeffry; respaldo: Nadia (2ª de cocina).",
   "Herramientas del M1: reservas en WIX, POS, recetario/CMV, waste log y las listas de tareas (Procedimiento de Cocina).",
  ]),

  H("1 · Antes del turno (planeación)"),
  S(1,"Revisar reservas, grupos y eventos del día en WIX."),
  S(2,"Definir la prep list del día y dimensionar la producción según demanda estimada."),
  S(3,"Asignar estaciones y repartir la apertura (Procedimiento de Cocina §1)."),
  S(4,"Verificar la apertura: temperaturas, prep del día anterior (PEPS) y line check."),
  S(5,"Repasar el feature del día y su maridaje."),
  S(6,"Pedidos del M1 de cocina: consolidar las requisiciones y ordenar a proveedores de alimentos; al recibir, verificar cantidad, calidad, temperatura y fechas."),

  H("2 · Huddle pre-servicio (5 minutos)"),
  S(1,"Feature del día + cómo sale y cómo se emplata."),
  S(2,"86 y faltantes; ajustes de la carta del día."),
  S(3,"Reservas, grupos grandes y horas pico."),
  S(4,"Recordatorio de estándar del turno (porción, emplatado, tiempos, inocuidad)."),
  S(5,"Ánimo: recordar el sello “Cocina con Carisma”."),

  H("3 · Durante el servicio (gestión del pase)"),
  S(1,"Manejar el pase/expo: cantar la comanda, ordenar tiempos y coordinar con sala y barra."),
  S(2,"Last look en el pase: cada plato sale con la porción, temperatura y presentación correctas."),
  S(3,"Controlar los tiempos de salida y los maridajes (salen con su bebida)."),
  S(4,"Apoyar la estación que se traba, sin abandonar el pase."),
  S(5,"Resolver los 86 y comunicar de inmediato a sala y barra."),
  S(6,"Vigilar inocuidad y control de porciones durante todo el servicio."),

  H("4 · Cierre del turno"),
  S(1,"Verificar limpieza profunda y guardado por estación (PEPS, etiquetado y fechado)."),
  S(2,"Cuadre de mermas del turno (waste log) y notas de food cost."),
  S(3,"Confirmar temperaturas finales y equipo apagado y asegurado."),
  S(4,"Dejar la prep list y la requisición listas para el día siguiente."),
  S(5,"El reporte de cierre lo genera el sistema; el M1 de cocina solo agrega incidencias o notas del turno si las hay."),

  H("5 · Gente y desarrollo"),
  S(1,"Dar feedback corto y directo al cierre o al inicio del día siguiente."),
  S(2,"Dar seguimiento a los acuerdos de mejora del turno."),
  S(3,"Identificar a los que destacan y darles más responsabilidad; a los que fallan, apoyo o escalar."),
  S(4,"Escalar a Juanma todo lo que exceda su autoridad."),

  H("6 · Excepciones y escalamiento"),
  S(1,"Falta de personal o no-show → reacomodar estaciones; ajustar la carta del día si es necesario."),
  S(2,"Plato devuelto o queja de comida → rehacer con prioridad y coordinar con sala el protocolo CERA; registrar el motivo."),
  S(3,"Falla de equipo → activar plan B y reportar a Juanma."),
  S(4,"Incidente de inocuidad o alérgeno → detener, corregir y documentar antes de continuar."),

  H("7 · Indicadores que vigila el M1 de cocina"),
  P("Food cost / CMV (objetivo 30%), merma (waste log), tiempos de salida, platos devueltos, consistencia de porción y emplatado, y temperaturas de inocuidad. Los observa para cuidar la calidad y el food cost, y detectar qué mejorar.",{spacing:{after:60}}),

  new Paragraph({spacing:{before:180},children:[new TextRun({text:"El M1 de cocina corre este Procedimiento en cada turno para dirigir a su equipo, sostener el estándar y cuidar el food cost de Rosanta.",italics:true,size:18,color:"6B5A45",font:"Arial"})]}),
 ]
}]});
Packer.toBuffer(doc).then(b=>{fs.writeFileSync("/sessions/clever-hopeful-pascal/mnt/outputs/Rosanta_Procedimiento_M1_Cocina.docx",b);console.log("guardado m1 cocina");});
