-- 024 · Sala maneja TODAS las reservas (sesion C, 20-oct-2026). Rango 020–029 = accesos.
-- Decision de Juanma (20-oct, via la Central) para el motor de reservas propio de la web nueva
-- (servicio rosanta-web): SALA confirma, cancela, mueve y cierra fechas de CUALQUIER reserva, aunque
-- no la haya anotado ella. Excepcion a "el equipo solo corrige lo suyo", SOLO para reservas.
-- Queda registro de quien lo hizo (bitacora, 021). Cocina sigue solo viendo (17-oct); dueño, todo.

DELETE FROM permisos WHERE rol = 'sala' AND parte = 'reservas';

INSERT INTO permisos (rol, seccion, parte, nivel, area, nota) VALUES
  ('sala', 'clientes', 'reservas', 'todo', '*', 'confirma, cancela, mueve y cierra fechas de cualquier reserva; queda en la bitacora, Juanma 20-oct');
