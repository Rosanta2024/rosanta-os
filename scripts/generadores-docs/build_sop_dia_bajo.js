const {Document,Packer,Paragraph,TextRun,ShadingType,Table,TableRow,TableCell,WidthType,BorderStyle}=require('docx');
const fs=require('fs');
const VERDE="4A6741",COBRE="C9923F",MARRON="3D2B1F",TIERRA="A0785A";
const H=(t)=>new Paragraph({spacing:{before:220,after:70},children:[new TextRun({text:t,bold:true,size:25,color:VERDE,font:"Arial"})]});
const P=(t,o={})=>new Paragraph({spacing:{after:60},...o,children:[new TextRun({text:t,size:20,font:"Arial",color:MARRON})]});
const S=(n,t)=>new Paragraph({spacing:{after:50},indent:{left:340,hanging:250},children:[new TextRun({text:n+". ",bold:true,size:20,color:VERDE,font:"Arial"}),new TextRun({text:t,size:20,font:"Arial",color:MARRON})]});
function box(title,lines){
 const kids=[];
 if(title) kids.push(new Paragraph({spacing:{after:40},children:[new TextRun({text:title,bold:true,size:20,color:VERDE,font:"Arial"})]}));
 lines.forEach(l=>kids.push(new Paragraph({spacing:{after:30},children:[new TextRun({text:l,size:19,font:"Arial",color:"5a4a38"})]})));
 return new Table({width:{size:10080,type:WidthType.DXA},columnWidths:[10080],
  borders:{top:{style:BorderStyle.SINGLE,size:2,color:"E2D8C4"},bottom:{style:BorderStyle.SINGLE,size:2,color:"E2D8C4"},left:{style:BorderStyle.SINGLE,size:12,color:COBRE},right:{style:BorderStyle.SINGLE,size:2,color:"E2D8C4"}},
  rows:[new TableRow({children:[new TableCell({shading:{type:ShadingType.CLEAR,fill:"F7F1E4",color:"auto"},margins:{top:90,bottom:90,left:140,right:140},children:kids})]})]});
}
const doc=new Document({sections:[{
 properties:{page:{size:{width:12240,height:15840},margin:{top:900,bottom:900,left:1000,right:1000}}},
 children:[
  new Paragraph({spacing:{after:30},children:[new TextRun({text:"ROSANTA · Procedimiento Modo Día Bajo (Barra + M1)",bold:true,size:32,color:VERDE,font:"Arial"})]}),
  new Paragraph({spacing:{after:120},children:[new TextRun({text:"Un coctelero que además dirige el turno · lunes y martes (2 personas) · Cocina con Carisma · v1",italics:true,size:19,color:TIERRA,font:"Arial"})]}),

  P("Alcance: días bajos de 2 personas (lunes y martes): el coctelero —que atiende la barra Y es el M1/supervisor de turno— y 1 mesero. Este Procedimiento fusiona los dos roles y da la regla de prioridad para cuando chocan. El miércoles el equipo es de 3 personas, así que ese día se opera con los Procedimientos normales de Barra y de Sala, no con este modo. El detalle de cada tarea está en el Procedimiento de Barra y el Procedimiento del M1 de Sala.",{spacing:{after:100}}),

  box("Regla de oro",[
   "Eres barra + M1 a la vez. Cuando los roles choquen, este es el orden: 1) el cliente y la experiencia en el piso, 2) el ticket de barra en curso, 3) la gestión (supervisar y cerrar).",
   "El mesero cubre recepción y piso; tú apoyas desde la barra sin abandonar el pase.",
   "Al cierre reportas tu turno a Juanma o José con los datos del POS.",
  ]),

  H("1 · Apertura (fusionada)"),
  S(1,"Revisar reservas y notas del día en WIX; dimensionar la prep y avisar al mesero qué esperar."),
  S(2,"Repartir la apertura: tú la barra (Procedimiento de Barra §1), el mesero la sala (Procedimiento de Sala §1)."),
  S(3,"Montar la barra: equipo listo y anotar faltantes (el pedido se hace según el inventario semanal)."),
  S(4,"Prep mínimo según reservas: batching de alta rotación, garnishes y hielo."),
  S(5,"Huddle exprés de 2 min con el mesero: feature del día y maridaje."),
  S(6,"Si es día de pedido, consolida la requisición y ordena a proveedores (barra, limpieza y complementarios)."),

  H("2 · Durante el servicio (regla de prioridad)"),
  S(1,"Prioridad siempre: cliente/piso  >  ticket de barra en curso  >  gestión."),
  S(2,"El mesero recibe y atiende; si está ocupado y llega gente, sales de la barra a recibir tú."),
  S(3,"Prepara los cocteles por ticket, cuidando tiempos y el maridaje con cocina."),
  S(4,"Mantén un ojo en el piso desde la barra: tiempos, mesas que necesitan algo y calidad de salida."),
  S(5,"Impulsa el upsell (segundo coctel, entrantes) desde la barra y a través del mesero."),
  S(6,"Quejas → las manejas tú con el protocolo CERA (eres el supervisor); registra cortesías en el POS."),
  S(7,"Si algo te rebasa (grupo grande imprevisto, incidente), llama a José o Juanma."),

  H("3 · Cierre"),
  S(1,"Cierra la barra (Procedimiento de Barra §6): guardar prep, limpieza, cuadre de existencias y mermas."),
  S(2,"Verifica el side work y la limpieza del mesero (sala)."),
  S(3,"Cuadre del turno: ventas, propinas y cortesías."),
  S(4,"Cierre de caja: cerrar el POS, conciliar contra bancos y contra el sistema de facturación (Posfile)."),
  S(5,"El reporte de cierre lo genera el sistema (POS/Posfile); el M1 solo agrega cualquier incidencia o nota del turno."),

  H("4 · Qué se simplifica vs. un día normal"),
  S(1,"No hay huddle formal: basta un repaso de 2 min con el mesero."),
  S(2,"Supervisión ligera: una sola persona a cargo y pocos comensales."),
  S(3,"La barra es tu estación base; solo la dejas por el cliente o por una queja."),

  new Paragraph({spacing:{before:180},children:[new TextRun({text:"En día bajo el sistema no se apaga, solo se aligera: mismas reglas de servicio, con una sola persona dirigiendo el turno.",italics:true,size:18,color:"6B5A45",font:"Arial"})]}),
 ]
}]});
Packer.toBuffer(doc).then(b=>{fs.writeFileSync("/sessions/clever-hopeful-pascal/mnt/outputs/Rosanta_Procedimiento_Modo_Dia_Bajo.docx",b);console.log("guardado");});
