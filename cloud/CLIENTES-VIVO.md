# Clientes en vivo — el pipeline de eventos (construido y ensayado el 19-oct-2026, SIN encender)

Rama `claude/nube-clientes-vivo`. Diseño: `Rosanta OS/00_Admin/Apps_Script_e_IA/2026-10-17_Nube_Fase2_y_MarketingOS.md` (secciones 3b, 5 y 8).

## Un solo escritor
Hoy escriben en Marketing OS › `cotizaciones` y `revisiones` la pantalla Eventos de la intranet y la revisión diaria de la Mac (`cot.sh` → `?hook=cotizaciones` de Marketing OS). El bot NO escribe ahí. Con **PARAMETROS › `motor_eventos` = base**:
- la pantalla Eventos del servidor nuevo guarda con el **código real** (`EventosDatos.js`: versión todo o nada, y sala corrige solo lo suyo);
- la revisión diaria escribe por `/hooks/cotizaciones` del servidor nuevo, con el **mismo contrato** que `cotHook_` (list, get, batch, revision, revisiones; usa el `Cotizaciones.js` real de Marketing OS). `cot.sh` usa la dirección nueva **si existe** `~/.rosanta-secretos/cotizaciones-nube` (2 líneas: la URL y el token);
- la base (`filas_clientes`, migración 012) manda y cada guardado se copia a la hoja; la consola, el CRM y el informe del mes la siguen leyendo;
- **cerraduras** (sin publicar): con base, `guardarEventos` de la intranet (`NubeClientes.js`) y `cotHook_` (batch y revision) se niegan;
- si alguien escribe a mano en la hoja una fila del servidor: **conflicto**, no se pisa y queda en `filas_clientes_importaciones`.
Reservas (Wix), carritos (Wix) y CRM (CRMSync) NO cambian de escritor en esta fase: la sombra de Clientes los copia.

## Ensayo (`cloud/herramientas/ensayo-clientes.js`): 37/37
Servicio `rosanta-nube-clientes-ensayo`, base `rosanta_ensayo`, hoja "ENSAYO Clientes en vivo" (`1OzqU5Av0Wx4ajGeTON__A0SQeJmoW0OZ-a-mduAJ56c`, sembrada con el pipeline real; `rosanta-nube@` como Editor solo ahí). Con sheets (409, Apps Script escribe y se importa), encendido (~6.5 s), guardados por pantalla y por hook (210–1112 ms desde la Mac), versión vieja rechazada, cocina 403, revisión del día sin duplicar, clave del hook, copia con su marca, conflicto, vuelta atrás (~7 s) y Apps Script escribiendo otra vez. En cada paso: base = hoja, sin duplicados ni faltantes. (El "sala" de prueba es de solo lectura: el código real lo niega; lo de sala solo-lo-suyo lo cubre la batería.)

## Paso a vivo (después del 26-oct, con el sí de Juanma)
1. Publicar la intranet con `NubeClientes.js` y la cerradura de `EventosDatos.js` (batería del navegador, candado clasp), con `motor_eventos` todavía en sheets; publicar Marketing OS con la cerradura de `cotHook_`.
2. Aplicar la 012 en `rosanta`; compartir Marketing OS con `rosanta-nube@` como **Editor**; secreto `COTIZ_TOKEN` en Secret Manager (el valor de las Propiedades de Marketing OS).
3. Publicar el servicio con `MKT_VIVO_ID` = Marketing OS, `CLIENTES_VIVO_REAL=si`, `INTERRUPTOR_LIBRO` = Config, y su reloj de importar cada 15 min.
4. `motor_eventos = base` en PARAMETROS, importar, y crear `~/.rosanta-secretos/cotizaciones-nube` en la Mac.
**Volver atrás:** `motor_eventos = sheets` y borrar ese archivo (~7 s).
Después del paso: borrar el servicio de ensayo, la hoja de ensayo (papelera) y las filas de ensayo de `rosanta_ensayo`.

