/** UNA SOLA VEZ (15-oct-2026): prueba que la consola lea la etapa del pipeline en Marketing OS. Solo lectura. */
function probarEtapaPipeline() {
  var filas = pipelineFilas_();
  console.log('Filas con etapa en cotizaciones: ' + filas.length);
  filas.slice(0, 6).forEach(function (r) {
    console.log((r.email || r.telefono || r.id_chat || '(sin contacto)').substring(0, 6) + '… → ' +
      etapaPipeline_(r.id_chat, r.email, r.telefono));
  });
}
