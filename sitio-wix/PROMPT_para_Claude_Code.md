# Prompt para Claude Code

Copiar todo lo que sigue y pegarlo en Claude Code, estando en la carpeta
`~/Documents/Claude/Projects/Rosanta`.

---

Estoy migrando el menú de mi restaurante (Rosanta, Antigua Guatemala) a la app **Wix Restaurants Menus**. El conversor ya está escrito y verificado. Necesito que lo termines de ejecutar contra la API real.

## Contexto

- Carpeta de trabajo: `~/Documents/Claude/Projects/Rosanta`
- Script: `wix-menu-loader.js` (Node, sin dependencias, usa `fetch` nativo)
- Documentación del proceso: `Runbook_Migracion_Menu_Wix.md`
- La app **Wix Restaurants Menus** ya está instalada en el sitio.
- Site ID (metaSiteId): `47968b83-c2c2-4b11-8f94-ef2c7488debc`

## Lo que ya está verificado, no lo rehagas

`node wix-menu-loader.js extract` corre bien y produce **7 secciones y 78 items en español y 78 en inglés**. La fuente de datos es el array `const MENU` dentro del `index.html` del repo público `rosanta2024/rosanta-menu`. No hay que retipear el menú.

Endpoints confirmados en la documentación de Wix:

- Menús: `GET https://www.wixapis.com/restaurants/menus/v1/menus`
- Secciones bulk: `POST https://www.wixapis.com/restaurants/menus-section/v1/bulk/sections/create`
- Items bulk: `POST https://www.wixapis.com/restaurants/menus-item/v1/bulk/items/create`

Cabeceras: `Authorization: <API key>`, `wix-site-id: <site id>`, `Content-Type: application/json`.

Lo que **no** está documentado por Wix es el cuerpo exacto de las peticiones bulk. Por eso el script tiene un modo `probe`. Además, Bulk Create Sections está marcado como *Developer Preview*, o sea que puede haber cambiado.

## Lo que necesito que hagas

**1. Ayúdame a meter la API key en el entorno.**

Ya tengo la key generada en Wix, con permiso *Manage Restaurants*. La copio con el botón **Copy token** de `manage.wix.com/account/api-keys`.

Advertencia importante: **no uses `pbpaste`**. Ya fallamos con eso, porque para correr los comandos yo los copio primero y entonces el portapapeles contiene los comandos, no la key. Usa `read -r` u otro método donde yo pegue la key *después* de que el comando ya esté corriendo. La key empieza con `IST.`.

Verifica que quedó bien con algo que no imprima el valor completo, por ejemplo el largo y los primeros cuatro caracteres.

**2. Corre `node wix-menu-loader.js probe`.**

Interpreta la respuesta:

- `200` en el paso 1: la app y los permisos están bien
- `401`: la key está mal o incompleta
- `403`: falta el permiso *Manage Restaurants*
- `404`: la app no está donde la API la busca

De los pasos 2 y 3, saca el nombre real del campo raíz de la petición y de la respuesta, y **corrige `wix-menu-loader.js` si mis suposiciones (`{sections:[...]}` y `{items:[...]}` con `returnEntity: true`) no coinciden** con lo que la API espera.

El probe crea dos registros llamados `ZZZ PRUEBA BORRAR`, ocultos. Bórralos al terminar.

**3. Cuando el probe pase, corre `node wix-menu-loader.js load`.**

Deja el registro `carga-<fecha>.json` para poder deshacer con `rollback`.

## Reglas de trabajo

- **No reescribas `wix-menu-loader.js` completo.** Edición puntual. Si vas a cambiar algo grande, haz respaldo primero.
- **No toques nada más del sitio.** Ni el formulario de reservas, ni el widget de reseñas, ni el menú de GitHub. El menú de GitHub queda como respaldo hasta que lo nuevo esté estable.
- Si algo no cuadra con lo que dice la documentación, **verifica antes de afirmar**. No infieras configuración desde HTML renderizado.

## Dos decisiones de contenido que están abiertas

En el script, arriba del todo, hay dos interruptores: `INCLUIR_MARIDAJE` e `INCLUIR_NOTAS`. Hoy en `true`, o sea que el maridaje sugerido y las notas con ❀ se anexan a la descripción de cada plato, porque Wix no tiene campo propio para eso. Pregúntame antes de cambiarlos.

## Lo que sigue después, no lo hagas ahora

1. Asignar los platos a sus secciones (se termina en el dashboard)
2. Quitar el bloque de datos estructurados de Settings → Custom Code, para no tener dos schemas
3. Cargar el inglés por el Translation Manager
4. 301 de `/menú-español` y `/english-menu` hacia `/menu-completo`
