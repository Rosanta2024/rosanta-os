/** Las tres reglas de limpieza + el cuadre, contra filas reales del export. */
const fs=require('fs'), vm=require('vm');
const DIR=process.env.HOME+'/Dev/Rosanta/apps-script/rosanta-intranet/';
const celda=v=>v===undefined?'':v;
class Hoja{constructor(n,g){this.nombre=n;this.g=g;}
 _a(){return this.g.reduce((m,f)=>Math.max(m,f.length),0);}
 _s(r,c){while(this.g.length<r)this.g.push([]);const f=this.g[r-1];while(f.length<c)f.push('');}
 getLastRow(){return this.g.length;} getLastColumn(){return this._a();} getName(){return this.nombre;}
 getMaxColumns(){return Math.max(this._a(),26);} setFrozenRows(){} clear(){this.g=[];}
 appendRow(f){this.g.push(f.slice());}
 getDataRange(){return this.getRange(1,1,Math.max(this.g.length,1),Math.max(this._a(),1));}
 getRange(r,c,nr,nc){nr=nr||1;nc=nc||1;const s=this;return{
  getValues(){const o=[];for(let i=0;i<nr;i++){const f=s.g[r-1+i]||[];const l=[];
   for(let j=0;j<nc;j++)l.push(celda(f[c-1+j]));o.push(l);}return o;},
  getValue(){const f=s.g[r-1]||[];return celda(f[c-1]);},
  setValue(v){s._s(r,c);s.g[r-1][c-1]=v;}, clearContent(){
    for(let i=0;i<nr;i++) for(let j=0;j<nc;j++){ s._s(r+i,c+j); s.g[r-1+i][c-1+j]=''; }},
  setValues(vs){for(let i=0;i<vs.length;i++)for(let j=0;j<vs[i].length;j++){
    s._s(r+i,c+j); s.g[r-1+i][c-1+j]=vs[i][j];}}};}}
class Libro{constructor(h){this.h=h;} getSheetByName(n){return this.h[n]||null;}
 getSheets(){return Object.values(this.h);} insertSheet(n){this.h[n]=new Hoja(n,[]);return this.h[n];}}

const ENC=['Doc ID','fecha_Emision','Producto','Categoria','Cantidad','Precio_Venta',
           'Descuento','Precio_Compra','Total','Facturador','Vendedor','Comentario_Producto'];
// filas reales del export del 20-26 ago
const CRUDAS=[
 ['7398','26/08/2026','Hamburguesa de Lomito | Producto No confirmado*','Entrante',3,130,0,0,390,'Admin','Admin',''],
 ['7397','26/08/2026','Mezcal a la Piña','Coctel Autor',2,80,0,13.05,160,'Admin','Admin',''],
 ['7385','23/08/2026','Agua Natural de la casa 1L | Producto eliminado*','Refresco & Agua',1,0,0,0,0,'Admin','Admin',''],
 ['7379','22/08/2026','Tartar de Hongos | Producto eliminado*','Entrante',1,0,0,0,0,'Admin','Admin',''],
 ['7379','22/08/2026','Tartar de Hongos','Entrante',1,100,0,0,100,'Admin','Admin',''],
 ['7377','22/08/2026','Chiatenango | Producto eliminado*','Coctel Autor',1,0,0,14.26,0,'Admin','Admin',''],
 ['7356','20/08/2026','Peras Horneadas Cortesia','General',1,0,0,0,0,'Admin','Admin',''],   // Q0 pero NO anulada
 ['7353','20/08/2026','Blanco - La Val','Vino Copa',2,65,0,23.83,130,'Admin','Admin',''],
];
const SUMA = CRUDAS.reduce((a,f)=>a+f[8],0);

