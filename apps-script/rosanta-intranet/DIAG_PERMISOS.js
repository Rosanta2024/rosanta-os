/**
 * DIAG_PERMISOS.gs — De un solo uso. Borrar cuando se resuelva.
 *
 * La tarjeta "Nueva receta" no aparece. Puede ser porque el codigo no llego al
 * proyecto, o porque el servidor dice que este rol no puede crear fichas.
 *
 * TODO EL RESULTADO SALE EN UNA SOLA LINEA, LA PRIMERA. La version anterior lo
 * repartia en cinco secciones y el log llego cortado: faltaban lineas en el medio
 * y no se podia concluir nada. Un diagnostico que se puede perder a la mitad no
 * sirve de diagnostico.
 *
 * NO ESCRIBE NADA.
 */
function DIAG_PERMISOS() {
  var p = [];

  function hay(n) { return typeof globalThis[n] === 'function' ? 'si' : 'NO'; }
  p.push('crearFicha=' + hay('crearFicha'));
  p.push('webCrearFicha=' + hay('webCrearFicha'));
  p.push('webEstadoEdicion=' + hay('webEstadoEdicion'));

  var u = null;
  try { u = resolverUsuario_(''); } catch (e) { p.push('resolverUsuario_ REVIENTA: ' + e.message); }
  p.push('yo=' + (u ? (u.email + '/' + u.rol) : 'NULL'));
  p.push('modulos=' + (u ? (u.modulos || []).join('+') : '-'));

  var enTabla = '-';
  try {
    enTabla = (typeof EDIT !== 'undefined' && EDIT.permisos && u && EDIT.permisos[normalizar_(u.rol)])
      ? (EDIT.permisos[normalizar_(u.rol)].indexOf('crearFicha') >= 0 ? 'si' : 'no')
      : 'ROL_NO_ESTA';
  } catch (e) { enTabla = 'ERROR'; }
  p.push('rolTieneCrearFicha=' + enTabla);

  var dice = '-';
  try {
    var r = webEstadoEdicion('');
    dice = (r && r.ok && r.resultado && r.resultado.puede)
      ? String(r.resultado.puede.crearFicha)
      : ('NO_OK:' + (r && r.error ? r.error : JSON.stringify(r)));
  } catch (e) { dice = 'REVIENTA:' + e.message; }
  p.push('LA_PAGINA_RECIBE_crearFicha=' + dice);

  var linea = p.join(' | ');
  Logger.log('>>> ' + linea);
  Logger.log('>>> ' + linea);   // dos veces: si el log se corta arriba o abajo, queda una
  return linea;
}
