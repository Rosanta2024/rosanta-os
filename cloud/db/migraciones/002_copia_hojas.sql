-- 002 · Copia de lectura de las hojas de Google (Fase 1, 17-oct-2026).
-- Las hojas siguen mandando: el maestro, COMPRAS_2026 y las pestañas de Config que Pagos lee.
-- El servidor las copia aca (tarea /tareas/refrescar-copia) y Pagos lee de la copia, no de Google.
-- filas = la pestaña completa como la devuelve getValues() de Apps Script; las fechas van como
-- {"$d": "AAAA-MM-DDTHH:MM:SS"} (hora de Guatemala), igual que el arnes de la intranet.
CREATE TABLE hojas_copia (
  libro     text NOT NULL,          -- id del Sheet
  pestana   text NOT NULL,
  filas     jsonb NOT NULL,
  n_filas   integer NOT NULL,
  leida     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (libro, pestana)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON hojas_copia TO app;
