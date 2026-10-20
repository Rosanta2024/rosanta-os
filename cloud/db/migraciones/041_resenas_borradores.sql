-- 041 · Borradores de respuesta en sombra (21-oct-2026, rama claude/nube-resenas-encuesta; rango 040-049).
-- Solo agrega una tabla. Un borrador por reseña: la sombra redacta con las reglas reales del bot de reseñas y
-- compara la DECISION (publicar sola o pedir aprobacion) con la que tomo Apps Script. Nada se publica.
CREATE TABLE resenas_borradores (
  id             bigserial PRIMARY KEY,
  review_id      text NOT NULL UNIQUE,
  cuando         timestamptz NOT NULL DEFAULT now(),
  modo           text NOT NULL DEFAULT 'sombra',   -- sombra | vivo
  modelo         text NOT NULL,
  estrellas      smallint NOT NULL,
  texto          text NOT NULL,
  confiable      boolean NOT NULL,
  decision       text NOT NULL,                    -- publicar_sola | aprobar
  decision_hoja  text NOT NULL DEFAULT '',         -- lo que hizo Apps Script ('' = no comparable)
  fallo          text NOT NULL DEFAULT '',         -- codigo HTTP si Claude no contesto (se uso el texto de respaldo)
  tokens_in      integer NOT NULL DEFAULT 0,
  tokens_out     integer NOT NULL DEFAULT 0,
  costo_usd      numeric(10,5) NOT NULL DEFAULT 0
);
CREATE INDEX resenas_borradores_cuando ON resenas_borradores (cuando);

GRANT SELECT, INSERT ON resenas_borradores TO app;
GRANT USAGE ON SEQUENCE resenas_borradores_id_seq TO app;
