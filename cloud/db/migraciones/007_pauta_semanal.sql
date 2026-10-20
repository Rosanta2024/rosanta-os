-- 007 · pauta_semanal en la base (20-oct-2026, rama claude/proc-pauta; rango 001-009). Solo aditiva.
--
-- La pestaña pauta_semanal de "Rosanta Marketing OS" pasa a vivir aca. Contrato con la Fase 2 (dueña de
-- Marketing OS en la nube, que solo LEE esta tabla):
--   * llave wk (semana ISO de 2026, como en la hoja); una columna por dato, con el MISMO nombre que el
--     encabezado de la hoja (entre comillas: "gCosto" no es gcosto). Orden de la hoja = SCHEMA.pauta_semanal
--     de la intranet (MarketingDatos.js) + "repetidos", que ClientesNuevos.js agrega al final.
--   * cada escritor actualiza SOLO sus columnas (cloud/app/src/proc-pauta.js):
--       Google Ads Script (sigue en Google Ads, se IMPORTA de la hoja): gCosto gClics gImp mCosto mAlcance fecha_registro
--       WixReservasPauta.js:  reservas comensalesReserva
--       PosPauta.js:          comensales ticket
--       ClientesNuevos.js:    clientes_nuevos repetidos
--   * fecha_registro es la de la hoja (la escribe el Google Ads Script: el domingo de la semana). La hora en
--     que cada escritor de la nube puso lo suyo va en act_wix, act_pos, act_clientes, act_ads.
-- Vacio en la hoja = NULL aca.
CREATE TABLE pauta_semanal (
  wk                   integer PRIMARY KEY CHECK (wk BETWEEN 1 AND 53),
  "gCosto"             numeric,
  "gClics"             numeric,
  "gImp"               numeric,
  "mCosto"             numeric,
  "mAlcance"           numeric,
  reservas             numeric,
  fecha_registro       date,
  comensales           numeric,
  "comensalesReserva"  numeric,
  ticket               numeric,
  clientes_nuevos      numeric,
  repetidos            numeric,
  act_wix              timestamptz,
  act_pos              timestamptz,
  act_clientes         timestamptz,
  act_ads              timestamptz
);

-- Cada corrida de POST /tareas/procesos/pauta, un renglon por escritor: que modo tenia, que calculo, en que
-- semanas difiere de la hoja (sombra) o que escribio (nube). Sirve para seguir la sombra lunes a lunes.
CREATE TABLE pauta_corridas (
  id           bigserial PRIMARY KEY,
  cuando       timestamptz NOT NULL DEFAULT now(),
  modulo       text NOT NULL,          -- pauta_wix | pauta_pos | pauta_clientes | pauta_ads_import
  modo         text NOT NULL,          -- sombra | nube
  ahora        timestamptz,            -- el reloj simulado, si se reprodujo un lunes pasado
  ok           boolean NOT NULL,
  semanas      jsonb NOT NULL DEFAULT '{}'::jsonb,   -- {wk: {columna: valor}} lo que calculo
  diferencias  jsonb NOT NULL DEFAULT '[]'::jsonb,   -- [{wk, columna, hoja, nube}]
  escritas     jsonb NOT NULL DEFAULT '{}'::jsonb,   -- {base: n, hoja: n}
  error        text NOT NULL DEFAULT '',
  ms           integer NOT NULL DEFAULT 0
);
CREATE INDEX pauta_corridas_cuando ON pauta_corridas (modulo, cuando);

-- app escribe sus columnas y anota las corridas; nunca borra.
GRANT SELECT, INSERT, UPDATE ON pauta_semanal TO app;
GRANT SELECT, INSERT ON pauta_corridas TO app;
GRANT USAGE ON SEQUENCE pauta_corridas_id_seq TO app;
