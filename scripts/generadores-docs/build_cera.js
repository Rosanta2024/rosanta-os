const {Document,Packer,Paragraph,TextRun,ShadingType,Table,TableRow,TableCell,WidthType,BorderStyle}=require('docx');
const fs=require('fs');
const VERDE="4A6741",COBRE="C9923F",MARRON="3D2B1F",TIERRA="A0785A";
const P=(t,o={})=>new Paragraph({spacing:{after:60},...o,children:[new TextRun({text:t,size:20,font:"Arial",color:MARRON})]});
function stepBox(letter,word,what,say){
 const cellL=new TableCell({width:{size:1300,type:WidthType.DXA},verticalAlign:"center",
   shading:{type:ShadingType.CLEAR,fill:VERDE,color:"auto"},margins:{top:120,bottom:120,left:80,right:80},
   children:[new Paragraph({alignment:"center",children:[new TextRun({text:letter,bold:true,size:44,color:"FFFFFF",font:"Arial"})]})]});
 const cellR=new TableCell({width:{size:8780,type:WidthType.DXA},margins:{top:120,bottom:120,left:160,right:120},
   children:[
    new Paragraph({spacing:{after:40},children:[new TextRun({text:word,bold:true,size:22,color:VERDE,font:"Arial"})]}),
    new Paragraph({spacing:{after:50},children:[new TextRun({text:what,size:19,font:"Arial",color:MARRON})]}),
    new Paragraph({children:[new TextRun({text:"Ejemplo: ",bold:true,size:18,color:COBRE,font:"Arial"}),new TextRun({text:"“"+say+"”",italics:true,size:18,color:"5a4a38",font:"Arial"})]}),
   ]});
 return new Table({width:{size:10080,type:WidthType.DXA},columnWidths:[1300,8780],
   borders:{top:{style:BorderStyle.SINGLE,size:2,color:"E2D8C4"},bottom:{style:BorderStyle.SINGLE,size:2,color:"E2D8C4"},left:{style:BorderStyle.SINGLE,size:2,color:"E2D8C4"},right:{style:BorderStyle.SINGLE,size:2,color:"E2D8C4"},insideHorizontal:{style:BorderStyle.NONE},insideVertical:{style:BorderStyle.NONE}},
   rows:[new TableRow({children:[cellL,cellR]})]});
}
const gap=()=>new Paragraph({spacing:{after:80},children:[]});
const bul=(t)=>new Paragraph({spacing:{after:40},indent:{left:300,hanging:200},children:[new TextRun({text:"•  ",bold:true,color:COBRE,size:20,font:"Arial"}),new TextRun({text:t,size:19,font:"Arial",color:MARRON})]});
const doc=new Document({sections:[{
 properties:{page:{size:{width:12240,height:15840},margin:{top:900,bottom:900,left:1000,right:1000}}},
 children:[
  new Paragraph({spacing:{after:30},children:[new TextRun({text:"ROSANTA · Cómo manejar una queja",bold:true,size:32,color:VERDE,font:"Arial"})]}),
  new Paragraph({spacing:{after:120},children:[new TextRun({text:"Protocolo CERA · Cocina con Carisma · para todo el equipo de sala",italics:true,size:19,color:TIERRA,font:"Arial"})]}),
  P("Una queja no es un ataque: es una oportunidad. Un cliente al que le resuelves bien un problema vuelve MÁS leal que uno que nunca lo tuvo. Recuérdalo como CERA — hay que dar la cara — y sigue siempre estos 4 pasos, en orden.",{spacing:{after:140}}),
  stepBox("C","Cálmate y escucha","Respira, no te pongas a la defensiva. Escucha completo, sin interrumpir; míralo a los ojos, asiente y deja que termine.","Cuénteme qué pasó, le escucho."),
  gap(),
  stepBox("E","Empatiza","Valida lo que sintió, sin excusas y sin culpar a nadie (ni a la cocina, ni a un compañero, ni al cliente).","Tiene toda la razón, lamento que su experiencia no fuera la que esperaba."),
  gap(),
  stepBox("R","Resuelve","Ofrece una solución concreta y rápida: rehacer el plato, cambiarlo, un descuento o una cortesía. Si es algo mayor o pasa del monto permitido, llama al supervisor de turno.","Permítame corregirlo ahora mismo: se lo preparamos de nuevo enseguida."),
  gap(),
  stepBox("A","Agradece","Agradece que te lo dijo: te dio la oportunidad de mejorar. Despídelo con la misma calidez de la bienvenida.","Gracias por decírnoslo, nos ayuda a ser mejores. Le esperamos de vuelta."),
  new Paragraph({spacing:{before:180,after:60},children:[new TextRun({text:"Reglas de oro",bold:true,size:22,color:VERDE,font:"Arial"})]}),
  bul("Nunca discutas ni culpes al cliente, a la cocina o a un compañero."),
  bul("Nunca prometas algo que no puedas cumplir."),
  bul("Toda cortesía o descuento se registra SIEMPRE en el POS con el motivo."),
  bul("Si dudas o el caso es grande, llama al supervisor de turno."),
  new Paragraph({spacing:{before:120},children:[new TextRun({text:"Lo que NO se hace: interrumpir, poner excusas, minimizar (“no es para tanto”) ni tardar en responder.",italics:true,size:18,color:"6B5A45",font:"Arial"})]}),
 ]
}]});
Packer.toBuffer(doc).then(b=>{fs.writeFileSync("/sessions/clever-hopeful-pascal/mnt/outputs/Rosanta_Manual_CERA.docx",b);console.log("guardado CERA");});
