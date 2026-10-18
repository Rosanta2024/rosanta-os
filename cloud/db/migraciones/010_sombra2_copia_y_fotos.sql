-- 010 · Sombra 2: Caja chica, Compras en efectivo y Clientes › Eventos (17-oct-2026, rama claude/nube-fase2-mkt).
-- Rango reservado 010-019 (acordado con la sesion del Estudio). No toca ninguna tabla de 001-009.
--
-- hojas_copia_f2: la copia de lectura del servicio rosanta-nube-sombra2, mismo formato que
-- hojas_copia (002), pero aparte: asi el reloj de Pagos y el de la sombra 2 nunca escriben la
-- misma fila.
CREATE TABLE hojas_copia_f2 (
  libro     text NOT NULL,          -- id del Sheet
  pestana   text NOT NULL,
  filas     jsonb NOT NULL,
  n_filas   integer NOT NULL,
  leida     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (libro, pestana)
);

-- La foto de cada noche: los numeros de Caja chica, Compras y Eventos armados con las hojas
-- releidas, y si la copia daba lo mismo. Una tabla para los tres (en vez de caja_fotos y
-- eventos_fotos): se comparan en la misma corrida.
CREATE TABLE caja_fotos (
  id              bigserial PRIMARY KEY,
  cuando          timestamptz NOT NULL DEFAULT now(),
  caja            jsonb,               -- resumen de Caja chica (saldo, descuadres, faltante, sobrante...)
  compras         jsonb,               -- resumen de Compras (retirado, registrado, por justificar...)
  eventos         jsonb,               -- filas y cantidad/monto por etapa del pipeline
  copia_leida     timestamptz,
  copia_al_dia    boolean NOT NULL,
  diferencias     jsonb NOT NULL,      -- [] si todo coincide
  celdas_error    jsonb NOT NULL
);

GRANT SELECT, INSERT, UPDATE, DELETE ON hojas_copia_f2 TO app;
GRANT SELECT, INSERT ON caja_fotos TO app;
GRANT USAGE ON SEQUENCE caja_fotos_id_seq TO app;
