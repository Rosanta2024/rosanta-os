/**
 * Borradores de respuesta a reseñas con Claude, con las MISMAS reglas que el bot de reseñas de Apps Script
 * (21-oct-2026). No se copia el prompt: se carga del archivo real (cloud/app/proyectos/panel-de-reseas-de-google/
 * "Bot de Reseñas de Google.js", que la prueba de clientes2 obliga a ser igual al de apps-script/). Asi, si
 * Juanma cambia las reglas en Apps Script, la nube las toma con la siguiente copia.
 *
 * De ese archivo se usan: construirPrompt_, sanearRespuesta_, respuestaPublicable_ y respuestaFallback_, y la
 * misma decision: 4-5 estrellas y salida limpia → se publicaria sola; lo demas → a aprobacion de Juanma.
 *
 * Sombra (POST /tareas/resenas/borradores-sombra, ver resenas-nube.js): redacta con la clave anthropic-sombra
 * (espacio "Sombra nube", tope US$10/mes compartido con el bot) las reseñas que Apps Script ya atendio, y compara
 * la DECISION (publicar sola o pedir aprobacion) con la que tomo Apps Script. El texto no se compara: el modelo no
 * escribe dos veces igual. Nada se publica.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ARCHIVO = path.join(__dirname, '..', 'proyectos', 'panel-de-reseas-de-google', 'Bot de Reseñas de Google.js');
const MODELO = 'claude-sonnet-4-6';   // el default de CONFIG.ANTHROPIC_MODEL en Apps Script
// US$ por millon de tokens (entrada, salida) del modelo de arriba. Solo para el tope de gasto de la sombra.
const PRECIO = { entrada: 3, salida: 15 };

let reglas = null;
/** Las funciones de redaccion del archivo real, cargadas una vez en un contexto aislado (sin red ni hojas). */
function cargarReglas(archivo) {
  if (reglas && !archivo) return reglas;
  const codigo = fs.readFileSync(archivo || ARCHIVO, 'utf8');
  const ctx = { PropertiesService: { getScriptProperties: () => ({ getProperty: () => null }) }, Logger: { log: () => {} } };
  vm.createContext(ctx);
  vm.runInContext(codigo + '\n;this.__r = { construirPrompt_, sanearRespuesta_, respuestaPublicable_, resenaEnEspanolOIngles_, respuestaFallback_, AUTO_MIN: CONFIG.AUTO_MIN };', ctx, { filename: 'Bot de Reseñas de Google.js' });
  const r = ctx.__r;
  if (!archivo) reglas = r;
  return r;
}

/**
 * Igual que redactarRespuesta_ de Apps Script. Devuelve { texto, confiable, decision, uso }.
 * decision: 'publicar_sola' (4-5 estrellas y salida limpia) | 'aprobar'.
 */
async function redactar(resena, opciones) {
  const R = cargarReglas();
  const o = opciones || {};
  const fetchFn = o.fetch || fetch;
  const estrellas = Number(resena.estrellas) || 0, nombre = resena.cliente || '', texto = resena.resena || '';
  if (!o.clave) throw Object.assign(new Error('Falta la clave de Claude para los borradores.'), { status: 503 });
  const r = await fetchFn('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': o.clave, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: o.modelo || MODELO, max_tokens: 400, messages: [{ role: 'user', content: R.construirPrompt_(estrellas, nombre, texto) }] })
  });
  let red, uso = { entrada: 0, salida: 0 }, fallo = '';
  if (!r.ok) {
    // Como Apps Script desde el 21-oct (revisor de marca): el texto de respaldo va siempre a aprobacion.
    fallo = String(r.status);
    red = { texto: R.respuestaFallback_(estrellas, nombre), confiable: false };
  } else {
    const j = await r.json();
    uso = { entrada: (j.usage && j.usage.input_tokens) || 0, salida: (j.usage && j.usage.output_tokens) || 0 };
    const crudo = String((j.content && j.content[0] && j.content[0].text) || '').trim();
    const limpio = R.sanearRespuesta_(crudo, nombre);
    red = R.respuestaPublicable_(limpio) && R.resenaEnEspanolOIngles_(texto) ? { texto: limpio, confiable: true } : { texto: limpio || R.respuestaFallback_(estrellas, nombre), confiable: false };
  }
  const decision = estrellas >= R.AUTO_MIN && red.confiable ? 'publicar_sola' : 'aprobar';
  const costo = (uso.entrada * PRECIO.entrada + uso.salida * PRECIO.salida) / 1e6;
  return { texto: red.texto, confiable: red.confiable, decision, uso, costo, fallo };
}

/** Lo que hizo Apps Script con esa reseña, segun el Estado de la hoja, en los mismos terminos. */
function decisionDeHoja(estado) {
  if (estado === 'PUBLICADA_AUTO') return 'publicar_sola';
  if (/^(PENDIENTE_APROBAR|PUBLICADA_APROBADA|NO_RESPONDER)$/.test(estado || '')) return 'aprobar';
  return '';   // YA_TENIA_RESPUESTA, PUBLICADA_EDITADA (no se sabe como nacio) u otro: no hay decision que comparar
}

module.exports = { cargarReglas, redactar, decisionDeHoja, MODELO, ARCHIVO };
