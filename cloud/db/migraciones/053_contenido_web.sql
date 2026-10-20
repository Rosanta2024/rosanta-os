-- 053 · Contenido del sitio nuevo rosanta.rest (20-oct-2026, rama claude/web-contenido-giftcards, AYUDANTE 4).
-- Rango 050-059 "Web y reservas". La aplica el Estudio con migrar.js: primero rosanta_ensayo, despues rosanta
-- con respaldo. Solo aditiva: tablas nuevas con prefijo web_. No toca ninguna tabla existente.
--
-- Como funciona:
--   * Las tablas web_paginas, web_bloques, web_fotos, web_menu_*, web_faq y web_eventos son el BORRADOR:
--     lo que se esta editando en la pantalla "Contenido web" (cloud/app/src/contenido-web.js).
--   * "Publicar" (solo el dueño) copia el borrador entero a web_versiones.contenido (un JSON con el formato
--     que lee el sitio Astro: web/contenido/FORMATO.md) y llama al gancho de reconstruccion del sitio.
--     El sitio publico SIEMPRE lee la ultima version publicada, nunca el borrador.
--   * "Volver a esta version" publica de nuevo una version vieja (fila nueva, restaurada_de = la vieja) y
--     deja el borrador igual a ella.
--   * Nada se borra: retirar un plato, una pregunta o una foto es activo = false. La app no tiene DELETE.
--   * Cada cambio queda en web_bitacora (quien, cuando, antes y despues).

-- Ajustes generales del sitio (tipo de cambio para la referencia en US$, montos de gift cards, etc.).
CREATE TABLE web_ajustes (
  clave           text PRIMARY KEY,                -- p. ej. 'tipo_cambio_usd', 'giftcards'
  valor           jsonb NOT NULL,
  actualizado     timestamptz NOT NULL DEFAULT now(),
  actualizado_por text NOT NULL
);

-- Fotos: el archivo vive en Cloud Storage; aca va la direccion y los datos. La pantalla las achica en el
-- navegador antes de subir (grande: 1600 px de lado mayor; chica: 600 px), asi el servidor no necesita
-- librerias de imagenes.
CREATE TABLE web_fotos (
  id              bigserial PRIMARY KEY,
  ruta            text NOT NULL UNIQUE,            -- objeto en el deposito: web/fotos/2026/10/<huella>.webp
  url             text NOT NULL,                   -- direccion publica de la grande
  url_chica       text,                            -- direccion publica de la chica
  ancho           integer CHECK (ancho > 0),
  alto            integer CHECK (alto > 0),
  bytes           integer CHECK (bytes > 0),
  tipo            text NOT NULL CHECK (tipo IN ('image/webp', 'image/jpeg', 'image/png')),
  huella          text NOT NULL,                   -- sha256 del archivo: la misma foto dos veces no se duplica
  alt_es          text NOT NULL DEFAULT '',        -- texto alternativo (SEO y accesibilidad)
  alt_en          text NOT NULL DEFAULT '',
  activa          boolean NOT NULL DEFAULT true,
  subida          timestamptz NOT NULL DEFAULT now(),
  subida_por      text NOT NULL
);
CREATE UNIQUE INDEX web_fotos_huella ON web_fotos (huella);

-- Paginas del sitio (las 16 de hoy, en ingles y español). La clave es fija; las rutas son las de Wix.
CREATE TABLE web_paginas (
  clave           text PRIMARY KEY CHECK (clave ~ '^[a-z0-9-]+$'),   -- inicio, reservas, menu, eventos, gift-cards, faq...
  ruta_en         text NOT NULL,                   -- '/', '/full-menu', '/gift-ideas'
  ruta_es         text NOT NULL,                   -- '/es', '/es/full-menu'
  titulo_en       text NOT NULL DEFAULT '',        -- <title> (SEO)
  titulo_es       text NOT NULL DEFAULT '',
  descripcion_en  text NOT NULL DEFAULT '',        -- meta description (SEO)
  descripcion_es  text NOT NULL DEFAULT '',
  foto_id         bigint REFERENCES web_fotos(id), -- foto para compartir (og:image)
  orden           integer NOT NULL DEFAULT 0,
  activa          boolean NOT NULL DEFAULT true,
  actualizado     timestamptz NOT NULL DEFAULT now(),
  actualizado_por text NOT NULL
);

