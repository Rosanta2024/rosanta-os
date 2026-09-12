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
  new Paragraph({spacing:{after:30},children:[new TextRun({text:"ROSANTA · Procedimiento de Sala",bold:true,size:34,color:VERDE,font:"Arial"})]}),
  new Paragraph({spacing:{after:120},children:[new TextRun({text:"Procedimiento de servicio de sala · Cocina con Carisma · v1 (actualizado)",italics:true,size:19,color:TIERRA,font:"Arial"})]}),

  P("Alcance: servicio de sala — recepción, servicio de mesa y supervisión. Roles reales: mesero(s) y coctelero/mixólogo. No hay puesto de host: la recepción la cubren todos los que están en servicio. En días bajos, el supervisor de turno es el coctelero.",{spacing:{after:100}}),

  H("0 · Configuración del turno (según el día)"),
  box([
   "Días bajos: lunes y martes, 2 personas (coctelero supervisor de turno + barra, y 1 mesero). Miércoles, 3 personas.",
   "Fin de semana: 1 mixólogo + 2 meseros. Si las reservas muestran mucha gente: 2 mixólogos + 2 meseros.",
   "Recepción: la cubrimos todos los que estamos en servicio (no hay host dedicado).",
   "El supervisor de turno revisa reservas en WIX (rosanta.rest), asigna secciones y vigila tiempos.",
  ]),

  H("1 · Apertura de sala (antes de abrir)"),
  S(1,"Revisar reservas y notas de grupos del día en WIX (rosanta.rest)."),
  S(2,"Pulir y revisar copas, cristalería y cubiertos antes de sacarlos de la estantería. Las mesas se montan al momento en que ingresan los comensales, no antes."),
  S(3,"Surtir estaciones: cubiertos, servilletas, pan, agua."),
  S(4,"Verificar ambiente: música, iluminación, jardín/pérgola/chimenea, baños."),
  S(5,"Repasar el feature del día y su maridaje (del Huddle)."),
  S(6,"Uniforme y presentación personal."),

  H("2 · Recepción y bienvenida"),
  P("La cubren todos los que están en servicio; en días bajos, normalmente el mesero. Al acomodar a los comensales se monta su mesa.",{spacing:{after:60}}),
  S(1,"Saludar sin demora, con tono cálido: “Bienvenidos a Rosanta”."),
  S(2,"Preguntar si tienen reservación (verificar en WIX)."),
  S(3,"Acompañar a la mesa; ofrecer área: salón, pérgola o jardín."),
  S(4,"En jardín/pérgola: ofrecer manta; cojín de respaldo si aplica."),
  S(5,"Atender con prioridad a personas mayores o con capacidades diferentes."),

  H("3 · Servicio de mesa (mesero)"),
  S(1,"Presentarse y explicar la gastrococtelería (maridaje plato + coctel; con/sin alcohol; bebidas de casa, vinos y cervezas)."),
  S(2,"Presentar el menú y el feature del día; recomendar el maridaje y sugerir 1 entrante por cada 2 personas."),
  S(3,"Tomar el pedido en el POS: numerar los puestos (en contra del reloj desde la izquierda, lado cocina), confirmar modificaciones y alergias y avisar a cocina; en grupos grandes, preguntar si separan cuenta."),
  S(4,"Servir las bebidas sin demora; controlar los tiempos de entrantes y fuertes con sus maridajes."),
  S(5,"Sacar los platos a la temperatura correcta; ofrecer pan y cambiar cubiertos si aplica."),
  S(6,"Check-back tras los fuertes; monitorear bebidas, rellenar copas y retirar platos vacíos; ofrecer postres o un segundo coctel."),
  S(7,"Verificar la cuenta antes de cerrarla y entregarla correcta; preguntar por factura (FEL); pago tarjeta/efectivo, cambio de USD/EUR según el tipo de cambio del día."),
  S(8,"Agradecer, invitar a volver y resetear la mesa. Si la visita fue buena, invitar a dejar reseña con el QR."),

  H("4 · Supervisor de turno"),
  P("En días bajos es el coctelero; en fin de semana, el jefe de sala (José) o el 2º (Efraín).",{spacing:{after:60}}),
  S(1,"Revisar reservas del día (WIX) y asignar secciones."),
  S(2,"Vigilar tiempos de salida y maridajes durante el servicio."),
  S(3,"Manejar quejas con el protocolo CERA (Cálmate y escucha, Empatiza, Resuelve, Agradece)."),
  S(4,"Autorizar cortesías/descuentos según la política; que se registren en el POS."),
  S(5,"Cerrar el turno y el cuadre; el reporte de cierre lo genera el sistema (POS/Posfile)."),

  H("5 · Cierre de sala"),
  S(1,"Side work por estación: limpiar, resurtir y guardar."),
  S(2,"Ordenar el ambiente: apagar chimenea, música y luces exteriores."),
  S(3,"Cuadre de propinas."),
  S(4,"Dejar todo montado para el siguiente turno."),

  H("6 · Excepciones (qué hacer cuando algo sale mal)"),
  S(1,"Queja en mesa → protocolo CERA (Cálmate y escucha, Empatiza, Resuelve, Agradece)."),
  S(2,"Plato agotado (86) → avisar de inmediato al pase y ofrecer alternativa."),
  S(3,"Cortesía o descuento → según política; registrar SIEMPRE en el POS con motivo."),
  S(4,"Espera excedida → el supervisor se acerca, se disculpa y da un tiempo estimado. Si son 10+ min de más, ofrecer un coctel o entrada de cortesía."),

  H("7 · Protocolo CERA — manejo de quejas"),
  P("Una queja no es un ataque: es una oportunidad de recuperar al cliente. Un cliente al que le resuelves bien un problema vuelve MÁS leal. Sigue siempre estos 4 pasos, en orden. Recuérdalo como CERA: hay que dar la cara.",{spacing:{after:80}}),
  SUB("C · Cálmate y escucha"),
  P("Respira, no te pongas a la defensiva. Escucha completo, sin interrumpir; míralo a los ojos y deja que termine.  Ejemplo: “Cuénteme qué pasó, le escucho.”"),
  SUB("E · Empatiza"),
  P("Valida lo que sintió, sin excusas y sin culpar a nadie (ni a la cocina, ni a un compañero, ni al cliente).  Ejemplo: “Tiene toda la razón, lamento que su experiencia no fuera la que esperaba.”"),
  SUB("R · Resuelve"),
  P("Ofrece una solución concreta y rápida: rehacer el plato, cambiarlo, un descuento o una cortesía. Si es algo mayor o pasa del monto permitido, llama al supervisor de turno.  Ejemplo: “Permítame corregirlo ahora mismo: se lo preparamos de nuevo enseguida.”"),
  SUB("A · Agradece"),
  P("Agradece que te lo dijo: te dio la oportunidad de mejorar. Despídelo con la misma calidez de la bienvenida.  Ejemplo: “Gracias por decírnoslo, nos ayuda a ser mejores. Le esperamos de vuelta.”"),
  SUB("Reglas de oro"),
  S("•","Nunca discutas ni culpes al cliente, a la cocina o a un compañero."),
  S("•","Nunca prometas algo que no puedas cumplir."),
  S("•","Toda cortesía o descuento se registra SIEMPRE en el POS con el motivo."),
  S("•","Si dudas o el caso es grande, llama al supervisor de turno."),
  P("Lo que NO se hace: interrumpir, poner excusas, minimizar (“no es para tanto”) ni tardar en responder.",{spacing:{before:60}}),

  new Paragraph({spacing:{before:180},children:[new TextRun({text:"De este Procedimiento salen las listas de tareas del mesero: apertura, servicio y cierre, más lo puntual que asigne el supervisor.",italics:true,size:18,color:"6B5A45",font:"Arial"})]}),
 ]
}]});
Packer.toBuffer(doc).then(b=>{fs.writeFileSync("/sessions/clever-hopeful-pascal/mnt/outputs/Rosanta_Procedimiento_Sala.docx",b);console.log("guardado");});
