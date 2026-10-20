-- 040 · Reseñas y encuesta en la base (21-oct-2026, rama claude/nube-resenas-encuesta; rango 040-049,
-- asignado por el Estudio el 20-oct). Solo agrega tablas: no toca ninguna de 001-039.
--
-- Un solo escritor por dato. Hasta el dia unico (5-nov) el escritor de todo esto sigue siendo Apps Script
-- (panel-de-reseas-de-google y rosanta-encuesta, que escriben en sus hojas); la nube solo COPIA las hojas a
-- estas tablas y LEE Google Business Profile (sin publicar). Los interruptores 'resenas' y 'encuesta' van en
-- la tabla interruptores (migracion 013); sin fila = 'puente' (manda Apps Script).
-- TripAdvisor no entra: Juanma lo saco del sistema el 20-oct.

-- La hoja de control "Rosanta - Control de Reseñas GBP" › Reseñas, una fila por reseña (si el id se repite
-- en la hoja gana la fila mas nueva, igual que mapaBorradores_ del panel).
CREATE TABLE resenas_gbp (
  review_id        text PRIMARY KEY,
  fecha_detectada  timestamptz,
  estrellas        smallint NOT NULL DEFAULT 0,
  cliente          text NOT NULL DEFAULT '',
  resena           text NOT NULL DEFAULT '',
  respuesta        text NOT NULL DEFAULT '',     -- "Respuesta (editable)": borrador o lo publicado
  estado           text NOT NULL DEFAULT '',     -- PENDIENTE_APROBAR | PUBLICADA_AUTO | PUBLICADA_APROBADA | PUBLICADA_EDITADA | YA_TENIA_RESPUESTA | NO_RESPONDER
  aprobar          text NOT NULL DEFAULT '',
  fecha_publicada  timestamptz,
  fila_hoja        integer,                      -- de donde salio (null cuando la escriba la nube)
  escrito_por      text NOT NULL DEFAULT 'hoja', -- hoja | nube
  actualizado      timestamptz NOT NULL DEFAULT now()
);

-- Lo que Google Business Profile dice de cada reseña, segun el lector de la nube (solo lectura).
CREATE TABLE resenas_gbp_google (
  review_id        text PRIMARY KEY,
  estrellas        smallint NOT NULL DEFAULT 0,
  cliente          text NOT NULL DEFAULT '',
  resena           text NOT NULL DEFAULT '',
  creada           timestamptz,
  actualizada      timestamptz,
  respuesta        text NOT NULL DEFAULT '',     -- la respuesta publicada en Google ('' = sin responder)
  respuesta_fecha  timestamptz,
  visto            timestamptz NOT NULL DEFAULT now()
);

-- "Rosanta_Encuesta_Satisfaccion" › Encuesta 2026 (A Fecha | B Calificacion | C Que mejorar).
-- huella = fecha + calificacion + texto: la copia se puede repetir sin duplicar.
CREATE TABLE encuesta_respuestas (
  id               bigserial PRIMARY KEY,
  fecha            timestamptz NOT NULL,
  calificacion     smallint NOT NULL,
  mejorar          text NOT NULL DEFAULT '',
  huella           text NOT NULL UNIQUE,
  origen           text NOT NULL DEFAULT 'hoja',  -- hoja | nube
  fila_hoja        integer,
  creado           timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX encuesta_respuestas_fecha ON encuesta_respuestas (fecha);

-- Cada corrida de las tareas (copiar hojas, leer Google): para la comparacion y la alerta.
CREATE TABLE resenas_corridas (
  id               bigserial PRIMARY KEY,
  cuando           timestamptz NOT NULL DEFAULT now(),
  tarea            text NOT NULL,                 -- copiar-hojas | leer-google
  ok               boolean NOT NULL,
  resumen          jsonb NOT NULL
);

-- app copia y lee; no borra (una reseña que desaparece de la hoja se queda en la base).
GRANT SELECT, INSERT, UPDATE ON resenas_gbp, resenas_gbp_google TO app;
GRANT SELECT, INSERT ON encuesta_respuestas, resenas_corridas TO app;
GRANT USAGE ON SEQUENCE encuesta_respuestas_id_seq, resenas_corridas_id_seq TO app;
