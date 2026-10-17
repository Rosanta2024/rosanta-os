-- 003 · La foto de cada noche de Pagos (Fase 1, comparacion automatica, 17-oct-2026).
-- Cada noche el servidor relee las hojas directo de Google, las compara con la copia que usa la
-- pantalla y guarda los totales que ve el dueño (los mismos del recuadro de arriba de Pagos) y el
-- cuadre por proveedor. Juanma compara esta foto con la intranet una o dos veces por semana.
CREATE TABLE pagos_fotos (
  id              bigserial PRIMARY KEY,
  cuando          timestamptz NOT NULL DEFAULT now(),
  por_pagar_n     integer NOT NULL,
  por_pagar_q     numeric(14,2) NOT NULL,
  vence_hoy       integer NOT NULL,
  cuadre          jsonb NOT NULL,      -- [{nit, proveedor, n, facturado, pagado, pendiente, ...}]
  copia_leida     timestamptz,         -- la copia que usaba la pantalla
  copia_al_dia    boolean NOT NULL,    -- la copia daba lo mismo que leer las hojas de nuevo
  diferencias     jsonb NOT NULL,      -- [] si todo coincide
  celdas_error    jsonb NOT NULL       -- {pestana: n} celdas con #REF!, #N/A, etc.
);

GRANT SELECT, INSERT ON pagos_fotos TO app;
GRANT USAGE ON SEQUENCE pagos_fotos_id_seq TO app;
