/**
 * El arreglo de areas: cada escritura tiene que aterrizar en la hoja de SU area.
 * El escenario es el real: 'AJO' existe en cocina Y en barra, con precios distintos.
 *
 * 14-oct-2026: webCambiarPrecioInsumo y webBuscarSimilares se archivaron en la Fase 4 de
 * la auditoria (apps-script/_archivo/2026-10-14_limpieza_auditoria/): ninguna pantalla
 * las llamaba. El precio de un insumo hoy lo escribe registrarPrecio(auth, datos)
 * (Proveedores.js), que es lo que llama el boton de la pantalla (CosteoJs_Acciones.html)
 * con datos.area. Las secciones de precio corren contra esa funcion; la de similares,
 * contra buscarSimilares_, que sigue viva porque la usa crearInsumo_.
 * La identidad ya no se pisa: corren resolverUsuario_/getUsuarioPorToken_ reales contra
 * una hoja USUARIOS de mentira.
 */
const fs=require('fs'), vm=require('vm');
const DIR = require('path').join(__dirname, '../apps-script/rosanta-intranet/');
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
  getFormula(){return '';},   // precioSaleDeLaFicha_: aca ningun precio es formula
  setValue(v){s._s(r,c);s.g[r-1][c-1]=v;return this;}, clearContent(){}, insertCheckboxes(){return this;},
  setValues(vs){for(let i=0;i<vs.length;i++)for(let j=0;j<vs[i].length;j++){s._s(r+i,c+j);s.g[r-1+i][c-1+j]=vs[i][j];}return this;}};}}
class Libro{constructor(h,n){this.h=h;this.n=n;} getSheetByName(x){return this.h[x]||null;}
 getSheets(){return Object.values(this.h);} insertSheet(x){this.h[x]=new Hoja(x,[]);return this.h[x];} getName(){return this.n;}}

function banco(precioAjo, prov){
  return new Hoja('BANCO DE DATOS',[['','','e'],['','','e'],
   ['','CATEGORIA','PRODUCTO','Q/REC','U.REC','Q/COMPRA','U.COMPRA','CONV','PROVEEDOR'],
   ['','ABARROTES','AJO', precioAjo/453.592,'g', precioAjo,'lb','', prov]]);
}
// USUARIOS: correo | rol | modulos | puede_editar | nombre | token  (Config.js)
const USUARIOS=[['correo','rol','modulos','puede_editar','nombre','token'],
  ['restaurante@rosanta.rest','dueno','recetario','SI','Juanma','tok-dueno'],
  ['jeffry@rosanta.rest','chef','recetario','SI','Jeffry','tok-chef'],
  ['jose@gmail.com','sala','recetario','SI','Jose','tok-sala']];

