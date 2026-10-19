# Bot en sombra, consola, reseñas y encuesta — manual

Desde el 19-oct-2026. Rama `claude/nube-bot-sombra`. Diseño, plan del paso a vivo y bitácora:
`Rosanta OS/00_Admin/Apps_Script_e_IA/2026-10-19_Nube_Bot_Resenas_Encuesta.md`. Lo general (base, gcloud, sello, candado) está en `README.md`.

**Todo en SOMBRA.** El bot de producción sigue siendo el de Apps Script (@58): Meta le manda los mensajes a él y a nadie más. La sombra no recibe mensajes, no manda nada a clientes, no toca Wix ni las hojas.

## Qué hay

| Pieza | Dónde |
|---|---|
| Servicio | Cloud Run **`rosanta-bot-sombra`**, Querétaro, `https://rosanta-bot-sombra-512086396641.northamerica-south1.run.app`, cuenta `rosanta-nube@…`, máx. 1 instancia, timeout 900 s. **Sin webhook de Meta** (la ruta no existe) |
| Código | `cloud/bot/` (paquete propio). `bot-rosanta/` = copia EXACTA de `apps-script/bot-rosanta`, con la versión publicada en `VERSION.txt` (primera línea: `@N · hora ISO · commit`) |
| Motor | `src/motor-bot.js`: corre el código real del bot con Meta, Wix, Claude, correo, hojas, propiedades, cache y el reloj imitados |
| Reproductor | `src/reproductor.js` + `src/conversaciones.js`: arma cada chat desde Rosanta Leads (Conversaciones + Leads, la copia que guarda la sombra 2 en `hojas_copia_f2`), **anonimizado**, y le pasa al bot cada mensaje a la hora original, con el historial real. Compara: si contestó, la acción (reserva creada/cambiada/cancelada/consultada, informar, escalar), si pasó el chat a Juanma, el idioma |
| Modos | **grabado** (gratis): Claude contesta lo que contestó el bot real → prueba la tubería. **modelo**: Claude de verdad con la base de conocimiento de hoy → prueba las decisiones. Solo con la clave `ANTHROPIC_SOMBRA` (Secret Manager) |
| Tablas | `bot_corridas`, `bot_turnos` (migración 030, rango 030–039 de esta rama). Todo anonimizado |
| Pantallas | En la sombra 2 (Clientes, solo dueño por la matriz 020): `/clientes/consola` (consola real: chats y lo que ya sabe el bot), `/clientes/consola/sombra` (comparación de cada noche), `/clientes/resenas` (panel de reseñas real, desde la hoja de control), `/clientes/resenas/encuesta`. Código en `cloud/app/src/clientes2/`, proyectos copiados en `cloud/app/proyectos/` |

## Tareas

- `POST /tareas/comparar-bot-noche` (cabecera `x-rosanta-tarea`): el día anterior (Guatemala) en modo grabado y, si hay clave, en modo modelo (máx. 40 mensajes). **409** si la copia tiene más de 2 h, si hubo errores, o si en modo grabado la sombra hizo otra cosa que el bot real en un mensaje de la misma versión ("el bot real no contestó" solo se muestra: puede ser que Juanma contestó desde la app de Instagram). Las diferencias del modo modelo no alertan.
- `POST /tareas/reproducir` `{ modo, desde, hasta, maxModelo }`: a mano.

## Cuando el bot publica una versión nueva

1. Esperar a que la sesión del bot publique (`clasp create-version` + `update-deployment`).
2. `cloud/herramientas/traer-bot.sh` y poner la versión en la primera línea de `cloud/bot/bot-rosanta/VERSION.txt` (la comparación vale desde esa hora).
3. `python3 cloud/herramientas/sellar-nube.py --servicio rosanta-bot-sombra` (corre `cloud/bot/test`).
4. `gcloud run deploy rosanta-bot-sombra --source cloud/bot --region northamerica-south1` (la configuración ya quedó en el servicio).

Si la copia se separa del bot, falla "Las copias del bot son exactas". Si cambian la consola o el panel de reseñas, falla la prueba de copias de `clientes2.test.js`: copiarlos, sellar y que la sombra 2 publique.

## Modo en vivo — CONSTRUIDO Y APAGADO (19-oct-2026, aprobado construirlo; encenderlo espera el sí de Juanma)

- **Dos llaves:** la variable `MODO_BOT=vivo` en el servicio (sin ella `/webhook` no existe, como hoy) y el interruptor en la base `bot_estado › INTERRUPTOR_BOT` (`puente` por defecto: cada mensaje se reenvía tal cual al bot de Apps Script; `vivo`: lo atiende el servidor). Se cambia con `POST /tareas/interruptor-bot {"valor":"vivo"|"puente"}` (clave de tareas). **Volver atrás = poner `puente`: segundos, sin entrar a Meta.**
- **Código:** `src/vivo.js` (cola de a un mensaje, estado en la base, red con lista de direcciones, red de seguridad), `src/hojas-vivo.js` (Rosanta Leads en memoria y cada cambio copiado a la hoja en el mismo orden), `src/correo-vivo.js` (Gmail; si falla, `bot_correos` y reintento cada minuto). El motor es el mismo: `crearMotor({ relojReal, estado, libros, red, correo, alCambiarHoja })`.
- **Red de seguridad:** si el bot falla, o intentó contestar y Meta no aceptó ningún envío, el mensaje se reenvía al bot de Apps Script. Si se calló a propósito (chat en manos de Juanma), no.
- **Claves** (Secret Manager → variables): `BOT_WHATSAPP_TOKEN`, `BOT_IG_TOKEN`, `BOT_MESSENGER_TOKEN`, `BOT_ANTHROPIC_KEY`, `BOT_WIX_SECRETO`, `BOT_VERIFY_TOKEN`, `BOT_WEBHOOK_SECRET`, `BOT_APPS_SCRIPT_URL` (la `/exec` del bot con `?token=`), `BOT_GMAIL` (JSON de la autorización). El motor solo ve marcadores (`$WHATSAPP_TOKEN`); la clave se pone en un proceso aparte, nunca en la base ni en la línea de comandos.
- **Tablas:** `bot_estado`, `bot_eventos`, `bot_correos` (migración 031, aplicada; respaldo previo 1792422615008).
- **Tareas en vivo:** `POST /tareas/bot-minuto` (Salientes de la consola, devolver al bot, chats que vuelven, correos pendientes; reloj de 1 min solo en vivo), `POST /tareas/importar-estado-bot` (una vez: las Propiedades del bot sin claves), `GET /tareas/bot-eventos` (vigilar).
- **Pendiente antes de encender:** fotos de la consola por WhatsApp (subida de archivo a Meta) en vivo; refresco del token de Instagram desde el servidor (vence a los 60 días); ensayo con el número de prueba de Meta. Pasos completos en el documento de diseño, sección 3.
- Batería `cloud/bot`: 23 (14 sombra + 9 vivo).

## Límites conocidos

- Mensajes que el bot real atendió con una versión anterior a la copiada no se comparan (cambió el comportamiento: antes del 15-oct no se callaba al pasar a Juanma).
- El Wix de mentira dice que siempre hay lugar y, si piden consultar/cambiar/cancelar sin reserva conocida, supone una.
- Lo que Juanma contesta desde la app de Instagram pausa al bot real (eco de Meta) y no queda en Conversaciones.
- El canal de correo del bot no se reproduce (deja borradores en Gmail).
- Reseñas: promedio y total son de las reseñas que anotó el bot de reseñas desde el 7-jul-2026, no el total de Google.
