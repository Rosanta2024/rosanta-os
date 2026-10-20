# Rosanta en Google Cloud — manual de operación

Migración aprobada por Juanma el 17-oct-2026. Estudio y bitácora:
`Rosanta OS/00_Admin/Apps_Script_e_IA/2026-10-17_Estudio_Migracion_Base_de_Datos.md`.
**La intranet de Apps Script sigue mandando** hasta que cada módulo pase con su interruptor.

## Qué hay

| Pieza | Dónde | Notas |
|---|---|---|
| Proyecto | `rosanta-apps-script` (512086396641) | Facturación "My Maps Billing Account"; alerta de US$43/mes sobre toda la cuenta |
| Base | Cloud SQL `rosanta-db`, Postgres 17, micro, `northamerica-south1-a` | Sin redes autorizadas (solo el conector), SSL obligatorio, protección contra borrado |
| Base de datos | `rosanta` | Tablas en `db/migraciones/`. Usuario `app`: lee y escribe, **no** borra pagos ni toca tablas |
| Servidor | Cloud Run `rosanta-nube`, Querétaro | `https://rosanta-nube-512086396641.northamerica-south1.run.app` · cuenta `rosanta-nube@…` |
| Claves | Secret Manager | `db-postgres-root`, `db-app`, `clave-tareas`. Nunca en el código, el chat ni el disco |
| Respaldos | Diario automático ×7 días + recuperación al minuto (en la base) | |
| Respaldo semanal | `gs://rosanta-respaldos-nube/rosanta.sql.gz`, domingos 3:00 GT | Reloj `respaldo-semanal-base` (Scheduler, us-central1; Querétaro no tiene). Depósito con versiones: 12 semanas. Cuenta `rosanta-respaldos@…` solo puede exportar |

## La herramienta en la Mac

```
export CLOUDSDK_PYTHON=/Library/Frameworks/Python.framework/Versions/3.14/bin/python3
~/google-cloud-sdk/bin/gcloud ...
```
El Python 3.9 del sistema no sirve. Cuenta: restaurante@rosanta.rest (`gcloud auth login`, en segundo plano con timeout largo).

## Cambiar las tablas

1. Archivo nuevo en `db/migraciones/` (`004_...sql`). **Una migración aplicada no se edita.** Números reservados: **001–009 Pagos y base** (esta rama); **010–019 Fase 2 (Caja) y Marketing OS** (rama `claude/nube-fase2-mkt`). **020–029 accesos y roles** (sesión C, rama `claude/nube-accesos`; 020 permisos y 021 bitácora aplicadas el 18-oct con respaldo previo). **020–029 accesos y roles** (rama `claude/nube-accesos`: la matriz de permisos, `020_permisos.sql`, que lee `app/src/permisos.js`). Ninguna migración de un rango altera tablas del otro.
2. `node cloud/herramientas/migrar.js` (muestra lo pendiente) y `--aplicar`.

## Publicar el servidor

1. `cd cloud/app && npm install` (si cambió `package.json`).
2. `python3 cloud/herramientas/sellar-nube.py` — corre la batería; si da 0 fallas, sella esa versión del código. **Un sello por servicio:** para otro servicio de Cloud Run, `--servicio <nombre>` (el candado lee el nombre del `gcloud run deploy <nombre>`).
3. `gcloud run deploy rosanta-nube --source cloud/app --region northamerica-south1` (las variables y claves ya quedaron puestas en el servicio).

El candado (`.claude/hooks/candado-nube.py`) bloquea el paso 3 sin sello vigente para el mismo código, y bloquea borrar la base o sus respaldos sin `ROSANTA_NUBE_BORRAR="motivo"` (solo con el sí de Juanma). Después de tocar el candado: `python3 .claude/hooks/prueba-candado-nube.py`.

## Pagos (Fase 1, en sombra desde el 17-oct-2026)

