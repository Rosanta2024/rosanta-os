# Rosanta — instrucciones de sesión

## Al INICIO de toda sesión, cargar estas dos skills

1. **`rosanta-cerebro`** — el contexto maestro de Rosanta y de los proyectos de Juanma.
   No se carga solo: hay que invocarlo. Trae los 6 pilares de Rosanta OS, el DRE, el
   mapa de proyectos y **las alertas N1 abiertas**.
2. **`calibrar-respuestas`** — explicaciones y diagnósticos cortos y directos;
   instrucciones técnicas que Juanma va a ejecutar, completas y paso a paso.

**Por qué está escrito acá:** el 10-sep-2026 se trabajaron nueve horas en la intranet
sin cargar el cerebro. Costó no ver que `food_cost_objetivo_pct = 32` en
`apps-script/rosanta-intranet/Setup.js` está listado como **alerta N1**, con el objetivo
correcto en 27.8%. Depender de acordarse ya falló una vez. (Aquel 27.8 también quedó
obsoleto: desde el 14-sep-2026 la meta es 28% y vive solo en PARAMETROS; ver cerebro v15.)

## Al CERRAR la sesión

En Claude Code se cierra **directo al cerebro**. No se pasa por el tablero
`rosanta-seguimiento-semanal`: ese es un paso previo del flujo de chat, donde Juanma
consolida varias conversaciones antes de subirlas. Acá el trabajo es de una sesión larga
y va al cerebro de una vez.

**El cerebro se actualiza solo, sin pedirle nada a Juanma.** Orden explícita del
11-sep-2026: no volver a preguntar ni a entregar un `.skill` para instalar a mano. La skill
instalada vive acá, y es escribible:

    ~/.claude/skills/rosanta-cerebro/

(Hasta septiembre vivía en `~/Library/Application Support/Claude/local-agent-mode-sessions/
skills-plugin/…`; esa ruta ya no existe. Verificado el 15-oct-2026.)

Procedimiento: (1) respaldar la versión instalada en `~/Dev/Rosanta/tools/`; (2) regenerar el
contenido **partiendo de la instalada**, subiendo versión y fecha; (3) copiar `SKILL.md` y
`references/` encima; (4) **verificar leyendo desde la ruta instalada**, no desde la copia de
trabajo; (5) sincronizar `~/Dev/Rosanta/rosanta-cerebro/` y dejar el `.skill` en
`~/Dev/Rosanta/tools/` como respaldo.

No tocar `manifest.json`: solo cachea nombre y descripción, y la descripción no cambia. Si
alguna vez la app resincroniza desde el servidor y pisa el archivo, se vuelve a aplicar el
mismo procedimiento; el `.skill` de `tools/` es la copia de seguridad.

**Al reempaquetar, partir siempre del contenido de la SKILL INSTALADA.** Otras sesiones
la actualizan y es la única fuente confiable. La carpeta `~/Dev/Rosanta/rosanta-cerebro/`
se sincronizó a **v11 (11-sep-2026)** y dejó de estar atrasada —estuvo en v8 mientras la
instalada iba por v10, y reempaquetar desde ahí habría borrado los 6 pilares, el DRE anual
y las alertas N1—, pero la regla no cambia: **se parte de la instalada y después se
sincroniza la carpeta**, nunca al revés. El respaldo de la v8 quedó en
`rosanta-cerebro.v8-respaldo/`.

## Trabajo con Apps Script

- Publicar = `clasp create-version` + `clasp update-deployment -V <n> <deploymentId>`.
  `clasp push` solo actualiza HEAD, no lo que ve la gente.
- Correr la batería antes de publicar **en el navegador**, contra lo subido a HEAD:
  `https://script.google.com/a/macros/rosanta.rest/s/AKfycbxw_iBKkb80hvTvZ7bMNyJKDeSn3AysJGzmypiVRCU/dev?page=pruebas`
  (solo rol dueño, ~2–3 min). **`clasp run correrPruebasTexto` ya no sirve** desde el
  12-sep-2026: con el login del cliente OAuth por defecto de clasp funcionan push, pull y
  list-deployments, pero `scripts.run` contesta "Unable to run script function".
- **Mirar el conteo, no el color:** una batería en verde que revisó menos de lo que
  debía es un fallo, no un éxito.
- Los activadores se crean a mano (Editor → Activadores): `ScriptApp.newTrigger()`
  necesita un scope que el manifiesto no declara.
