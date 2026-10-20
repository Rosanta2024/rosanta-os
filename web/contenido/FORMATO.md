# Contenido del sitio: formato que lee Astro (formato 1)

AYUDANTE 4 (contenido y gift cards) para el AYUDANTE 3 (sitio Astro), 20-oct-2026. Actualizado el 21-oct: Adventures y gift cards sin pasarela.
Ejemplo completo: `ejemplo-contenido.json` (datos inventados).

## De dónde se lee

- **Al construir el sitio:** `GET https://<rosanta-nube>/api/web/contenido` devuelve la **última versión publicada**. Es público y no lleva datos personales. Con `?version=N` devuelve una versión vieja.
- En Firebase Hosting, `/api/**` va a `rosanta-nube`, así que también sirve `https://rosanta.rest/api/web/contenido`.
- **Para construir sin red** (pruebas, CI): `web/contenido/ejemplo-contenido.json`.
- **Reconstrucción:** cuando Juanma publica, la nube hace `POST` a `SITIO_RECONSTRUIR_URL` con `{ "version": N, "huella": "…" }` y la cabecera `x-rosanta-tarea`. Ese gancho tiene que disparar el build de Astro y el deploy a Firebase. Cuál es (Cloud Build trigger, GitHub Action) lo decide el Estudio. Sin URL configurada, la versión queda guardada con `reconstruccion = sin_gancho`.
- **Si la API falla en el build, el build tiene que fallar.** No hay que publicar un sitio vacío.

## Forma

```
formato        1 (si cambia la forma, sube; el sitio rechaza un formato que no conoce)
version        id de la versión publicada · publicada (ISO) · huella (sha256)
ajustes        { tipo_cambio_usd: 7.7 | null }
paginas        { <clave>: { orden, ruta:{en,es}, seo:{ titulo:{es,en}, descripcion:{es,en}, foto }, bloques:{ <clave>: bloque } } }
menu           [ { id, clave, orden, nombre:{es,en}, nota:{es,en}, platos:[ plato ] } ]
faq            [ { id, orden, categoria, pregunta:{es,en}, respuesta:{es,en} } ]
eventos        [ { id, orden, slug, titulo, descripcion, inicio, fin, precio_q, precio_usd_ref, cupo, foto, enlace } ]
adventures     { experiencias: [ experiencia ], dificultad: { <clave>: {es,en} }, idiomas: { <clave>: {es,en} } }
alergenos      { <clave>: {es,en} }  (los 14 de la norma europea)
etiquetas      { <clave>: {es,en} }  (vegetariano, vegano, sin_gluten, picante, de_la_casa)
giftcards      { montos_q, minimo_q, maximo_q, vigencia_meses, usd_fijos }   (solo si el dueño lo cargó)

bloque         { id, tipo: texto|parrafo|enlace|foto, orden, es, en, enlace? (tipo enlace), foto? (tipo foto) }
plato          { id, orden, nombre, descripcion, precio_q (número o null), precio_usd_ref (entero o null), alergenos[], etiquetas[], foto }
foto           { id, url (1600 px), url_chica (600 px), ancho, alto, alt:{es,en} } | null
experiencia    { id, orden, slug, ruta:{en,es}, titulo, descripcion, duracion, incluye (una cosa por línea), punto_salida, temporada,
                 dificultad (facil|moderada|dificil|muy_dificil), dificultad_texto:{es,en}, idiomas[], precio_ref_q, precio_usd_ref,
                 foto, galeria[foto], faq[{pregunta:{es,en}, respuesta:{es,en}}],
                 operador:{ id, nombre, licencia_inguat, codigo_referido }, aviso_legal:{es,en}, schema:{ es:[…], en:[…] } }
```

- Solo viene lo **activo**, ya en orden: `menu`, `faq` y `eventos` como listas; los bloques, en el orden de las llaves.
- Los textos son **texto plano**: el sitio los escapa. En un `parrafo`, `\n` es un salto de línea. No viene HTML.
- `eventos.inicio` y `fin` vienen en ISO UTC. Se muestran en hora de Guatemala (UTC-6).
- `precio_usd_ref` = `round(precio_q / tipo_cambio_usd)`. Se muestra como "≈ US$11".
- Los enlaces empiezan con `/` (una página del sitio), `https://`, `mailto:` o `tel:`.

