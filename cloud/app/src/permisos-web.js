/**
 * PROPUESTA de permisos para la web (AYUDANTE 4, 20-oct-2026). NO es la matriz: la matriz vive solo en la
 * base (020_permisos.sql y las que siguen) y la crea la SESION C con una migracion de su rango 02x.
 *
 * Mientras esas filas no existan, permisos.js contesta "Tu cuenta no tiene web" / "Acción desconocida" y las
 * pantallas de esta rama no dejan hacer nada (falla cerrada). Este archivo solo sirve para:
 *   - que la sesion C copie el SQL de SQL_PROPUESTO tal cual;
 *   - que las pruebas armen la matriz con la propuesta (conPropuesta).
 *
 * Decisiones (Estudio §3.1 y §3.5, y el encargo del coordinador del 20-oct):
 *   web        dueño todo · pauta (Vanessa y Dani) ingresar = editan el BORRADOR · sala, cocina: no lo ven.
 *   giftcards  dueño todo · sala ingresar (buscar, ver saldo y canjear; deshacer SU canje) · cocina: no.
 *   publicar_web     solo el dueño: publicar y volver a una version vieja.
 *   anular_giftcard  solo el dueño: anular una tarjeta, canjear una vencida, deshacer un canje ajeno.
 *   (precio_venta ya existe: cambiar el precio de un plato o del tipo de cambio de referencia.)
 * Dani necesita una fila en USUARIOS con rol "pauta" (hoy no esta en la matriz).
 */
const SQL_PROPUESTO = `
INSERT INTO permisos (rol, seccion, parte, nivel, area, nota) VALUES
  ('dueno', 'marketing', 'web',       'todo',     '*', 'contenido del sitio: textos, fotos, menu, FAQ, eventos'),
  ('pauta', 'marketing', 'web',       'ingresar', '*', 'editan el borrador; publica el dueño'),
  ('dueno', 'clientes',  'giftcards', 'todo',     '*', 'gift cards: venta, canje, anulacion, reporte'),
  ('sala',  'clientes',  'giftcards', 'ingresar', '*', 'buscar, ver saldo y canjear (sala y caja)');
INSERT INTO acciones_solo_dueno (accion, detalle) VALUES
  ('publicar_web',    'publicar el sitio o volver a una version anterior'),
  ('anular_giftcard', 'anular una gift card, canjear una vencida o deshacer un canje ajeno');
`;

const FILAS = [
  { rol: 'dueno', seccion: 'marketing', parte: 'web', nivel: 'todo', area: '*' },
  { rol: 'pauta', seccion: 'marketing', parte: 'web', nivel: 'ingresar', area: '*' },
  { rol: 'dueno', seccion: 'clientes', parte: 'giftcards', nivel: 'todo', area: '*' },
  { rol: 'sala', seccion: 'clientes', parte: 'giftcards', nivel: 'ingresar', area: '*' }
];
const SOLO_DUENO = ['publicar_web', 'anular_giftcard'];

/** Una matriz de permisos.js con la propuesta encima (solo para pruebas y ensayos). */
function conPropuesta(M) {
  const permisos = new Map(M.permisos);
  FILAS.forEach((f) => permisos.set(f.rol + '|' + f.parte, f));
  return { permisos, soloDueno: new Set([...M.soloDueno, ...SOLO_DUENO]) };
}

module.exports = { SQL_PROPUESTO, FILAS, SOLO_DUENO, conPropuesta };
