-- 051 · Motor de reservas propio (20-oct-2026, rama claude/web-motor-reservas; rango 050-059 "Web y reservas").
-- Reemplaza a Wix Table Reservations. Diseño: Fase 2 §8 y Estudio web propia §3.2.
-- La aplica el Estudio con migrar.js: primero rosanta_ensayo, despues rosanta con respaldo. NO aplicada.
-- Va DESPUES de la 050 (tablas wix_*, de donde se carga la configuracion) y de la 013 (interruptores, ya en produccion).
--
-- Solo aditiva: tablas nuevas. No toca ninguna tabla existente (a interruptores solo le agrega dos filas).
-- Nombres revisados el 20-oct contra todas las ramas y migraciones (001-050) y la 052/053/054 de los otros
-- ayudantes: ninguno choca.
--
-- NO hay tabla "clientes": el CRM es de Fase 2 (filas_clientes, pestaña crm). Cada reserva guarda nombre,
-- correo, telefono E.164 y la llave del CRM ('e:'+correo en minusculas, o 't:'+ultimos 8 del telefono),
-- la misma que usa CRMSync.
--
-- La app (usuario "app") lee, agrega y cambia; NUNCA borra. Lo que "se quita" se apaga con activo = false
-- o se cancela con un estado.

-- ---------------------------------------------------------------- mesas
CREATE TABLE mesas (
  id             text PRIMARY KEY,                 -- id de Wix (tableDefinition) si vino de Wix; si no, propio
  nombre         text NOT NULL,                    -- el nombre que usa la sala: "Pergola3", "Jardin1"...
  zona           text NOT NULL DEFAULT '',         -- interior, pergola, jardin... (sale del nombre si viene de Wix)
  capacidad_min  integer NOT NULL CHECK (capacidad_min >= 0),
  capacidad_max  integer NOT NULL CHECK (capacidad_max >= 1),
  activa         boolean NOT NULL DEFAULT true,
  orden          integer NOT NULL DEFAULT 0,
  origen         text NOT NULL DEFAULT 'equipo' CHECK (origen IN ('wix', 'equipo')),
  actualizada    timestamptz NOT NULL DEFAULT now(),
  CHECK (capacidad_min <= capacidad_max)
);

