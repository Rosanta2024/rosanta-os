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

- Copia del respaldo fuera de Google Cloud (Drive): una cuenta de servicio no puede guardar archivos en un Drive personal; va con el servicio de procesos.
