-- 004 · Pagos: importar a la base las filas de PAGOS_PROVEEDORES (decision de Juanma del 17-oct-2026,
-- opcion a: Pagos pasa a vivo solo y el servidor trae cada 15 min lo que Caja chica y Compras sigan
-- guardando en la hoja desde la intranet).
--
-- La llave es el ID de la fila (las 193 filas al 17-oct lo tienen y no se repite). celdas guarda la
-- fila EXACTA como la devuelve la hoja (4 IDs y casi todos los NIT vienen como numero): con eso
-- Pagos armado desde la base da lo mismo que armado desde la hoja. Las columnas con tipo son para
-- consultar. Ninguna fila se borra: un error se marca ANULADO en el estatus, como en la hoja.
ALTER TABLE pagos_proveedores
  ADD COLUMN celdas       jsonb,                       -- la fila tal cual (codificada como hojas_copia)
  ADD COLUMN origen       text NOT NULL DEFAULT 'hoja' CHECK (origen IN ('hoja', 'servidor')),
  ADD COLUMN orden        integer,                     -- posicion en la hoja (fila - 1); las del servidor van al final
  ADD COLUMN actualizado  timestamptz NOT NULL DEFAULT now();

-- Cada importacion deja su resumen (para la comparacion de la noche y para revisar).
CREATE TABLE pagos_importaciones (
  id            bigserial PRIMARY KEY,
  cuando        timestamptz NOT NULL DEFAULT now(),
  filas_hoja    integer NOT NULL,
  nuevas        integer NOT NULL,
  actualizadas  integer NOT NULL,
  problemas     jsonb NOT NULL     -- [] si todo bien: conflictos, filas sin ID, IDs repetidos, filas que faltan en la hoja
);

GRANT SELECT, INSERT ON pagos_importaciones TO app;
GRANT USAGE ON SEQUENCE pagos_importaciones_id_seq TO app;
