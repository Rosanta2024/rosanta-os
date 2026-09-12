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
  new Paragraph({spacing:{after:30},children:[new TextRun({text:"ROSANTA · Procedimiento de Cocina",bold:true,size:34,color:VERDE,font:"Arial"})]}),
  new Paragraph({spacing:{after:120},children:[new TextRun({text:"Procedimiento de línea y preparación · Cocina con Carisma · v1",italics:true,size:19,color:TIERRA,font:"Arial"})]}),

  P("Alcance: producción de cocina — apertura y mise en place, pedidos de insumos, preparaciones, servicio en la línea, inocuidad y limpieza, y cierre. Roles: jefe de cocina (Jeffry) y cocineros de línea/prep, con apoyo de lavaplatos/steward. El detalle de gestión está en el Procedimiento del M1 de Cocina.",{spacing:{after:100}}),

  H("0 · Configuración del turno (según el día)"),
  box([
   "En cada turno siempre hay 3 personas en cocina; en fin de semana se agrega un lavaplatos.",
   "Equipo: Jeffry (jefe de cocina), Nadia (2ª), Fernanda (3ª) y 2 ayudantes. Entre todos rotan los turnos, pero el turno siempre lo cubren 3.",
   "Jefe de cocina / M1: Jeffry. En su ausencia, Nadia (2ª de cocina) cubre la supervisión.",
   "Antes de arrancar, revisar reservas y eventos del día (WIX) para dimensionar la prep list.",
  ]),

  H("1 · Apertura de cocina (antes de abrir)"),
  S(1,"Revisar reservas, grupos y eventos del día (WIX) para estimar el volumen."),
  S(2,"Encender y verificar el equipo; revisar temperaturas de refrigeradores y congeladores."),
  S(3,"Revisar la prep del día anterior: cantidad, calidad y fechas (rotación PEPS)."),
  S(4,"Line check: probar y revisar cada componente de la línea antes de abrir."),
  S(5,"Montar las estaciones: utensilios, contenedores, etiquetas y basureros."),
  S(6,"Repasar los especiales del día (del Huddle)."),
  S(7,"Higiene y uniforme: manos, delantal y presentación personal."),

  H("2 · Pedidos e insumos"),
  P("El cocinero revisa la cocina y arma la requisición; el pedido a proveedores lo hace el M1 de cocina (Jeffry).",{spacing:{after:60}}),
  S(1,"Comparar existencias contra los niveles par por producto."),
  S(2,"Anotar en la requisición todo lo que esté por debajo del par."),
  S(3,"Priorizar por rotación y por los eventos/reservas próximos."),
  S(4,"Pasar la requisición al M1 de cocina, que consolida y ordena a proveedores."),
  S(5,"Al recibir: verificar cantidad, calidad, temperatura y fechas; reportar faltantes o mermas."),
  S(6,"Guardar con rotación PEPS; etiquetar y fechar todo."),

  H("3 · Preparaciones (mise en place)"),
  S(1,"Preparar según la prep list del día (reservas + histórico)."),
  S(2,"Seguir la receta estándar del recetario: cantidades y procesos exactos, sin “a ojo”."),
  S(3,"Cuidar el rendimiento (yield) y el control de porciones para sostener el CMV objetivo (30%)."),
  S(4,"Etiquetar y fechar cada preparación; guardar con PEPS y controlar la caducidad."),
  S(5,"Registrar la merma de prep en el waste log."),

  H("4 · Servicio en la línea"),
  S(1,"Trabajar los tickets del POS por orden y tiempo; coordinar con el pase."),
  S(2,"Cumplir el estándar de emplatado y porción de cada plato (foto/guía de referencia)."),
  S(3,"Controlar los tiempos de salida y coordinar los maridajes con sala y barra (salen juntos)."),
  S(4,"Comunicar de inmediato cualquier 86 (agotado) al pase, a sala y a barra."),
  S(5,"Mantener la estación limpia y ordenada durante todo el servicio (clean as you go)."),

  H("5 · Inocuidad y limpieza"),
  S(1,"Controlar temperaturas: refrigeración, congelación, cocción y mantenimiento en caliente/frío."),
  S(2,"Higiene de manos frecuente; usar tablas y utensilios separados por tipo de alimento."),
  S(3,"Manejar alérgenos con cuidado: evitar contaminación cruzada y avisar a sala cuando aplique."),
  S(4,"Sanitizar superficies, tablas y utensilios entre usos."),
  S(5,"Separar zona limpia de zona sucia; coordinar con lavaplatos el flujo de loza."),

  H("6 · Cierre de cocina"),
  S(1,"Guardar y etiquetar todas las preparaciones; desechar lo vencido."),
  S(2,"Limpieza profunda: campana, plancha/estufa, refrigeración, pisos y trampas de grasa."),
  S(3,"Apagar y asegurar el equipo; revisar temperaturas finales."),
  S(4,"Cuadre de mermas del turno (waste log)."),
  S(5,"Dejar la prep list y la requisición listas para el día siguiente."),
  S(6,"Dejar las estaciones montadas para el siguiente turno."),

  H("7 · Excepciones (qué hacer cuando algo sale mal)"),
  S(1,"Plato agotado (86) → avisar de inmediato al pase, a sala y a barra; ofrecer alternativa."),
  S(2,"Plato devuelto → rehacerlo con prioridad y avisar a sala para aplicar el protocolo CERA con el cliente; registrar el motivo."),
  S(3,"Falla de equipo → reportar al M1 de cocina de inmediato y activar plan B (otra estación/método)."),
  S(4,"Incidente de inocuidad o alérgeno → detener el plato, avisar al M1 y corregir antes de continuar."),

  H("8 · Estándares clave"),
  P("Receta estándar del recetario en cada plato · control de porciones · CMV objetivo 30% · waste log al día · temperaturas y fechas siempre registradas. Estos son los que sostienen la calidad y el food cost.",{spacing:{after:60}}),

  new Paragraph({spacing:{before:180},children:[new TextRun({text:"De este Procedimiento salen las listas de tareas de cocina: apertura, requisición, preparación, servicio, inocuidad y cierre, más lo puntual que asigne el M1 de cocina.",italics:true,size:18,color:"6B5A45",font:"Arial"})]}),
 ]
}]});
Packer.toBuffer(doc).then(b=>{fs.writeFileSync("/sessions/clever-hopeful-pascal/mnt/outputs/Rosanta_Procedimiento_Cocina.docx",b);console.log("guardado cocina");});
