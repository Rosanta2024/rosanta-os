-- 033 · Bot: "sombra viva" (20-oct-2026, aprobada por Juanma; rama claude/nube-bot-sombra; rango 030-039). Solo agrega una tabla.
-- Con Meta apuntando a la nube en modo PUENTE (cada mensaje se le reenvía tal cual al bot de Apps Script), la nube
-- además PIENSA cada mensaje real con el código del bot, SIN mandar nada (el servicio en puente no tiene las claves de
-- Meta), y aquí queda lo que habría contestado. Cada noche se compara con lo que contestó el bot de siempre.
CREATE TABLE bot_sombra_viva (
  id           bigserial PRIMARY KEY,
  recibido     timestamptz NOT NULL DEFAULT now(),
  canal        text NOT NULL,              -- whatsapp | instagram | messenger
  contacto     text NOT NULL,              -- id del cliente en ese canal (para emparejar con Conversaciones)
  mensaje_id   text NOT NULL DEFAULT '',
  cliente      text NOT NULL DEFAULT '',   -- lo que escribió (o "📷 [Foto]", "🔘 botón")
  respuesta    text NOT NULL DEFAULT '',   -- lo que habría contestado (vacío = se habría callado)
  botones      jsonb,
  acciones     jsonb,                      -- { wix: [...rutas], aviso: true|false, humano: true|false }
  estado       text NOT NULL DEFAULT 'pensado',   -- pensado | omitido_tope | error
  error        text,
  comparado    text,                       -- igual | distinto: ... (la comparación de la noche)
  grave        boolean
);
CREATE INDEX bot_sombra_viva_recibido ON bot_sombra_viva (recibido);

GRANT SELECT, INSERT, UPDATE ON bot_sombra_viva TO app;
GRANT USAGE ON SEQUENCE bot_sombra_viva_id_seq TO app;
