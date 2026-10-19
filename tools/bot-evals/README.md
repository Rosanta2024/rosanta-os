# Batería del bot (evals) — 19-oct-2026

Prueba el bot de WhatsApp/Instagram con **50 casos sacados de chats reales** (anonimizados) antes de publicarlo,
igual que `?page=pruebas` prueba la intranet. Corre el **código real** de `apps-script/bot-rosanta` dentro del
motor de la sombra (`cloud/bot/src/motor-bot.js`): Meta, Wix, Claude, correo y hojas están imitados, nada sale a nadie.

| Archivo | Qué es |
|---|---|
| `casos.json` | 50 casos, 82 mensajes evaluados. Cada mensaje trae lo que contestó el bot real (`grabado`) y sus reglas |
| `reglas.js` | Las reglas fijas (flujo y texto) y cuáles son críticas |
| `juez.js` | Juez con Claude Haiku 5.5 para lo subjetivo (tono, fiel a la base, responde lo preguntado, foto) |
| `correr.js` | El corredor |
| `linea-base.json` / `.txt` | Resultado de la versión publicada **@58** (modo grabado) |
| `precios-base.json` | Montos en Q de la base de conocimiento del 19-oct (para "no inventa precios") |

## Uso

```bash
node tools/bot-evals/correr.js                                          # gratis, sin red, 0.1 s
node tools/bot-evals/correr.js --comparar tools/bot-evals/linea-base.json # código 1 si algo que pasaba ahora falla
node tools/bot-evals/correr.js --solo QUE-02,JUA-01 --detalle
```

Con la clave de la sombra (solo en el servidor `rosanta-bot-sombra`, variable `ANTHROPIC_SOMBRA`):

```bash
node tools/bot-evals/correr.js --juez --kb kb.txt                       # + juez: ~US$0.02
node tools/bot-evals/correr.js --modo modelo --juez --kb kb.txt --max-usd 0.6 --solo <rápida>
```

**Modos.** *grabado*: el "modelo" contesta lo que contestó el bot real; prueba el código que se va a publicar
(callarse, pasar a Juanma, Wix, botones, la red de seguridad de eventos) y las reglas de texto califican la
respuesta que recibió el cliente de verdad (algunas son de versiones viejas del bot o de la base). *modelo*:
Claude de verdad en los mensajes evaluados; prueba el prompt. Cuesta ~US$0.02 por mensaje (el pedido del bot
pesa ~9.700 tokens): corrida completa ~US$1.7, rápida ~US$0.45.

**Rápida** (casos con reglas críticas): `QUE-01,QUE-02,QUE-03,QUE-04,QUE-06,JUA-01,JUA-02,JUA-03,JUA-04,RES-01,RES-02,RES-06,RES-09,EVE-01,EVE-03,EVE-07,FOT-02,RAR-02`.

**Reglas pendientes de decisión** (`pendiente: true`): se reportan, no cuentan. Hoy: que una foto quede registrada.

## Cómo engancharlo a la publicación (propuesta, no instalado)

1. **Candado propio del bot** — `.claude/hooks/candado-bot.py`, como una entrada más de `PreToolUse` en
   `.claude/settings.json` (el candado de clasp no se toca). Frena `clasp create-version` / `update-deployment` /
   `deploy` cuando el `.clasp.json` es el del bot (`1XNbCMcGg4uo…`) y no hay sello vigente.
2. **Sello** — `~/.rosanta-sellos/bateria-bot.json`, lo escribe `correr.js --sellar` (por agregar) solo si la
   corrida en modo grabado contra `linea-base.json` da **0 regresiones** y 0 errores. Guarda el hash de los
   archivos del bot: cualquier cambio después de la batería lo invalida (no depende de la hora).
   A diferencia de la intranet, aquí no hace falta que Juanma reporte el conteo: la batería corre sola en local.
3. **Modelo y juez en la nube** — una tarea `POST /tareas/bateria-bot` en `rosanta-bot-sombra` (la arma la sesión
   de la nube, que es dueña de ese servicio): corre `correr.js --modo modelo --juez` con la rápida, la clave
   `ANTHROPIC_SOMBRA` y la base del Doc, y guarda el resultado con el hash del bot. Al principio solo **avisa**;
   cuando tenga dos semanas de historia, las regresiones críticas del modo modelo también pueden frenar.
4. **Línea base** — se actualiza solo cuando una corrida mejora algo o Juanma acepta un cambio de comportamiento:
   `correr.js --etiqueta @NN --salida tools/bot-evals/linea-base.json`.
5. **Tope** — `--max-usd` corta la corrida. Con el tope de US$10/mes compartido con la comparación diaria:
   grabado siempre (gratis), rápida con modelo en cada publicación que toque el prompt, completa una vez por semana.

## Agregar un caso

Copiar un chat de la consola, cambiar nombres, apellidos, teléfonos y correos por genéricos
(`clienteNN@ejemplo.test`), y escribir las reglas del mensaje a evaluar (`reglas.js` tiene la lista).
Si el bot real no contestó ese mensaje, poner en `grabado` lo que se quiere probar y una `nota` que lo diga.
