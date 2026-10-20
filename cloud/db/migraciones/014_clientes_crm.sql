-- 014 · Clientes en vivo: reservas, carritos y CRM en la base (20-oct-2026, rama claude/nube-clientes-vivo;
-- rango 010-019). Va DESPUES de la 012 (filas_clientes) y de la 013 (hooks_wix_recibidos). Solo aditiva.
--
-- filas_clientes suma tres pestañas:
--   reservas, carritos  (Marketing OS; llave = id, columna A)
--   crm                 (CRM Maestra; llave = 'e:'+correo, o 't:'+ultimos 8 del telefono, como CRMSync)
-- El CRM lo sigue editando la gente en la hoja (notas, limpieza): la hoja manda salvo lo que el servidor
-- todavia no copio. Una fila que desaparece de la hoja no se borra de la base: se marca `borrada`.
ALTER TABLE filas_clientes DROP CONSTRAINT filas_clientes_pestana_check;
ALTER TABLE filas_clientes ADD CONSTRAINT filas_clientes_pestana_check
  CHECK (pestana IN ('cotizaciones', 'revisiones', 'reservas', 'carritos', 'crm'));
ALTER TABLE filas_clientes ADD COLUMN borrada timestamptz;
