/** APLICAR_BARRA con los 8 productos reales del semaforo del 26-ago. */
const fs=require('fs'), vm=require('vm');
const DIR=process.env.HOME+'/Dev/Rosanta/apps-script/rosanta-intranet/';
const celda=v=>v===undefined?'':v;
class Hoja{constructor(n,g){this.nombre=n;this.g=g;}
 _a(){return this.g.reduce((m,f)=>Math.max(m,f.length),0);}
 _s(r,c){while(this.g.length<r)this.g.push([]);const f=this.g[r-1];while(f.length<c)f.push('');}
 getLastRow(){return this.g.length;} getLastColumn(){return this._a();}
 getMaxColumns(){return Math.max(this._a(),26);} setFrozenRows(){} insertColumnsAfter(){} clear(){this.g=[];}
 appendRow(f){this.g.push(f.slice());}
 getDataRange(){return this.getRange(1,1,Math.max(this.g.length,1),Math.max(this._a(),1));}
 getRange(r,c,nr,nc){nr=nr||1;nc=nc||1;const s=this;return{
  getValues(){const o=[];for(let i=0;i<nr;i++){const f=s.g[r-1+i]||[];const l=[];
   for(let j=0;j<nc;j++)l.push(celda(f[c-1+j]));o.push(l);}return o;},
  getValue(){const f=s.g[r-1]||[];return celda(f[c-1]);},
  setValue(v){s._s(r,c);s.g[r-1][c-1]=v;}, insertCheckboxes(){return this;},
  setValues(vs){for(let i=0;i<vs.length;i++)for(let j=0;j<vs[i].length;j++){s._s(r+i,c+j);s.g[r-1+i][c-1+j]=vs[i][j];}}};}}
class Libro{constructor(h){this.h=h;} getSheetByName(n){return this.h[n]||null;} insertSheet(n){this.h[n]=new Hoja(n,[]);return this.h[n];}}

// Banco de BARRA con los precios viejos reales. D = precio por unidad de receta.
const filas=[
 ['AZUCAR BLANCA', 108,  4.22, 'lb'],
 ['SAL FINA',        2,  2.2,  'lb'],
 ['AJO',            30, 18,    'lb'],
 ['APIO',            8,  5,    'unidad'],
 ['CEBOLLA BLANCA',7.5,  4,    'lb'],
 ['CEBOLLA MORADA',  8,  5,    'lb'],
 ['FRESAS',         22, 15,    'lb'],
 ['LIMON',         1.4,  1,    'unidad'],
 ['RON BOTRAN',    140,140,    'unidad'],   // igual: no debe proponerse
];
const banco=new Hoja('BANCO DE DATOS',[['','','e'],['','','e'],['','','PRODUCTO','Q/REC','U.REC','Q/COMPRA','U.COMPRA','','PROV']]);
const LB=453.592;
// D = precio por unidad de receta. Para lb->g el factor sano es 1/453.592.
let FACTOR_SANO = true;
function armarBanco(){
  banco.g = banco.g.slice(0,3);
  filas.forEach(([p,viejo,,uni])=>{
    let d, ur;
    if (uni==='lb'){ ur='g'; d = (FACTOR_SANO||p!=='AZUCAR BLANCA') ? viejo/LB : viejo/1000; }
    else { ur='unidad'; d = viejo; }
    banco.g.push(['','',p, d, ur, viejo, uni, '', 'prov viejo']);
  });
}
armarBanco();
const cierre=new Hoja('PRECIO PROVEEDORES',[['','','PRODUCTO','ANT','ACTUAL','PRESENTACION','PROVEEDOR']]);
filas.forEach(([p,viejo,nuevo,uni])=>cierre.g.push(['','',p,viejo,nuevo,uni,'Distribuidora Don Tavito']));

