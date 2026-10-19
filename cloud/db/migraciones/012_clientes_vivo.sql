-- 012 · Clientes en vivo: el pipeline de eventos (19-oct-2026, rama claude/nube-clientes-vivo; rango 010-019).
-- PRIMERO solo en rosanta_ensayo (acordado con la sesion del Estudio): solo aditiva, no toca pagos_proveedores,
-- filas_vivas ni usuarios. En produccion se aplica el dia del paso a vivo de Clientes, con el si de Juanma.
--
-- Mismo patron que filas_vivas (005): celdas = la fila EXACTA de la hoja (Marketing OS › cotizaciones y
-- revisiones), origen hoja|servidor, nunca se borra una fila, copiado_a_hoja vigila la copia.
-- Llaves: cotizaciones → id; revisiones → fecha (AAAA-MM-DD).
CREATE TABLE filas_clientes (
  pestana         text NOT NULL CHECK (pestana IN ('cotizaciones', 'revisiones')),
  llave           text NOT NULL,
  celdas          jsonb NOT NULL,
  origen          text NOT NULL DEFAULT 'hoja' CHECK (origen IN ('hoja', 'servidor')),
  orden           integer,
  actualizado     timestamptz NOT NULL DEFAULT now(),
  copiado_a_hoja  timestamptz,
  PRIMARY KEY (pestana, llave)
);

CREATE TABLE filas_clientes_importaciones (
  id            bigserial PRIMARY KEY,
  cuando        timestamptz NOT NULL DEFAULT now(),
  pestana       text NOT NULL,
  filas_hoja    integer NOT NULL,
  nuevas        integer NOT NULL,
  actualizadas  integer NOT NULL,
  problemas     jsonb NOT NULL
);

GRANT SELECT, INSERT, UPDATE ON filas_clientes TO app;   -- sin DELETE
GRANT SELECT, INSERT ON filas_clientes_importaciones TO app;
GRANT USAGE ON SEQUENCE filas_clientes_importaciones_id_seq TO app;
