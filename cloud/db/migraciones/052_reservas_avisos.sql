-- 052 · Avisos de reservas: correos y WhatsApp transaccionales (20-oct-2026, rama claude/web-panel-avisos,
-- Ayudante 2 del equipo "Estudio: web propia sin Wix"). Rango 050-059 "Web y reservas".
-- La aplica el Estudio con migrar.js: primero rosanta_ensayo, despues rosanta con respaldo. NO aplicada.
-- Va DESPUES de la 051 (motor de reservas). reserva_id es el id de `reservas` SIN llave foranea: los avisos al
-- equipo de un grupo grande del bot no tienen reserva (llevan 'grupo:<huella>').
--
-- Solo aditiva: tablas nuevas. No toca ninguna tabla existente.
-- La app (usuario "app") lee, agrega y cambia; NUNCA borra.
--
-- Codigo: cloud/app/src/reservas-avisos/ (avisos.js, envios.js, relojes.js, rutas.js).
-- Textos: cloud/app/avisos/plantillas.en.md y plantillas.es.md.

-- ---------------------------------------------------------------- envios
-- Cada aviso que sale, que esta en cola o que no salio (y por que). Asi se contesta "¿le llego la confirmacion?".
-- clave = plantilla:reserva[:lo que lo hace distinto]:canal, UNICA: el mismo aviso NUNCA sale dos veces.
--   Recordatorios: lo distinto es la hora de la reserva (si cambia la hora, toca un recordatorio nuevo).
--   Cambio: la hora y las personas nuevas. Confirmacion, cancelacion y reseña: una sola vez por reserva.
-- ficha: valor al azar que pone quien inserta; si al leer la fila la ficha es la suya, el aviso es nuevo.
CREATE TABLE envios (
  id                   bigserial PRIMARY KEY,
  clave                text NOT NULL UNIQUE,
  ficha                text NOT NULL,
  reserva_id           text NOT NULL,
  canal                text NOT NULL CHECK (canal IN ('correo', 'whatsapp')),
  plantilla            text NOT NULL,           -- confirmacion, pendiente, aprobada, rechazada, cambio, cancelacion,
                                                -- recordatorio_24h, recordatorio_dia, resena, equipo_nueva, equipo_cancelada,
                                                -- equipo_grupo_grande
  idioma               text NOT NULL CHECK (idioma IN ('en', 'es')),
  para_equipo          boolean NOT NULL DEFAULT false,
  destinatario         text NOT NULL,           -- tapado: "ma***@gmail.com", "+502 ••••1234" (para que la sala reconozca)
  destinatario_huella  text NOT NULL,           -- sha256 del correo en minusculas o del telefono; nunca el dato completo
  modo                 text NOT NULL CHECK (modo IN ('sombra', 'vivo')),   -- sombra = salio SOLO a restaurante@rosanta.rest
  estado               text NOT NULL DEFAULT 'programado'
                       CHECK (estado IN ('programado', 'enviado', 'entregado', 'rebotado', 'fallo', 'anulado', 'omitido')),
                       -- anulado: ya no tocaba (la reserva cambio o se cancelo). omitido: faltaba un dato, no salio.
  proveedor            text,                    -- resend, meta, sombra:resend
  proveedor_id         text,                    -- id del correo en Resend / del mensaje en Meta
  intentos             integer NOT NULL DEFAULT 0,
  programado_para      timestamptz NOT NULL,    -- cuando toca salir (la reseña, horas despues de "Termino")
  contexto             jsonb NOT NULL DEFAULT '{}',   -- antes/despues de un cambio, motivo; sin correo ni telefono
  error                text,
  creado               timestamptz NOT NULL DEFAULT now(),
  enviado              timestamptz,
  actualizado          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX envios_reserva ON envios (reserva_id);
CREATE INDEX envios_proveedor ON envios (proveedor, proveedor_id);
CREATE INDEX envios_cola ON envios (programado_para) WHERE estado IN ('programado', 'fallo');

-- Lo que avisa el proveedor despues (webhook de Resend: entregado, rebotado, spam). Sin datos personales.
CREATE TABLE envios_eventos (
  id            bigserial PRIMARY KEY,
  envio_id      bigint REFERENCES envios(id),
  proveedor     text NOT NULL,
  proveedor_id  text NOT NULL,
  evento_id     text UNIQUE,                    -- svix-id: el mismo aviso del proveedor no se anota dos veces
  tipo          text NOT NULL,                  -- email.delivered, email.bounced, email.complained...
  cuando        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX envios_eventos_envio ON envios_eventos (envio_id);

-- Cada corrida de los relojes (POST /tareas/avisos/recordatorios y /tareas/avisos/resenas). Sin datos personales.
CREATE TABLE avisos_relojes (
  id          bigserial PRIMARY KEY,
  tarea       text NOT NULL CHECK (tarea IN ('recordatorios', 'resenas')),
  inicio      timestamptz NOT NULL DEFAULT now(),
  fin         timestamptz,
  revisadas   integer NOT NULL DEFAULT 0,       -- reservas miradas
  nuevos      integer NOT NULL DEFAULT 0,       -- avisos que se anotaron en esta corrida
  ya_estaban  integer NOT NULL DEFAULT 0,       -- tocaban pero ya estaban anotados (idempotencia)
  enviados    integer NOT NULL DEFAULT 0,
  fallas      integer NOT NULL DEFAULT 0,
  detalle     jsonb NOT NULL DEFAULT '{}',
  error       text
);

-- ---------------------------------------------------------------- ajustes
-- Lo que Juanma puede cambiar sin publicar codigo (valor JSON). Sin fila = el valor por defecto del codigo
-- (cloud/app/src/reservas-avisos/avisos.js › AJUSTES); las pruebas revisan que coincidan.
CREATE TABLE avisos_ajustes (
  clave     text PRIMARY KEY,
  valor     jsonb NOT NULL,
  nota      text NOT NULL DEFAULT '',
  cambiado  timestamptz NOT NULL DEFAULT now(),
  por       text NOT NULL DEFAULT ''
);
INSERT INTO avisos_ajustes (clave, valor, nota, por) VALUES
  ('resena_regla', '{"modo": "telefono", "local_prefijos": ["+502"], "sin_telefono_local_si_idioma": ["es"], "local": "google", "turista": "tripadvisor"}',
   'modo telefono: +502 = local → Google; otro pais = turista → TripAdvisor; sin telefono decide el idioma. modo google o tripadvisor: siempre ese.', 'migracion 052'),
  ('resena_enlaces', '{"google": "https://g.page/r/CWMvHjpESP6vEAE/review", "tripadvisor": null}',
   'Enlace para dejar la reseña. Si el sitio elegido no tiene enlace, se usa el otro. FALTA el de TripAdvisor.', 'migracion 052'),
  ('resena_espera_min', '180', 'Minutos despues de marcar Termino.', 'migracion 052'),
  ('resena_silencio', '{"desde": "21:30", "hasta": "09:00", "mover_a": "10:00"}', 'Si la reseña cae de noche, sale a esta hora.', 'migracion 052'),
  ('resena_tope_horas', '48', 'Despues de esto ya no se manda la reseña.', 'migracion 052'),
  ('resena_respeta_optin', 'true', 'true = no se pide reseña a quien dijo NO a que lo contacten.', 'migracion 052'),
  ('recordatorio_24h', 'true', 'Recordatorio el dia anterior (si se reservo con mas de 24 h).', 'migracion 052'),
  ('recordatorio_dia', 'true', 'Recordatorio el mismo dia a la hora de abajo.', 'migracion 052'),
  ('recordatorio_dia_hora', '"12:00"', 'Hora de Guatemala.', 'migracion 052'),
  ('canales', '{"recordatorio_24h": ["whatsapp", "correo"], "recordatorio_dia": ["whatsapp", "correo"]}',
   'Por donde sale cada aviso, en orden. WhatsApp solo con WHATSAPP_AVISOS=encendido (plantilla aprobada por Meta); si no, correo. Lo que no esta aqui sale por correo.', 'migracion 052'),
  ('equipo_silenciar_origen', '["sala"]', 'Origenes que no generan el aviso de reserva nueva al equipo (walk-in).', 'migracion 052'),
  ('enlace_reservar', '{"en": "https://www.rosanta.rest/reservas", "es": "https://www.rosanta.rest/reservas"}', 'La pagina para reservar (rechazo y cancelacion).', 'migracion 052');

-- ---------------------------------------------------------------- permisos de la app: lee, agrega y cambia; nunca borra
GRANT SELECT, INSERT, UPDATE ON envios, avisos_relojes TO app;
GRANT SELECT, INSERT ON envios_eventos TO app;
GRANT SELECT, UPDATE ON avisos_ajustes TO app;
GRANT USAGE ON SEQUENCE envios_id_seq, envios_eventos_id_seq, avisos_relojes_id_seq TO app;
