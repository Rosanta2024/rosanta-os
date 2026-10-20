-- 015 · Marketing (contenido y pauta) en vivo (20-oct-2026, rama claude/nube-clientes-vivo; rango 010-019).
-- Solo aditiva. filas_clientes guarda tambien las pestañas de Marketing OS que escribe la pantalla de Marketing
-- (y las que solo lee: hechos_semana, pixel_semana, estados_semana). Llave: columna A, salvo
-- calendario_versiones (version|id) y papelera (borrado_el|pestana|id). Ver app/src/vivo-clientes/marketing-vivo.js.
ALTER TABLE filas_clientes DROP CONSTRAINT filas_clientes_pestana_check;
ALTER TABLE filas_clientes ADD CONSTRAINT filas_clientes_pestana_check CHECK (pestana IN (
  'cotizaciones', 'revisiones', 'reservas', 'carritos', 'crm',
  'calendario', 'calendario_versiones', 'piezas', 'propuestas', 'briefs', 'aprendizajes', 'pauta_semanal',
  'reglas', 'supuestos', 'bitacora_pruebas', 'papelera', 'hechos_semana', 'pixel_semana', 'estados_semana'));
