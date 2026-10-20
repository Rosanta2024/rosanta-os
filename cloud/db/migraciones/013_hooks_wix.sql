-- 013 · Receptores de Wix en rosanta-nube (20-oct-2026, rama claude/nube-fase2-mkt; rango 010-019).
-- (012 quedo en la rama claude/nube-clientes-vivo, aplicada solo en rosanta_ensayo.)
--
-- interruptores: un modo por modulo, en la base, para el dia unico (orden del 20-oct). Cambiarlo es
-- la vuelta atras de 1 minuto (el servidor lo relee cada 30 s). Sin fila = 'puente'.
--   hooks_carrito, hooks_reserva: 'puente' (reenvia al /exec viejo) | 'base'
CREATE TABLE interruptores (
  modulo    text PRIMARY KEY,
  modo      text NOT NULL,
  cambiado  timestamptz NOT NULL DEFAULT now(),
  por       text NOT NULL DEFAULT ''
);
INSERT INTO interruptores (modulo, modo, por) VALUES ('hooks_carrito', 'puente', 'migracion 013'), ('hooks_reserva', 'puente', 'migracion 013');

-- Cada pedido aceptado de Wix (ya limpio): para la comparacion de la noche y para reproducir lo historico.
CREATE TABLE hooks_wix_recibidos (
  id         bigserial PRIMARY KEY,
  recibido   timestamptz NOT NULL DEFAULT now(),
  hook       text NOT NULL,          -- carrito | reserva
  cuerpo     jsonb NOT NULL,
  modo       text NOT NULL,          -- puente | base
  estado     integer NOT NULL,       -- lo que se le contesto a Wix
  ms         integer NOT NULL,
  respuesta  text NOT NULL DEFAULT ''
);
CREATE INDEX hooks_wix_recibidos_cuando ON hooks_wix_recibidos (hook, recibido);

-- app lee los interruptores y guarda lo recibido; el modo se cambia con la cuenta de migraciones.
GRANT SELECT ON interruptores TO app;
GRANT SELECT, INSERT ON hooks_wix_recibidos TO app;
GRANT USAGE ON SEQUENCE hooks_wix_recibidos_id_seq TO app;
