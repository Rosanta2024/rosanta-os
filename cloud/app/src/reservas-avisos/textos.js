/**
 * Los textos de los avisos (Ayudante 2, 20-oct-2026). NO viven aqui: viven en cloud/app/avisos/plantillas.en.md y
 * plantillas.es.md, para que el revisor de marca y Juanma los lean y los cambien sin tocar codigo. Este archivo
 * solo los lee, los revisa y los llena. Puro: sin red ni base.
 *
 * Formato (ver la cabecera de plantillas.es.md):
 *   ## nombre            Asunto: ...            (linea en blanco) cuerpo
 *   {dato}               [si dato] linea        [no dato] linea          [boton Texto] {enlace}
 *   ## whatsapp.nombre   Meta: / Categoria: / Parametros: / Boton:       cuerpo con {{1}}, {{2}}...
 *
 * Regla de oro: si un {dato} que la plantilla pide (fuera de un [si ...]) viene vacio, armarCorreo lo devuelve en
 * `faltan` y el servicio NO manda ese aviso. Un {dato} que no existe en DATOS es un error al cargar el archivo:
 * el error de Wix `${guestFirstName}` no puede volver a salir.
 */
const fs = require('fs');
const path = require('path');
const { esc } = require('./formato');

const DIR = path.join(__dirname, '..', '..', 'avisos');
const IDIOMAS = ['en', 'es'];

/** Los avisos al cliente (EN y ES) y los del equipo (solo ES). */
const DEL_CLIENTE = ['confirmacion', 'pendiente', 'aprobada', 'rechazada', 'cambio', 'cancelacion', 'recordatorio_24h', 'recordatorio_dia', 'resena'];
const DEL_EQUIPO = ['equipo_nueva', 'equipo_cancelada', 'equipo_grupo_grande'];
/** Las 3 plantillas de WhatsApp (Meta) y que aviso usa cada una. */
const DE_WHATSAPP = ['confirmacion', 'recordatorio', 'cambio'];
const WHATSAPP_DE = { confirmacion: 'confirmacion', aprobada: 'confirmacion', recordatorio_24h: 'recordatorio', recordatorio_dia: 'recordatorio', cambio: 'cambio' };
/** Los que llevan el archivo de calendario (.ics). */
const CON_ICS = ['confirmacion', 'aprobada', 'cambio'];

/** Todos los datos que una plantilla puede pedir. */
const DATOS = ['nombre', 'nombre_completo', 'fecha', 'fecha_corta', 'hora', 'personas', 'enlace', 'enlace_reservar', 'antes', 'ahora', 'motivo',
  'sitio_resena', 'enlace_resena', 'origen', 'estado', 'mesa', 'telefono', 'correo', 'idioma_cliente', 'alergias', 'notas', 'enlace_panel',
  'quien_cancela', 'canal'];

const RE_DATO = /\{([A-Za-z_]+)\}/g;
const RE_COND = /^\[(si|no) ([A-Za-z_]+)\]\s?(.*)$/;
const RE_BOTON = /^\[boton ([^\]]+)\]\s*(\S+)\s*$/;

