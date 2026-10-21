-- 023 · Rol contador (sesion C, 19-oct-2026). NO APLICAR ANTES DEL 27-OCT (decision de Juanma:
-- Raul y Tesoreria BTS pasan a contador DESPUES del paso a vivo del 26).
-- Contador: VE Finanzas (DRE, metas, escenarios) y el reporte semanal. No ingresa ni corrige nada.

INSERT INTO permisos (rol, seccion, parte, nivel, area, nota) VALUES
  ('contador', 'finanzas', 'finanzas',        'ver', '*', 'Raul y Tesoreria BTS, desde el 27-oct'),
  ('contador', 'finanzas', 'reporte_semanal', 'ver', '*', 'Raul y Tesoreria BTS, desde el 27-oct');
