# Parche temporal · hreflang por Custom Code

**Fecha:** 20 de agosto de 2026
**Estado:** activo — **debe retirarse** cuando Wix resuelva el fallo

---

## Por qué existe este parche

Wix Multilingual **debería** inyectar los `hreflang` automáticamente. Su propio panel lo
promete por escrito, en dos sitios:

- *SEO Settings*: "All other site languages will still include important tags like
  hreflang and x-default, but cannot be individually customized."
- *SEO de cada página → Advanced*: "Your site automatically includes tags like hreflang
  and x-default, so no need to worry about those."

**No lo hace.** Verificado el 20-ago-2026: de 9 páginas revisadas, sólo `/full-menu`
emitía hreflang, y ahí los genera la app de Restaurants Menus, no Multilingual.

Antes de parchear se descartó la causa más probable (**canonical escrito a mano**, que en
Wix suprime el hreflang automático):

- *Main Pages → Customize defaults → Additional meta tags*: sólo `og:site_name`,
  `og:type` y `og:url`. Sin canonical.
- *SEO de página individual → Advanced*: sólo Structured data, Robots meta tag y
  Additional tags. Sin canonical manual.

Conclusión: es un fallo de la plataforma, no de configuración del sitio.

---

## Qué se hizo

Cinco bloques de Custom Code, en el `<head>`, **cada uno aplicado sólo a su página**
(nunca "All pages"). El mismo bloque sirve para las dos versiones de idioma: cada versión
se autorreferencia y apunta a la otra, que es el comportamiento correcto.

| Nombre del bloque      | Página (nombre en Wix) | URL EN                    | URL ES                       |
|------------------------|------------------------|---------------------------|------------------------------|
| `hreflang · home`      | ROSANTA                | `/`                       | `/es`                        |
| `hreflang · gift-ideas`| GIFT IDEAS             | `/gift-ideas`             | `/es/gift-ideas`             |
| `hreflang · events`    | EVENTS                 | `/events-1`               | `/es/events-1`               |
| `hreflang · reservas`  | RESERVATIONS           | `/reservas`               | `/es/reservas`               |
| `hreflang · faq`       | FAQ                    | `/preguntas-frecuentes`   | `/es/preguntas-frecuentes`   |

Contenido de cada bloque (ejemplo, home):

```html
<link rel="alternate" hreflang="en" href="https://www.rosanta.rest/" />
<link rel="alternate" hreflang="es" href="https://www.rosanta.rest/es" />
<link rel="alternate" hreflang="x-default" href="https://www.rosanta.rest/" />
```

Criterios de diseño:
- `hreflang="es"` a secas, no `es-ES` ni `es-GT`: más amplio, y evita que Google descarte
  la señal si la región no calza.
- `x-default` apunta al inglés, idioma principal y canal de entrada de los turistas.

## Páginas deliberadamente excluidas

- **`/full-menu`** — ya emite hreflang nativos (app de Restaurants). Ponerle un bloque
  crearía duplicados.
- **`/política-de-privacidad`** — la URL lleva acento; el riesgo de codificación no
  compensa para una página legal.
- **Resto de páginas** (gift-card, loyalty, términos, páginas viejas del menú) — fuera de
  alcance por ahora.

---

## Verificación (20-ago-2026)

Script: `verificar-hreflang.js`

- 5/5 pares con las 3 etiquetas, idénticas entre EN y ES, sin idiomas repetidos, con
  autorreferencia y apuntando al otro idioma.
- Chequeo negativo: `/events` (COTIZACIONES), `/gift-card`, `/loyalty`,
  `/política-de-privacidad` y `/es/gift-card` siguen sin hreflang — los bloques no se
  colaron donde no debían.
- Las etiquetas se sirven **desde el servidor**, en el HTML crudo: no dependen de
  JavaScript, así que Google las lee igual que las nativas.

---

## Cómo retirarlo

Cuando Wix arregle el fallo (o el ticket se resuelva):

1. Comprobar que una página sin bloque —por ejemplo `/gift-card`— ya emite hreflang sola.
2. Si es así, borrar los cinco bloques desde *Settings → Custom Code*. Se reconocen por el
   prefijo `hreflang · `.
3. Volver a correr `verificar-hreflang.js` para confirmar que los nativos cubren lo mismo.

**Importante:** si Wix empieza a emitirlos y los bloques siguen puestos, quedarán
**duplicados**. No es catastrófico, pero es una señal sucia para Google y hay que limpiarla.
