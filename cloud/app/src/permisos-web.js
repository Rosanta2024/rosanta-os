/**
 * PROPUESTA de permisos para la web (AYUDANTE 4; ajustada el 21-oct-2026 con la decision de Juanma: "por el momento
 * solo yo"). NO es la matriz: la matriz vive solo en la base (020_permisos.sql y las que siguen) y la crea la SESION C
 * con una migracion de su rango 02x.
 *
 * Mientras esas filas no existan, permisos.js contesta "Tu cuenta no tiene web" / "Acción desconocida" y las pantallas
 * de esta rama no dejan hacer nada (falla cerrada). Este archivo solo sirve para:
 *   - que la sesion C copie el SQL de SQL_PROPUESTO tal cual;
 *   - que las pruebas armen la matriz con la propuesta (conPropuesta).
 *
 * Decisiones:
 *   web        SOLO el dueño: textos, fotos, menu, FAQ, eventos, Adventures (experiencias, operadores aliados y sus
 *              consultas). Nadie mas la ve (ni pauta: Vanessa y Dani no editan por ahora).
 *   giftcards  dueño todo · sala ingresar = buscar, ver saldo y canjear (sala y caja), y deshacer SU canje.
 *   publicar_web     solo el dueño: publicar y volver a una version vieja.
 *   anular_giftcard  solo el dueño: emitir una vendida por deposito, anular, aceptar una vencida, deshacer un canje ajeno.
 *   (precio_venta ya existe: el precio de un plato, el tipo de cambio y los precios fijos en US$.)
 * Cuando Juanma quiera sumar a alguien a la web, es UNA fila nueva: ('pauta', 'marketing', 'web', 'ingresar') — el
 * codigo ya separa borrador (ingresar) de publicar (publicar_web).
 */
const SQL_PROPUESTO = `
INSERT INTO permisos (rol, seccion, parte, nivel, area, nota) VALUES
  ('dueno', 'marketing', 'web',       'todo',     '*', 'contenido del sitio y Adventures; por ahora solo el dueño (Juanma, 21-oct)'),
  ('dueno', 'clientes',  'giftcards', 'todo',     '*', 'gift cards: emitir, canjear, anular, reporte'),
  ('sala',  'clientes',  'giftcards', 'ingresar', '*', 'buscar, ver saldo y canjear (sala y caja)');
INSERT INTO acciones_solo_dueno (accion, detalle) VALUES
  ('publicar_web',    'publicar el sitio o volver a una version anterior'),
  ('anular_giftcard', 'emitir una gift card por deposito, anularla, aceptar una vencida o deshacer un canje ajeno');
`;

const FILAS = [
  { rol: 'dueno', seccion: 'marketing', parte: 'web', nivel: 'todo', area: '*' },
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
