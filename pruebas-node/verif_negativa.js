// Simula las regresiones y confirma que las pruebas las cazan.
const fs=require('fs'), vm=require('vm');
const DIR=process.env.HOME+'/Dev/Rosanta/apps-script/rosanta-intranet/';
function cargar(mutar){
  const ctx={console,Logger:{log(){}},CacheService:{getScriptCache:()=>({remove(){}})},
    PropertiesService:{getScriptProperties:()=>({getProperty:()=>'x',setProperty(){}})},
    SpreadsheetApp:{openById:()=>null},MimeType:{GOOGLE_SHEETS:'x'},
    Session:{getActiveUser:()=>({getEmail:()=>'t@r'})},Utilities:{formatDate:d=>String(d)}};
  vm.createContext(ctx);
  ['ConfigCosteo.js','EdicionRecetario.js','SincronizarPrecios.js','SemaforoPrecios.js',
   'LectorBitacora.js','Proveedores.js'].forEach(f=>{
    let s=fs.readFileSync(DIR+f,'utf8'); if(mutar) s=mutar(f,s);
    vm.runInContext(s,ctx);
  });
  return n=>vm.runInContext(n,ctx);
}
const CAM=['registrarPrecio','cambiarPrecioInsumo','aplicarSincronizacion','revertirSync_'];
const mudos=F=>F(`(${JSON.stringify(CAM)}).filter(function(n){var fn=globalThis[n];
  if(typeof fn!=='function')return true; return String(fn).indexOf('bitacora')===-1;})`);
const permiso=F=>F("String(registrarPrecio).indexOf('exigirPermiso_')!==-1");

let fallas=0;
const ok=(q,r,e)=>{const b=JSON.stringify(r)===JSON.stringify(e); if(!b)fallas++;
  console.log((b?'  OK   ':'  FALLA')+'  '+q+(b?'':`   esperado ${JSON.stringify(e)}, dio ${JSON.stringify(r)}`));};

console.log('\n=== si alguien saca el exigirPermiso_ de registrarPrecio ===');
const sinPermiso=cargar((f,s)=> f==='Proveedores.js'
  ? s.replace("exigirPermiso_(usuario && usuario.rol, 'cambiarPrecio');","")
  : s);
ok('la prueba lo caza', permiso(sinPermiso), false);

console.log('\n=== si alguien saca el bitacora_ de un camino que escribe precios ===');
const sinRastro=cargar((f,s)=> f==='Proveedores.js'
  ? s.replace(/bitacora_\(quien,[\s\S]*?\)\);/, '')
  : s);
ok('la prueba lo caza y nombra al culpable', mudos(sinRastro), ['registrarPrecio']);

console.log('\n=== con el codigo real, las dos pasan ===');
const real=cargar(null);
ok('permiso presente', permiso(real), true);
ok('ningun camino mudo', mudos(real), []);

console.log('\n'+(fallas?'FALLAS: '+fallas:'TODO OK')+'\n');
process.exit(fallas?1:0);