-- Mesas que se pueden juntar (tableCombinations de Wix), cada una con su propio rango de personas.
CREATE TABLE mesas_combinaciones (
  id             text PRIMARY KEY,
  mesa_ids       text[] NOT NULL,
  capacidad_min  integer NOT NULL CHECK (capacidad_min >= 0),
  capacidad_max  integer NOT NULL CHECK (capacidad_max >= 1),
  activa         boolean NOT NULL DEFAULT true,
  origen         text NOT NULL DEFAULT 'equipo' CHECK (origen IN ('wix', 'equipo')),
  actualizada    timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------- horario y cierres
-- Franjas abiertas por dia de la semana (0 = domingo ... 6 = sabado), en hora de Guatemala.
-- "hasta" es la ULTIMA hora en que se puede reservar (como closeTime de Wix), no la hora de cerrar la puerta.
-- Medianoche se guarda como 23:59. intervalo, duracion, ritmo y aprobacion por fila son opcionales: sin valor
-- manda reglas_reservas.
CREATE TABLE horario_reservas (
  dia_semana               integer NOT NULL CHECK (dia_semana BETWEEN 0 AND 6),
  desde                    time NOT NULL,
  hasta                    time NOT NULL,
  intervalo_min            integer CHECK (intervalo_min BETWEEN 5 AND 120),
  duracion_min             integer CHECK (duracion_min BETWEEN 15 AND 1440),
  max_personas_franja      integer CHECK (max_personas_franja >= 0),   -- seatPacing
  max_grupos_franja        integer CHECK (max_grupos_franja >= 0),     -- partyPacing
  aprobacion_manual_desde  integer CHECK (aprobacion_manual_desde >= 1),
  activo                   boolean NOT NULL DEFAULT true,
  origen                   text NOT NULL DEFAULT 'equipo' CHECK (origen IN ('wix', 'equipo')),
  actualizado              timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (dia_semana, desde)
);

-- Cierres (feriados, eventos privados) y horarios especiales (specialHourPeriod de Wix).
-- cerrado = true: no se reserva en ese rango. cerrado = false: ese rango REEMPLAZA el horario de la semana
-- en los dias que toca (por ejemplo, abrir un lunes festivo). Reabrir = activo false (no se borra).
CREATE TABLE cierres_reservas (
  id             bigserial PRIMARY KEY,
  desde          timestamptz NOT NULL,
  hasta          timestamptz NOT NULL,
  cerrado        boolean NOT NULL DEFAULT true,
  motivo         text NOT NULL DEFAULT '',
  origen         text NOT NULL DEFAULT 'equipo' CHECK (origen IN ('wix', 'equipo', 'evento')),
  id_externo     text UNIQUE,                      -- id del periodo de Wix o de la cotizacion que lo cerro
  cotizacion_id  text,
  activo         boolean NOT NULL DEFAULT true,
  creado         timestamptz NOT NULL DEFAULT now(),
  por            text NOT NULL DEFAULT '',
  CHECK (desde < hasta)
);
CREATE INDEX cierres_reservas_rango ON cierres_reservas (desde, hasta) WHERE activo;

-- Reglas sueltas (clave → valor JSON). Las lee el motor en cada pedido. Sin fila = el valor por defecto
-- del codigo (cloud/app/src/reservas/reglas.js).
CREATE TABLE reglas_reservas (
  clave      text PRIMARY KEY,
  valor      jsonb NOT NULL,
  nota       text NOT NULL DEFAULT '',
  cambiado   timestamptz NOT NULL DEFAULT now(),
  por        text NOT NULL DEFAULT ''
);
INSERT INTO reglas_reservas (clave, valor, nota, por) VALUES
  ('tope_web',          '10',            'Hasta 10 personas por la web (como hoy). De 11 a 15 la web pide WhatsApp.', 'migracion 051'),
  ('tope_bot',          '15',            'Hasta 15 por el bot. Mas de 15: grupo_grande (evento, cotizador).', 'migracion 051'),
  ('evento_desde',      '16',            'Desde cuantas personas es un evento (pipeline de Eventos).', 'migracion 051'),
  ('aprobacion',        '"grupos"',      'automatica, manual o grupos (manual desde aprobacion_desde personas).', 'migracion 051'),
  ('aprobacion_desde',  '11',            'Desde cuantas personas la reserva queda pendiente de aprobacion.', 'migracion 051'),
  ('aprobacion_bot',    'false',         'false = el bot confirma directo, como hoy en Wix (el bot le dice al cliente confirmada). true = respeta la aprobacion manual.', 'migracion 051'),
  ('intervalo_min',     '15',            'Minutos entre franjas (timeSlotInterval).', 'migracion 051'),
  ('duracion_min',      '120',           'Duracion por defecto (defaultTurnoverTime).', 'migracion 051'),
  ('duraciones',        '[]',            'Duracion por tamaño de grupo: [{desde, hasta, minutos}] (turnoverTimeRules).', 'migracion 051'),
  ('ritmo_personas',    'null',          'Maximo de personas nuevas por franja (seatPacing). null = sin tope.', 'migracion 051'),
  ('ritmo_grupos',      'null',          'Maximo de reservas nuevas por franja (partyPacing). null = sin tope.', 'migracion 051'),
  ('aviso_minimo_min',  '0',             'Minutos minimos entre ahora y la reserva (minimumReservationNotice).', 'migracion 051'),
  ('aviso_maximo_dias', '365',           'Dias maximos hacia adelante (maximumReservationNotice).', 'migracion 051'),
  ('en_linea',          'true',          'Reservas en linea encendidas (onlineReservationsEnabled).', 'migracion 051'),
  ('pausa_hasta',       'null',          'Pausa de reservas en linea hasta esta fecha y hora (pauseSettings).', 'migracion 051'),
  ('usar_mesas',        'true',          'Asignar mesas (tableManagement.mode distinto de OFF).', 'migracion 051');

-- ---------------------------------------------------------------- reservas
CREATE TABLE reservas (
  id                  text PRIMARY KEY,            -- propio (uuid). Las que vienen de Wix conservan el id de Wix
  origen              text NOT NULL CHECK (origen IN ('web', 'bot_whatsapp', 'bot_instagram', 'bot_messenger', 'bot_correo',
                        'bot', 'restaurante', 'telefono', 'sala', 'evento', 'wix')),
  id_externo          text UNIQUE,                 -- id de Wix mientras Wix mande (y en el espejo)
  canal               text NOT NULL DEFAULT '',    -- lo que mando quien la creo (whatsapp, instagram, correo, restaurante, walk-in...)
  inicio              timestamptz NOT NULL,
  duracion_min        integer NOT NULL CHECK (duracion_min > 0),
  fin                 timestamptz NOT NULL,        -- inicio + duracion: la mesa queda tomada hasta aqui
  personas            integer NOT NULL CHECK (personas >= 1),
  mesa_ids            text[] NOT NULL DEFAULT '{}',
  estado              text NOT NULL CHECK (estado IN ('pendiente', 'confirmada', 'llego', 'termino', 'no_vino', 'cancelada', 'rechazada')),
  -- pendiente = REQUESTED (aprobacion manual); confirmada = RESERVED; llego = SEATED ("Llegó");
  -- termino = FINISHED (dispara la reseña); no_vino = NO_SHOW ("No vino"); rechazada = DECLINED
  aprobacion_manual   boolean NOT NULL DEFAULT false,
  nombre              text NOT NULL DEFAULT '',
  apellido            text NOT NULL DEFAULT '',
  email               text,                        -- en minusculas
  telefono            text,                        -- E.164
  llave_crm           text,                        -- 'e:'+correo o 't:'+ultimos 8 del telefono
  idioma              text NOT NULL DEFAULT 'es',
  optin               boolean,                     -- "Acepta contacto" (SI/NO); null = no contesto
  alergias            text NOT NULL DEFAULT '',
  sentarse            text NOT NULL DEFAULT '',    -- preferencia: Indoor, Pergola, Jardin
  conocio             text NOT NULL DEFAULT '',    -- como nos conocio
  nota_equipo         text NOT NULL DEFAULT '',    -- teamMessage
  consumo_q           numeric(14,2),               -- "Consumo total de la mesa (Q)": lo anota el equipo, nunca el formulario
  fuente_trafico      jsonb NOT NULL DEFAULT '{}', -- gclid, fbclid, utm... (masterPage.js)
  cotizacion_id       text,                        -- si viene de un evento del pipeline
  motivo_cancelacion  text,
  cancelada_por       text,
  motivo_rechazo      text,
  creada              timestamptz NOT NULL DEFAULT now(),
  actualizada         timestamptz NOT NULL DEFAULT now(),
  version             integer NOT NULL DEFAULT 1,
  CHECK (fin > inicio)
);
CREATE INDEX reservas_inicio ON reservas (inicio);
CREATE INDEX reservas_tel8 ON reservas (right(regexp_replace(coalesce(telefono, ''), '[^0-9]', '', 'g'), 8));
CREATE INDEX reservas_email ON reservas (email);
CREATE INDEX reservas_llave_crm ON reservas (llave_crm);

-- Cada cambio: creacion, estado, hora, personas, mesa, consumo, nota. Nunca se borra.
CREATE TABLE reservas_historial (
  id          bigserial PRIMARY KEY,
  reserva_id  text NOT NULL REFERENCES reservas(id),
  cuando      timestamptz NOT NULL DEFAULT now(),
  quien       text NOT NULL,                       -- 'web', 'bot:whatsapp', correo de quien la toco en el panel, 'carga-wix'
  evento      text NOT NULL,                       -- creada, cambiada, nota, estado, consumo, carga
  cambio      jsonb NOT NULL                       -- { antes: {...}, despues: {...} }
);
CREATE INDEX reservas_historial_reserva ON reservas_historial (reserva_id);

-- ---------------------------------------------------------------- lista de espera (tablas listas; la pantalla llega despues)
CREATE TABLE lista_espera (
  id           bigserial PRIMARY KEY,
  fecha        date NOT NULL,
  desde        time,
  hasta        time,
  personas     integer NOT NULL CHECK (personas >= 1),
  nombre       text NOT NULL DEFAULT '',
  email        text,
  telefono     text,
  llave_crm    text,
  idioma       text NOT NULL DEFAULT 'es',
  origen       text NOT NULL,
  estado       text NOT NULL DEFAULT 'esperando' CHECK (estado IN ('esperando', 'avisado', 'reservo', 'vencida', 'cancelada')),
  aviso_hasta  timestamptz,                        -- el enlace aparta la mesa hasta aqui (15 min)
  reserva_id   text REFERENCES reservas(id),
  notas        text NOT NULL DEFAULT '',
  creada       timestamptz NOT NULL DEFAULT now(),
  actualizada  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX lista_espera_fecha ON lista_espera (fecha) WHERE estado = 'esperando';

-- ---------------------------------------------------------------- interruptores (tabla de la 013)
-- motor_reservas: 'wix' (Wix manda; la nube solo copia y calcula en sombra) | 'base' (manda la base).
-- espejo_wix_reservas: 'apagado' | 'encendido' (copia cada reserva de la base en Wix). APAGADO hasta el 13-nov,
-- y se enciende solo con el si de Juanma ese dia.
INSERT INTO interruptores (modulo, modo, por) VALUES
  ('motor_reservas', 'wix', 'migracion 051'),
  ('espejo_wix_reservas', 'apagado', 'migracion 051')
ON CONFLICT (modulo) DO NOTHING;

-- ---------------------------------------------------------------- permisos de la app: lee, agrega y cambia; nunca borra
GRANT SELECT, INSERT, UPDATE ON mesas, mesas_combinaciones, horario_reservas, cierres_reservas, reglas_reservas,
  reservas, lista_espera TO app;
GRANT SELECT, INSERT ON reservas_historial TO app;
GRANT USAGE ON SEQUENCE cierres_reservas_id_seq, reservas_historial_id_seq, lista_espera_id_seq TO app;
