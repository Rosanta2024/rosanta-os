// ============================================================================
// EL REPORTE SEMANAL POR CORREO A LOS SUPERVISORES (28-sep-2026, decision de Juanma)
// ============================================================================
/*
 * El PDF oficial (Reportes 2026 / SXX / Rosanta_SXX_AAAA.pdf, lo genera la tarea del
 * lunes) sale por correo a los supervisores de Cocina y de Barra y Sala, con copia a
 * Juanma, el MARTES A LAS 12:00. No depende de que Juanma termine el lunes:
 *   - en el cuerpo van las acciones de la semana en curso: las aprobadas como acuerdos
 *     y las sugeridas como "Propuesta · por confirmar con Juanma" (las descartadas no);
 *   - si a esa hora el PDF no esta, sale un aviso de atraso y el reporte se manda solo
 *     en cuanto aparezca en su carpeta (cualquier hora hasta el domingo);
 *   - el boton "Enviar a supervisores" del reporte en la intranet lo manda antes.
 * Lo corre vigiaCadaHora. Una sola vez por semana: propiedad REP_CORREO_<clave>.
 */
var REP_CORREO_DEPTOS_ = ['Cocina', 'Barra', 'Sala'];     // los supervisores que lo reciben

function _repCorreoNombrePdf_(clave) {
  var w = clave % 100;
  return 'Rosanta_S' + (w < 10 ? '0' : '') + w + '_' + Math.floor(clave / 100) + '.pdf';
}

/** El PDF oficial de la semana, o null. No crea la carpeta si no existe. */
function _repCorreoPdf_(clave) {
  var w = clave % 100, nombre = 'S' + (w < 10 ? '0' : '') + w;
  var carpetas = drivesListar_("'" + REP_PDF.carpeta + "' in parents and name = '" + nombre +
                               "' and mimeType = 'application/vnd.google-apps.folder' and trashed = false");
  if (!carpetas.length) return null;
  var pdfs = drivesListar_("'" + carpetas[0].id + "' in parents and name = '" + _repCorreoNombrePdf_(clave) + "' and trashed = false");
  return pdfs.length ? DriveApp.getFileById(pdfs[0].id) : null;
}

/** A quien va: los destinos del vigia que son duenos de Cocina, Barra o Sala. */
function _repCorreoDestinos_() {
  var nombres = {};
  REP_CORREO_DEPTOS_.forEach(function (d) { nombres[MED_DEPTO_A_PERSONA_[d]] = true; });
  return vigiaDestinos_().filter(function (x) { return nombres[x.nombre] && x.correo; });
}

/** Las acciones de la semana en curso (la siguiente al reporte) de esos supervisores. */
function _repCorreoAcciones_(clave) {
  var lunes = _finLunesDeClave_(clave);
  var sem = medSemanaClave_(new Date(lunes.getFullYear(), lunes.getMonth(), lunes.getDate() + 7));
  var sh = SpreadsheetApp.openById(getSheetId_('CONFIG_SHEET_ID')).getSheetByName(MED_ACC_HOJA_);
  var out = { semana: sem, acordadas: [], propuestas: [] };
  if (!sh || sh.getLastRow() < 2) return out;
  var v = sh.getDataRange().getValues(), head = v[0].map(String), iM = head.indexOf('META'), iP = head.indexOf('PORQUE');
  var duenos = {};
  REP_CORREO_DEPTOS_.forEach(function (d) { duenos[MED_DEPTO_A_PERSONA_[d]] = true; });
  for (var i = 1; i < v.length; i++) {
    if (String(v[i][0]) !== sem || !duenos[String(v[i][3])]) continue;
    var est = String(v[i][5] || '');
    if (est === 'descartada') continue;
    var a = { accion: String(v[i][2] || ''), depto: medDeptoDe_(v[i][3], v[i][1]),
              meta: iM >= 0 ? String(v[i][iM] || '') : '', porque: iP >= 0 ? String(v[i][iP] || '') : '' };
    (est === 'sugerida' ? out.propuestas : out.acordadas).push(a);
  }
  return out;
}