**Calendario (Juanma, 17-oct-2026):** sombra hasta el **31-oct inclusive** (para que entre el cierre de mes). En vivo desde el 1-nov **hasta cumplir los criterios**, no un plazo fijo: al menos 50 guardados reales con el ✓ en <1 s en 95 de cada 100, 0 diferencias de dinero en la comparación de cada noche y la copia a Sheets correcta 5 días seguidos. Meta ~1 semana; si a las 2 semanas no se cumple, se evalúa con Juanma. Parar si: >1.5 s en 95 de cada 100, una diferencia de dinero sin explicar, o la copia a Sheets falla 2 veces en una semana.


- Pantalla: `/pagos?u=<enlace>` (la misma de la intranet; solo muestra). Fotos de la comparación: `/pagos/fotos?u=<enlace del dueño>`.
- El motor corre los archivos de la intranet copiados en `app/intranet/` (listas `LISTA.txt` y `LISTA-VISTAS.txt`). **Si cambia uno en `apps-script/rosanta-intranet`, esperar a que la intranet lo publique y entonces:** `cloud/herramientas/traer-intranet.sh`, sellar y republicar. La prueba "El motor usa los mismos archivos que la intranet" falla si se separan.
- Relojes (Scheduler, us-central1): `refrescar-copia-pagos` (cada 15 min, 6 a 23 GT), `comparar-pagos-noche` (23:52 GT; responde 409 si la copia no coincide), `respaldo-semanal-base` (domingo 3:00).
- **Importación a la base (opción a de Juanma, 17-oct):** después de cada copia, `importar-pagos.js` trae a `pagos_proveedores` las filas de `PAGOS_PROVEEDORES` por su **ID** (nuevas se agregan; si cambió una de la hoja, se actualiza; un pago guardado en el servidor nunca se pisa: conflicto; fila sin ID, ID repetido o pago que ya no está en la hoja: problema). Cada corrida queda en `pagos_importaciones`. Con problemas, la tarea responde 409 y llega la alerta. La comparación de la noche revisa además que la base tenga las mismas filas que la hoja y que Pagos armado desde la base dé lo mismo.
- **Modo en vivo (construido y ensayado el 18-oct, SIN encender en producción):** se enciende con `MODO_PAGOS=vivo` en el servicio **y** `PARAMETROS › motor_pagos = base` en Config. El servidor guarda en la base (una transacción, de a un guardado), copia a `PAGOS_PROVEEDORES` con los tipos exactos (`escribir-hoja.js`; si falla, reintenta en cada refresco) y anota correcciones y anulaciones en `bitacora`. En la intranet (`NubePagos.js`, `CosteoVista.html`, **sin publicar**): con `base`, la pestaña de Pagos muestra la del servidor nuevo en un marco con el enlace de cada persona, y las funciones de guardar de Pagos se niegan; Caja chica y Compras siguen escribiendo y se importan cada 15 min. Para IVA sigue en la intranet (toca el maestro).
- **Ensayo (18-oct, `cloud/herramientas/ensayo-vivo.js`):** servidor `rosanta-nube-ensayo`, base `rosanta_ensayo`, COPIA de Config. **19/19:** abono, pago fraccionado, dos facturas juntas, anular lo propio, anular lo ajeno (se niega), compra de sala, cada guardado < 1 s desde la Mac (116–691 ms); Caja escribiendo en la hoja entra a la base; base = hoja sin duplicados; volver atrás en ~10 s (un refresco) y la intranet vuelve a mandar sin conflictos.
- **Paso a vivo (1-nov, con el sí de Juanma):** (1) publicar la intranet con `NubePagos.js` (batería del navegador, candado clasp) con `motor_pagos` todavía en `sheets`; (2) compartir Config con `rosanta-nube@` como **Editor**; (3) `traer-intranet.sh`, sellar y publicar `rosanta-nube` con `--update-env-vars MODO_PAGOS=vivo`; (4) poner `motor_pagos = base` en PARAMETROS y correr `POST /tareas/refrescar-copia` (si no, lo toma el refresco de los próximos 15 min; la intranet lo ve en 1 min). **Volver atrás:** `motor_pagos = sheets` y refrescar (~10 s).
- **Alerta por correo** a restaurante@rosanta.rest si falla cualquier intento de un reloj (política "Rosanta nube: falló una tarea automática", como máximo un correo por hora).