let bCocina, bBarra, libroCos;
function montar(){
  bCocina=banco(18,'Prov Cocina'); bBarra=banco(30,'Prov Barra');
  const LC=new Libro({'BANCO DE DATOS':bCocina},'Recetario Cocina');
  const LB=new Libro({'BANCO DE DATOS':bBarra},'Recetario Barra');
  libroCos=new Libro({'PRECIOS':new Hoja('PRECIOS',[['FECHA','PRODUCTO','PROVEEDOR','PRECIO','UNIDAD','Q/REC','FACTURA','QUIEN','NOTA']])},'Costeo');
  const LU=new Libro({'USUARIOS':new Hoja('USUARIOS',USUARIOS.map(f=>f.slice()))},'Config');
  // la propiedad devuelve su propia clave, y openById elige el libro por esa clave:
  // abrirPorClave_, hojaCosteo_ y getSheetId_ corren las reales.
  const porId={RECETARIO_COCINA_SHEET_ID:LC, RECETARIO_BARRA_SHEET_ID:LB, COSTEO_SHEET_ID:libroCos, CONFIG_SHEET_ID:LU};
  const ctx={console,Logger:{log(){}},CacheService:{getScriptCache:()=>({remove(){},get:()=>null,put(){}})},
   PropertiesService:{getScriptProperties:()=>({getProperty:k=>k})},
   SpreadsheetApp:{openById:id=>porId[id]||null, flush(){}},MimeType:{GOOGLE_SHEETS:'x'},
   LockService:{getScriptLock:()=>({tryLock:()=>true,releaseLock(){}})},
   Session:{getActiveUser:()=>({getEmail:()=>''})},Utilities:{formatDate:d=>String(d)}};
  vm.createContext(ctx);
  ['ConfigCosteo.js','Config.js','ConfigPOS.js','CosteoDatos.js','EdicionRecetario.js','CrearFicha.js','Proveedores.js','EdicionWeb.js','Tiempos.js']
   .forEach(f=>vm.runInContext(fs.readFileSync(DIR+f,'utf8'),ctx,{filename:f}));
  vm.runInContext(`
    // conCambiosDeModelo_ (real) relee las fichas tocadas para el cache: fuera de alcance.
    aplicarToques_=function(){ return { fichas: [], insumos: [], recargar: false }; };
  `,ctx);
  return n=>vm.runInContext(n,ctx);
}
let fallas=0, total=0; const ok=(q,r,e)=>{total++;const b=JSON.stringify(r)===JSON.stringify(e); if(!b)fallas++;
 console.log((b?'  OK   ':'  FALLA')+'  '+q+(b?'':`   esperado ${JSON.stringify(e)}, dio ${JSON.stringify(r)}`));};
const precio=h=>h.g[3][5], prov=h=>h.g[3][8];
const intentar=(F,n)=>{try{F(n);return '';}catch(e){return e.message;}};

console.log('\n=== 1. EL BUG ORIGINAL: cambiar el precio del ajo de BARRA ===');
let F=montar();
let r=F("registrarPrecio('tok-dueno', {producto:'AJO', precioCompra:25, nota:'prueba', area:'BARRA'})");
ok('la llamada sale bien, en BARRA', [r.area, r.ahora], ['BARRA', 25]);
ok('BARRA quedo en 25', precio(bBarra), 25);
ok('COCINA NO SE TOCO (antes se pisaba)', precio(bCocina), 18);

console.log('\n=== 2. y cocina sigue yendo a cocina ===');
F=montar();
r=F("registrarPrecio('tok-dueno', {producto:'AJO', precioCompra:19, nota:'prueba', area:'COCINA'})");
ok('COCINA quedo en 19', precio(bCocina), 19);
ok('BARRA intacta', precio(bBarra), 30);

console.log('\n=== 3. sin area explicita = COCINA (no rompe lo viejo) ===');
// registrarPrecio, Proveedores.js: "Sin area se comporta como antes, para los llamadores
// de servidor." Con el dueno, que escribe en las dos, eso sigue siendo COCINA.
F=montar();
F("registrarPrecio('tok-dueno', {producto:'AJO', precioCompra:21, nota:'prueba'})");
ok('fue a cocina', precio(bCocina), 21);
ok('barra intacta', precio(bBarra), 30);

console.log('\n=== 3b. el area del ROL manda: sala (Jose, barra) no escribe en cocina ===');
// 14-oct-2026: EDIT.areasPorRol (30-ago-2026) y el comentario de registrarPrecio
// (14-sep-2026: "el rol de sala podia escribir en cocina") dicen que este camino NO
// puede aterrizar en COCINA para el rol sala. Con area explicita lo corta exigirArea_.
F=montar();
let e=intentar(F,"registrarPrecio('tok-sala', {producto:'AJO', precioCompra:66, area:'COCINA'})");
ok('sala con area COCINA: se rechaza', /no escribe en COCINA/.test(e), true);
ok('  y cocina quedo intacta', precio(bCocina), 18);
// Sin area: registrarPrecio se saltea exigirArea_ y ubicarEnBanco_ cae en la primera
// area (COCINA). Es un llamado publico (google.script.run), asi que el navegador de Jose
// puede omitir el area. EdicionWeb.js resuelve ese mismo caso con areaPorDefecto_(rol).
F=montar();
intentar(F,"registrarPrecio('tok-sala', {producto:'AJO', precioCompra:77})");
ok('sala SIN area: cocina NO se toca', precio(bCocina), 18);

