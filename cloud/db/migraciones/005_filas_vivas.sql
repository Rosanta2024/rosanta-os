-- 005 · Filas de las pestañas de Caja en modo en vivo (18-oct-2026, pedido de Juanma).
-- CAJA_CHICA y RETIROS_SOLICITUDES (llave: ID) y CIERRES_DIARIOS (llave: FECHA AAAA-MM-DD).
-- Mismo patron que pagos_proveedores (004): celdas = la fila EXACTA de la hoja, origen hoja|servidor,
-- nunca se borra una fila (un error se marca ANULADO en el estatus), copiado_a_hoja vigila la copia.
-- Las tablas con tipo del diseño de la Fase 2 (caja_chica, retiros_solicitudes, cierres_diarios)
-- pueden armarse despues como vistas sobre esta; esta tabla no las contradice.
CREATE TABLE filas_vivas (
  pestana         text NOT NULL CHECK (pestana IN ('CAJA_CHICA', 'RETIROS_SOLICITUDES', 'CIERRES_DIARIOS')),
  llave           text NOT NULL,
  celdas          jsonb NOT NULL,
  origen          text NOT NULL DEFAULT 'hoja' CHECK (origen IN ('hoja', 'servidor')),
  orden           integer,
  actualizado     timestamptz NOT NULL DEFAULT now(),
  copiado_a_hoja  timestamptz,
  PRIMARY KEY (pestana, llave)
);

CREATE TABLE filas_vivas_importaciones (
  id            bigserial PRIMARY KEY,
  cuando        timestamptz NOT NULL DEFAULT now(),
  pestana       text NOT NULL,
  filas_hoja    integer NOT NULL,
  nuevas        integer NOT NULL,
  actualizadas  integer NOT NULL,
  problemas     jsonb NOT NULL
);

GRANT SELECT, INSERT, UPDATE ON filas_vivas TO app;   -- sin DELETE
GRANT SELECT, INSERT ON filas_vivas_importaciones TO app;
GRANT USAGE ON SEQUENCE filas_vivas_importaciones_id_seq TO app;
