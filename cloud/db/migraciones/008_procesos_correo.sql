-- 008 · Procesos: los correos del FEL y del banco en la nube (20-oct-2026, cloud/app/src/proc-fel-banco.js).
-- SIN APLICAR. Va despues de la 005 (filas_vivas).
--
-- 1. FEL_CORREO y BANCO_CORREO pasan a ser pestañas "vivas" (proc_fel / proc_banco = nube): mismas reglas que
--    Caja (celdas = la fila exacta de la hoja, origen hoja|servidor, nunca se borra, copiado_a_hoja vigila la
--    copia). Llave: MENSAJE_ID, el id del mensaje de Gmail (la intranet ya lo usa para no leer dos veces).
--    Solo se AGRANDA la lista de pestañas permitidas: las filas que hay siguen valiendo.
ALTER TABLE filas_vivas DROP CONSTRAINT filas_vivas_pestana_check;
ALTER TABLE filas_vivas ADD CONSTRAINT filas_vivas_pestana_check
  CHECK (pestana IN ('CAJA_CHICA', 'RETIROS_SOLICITUDES', 'CIERRES_DIARIOS', 'FEL_CORREO', 'BANCO_CORREO'));

-- 2. Cada corrida de un proceso (sombra o nube), para mirar la sombra de varios dias sin depender de los logs.
CREATE TABLE procesos_corridas (
  id        bigserial PRIMARY KEY,
  cuando    timestamptz NOT NULL DEFAULT now(),
  proceso   text NOT NULL,
  modo      text NOT NULL CHECK (modo IN ('sombra', 'nube')),
  ok        boolean NOT NULL,
  resumen   jsonb NOT NULL
);

GRANT SELECT, INSERT ON procesos_corridas TO app;   -- sin UPDATE ni DELETE
GRANT USAGE ON SEQUENCE procesos_corridas_id_seq TO app;
-- filas_vivas ya tiene SELECT, INSERT, UPDATE para app (005), sin DELETE.
