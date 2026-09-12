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
  new Paragraph({spacing:{after:30},children:[new TextRun({text:"ROSANTA · Procedimiento de Barra (Mixólogo)",bold:true,size:34,color:VERDE,font:"Arial"})]}),
  new Paragraph({spacing:{after:120},children:[new TextRun({text:"Procedimiento de barra · Cocina con Carisma · v1",italics:true,size:19,color:TIERRA,font:"Arial"})]}),

  P("Alcance: barra / gastrococtelería — pedidos de insumos, preparaciones (mise en place y batching), servicio en barra, y limpieza y mantenimiento de la estación. Rol: mixólogo / coctelero. En días bajos el coctelero es además el supervisor de turno (ver Procedimiento de Sala §4 y el protocolo CERA §7).",{spacing:{after:100}}),

  H("0 · Configuración del turno (según el día)"),
  box([
   "Días bajos (lun–mié): 1 coctelero = barra + supervisor de turno. Sus tareas de supervisión están en el Procedimiento de Sala §4.",
   "Fin de semana: 1 mixólogo. Si las reservas muestran mucha gente: 2 mixólogos.",
   "Antes de arrancar, revisa reservas y eventos del día en WIX (rosanta.rest) para dimensionar pedidos y preparaciones.",
  ]),

  H("1 · Apertura de barra (antes de abrir)"),
  S(1,"Revisar reservas y eventos del día (WIX) para estimar el volumen del turno."),
  S(2,"Encender y verificar el equipo: refrigeración, hielo, licuadora, cristalería limpia."),
  S(3,"Revisar niveles de licores, mixers, jugos, garnishes y hielo; reponer de bodega lo que falte para el servicio."),
  S(4,"Reponer desde bodega lo que falte; anotar los faltantes para el pedido del día."),
  S(5,"Montar la estación: jiggers, coladores, cucharas, tabla, cuchillo, trapos y basurero."),
  S(6,"Repasar el coctel/feature del día y su maridaje (del Huddle)."),
  S(7,"Higiene y uniforme: manos, delantal y presentación personal."),

  H("2 · Pedidos e insumos"),
  P("El coctelero revisa la barra y arma la requisición; el pedido a proveedores lo hace el M1.",{spacing:{after:60}}),
  S(1,"Levantar el inventario semanal de la barra (conteo de licores, mixers, jugos, garnishes y hielo)."),
  S(2,"Con base en ese inventario semanal, definir los productos a solicitar para la semana."),
  S(3,"Priorizar por rotación y por los eventos/reservas próximos."),
  S(4,"Pasar la requisición al M1, que consolida y hace el pedido a proveedores."),
  S(5,"Al recibir: verificar cantidad, calidad y fechas; reportar faltantes o mermas."),
  S(6,"Guardar con rotación PEPS (primero en entrar, primero en salir); etiquetar y fechar."),
  S(7,"Registrar mermas y roturas, y avisar al supervisor/dueño."),

  H("3 · Preparaciones (mise en place / batching)"),
  S(1,"Preparar según la demanda estimada (reservas + histórico del día)."),
  S(2,"Batching de los cocteles de alta rotación; etiquetar con nombre y fecha."),
  S(3,"Cortar y preparar garnishes; preparar jarabes, infusiones y jugos frescos."),
  S(4,"Preparar el hielo en los formatos que pida cada coctel."),
  S(5,"Cumplir la receta estándar: medidas exactas con jigger, nunca “a ojo”."),
  S(6,"Guardar las preparaciones etiquetadas y fechadas; controlar la caducidad."),

  H("4 · Servicio en barra"),
  S(1,"Recibir los tickets del POS y ordenarlos por tiempo de preparación y maridaje."),
  S(2,"Preparar con la receta estándar; cuidar presentación y garnish."),
  S(3,"Coordinar tiempos con cocina: los maridajes salen con su plato."),
  S(4,"Sugerir un segundo coctel o una versión sin alcohol cuando aplique."),
  S(5,"Mantener consistencia: mismo sabor, misma medida y misma presentación siempre."),

  H("5 · Limpieza y mantenimiento de la estación"),
  S(1,"Limpiar sobre la marcha (clean as you go): superficies, herramientas y derrames."),
  S(2,"Separar zona limpia de zona sucia; lavar cristalería y utensilios al momento."),
  S(3,"Sanitizar tablas, jiggers y coladores entre usos."),
  S(4,"Vaciar y limpiar el pozo de hielo; revisar drenajes."),
  S(5,"Reponer garnishes, servilletas y mixers durante el turno."),

  H("6 · Cierre de barra"),
  S(1,"Guardar y etiquetar las preparaciones; desechar lo vencido."),
  S(2,"Limpieza profunda: barra, pozo de hielo, refrigeración y piso."),
  S(3,"Cuadre de existencias clave (licores premium) y de mermas del turno."),
  S(4,"Cuadre de propinas de barra."),
  S(5,"Dejar lista la requisición/faltantes para el día siguiente."),
  S(6,"Dejar la estación montada para el siguiente turno."),

  H("7 · Excepciones (qué hacer cuando algo sale mal)"),
  S(1,"Insumo agotado (86) → avisar de inmediato al pase y a meseros; ofrecer alternativa."),
  S(2,"Coctel devuelto → rehacerlo y aplicar el protocolo CERA; registrar el motivo en el POS."),
  S(3,"Equipo dañado → reportar de inmediato al supervisor/dueño y activar plan B."),
  S(4,"Cliente pasado de tragos → suspender el servicio de alcohol con tacto y avisar al supervisor."),

  H("8 · En días bajos: supervisor de turno"),
  P("Cuando el coctelero cubre la supervisión, además de la barra ejecuta las tareas del Procedimiento de Sala §4 (revisar reservas en WIX, asignar la sala, vigilar tiempos, autorizar cortesías/descuentos y cerrar el turno con el cuadre) y maneja las quejas con el protocolo CERA — Cálmate y escucha, Empatiza, Resuelve, Agradece (Procedimiento de Sala §7).",{spacing:{after:60}}),

  new Paragraph({spacing:{before:180},children:[new TextRun({text:"De este Procedimiento salen las listas de tareas del coctelero: apertura, requisición, preparación, servicio y cierre, más lo puntual que asigne el supervisor.",italics:true,size:18,color:"6B5A45",font:"Arial"})]}),
 ]
}]});
Packer.toBuffer(doc).then(b=>{fs.writeFileSync("/sessions/clever-hopeful-pascal/mnt/outputs/Rosanta_Procedimiento_Barra.docx",b);console.log("guardado");});
