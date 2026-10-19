/**
 * Pantallas de la sombra 2 (17-oct-2026): Caja chica, Compras en efectivo y Clientes › Eventos.
 *
 * Son las MISMAS pantallas de la intranet, copiadas tal cual en cloud/app/intranet/
 * (ProfitCajaJs.html, ProfitComprasJs.html, EventosVista.html), con el mismo traductor de
 * google.script.run que usa Pagos (pantalla-pagos.js): la llamada se convierte en un POST
 * /api/llamar/<funcion> a este servidor. Caja y Compras usan los estilos .pg de Pagos, por eso se
 * pega tambien ProfitPagosJs.html (solo se usan sus estilos; PF_PAGOS no se llama).
 */
const fs = require('fs');
const path = require('path');
const P = require('../pantalla-pagos');

const DIR = path.join(__dirname, '..', '..', 'intranet');
const leer = (f) => fs.readFileSync(path.join(DIR, f), 'utf8');

const AVISO = '<div class="nb-aviso"><b>Prueba en sombra.</b> Esta pantalla es la del servidor nuevo y por ahora <b>solo muestra</b>: ' +
  'todo se sigue anotando en la intranet de siempre.</div>';

/** Caja chica o Compras: titulo, la funcion PF_* y su parcial. */
function armarProfit(titulo, parcial, funcion, clase) {
  return '<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<title>' + titulo + ' · Rosanta</title>' + P.paleta() +
    '<style>body{margin:0;background:var(--fondo);color:var(--texto);font-family:var(--rosanta-font-body)}' +
    '.nb-top{display:flex;align-items:baseline;gap:12px;padding:14px 16px;background:var(--superficie);border-bottom:1px solid var(--linea)}' +
    '.nb-top h1{font-family:var(--rosanta-font-title);font-size:1.3rem;margin:0}.nb-top small{color:var(--texto-suave)}' +
    'main{max-width:1100px;margin:0 auto;padding:16px}' +
    '.nb-aviso{background:var(--rosanta-lila-tint);border-radius:12px;padding:10px 14px;margin-bottom:12px;font-size:.9rem}</style>' +
    '</head><body><header class="nb-top"><h1>' + titulo + '</h1><small>servidor nuevo · Querétaro</small></header><main>' + AVISO +
    '<div class="pg"><h2>' + titulo + '</h2></div><div class="' + clase + '" id="pf-host"></div></main>' +
    leer('GuardadoEstado.html') +
    '<script>' + P.TRADUCTOR + '\nwindow.AUTH = new URLSearchParams(location.search).get("u") || "";\n' + P.pfError() + '</script>' +
    leer('ProfitPagosJs.html') + leer(parcial) +
    '<script>' + funcion + '(document.getElementById("pf-host"), window.AUTH);</script>' +
    '</body></html>';
}

function armarCaja() { return armarProfit('Caja chica', 'ProfitCajaJs.html', 'PF_CAJA', 'cj-host'); }
function armarCompras() { return armarProfit('Compras en efectivo', 'ProfitComprasJs.html', 'PF_COMPRAS', 'ce-host'); }

/** Un token ?u= solo con caracteres de enlace; si no, vacio (va crudo en algunas plantillas). */
function tokenLimpio(t) { t = String(t || ''); return /^[A-Za-z0-9_-]{8,200}$/.test(t) ? t : ''; }

