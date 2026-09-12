const {Document,Packer,Paragraph,TextRun,AlignmentType,ShadingType,Table,TableRow,TableCell,WidthType,BorderStyle}=require('docx');
const fs=require('fs');
const VERDE="4A6741",COBRE="C9923F",MARRON="3D2B1F",TIERRA="A0785A",CREMA="F5EFE0";
const H=(t)=>new Paragraph({spacing:{before:230,after:70},children:[new TextRun({text:t,bold:true,size:25,color:VERDE,font:"Arial"})]});
const SUB=(t)=>new Paragraph({spacing:{before:120,after:40},children:[new TextRun({text:t,bold:true,size:20,color:TIERRA,font:"Arial"})]});
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
  new Paragraph({spacing:{after:30},children:[new TextRun({text:"ROSANTA · Procedimiento del M1 de Sala (Jefe de turno)",bold:true,size:32,color:VERDE,font:"Arial"})]}),
  new Paragraph({spacing:{after:120},children:[new TextRun({text:"Procedimiento de gestión · Titular: José · Cocina con Carisma · v1",italics:true,size:19,color:TIERRA,font:"Arial"})]}),

  P("Alcance: cómo el M1 dirige el turno de sala y a su equipo (meseros + coctelero). El M1 no atiende una sección fija: gestiona el piso y solo apoya cuando algo se traba. Titular: José. 2º: Efraín. En días bajos de 2 personas (lunes y martes) el M1 es el coctelero, que además atiende la barra; el miércoles el equipo es de 3 personas.",{spacing:{after:100}}),

  H("0 · Configuración del turno"),
  box([
   "Fin de semana: M1 = José (o Efraín). Equipo: 1 mixólogo + 2 meseros (2 mixólogos + 2 meseros si hay muchas reservas).",
   "Lunes y martes (2 personas): M1 = coctelero (gestiona + atiende barra) + 1 mesero.",
   "Miércoles (3 personas): coctelero + 2 meseros; el coctelero sigue como M1 del turno.",
   "Herramientas del M1: reservas en WIX (rosanta.rest), POS, las listas de tareas (Procedimiento de Sala y Procedimiento de Barra) y el protocolo CERA.",
  ]),

  H("1 · Antes del turno (planeación)"),
  S(1,"Revisar reservas, grupos y notas del día en WIX."),
  S(2,"Dimensionar el staffing según las reservas; confirmar quién entra."),
  S(3,"Asignar secciones y repartir las tareas de apertura (Procedimiento de Sala §1 / Procedimiento de Barra §1)."),
  S(4,"Verificar que la apertura se cumplió: mesas, estaciones, ambiente y barra surtida."),
  S(5,"Repasar el feature del día y su maridaje."),
  S(6,"Pedidos del M1: consolidar las requisiciones del equipo y ordenar a proveedores los insumos de barra, limpieza y complementarios; al recibir, verificar cantidad y calidad. (El coctelero solo pasa su requisición de barra — Procedimiento de Barra §2.)"),

  H("2 · Huddle pre-servicio (5 minutos)"),
  S(1,"Feature del día + maridaje y cómo venderlo."),
  S(2,"86 y faltantes de cocina y barra."),
  S(3,"Reservas, grupos grandes y horas pico."),
  S(4,"Recordatorio de estándar del turno (tiempos, presentación)."),
  S(5,"Ánimo: recordar el sello “Cocina con Carisma”."),

  H("3 · Durante el servicio (gestión en piso)"),
  S(1,"Mantener presencia física en el piso; leer las mesas, no quedarse fijo en un puesto."),
  S(2,"Vigilar tiempos: bebidas sin demora y salida de fuertes con su maridaje."),
  S(3,"Cuidar calidad y presentación antes de que el plato salga a la mesa (last look)."),
  S(4,"Apoyar donde se traba, sin quitarle la mesa al mesero."),
  S(5,"Impulsar el upsell: entrantes, un segundo coctel y postres."),
  S(6,"Manejar quejas con el protocolo CERA; autorizar cortesías/descuentos y registrarlas en el POS."),
  S(7,"Hacer check-in con clientes clave: habituales, cumpleaños y primera visita."),

  H("4 · Cierre del turno"),
  S(1,"Verificar side work y limpieza por estación (sala y barra)."),
  S(2,"Cierre de caja: cerrar el POS, conciliar contra bancos y contra el sistema de facturación (Posfile)."),
  S(3,"Cuadre: ventas del turno, propinas y cortesías/mermas."),
  S(4,"Confirmar que quedó todo montado para el siguiente turno."),
  S(5,"El reporte de cierre lo genera el sistema (POS/Posfile) con la facturación y los comensales; el M1 solo agrega las incidencias o notas del turno si las hay."),

  H("5 · Gente y desarrollo"),
  S(1,"Dar feedback corto y directo al cierre o al inicio del día siguiente."),
  S(2,"Dar seguimiento a los acuerdos de mejora del turno."),
  S(3,"Identificar a los que destacan y darles más responsabilidad; a los que fallan, apoyo o escalar."),
  S(4,"Escalar a José/dueño todo lo que exceda su autoridad."),

  H("6 · Excepciones y escalamiento"),
  S(1,"Falta de personal o no-show → reacomodar secciones; llamar refuerzo si la reserva lo exige."),
  S(2,"Queja mayor o compensación fuera de política → resolver con CERA y escalar al dueño."),
  S(3,"Problema de cocina/barra (86, retraso) → avisar a la mesa, ofrecer alternativa y ajustar tiempos."),
  S(4,"Incidente de caja/POS → registrar y reportar en el reporte de cierre."),

  H("7 · Indicadores que vigila el M1"),
  P("Rotación de mesa, ticket promedio, upsell (entrantes/coctel/postre), tiempos de servicio, ocupación (sobre todo lun–mié), quejas y reseñas. Los observa para cuidar el turno y detectar qué mejorar.",{spacing:{after:60}}),

  new Paragraph({spacing:{before:180},children:[new TextRun({text:"El M1 corre este Procedimiento en cada turno para dirigir a su equipo y mantener el estándar de Rosanta.",italics:true,size:18,color:"6B5A45",font:"Arial"})]}),
 ]
}]});
Packer.toBuffer(doc).then(b=>{fs.writeFileSync("/sessions/clever-hopeful-pascal/mnt/outputs/Rosanta_Procedimiento_M1_Sala.docx",b);console.log("guardado");});
