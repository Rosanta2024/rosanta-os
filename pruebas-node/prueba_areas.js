/**
 * El arreglo de areas: cada escritura tiene que aterrizar en la hoja de SU area.
 * El escenario es el real: 'AJO' existe en cocina Y en barra, con precios distintos.
 */
const fs=require('fs'), vm=require('vm');
const DIR=process.env.HOME+'/Dev/Rosanta/apps-script/rosanta-intranet/';
const celda=v=>v===undefined?'':v;
class Hoja{constructor(n,g){this.nombre=n;this.g=g;}
 _a(){return this.g.reduce((m,f)=>Math.max(m,f.length),0);}
 _s(r,c){while(this.g.length<r)this.g.push([]);const f=this.g[r-1];while(f.length<c)f.push('');}
 getLastRow(){return this.g.length;} getLastColumn(){return this._a();}
 getMaxColumns(){return Math.max(this._a(),26);} setFrozenRows(){} insertColumnsAfter(){} clear(){this.g=[];}
 appendRow(f){this.g.push(f.slice());} getName(){return this.nombre;}
 getDataRange(){return this.getRange(1,1,Math.max(this.g.length,1),Math.max(this._a(),1));}
 getRange(r,c,nr,nc){nr=nr||1;nc=nc||1;const s=this;return{
  getValues(){const o=[];for(let i=0;i<nr;i++){const f=s.g[r-1+i]||[];const l=[];
   for(let j=0;j<nc;j++)l.push(celda(f[c-1+j]));o.push(l);}return o;},
  getValue(){const f=s.g[r-1]||[];return celda(f[c-1]);},
  setValue(v){s._s(r,c);s.g[r-1][c-1]=v;}, clearContent(){}, insertCheckboxes(){return this;},
  setValues(vs){for(let i=0;i<vs.length;i++)for(let j=0;j<vs[i].length;j++){s._s(r+i,c+j);s.g[r-1+i][c-1+j]=vs[i][j];}}};}}
class Libro{constructor(h,n){this.h=h;this.n=n;} getSheetByName(x){return this.h[x]||null;}
 getSheets(){return Object.values(this.h);} insertSheet(x){this.h[x]=new Hoja(x,[]);return this.h[x];} getName(){return this.n;}}

function banco(precioAjo, prov){
  return new Hoja('BANCO DE DATOS',[['','','e'],['','','e'],
   ['','CATEGORIA','PRODUCTO','Q/REC','U.REC','Q/COMPRA','U.COMPRA','CONV','PROVEEDOR'],
   ['','ABARROTES','AJO', precioAjo/453.592,'g', precioAjo,'lb','', prov]]);
}
let bCocina, bBarra, libroCos;
function montar(){
  bCocina=banco(18,'Prov Cocina'); bBarra=banco(30,'Prov Barra');
  const LC=new Libro({'BANCO DE DATOS':bCocina},'Recetario Cocina');
  const LB=new Libro({'BANCO DE DATOS':bBarra},'Recetario Barra');
  libroCos=new Libro({},'Costeo');
  const ctx={console,Logger:{log(){}},CacheService:{getScriptCache:()=>({remove(){}})},
   PropertiesService:{getScriptProperties:()=>({getProperty:()=>'x'})},
   SpreadsheetApp:{openById:()=>LC},MimeType:{GOOGLE_SHEETS:'x'},
   Session:{getActiveUser:()=>({getEmail:()=>'t@r'})},Utilities:{formatDate:d=>String(d)}};
  vm.createContext(ctx);
  ['ConfigCosteo.js','EdicionRecetario.js','CrearFicha.js','Proveedores.js','EdicionWeb.js']
   .forEach(f=>vm.runInContext(fs.readFileSync(DIR+f,'utf8'),ctx));
  ctx.LC=LC; ctx.LB=LB; ctx.LCOS=libroCos;
  vm.runInContext(`
    abrirPorClave_=function(k){
      if(k==='RECETARIO_COCINA_SHEET_ID') return LC;
      if(k==='RECETARIO_BARRA_SHEET_ID')  return LB;
      return LCOS; };
    hojaCosteo_=function(){ return LCOS; };
    resolverUsuario_=function(){ return {email:'t@r', rol:'dueno', nombre:'T', modulos:['recetario']}; };
    usuarioTieneModulo=function(){ return true; };
  `,ctx);
  return n=>vm.runInContext(n,ctx);
}
let fallas=0; const ok=(q,r,e)=>{const b=JSON.stringify(r)===JSON.stringify(e); if(!b)fallas++;
 console.log((b?'  OK   ':'  FALLA')+'  '+q+(b?'':`   esperado ${JSON.stringify(e)}, dio ${JSON.stringify(r)}`));};
