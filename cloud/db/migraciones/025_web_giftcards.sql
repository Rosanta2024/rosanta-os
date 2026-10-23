-- 025 · Web propia: contenido del sitio y gift cards (sesion C, 23-oct-2026). Rango 020–029 = accesos.
-- Pedido del equipo "Web propia sin Wix" (rama claude/web-sv, permisos-web.js), con la decision de Juanma
-- del 20/21-oct: "por el momento solo yo" para el contenido del sitio.
-- SOLO ENSAYO hasta el 31-oct: en produccion se aplica despues del 31 y con el si de Juanma (--solo 025).
--   web        solo el dueño (textos, fotos, menu, FAQ, eventos, Adventures). Nadie mas la ve.
--   giftcards  dueño todo · sala ingresa: buscar, ver saldo, canjear y deshacer SU canje.
--   Solo el dueño: publicar_web (publicar o volver a una version vieja) y anular_giftcard
--   (emitir por deposito, anular, aceptar una vencida, deshacer un canje ajeno).

INSERT INTO permisos (rol, seccion, parte, nivel, area, nota) VALUES
  ('dueno', 'marketing', 'web',       'todo',     '*', 'contenido del sitio y Adventures; por ahora solo el dueño, Juanma 21-oct'),
  ('dueno', 'clientes',  'giftcards', 'todo',     '*', 'gift cards: emitir, canjear, anular, reporte'),
  ('sala',  'clientes',  'giftcards', 'ingresar', '*', 'buscar, ver saldo y canjear, sala y caja');

INSERT INTO acciones_solo_dueno (accion, detalle) VALUES
  ('publicar_web',    'publicar el sitio o volver a una version anterior'),
  ('anular_giftcard', 'emitir una gift card por deposito, anularla, aceptar una vencida o deshacer un canje ajeno');