let libroCos, hojaExport;
function montar(totalDelArchivo, crudas){
  crudas = crudas || CRUDAS;
  hojaExport=new Hoja('Sheet1',[ENC.slice()]);
  crudas.forEach(f=>hojaExport.g.push(f.slice()));
  if(totalDelArchivo!==null) hojaExport.g.push(['','','','','','','','',totalDelArchivo,'','','']);
  libroCos=new Libro({});
  const libroExp=new Libro({'Sheet1':hojaExport});
  const ctx={console,Logger:{log(){}},
   CacheService:{getScriptCache:()=>({remove(){}})},
   PropertiesService:{getScriptProperties:()=>({getProperty:()=>'x'})},
   SpreadsheetApp:{openById:()=>libroExp},
   MimeType:{GOOGLE_SHEETS:'x'}, DriveApp:{getFolderById:()=>{throw new Error('no');}},
   Drive:{Files:{copy:()=>({id:'copia'})}},
   Session:{getActiveUser:()=>({getEmail:()=>'t@r'})},
   Utilities:{formatDate(d,t,f){const p=n=>String(n).padStart(2,'0');
     return f.replace('yyyy',d.getFullYear()).replace('MM',p(d.getMonth()+1))
             .replace('dd',p(d.getDate())).replace('HH',p(d.getHours())).replace('mm',p(d.getMinutes()));}}};
  vm.createContext(ctx);
  ['ConfigCosteo.js','EdicionRecetario.js','VentasPorProducto.js'].forEach(f=>
    vm.runInContext(fs.readFileSync(DIR+f,'utf8'),ctx));
  ctx.LC=libroCos;
  vm.runInContext("hojaCosteo_=function(){return LC;};",ctx);
  return n=>vm.runInContext(n,ctx);
}
let fallas=0; const ok=(q,r,e)=>{const b=JSON.stringify(r)===JSON.stringify(e); if(!b)fallas++;
 console.log((b?'  OK   ':'  FALLA')+'  '+q+(b?'':`   esperado ${JSON.stringify(e)}, dio ${JSON.stringify(r)}`));};

console.log('\n=== 1. limpiarNombreProducto_ ===');
let F=montar(SUMA);
ok('quita "| Producto No confirmado*"', F(`limpiarNombreProducto_('Tartar de Hongos | Producto No confirmado*')`), 'Tartar de Hongos');
ok('quita "| Producto eliminado*"',     F(`limpiarNombreProducto_('Bock Choy | Producto eliminado*')`), 'Bock Choy');
ok('deja intacto lo que no trae sufijo',F(`limpiarNombreProducto_('Pulpo a la Parrilla')`), 'Pulpo a la Parrilla');
ok('colapsa espacios sobrantes',        F(`limpiarNombreProducto_('Porción   Pan  |  x')`), 'Porción Pan');
ok('con y sin sufijo dan lo MISMO',
   F(`limpiarNombreProducto_('Queso Horneado | Producto No confirmado*') === limpiarNombreProducto_('Queso Horneado')`), true);

console.log('\n=== 2. fechaVenta_ lee DD/MM/YYYY, no MM/DD ===');
ok('26/08/2026 -> 2026-08-26', F(`fechaVenta_('26/08/2026')`), '2026-08-26');
ok('02/01/2026 -> 2026-01-02 (no 2026-02-01)', F(`fechaVenta_('02/01/2026')`), '2026-01-02');
ok('acepta un Date', F(`fechaVenta_(new Date(2026,7,23))`), '2026-08-23');
ok('acepta ya normalizada', F(`fechaVenta_('2026-08-23')`), '2026-08-23');

console.log('\n=== 3. esLineaAnulada_ ===');
ok('eliminado + Q0 = anulada',   F(`esLineaAnulada_('Tartar de Hongos | Producto eliminado*', 0)`), true);
ok('eliminado pero con plata NO',F(`esLineaAnulada_('Tartar de Hongos | Producto eliminado*', 100)`), false);
ok('Q0 sin "eliminado" NO',      F(`esLineaAnulada_('Peras Horneadas Cortesia', 0)`), false);
ok('"No confirmado" NO es anulada', F(`esLineaAnulada_('Bock Choy | Producto No confirmado*', 100)`), false);