-- Bloques de texto (y foto) de cada pagina: heroe.titulo, heroe.boton, honest.parrafo...
CREATE TABLE web_bloques (
  id              bigserial PRIMARY KEY,
  pagina          text NOT NULL REFERENCES web_paginas(clave),
  clave           text NOT NULL CHECK (clave ~ '^[a-z0-9_.-]+$'),
  tipo            text NOT NULL DEFAULT 'texto' CHECK (tipo IN ('texto', 'parrafo', 'foto', 'enlace')),
  texto_en        text NOT NULL DEFAULT '',
  texto_es        text NOT NULL DEFAULT '',
  enlace          text,                            -- solo tipo enlace (boton): a donde lleva
  foto_id         bigint REFERENCES web_fotos(id), -- solo tipo foto
  orden           integer NOT NULL DEFAULT 0,
  activo          boolean NOT NULL DEFAULT true,
  actualizado     timestamptz NOT NULL DEFAULT now(),
  actualizado_por text NOT NULL,
  UNIQUE (pagina, clave)
);

-- Menu: secciones y platos. El precio es en quetzales; la referencia en US$ se calcula al publicar con
-- web_ajustes.tipo_cambio_usd. Cambiar un precio es accion del dueño (precio_venta de la matriz).
CREATE TABLE web_menu_secciones (
  id              bigserial PRIMARY KEY,
  clave           text NOT NULL UNIQUE CHECK (clave ~ '^[a-z0-9-]+$'),
  nombre_en       text NOT NULL,
  nombre_es       text NOT NULL,
  nota_en         text NOT NULL DEFAULT '',
  nota_es         text NOT NULL DEFAULT '',
  orden           integer NOT NULL DEFAULT 0,
  activa          boolean NOT NULL DEFAULT true,
  actualizado     timestamptz NOT NULL DEFAULT now(),
  actualizado_por text NOT NULL
);

CREATE TABLE web_menu_platos (
  id              bigserial PRIMARY KEY,
  seccion_id      bigint NOT NULL REFERENCES web_menu_secciones(id),
  nombre_en       text NOT NULL,
  nombre_es       text NOT NULL,
  descripcion_en  text NOT NULL DEFAULT '',
  descripcion_es  text NOT NULL DEFAULT '',
  precio_q        numeric(10,2) CHECK (precio_q IS NULL OR precio_q >= 0),   -- NULL = "precio del dia" / sin precio
  alergenos       text[] NOT NULL DEFAULT '{}',   -- claves de la lista fija de contenido-web.js (gluten, lacteos...)
  etiquetas       text[] NOT NULL DEFAULT '{}',   -- vegetariano, vegano, picante, sin_gluten, de_la_casa
  foto_id         bigint REFERENCES web_fotos(id),
  receta_id       text,                            -- para despues: el plato del recetario (precio vigente)
  orden           integer NOT NULL DEFAULT 0,
  activo          boolean NOT NULL DEFAULT true,
  actualizado     timestamptz NOT NULL DEFAULT now(),
  actualizado_por text NOT NULL
);
CREATE INDEX web_menu_platos_seccion ON web_menu_platos (seccion_id, orden);

CREATE TABLE web_faq (
  id              bigserial PRIMARY KEY,
  categoria       text NOT NULL DEFAULT 'general', -- general, reservas, eventos, gift-cards, menu
  pregunta_en     text NOT NULL,
  pregunta_es     text NOT NULL,
  respuesta_en    text NOT NULL,
  respuesta_es    text NOT NULL,
  orden           integer NOT NULL DEFAULT 0,
  activa          boolean NOT NULL DEFAULT true,
  actualizado     timestamptz NOT NULL DEFAULT now(),
  actualizado_por text NOT NULL
);

