/**
 * La pantalla de Pagos del servidor nuevo (Fase 1, 17-oct-2026).
 *
 * Es la MISMA pantalla de la intranet: ProfitPagosJs.html, GuardadoEstado.html, la paleta
 * (PaletaServidor.js) y PF_ERROR (de CosteoVista.html), copiados tal cual en cloud/app/intranet/.
 * Lo unico nuevo es un traductor: la pantalla llama a google.script.run.<funcion>(AUTH, ...) como
 * siempre, y aca eso se convierte en un POST /api/llamar/<funcion> al servidor nuevo.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const DIR = path.join(__dirname, '..', 'intranet');
const leer = (f) => fs.readFileSync(path.join(DIR, f), 'utf8');

/** La paleta, corriendo paletaCss_() y paletaCssOscuro_() del PaletaServidor.js real. */
function paleta() {
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(leer('PaletaServidor.js'), ctx);
  return ctx.paletaCss_() + ctx.paletaCssOscuro_();
}

/** Un pedazo de un archivo de la intranet, de `desde` hasta antes de `hasta` (o hasta el primer "\n};"). */
function extraer(archivo, desde, hasta) {
  const v = leer(archivo);
  const i = v.indexOf(desde);
  const fin = hasta ? v.indexOf(hasta, i) : v.indexOf('\n};', i) + 3;
  if (i < 0 || fin < i) throw new Error('No encontre ' + desde + ' en ' + archivo + '.');
  return v.slice(i, fin);
}
/** window.PF_ERROR (los errores en cristiano) y PF_DONDE / PF_IR / PF_TOMAR_IR, tal cual estan. */
function pfError() {
  return extraer('CosteoVista.html', 'window.PF_ERROR = function') + '\n' +
    extraer('ProfitHoyJs.html', 'window.PF_DONDE = function', '/* Hoy (13-oct-2026)');
}

/** google.script.run del navegador → fetch al servidor nuevo, con el enlace en la cabecera. */
const TRADUCTOR = `
window.google = { script: { run: (function () {
  function corredor(ok, mal) {
    return new Proxy({}, { get: function (_, nombre) {
      if (nombre === 'withSuccessHandler') return function (f) { return corredor(f, mal); };
      if (nombre === 'withFailureHandler') return function (f) { return corredor(ok, f); };
      return function () {
        var args = [].slice.call(arguments, 1);   // el primero es AUTH: va en la cabecera
        fetch('/api/llamar/' + encodeURIComponent(nombre), { method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-rosanta-u': window.AUTH || '' }, body: JSON.stringify(args) })
          .then(function (r) { return r.json().catch(function () { return { error: 'sin respuesta' }; }).then(function (j) { return { r: r, j: j }; }); })
          .then(function (x) { if (x.r.ok) { if (ok) ok(x.j.resultado); } else if (mal) mal({ message: x.j.error || ('Error ' + x.r.status) }); })
          .catch(function (e) { if (mal) mal({ message: 'NetworkError: ' + (e && e.message || e) }); });
      };
    } });
  }
  return corredor(null, null);
})() } };`;

function armar(opciones) {
  const o = opciones || {};
  const aviso = o.sombra
    ? '<div class="nb-aviso"><b>Prueba en sombra.</b> Esta pantalla es la del servidor nuevo y por ahora <b>solo muestra</b>: los pagos se siguen guardando en la intranet de siempre.</div>'
    : '';
  return '<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<title>Pagos · Rosanta</title>' + paleta() +
    '<style>body{margin:0;background:var(--fondo);color:var(--texto);font-family:var(--rosanta-font-body)}' +
    '.nb-top{display:flex;align-items:baseline;gap:12px;padding:14px 16px;background:var(--superficie);border-bottom:1px solid var(--linea)}' +
    '.nb-top h1{font-family:var(--rosanta-font-title);font-size:1.3rem;margin:0}.nb-top small{color:var(--texto-suave)}' +
    'main{max-width:1100px;margin:0 auto;padding:16px}' +
    '.nb-aviso{background:var(--rosanta-lila-tint);border-radius:12px;padding:10px 14px;margin-bottom:12px;font-size:.9rem}</style>' +
    '</head><body><header class="nb-top"><h1>Pagos</h1><small>servidor nuevo · Querétaro</small></header><main>' + aviso +
    '<div id="pf-host"></div></main>' +
    leer('GuardadoEstado.html') +
    '<script>' + TRADUCTOR + '\nwindow.AUTH = new URLSearchParams(location.search).get("u") || "";\n' + pfError() + '</script>' +
    leer('ProfitPagosJs.html') +
    '<script>PF_PAGOS(document.getElementById("pf-host"), window.AUTH);</script>' +
    '</body></html>';
}