## Reservas, carritos y CRM (20-oct-2026, SIN encender)
Los avisos de Wix los recibe rosanta-nube (`/hooks/carrito`, `/hooks/reserva`). Con el interruptor `hooks_*` en **base** (tabla `interruptores`), rosanta-clientes corre el **código real** de Marketing OS (`Code.js`: `intakeCarrito`; `CRMSync.js`: `intakeReserva` y `sincronizarCRM`) sobre la base y deja el resultado en `filas_clientes` (`reservas`, `carritos` y `crm`; migración 014). Después lo copia a las hojas como lo haría `setValues`: fechas como fecha, el teléfono de reservas como número, lo nuevo arriba en reservas y carritos, y el CRM buscado por correo o teléfono, con el teléfono como texto. El CAPI (AddToCart) lo manda el servidor con `META_CAPI_TOKEN`.
- **La hoja manda** en estas tres pestañas, salvo lo que el servidor todavía no copió. Hasta después del 5-nov siguen escribiendo CerrarMesasNoShow y ConsumoPendiente, y la gente edita el CRM. Una fila que desaparece del CRM se marca `borrada`, no se borra.
- **Sombra** (`/tareas/comparar-crm`, cada noche): (1) cada reserva y cada carrito que llegó por el receptor está en la hoja; (2) `sincronizarCRM` corrido por la nube sobre lo importado no cambia nada (es decir, el CRM de Apps Script = el de la nube). Responde 409 si hay diferencias. La foto queda en `clientes_comparaciones`.
- **Hallazgo (no es de la nube):** en una misma corrida de CRMSync, si un contacto NUEVO entra por un carrito y también tiene una reserva, la reserva se salta (`loc.fila === -1`) y queda para la corrida siguiente. Así pasa hoy en Apps Script. La nube hace lo mismo a propósito, para que la comparación sea justa.
- **El día del paso:** apagar el activador `alCambiarMarketingOS` de Marketing OS (a mano: Editor → Activadores). Si no, el CRM tiene dos escritores. Los dos llegan al mismo resultado, pero compiten entre sí.
- **Volver atrás:** `hooks_carrito` y `hooks_reserva` en `puente` (fila de `interruptores`; se relee cada 30 s), y volver a encender el activador.

## Fechas (decisión de Juanma del 20-oct, por el Estudio)
- **Día único firme: miércoles 5-nov.** Pipeline (cotizaciones con anticipos), reservas, carritos, CRM y CAPI van ese día, porque tocan dinero.
- El jueves 29-oct entra solo lo que no toca dinero ni el cierre, con 2 días de sombra limpia. Contenido y pauta de Marketing, solo si Juanma lo aprueba por la Central.
- **Lunes 26-oct:** los relojes `importar-clientes` e `importar-crm-clientes` no corren a las 7, 8 y 9 (horario "6,10-23"). A las 10:30 vuelven a "6-23". Lo hace una tarea programada de la Mac (`relojes-clientes-lunes-26`). Si no corrió, ejecutar:
  `gcloud scheduler jobs update http importar-clientes --schedule "2,17,32,47 6-23 * * *" --location us-central1`
  `gcloud scheduler jobs update http importar-crm-clientes --schedule "10,25,40,55 6-23 * * *" --location us-central1`

## Marketing: contenido y pauta (20-oct-2026, SIN encender; ensayo 18/18)
- **Interruptor:** PARAMETROS › `motor_marketing` (la intranet cierra su guardado). La **pantalla se queda en la intranet**, porque Meta, Claude y Drive viven en Apps Script. Con `base`, las 6 funciones de guardar (`mktUpsert`, `mktDelete`, `calGuardarVersion`, `psGuardarRegla`, `psGuardarSupuesto`, `psGuardarPrueba`) le pasan el pedido a rosanta-clientes (`NubeClientes.js › _mktDesvio_`, `POST /interno/marketing` con `NUBE_CLAVE_TAREAS`). La nube corre el mismo código sobre la base (`filas_clientes`, migración 015) y copia a Marketing OS **antes de contestar**: la pantalla relee la hoja.
- **Llaves:** la columna A; en `calendario_versiones` es versión + id, y en `papelera` es fecha + pestaña + id. Un borrado marca `borrada` en la base y en la hoja borra la fila. La `papelera` se crea con el primer borrado.
- **La hoja manda** al importar (cada 15 min, en el reloj `importar-crm-clientes`), salvo lo que el servidor todavía no copió. Siguen escribiendo en Apps Script: la captura de Meta de los lunes (`hechos_semana`, `pixel_semana`, `estados_semana`; aquí solo se leen), el Ads Script, WixReservasPauta, PosPauta, ClientesNuevos (`pauta_semanal`) y la skill de pauta (`aprendizajes`).
- **Ensayo** (`cloud/herramientas/ensayo-marketing.js`): encendido en 29 s, guardados de 0.7 a 1.7 s, vuelta atrás en 9 s, base = hoja y sin llaves repetidas. Cuidado con la cuota de Sheets: la cuenta rosanta-nube@ la comparte con todos los servicios (para repetir solo la vuelta atrás, `SOLO_C=1`).
- **El día del paso:** `NUBE_CLAVE_TAREAS` en las Propiedades de la intranet (ya la usa `nubeGuardarCierre_`); rosanta-nube@ como **Editor** de Marketing OS; `motor_marketing = base`. **Volver atrás:** `motor_marketing = sheets` (la intranet lo relee cada minuto; la nube, cada 30 s).

