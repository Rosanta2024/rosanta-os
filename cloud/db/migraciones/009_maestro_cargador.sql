-- 009 · El cargador del maestro financiero en la nube (21-oct-2026, rama claude/proc-maestro; rango 001-009).
-- Solo aditiva. SIN APLICAR: se aplica con `migrar.js --aplicar --base rosanta --solo 009_maestro_cargador.sql`
-- y el sí de Juanma.
--
-- El maestro (Sheet 1_ZiUlIUG3...) se queda en Sheets. cloud/app/src/proc-maestro.js corre el cargador.js REAL
-- (cargarUltimasSemanas) con el interruptor `maestro_cargador` de la tabla interruptores (migracion 013; sin fila =
-- 'apps'). Esta migracion NO toca interruptores: el modo se pone con la cuenta de migraciones, por ejemplo
--   INSERT INTO interruptores (modulo, modo, por) VALUES ('maestro_cargador', 'sombra', 'Juanma')
--   ON CONFLICT (modulo) DO UPDATE SET modo = EXCLUDED.modo, por = EXCLUDED.por, cambiado = now();

-- El registro de archivos procesados: lo que en Apps Script es la Propiedad rosanta_archivos_procesados
-- ({"<id del archivo>:<ms de la ultima modificacion>": 1}). Solo lo usa el modo nube; un archivo que cambia en
-- Drive tiene otra huella y se vuelve a revisar (la deduplicacion del cargador evita repetidos). Un BANCO_BI
-- frenado no se anota (lo decide el codigo real): la proxima corrida lo reintenta.
CREATE TABLE maestro_archivos_procesados (
  huella      text PRIMARY KEY,
  archivo_id  text NOT NULL,
  procesado   timestamptz NOT NULL DEFAULT now()
);

-- Cada corrida de POST /tareas/procesos/maestro: el modo, los archivos que abrio el cargador (carpeta, nombre,
-- tipo, filas que agrego), el resumen (sombra: filas_que_agregaria, iguales, distintas, faltan; nube: escritas,
-- relectura) y los avisos del cargador (proveedores nuevos, eventos sin comensales, bancos frenados).
CREATE TABLE maestro_corridas (
  id        bigserial PRIMARY KEY,
  cuando    timestamptz NOT NULL DEFAULT now(),
  modo      text NOT NULL,                       -- sombra | nube
  ahora     timestamptz,                         -- el reloj simulado, si se reprodujo un lunes pasado
  ok        boolean NOT NULL,
  archivos  jsonb NOT NULL DEFAULT '[]'::jsonb,
  resumen   jsonb NOT NULL DEFAULT '{}'::jsonb,
  error     text NOT NULL DEFAULT '',
  ms        integer NOT NULL DEFAULT 0
);
CREATE INDEX maestro_corridas_cuando ON maestro_corridas (cuando);

-- app anota; nunca borra ni cambia lo anotado ("Volver a revisar todo" no existe en la nube).
GRANT SELECT, INSERT ON maestro_archivos_procesados TO app;
GRANT SELECT, INSERT ON maestro_corridas TO app;
GRANT USAGE ON SEQUENCE maestro_corridas_id_seq TO app;