/** Las variables que render_ de la intranet le da a una vista, para quien entra. */
function varsVista(o) {
  const u = o.usuario;
  return {
    usuario: { email: u.email, rol: u.rol, nombre: u.nombre, modulos: u.modulos || [], puedeEditar: false },   // sombra: no edita
    urlBase: '/clientes', authToken: tokenLimpio(o.authToken), consolaUrl: o.consolaUrl || '',
    paletaCss_: () => P.paleta(), include: (n) => leer(n + '.html'),
    rolSinAcento_: (r) => String(r || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
  };
}

/** Pega la barra de Clientes, el traductor y el aviso de sombra despues del unico <body>. */
function conBarra(h, parte, aviso, archivo) {
  if (h.split('<body>').length !== 2) throw new Error(archivo + ' cambio de forma: no encontre una sola vez <body>');
  return h.replace('<body>', () => '<body>' + NAV(parte) + '<script>' + P.TRADUCTOR + '</script>' +
    '<style>.nb-aviso{background:var(--rosanta-lila-tint);border-radius:12px;padding:10px 14px;margin:12px auto;max-width:1100px;font-size:.9rem}</style>' +
    '<div class="nb-aviso">' + aviso + '</div>');
}

/**
 * Clientes › Eventos: EventosVista.html real, armada como la arma render_ de la intranet (con la
 * plantilla evaluada para quien entra: desde la @212 la vista cambia segun el rol).
 */
function armarEventos(o) {
  return conBarra(plantilla(leer('EventosVista.html'), varsVista(o)), 'eventos',
    '<b>Prueba en sombra · Clientes › Eventos.</b> Esta pantalla es la del servidor nuevo y por ahora <b>solo muestra</b>: ' +
    'los cambios del pipeline se siguen haciendo en la intranet de siempre.', 'EventosVista.html');
}

// ---------------------------------------------------------------- Clientes (18-oct-2026)

/**
 * La barra de la seccion Clientes. Muestra solo las partes que la matriz deja ver a esa persona
 * (/api/clientes/partes) y conserva el enlace ?u= al cambiar de pestaña.
 */
function NAV(activa) {
  const nombres = { eventos: 'Eventos', crm: 'CRM', reservas: 'Reservas', carritos: 'Carritos' };
  return '<style>.cl-nav{display:flex;flex-wrap:wrap;gap:6px;align-items:center;padding:10px 16px;background:var(--superficie);border-bottom:1px solid var(--linea);font-family:var(--rosanta-font-body)}' +
    '.cl-nav b{font-family:var(--rosanta-font-title);margin-right:8px}.cl-nav a{padding:8px 12px;border-radius:999px;text-decoration:none;color:var(--texto);min-height:28px}' +
    '.cl-nav a.on{background:var(--rosanta-lila-tint);font-weight:700}.cl-nav small{margin-left:auto;color:var(--texto-suave)}</style>' +
    '<nav class="cl-nav" id="cl-nav"><b>Clientes</b><small>servidor nuevo · sombra</small></nav><script>(function(){' +
    'var u=new URLSearchParams(location.search).get("u")||"",n=' + JSON.stringify(nombres) + ',act=' + JSON.stringify(activa) + ';' +
    'fetch("/api/clientes/partes",{headers:{"x-rosanta-u":u}}).then(function(r){return r.json()}).then(function(j){var nav=document.getElementById("cl-nav"),fin=nav.lastChild;' +
    '(j.partes||[]).forEach(function(p){var a=document.createElement("a");a.href="/clientes/"+p+"?u="+encodeURIComponent(u);a.textContent=n[p]||p;if(p===act)a.className="on";nav.insertBefore(a,fin)})})})();</script>';
}

/**
 * Plantilla de Apps Script (<? ?>, <?= ?> escapado, <?!= ?> crudo) evaluada en Node, para las
 * vistas que traen logica de plantilla (CrmVista.html). Igual que HtmlService: lo que no esta en
 * vars no existe.
 */
function plantilla(texto, vars) {
  const esc = (x) => String(x == null ? '' : x).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  let codigo = 'var __o=[];\n', ult = 0;
  const re = /<\?(!=|=)?([\s\S]*?)\?>/g;
  let m;
  while ((m = re.exec(texto))) {
    codigo += '__o.push(' + JSON.stringify(texto.slice(ult, m.index)) + ');\n';
    if (m[1] === '=') codigo += '__o.push(__esc(' + m[2] + '));\n';
    else if (m[1] === '!=') codigo += '__o.push(String(' + m[2] + '));\n';
    else codigo += m[2] + '\n';
    ult = re.lastIndex;
  }
  codigo += '__o.push(' + JSON.stringify(texto.slice(ult)) + ');\nreturn __o.join("");';
  const nombres = Object.keys(vars);
  return new Function(...nombres, '__esc', codigo)(...nombres.map((k) => vars[k]), esc);   // eslint-disable-line no-new-func
}

/** Clientes › CRM: CrmVista.html real, con las variables que le da la intranet (render_). */
function armarCrm(o) {
  return conBarra(plantilla(leer('CrmVista.html'), varsVista(o)), 'crm',
    '<b>Prueba en sombra · Clientes › CRM.</b> Solo muestra. Importar contactos se sigue haciendo en la intranet de siempre.', 'CrmVista.html');
}

/** Pagina simple de Clientes (Reservas, Carritos): tabla de solo lectura con filtro. */
function paginaTabla(titulo, parte, funcion, columnas, texto) {
  return '<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<title>' + titulo + ' · Clientes · Rosanta</title>' + P.paleta() +
    '<style>body{margin:0;background:var(--fondo);color:var(--texto);font-family:var(--rosanta-font-body)}main{max-width:1100px;margin:0 auto;padding:16px}' +
    'h1{font-family:var(--rosanta-font-title);font-size:1.4rem;margin:.4rem 0}p{line-height:1.5}.nb-aviso{background:var(--rosanta-lila-tint);border-radius:12px;padding:10px 14px;margin-bottom:12px;font-size:.9rem}' +
    'input{font-size:16px;padding:10px 12px;border:1px solid var(--linea);border-radius:10px;width:100%;max-width:360px;box-sizing:border-box;background:var(--superficie);color:var(--texto)}' +
    '.envolver{overflow-x:auto;margin-top:12px}table{width:100%;border-collapse:collapse;background:var(--superficie);border-radius:12px;overflow:hidden}' +
    'th,td{padding:10px 8px;border-bottom:1px solid var(--linea);text-align:left;font-size:.9rem;vertical-align:top}th{font-family:var(--rosanta-font-label);font-size:.7rem;text-transform:uppercase;letter-spacing:.05em;color:var(--texto-suave)}' +
    '.n{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}small{color:var(--texto-suave)}.err{color:var(--mal)}</style></head><body>' + NAV(parte) +
    '<main><h1>' + titulo + '</h1><div class="nb-aviso"><b>Prueba en sombra.</b> ' + texto + '</div>' +
    '<input id="q" type="search" placeholder="Buscar por nombre, teléfono, correo o estado" aria-label="Buscar">' +
    '<p id="res"><small>Leyendo…</small></p><div class="envolver"><table><thead><tr>' +
    columnas.map((c) => '<th' + (c.n ? ' class="n"' : '') + '>' + c.t + '</th>').join('') + '</tr></thead><tbody id="f"></tbody></table></div></main><script>' +
    'function esc(x){return String(x==null?"":x).replace(/[&<>"\x27]/g,function(c){return "&#"+c.charCodeAt(0)+";"})}' +
    'var COLS=' + JSON.stringify(columnas) + ',D=[],u=new URLSearchParams(location.search).get("u")||"";' +
    'function fmt(c,v){if(c.q)return v==null||v===""?"—":"Q"+Number(v).toLocaleString("es-GT",{minimumFractionDigits:2,maximumFractionDigits:2});return esc(v)}' +
    'function pintar(){var q=document.getElementById("q").value.toLowerCase().trim(),L=D.filter(function(r){return !q||JSON.stringify(r).toLowerCase().indexOf(q)>-1});' +
    'document.getElementById("res").innerHTML="<small>"+L.length+" de "+D.length+"</small>";' +
    'document.getElementById("f").innerHTML=L.slice(0,500).map(function(r){return "<tr>"+COLS.map(function(c){return "<td"+(c.n?" class=n":"")+">"+fmt(c,r[c.k])+"</td>"}).join("")+"</tr>"}).join("")}' +
    'document.getElementById("q").addEventListener("input",pintar);' +
    'fetch("/api/llamar/' + funcion + '",{method:"POST",headers:{"Content-Type":"application/json","x-rosanta-u":u},body:"[]"}).then(function(r){return r.json().then(function(j){return{r:r,j:j}})})' +
    '.then(function(x){if(!x.r.ok){document.getElementById("res").innerHTML="<span class=err>"+esc(x.j.error||"No se pudo leer")+"</span>";return}D=x.j.resultado||[];pintar()})' +
    '.catch(function(){document.getElementById("res").innerHTML="<span class=err>No se pudo leer. Probá de nuevo.</span>"})</script></body></html>';
}

function armarReservas() {
  return paginaTabla('Reservas', 'reservas', 'clientesReservas', [
    { k: 'fecha', t: 'Fecha' }, { k: 'nombre', t: 'Nombre' }, { k: 'personas', t: 'Personas', n: 1 }, { k: 'estado', t: 'Estado' },
    { k: 'telefono', t: 'Teléfono' }, { k: 'email', t: 'Correo' }, { k: 'gasto', t: 'Consumo', n: 1, q: 1 }],
    'Copia de lo que hoy manda Wix (pestaña reservas de Marketing OS). Las reservas se siguen tomando y corrigiendo en Wix y en la intranet.');
}
function armarCarritos() {
  return paginaTabla('Carritos abandonados', 'carritos', 'clientesCarritos', [
    { k: 'fecha', t: 'Fecha' }, { k: 'nombre', t: 'Nombre' }, { k: 'canal', t: 'Canal' }, { k: 'valor', t: 'Valor', n: 1, q: 1 },
    { k: 'estado', t: 'Estado' }, { k: 'consentimiento', t: 'Permiso' }, { k: 'contacto', t: 'Contacto' }],
    'Los carritos del formulario de reservas (pestaña carritos de Marketing OS). La recuperación se sigue haciendo en la intranet de siempre.');
}

// ---------------------------------------------------------------- Marketing (19-oct-2026)

/**
 * Traductor de google.script.run para pantallas que mandan el token al FINAL (Marketing: srv(fn,
 * ...args, AUTH)). Igual que P.TRADUCTOR, pero saca el ultimo argumento en vez del primero.
 */
const TRADUCTOR_ULTIMO = P.TRADUCTOR.replace('var args = [].slice.call(arguments, 1);   // el primero es AUTH: va en la cabecera',
  'var args = [].slice.call(arguments, 0, -1);   // el ULTIMO es AUTH: va en la cabecera');
if (TRADUCTOR_ULTIMO === P.TRADUCTOR) throw new Error('pantalla-pagos.js cambio el traductor: revisar TRADUCTOR_ULTIMO.');

/** Marketing (contenido y pauta): Marketing.html real, armado como lo arma doGet de la intranet. */
function armarMarketing(o) {
  const v = varsVista(o);
  const vars = { urlBase: '/marketing', esFull: true, authToken: v.authToken, mostrarVolver: false, esDatos: false,
    paletaCss_: v.paletaCss_, incluirCrudo_: (n) => leer(n + '.html') };
  const h = plantilla(leer('Marketing.html'), vars);
  if (h.split('<body>').length !== 2) throw new Error('Marketing.html cambio de forma: no encontre una sola vez <body>');
  return h.replace('<body>', () => '<body><script>' + TRADUCTOR_ULTIMO + '</script>' +
    '<style>.nb-aviso{background:var(--rosanta-lila-tint);border-radius:12px;padding:10px 14px;margin:12px auto;max-width:1100px;font-size:.9rem}</style>' +
    '<div class="nb-aviso"><b>Prueba en sombra · Marketing (contenido y pauta).</b> Esta pantalla es la del servidor nuevo y por ahora <b>solo muestra</b>. ' +
    'Guardar, Meta, el Creador (Claude), los reportes de Drive y la lectura del pilar se siguen usando en la intranet de siempre.</div>');
}

/** /sombra2/fotos: las fotos de cada noche (solo el dueño, lo exige /api/fotos-f2). */
function armarFotos() {
  return '<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<title>Comparación de Caja y Eventos · Rosanta</title>' + P.paleta() +
    '<style>body{margin:0;background:var(--fondo);color:var(--texto);font-family:var(--rosanta-font-body)}main{max-width:1000px;margin:0 auto;padding:16px}' +
    'h1{font-family:var(--rosanta-font-title);font-size:1.4rem}p{line-height:1.5}table{width:100%;border-collapse:collapse;background:var(--superficie);border-radius:12px;overflow:hidden}' +
    'th,td{padding:10px 8px;border-bottom:1px solid var(--linea);text-align:left;font-size:.92rem;vertical-align:top}th{font-family:var(--rosanta-font-label);font-size:.7rem;text-transform:uppercase;letter-spacing:.05em;color:var(--texto-suave)}' +
    '.n{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}.ok{color:var(--ok);font-weight:700}.mal{color:var(--mal);font-weight:700}small{color:var(--texto-suave)}' +
    '.envolver{overflow-x:auto}</style></head><body><main><h1>Caja chica, Compras y Clientes · comparación de cada noche</h1>' +
    '<p>Cada noche el servidor nuevo vuelve a leer las hojas de Google y revisa que su copia dé lo mismo. Para comparar con la intranet: ' +
    'el saldo de la caja, lo que falta justificar en Compras y las cotizaciones abiertas tienen que coincidir con la última fila.</p>' +
    '<div class="envolver"><table><thead><tr><th>Cuándo</th><th class="n">Saldo de caja</th><th class="n">Descuadres</th><th class="n">Efectivo por justificar</th><th class="n">Cotizaciones</th><th class="n">Clientes</th><th>Copia</th><th>Detalle</th></tr></thead>' +
    '<tbody id="f"><tr><td colspan="8">Leyendo…</td></tr></tbody></table></div></main><script>' +
    'function esc(x){return String(x==null?"":x).replace(/[&<>"\\x27]/g,function(c){return "&#"+c.charCodeAt(0)+";"})}' +
    'function cli(c){c=c||{};var t=[];if(c.crm)t.push(c.crm.contactos+" contactos");if(c.reservas)t.push(c.reservas.reservas+" reservas");if(c.carritos)t.push(c.carritos.carritos+" carritos");return t.length?t.join("<br>"):"—"}' +
    'function q(n){return n==null?"—":"Q"+Number(n).toLocaleString("es-GT",{minimumFractionDigits:2,maximumFractionDigits:2})}' +
    'var u=new URLSearchParams(location.search).get("u")||"";fetch("/api/fotos-f2",{headers:{"x-rosanta-u":u}}).then(function(r){return r.json()}).then(function(j){' +
    'var t=document.getElementById("f");if(j.error){t.innerHTML="<tr><td colspan=8>"+esc(j.error)+"</td></tr>";return}' +
    'if(!j.fotos.length){t.innerHTML="<tr><td colspan=8>Todavía no hay fotos: la primera sale esta noche.</td></tr>";return}' +
    't.innerHTML=j.fotos.map(function(x){var c=x.caja||{},m=x.compras||{},ev=x.eventos||{};var e=Object.keys(x.celdas_error||{}).map(function(k){return k+": "+x.celdas_error[k]+" celdas con error"});' +
    'var d=(x.diferencias||[]).concat(e);return "<tr><td>"+esc(x.cuando)+"</td><td class=n>"+q(c.saldo)+"</td><td class=n>"+(c.descuadres==null?"—":c.descuadres)+"</td><td class=n>"+q(m.por_justificar)+"</td><td class=n>"+(ev.filas==null?"—":ev.filas)+"</td><td class=n><small>"+cli(x.clientes)+"</small></td><td>"+' +
    '(x.copia_al_dia?"<span class=ok>✓ al día</span>":"<span class=mal>✗ no coincide</span>")+"</td><td><small>"+(d.length?d.map(esc).join("<br>"):"—")+"</small></td></tr>"}).join("")' +
    '}).catch(function(){document.getElementById("f").innerHTML="<tr><td colspan=8>No se pudo leer. Probá de nuevo.</td></tr>"})</script></body></html>';
}

module.exports = { armarCaja, armarCompras, armarEventos, armarFotos, armarCrm, armarReservas, armarCarritos, armarMarketing, plantilla, NAV, tokenLimpio, TRADUCTOR_ULTIMO };
