-- 055 · Rosanta Adventures (21-oct-2026, rama claude/web-contenido-giftcards, AYUDANTE 4). Estudio §3.9.
-- Rango 050-059 "Web y reservas". La aplica el Estudio con migrar.js (primero rosanta_ensayo). Va despues de 053.
-- Solo aditiva: tablas nuevas. No toca ninguna tabla existente. La app NO tiene DELETE.
--
-- DECIDIDO por Juanma (20-oct): las experiencias las operan OPERADORES ALIADOS, no Rosanta. Rosanta las recomienda,
-- pasa la consulta al operador con su codigo de referido y mide en los dos sentidos. Sin cobro por ahora.
-- Lo edita SOLO el dueño (decision del 21-oct: "por el momento solo yo"), desde "Contenido web".
--
-- * operadores_aliados: ningun operador se publica sin licencia de INGUAT y seguro VIGENTES. La tarea diaria avisa a
--   Juanma 30 dias antes de que venza algo y, si vence, pausa al operador (estado 'vencido') y saca sus fichas del sitio.
-- * web_experiencias: un tipo de contenido mas del borrador (053): entra en cada version publicada y vuelve atras con ella.
-- * leads_adventures: cada consulta del formulario publico, con el codigo del operador, la cena en Rosanta si la pidio
--   y la comision cuando termina en venta.

CREATE TABLE operadores_aliados (
  id                    bigserial PRIMARY KEY,
  nombre                text NOT NULL,                 -- como se muestra en la ficha
  razon_social          text NOT NULL DEFAULT '',
  contacto_nombre       text NOT NULL DEFAULT '',
  contacto_telefono     text NOT NULL DEFAULT '',      -- E.164
  contacto_email        text NOT NULL DEFAULT '',
  contacto_emergencia   text NOT NULL DEFAULT '',
  licencia_inguat       text NOT NULL DEFAULT '',      -- numero de registro en INGUAT
  licencia_vence        date,
  seguro_aseguradora    text NOT NULL DEFAULT '',
  seguro_poliza         text NOT NULL DEFAULT '',
  seguro_vence          date,
  comision_tipo         text NOT NULL DEFAULT 'porcentaje' CHECK (comision_tipo IN ('porcentaje', 'fijo', 'acuerdo')),
  comision_valor        numeric(10,2) CHECK (comision_valor IS NULL OR comision_valor >= 0),   -- % o Q por persona
  acuerdo               text NOT NULL DEFAULT '',      -- lo que dice el acuerdo escrito (quien cobra, como se pasan los leads...)
  requisitos            jsonb NOT NULL DEFAULT '{}',   -- checklist del estudio: patente, rtu, guias_carne, protocolo, acuerdo_firmado, resenas
  codigo_referido       text NOT NULL UNIQUE CHECK (codigo_referido ~ '^[A-Z0-9-]{3,20}$'),
  estado                text NOT NULL DEFAULT 'pausado' CHECK (estado IN ('activo', 'pausado', 'vencido')),
  aviso_vencimiento     date,                          -- la fecha de vencimiento por la que ya se aviso (no se repite)
  nota                  text NOT NULL DEFAULT '',
  actualizado           timestamptz NOT NULL DEFAULT now(),
  actualizado_por       text NOT NULL
);

