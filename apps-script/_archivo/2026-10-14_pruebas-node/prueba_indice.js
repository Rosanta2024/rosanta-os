/** El chequeo nuevo de la bateria: detecta un INDICE_INSUMO_RECETA viejo. */
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
  setValue(v){s._s(r,c);s.g[r-1][c-1]=v;}, clearContent(){}, insertCheckboxes(){return this;},
  setValues(vs){for(let i=0;i<vs.length;i++)for(let j=0;j<vs[i].length;j++){s._s(r+i,c+j);s.g[r-1+i][c-1+j]=vs[i][j];}}};}}
class Libro{constructor(h){this.h=h;} getSheetByName(n){return this.h[n]||null;} insertSheet(n){this.h[n]=new Hoja(n,[]);return this.h[n];}}

// modelo de mentira: 2 recetas de cocina y 1 de barra
const MODELO={ recetas:[{area:'COCINA'},{area:'COCINA'},{area:'BARRA'}], insumos:[] };

function correr(filasIndice){
  const idx=new Hoja('INDICE_INSUMO_RECETA',[['INSUMO','PROV','AREA','RECETA','TIPO','CANT','UNI','TOTAL']]);
  filasIndice.forEach(f=>idx.g.push(f));
  const cos=new Libro({'INDICE_INSUMO_RECETA':idx});
  const ctx={console,Logger:{log(){}},CacheService:{getScriptCache:()=>({remove(){}})},
   PropertiesService:{getScriptProperties:()=>({getProperty:()=>'x'})},
   SpreadsheetApp:{openById:()=>cos},MimeType:{GOOGLE_SHEETS:'x'},
   Session:{getActiveUser:()=>({getEmail:()=>'t@r'})},Utilities:{formatDate:d=>String(d)}};
  vm.createContext(ctx);
  ['ConfigCosteo.js','EdicionRecetario.js','SincronizarPrecios.js','SemaforoPrecios.js',
   'LectorBitacora.js','Proveedores.js','Pruebas.js'].forEach(f=>
     vm.runInContext(fs.readFileSync(DIR+f,'utf8'),ctx));
  ctx.COS=cos; ctx.MOD=MODELO;
  vm.runInContext("hojaCosteo_=function(){return COS;}; construirModelo_=function(){return MOD;};",ctx);
  const res=vm.runInContext("(function(){var r={grupos:[]}; PRUEBAS_MODELO_=null; prSyncPrecios_(r); return r;})()",ctx);
  const todas=res.grupos[0].pruebas;
  return todas.filter(p=>p.nombre.indexOf('indice insumo-receta')!==-1)[0];
}

let fallas=0; const ok=(q,r,e)=>{const b=JSON.stringify(r)===JSON.stringify(e); if(!b)fallas++;
 console.log((b?'  OK   ':'  FALLA')+'  '+q+(b?'':`   esperado ${JSON.stringify(e)}, dio ${JSON.stringify(r)}`));};

console.log('\n=== 1. como esta HOY: indice solo con cocina ===');
let p=correr([['sal','x','COCINA','r1','plato',1,'g',1],['ajo','x','COCINA','r2','plato',1,'g',1]]);
ok('lo detecta como FALLA', p.estado, 'FALLA');
ok('nombra el area que falta', /NO tiene nada de: BARRA/.test(p.detalle), true);
ok('dice que hacer', /REGENERAR_INDICE/.test(p.detalle), true);

console.log('\n=== 2. despues de regenerarlo: las dos areas ===');
p=correr([['sal','x','COCINA','r1','plato',1,'g',1],['ajo','x','COCINA','r2','plato',1,'g',1],
          ['limon','x','BARRA','c1','coctel',1,'unidad',1]]);
ok('pasa', p.estado, 'OK');
ok('muestra el detalle por area', /COCINA: 2 .*BARRA: 1 /.test(p.detalle), true);

console.log('\n=== 3. indice vacio: saltada, no falla ===');
p=correr([]);
ok('saltada', p.estado, 'SALTADA');
ok('dice que correr', /REGENERAR_INDICE/.test(p.detalle), true);

console.log('\n'+(fallas?'FALLAS: '+fallas:'TODO OK')+'\n');
process.exit(fallas?1:0);