console.log('\n=== 4. leerExportVentas_ sobre las filas reales ===');
let r=F(`leerExportVentas_('x')`);
ok('sin error', r.error, undefined);
ok('cuadra', Math.abs(r.sumaConDoc - SUMA) < 0.005, true);
ok('3 anuladas descartadas', r.anuladas, 3);
ok('1 en Q0 que NO es anulada (la cortesia)', r.cero, 1);
ok('4 lineas validas', r.filas.length, 4);
ok('el "No confirmado" SI se cuenta', r.filas.some(f=>f[3]==='Hamburguesa de Lomito'), true);
ok('y con el nombre limpio', r.filas.find(f=>f[3]==='Hamburguesa de Lomito')[2], 'Hamburguesa de Lomito | Producto No confirmado*');
ok('el Tartar real sobrevivio', r.filas.filter(f=>f[3]==='Tartar de Hongos').length, 1);
ok('fecha normalizada', r.filas[0][1], '2026-08-26');
ok('rango', [r.desde, r.hasta], ['2026-08-20','2026-08-26']);

console.log('\n=== 5. el cuadre es obligatorio: si no da, no escribe nada ===');
F=montar(SUMA + 1);
r=F(`leerExportVentas_('x')`);
ok('rechaza', /NO CUADRA/.test(r.error||''), true);
ok('no devuelve filas', r.filas, undefined);
F=montar(null);
r=F(`leerExportVentas_('x')`);
ok('sin fila de total tambien rechaza', /no trae fila de total/.test(r.error||''), true);

console.log('\n=== 6. idempotencia por rango de fechas ===');
F=montar(SUMA);
r=F(`leerExportVentas_('x')`);
F(`ESC = leerExportVentas_('x')`);
let e1=F(`escribirVentas_(ESC.filas, ESC.desde, ESC.hasta, 'hoy')`);
ok('primera carga: 4 filas', e1.total, 4);
F(`ESC2 = leerExportVentas_('x')`);
let e2=F(`escribirVentas_(ESC2.filas, ESC2.desde, ESC2.hasta, 'hoy')`);
ok('segunda carga del MISMO archivo: sigue en 4', e2.total, 4);
const hv=libroCos.getSheetByName('VENTAS x PLATO');
ok('la hoja tiene encabezado + 4', hv.g.length, 5);
ok('no hay duplicados de Doc ID+producto', new Set(hv.g.slice(1).map(f=>f[0]+'|'+f[3])).size, 4);

console.log('\n=== 7b. LA TRAMPA: Sheets devuelve la fecha como Date, no como texto ===');
// Esto es lo que rompio la carga del 27-ago: 32.888 filas en vez de 9.501.
F=montar(SUMA);
F(`E1 = leerExportVentas_('x')`);
F(`escribirVentas_(E1.filas, E1.desde, E1.hasta, 'hoy')`);
const hv2=libroCos.getSheetByName('VENTAS x PLATO');
hv2.g.slice(1).forEach(f=>{ const m=String(f[1]).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if(m) f[1]=new Date(+m[1], +m[2]-1, +m[3]); });          // Sheets las convierte
ok('quedaron como Date', hv2.g[1][1] instanceof Date, true);
F(`E2 = leerExportVentas_('x')`);
const e3=F(`escribirVentas_(E2.filas, E2.desde, E2.hasta, 'hoy')`);
ok('con fechas como Date, la segunda carga SIGUE en 4 (no 8)', e3.total, 4);

console.log('\n=== 7. lo de fuera del rango NO se toca ===');
hv.g.push(['9999','2026-01-15','Viejo','Viejo','Entrante',1,10,0,10,'Admin','antes']);
F(`ESC3 = leerExportVentas_('x')`);
F(`escribirVentas_(ESC3.filas, ESC3.desde, ESC3.hasta, 'hoy')`);
ok('la fila de enero sobrevivio', hv.g.slice(1).some(f=>f[0]==='9999'), true);
ok('y las de agosto no se duplicaron', hv.g.slice(1).filter(f=>f[0]!=='9999').length, 4);

console.log('\n'+(fallas?'FALLAS: '+fallas:'TODO OK')+'\n');
process.exit(fallas?1:0);