## Caja chica, Compras y cierres en vivo (construido y ensayado el 18-oct, SIN encender)

- **Interruptores** en PARAMETROS (el servicio los obedece solo con `MODO_PAGOS=vivo`): `motor_caja` (Caja chica y Compras; **solo vale con `motor_pagos = base`**, porque escriben en PAGOS_PROVEEDORES) y `motor_cierres` (los cierres del día llegan por `POST /tareas/cierre` desde el lector de la intranet).
- Pagos y Caja corren en **un solo motor** (`LISTA.txt` + `LISTA-CAJA.txt`). Las pestañas CAJA_CHICA, RETIROS_SOLICITUDES y CIERRES_DIARIOS van a `filas_vivas` (migración 005), con la misma regla de importar y copiar que Pagos. La copia a la hoja va en su propia fila de espera (si no, cada guardado esperaba la copia del anterior).
- **Mes cerrado** (`meses_cerrados`): corregir o anular solo el dueño (`corregir_dia_cerrado` de la matriz). Lo ajeno lo niega el código de la intranet (@212).
- **Siguen en la intranet, por el puente (18-oct):** leer los cierres por correo (`leerCierresCaja`) y leer la foto de un comprobante (`leerComprobanteCompra`) usan Gmail, Drive y Claude. El servidor contesta 409 si se las piden directo. Dentro de la pestaña de la intranet (`?dentro=1`), la pantalla nueva le pasa esas dos llamadas por `postMessage` a la intranet que la contiene (solo si quien la contiene es `*-script.googleusercontent.com`; el TRADUCTOR de `pantalla-pagos.js`), y `cajaPuente_` de `CosteoVista.html` corre la función de siempre (solo esas dos, con llamada literal, y solo si el mensaje viene del marco y del origen del servidor). Con `motor_cierres = base` el lector manda cada cierre a `/tareas/cierre` y la pantalla pide la caja al servidor. El servidor rechaza (400) un cierre con una fecha mal escrita.
- **Ensayo del puente** (`cloud/herramientas/ensayo-puente.js`): **21/21**. El código real de la intranet, con Gmail, Drive y Claude imitados y el POST de verdad al ensayo: lee el cierre sin rechazo de la cerradura, la intranet no escribe ninguna hoja, el cierre queda en la base y en la hoja, leerlo dos veces no duplica, base = hoja; la foto del comprobante se lee sin rechazo y no escribe nada. **Lo que solo se confirma con la intranet publicada:** el `postMessage` en el Chrome real (marco de googleusercontent → run.app) y Apps Script de verdad (Gmail, Drive, `UrlFetchApp`).
- **Arreglo de paso (18-oct):** `leerComprobanteCompra` usaba `MED_RET_MODELO_`, que se archivó con la pantalla vieja de retiros el 15-oct ("Tarea 3"): desde ahí el botón de la foto fallaba en la intranet. Ahora usa `CPE_MODELO_` en `ComprasEfectivo.js` (mismo modelo). **Publicado por la sesión C en la intranet @213** (99/99), que además sumó a la batería la prueba "Ninguna constante usada sin definir".
- **Intranet sin publicar:** `NubePagos.js` (cajaMotor_, cierresMotor_, `_cajaSoloConsulta_`, getCajaDestino, nubeGuardarCierre_), cerraduras en las 8 funciones de guardar de Caja y Compras, `CosteoVista.html` monta `/caja` y `/compras` en un marco, `CierresDiarios.js` manda el cierre al servidor con base, `Vigia.js` regenera 07_Caja_Chica cada hora con Caja en base (antes la reescribía abrir la pantalla). El día del paso: `NUBE_CLAVE_TAREAS` en las Propiedades del script (el valor del secreto `clave-tareas`).
- **Ensayo** (`cloud/herramientas/ensayo-caja.js`, sobre la copia): **37/37**. Combinaciones Pagos en base + Caja en sheets (la intranet escribe con el código real y el servidor importa) y todo en base; gastos de caja chica, conteo, compra en efectivo con su retiro, anular lo propio, lo ajeno negado, mes cerrado solo el dueño, un cierre del día (repetido no se duplica), vuelta atrás de cada interruptor (~9–10 s) y la intranet escribiendo otra vez; en cada paso base = hoja en las 4 pestañas. Guardados 0.12–0.46 s. El de Pagos se repitió después del cambio: 19/19.

