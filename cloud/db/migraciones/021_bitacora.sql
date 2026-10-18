-- 021 · Bitacora de correcciones y borrados (sesion C, 17-oct-2026). Rango 020–029 = accesos.
-- Aprobado por Juanma el 17-oct (propuesta del mentor):
--   (1) cada correccion o borrado del equipo queda aca: quien, cuando, valor anterior y nuevo;
--       el borrado es LOGICO (el registro se marca, no se pierde);
--   (2) si la correccion cae en un mes ya reportado al contador, se avisa a Juanma (no se bloquea).
-- La app escribe una fila por cada 'corregir' que permite permisos.js. Nadie la edita ni la borra.

CREATE TABLE bitacora (
  id            bigserial PRIMARY KEY,
  cuando        timestamptz NOT NULL DEFAULT now(),
  quien         text NOT NULL,                 -- correo de quien hizo el cambio
  rol           text NOT NULL,
  parte         text NOT NULL,                 -- la misma clave de permisos.parte (pagos, caja, ...)
  tabla         text NOT NULL,
  registro_id   text NOT NULL,
  accion        text NOT NULL CHECK (accion IN ('corregir', 'borrar')),
  antes         jsonb,
  despues       jsonb,                         -- en un borrado: el registro con su marca de anulado
  fecha_registro date,                         -- la fecha del movimiento corregido (AAAA-MM-DD)
  mes_cerrado   boolean NOT NULL DEFAULT false,
  avisado       timestamptz                    -- cuando salio el aviso a Juanma (solo si mes_cerrado)
);
CREATE INDEX bitacora_registro ON bitacora (tabla, registro_id);
CREATE INDEX bitacora_sin_avisar ON bitacora (avisado) WHERE mes_cerrado AND avisado IS NULL;

-- Meses reportados al contador: el aviso compara fecha_registro contra esta lista.
CREATE TABLE meses_cerrados (
  mes        text PRIMARY KEY CHECK (mes ~ '^\d{4}-\d{2}$'),   -- AAAA-MM
  cerrado_el date NOT NULL,
  nota       text NOT NULL DEFAULT ''
);

GRANT SELECT, INSERT ON bitacora TO app;
GRANT UPDATE (avisado) ON bitacora TO app;
GRANT USAGE ON SEQUENCE bitacora_id_seq TO app;
GRANT SELECT ON meses_cerrados TO app;