const libroRec=new Libro({'BANCO DE DATOS':banco}), libroCie=new Libro({'PRECIO PROVEEDORES':cierre}), libroCos=new Libro({});
const ctx={console,Logger:{log(){}},CacheService:{getScriptCache:()=>({remove(){}})},
 PropertiesService:{getScriptProperties:()=>({getProperty:()=>'x',setProperty(){}})},
 SpreadsheetApp:{openById:()=>libroRec},MimeType:{GOOGLE_SHEETS:'x'},
 Session:{getActiveUser:()=>({getEmail:()=>'juanma@rosanta'})},
 Utilities:{formatDate(d,t,f){const p=n=>String(n).padStart(2,'0');
  return f.replace('yyyy',d.getFullYear()).replace('MM',p(d.getMonth()+1)).replace('dd',p(d.getDate()))
          .replace('HH',p(d.getHours())).replace('mm',p(d.getMinutes())).replace('ss',p(d.getSeconds()));}}};
vm.createContext(ctx);
['ConfigCosteo.js','EdicionRecetario.js','SincronizarPrecios.js','APLICAR_BARRA.js']
 .forEach(f=>vm.runInContext(fs.readFileSync(DIR+f,'utf8'),ctx));
ctx.L={rec:libroRec,cie:libroCie,cos:libroCos};
vm.runInContext(`abrirPorClave_=function(k){return k==='INVENTARIO_CIERRE_SHEET_ID'?L.cie:L.rec;};
 hojaCosteo_=function(){return L.cos;};`,ctx);
const F=n=>vm.runInContext(n,ctx);
let fallas=0; const ok=(q,r,e)=>{const b=JSON.stringify(r)===JSON.stringify(e); if(!b)fallas++;
 console.log((b?'  OK   ':'  FALLA')+'  '+q+(b?'':`   esperado ${JSON.stringify(e)}, dio ${JSON.stringify(r)}`));};
const precio=p=>{const i=filas.findIndex(f=>f[0]===p); return banco.g[3+i][5];};

console.log('\n=== 1. simula: 7, azucar fuera ===');
const s=F('APLICAR_BARRA()');
ok('simula 7, azucar fuera', s.aplicarian, 7);
ok('no escribio nada', precio('AJO'), 30);
ok('el azucar todavia en 108', precio('AZUCAR BLANCA'), 108);

console.log('\n=== 2. aplica ===');
F('CONFIRMAR_BARRA = true');
const r=F('APLICAR_BARRA()');
ok('escribe 7', r.escritos, 7);
[['AJO',18],['APIO',5],['CEBOLLA BLANCA',4],['CEBOLLA MORADA',5],['FRESAS',15],['LIMON',1],['SAL FINA',2.2]]
 .forEach(([p,v])=>ok(p+' quedo en Q'+v, precio(p), v));
ok('AZUCAR BLANCA intacta en Q108 — el sync no la puede arreglar', precio('AZUCAR BLANCA'), 108);
const iAz=filas.findIndex(f=>f[0]==='AZUCAR BLANCA');
ok('...y su precio por gramo, que HOY ESTA BIEN, no se toco',
   Math.abs(banco.g[3+iAz][3]-108/453.592)<1e-9, true);
ok('RON BOTRAN no se toco (estaba igual)', precio('RON BOTRAN'), 140);

console.log('\n=== 3. rastro y reversibilidad ===');
ok('quedo en BITACORA', libroCos.getSheetByName('BITACORA').g.length-1, 7);
ok('el azucar NO esta en la bitacora',
   libroCos.getSheetByName('BITACORA').g.some(f=>String(f[5]).toUpperCase().includes('AZUCAR')), false);
ok('devolvio corrida para deshacer', /^\d{8}-\d{6}-/.test(r.corrida), true);

console.log('\n=== 4. correrlo dos veces no hace nada ===');
const r2=F('APLICAR_BARRA()');
ok('la segunda no escribe', r2.escritos||0, 0);
ok('los precios no se movieron', precio('AJO'), 18);

console.log('\n=== 5. el freno sigue armado para el futuro ===');
ok('CONTROL_BARRA vigila el azucar', F("!!CONTROL_BARRA['azucar blanca']"), true);
ok('pero el azucar no esta aprobada, asi que no frena nada hoy',
   F("APROBADOS_BARRA.indexOf('azucar blanca')"), -1);

console.log('\n'+(fallas?'FALLAS: '+fallas:'TODO OK')+'\n');
process.exit(fallas?1:0);