console.log('\n=== 4. el proveedor tambien aterriza donde debe ===');
F=montar();
r=F("webAsignarProveedor('tok-dueno', 'AJO', 'Nuevo Prov', 'BARRA')");
ok('la llamada sale bien', r.ok, true);
ok('BARRA cambio de proveedor', prov(bBarra), 'Nuevo Prov');
ok('COCINA conservo el suyo', prov(bCocina), 'Prov Cocina');

console.log('\n=== 5. la bitacora dice DE QUE AREA ===');
let bit=libroCos.getSheetByName('BITACORA');
ok('hay una fila', bit.g.length-1, 1);
ok('la hoja lleva el area (asignarProveedor)', /BANCO DE DATOS · BARRA/.test(String(bit.g[1][4])), true);
// 14-oct-2026: el precio ahora entra por registrarPrecio. Su comentario dice que escribe
// la BITACORA "con el mismo formato que cambiarPrecioInsumo_()", que la etiqueta con
// conArea_ ("BANCO DE DATOS · BARRA") porque hay ocho productos con el mismo nombre en
// las dos areas.
F=montar();
F("registrarPrecio('tok-dueno', {producto:'AJO', precioCompra:25, area:'BARRA'})");
bit=libroCos.getSheetByName('BITACORA');
ok('la hoja lleva el area (registrarPrecio)', /BANCO DE DATOS · BARRA/.test(String(bit.g[1][4])), true);

console.log('\n=== 6. un area inventada se rechaza, no cae en cocina ===');
// registrarPrecio tira en vez de devolver {ok:false}: no pasa por edicionCorrer_.
F=montar();
e=intentar(F,"registrarPrecio('tok-dueno', {producto:'AJO', precioCompra:99, nota:'x', area:'PATIO'})");
ok('devuelve error', e!=='', true);
ok('dice que el area no existe', /Area desconocida/.test(e), true);
ok('no escribio en cocina', precio(bCocina), 18);
ok('no escribio en barra', precio(bBarra), 30);
r=F("webAsignarProveedor('tok-dueno', 'AJO', 'X', 'PATIO')");
ok('webAsignarProveedor tambien la rechaza', [r.ok, /Area desconocida/.test(r.error)], [false, true]);
ok('  sin tocar ningun proveedor', [prov(bCocina), prov(bBarra)], ['Prov Cocina', 'Prov Barra']);

console.log('\n=== 7. buscarSimilares_ mira el Banco del area correcta ===');
F=montar();
ok('en BARRA encuentra su ajo', F("buscarSimilares_('AJO', 'BARRA')[0].precio"), 30);
ok('en COCINA encuentra el suyo', F("buscarSimilares_('AJO', 'COCINA')[0].precio"), 18);

console.log('\n=== 8. ubicarEnBanco_ ya no se queda con la primera ===');
F=montar();
ok('con area BARRA da el precio de barra', F("ubicarEnBanco_('AJO','BARRA').precioCompra"), 30);
ok('con area COCINA da el de cocina', F("ubicarEnBanco_('AJO','COCINA').precioCompra"), 18);
ok('sin area sigue dando la primera (cocina)', F("ubicarEnBanco_('AJO').precioCompra"), 18);

console.log('\n'+total+' chequeos · '+(total-fallas)+' OK · '+fallas+' FALLA');
console.log((fallas?'FALLAS: '+fallas:'TODO OK')+'\n');
process.exit(fallas?1:0);