-- Eventos publicos (cenas de maridaje, fechas especiales). El cupo y la compra en linea llegan despues
-- con el motor de reservas y Recurrente; aca va lo que se muestra.
CREATE TABLE web_eventos (
  id              bigserial PRIMARY KEY,
  slug            text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9-]+$'),
  titulo_en       text NOT NULL,
  titulo_es       text NOT NULL,
  descripcion_en  text NOT NULL DEFAULT '',
  descripcion_es  text NOT NULL DEFAULT '',
  inicio          timestamptz NOT NULL,
  fin             timestamptz,
  precio_q        numeric(10,2) CHECK (precio_q IS NULL OR precio_q >= 0),
  cupo            integer CHECK (cupo IS NULL OR cupo > 0),
  foto_id         bigint REFERENCES web_fotos(id),
  enlace          text,                            -- reservar o comprar (por ahora WhatsApp o /reservas)
  orden           integer NOT NULL DEFAULT 0,
  activo          boolean NOT NULL DEFAULT true,
  actualizado     timestamptz NOT NULL DEFAULT now(),
  actualizado_por text NOT NULL,
  CHECK (fin IS NULL OR fin >= inicio)
);

-- Cada publicacion: el contenido entero tal cual lo lee el sitio. Nunca se edita ni se borra.
CREATE TABLE web_versiones (
  id              bigserial PRIMARY KEY,
  publicada       timestamptz NOT NULL DEFAULT now(),
  publicada_por   text NOT NULL,
  nota            text NOT NULL DEFAULT '',
  formato         integer NOT NULL,                -- version del formato (FORMATO.md); hoy 1
  contenido       jsonb NOT NULL,
  huella          text NOT NULL,                   -- sha256 del contenido
  restaurada_de   bigint REFERENCES web_versiones(id),
  reconstruccion  text NOT NULL DEFAULT 'pendiente' CHECK (reconstruccion IN ('pendiente', 'pedida', 'error', 'sin_gancho')),
  reconstruccion_detalle text
);
CREATE INDEX web_versiones_publicada ON web_versiones (publicada DESC);

-- Bitacora del contenido: quien cambio que y cuando. Nadie la edita ni la borra.
CREATE TABLE web_bitacora (
  id              bigserial PRIMARY KEY,
  cuando          timestamptz NOT NULL DEFAULT now(),
  quien           text NOT NULL,
  rol             text NOT NULL,
  accion          text NOT NULL CHECK (accion IN ('crear', 'editar', 'retirar', 'reactivar', 'subir_foto', 'publicar', 'volver_atras', 'ajuste')),
  tabla           text NOT NULL,
  registro_id     text NOT NULL,
  antes           jsonb,
  despues         jsonb
);
CREATE INDEX web_bitacora_registro ON web_bitacora (tabla, registro_id);
CREATE INDEX web_bitacora_cuando ON web_bitacora (cuando DESC);

-- app: lee, agrega y cambia; NUNCA borra. Versiones y bitacora: solo agregar (y el resultado del gancho).
GRANT SELECT, INSERT, UPDATE ON web_ajustes, web_fotos, web_paginas, web_bloques, web_menu_secciones,
  web_menu_platos, web_faq, web_eventos TO app;
GRANT SELECT, INSERT ON web_versiones, web_bitacora TO app;
GRANT UPDATE (reconstruccion, reconstruccion_detalle) ON web_versiones TO app;
GRANT USAGE ON SEQUENCE web_fotos_id_seq, web_bloques_id_seq, web_menu_secciones_id_seq, web_menu_platos_id_seq,
  web_faq_id_seq, web_eventos_id_seq, web_versiones_id_seq, web_bitacora_id_seq TO app;
