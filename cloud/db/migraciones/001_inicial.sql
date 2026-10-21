-- 001 · Estructura inicial (Fase 0, 17-oct-2026).
-- La aplica cloud/herramientas/migrar.js como el usuario postgres, dentro de una transaccion.
-- Regla: una migracion ya aplicada NO se edita; un cambio va en un archivo nuevo (002_...).

-- Copia de la hoja USUARIOS (la hoja manda). token_huella = sha256 del token ?u=, nunca el token.
CREATE TABLE usuarios (
  email         text PRIMARY KEY,
  rol           text NOT NULL,
  modulos       text[] NOT NULL DEFAULT '{}',
  puede_editar  boolean NOT NULL DEFAULT false,
  nombre        text NOT NULL DEFAULT '',
  token_huella  text UNIQUE,
  sincronizado  timestamptz NOT NULL DEFAULT now()
);

-- Pagos a proveedores: las 12 columnas de PAGOS_PROVEEDORES (PagosProveedores.js › PAG_COLS_).
-- Fase 1. Una fila por movimiento y nunca se borra: un error se marca ANULADO en el estatus.
-- Fechas como date (AAAA-MM-DD, sin hora: la leccion de p120). Montos con 2 decimales exactos.
CREATE TABLE pagos_proveedores (
  id               text PRIMARY KEY,
  area             text NOT NULL,
  proveedor        text NOT NULL DEFAULT '',
  dte              text NOT NULL DEFAULT '',
  fecha_de_pagar   date,
  fecha_pagado     date,
  cantidad_pagada  numeric(14,2),
  estatus          text NOT NULL,
  nit              text NOT NULL DEFAULT '',
  detalle          text NOT NULL DEFAULT '',
  escrito_por      text NOT NULL DEFAULT '',
  registrado       timestamptz NOT NULL DEFAULT now(),
  copiado_a_hoja   timestamptz            -- cuando quedo escrita en la hoja (copia de lectura)
);
CREATE INDEX pagos_proveedores_nit ON pagos_proveedores (nit);
CREATE INDEX pagos_proveedores_dte ON pagos_proveedores (dte);

-- Cronometro de guardados, como Tiempos.js: servidor (por tramo) y pantalla (clic → ✓).
CREATE TABLE tiempos (
  id        bigserial PRIMARY KEY,
  cuando    timestamptz NOT NULL DEFAULT now(),
  accion    text NOT NULL,
  donde     text NOT NULL CHECK (donde IN ('servidor', 'pantalla')),
  ms        integer NOT NULL,
  tramos    jsonb,
  quien     text
);

-- La aplicacion entra con el usuario "app": lee y escribe, pero no borra pagos ni cambia tablas.
GRANT SELECT, INSERT, UPDATE, DELETE ON usuarios TO app;
GRANT SELECT, INSERT, UPDATE ON pagos_proveedores TO app;
GRANT SELECT, INSERT ON tiempos TO app;
GRANT USAGE ON SEQUENCE tiempos_id_seq TO app;