/* Las acciones van en un bloque por supervisor (29-sep-2026, Juanma: "si lees de prisa, te
   puedes perder"): Cocina · Jeffry y Barra y Sala · José. Cada accion en su linea, con la
   meta, el porque y el compromiso debajo. PuenteReporte pega el compromiso al PORQUE con
   REP_CORREO_SEP_COMPROMISO_; aqui se vuelve a separar. */
var REP_CORREO_BLOQUES_ = [
  { titulo: 'COCINA · Jeffry', deptos: ['Cocina'], color: '#4E6D5A' },
  { titulo: 'BARRA Y SALA · José', deptos: ['Barra', 'Sala'], color: '#7A74C9' }
];
var REP_CORREO_SEP_COMPROMISO_ = ' · Compromiso de la semana: ';

function _repCorreoPartes_(a) {
  var porque = a.porque || '', compromiso = '', k = porque.indexOf(REP_CORREO_SEP_COMPROMISO_);
  if (k >= 0) { compromiso = porque.slice(k + REP_CORREO_SEP_COMPROMISO_.length); porque = porque.slice(0, k); }
  var p = [];
  if (a.meta) p.push(['Meta', a.meta]);
  if (porque) p.push(['Por qué', porque]);
  if (compromiso) p.push(['Compromiso', compromiso]);
  return p;
}

function _repCorreoMensaje_(clave, ac) {
  var w = clave % 100, L = [], H = [];
  function esc(s) { return String(s).replace(/[&<>]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]; }); }
  var intro = 'Hola, va el reporte de la semana ' + w + ' en el PDF adjunto. Lo revisamos en la reunión.';
  L.push(intro, '');
  H.push('<p style="margin:0 0 18px">' + esc(intro) + '</p>');

  function lista(titulo, acciones, dosDeptos) {
    L.push(titulo);
    H.push('<p style="margin:10px 0 4px;font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:#555">' + esc(titulo) + '</p><ol style="margin:0 0 8px;padding-left:22px">');
    acciones.forEach(function (a, i) {
      var etiqueta = dosDeptos ? '[' + a.depto + '] ' : '';
      L.push((i + 1) + '. ' + etiqueta + a.accion);
      var partes = _repCorreoPartes_(a);
      partes.forEach(function (p) { L.push('   ' + p[0] + ': ' + p[1]); });
      H.push('<li style="margin:0 0 10px"><b>' + (etiqueta ? esc(etiqueta) : '') + esc(a.accion) + '</b>' +
             partes.map(function (p) { return '<br><span style="color:#555">' + esc(p[0]) + ':</span> ' + esc(p[1]); }).join('') + '</li>');
    });
    L.push('');
    H.push('</ol>');
  }

  var hay = false;
  REP_CORREO_BLOQUES_.forEach(function (b) {
    function del(x) { return b.deptos.indexOf(x.depto) >= 0; }
    var acor = ac.acordadas.filter(del), prop = ac.propuestas.filter(del);
    if (!acor.length && !prop.length) return;
    hay = true;
    var dos = b.deptos.length > 1;
    L.push('==============================', b.titulo, '==============================');
    H.push('<h2 style="margin:26px 0 6px;padding-bottom:4px;font-size:18px;color:' + b.color + ';border-bottom:3px solid ' + b.color + '">' + esc(b.titulo) + '</h2>');
    if (acor.length) lista('Acordadas para esta semana', acor, dos);
    if (prop.length) lista('Propuesta · por confirmar con Juanma', prop, dos);
  });
  if (!hay) {
    L.push('Las acciones de la semana se definen en la reunión.', '');
    H.push('<p>Las acciones de la semana se definen en la reunión.</p>');
  }
  var cierre = 'La página 6 del PDF trae las acciones propuestas y cómo nos fue con las de la semana pasada.';
  L.push(cierre);
  H.push('<p style="margin:22px 0 0;color:#555">' + esc(cierre) + '</p>');
  return { asunto: 'Rosanta · Reporte semanal S' + w, texto: L.join('\n'),
           html: '<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.5;color:#1a1a1a;max-width:680px">' + H.join('') + '</div>' };
}