## Marketing el jueves 29-oct (Juanma, 20-oct). Lo hace la sesión de Clientes
`motor_marketing` tiene tres valores: `sheets` | `sombra` | `base`. Con **sombra**, la intranet guarda en la hoja como siempre y, antes, avisa a `/interno/marketing-sombra`. La nube corre el mismo código con las pestañas recién leídas y anota lo que haría en `marketing_sombra` (migración 016). `comparar-crm-noche` cruza esas anotaciones con la hoja. Si la nube falla, la intranet guarda igual.
1. **Jueves 22:** el Estudio publica la intranet (NubeClientes.js de cf2c541; MarketingDatos.js y PautaSistema.js de b0382f7). La batería se corre en el Chrome de Juanma.
2. **Viernes 23:** `NUBE_CLAVE_TAREAS` en las Propiedades de la intranet (en el guion del Estudio).
3. **Martes 27, después de las 10:00:** PARAMETROS › `motor_marketing = sombra`.
4. **27 y 28 a la noche:** `comparar-crm-noche` sin diferencias en Marketing, y con pedidos > 0. Ojo: si nadie guardó nada en Marketing, la sombra no probó nada.
5. **Jueves 29:** con el sí de Juanma, rosanta-nube@ pasa a **Editor** de Marketing OS y se pone `motor_marketing = base`. Probar un cambio chico en el calendario desde la intranet y verlo en la hoja.
**Volver atrás:** `motor_marketing = sheets` (o `sombra`). La intranet lo relee cada minuto y la nube cada 30 s. Lo guardado por la nube ya está en la hoja.

## Rutas para rosanta-web (la web propia sin Wix; d7733d8, 20-oct-2026)
`/interno/web/crm-reserva`, `/interno/web/capi` y `/interno/web/pipeline-adventure` (`app/src/vivo-clientes/web.js`, prueba `app/test/web.test.js`). Interruptores en la tabla `interruptores`: `web_reservas`, `web_capi` y `web_adventures` (sin fila = **sombra**: 202 y solo se anota en `hooks_wix_recibidos`; base = de verdad; apagado = 409). El día que la web pase a base hay que apagar el CAPI de `events.js` de Wix, o Meta recibe la reserva dos veces (está en el guion de la web, fila del 13-nov).
**CONTRATO COPIADO:** rosanta-web copió tal cual los validadores (`limpiarReserva` de hooks-wix.js, `limpiarCapi`, `limpiarAdventure`) en su `cloud/app/test/fixturas/contrato-clientes-d7733d8.js` (rama `claude/web-integracion`, 254/254). **Si cambia cualquiera de esos tres, o `hooks-wix.js › limpiarReserva`, hay que avisarle al equipo "Web propia sin Wix" con el commit**, para que vuelva a copiarlos.

## Migraciones en producción (aviso del Estudio, 20-oct-2026)
En `rosanta`, SIEMPRE con `--solo`: `node cloud/herramientas/migrar.js --base rosanta --solo 017_x.sql` (sin `--aplicar` primero, para ver la lista) y después `--aplicar`. Sin `--solo` se aplicarían también las migraciones de otras ramas que esperan su día (así se adelantó la 050 el 20-oct). Antes, el respaldo: `gcloud sql backups create --instance rosanta-db --description "antes de …"`.

## COTIZ_TOKEN rotado (21-oct-2026, sesión C)
C rotó la llave de la revisión diaria de cotizaciones (Marketing OS › cotHook_ acepta COTIZ_TOKEN, y la vieja hasta el 22-oct). rosanta-clientes en producción todavía NO tiene esa llave (`/hooks/cotizaciones` contesta unauthorized). **El día único (5-nov), con el sí de Juanma, se carga en Secret Manager la llave NUEVA** (el valor de `~/.rosanta-secretos/cotizaciones-token` después de la rotación) y se conecta como `COTIZ_TOKEN_VIVO`. Antes, traer main a esta rama para que la copia de `Cotizaciones.js` tenga `cotTokenOk_`.
