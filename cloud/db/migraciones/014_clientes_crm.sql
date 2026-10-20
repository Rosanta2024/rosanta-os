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

-- La foto de cada noche de la sombra de reservas, carritos y CRM (rosanta-clientes /tareas/comparar-crm).
CREATE TABLE clientes_comparaciones (
  id           bigserial PRIMARY KEY,
  cuando       timestamptz NOT NULL DEFAULT now(),
  desde        date NOT NULL,
  recibidos    integer NOT NULL,
  diferencias  jsonb NOT NULL,      -- [] si todo coincide (sin datos personales)
  avisos       jsonb NOT NULL
);
GRANT SELECT, INSERT ON clientes_comparaciones TO app;
GRANT USAGE ON SEQUENCE clientes_comparaciones_id_seq TO app;
-- crm-vivo lee lo que recibio rosanta-nube (013)
GRANT SELECT ON hooks_wix_recibidos TO app;
