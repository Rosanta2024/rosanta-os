/**
 * Pantallas de Clientes › Bot y Clientes › Reseñas y encuesta, en sombra (19-oct-2026).
 *
 * La consola y el panel de reseñas son los MISMOS archivos de siempre (cloud/app/proyectos/, copias
 * exactas), con un traductor de google.script.run que manda cada llamada a /api/clientes2/<parte>/<funcion>.
 * Esas dos pantallas no llevan el enlace ?u= en sus llamadas (en Apps Script entraba la cuenta de Google):
 * el traductor lo toma de la direccion y lo manda en la cabecera.
 *
 * "Bot en sombra" (la comparacion de cada noche) y "Encuesta" son paginas nuevas de solo lectura.
 */
const P = require('../pantalla-pagos');
const { leerProyecto } = require('./motor-gas');

const NOMBRES = { eventos: 'Eventos', crm: 'CRM', reservas: 'Reservas', carritos: 'Carritos', consola: 'Bot', resenas: 'Reseñas y encuesta' };

/** Traductor sin token en los argumentos: todos van al servidor; el ?u= viaja en la cabecera. */
function traductor(parte) {
  const t = P.TRADUCTOR
    .replace('var args = [].slice.call(arguments, 1);   // el primero es AUTH: va en la cabecera', 'var args = [].slice.call(arguments, 0);   // sin AUTH en los argumentos')
    .replace("fetch('/api/llamar/' + encodeURIComponent(nombre)", "fetch('/api/clientes2/" + parte + "/' + encodeURIComponent(nombre)");
  if (t.indexOf('/api/clientes2/') < 0 || t.indexOf('slice.call(arguments, 0)') < 0) throw new Error('pantalla-pagos.js cambio el traductor: revisar clientes2/pantallas.js.');
  return t + '\nwindow.AUTH = new URLSearchParams(location.search).get("u") || "";';
}

/** La barra de Clientes (las partes que la matriz deja ver) y, debajo, las pestañas internas de la parte. */
function barra(activa, sub, subActiva) {
  const css = '<style>.cl-nav{display:flex;flex-wrap:wrap;gap:6px;align-items:center;padding:10px 16px;background:var(--superficie,#fff);border-bottom:1px solid var(--linea,#e0dcd2);font-family:var(--rosanta-font-body,Lato,sans-serif)}' +
    '.cl-nav b{font-family:var(--rosanta-font-title,serif);margin-right:8px}.cl-nav a{padding:8px 12px;border-radius:999px;text-decoration:none;color:var(--texto,#1a1a1a);min-height:28px}' +
    '.cl-nav a.on{background:var(--rosanta-lila-tint,#ecebf8);font-weight:700}.cl-nav small{margin-left:auto;color:var(--texto-suave,#777)}' +
    '.cl-sub{display:flex;gap:6px;padding:8px 16px;background:var(--fondo,#F2EEEB);font-family:var(--rosanta-font-body,Lato,sans-serif)}.cl-sub a{padding:6px 12px;border-radius:999px;color:var(--texto,#1a1a1a);text-decoration:none;font-size:.92rem}.cl-sub a.on{background:var(--superficie,#fff);font-weight:700}' +
    '.nb-aviso{background:var(--rosanta-lila-tint,#ecebf8);border-radius:12px;padding:10px 14px;margin:10px 16px;font-size:.9rem;font-family:var(--rosanta-font-body,Lato,sans-serif)}</style>';
  const subHtml = sub ? '<nav class="cl-sub" id="cl-sub">' + sub.map((s) => '<a data-href="' + s.href + '"' + (s.k === subActiva ? ' class="on"' : '') + '>' + s.t + '</a>').join('') + '</nav>' : '';
  return css + '<nav class="cl-nav" id="cl-nav"><b>Clientes</b><small>servidor nuevo · sombra</small></nav>' + subHtml + '<script>(function(){' +
    'var u=new URLSearchParams(location.search).get("u")||"",n=' + JSON.stringify(NOMBRES) + ',act=' + JSON.stringify(activa) + ';' +
    'document.querySelectorAll("#cl-sub a").forEach(function(a){a.href=a.getAttribute("data-href")+"?u="+encodeURIComponent(u)});' +
    'fetch("/api/clientes/partes",{headers:{"x-rosanta-u":u}}).then(function(r){return r.json()}).then(function(j){var nav=document.getElementById("cl-nav"),fin=nav.lastChild;' +
    '(j.partes||[]).forEach(function(p){var a=document.createElement("a");a.href="/clientes/"+p+"?u="+encodeURIComponent(u);a.textContent=n[p]||p;if(p===act)a.className="on";nav.insertBefore(a,fin)})})})();</script>';
}

