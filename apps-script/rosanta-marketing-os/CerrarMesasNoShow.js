/**
 * ROSANTA MARKETING OS · CERRAR MESAS PASADAS QUE SIGUEN EN RESERVED
 *
 * Decision de Juanma (28-sep-2026): las reservas ya pasadas que siguen en RESERVED
 * se cierran como NO_SHOW. No hay forma de saber si esas mesas vinieron, y FINISHED
 * NO sirve: dispara el correo de resena de TripAdvisor (backend/events.js), que no se
 * puede mandar sin saber si el cliente visito. NO_SHOW no dispara nada en nuestro
 * codigo; CANCELED se descarto porque Wix puede mandar correo de cancelacion al cliente.
 *
 * SEATED NO se toca: por la regla del 23-sep (p163) Seated es el estado final de una
 * mesa que vino, con su consumo anotado. Por eso el Verificador (chequeo 4) ya solo
 * cuenta RESERVED como mesa abierta.
 *
 * Lee directo de Wix (no de la pestana `reservas`), asi que usa el `revision` vigente.
 * Al cambiar el estado, el webhook de Wix actualiza solo la pestana `reservas` y el CRM
 * (la reserva queda como "Reserva historica", sin evidencia de visita).
 *
 * COMO SE CORRE (editor del proyecto Rosanta Marketing OS)
 *   1. revisarMesasNoShow()  no escribe. Lista las reservas que cambiaria.
 *   2. cerrarMesasNoShow()   las pasa a NO_SHOW y dice cuantas cambio y cuales fallaron.
 * Se puede correr dos veces: la segunda ya no encuentra nada en RESERVED.
 */

var MNS_GRACIA_DIAS = 3;     // igual que VC_MESA_GRACIA: lo de los ultimos 3 dias no se toca
var MNS_TOPE        = 120;   // freno: si aparecen mas que esto, algo raro pasa y no escribe

function _mnsPendientes_() {
  var cred = wixCredenciales_();
  if (!cred.apiKey || !cred.siteId) throw new Error('Faltan WIX_API_KEY / WIX_SITE_ID en Propiedades del script.');

  var corte = new Date(Date.now() - MNS_GRACIA_DIAS * 86400000);
  var hasta = Utilities.formatDate(corte, 'UTC', "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'");
  var url = 'https://www.wixapis.com/table-reservations/reservations/v1/reservations/query';
  var out = [], offset = 0, limit = 100, guard = 0;

  while (guard++ < 50) {
    var res = wixFetch_(url, {
      method: 'post',
      contentType: 'application/json',
      headers: { 'Authorization': cred.apiKey, 'wix-site-id': cred.siteId },
      payload: JSON.stringify({ query: {
        filter: { '$and': [ { status: 'RESERVED' }, { 'details.startDate': { '$lt': hasta } } ] },
        paging: { limit: limit, offset: offset }
      } }),
      muteHttpExceptions: true
    });
    var lote = JSON.parse(res.getContentText()).reservations || [];
    lote.forEach(function (r) {
      // doble guarda: aunque el filtro de Wix falle, solo pasan RESERVED ya vencidas
      var inicio = new Date((r.details && r.details.startDate) || 0);
      if (r.status === 'RESERVED' && inicio < corte && !r.archived) out.push(r);
    });
    if (lote.length < limit) break;
    offset += limit;
  }
  out.sort(function (a, b) { return String(a.details.startDate).localeCompare(String(b.details.startDate)); });
  return { lista: out, cred: cred, corte: corte };
}

function _mnsLinea_(r) {
  var d = Utilities.formatDate(new Date(r.details.startDate), 'America/Guatemala', 'yyyy-MM-dd HH:mm');
  var nombre = ((r.reservee && r.reservee.firstName) || '(sin nombre)');
  return d + ' · ' + nombre + ' · ' + ((r.details && r.details.partySize) || '?') + ' pax · ' + (r.id || r._id);
}

function revisarMesasNoShow() {
  var p = _mnsPendientes_();
  console.log('REVISION, no se escribe nada. Corte: antes del ' +
              Utilities.formatDate(p.corte, 'America/Guatemala', 'yyyy-MM-dd HH:mm'));
  p.lista.forEach(function (r) { console.log('  ' + _mnsLinea_(r)); });
  console.log('Pasarian a NO_SHOW: ' + p.lista.length + (p.lista.length > MNS_TOPE ? '  >> SOBRE EL TOPE, no se cargaria' : ''));
}

function cerrarMesasNoShow() {
  var p = _mnsPendientes_();
  if (p.lista.length > MNS_TOPE) {
    console.log('NO se escribio nada: ' + p.lista.length + ' reservas superan el tope de ' + MNS_TOPE + '. Revisar primero.');
    return;
  }
  var ok = 0, fallas = [];
  p.lista.forEach(function (r) {
    var id = r.id || r._id;
    try {
      var res = UrlFetchApp.fetch('https://www.wixapis.com/table-reservations/reservations/v1/reservations/' + id, {
        method: 'patch',
        contentType: 'application/json',
        headers: { 'Authorization': p.cred.apiKey, 'wix-site-id': p.cred.siteId },
        payload: JSON.stringify({ reservation: { id: id, revision: String(r.revision), status: 'NO_SHOW' } }),
        muteHttpExceptions: true
      });
      var code = res.getResponseCode();
      var nuevo = code === 200 ? ((JSON.parse(res.getContentText()).reservation || {}).status) : '';
      if (code === 200 && nuevo === 'NO_SHOW') ok++;
      else fallas.push(_mnsLinea_(r) + ' · HTTP ' + code + ' ' + (nuevo || res.getContentText().slice(0, 160)));
    } catch (e) {
      fallas.push(_mnsLinea_(r) + ' · ' + e.message);
    }
    Utilities.sleep(250);
  });
  console.log('Pasadas a NO_SHOW: ' + ok + ' de ' + p.lista.length + '.');
  if (fallas.length) { console.log('FALLARON ' + fallas.length + ':'); fallas.forEach(function (f) { console.log('  ' + f); }); }

  // releer: lo que quede en RESERVED vencido es lo que no se cerro
  var queda = _mnsPendientes_().lista.length;
  console.log(queda ? ('>> Siguen en RESERVED ' + queda + '. Revisar las fallas.') : 'OK: no queda ninguna mesa pasada en RESERVED.');
}