const precio=h=>h.g[3][5], prov=h=>h.g[3][8];

console.log('\n=== 1. EL BUG ORIGINAL: cambiar el precio del ajo de BARRA ===');
let F=montar();
let r=F("webCambiarPrecioInsumo('', 'AJO', 25, 'prueba', 'BARRA')");
ok('la llamada sale bien', r.ok, true);
ok('BARRA quedo en 25', precio(bBarra), 25);
ok('COCINA NO SE TOCO (antes se pisaba)', precio(bCocina), 18);

console.log('\n=== 2. y cocina sigue yendo a cocina ===');
F=montar();
r=F("webCambiarPrecioInsumo('', 'AJO', 19, 'prueba', 'COCINA')");
ok('COCINA quedo en 19', precio(bCocina), 19);
ok('BARRA intacta', precio(bBarra), 30);

console.log('\n=== 3. sin area explicita = COCINA (no rompe lo viejo) ===');
F=montar();
F("webCambiarPrecioInsumo('', 'AJO', 21, 'prueba')");
ok('fue a cocina', precio(bCocina), 21);
ok('barra intacta', precio(bBarra), 30);

console.log('\n=== 4. el proveedor tambien aterriza donde debe ===');
F=montar();
F("webAsignarProveedor('', 'AJO', 'Nuevo Prov', 'BARRA')");
ok('BARRA cambio de proveedor', prov(bBarra), 'Nuevo Prov');
ok('COCINA conservo el suyo', prov(bCocina), 'Prov Cocina');

console.log('\n=== 5. la bitacora dice DE QUE AREA ===');
const bit=libroCos.getSheetByName('BITACORA');
ok('hay una fila', bit.g.length-1, 1);
ok('la hoja lleva el area', /BANCO DE DATOS · BARRA/.test(String(bit.g[1][4])), true);

console.log('\n=== 6. un area inventada se rechaza, no cae en cocina ===');
F=montar();
r=F("webCambiarPrecioInsumo('', 'AJO', 99, 'x', 'PATIO')");
ok('devuelve error', r.ok, false);
ok('dice que el area no existe', /Area desconocida/.test(r.error), true);
ok('no escribio en cocina', precio(bCocina), 18);
ok('no escribio en barra', precio(bBarra), 30);

console.log('\n=== 7. buscarSimilares_ mira el Banco del area correcta ===');
F=montar();
ok('en BARRA encuentra su ajo', F("webBuscarSimilares('', 'AJO', 'BARRA').resultado[0].precio"), 30);
ok('en COCINA encuentra el suyo', F("webBuscarSimilares('', 'AJO', 'COCINA').resultado[0].precio"), 18);

console.log('\n=== 8. ubicarEnBanco_ ya no se queda con la primera ===');
F=montar();
ok('con area BARRA da el precio de barra', F("ubicarEnBanco_('AJO','BARRA').precioCompra"), 30);
ok('con area COCINA da el de cocina', F("ubicarEnBanco_('AJO','COCINA').precioCompra"), 18);
ok('sin area sigue dando la primera (cocina)', F("ubicarEnBanco_('AJO').precioCompra"), 18);

console.log('\n'+(fallas?'FALLAS: '+fallas:'TODO OK')+'\n');
process.exit(fallas?1:0);
