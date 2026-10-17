# Sombra 2 — Caja chica, Compras en efectivo y Clientes › Eventos

Desde el 17-oct-2026. Rama `claude/nube-fase2-mkt`. Diseño e inventario: `Rosanta OS/00_Admin/Apps_Script_e_IA/2026-10-17_Nube_Fase2_y_MarketingOS.md`. Lo general (base, gcloud, migraciones, sello y candado) está en `README.md`.

**Todo en SOMBRA:** solo muestra y compara. La intranet de Apps Script sigue mandando, y todo lo que escribe responde 409. Pasar a vivo lo deciden Juanma y el resultado de Pagos. Caja chica y Compras **solo pueden pasar a vivo después de Pagos**, porque también guardan en PAGOS_PROVEEDORES.

## Qué hay

| Pieza | Dónde |
|---|---|
| Servicio | Cloud Run **`rosanta-nube-sombra2`**, Querétaro, `https://rosanta-nube-sombra2-512086396641.northamerica-south1.run.app`. Es aparte de `rosanta-nube` (Pagos): publicar uno no toca el otro. Misma cuenta de servicio `rosanta-nube@…`. Máximo 1 instancia; TZ=America/Guatemala |
| Código | `app/src/server-sombra2.js` y `app/src/sombra2/`. No edita `app.js` ni `motor-pagos.js`: usa `crearMotor({ listas })` y `refrescarCopia/cargarCopia({ tabla })` |
| Código de la intranet | Copias exactas en `app/intranet/`, listas `LISTA-CAJA.txt`, `LISTA-EVENTOS.txt` y `LISTA-VISTAS-F2.txt`. Versión en `VERSION-F2.txt` |
| Tablas | `hojas_copia_f2` (copia propia de las hojas) y `caja_fotos` (foto de cada noche). Migración `010`; el rango 010–019 es de esta rama |
| Pantallas | `/caja?u=<enlace>`, `/compras?u=<enlace>`, `/clientes/eventos?u=<enlace>`, `/sombra2/fotos?u=<enlace del dueño>` |
| Relojes (Scheduler, us-central1) | `refrescar-copia-sombra2` (minutos 7, 22, 37 y 52, de 6 a 23 GT, desfasado del de Pagos) y `comparar-sombra2-noche` (23:40 GT; responde 409 si la copia no coincide). La alerta de correo del proyecto cubre los dos |

## Lo único que se cambia del código de la intranet

`_cchLeerSiFaltan_` (lee Gmail si falta un cierre) y `cchSincronizarMaestro_` (reescribe 07_Caja_Chica del maestro) **no hacen nada** en la sombra (`anularEscriturasAlLeer`). La prueba "Control negativo" demuestra que, sin ese cambio, el código real sí intentaría escribir.

## Cuando cambia un archivo en la intranet

1. Esperar a que la intranet lo publique.
2. Correr `cloud/herramientas/traer-intranet.sh`.
3. Sellar: `python3 cloud/herramientas/sellar-nube.py --servicio rosanta-nube-sombra2`.
4. Publicar: `gcloud run deploy rosanta-nube-sombra2 --source cloud/app --region northamerica-south1 --set-build-env-vars GOOGLE_ENTRYPOINT="node src/server-sombra2.js"`. El resto de la configuración (variables, claves, cuenta) ya quedó puesta en el servicio.

Si los archivos se separan de la intranet, la prueba "Sombra 2: los archivos son copias exactas de la intranet" falla. Y si una pantalla agrega una llamada nueva al servidor, falla "Cada llamada de las tres pantallas está clasificada": hay que decidir si esa llamada es de lectura o de escritura.

## Pendiente

- **Migraciones:** 010–019 son de esta rama; 020–029 son de la sesión "C: accesos, roles y limpieza". No reusar esos números.
- **PagosProveedores.js:** la sesión C lo cambió (`_pagAnular_`) y falta publicarlo. Caja y Compras también lo cargan (`LISTA.txt`). **Cuando la intranet lo publique:** `traer-intranet.sh`, sellar los dos servicios (lo de Pagos lo hace el Estudio) y volver a publicar `rosanta-nube-sombra2`. Hasta entonces la prueba de copias exactas falla, que es lo que tiene que pasar.

- **Eventos:** compartir Rosanta Marketing OS con `rosanta-nube@rosanta-apps-script.iam.gserviceaccount.com` como **Lector**. Mientras no se comparta, la copia y la comparación lo reportan como aviso y no disparan la alerta. Una vez que se haya leído alguna vez, si deja de poder leerse, sí es una falla y avisa.
- Pantalla propia de "Clientes" (con el módulo `clientes`) y sus permisos: los define la sesión C con la matriz de Juanma. Mientras tanto se usan las guardas de hoy.