- Borrar los diagnósticos temporales antes de publicar.
- **No creerle a clasp.** El 12-sep-2026 imprimió "You are logged in as
  restaurante@rosanta.rest" con un token de la cuenta personal, y "Script is already up to
  date" con un push que sí había subido 15 archivos. La cuenta se verifica con `tokeninfo`
  del access_token de `~/.clasprc.json`; un push o una versión se verifican bajando el
  proyecto (`clasp pull`, o `clasp pull --versionNumber N`) a una carpeta APARTE y comparando.
- **Nunca `clasp pull` dentro del repo:** baja lo del servidor encima del disco y pisa el
  trabajo sin subir de todas las sesiones.
- **Varias sesiones en la misma carpeta:** avisar antes de tocar archivos compartidos y
  hacer un solo push. `clasp push` sube el directorio ENTERO, con lo que cada una tenga a
  medias. Si hay trabajo ajeno en disco sin probar, publicar con `create-version` +
  `update-deployment` SIN push: `create-version` congela lo que está en el servidor.
  **Desde el 14-oct-2026 el candado lo hace cumplir:** antes de cada `clasp push` de la
  intranet baja el HEAD aparte y frena el push si el servidor tiene archivos que esta carpeta
  no tiene (ni en disco, ni en ninguna versión de la historia de su rama, ni en su último push): son de
  otra sesión. Desde el 15-oct-2026 una versión de un commit anterior de la misma rama (main, un merge
  ya traído) ya no frena. Simulador: `python3 .claude/hooks/prueba-candado.py` (26/26).
  Se resuelve trayendo su commit (`git merge`) o pidiéndole que haga commit. Pisar a
  propósito solo con el sí de Juanma: `ROSANTA_PUSH_PISAR="motivo" clasp push`.
- **Batería por partes:** `?page=pruebas` corre la batería completa en 3 carriles a la vez
  (~2 min). `&grupos=finanzas,web` corre solo esos grupos y sale como CORRIDA PARCIAL: sirve
  mientras se trabaja, nunca para sellar ni publicar. Un grupo nuevo va en
  `PRUEBAS_CARRILES_` (Pruebas.js) o falla "Los carriles cubren cada grupo una vez".
- **Parciales con JavaScript:** `include()` sanitiza (usa `createHtmlOutputFromFile`) y se
  come código sin avisar; se pegan con `incluirCrudo_()`. Cada parcial nuevo va en las listas
  `VISTAS` de `Pruebas.js`, o sus llamadas al servidor quedan sin revisar y la prueba sigue
  en verde.
- **Un iframe vacío visto desde Claude en Chrome no prueba nada:** esa ventana bloquea
  cookies de terceros. Se confirma en el Chrome de la persona.
- **Permisos (20-oct-2026):** el candado frena cualquier `clasp push` (de CUALQUIER proyecto) cuyo
  `appsscript.json` cambie los `oauthScopes` frente al HEAD del servidor: Google pide reautorizar y los
  activadores y el /exec fallan hasta que Juanma lo haga. Avisar ANTES a "Mentor · Central Rosanta" y,
  con su sí, `ROSANTA_SCOPES_OK="motivo" clasp push`. Simulador: `prueba-candado.py` (31/31).
- **Candado (14-oct-2026, `.claude/hooks/candado-clasp.py`):** bloquea `clasp pull` que baje
  dentro del repo, y `create-version`/`update-deployment`/`deploy` de la intranet sin sello
  vigente de la batería (`~/.rosanta-sellos/bateria-intranet.json`: posterior al último push
  y con 0 fallas). El sello se crea SOLO con `.claude/hooks/sellar-bateria.py` y el conteo
  REAL que Juanma reporta o que se lee en su Chrome. **Nunca crear ni editar el sello sin
  ese resultado, ni para "destrabar".**

## Reglas que no cambian

- **Confirmar la fuente de datos ANTES de construir.** La fuente financiera es el Sheet
  nativo del maestro, no el `.xlsx`.
- No reescribir módulos que funcionan: los cambios son incrementales.
- No cambiar roles ni permisos de la hoja USUARIOS sin pedirlo.
- Antes de nombrar una función nueva, verificar que no exista: los `.gs` comparten un
  solo ámbito global y un nombre repetido pisa al otro en silencio.
- Respuestas concisas y en español.
- Si el cerebro contradice algo que Juanma dice hoy, **gana Juanma**; ofrecer
  actualizar el cerebro.