/** Manda el PDF de la semana `clave`. quien: 'martes' | 'boton'. */
function _repCorreoEnviar_(clave, quien) {
  var pdf = _repCorreoPdf_(clave);
  if (!pdf) return { ok: false, detalle: 'No está ' + _repCorreoNombrePdf_(clave) + ' en Reportes 2026 / S' + (clave % 100) + '.' };
  var destinos = _repCorreoDestinos_();
  if (!destinos.length) return { ok: false, detalle: 'VIGIA_DESTINOS no tiene correo para los supervisores de Cocina, Barra o Sala.' };
  var msg = _repCorreoMensaje_(clave, _repCorreoAcciones_(clave));
  MailApp.sendEmail({ to: destinos.map(function (x) { return x.correo; }).join(','), cc: DUENO_CORREO_,
                      subject: msg.asunto, body: msg.texto, htmlBody: msg.html, name: 'Rosanta · Reporte semanal',
                      attachments: [pdf.getBlob()] });
  var cuando = Utilities.formatDate(new Date(), VIG_TZ_, 'yyyy-MM-dd HH:mm');
  PropertiesService.getScriptProperties().setProperty('REP_CORREO_' + clave, cuando + ' · ' + quien);
  destinos.forEach(function (x) { _vigLog_(x, 'reporte', { ok: true, detalle: 'reporte S' + (clave % 100) + ' (' + quien + ')' }, msg); });
  return { ok: true, detalle: 'Enviado a ' + destinos.map(function (x) { return x.nombre; }).join(' y ') + ' con copia a Juanma.', enviado: cuando };
}

/** Lo llama vigiaCadaHora. Martes 12:00 en adelante (hasta el domingo) de la semana cerrada. */
function repCorreoCadaHora_(hoy) {
  var dia = _vigDia_(hoy);
  if (dia === 1 || (dia === 2 && hoy.getHours() < 12)) return 'Reporte por correo: todavía no toca.';
  var clave = _finClaveSemana_(new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - 7));
  var p = PropertiesService.getScriptProperties();
  if (p.getProperty('REP_CORREO_' + clave)) return 'Reporte por correo: S' + (clave % 100) + ' ya se envió.';
  var r = _repCorreoEnviar_(clave, 'martes');
  if (r.ok) return 'Reporte por correo: ' + r.detalle;
  if (!p.getProperty('REP_CORREO_AVISO_' + clave)) {
    var destinos = _repCorreoDestinos_(), w = clave % 100;
    var msg = { asunto: 'Rosanta · Reporte semanal S' + w + ' (se atrasa)',
                texto: 'Hola, el reporte de la semana ' + w + ' todavía no está listo. Te llega por este mismo correo en cuanto esté.' };
    if (destinos.length) MailApp.sendEmail({ to: destinos.map(function (x) { return x.correo; }).join(','), cc: DUENO_CORREO_,
                                             subject: msg.asunto, body: msg.texto, name: 'Rosanta · Reporte semanal' });
    p.setProperty('REP_CORREO_AVISO_' + clave, Utilities.formatDate(new Date(), VIG_TZ_, 'yyyy-MM-dd HH:mm'));
    destinos.forEach(function (x) { _vigLog_(x, 'reporte', { ok: false, detalle: 'aviso de atraso S' + w + ': ' + r.detalle }, msg); });
  }
  return 'Reporte por correo: ' + r.detalle;
}

/** Boton "Enviar a supervisores" del reporte en la intranet. Solo el dueño. */
function enviarReporteSupervisores(auth, clave, reenviar) {
  var u = exigirModulo_(auth, 'finanzas');
  invExigirDueno_(u);
  clave = Number(clave);
  if (!clave) throw new Error('Falta la semana.');
  var ya = PropertiesService.getScriptProperties().getProperty('REP_CORREO_' + clave);
  if (ya && !reenviar) return { ok: false, ya_enviado: ya, detalle: 'La S' + (clave % 100) + ' ya se envió (' + ya + ').' };
  return _repCorreoEnviar_(clave, 'boton');
}
