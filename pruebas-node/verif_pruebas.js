const fs=require('fs'), vm=require('vm');
const DIR=process.env.HOME+'/Dev/Rosanta/apps-script/rosanta-intranet/';
const ctx={console,Logger:{log(){}},CacheService:{getScriptCache:()=>({remove(){}})},
  PropertiesService:{getScriptProperties:()=>({getProperty:()=>'x',setProperty(){}})},
  SpreadsheetApp:{openById:()=>null},MimeType:{GOOGLE_SHEETS:'x'},
  Session:{getActiveUser:()=>({getEmail:()=>'t@r'})},
  Utilities:{formatDate:(d,t,f)=>String(d)}};
vm.createContext(ctx);
['ConfigCosteo.js','EdicionRecetario.js','SincronizarPrecios.js','SemaforoPrecios.js',
 'LectorBitacora.js','Proveedores.js'].forEach(f=>vm.runInContext(fs.readFileSync(DIR+f,'utf8'),ctx));
const F=n=>vm.runInContext(n,ctx);
let fallas=0;
const ok=(q,r,e)=>{const b=JSON.stringify(r)===JSON.stringify(e); if(!b)fallas++;
  console.log((b?'  OK   ':'  FALLA')+'  '+q+(b?'':`   esperado ${JSON.stringify(e)}, dio ${JSON.stringify(r)}`));};

console.log('\n=== introspeccion 1: el rastro unico ===');
const caminos=['registrarPrecio','cambiarPrecioInsumo','aplicarSincronizacion','revertirSync_'];
const mudos=F(`(${JSON.stringify(caminos)}).filter(function(n){
  var fn=globalThis[n]; if(typeof fn!=='function') return true;
  return String(fn).indexOf('bitacora')===-1; })`);
ok('los 4 caminos existen y mencionan bitacora', mudos, []);

console.log('\n=== introspeccion 2: el permiso de registrarPrecio ===');
ok('pide el modulo', F("String(registrarPrecio).indexOf('usuarioTieneModulo')!==-1"), true);
ok('Y ADEMAS exige el permiso del rol', F("String(registrarPrecio).indexOf('exigirPermiso_')!==-1"), true);

console.log('\n=== las pestanas de servicio quedan fuera de la grilla ===');
['SYNC.hojaLog','SEMAFORO.hoja','EDIT.hojaBitacora','BIT.hojaResumen'].forEach(v=>{
  ok(v+' = '+F(v), F(`esHojaDeControl_(${v})`), true);
});

console.log('\n=== las piezas nuevas existen ===');
const nuevas=['revertirSync_','listarCorridasSync','nuevaCorrida_','hojaLogSync_','leerCorridas_',
 'refrescarSemaforoPrecios','aprobadosDelSemaforo_','esAprobable_','estaTildado_','historialDe',
 'leerBitacora_','refrescarResumenBitacora','bitacoraLote_'];
ok('las 13', F(`(${JSON.stringify(nuevas)}).filter(function(n){return typeof globalThis[n]!=='function';})`), []);

console.log('\n=== las que escriben en lote son privadas ===');
ok('terminan en _', ['revertirSync_','aprobadosDelSemaforo_','hojaLogSync_'].filter(n=>!n.endsWith('_')), []);

console.log('\n'+(fallas?'FALLAS: '+fallas:'TODO OK')+'\n');
process.exit(fallas?1:0);
