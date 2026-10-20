-- 016 · Sombra de Marketing (20-oct-2026, rama claude/nube-clientes-vivo; rango 010-019). Solo aditiva.
-- Con PARAMETROS › motor_marketing = sombra, la intranet sigue guardando en la hoja y, antes, le pide al servidor
-- lo que HARIA (mismo codigo, sobre la base con las pestañas recien leidas). Aca queda esa prediccion; la
-- comparacion de la noche la cruza con la hoja.
CREATE TABLE marketing_sombra (
  id          bigserial PRIMARY KEY,
  cuando      timestamptz NOT NULL DEFAULT now(),
  fn          text NOT NULL,
  email       text NOT NULL,
  prediccion  jsonb NOT NULL,       -- { pestana: { cambios: [{ llave, celdas }], bajas: [llave] } }
  resultado   jsonb,                -- lo que habria contestado la funcion (o { error })
  ms          integer NOT NULL
);
CREATE INDEX marketing_sombra_cuando ON marketing_sombra (cuando);
GRANT SELECT, INSERT ON marketing_sombra TO app;
GRANT USAGE ON SEQUENCE marketing_sombra_id_seq TO app;
