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

1. Archivo nuevo en `db/migraciones/` (`004_...sql`). **Una migración aplicada no se edita.** Números reservados: **001–009 Pagos y base** (esta rama); **010–019 Fase 2 (Caja) y Marketing OS** (rama `claude/nube-fase2-mkt`). **020–029 accesos y roles** (rama `claude/nube-accesos`: la matriz de permisos, `020_permisos.sql`, que lee `app/src/permisos.js`). Ninguna migración de un rango altera tablas del otro.
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
- **Alerta por correo** a restaurante@rosanta.rest si falla cualquier intento de un reloj (política "Rosanta nube: falló una tarea automática", como máximo un correo por hora).

## Tareas

- Copiar USUARIOS a la base: `POST /tareas/sincronizar-usuarios` con la cabecera `x-rosanta-tarea` = secreto `clave-tareas`. La hoja `Rosanta_Intranet_Config` está compartida con `rosanta-nube@…` como Lector.

## Pendiente

- Copia del respaldo fuera de Google Cloud (Drive): una cuenta de servicio no puede guardar archivos en un Drive personal; va con el servicio de procesos.
- Ensayo de restauración completo (importar el respaldo en una base de prueba).