function revisarTexto(texto, donde) {
  if (/\$\{|\{\{|\}\}/.test(texto)) throw new Error(donde + ': trae ${...} o {{...}}; los datos van como {nombre}.');
  for (const m of texto.matchAll(RE_DATO)) if (DATOS.indexOf(m[1]) === -1) throw new Error(donde + ': el dato {' + m[1] + '} no existe.');
  for (const l of texto.split('\n')) {
    const c = l.match(RE_COND);
    if (c && DATOS.indexOf(c[2]) === -1) throw new Error(donde + ': [' + c[1] + ' ' + c[2] + '] no es un dato conocido.');
    if (/^\[(?!si |no |boton )/.test(l)) throw new Error(donde + ': linea rara: ' + l);
  }
}

/** Texto de un .md → { clave: { asunto, cuerpo } | { meta, categoria, parametros, boton, cuerpo } }. */
function leerArchivo(texto, nombreArchivo) {
  const out = {};
  for (const p of String(texto).replace(/\r/g, '').split(/^## /m).slice(1)) {
    const lineas = p.split('\n');
    const clave = lineas.shift().trim();
    const donde = (nombreArchivo || '') + ' › ' + clave;
    const cab = {};
    while (lineas.length && lineas[0].trim() !== '') {
      const m = lineas.shift().match(/^([A-Za-z]+):\s*(.*)$/);
      if (!m) throw new Error(donde + ': cabecera rara.');
      cab[m[1].toLowerCase()] = m[2].trim();
    }
    const cuerpo = lineas.join('\n').trim();
    if (!cuerpo) throw new Error(donde + ': sin cuerpo.');
    if (out[clave]) throw new Error(donde + ': repetida.');
    if (clave.startsWith('whatsapp.')) {
      const parametros = String(cab.parametros || '').split(',').map((x) => x.trim()).filter(Boolean);
      parametros.forEach((k) => { if (DATOS.indexOf(k) === -1) throw new Error(donde + ': parametro desconocido ' + k + '.'); });
      const nums = [...cuerpo.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
      if (!cab.meta || !/^[a-z0-9_]+$/.test(cab.meta)) throw new Error(donde + ': falta "Meta:" (nombre de la plantilla en Meta, minusculas y _).');
      if (nums.length !== parametros.length || nums.some((n, i) => n !== i + 1)) throw new Error(donde + ': los {{n}} no cuadran con Parametros.');
      if (/\{[A-Za-z_]+\}/.test(cuerpo.replace(/\{\{\d+\}\}/g, ''))) throw new Error(donde + ': en WhatsApp los datos van como {{1}}, {{2}}...');
      out[clave] = { meta: cab.meta, categoria: cab.categoria || 'Utility', parametros, boton: cab.boton || '', cuerpo };
    } else {
      if (!cab.asunto) throw new Error(donde + ': sin "Asunto:".');
      revisarTexto(cab.asunto, donde + ' (asunto)');
      revisarTexto(cuerpo, donde);
      out[clave] = { asunto: cab.asunto, cuerpo };
    }
  }
  return out;
}

let cache = null;
/** { en: {...}, es: {...} }. Revisa que esten todos los avisos en los dos idiomas. dir: para las pruebas. */
function cargar(dir) {
  if (!dir && cache) return cache;
  const P = {};
  for (const idi of IDIOMAS) {
    const archivo = 'plantillas.' + idi + '.md';
    P[idi] = leerArchivo(fs.readFileSync(path.join(dir || DIR, archivo), 'utf8'), archivo);
    for (const k of DEL_CLIENTE) if (!P[idi][k]) throw new Error(archivo + ': falta el aviso ' + k + '.');
    for (const k of DE_WHATSAPP) if (!P[idi]['whatsapp.' + k]) throw new Error(archivo + ': falta whatsapp.' + k + '.');
  }
  for (const k of DEL_EQUIPO) if (!P.es[k]) throw new Error('plantillas.es.md: falta el aviso ' + k + '.');
  if (!dir) cache = P;
  return P;
}

const hay = (v) => !(v == null || v === '' || (Array.isArray(v) && !v.length));

/**
 * Llena un texto: quita las lineas [si]/[no] que no van y reemplaza los {datos}.
 * Devuelve { bloques: [{ tipo: 'texto', lineas } | { tipo: 'boton', etiqueta, url }], faltan }.
 * `formato(valor)` se aplica a cada dato (escapar para HTML, por ejemplo).
 */
function llenar(texto, datos, formato) {
  const d = datos || {};
  const f = formato || String;
  const faltan = new Set();
  const poner = (s, crudo) => s.replace(RE_DATO, (_, k) => { if (!hay(d[k])) { faltan.add(k); return ''; } return crudo ? String(d[k]) : f(d[k]); });
  const lineas = [];
  for (let l of String(texto).split('\n')) {
    const c = l.match(RE_COND);
    if (c) { if ((c[1] === 'si') !== hay(d[c[2]])) continue; l = c[3]; }
    lineas.push(l);
  }
  const bloques = [];
  let tramo = [];
  const cerrar = () => { if (tramo.length) bloques.push({ tipo: 'texto', lineas: tramo }); tramo = []; };
  for (const l of lineas) {
    const b = l.trim().match(RE_BOTON);
    if (b) { cerrar(); bloques.push({ tipo: 'boton', etiqueta: poner(b[1]), url: poner(b[2], true) }); continue; }
    if (!l.trim()) { cerrar(); continue; }
    tramo.push(poner(l));
  }
  cerrar();
  return { bloques, faltan: [...faltan] };
}

/** Un enlace de boton solo puede ser https (o http en pruebas locales). */
function enlaceSeguro(u) { return /^https?:\/\/[^\s"'<>]+$/.test(String(u || '')) ? String(u) : ''; }

const COLOR = { verde: '#4E6D5A', crema: '#F2EEEB', negro: '#14180F', suave: '#62665D' };
const FIRMA = ['Rosanta', 'Antigua Guatemala'];

function aTexto(bloques, firma) {
  const partes = bloques.map((b) => (b.tipo === 'boton' ? b.etiqueta + ': ' + b.url : b.lineas.join('\n')));
  if (firma) partes.push(FIRMA.join('\n'));
  return partes.join('\n\n');
}

/** Bloques (con los datos ya escapados) → HTML de correo sencillo, estilos en linea (los correos no entienden var()). */
function aHtml(bloques, idioma, firma) {
  const cuerpo = bloques.map((b) => {
    if (b.tipo === 'boton') {
      const url = enlaceSeguro(b.url);
      if (!url) return '';
      return '<p style="margin:22px 0"><a href="' + esc(url) + '" style="display:inline-block;background:' + COLOR.verde +
        ';color:#FFFFFF;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:999px">' + b.etiqueta + '</a></p>';
    }
    return '<p style="margin:0 0 14px;line-height:1.55">' + b.lineas.join('<br>') + '</p>';
  }).join('');
  const pie = firma ? '<p style="margin:28px 0 0;color:' + COLOR.suave + ';font-size:13px;line-height:1.5">' + FIRMA.join(' · ') + '</p>' : '';
  return '<!doctype html><html lang="' + (idioma === 'es' ? 'es' : 'en') + '"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="margin:0;padding:0;background:' + COLOR.crema + '">' +
    '<div style="max-width:560px;margin:0 auto;padding:28px 20px;font-family:Avenir,\'Avenir Next\',Lato,Arial,sans-serif;color:' + COLOR.negro + ';font-size:16px">' +
    '<div style="font-weight:700;letter-spacing:.22em;color:' + COLOR.verde + ';font-size:18px;margin-bottom:22px">ROSANTA</div>' +
    '<div style="background:#FFFFFF;border-radius:16px;padding:24px 22px">' + cuerpo + pie + '</div></div></body></html>';
}

/**
 * Arma un correo: { plantilla, idioma, asunto, texto, html, faltan }. Los del equipo salen siempre en español.
 * Si `faltan` no esta vacio, el correo NO se manda.
 */
function armarCorreo(P, nombre, idioma, datos) {
  const equipo = DEL_EQUIPO.indexOf(nombre) !== -1;
  const idi = equipo ? 'es' : (idioma === 'es' ? 'es' : 'en');
  const pl = P[idi][nombre];
  if (!pl) throw new Error('No existe la plantilla ' + nombre + ' en ' + idi + '.');
  const a = llenar(pl.asunto, datos);
  const t = llenar(pl.cuerpo, datos);
  const h = llenar(pl.cuerpo, datos, esc);
  const asunto = a.bloques.map((b) => (b.lineas || []).join(' ')).join(' ').replace(/\s+/g, ' ').trim();
  return { plantilla: nombre, idioma: idi, asunto, texto: aTexto(t.bloques, !equipo), html: aHtml(h.bloques, idi, !equipo),
    faltan: [...new Set(a.faltan.concat(t.faltan))] };
}

/**
 * Arma un WhatsApp de plantilla de Meta. nombre: el aviso (recordatorio_24h, cambio...).
 * Devuelve { nombre_meta, idioma, parametros, boton, boton_sufijo, texto (como lo veria el cliente), faltan }.
 */
function armarWhatsapp(P, nombre, idioma, datos, sufijoBoton) {
  const idi = idioma === 'es' ? 'es' : 'en';
  const wa = WHATSAPP_DE[nombre];
  const pl = wa && P[idi]['whatsapp.' + wa];
  if (!pl) throw new Error('No hay plantilla de WhatsApp para ' + nombre + '.');
  const d = datos || {};
  const faltan = pl.parametros.filter((k) => !hay(d[k]));
  if (pl.boton && !sufijoBoton) faltan.push('enlace');
  const parametros = pl.parametros.map((k) => String(hay(d[k]) ? d[k] : ''));
  const texto = pl.cuerpo.replace(/\{\{(\d+)\}\}/g, (_, n) => parametros[Number(n) - 1]);
  return { nombre_meta: pl.meta, idioma: idi, parametros, boton: pl.boton, boton_sufijo: sufijoBoton || '', texto, faltan };
}

module.exports = { DIR, IDIOMAS, DEL_CLIENTE, DEL_EQUIPO, DE_WHATSAPP, WHATSAPP_DE, CON_ICS, DATOS, leerArchivo, cargar, llenar, armarCorreo, armarWhatsapp,
  enlaceSeguro, aHtml };