## Rosanta Adventures (estudio §3.9)

- Rutas nuevas: `/adventures` y `/es/adventures` (la página principal) y una ficha por experiencia: `/adventures/<slug>` y `/es/adventures/<slug>`. Ninguna dirección que ya existe cambia.
- **Solo vienen las fichas que se pueden mostrar:** las de un operador aliado activo, con licencia de INGUAT y seguro vigentes. Si algo vence, la nube publica otra versión sin esas fichas y pide reconstruir el sitio. El sitio no tiene que filtrar nada.
- `schema` trae el JSON-LD listo, en cada idioma: `TouristTrip` (con `Offer` de referencia y el proveedor), y `FAQPage` si la ficha tiene preguntas. Va tal cual en un `<script type="application/ld+json">`.
- **El aviso legal (`aviso_legal`) se muestra en la ficha y junto al formulario.** El abogado tiene que revisar el texto.
- El formulario de consulta (sin cobro) llama a `POST /api/adventures/consulta` con `{ experiencia: <slug>, nombre, email, telefono, idioma: es|en, fecha: AAAA-MM-DD, personas, mensaje, cena: { fecha, hora: "HH:MM", personas } | null, origen:{utm_…}, sitio_web: "" }`. Responde `{ ok, mensaje, cena: { estado: reservada|pendiente|sin_disponibilidad|error } | null }`, y el sitio muestra `mensaje`.

## Claves de página y de bloque

Las **claves de página** son fijas: `inicio`, `reservas`, `menu`, `eventos`, `eventos-privados`, `gift-ideas`, `gift-cards`, `faq`, `privacidad`, `terminos`, `encuesta`. Las rutas son las de Wix (`ruta.en` = `/full-menu`, `ruta.es` = `/es/full-menu`), así no hacen falta 301 de más.

Las **claves de bloque** las pone el AYUDANTE 3 al copiar cada página. El formato es `seccion.elemento`: `heroe.titulo`, `heroe.boton`, `honest.parrafo`, `galeria.foto1`… Si una plantilla de Astro pide un bloque que no viene, el build avisa y usa el texto vacío. Nunca inventa un texto.

## Carga inicial

Lo que el AYUDANTE 3 copie del sitio de hoy se puede entregar en este mismo formato (`contenido.json`). `sembrar()` de `cloud/app/src/contenido-web.js` lo carga en el borrador; solo corre si el borrador está vacío. Las fotos que vienen por URL quedan como `externa/…` hasta que se suban de nuevo desde la pantalla.

## Gift cards (la página de compra del sitio)

- **Hoy no se cobra en línea** (`PASARELA=ninguna`). La pasarela no está decidida: Juanma está cotizando Recurrente, BAC y NeoNet.
- `GET /api/giftcards/precios` → `{ montos:[{q, usd}], minimo_q, maximo_q, tipo_cambio, vigencia_meses, cobro_en_linea, contacto:{correo, whatsapp} }`. Los montos son Q300 y Q500, más uno libre desde Q200, y vencen a los 12 meses. Si `cobro_en_linea` es `false`, la página muestra los montos y "Escríbenos" con el correo y el WhatsApp de `contacto`, sin formulario de pago.
- `POST /api/giftcards/pedido` con `{ valor_q, moneda: GTQ|USD, idioma: es|en, comprador:{nombre,email,telefono}, destinatario:{nombre,email}, mensaje, enviar_el: AAAA-MM-DD|null, origen:{utm_…}, sitio_web: "" }` → `{ checkout_url }`. Hay que redirigir a esa dirección. `sitio_web` es un campo trampa oculto para robots y va vacío.
- Al volver del pago, la página es `/gift-cards/gracias`. La tarjeta la crea el webhook (`/api/pagos/webhook/<proveedor>`), no la página.
- La nube trae una versión simple en `/gift-cards/comprar` (`?lang=en`), que sirve de referencia o de respaldo.