## Paso a vivo de Pagos + Caja + cierres (plan acelerado, 19-oct)

- **Guion completo:** `~/My Drive/Rosanta OS/00_Admin/Apps_Script_e_IA/2026-10-19_Guion_Paso_a_Vivo_Pagos_Caja.md`. Fecha propuesta: lunes 26-oct 7:30–9:30. Nada en vivo sin el sí de Juanma.
- **Compensación de la sombra corta:** la comparación de cada noche suma base = hoja en CAJA_CHICA, RETIROS_SOLICITUDES y CIERRES_DIARIOS (`base-vs-hoja.js`, si existe `filas_vivas`) y, con Caja en vivo, 07_Caja_Chica del maestro = lo que dice la base (días ya pasados). `POST /tareas/conciliar-mes` (`conciliar.js`, migración 006, cuerpo opcional `{mes}`): cuadre por proveedor, pagado, caja, retiros, 07 y cierres del mes; 409 con diferencias. `GET /api/conciliaciones` solo el dueño. Ensayo `ensayo-compensacion.js`: 10/10.
- **`&nube=ensayo`** en la dirección de la intranet: solo el dueño ve en Pagos, Caja y Compras la pantalla del servidor de ENSAYO, para probar el puente en su Chrome con la intranet publicada. Quitar después del 1-nov.
- **Orden en producción:** primero migraciones 005 y 006, DESPUÉS publicar el servidor (el refresco importa caja y cierres y necesita `filas_vivas`).

## Clientes: servicio `rosanta-clientes` (definitivo; acordado el 20-oct-2026)

Rama `claude/nube-clientes-vivo`. Arranque `GOOGLE_ENTRYPOINT="node src/server-clientes-vivo.js"`. La misma base `rosanta`, la misma cuenta `rosanta-nube@…` y el mismo acceso (tablas `usuarios` y `permisos`, el `?u=` de siempre), **max 1 instancia**, y un sello propio: `sellar-nube.py --servicio rosanta-clientes`.

| Qué | Dónde |
|---|---|
| Pipeline (pantalla de Eventos) | `/clientes/eventos` · interruptor **`motor_eventos` en PARAMETROS** (la intranet tiene que cerrar su guardado) |
| Revisión diaria de cotizaciones | `/hooks/cotizaciones`: la dirección definitiva de `cot.sh` |
| Reservas, carritos y CRM | `/interno/aviso` (solo rosanta-nube, con `clave-tareas`): corre `Code.js` y `CRMSync.js` reales de Marketing OS y guarda en `filas_clientes` (012 + 014); copia a Marketing OS y a la CRM Maestra |
| Relojes | `importar-clientes` (2,17,32,47) → `/tareas/importar`; `importar-crm-clientes` (10,25,40,55) → `/tareas/importar-crm`; `comparar-crm-noche` (23:45) → `/tareas/comparar-crm` (409 = diferencias → alerta). Los dos de importar corren de 6:00 a 6:59 y de 10:00 a 23:59, sin las 7, 8 y 9, por la ventana del lunes 26 (Pagos). Después de ese día se vuelve a `6-23` |
| Dirección | `https://rosanta-clientes-512086396641.northamerica-south1.run.app` (publicado el 20-oct, rev 00001, en sombra: `motor_eventos` sheets, `hooks_*` puente) |