const SUB_CONSOLA = [{ k: 'chats', t: 'Chats y lo que sabe el bot', href: '/clientes/consola' }, { k: 'sombra', t: 'Bot en sombra (comparación)', href: '/clientes/consola/sombra' }];
const SUB_RESENAS = [{ k: 'panel', t: 'Reseñas', href: '/clientes/resenas' }, { k: 'encuesta', t: 'Encuesta', href: '/clientes/resenas/encuesta' }];

/** Consola de respuestas real: chats y, al abrir uno, "lo que ya sabe el bot" (Fichas). */
function armarConsola() {
  const h = leerProyecto('consola-de-respuestas-rosanta', 'Index.html');
  return '<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Bot · Clientes · Rosanta</title>' +
    P.paleta() + '<script>' + traductor('consola') + '</script></head><body>' + barra('consola', SUB_CONSOLA, 'chats') +
    '<div class="nb-aviso"><b>Prueba en sombra · consola del bot.</b> Son los chats de siempre leídos de la copia (se actualiza cada 15 min). ' +
    'Desde aquí <b>no se manda nada</b>: para contestar, devolver al bot o mandar fotos, usa la consola de siempre.</div>' +
    '<style>.app{height:calc(100vh - 150px)!important}</style>' + h + '</body></html>';
}

/** Panel de reseñas real. Las reseñas de Google salen de la hoja de control (no de la API de Google). */
function armarResenas() {
  const h = leerProyecto('panel-de-reseas-de-google', 'Panel de Reseñas de Google.html');
  if (h.split('<body>').length !== 2) throw new Error('Panel de Reseñas de Google.html cambio de forma: no encontre una sola vez <body>');
  return h.replace('</head>', () => '<script>' + traductor('resenas') + '</script></head>')
    .replace('<body>', () => '<body>' + barra('resenas', SUB_RESENAS, 'panel') +
      '<div class="nb-aviso"><b>Prueba en sombra · reseñas.</b> Todas las reseñas de Google, leídas cada hora por el servidor nuevo (solo lectura), ' +
      'con el borrador que dejó el bot de reseñas. Mientras el servidor no haya leído Google, se muestra la hoja de control (desde el 7-jul-2026). ' +
      'Desde aquí <b>no se publica ni se guarda nada</b>.</div>');
}

const ESTILO = '<style>body{margin:0;background:var(--fondo);color:var(--texto);font-family:var(--rosanta-font-body)}main{max-width:1100px;margin:0 auto;padding:16px}' +
  'h1{font-family:var(--rosanta-font-title);font-size:1.4rem;margin:.2em 0 .4em}p{line-height:1.5}.tarjetas{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px;margin:12px 0}' +
  '.t{background:var(--superficie);border-radius:12px;padding:12px}.t b{display:block;font-family:var(--rosanta-font-title);font-size:1.5rem}.t small{color:var(--texto-suave)}' +
  'table{width:100%;border-collapse:collapse;background:var(--superficie);border-radius:12px;overflow:hidden}th,td{padding:9px 8px;border-bottom:1px solid var(--linea);text-align:left;font-size:.9rem;vertical-align:top}' +
  'th{font-family:var(--rosanta-font-label);font-size:.7rem;text-transform:uppercase;letter-spacing:.05em;color:var(--texto-suave)}.n{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}' +
  '.ok{color:var(--ok);font-weight:700}.mal{color:var(--mal);font-weight:700}.envolver{overflow-x:auto}small{color:var(--texto-suave)}button.lnk{background:none;border:0;color:var(--rosanta-verde-medio,#57A77F);cursor:pointer;padding:6px;min-height:32px;font:inherit;text-decoration:underline}' +
  '.par{display:grid;grid-template-columns:1fr 1fr;gap:8px}.par div{background:var(--fondo);border-radius:8px;padding:8px;white-space:pre-wrap;font-size:.85rem}@media(max-width:700px){.par{grid-template-columns:1fr}}</style>';
const ESC = 'function esc(x){return String(x==null?"":x).replace(/[&<>"\\x27]/g,function(c){return "&#"+c.charCodeAt(0)+";"})}';

