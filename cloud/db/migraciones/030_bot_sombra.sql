-- 030 · Bot en sombra (19-oct-2026, rama claude/nube-bot-sombra). Rango 030-039: bot, reseñas y encuesta
-- (acordado con el Estudio y con la sesion de la Fase 2). Solo agrega tablas: no toca ninguna de 001-029.
--
-- Cada corrida del reproductor (cada noche, o a mano) y cada mensaje comparado. TODO anonimizado: el
-- chat es un id de mentira, el nombre es un alias y los telefonos y correos del texto estan cambiados.
CREATE TABLE bot_corridas (
  id           bigserial PRIMARY KEY,
  cuando       timestamptz NOT NULL DEFAULT now(),
  modo         text NOT NULL CHECK (modo IN ('grabado', 'modelo')),
  desde        timestamptz NOT NULL,
  hasta        timestamptz NOT NULL,
  version_bot  text NOT NULL,           -- "@58 · 2026-10-17T10:16:30-06:00 · 4eae1b3"
  copia_leida  timestamptz,
  resumen      jsonb NOT NULL,           -- turnos, iguales, por medida, diferencias
  gasto        jsonb,                    -- llamadas y tokens del modelo (modo modelo)
  costo_usd    numeric(10,4)
);

CREATE TABLE bot_turnos (
  id           bigserial PRIMARY KEY,
  corrida      bigint NOT NULL REFERENCES bot_corridas(id),
  chat         text NOT NULL,
  canal        text NOT NULL,
  nombre       text,
  t            timestamptz NOT NULL,
  cliente      text,
  real         jsonb NOT NULL,           -- contesto, categoria, humano, idioma, respuesta del bot real
  sombra       jsonb NOT NULL,           -- lo mismo, de la sombra, mas botones, wix y avisos
  diferencias  jsonb NOT NULL            -- [] si hizo lo mismo
);
CREATE INDEX bot_turnos_corrida ON bot_turnos (corrida);

GRANT SELECT, INSERT ON bot_corridas, bot_turnos TO app;
GRANT USAGE ON SEQUENCE bot_corridas_id_seq, bot_turnos_id_seq TO app;
