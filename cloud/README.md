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

1. Archivo nuevo en `db/migraciones/` (`002_...sql`). **Una migración aplicada no se edita.**
2. `node cloud/herramientas/migrar.js` (muestra lo pendiente) y `--aplicar`.

## Publicar el servidor

1. `cd cloud/app && npm install` (si cambió `package.json`).
2. `python3 cloud/herramientas/sellar-nube.py` — corre la batería; si da 0 fallas, sella esa versión del código.
3. `gcloud run deploy rosanta-nube --source cloud/app --region northamerica-south1` (las variables y claves ya quedaron puestas en el servicio).

El candado (`.claude/hooks/candado-nube.py`) bloquea el paso 3 sin sello vigente para el mismo código, y bloquea borrar la base o sus respaldos sin `ROSANTA_NUBE_BORRAR="motivo"` (solo con el sí de Juanma). Después de tocar el candado: `python3 .claude/hooks/prueba-candado-nube.py`.

## Tareas

- Copiar USUARIOS a la base: `POST /tareas/sincronizar-usuarios` con la cabecera `x-rosanta-tarea` = secreto `clave-tareas`. La hoja `Rosanta_Intranet_Config` está compartida con `rosanta-nube@…` como Lector.

## Pendiente

- Copia del respaldo fuera de Google Cloud (Drive): una cuenta de servicio no puede guardar archivos en un Drive personal; va con el servicio de procesos.
- Ensayo de restauración completo (importar el respaldo en una base de prueba).