/** Bot en sombra: las corridas de cada noche y, al abrir una, cada mensaje con lo que hizo el real y la sombra. */
function armarBotSombra() {
  return '<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Bot en sombra · Rosanta</title>' +
    P.paleta() + ESTILO + '<script>' + traductor('consola') + '</script></head><body>' + barra('consola', SUB_CONSOLA, 'sombra') + '<main>' +
    '<h1>Bot en sombra · comparación de cada noche</h1>' +
    '<p>El bot nuevo corre el mismo código del bot de hoy, aparte y sin mandar nada. Cada mañana repite los chats del día anterior (anónimos) y compara, mensaje por mensaje: ' +
    '<b>si contestó</b>, <b>qué hizo</b> (reservar, cambiar, cancelar, informar) y <b>si pasó el chat a Juanma</b>. ' +
    '"Grabado" usa lo que contestó el bot real (prueba la tubería); "modelo" le pregunta a Claude de verdad (prueba las decisiones).</p>' +
    '<div class="envolver"><table><thead><tr><th>Cuándo</th><th>Modo</th><th>Período</th><th class="n">Mensajes</th><th class="n">Iguales</th><th class="n">Contestó igual</th><th class="n">Misma acción</th><th class="n">Juanma igual</th><th class="n">Reservas real/sombra</th><th class="n">Costo</th><th></th></tr></thead>' +
    '<tbody id="c"><tr><td colspan="11">Leyendo…</td></tr></tbody></table></div><div id="d"></div>' +
    '<h1>Sombra viva · mensajes reales</h1><p>Desde que Meta apunta a la nube en <b>puente</b>, cada mensaje real lo sigue contestando el bot de hoy y, además, la nube lo piensa <b>sin mandar nada</b>. ' +
    'Cada noche se compara: <b>grave</b> = uno contesta y el otro no (llega la alerta); <b>leve</b> = uno pasa a Juanma y el otro no, o había una persona atendiendo. Hay un tope de mensajes por día para cuidar el gasto.</p>' +
    '<div class="envolver"><table><thead><tr><th>Día</th><th class="n">Pensados</th><th class="n">Comparados</th><th class="n">Iguales</th><th class="n">Graves</th><th class="n">Leves</th><th class="n">Sobre el tope</th><th class="n">Errores</th></tr></thead>' +
    '<tbody id="v"><tr><td colspan="8">Leyendo…</td></tr></tbody></table></div><div id="vd"></div></main><script>' + ESC +
    'google.script.run.withSuccessHandler(function(s){var v=document.getElementById("v");if(!s.dias.length){v.innerHTML="<tr><td colspan=8>Todavía no hay mensajes: empieza cuando Meta apunte a la nube en puente.</td></tr>";return}' +
    'v.innerHTML=s.dias.map(function(x){return "<tr><td>"+esc(x.dia)+"</td><td class=n>"+x.pensados+"</td><td class=n>"+x.comparados+"</td><td class=n><span class=ok>"+x.iguales+"</span></td><td class=n>"+(x.graves?"<span class=mal>"+x.graves+"</span>":"0")+"</td><td class=n>"+x.leves+"</td><td class=n>"+x.omitidos+"</td><td class=n>"+(x.errores?"<span class=mal>"+x.errores+"</span>":"0")+"</td></tr>"}).join("");' +
    'document.getElementById("vd").innerHTML=s.distintas.length?"<h1>Diferencias recientes</h1>"+s.distintas.map(function(t){return "<div class=t style=margin:10px 0><small>"+esc(t.cuando)+" · "+esc(t.canal)+" · …"+esc(t.contacto)+"</small><p><b>Cliente:</b> "+esc(t.cliente)+"</p><p class="+(t.grave?"mal":"")+">"+esc(t.comparado)+"</p><p><b>La nube habría dicho:</b> "+esc(t.respuesta||"(nada)")+"</p></div>"}).join(""):""' +
    '}).withFailureHandler(function(e){document.getElementById("v").innerHTML="<tr><td colspan=8>"+esc(e.message)+"</td></tr>"}).botSombraViva();' +
    'function f(m){return m&&m.total?m.igual+" de "+m.total:"—"}' +
    'google.script.run.withSuccessHandler(function(c){var t=document.getElementById("c");if(!c.length){t.innerHTML="<tr><td colspan=11>Todavía no hay corridas: la primera sale mañana a las 6:20.</td></tr>";return}' +
    't.innerHTML=c.map(function(x){return "<tr><td>"+esc(x.cuando)+"</td><td>"+esc(x.modo)+"</td><td><small>"+esc(x.desde)+" → "+esc(x.hasta)+"</small></td><td class=n>"+(x.turnos||0)+"</td><td class=n>"+' +
    '(x.diferencias?"<span class=mal>"+(x.iguales||0)+"</span>":"<span class=ok>"+(x.iguales||0)+"</span>")+"</td><td class=n>"+f(x.contesto)+"</td><td class=n>"+f(x.accion)+"</td><td class=n>"+f(x.juanma)+"</td><td class=n>"+' +
    '(x.reservas?x.reservas.real+" / "+x.reservas.sombra:"—")+"</td><td class=n>"+(x.modeloFallas?"<span class=mal>Claude no contestó</span>":(x.costo?"US$"+x.costo.toFixed(2):"—"))+"</td><td><button class=lnk data-id="+x.id+">Ver</button></td></tr>"}).join("");' +
    't.querySelectorAll("button").forEach(function(b){b.onclick=function(){ver(Number(b.getAttribute("data-id")))}})}).withFailureHandler(function(e){document.getElementById("c").innerHTML="<tr><td colspan=11>"+esc(e.message)+"</td></tr>"}).botSombra();' +
    'function ver(id){var d=document.getElementById("d");d.innerHTML="<p>Leyendo…</p>";google.script.run.withSuccessHandler(function(ts){' +
    'd.innerHTML="<h1>Corrida "+id+"</h1>"+(ts.length?ts.map(function(t){var r=t.real||{},s=t.sombra||{},dif=t.diferencias||[];' +
    'return "<div class=t style=margin:10px 0><small>"+esc(t.t)+" · "+esc(t.canal)+" · "+esc(t.nombre||t.chat)+"</small><p><b>Cliente:</b> "+esc(t.cliente)+"</p>"+' +
    '(dif.length?"<p class=mal>"+dif.map(esc).join("<br>")+"</p>":"<p class=ok>Igual</p>")+' +
    '"<div class=par><div><b>Bot real</b> · "+esc(r.categoria||"—")+(r.humano?" · pasó a Juanma":"")+"<br>"+esc(r.contesto?r.respuestaReal:"(no contestó)")+"</div>"+' +
    '"<div><b>Sombra</b> · "+esc(s.categoria||"—")+(s.humano?" · pasó a Juanma":"")+"<br>"+esc(s.contesto?s.respuesta:"(no contestó)")+(s.botones&&s.botones.length?"<br><small>Botones: "+s.botones.map(esc).join(" · ")+"</small>":"")+"</div></div></div>"}).join(""):"<p>Sin mensajes en esa corrida.</p>")' +
    '}).withFailureHandler(function(e){d.innerHTML="<p>"+esc(e.message)+"</p>"}).botSombraTurnos(id)}' +
    '</script></body></html>';
}

