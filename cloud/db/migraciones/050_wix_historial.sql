-- 050 · Historial de reservas de Wix en la base (20-oct-2026, rama claude/wix-historial-reservas).
-- Rango 050-059 "Web y reservas" (asignado por el Estudio el 20-oct). La aplica el Estudio con migrar.js:
-- primero rosanta_ensayo, despues rosanta con respaldo.
-- Solo aditiva: tablas nuevas con prefijo wix_. No toca ninguna tabla existente.
--
-- Las llena cloud/herramientas/importar-wix-reservas.js, que SOLO LEE la API de Wix
-- (GET y POST .../query). Repetir la importacion no duplica: la llave es el id de Wix.
-- Lo que cambia entre corridas (estado, hora, personas, mesa, notas) queda en wix_reservas_cambios.
-- La copia cruda de cada reserva (crudo) se guarda tal cual la devuelve Wix, para no perder campos.

CREATE TABLE wix_importaciones (
  id            bigserial PRIMARY KEY,
  inicio        timestamptz NOT NULL DEFAULT now(),
  fin           timestamptz,
  modo          text NOT NULL CHECK (modo IN ('seco', 'base')),
  desde         date,
  hasta         date,
  leidas        integer NOT NULL DEFAULT 0,
  nuevas        integer NOT NULL DEFAULT 0,
  cambiadas     integer NOT NULL DEFAULT 0,
  iguales       integer NOT NULL DEFAULT 0,
  mesas         integer NOT NULL DEFAULT 0,
  resumen       jsonb NOT NULL DEFAULT '{}',   -- conteos por estado, fuente y anio; sin datos personales
  comparacion   jsonb NOT NULL DEFAULT '{}',   -- contra Marketing OS (reservas) y el CRM; sin datos personales
  error         text
);

-- La configuracion de cada ubicacion de reservas: horarios, turnos, reglas, politicas y campos del formulario.
CREATE TABLE wix_ubicaciones (
  id               text PRIMARY KEY,           -- reservationLocation id de Wix
  nombre           text,
  revision         text,
  configuracion    jsonb NOT NULL,             -- configuration completo (onlineReservations, reservationForm, tableManagement...)
  crudo            jsonb NOT NULL,
  importada        timestamptz NOT NULL DEFAULT now(),
  actualizada      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE wix_mesas (
  id               text PRIMARY KEY,           -- tableDefinition id de Wix
  ubicacion_id     text NOT NULL REFERENCES wix_ubicaciones(id),
  nombre           text NOT NULL,              -- p. ej. "Pergola3": el nombre que usa la sala
  asientos_min     integer,
  asientos_max     integer,
  activa           boolean,
  borrada          boolean NOT NULL DEFAULT false,  -- viene de deletedTableDefinitions (las reservas viejas la nombran)
  crudo            jsonb NOT NULL,
  actualizada      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE wix_reservas (
  id                 text PRIMARY KEY,         -- id de Wix
  revision           bigint,
  estado             text NOT NULL,            -- RESERVED, CANCELED, FINISHED, NO_SHOW, SEATED, REQUESTED, DECLINED, HELD...
  fuente             text,                     -- ONLINE, OFFLINE, WALK_IN
  ubicacion_id       text,
  inicio             timestamptz,
  fin                timestamptz,
  personas           integer,
  mesa_ids           text[] NOT NULL DEFAULT '{}',
  mesa_nombres       text[] NOT NULL DEFAULT '{}',
  nombre             text,
  apellido           text,
  email              text,
  telefono           text,                     -- tal cual Wix (E.164)
  contacto_id        text,
  reservado_por_id   text,
  consentimiento     boolean,                  -- marketingConsent
  campos             jsonb NOT NULL DEFAULT '{}',  -- customFields por NOMBRE del campo (alergias, zona, ocasion, como nos conocio, consumo...)
  campos_ids         jsonb NOT NULL DEFAULT '{}',  -- customFields crudos (id del campo -> valor)
  optin              text,                     -- campo 88cadd96... (SI/NO)
  consumo_q          numeric(14,2),            -- campo bf07b3fc... "Consumo total de la mesa (Q)"
  notas_equipo       text,                     -- teamMessage
  motivo_rechazo     text,                     -- declineReason
  estado_pago        text,                     -- paymentStatus
  archivada          boolean,
  creada             timestamptz,
  cambiada           timestamptz,
  crudo              jsonb NOT NULL,
  huella             text NOT NULL,            -- sha256 del crudo: si no cambio, no se reescribe
  primera_vez        timestamptz NOT NULL DEFAULT now(),
  ultima_vez         timestamptz NOT NULL DEFAULT now(),
  importacion_id     bigint REFERENCES wix_importaciones(id)
);
CREATE INDEX wix_reservas_inicio ON wix_reservas (inicio);
CREATE INDEX wix_reservas_email ON wix_reservas (lower(email));
CREATE INDEX wix_reservas_tel8 ON wix_reservas (right(regexp_replace(coalesce(telefono, ''), '[^0-9]', '', 'g'), 8));

-- Cada cambio visto entre dos importaciones (Wix no da el historial de cambios por API:
-- desde la primera corrida, cada corrida compara contra la anterior y anota lo que cambio).
CREATE TABLE wix_reservas_cambios (
  id               bigserial PRIMARY KEY,
  reserva_id       text NOT NULL REFERENCES wix_reservas(id),
  visto            timestamptz NOT NULL DEFAULT now(),
  importacion_id   bigint REFERENCES wix_importaciones(id),
  campos           text[] NOT NULL,           -- p. ej. {estado, inicio}
  antes            jsonb NOT NULL,
  despues          jsonb NOT NULL
);
CREATE INDEX wix_reservas_cambios_reserva ON wix_reservas_cambios (reserva_id);

-- app: lee y escribe, nunca borra.
GRANT SELECT, INSERT, UPDATE ON wix_importaciones, wix_ubicaciones, wix_mesas, wix_reservas TO app;
GRANT SELECT, INSERT ON wix_reservas_cambios TO app;
GRANT USAGE ON SEQUENCE wix_importaciones_id_seq, wix_reservas_cambios_id_seq TO app;
