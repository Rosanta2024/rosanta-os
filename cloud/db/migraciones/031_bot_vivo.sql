-- 031 · Bot en vivo, APAGADO (19-oct-2026, rama claude/nube-bot-sombra; rango 030-039). Solo agrega tablas.
-- Se usa solo cuando Juanma diga que si al paso a vivo; mientras tanto quedan vacias.
--
-- bot_estado: lo que el bot de Apps Script guarda en Propiedades y en el Cache (quien espera a Juanma,
-- historial corto, pausas, mensajes ya atendidos, configuracion). Las CLAVES no van aqui: van en Secret Manager.
-- Borrar = valor NULL (el usuario app no borra filas).
CREATE TABLE bot_estado (
  clave        text PRIMARY KEY,
  tipo         text NOT NULL CHECK (tipo IN ('prop', 'cache')),
  valor        text,
  vence        timestamptz,              -- solo cache
  actualizado  timestamptz NOT NULL DEFAULT now()
);

-- Cada mensaje que llega por el webhook y que paso con el (para vigilar el paso a vivo).
CREATE TABLE bot_eventos (
  id           bigserial PRIMARY KEY,
  recibido     timestamptz NOT NULL DEFAULT now(),
  objeto       text,                     -- whatsapp_business_account | instagram | page
  modo         text NOT NULL,            -- vivo | puente
  resultado    text NOT NULL,            -- atendido | reenviado | reenviado_por_error | error | ignorado
  envios       integer NOT NULL DEFAULT 0,
  ms           integer,
  error        text
);
CREATE INDEX bot_eventos_recibido ON bot_eventos (recibido);

-- Correos del bot ("Lead para atender", avisos de reservas) que no se pudieron mandar al momento: se reintentan.
CREATE TABLE bot_correos (
  id           bigserial PRIMARY KEY,
  creado       timestamptz NOT NULL DEFAULT now(),
  para         text NOT NULL,
  asunto       text NOT NULL,
  cuerpo       text NOT NULL,
  enviado      timestamptz,
  intentos     integer NOT NULL DEFAULT 0,
  error        text
);

GRANT SELECT, INSERT, UPDATE ON bot_estado, bot_correos TO app;
GRANT SELECT, INSERT ON bot_eventos TO app;
GRANT USAGE ON SEQUENCE bot_eventos_id_seq, bot_correos_id_seq TO app;