/** Encuesta de satisfaccion: respuestas, promedio y cuantas fueron de 5 (las que el formulario manda a Google). */
function armarEncuesta() {
  return '<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Encuesta · Rosanta</title>' +
    P.paleta() + ESTILO + '<script>' + traductor('resenas') + '</script></head><body>' + barra('resenas', SUB_RESENAS, 'encuesta') + '<main>' +
    '<div class="nb-aviso" style="margin:0 0 10px"><b>Prueba en sombra · encuesta.</b> Muestra las respuestas guardadas en el servidor nuevo (o, si todavía no hay, la copia de la hoja). La encuesta no cambia.</div><h1>Encuesta de satisfacción</h1><p>Las respuestas del formulario de la encuesta (hoja Rosanta_Encuesta_Satisfaccion). La encuesta sigue igual: ' +
    'quien da 5 estrellas pasa a dejar su reseña en Google. <small>La encuesta de estrellas del sitio (rosanta.rest/encuesta, en Wix) no está aquí.</small></p>' +
    '<div class="tarjetas" id="k"></div><div class="envolver"><table><thead><tr><th>Fecha</th><th class="n">Estrellas</th><th>¿Qué podríamos mejorar?</th></tr></thead>' +
    '<tbody id="e"><tr><td colspan="3">Leyendo…</td></tr></tbody></table></div></main><script>' + ESC +
    'google.script.run.withSuccessHandler(function(x){document.getElementById("k").innerHTML="<div class=t><b>"+x.total+"</b><small>respuestas</small></div><div class=t><b>"+(x.promedio||0).toFixed(2)+"</b><small>promedio</small></div><div class=t><b>"+x.cinco+"</b><small>de 5 estrellas (van a Google)</small></div>";' +
    'document.getElementById("e").innerHTML=x.respuestas.length?x.respuestas.map(function(r){return "<tr><td>"+esc(String(r.fecha).slice(0,16).replace("T"," "))+"</td><td class=n>"+"★★★★★".slice(0,r.calificacion)+"</td><td>"+esc(r.comentario)+"</td></tr>"}).join(""):"<tr><td colspan=3>Sin respuestas.</td></tr>"' +
    '}).withFailureHandler(function(e){document.getElementById("e").innerHTML="<tr><td colspan=3>"+esc(e.message)+"</td></tr>"}).encuesta();</script></body></html>';
}

module.exports = { armarConsola, armarResenas, armarBotSombra, armarEncuesta, traductor, barra, NOMBRES };