CREATE TABLE web_experiencias (
  id                    bigserial PRIMARY KEY,
  slug                  text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9-]+$'),   -- /adventures/<slug>
  operador_id           bigint NOT NULL REFERENCES operadores_aliados(id),
  titulo_en             text NOT NULL,
  titulo_es             text NOT NULL,
  descripcion_en        text NOT NULL DEFAULT '',
  descripcion_es        text NOT NULL DEFAULT '',
  duracion_en           text NOT NULL DEFAULT '',      -- "6 hours", "2 days / 1 night"
  duracion_es           text NOT NULL DEFAULT '',
  incluye_en            text NOT NULL DEFAULT '',      -- una cosa por linea
  incluye_es            text NOT NULL DEFAULT '',
  punto_salida_en       text NOT NULL DEFAULT '',
  punto_salida_es       text NOT NULL DEFAULT '',
  temporada_en          text NOT NULL DEFAULT '',
  temporada_es          text NOT NULL DEFAULT '',
  dificultad            text NOT NULL DEFAULT 'moderada' CHECK (dificultad IN ('facil', 'moderada', 'dificil', 'muy_dificil')),
  idiomas               text[] NOT NULL DEFAULT '{}',  -- es, en, fr, de, it, pt
  precio_ref_q          numeric(10,2) CHECK (precio_ref_q IS NULL OR precio_ref_q >= 0),   -- precio de referencia por persona
  foto_id               bigint REFERENCES web_fotos(id),
  galeria               bigint[] NOT NULL DEFAULT '{}', -- mas fotos (ids de web_fotos)
  faq                   jsonb NOT NULL DEFAULT '[]',   -- [{ pregunta:{es,en}, respuesta:{es,en} }] → FAQPage de la ficha
  orden                 integer NOT NULL DEFAULT 0,
  activa                boolean NOT NULL DEFAULT true,
  actualizado           timestamptz NOT NULL DEFAULT now(),
  actualizado_por       text NOT NULL
);
CREATE INDEX web_experiencias_operador ON web_experiencias (operador_id);

CREATE TABLE leads_adventures (
  id                    bigserial PRIMARY KEY,
  creado                timestamptz NOT NULL DEFAULT now(),
  experiencia_id        bigint NOT NULL REFERENCES web_experiencias(id),
  operador_id           bigint NOT NULL REFERENCES operadores_aliados(id),
  codigo_referido       text NOT NULL,                 -- el del operador al momento de la consulta
  nombre                text NOT NULL,
  email                 text NOT NULL,
  telefono              text,
  idioma                text NOT NULL DEFAULT 'en' CHECK (idioma IN ('es', 'en')),
  fecha_deseada         date,
  personas              integer CHECK (personas IS NULL OR personas BETWEEN 1 AND 50),
  mensaje               text NOT NULL DEFAULT '',
  combinar_cena         boolean NOT NULL DEFAULT false,
  cena_fecha            date,
  cena_hora             text CHECK (cena_hora IS NULL OR cena_hora ~ '^\d{2}:\d{2}$'),
  cena_personas         integer CHECK (cena_personas IS NULL OR cena_personas BETWEEN 1 AND 50),
  cena_reserva_id       text,                          -- la reserva que creo el motor (o null)
  cena_estado           text CHECK (cena_estado IN ('reservada', 'pendiente', 'sin_disponibilidad', 'error')),
  pipeline_id           text,                          -- el lead en /clientes/eventos (tipo "adventure")
  estado                text NOT NULL DEFAULT 'nuevo' CHECK (estado IN ('nuevo', 'pasado_al_operador', 'confirmado', 'vendido', 'perdido')),
  venta_q               numeric(12,2) CHECK (venta_q IS NULL OR venta_q >= 0),       -- lo que vendio el operador
  comision_q            numeric(12,2) CHECK (comision_q IS NULL OR comision_q >= 0), -- la comision para Rosanta
  comision_registrada   timestamptz,
  ganchos               jsonb NOT NULL DEFAULT '{}',   -- que paso con el pipeline, el aviso y la reserva
  origen_trafico        jsonb NOT NULL DEFAULT '{}',
  nota                  text NOT NULL DEFAULT '',
  actualizado           timestamptz NOT NULL DEFAULT now(),
  CHECK (NOT combinar_cena OR (cena_fecha IS NOT NULL AND cena_hora IS NOT NULL))
);
CREATE INDEX leads_adventures_creado ON leads_adventures (creado DESC);
CREATE INDEX leads_adventures_operador ON leads_adventures (operador_id, estado);

-- app: lee, agrega y cambia; NUNCA borra (pausar = estado; retirar una ficha = activa false).
GRANT SELECT, INSERT, UPDATE ON operadores_aliados, web_experiencias, leads_adventures TO app;
GRANT USAGE ON SEQUENCE operadores_aliados_id_seq, web_experiencias_id_seq, leads_adventures_id_seq TO app;
