-- 022 · Caja chica sin cocina (sesion C, 19-oct-2026). Rango 020–029 = accesos.
-- Decision de Juanma (19-oct): cocina NO entra a Caja chica, ni en la nube ni en la intranet, para que
-- las dos se vean igual el 26-oct. La matriz del 17-oct juntaba "Caja chica y retiros" en la parte
-- 'caja'; se separan:
--   caja    = Caja chica (CAJA_CHICA):                dueño todo · sala ingresa y corrige lo suyo
--   retiros = retiros de cajero y compras en efectivo (RETIROS_SOLICITUDES): dueño todo · cocina y sala
--             ingresan y corrigen lo suyo (como hoy en la intranet: cpeQuien_)
-- Ojo servicio-pagos: RETIROS_SOLICITUDES pasa a parte 'retiros'.

DELETE FROM permisos WHERE rol = 'chef' AND parte = 'caja';

UPDATE permisos SET nota = 'caja chica; cocina no entra, Juanma 19-oct' WHERE parte = 'caja';

INSERT INTO permisos (rol, seccion, parte, nivel, area, nota) VALUES
  ('dueno', 'operacion', 'retiros', 'todo',     '*', 'retiros de cajero y compras en efectivo'),
  ('chef',  'operacion', 'retiros', 'ingresar', '*', 'retiros de cajero y compras en efectivo'),
  ('sala',  'operacion', 'retiros', 'ingresar', '*', 'retiros de cajero y compras en efectivo');
