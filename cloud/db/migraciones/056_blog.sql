-- 056 · Blog del sitio nuevo y columnas de la lista de espera (23-oct-2026, rama claude/web-sv-nube, AYUDANTE SV-NUBE).
-- Rango 050-059 "Web y reservas". NO aplicada: la aplica el Estudio con migrar.js, primero rosanta_ensayo y despues
-- rosanta con respaldo. Va DESPUES de la 051 (lista_espera) y la 053 (contenido web).
-- Solo aditiva: una tabla nueva (web_blog) y columnas nuevas, todas con valor por defecto o nulas, en lista_espera.
-- La app (usuario "app") lee, agrega y cambia; NUNCA borra.

-- ---------------------------------------------------------------- blog
-- Entradas del blog. Es BORRADOR como el resto del contenido (cloud/app/src/contenido-web.js): "Publicar" las copia
-- a web_versiones.contenido (llave "blog" del formato 1, web/contenido/FORMATO.md) y "Volver a esta version" las deja
-- como estaban en esa version. Retirar una entrada es activa = false. Solo el dueño las crea, edita y publica.
-- cuerpo_*: markdown simple (parrafos, **negritas**, listas con "- " y enlaces [texto](https://… o /…)). Sin HTML.
CREATE TABLE web_blog (
  id              bigserial PRIMARY KEY,
  slug            text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9][a-z0-9-]*$'),   -- /blog/<slug> y /es/blog/<slug>
  orden           integer NOT NULL DEFAULT 0,
  fecha           date NOT NULL,                   -- fecha de publicacion que se muestra (hora de Guatemala)
  titulo_en       text NOT NULL DEFAULT '',
  titulo_es       text NOT NULL DEFAULT '',
  resumen_en      text NOT NULL DEFAULT '',        -- 1-2 frases para la lista y la meta description
  resumen_es      text NOT NULL DEFAULT '',
  cuerpo_en       text NOT NULL DEFAULT '',
  cuerpo_es       text NOT NULL DEFAULT '',
  foto_id         bigint REFERENCES web_fotos(id),
  activa          boolean NOT NULL DEFAULT true,   -- false = retirada (no sale en la proxima publicacion)
  actualizado     timestamptz NOT NULL DEFAULT now(),
  actualizado_por text NOT NULL
);
CREATE INDEX web_blog_fecha ON web_blog (fecha DESC);

-- La bitacora del contenido ya acepta crear/editar/retirar/reactivar sobre cualquier tabla (web_bitacora.tabla es texto).

-- ---------------------------------------------------------------- lista de espera (tabla de la 051)
-- Lo que faltaba para el aviso automatico "se libero una mesa" (interruptor LISTA_ESPERA, apagado por defecto):
--   avisado        cuando se le aviso (por el sistema o a mano desde el panel)
--   aviso_por      que liberacion lo disparo: 'cancelada:<reserva>:v<version>' o 'cambiada:<reserva>:v<version>'.
--                  UNICA: la misma liberacion avisa a UNA sola persona aunque el gancho corra dos veces.
--   aviso_hora     la hora libre (HH:MM, Guatemala) que se le ofrecio
--   aviso_envio    la clave del aviso en `envios` (052), para ver si salio
--   fuente_trafico utm, gclid, fbclid... del formulario (como reservas.fuente_trafico)
--   actualizada_por quien la toco por ultima vez ('web', 'sistema' o el correo del equipo)
ALTER TABLE lista_espera ADD COLUMN avisado timestamptz;
ALTER TABLE lista_espera ADD COLUMN aviso_por text;
ALTER TABLE lista_espera ADD COLUMN aviso_hora text;
ALTER TABLE lista_espera ADD COLUMN aviso_envio text;
ALTER TABLE lista_espera ADD COLUMN fuente_trafico jsonb NOT NULL DEFAULT '{}';
ALTER TABLE lista_espera ADD COLUMN actualizada_por text NOT NULL DEFAULT '';
CREATE UNIQUE INDEX lista_espera_aviso_por ON lista_espera (aviso_por);
CREATE INDEX lista_espera_email ON lista_espera (fecha, email);

-- app: lee, agrega y cambia; NUNCA borra. (lista_espera ya tiene SELECT, INSERT, UPDATE desde la 051.)
GRANT SELECT, INSERT, UPDATE ON web_blog TO app;
GRANT USAGE ON SEQUENCE web_blog_id_seq TO app;