/** /pagos/fotos: las fotos de cada noche, para que Juanma las compare con la intranet. */
function armarFotos() {
  return '<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<title>Comparación de Pagos · Rosanta</title>' + paleta() +
    '<style>body{margin:0;background:var(--fondo);color:var(--texto);font-family:var(--rosanta-font-body)}main{max-width:1000px;margin:0 auto;padding:16px}' +
    'h1{font-family:var(--rosanta-font-title);font-size:1.4rem}p{line-height:1.5}table{width:100%;border-collapse:collapse;background:var(--superficie);border-radius:12px;overflow:hidden}' +
    'th,td{padding:10px 8px;border-bottom:1px solid var(--linea);text-align:left;font-size:.92rem;vertical-align:top}th{font-family:var(--rosanta-font-label);font-size:.7rem;text-transform:uppercase;letter-spacing:.05em;color:var(--texto-suave)}' +
    '.n{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}.ok{color:var(--ok);font-weight:700}.mal{color:var(--mal);font-weight:700}small{color:var(--texto-suave)}' +
    '.envolver{overflow-x:auto}</style></head><body><main><h1>Pagos · comparación de cada noche</h1>' +
    '<p>Cada noche el servidor nuevo vuelve a leer las hojas de Google y revisa que su copia dé lo mismo. Estos son los números del recuadro de arriba de Pagos ' +
    '(viendo todas las áreas). Para comparar: abrí Pagos en la intranet y mirá que coincidan con la última fila.</p>' +
    '<div class="envolver"><table><thead><tr><th>Cuándo</th><th class="n">Facturas por pagar</th><th class="n">Cantidad a pagar</th><th class="n">Con fecha hasta hoy</th><th>Copia</th><th>Detalle</th></tr></thead>' +
    '<tbody id="f"><tr><td colspan="6">Leyendo…</td></tr></tbody></table></div></main><script>' +
    'function esc(x){return String(x==null?"":x).replace(/[&<>"\\x27]/g,function(c){return "&#"+c.charCodeAt(0)+";"})}' +
    'function q(n){return "Q"+Number(n||0).toLocaleString("es-GT",{minimumFractionDigits:2,maximumFractionDigits:2})}' +
    'var u=new URLSearchParams(location.search).get("u")||"";fetch("/api/fotos-pagos",{headers:{"x-rosanta-u":u}}).then(function(r){return r.json()}).then(function(j){' +
    'var t=document.getElementById("f");if(j.error){t.innerHTML="<tr><td colspan=6>"+esc(j.error)+"</td></tr>";return}' +
    'if(!j.fotos.length){t.innerHTML="<tr><td colspan=6>Todavía no hay fotos: la primera sale esta noche.</td></tr>";return}' +
    't.innerHTML=j.fotos.map(function(x){var e=Object.keys(x.celdas_error||{}).map(function(k){return k+": "+x.celdas_error[k]+" celdas con error"});' +
    'var d=(x.diferencias||[]).concat(e);return "<tr><td>"+esc(x.cuando)+"</td><td class=n>"+x.por_pagar_n+"</td><td class=n>"+q(x.por_pagar_q)+"</td><td class=n>"+x.vence_hoy+"</td><td>"+' +
    '(x.copia_al_dia?"<span class=ok>✓ al día</span>":"<span class=mal>✗ no coincide</span>")+"</td><td><small>"+(d.length?d.map(esc).join("<br>"):"—")+"</small></td></tr>"}).join("")' +
    '}).catch(function(){document.getElementById("f").innerHTML="<tr><td colspan=6>No se pudo leer. Probá de nuevo.</td></tr>"})</script></body></html>';
}

module.exports = { armar, armarFotos, paleta, pfError, TRADUCTOR };