- **Avisos de Wix:** los recibe **rosanta-nube** (`/hooks/carrito`, `/hooks/reserva`; `hooks-wix.js`, migración 013), con las llaves `wix-hook-carrito` y `wix-hook-reserva`. Interruptores `hooks_carrito` y `hooks_reserva` en la **tabla `interruptores`**: `puente` reenvía al `/exec` de Marketing OS; `base` se lo pasa a rosanta-clientes.
- **Variables:** `MKT_VIVO_ID` (Marketing OS), `CLIENTES_VIVO_REAL=si`, `INTERRUPTOR_LIBRO` (Config), `CRM_VIVO=si`, `CRM_LIBRO` (CRM Maestra). Por Secret Manager: `DB_CLAVE`, `CLAVE_TAREAS`, `COTIZ_TOKEN_VIVO` y, con el sí de Juanma, `META_CAPI_TOKEN`.
- **En sombra** basta con que la cuenta sea Lectora de Marketing OS y de la CRM Maestra. Para escribir (`base`) tiene que ser **Editora** de las dos (con el sí de Juanma).
- Paso a vivo y vuelta atrás: `CLIENTES-VIVO.md`.

## Tareas

- Copiar USUARIOS a la base: `POST /tareas/sincronizar-usuarios` con la cabecera `x-rosanta-tarea` = secreto `clave-tareas`. La hoja `Rosanta_Intranet_Config` está compartida con `rosanta-nube@…` como Lector.

## Restaurar (probado el 17-oct-2026)

Nunca se restaura encima de `rosanta-db` sin el sí de Juanma: primero en una instancia aparte, se compara y recién ahí se decide. Antes y después, sacar la foto de cada tabla con `node cloud/herramientas/contar-base.js [instancia] [base]` (filas + huella del contenido; solo lee).

| Qué | Cómo | Tardó en el ensayo |
|---|---|---|
| **Volver a un minuto exacto** (últimos 7 días) | `gcloud sql instances clone rosanta-db rosanta-db-pitr --point-in-time=AAAA-MM-DDTHH:MM:SSZ` (crea una instancia nueva) | ~11.5 min |
| **Respaldo diario** (o uno bajo demanda: `gcloud sql backups create --instance=rosanta-db`) | crear una instancia vacía `rosanta-db-ensayo` (micro, Querétaro) y `gcloud sql backups restore <ID> --restore-instance=rosanta-db-ensayo --backup-instance=rosanta-db` (la instancia destino se pisa entera) | ~5 min crear + 8 min restaurar |
| **Respaldo semanal** (`gs://rosanta-respaldos-nube/rosanta.sql.gz`, con versiones) | en una instancia aparte: `gcloud sql databases create rosanta_semanal`, dar `roles/storage.objectViewer` en el depósito a la cuenta de esa instancia (tarda ~1 min en aplicar: si da HTTP 412, esperar y reintentar), `gcloud sql import sql <instancia> gs://rosanta-respaldos-nube/rosanta.sql.gz --database=rosanta_semanal`, y quitar el permiso | menos de 1 min (la base es chica) |

Resultado del ensayo: las tres copias idénticas a la de verdad, tabla por tabla (filas y contenido). Para borrar las temporales hace falta `ROSANTA_NUBE_BORRAR="motivo"` (candado) y, en la copia de "minuto exacto", quitarle antes la protección contra borrado **a esa copia** (la hereda de `rosanta-db`). Volver a revisar con `gcloud sql instances list` que solo quede `rosanta-db`, con protección `True`.

## Pendiente

- **Lo del ensayo del modo en vivo se queda hasta el 1-nov** (decisión de Juanma, 18-oct), para repetir el ensayo con la intranet ya publicada: la COPIA de Config `ENSAYO Pagos en vivo…` (`1ONlODUgpN0TtWeCm0hG6Wbgr9iE5-D4vAvZhenN2vbs`, `rosanta-nube@` como Editor solo ahí), el servicio `rosanta-nube-ensayo` y la base `rosanta_ensayo`. **Después del paso a vivo hay que borrarlos:** la copia a la papelera (contiene USUARIOS con enlaces), `gcloud run services delete rosanta-nube-ensayo --region northamerica-south1` y la base con `ROSANTA_NUBE_BORRAR="fin del ensayo" gcloud sql databases delete rosanta_ensayo --instance rosanta-db` (el candado pide el motivo; NUNCA la base `rosanta`).

- Copia del respaldo fuera de Google Cloud (Drive): una cuenta de servicio no puede guardar archivos en un Drive personal; va con el servicio de procesos.
