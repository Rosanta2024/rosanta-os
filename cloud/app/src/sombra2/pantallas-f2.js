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

/**
 * Clientes › Eventos: EventosVista.html es una pagina entera con dos scriptlets (la paleta y el
 * token). Se reemplazan esos dos y nada mas; si la vista cambia de forma, esto tira y la prueba
 * lo avisa.
 */
function armarEventos() {
  let v = leer('EventosVista.html');
  const reemplazos = [
    ['<?!= paletaCss_() ?>', P.paleta()],
    ['const AUTH = "<?= authToken ?>";', 'const AUTH = new URLSearchParams(location.search).get("u") || "";'],
    ['<body>', '<body><script>' + P.TRADUCTOR + '</script>' +
      '<style>.nb-aviso{background:var(--rosanta-lila-tint);border-radius:12px;padding:10px 14px;margin:12px auto;max-width:1100px;font-size:.9rem}</style>' +
      '<div class="nb-aviso"><b>Prueba en sombra · Clientes › Eventos.</b> Esta pantalla es la del servidor nuevo y por ahora <b>solo muestra</b>: ' +
      'los cambios del pipeline se siguen haciendo en la intranet de siempre.</div>']
  ];
  reemplazos.forEach(([a, b]) => {
    if (v.split(a).length !== 2) throw new Error('EventosVista.html cambio de forma: no encontre una sola vez ' + a);
    v = v.replace(a, () => b);
  });
  if (v.indexOf('<?') !== -1) throw new Error('EventosVista.html trae un scriptlet nuevo que el servidor no sabe armar.');
  return v;
}

/** /sombra2/fotos: las fotos de cada noche (solo el dueño, lo exige /api/fotos-f2). */
function armarFotos() {
  return '<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<title>Comparación de Caja y Eventos · Rosanta</title>' + P.paleta() +
    '<style>body{margin:0;background:var(--fondo);color:var(--texto);font-family:var(--rosanta-font-body)}main{max-width:1000px;margin:0 auto;padding:16px}' +
    'h1{font-family:var(--rosanta-font-title);font-size:1.4rem}p{line-height:1.5}table{width:100%;border-collapse:collapse;background:var(--superficie);border-radius:12px;overflow:hidden}' +
    'th,td{padding:10px 8px;border-bottom:1px solid var(--linea);text-align:left;font-size:.92rem;vertical-align:top}th{font-family:var(--rosanta-font-label);font-size:.7rem;text-transform:uppercase;letter-spacing:.05em;color:var(--texto-suave)}' +
    '.n{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}.ok{color:var(--ok);font-weight:700}.mal{color:var(--mal);font-weight:700}small{color:var(--texto-suave)}' +
    '.envolver{overflow-x:auto}</style></head><body><main><h1>Caja chica, Compras y Eventos · comparación de cada noche</h1>' +
    '<p>Cada noche el servidor nuevo vuelve a leer las hojas de Google y revisa que su copia dé lo mismo. Para comparar con la intranet: ' +
    'el saldo de la caja, lo que falta justificar en Compras y las cotizaciones abiertas tienen que coincidir con la última fila.</p>' +
    '<div class="envolver"><table><thead><tr><th>Cuándo</th><th class="n">Saldo de caja</th><th class="n">Descuadres</th><th class="n">Efectivo por justificar</th><th class="n">Cotizaciones</th><th>Copia</th><th>Detalle</th></tr></thead>' +
    '<tbody id="f"><tr><td colspan="7">Leyendo…</td></tr></tbody></table></div></main><script>' +
    'function esc(x){return String(x==null?"":x).replace(/[&<>"\\x27]/g,function(c){return "&#"+c.charCodeAt(0)+";"})}' +
    'function q(n){return n==null?"—":"Q"+Number(n).toLocaleString("es-GT",{minimumFractionDigits:2,maximumFractionDigits:2})}' +
    'var u=new URLSearchParams(location.search).get("u")||"";fetch("/api/fotos-f2",{headers:{"x-rosanta-u":u}}).then(function(r){return r.json()}).then(function(j){' +
    'var t=document.getElementById("f");if(j.error){t.innerHTML="<tr><td colspan=7>"+esc(j.error)+"</td></tr>";return}' +
    'if(!j.fotos.length){t.innerHTML="<tr><td colspan=7>Todavía no hay fotos: la primera sale esta noche.</td></tr>";return}' +
    't.innerHTML=j.fotos.map(function(x){var c=x.caja||{},m=x.compras||{},ev=x.eventos||{};var e=Object.keys(x.celdas_error||{}).map(function(k){return k+": "+x.celdas_error[k]+" celdas con error"});' +
    'var d=(x.diferencias||[]).concat(e);return "<tr><td>"+esc(x.cuando)+"</td><td class=n>"+q(c.saldo)+"</td><td class=n>"+(c.descuadres==null?"—":c.descuadres)+"</td><td class=n>"+q(m.por_justificar)+"</td><td class=n>"+(ev.filas==null?"—":ev.filas)+"</td><td>"+' +
    '(x.copia_al_dia?"<span class=ok>✓ al día</span>":"<span class=mal>✗ no coincide</span>")+"</td><td><small>"+(d.length?d.map(esc).join("<br>"):"—")+"</small></td></tr>"}).join("")' +
    '}).catch(function(){document.getElementById("f").innerHTML="<tr><td colspan=7>No se pudo leer. Probá de nuevo.</td></tr>"})</script></body></html>';
}

module.exports = { armarCaja, armarCompras, armarEventos, armarFotos };
