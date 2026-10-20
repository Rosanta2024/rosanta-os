-- 032 · Canal de correo del bot en la nube, en SOMBRA (20-oct-2026, rama claude/nube-bot-sombra; rango 030-039). Solo agrega una tabla.
-- Con bot_estado › INTERRUPTOR_CORREO = 'sombra', la nube lee Gmail y piensa la respuesta, pero no manda nada:
-- aquí queda lo que HABRÍA hecho (respuesta, borrador, aviso a Juanma, cambio en Wix, WhatsApp), para compararlo
-- cada noche con lo que hizo el bot de Apps Script en el mismo hilo.
CREATE TABLE bot_correo_sombra (
  id           bigserial PRIMARY KEY,
  cuando       timestamptz NOT NULL DEFAULT now(),
  tipo         text NOT NULL,            -- respuesta | borrador | aviso | correo | wix:<ruta> | whatsapp
  hilo         text NOT NULL DEFAULT '', -- id del hilo de Gmail (respuesta y borrador)
  mensaje      text NOT NULL DEFAULT '', -- id del mensaje del cliente que se contestó
  para         text NOT NULL DEFAULT '',
  asunto       text NOT NULL DEFAULT '',
  cuerpo       text NOT NULL DEFAULT '',
  comparado    text                      -- lo que dijo la comparación de la noche (igual | distinto: ...)
);
CREATE INDEX bot_correo_sombra_cuando ON bot_correo_sombra (cuando);

GRANT SELECT, INSERT, UPDATE ON bot_correo_sombra TO app;
GRANT USAGE ON SEQUENCE bot_correo_sombra_id_seq TO app;
