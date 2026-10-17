---
name: rosanta-cerebro
description: 'Cerebro maestro unificado de Rosanta (CORSAGA, S.A., restaurante "Cocina con Carisma" en Antigua Guatemala) y de todos los proyectos de Juanma. Cargar SIEMPRE al inicio de cualquier conversación sobre Rosanta o sus proyectos — Rosanta OS de 6 pilares (Marketing OS, Profit OS, Finanzas & Data OS, Back office, Web, Reservas), bot de WhatsApp/IG, intranet/ERP, recetario/costeo, maestro financiero, DRE, dashboards, marketing, ads, CRM, sitio web rosanta.rest — aunque el usuario no mencione "Rosanta" explícitamente. Disparadores: Rosanta, bot, intranet, ERP, recetario, costeo, leads, Apps Script, clasp, maestro, DRE, prime cost, food cost, Marketing OS, Profit OS, "¿en qué íbamos?", "retomemos", "continúa con", o cualquier tarea que dependa del contexto de proyectos anteriores. Si hay duda entre cargarla o no, cargarla.'
---

# Cerebro Rosanta

Este es el contexto maestro de Juanma y sus proyectos. Su propósito: que ninguna conversación arranque de cero, sin importar el proyecto o chat.

**Última actualización: 17 oct 2026 (v52).** Todo lo que Juanma diga en la conversación actual, o lo que exista en la memoria automática de la sesión, es MÁS RECIENTE que este archivo y manda sobre él. Este cerebro es la foto de partida, no la verdad eterna. El estado semana a semana vive en el artefacto `rosanta-seguimiento-semanal`, no aquí.

---

## Cierre del 17 oct 2026 (v52): sesión C de la nube — accesos, roles y limpieza — intranet @210

Decisiones de Juanma del 17-oct (en la sesión y vía "Mentor · Central Rosanta"). Documentos: `00_Admin/Apps_Script_e_IA/2026-10-17_Accesos_y_Roles.md` y `2026-10-17_Limpieza_Lotes.md` (+ `.csv`).

1. **Matriz de accesos DEFINITIVA**, por secciones de la app única (Operación · Finanzas · Clientes · Marketing · Técnico). Letras: T todo · I ingresar · **B = corregir o borrar LO PROPIO en cualquier momento** (ajuste de Juanma: ya no "solo ese día") · V ver. Operación: pagos, caja, inventario = dueño T, cocina I+B (cocina), sala I+B (barra); cierres/Llegó/No vino = sala I+B; **recetario = acceso total en su área** (Juanma, 17-oct). Finanzas solo dueño; reporte semanal cocina y sala V. Clientes: eventos sala I+B (pauta —); CRM sala V y pauta V; **reservas cocina V, sala I+B, pauta V; carritos solo pauta V**; reseñas, encuesta y consola solo dueño. Marketing (solo pauta y contenido): pauta I+B. **Solo el dueño:** lo ajeno, días cerrados, confirmar banco y "No pertenece", precios de venta y del menú, exportar contactos, dar o quitar accesos. **Aprobado también: bitácora** de cada corrección (quién, cuándo, antes y después; borrado lógico) y **aviso a Juanma si se corrige un mes ya reportado al contador** (no bloquea).
2. **En la app nueva la matriz es UNA tabla:** rama `claude/nube-accesos` (desde la de la nube), `cloud/db/migraciones/020_permisos.sql` (permisos + acciones_solo_dueno) y `021_bitacora.sql` (bitacora + meses_cerrados), **sin aplicar**; `cloud/app/src/permisos.js` lee la tabla y contesta `puede()`; 37 pruebas. Rango de migraciones de accesos: **020–029**. Se enchufa cuando cada módulo pase a vivo (Pagos, 1-nov). Rol `contador`: permitido sin filas (propuesta: ver Finanzas y reporte); se confirma cuando haya uno.
3. **Intranet @210** (= 2a07fc9, rama `claude/adoring-boyd-0b36c3`, verificada 99/99 bajando la 210; batería **201 OK · 0 fallas · 2 avisos · 2 saltadas = 205**, leída con Claude in Chrome y sellada): **`_pagAnular_` deja al equipo anular SOLO lo que anotó** (antes: todo lo de su área, de cualquier persona y día, incluido un "Confirmado con banco"); **`cambiarPrecioMenu` solo dueño** (el campo se esconde solo). Centinelas nuevas en 4. Accesos. Arneses de Pagos y Compras con control negativo. Quedan como propuesta (sin sí de Juanma): Finanzas por rol y no por módulo, módulo propio `eventos` para sala, exportar CRM solo dueño, `mktDelete` que borra de verdad.
4. **Acceso con cualquier correo (solo diseño):** recomendado **Identity Platform con enlace por correo** (US$0 hasta 50 mil usuarios activos/mes); el `?u=` del equipo sigue igual ("entre menos sepan, mejor").
5. **Limpieza hecha:** CRM **3,639 → 3,603**: 35 repetidos por teléfono (22 eran números de EE. UU. con +502 pegado por la importación de GHL) y la fila "Gabi" (correo personal de Juanma) pasaron ENTERAS a la pestaña `archivo_2026-10-17` de la misma hoja. Pipeline: las 5 `fecha_consulta` vacías (Aniesa, Deepa, MJ Porres, Mollie, Nikita) **se quedan vacías**: ningún hilo de Gmail ni nota tiene la consulta original. Scripts archivados en `apps-script/_archivo/2026-10-17_{intranet,mkt,proyectos_chicos}_limpieza` y `_carpetas_viejas` (`_externos`, `_paquetes-instalacion`), con LEEME; en Marketing OS salió `normalizarOptInCRM` (escribía en el CRM si alguien la corría). **Wix: quitado el reloj "Reporte semanal de consumo por mesa"** (apuntaba a `enviarReporteSemanal`, que nunca existió) y sitio publicado (`rosanta-wix` 5ae6258; reservas verificadas +1/+60/+200 días).
6. **Protocolo nuevo (Juanma, 17-oct):** Juanma habla SOLO por la sesión **"Mentor · Central Rosanta"**; las demás sesiones le mandan ahí preguntas (con opciones y recomendación), aprobaciones y un resumen de 3–5 líneas al cerrar cada etapa. No usar AskUserQuestion en las demás.

**Lecciones:**
1. **Un script de datos de una vez se corre así:** archivo propio en el proyecto (queda elegido al abrirlo en el editor), modo en seco que busca cada fila por contenido y no por número, Run desde Claude in Chrome, y recién después APLICAR = true. Después se saca del proyecto (con un cambio real en otro archivo: `clasp push` no borra solo) y **sin datos de clientes en git**.
2. **`wix publish --source remote` avisa "el Editor tiene cambios de diseño más nuevos"**: publica la UI 2191 del repo, como las sesiones del bot del 15 y 16-oct.
3. El candado no resuelve variables de shell: escribir la ruta completa en `clasp pull` aparte (otra vez).

---

## Estudio del 17 oct 2026 (v51): pasar la intranet a una base en la nube — APROBADA la prueba de Pagos

Pedido de Juanma (16-oct, sesión del mentor): "trasladar todo lo hecho en Google Script a una base de datos en la nube, para poder crecer y que todo sea más rápido". Sesión en **modo Plan** (solo lectura; primera vez que Juanma lo usa). Documento: `00_Admin/Apps_Script_e_IA/2026-10-17_Estudio_Migracion_Base_de_Datos.md` (carpeta elegida por Juanma). **No se tocó código, hojas, activadores ni despliegues.**

1. **Recomendación:** NO migrar todo. Una **prueba de 4 semanas con Pagos** en **Google Cloud: Cloud Run + Cloud SQL Postgres en Querétaro (northamerica-south1)**, la región más cercana. **US$15–30/mes (Q115–235)**; el costo real son las horas (~5–6 meses de sesiones para las fases 0–5). Supabase quedó segunda (US$25–35, región más lejana, recuperación al minuto +US$100). Firestore descartada (no es de tablas y ata más).
2. **El maestro financiero, la planilla y COMPRAS_2026 se quedan en Sheets.** Apps Script se queda como pegamento de fondo (vigía, Gmail, Drive, cargador, correos). Se mudan solo pantallas y datos que el equipo escribe (Pagos → Caja chica/retiros/cierres → lecturas de Finanzas → eventos/CRM/reservas → bot; el recetario se decide al final y puede quedarse en Sheets). Un interruptor por módulo en PARAMETROS (`motor_<modulo> = sheets | base`); la hoja queda como copia de lectura con las mismas columnas.
3. **ACTUALIZADO por Juanma (17-oct, vía mentor): la prueba baja de 4 a ~3 semanas. Sombra hasta el 31-oct INCLUSIVE (cierre de mes); en vivo desde el 1-nov hasta CUMPLIR los criterios (≥50 guardados reales, 95/100 con ✓ <1 s, 0 diferencias de dinero en la comparación nocturna, copia a Sheets correcta 5 días seguidos), meta ~1 semana; a las 2 semanas sin cumplir se evalúa con Juanma. Los criterios de parar no cambian. Lo que sigue en este punto es el diseño original.** Prueba de Pagos: 2 semanas en sombra (la nueva solo muestra; se comparan los cuadres cada noche) + 2 en vivo. **Seguir si** 95 de 100 guardados dan el ✓ en <1 s (mín. 50), 0 diferencias de cuadre en 2 semanas, base = hoja en filas, Jeffry y Maco sin ayuda, costo <US$40. **Parar si** >1.5 s, una diferencia de dinero sin explicar, la copia a Sheets falla 2 veces en una semana o pasa de 6 semanas.
4. **La pregunta que decide (abogado del diablo, objeción 2):** si Juanma se conforma con ~5 s en pantalla, basta mejorar Apps Script (una llamada, menos datos, US$0). Menos de 1 s es imposible con el piso de ~3 s por llamada a Google.
5. **Datos verificados:** la intranet tiene **98 archivos y 42,496 líneas** (no ~85 / ~36 mil); producción **@207** según git (no @203). El maestro son ~11 mil filas: el problema no es el volumen sino el costo fijo de cada viaje a Google y que `pagEstado_()` relee `01_FEL_Maestro` y los bancos enteros en cada guardado.
7. **Criterio de Juanma (17-oct, vía sesión del mentor): al migrar, todo queda en UN sistema.** Una base (Cloud SQL), **una app con un solo acceso** (intranet, Marketing OS, consola, panel de reseñas, encuesta) y **el bot y los procesos de fondo como servicios de Cloud Run aparte** sobre la misma base, con permisos por servicio, para que publicar la intranet nunca tumbe al bot. El maestro sigue en Sheets aunque el cargador pase a `procesos`. Orden: Pagos primero (prueba); de los proyectos aparte, **Marketing OS primero** (fase 4, la intranet ya lee `reservas` y `cotizaciones`), después bot + consola (5), reseñas y encuesta (5b), procesos de fondo y Gmail (5c). Con todo: ~7–8 meses, US$20–40/mes. Sección 8 del estudio.
6. **DECISIÓN de Juanma (17-oct): SÍ, arrancan la Fase 0 (cimientos) y la Fase 1 (prueba de Pagos).** Las fases 2 en adelante se deciden con el resultado de la prueba (seguir/parar de la sección 5).

8. **Fase 0 en marcha (17-oct):** proyecto GCP **`rosanta-apps-script` (número 512086396641)**, facturación "My Maps Billing Account" (01E1E8-C8C9A0-E2856D; la comparte Rosanta Reviews). Juanma puso una **alerta de presupuesto de US$43/mes** sobre TODA esa cuenta. **Base creada: Cloud SQL `rosanta-db`**, Postgres 17, Enterprise, db-f1-micro, `northamerica-south1-a` (Querétaro), 10 GB SSD, respaldos diarios ×7 + recuperación al minuto (7 días), protección contra borrado, sin redes autorizadas (solo entra el conector), SSL obligatorio, login IAM encendido. Contraseña de `postgres` SOLO en Secret Manager (`db-postgres-root`), nunca en chat ni en disco. Costo medido en el catálogo de Google: ~US$10.70/mes (micro US$0.0114/h, disco US$0.1853/GB, respaldos US$0.0872/GB); small US$0.0382/h. APIs encendidas: sqladmin, run, artifactregistry, cloudbuild, secretmanager, cloudbilling. **La base está VACÍA; la intranet no cambió.**
9. **Herramienta `gcloud` en la Mac:** `~/google-cloud-sdk/bin/gcloud` (SDK 589), corre con **`CLOUDSDK_PYTHON=/Library/Frameworks/Python.framework/Versions/3.14/bin/python3`** (Juanma instaló Python 3.14.8 de python.org; el 3.9 del sistema no sirve y el instalador de Google no trae Python para Mac). Cuenta: restaurante@rosanta.rest. El login se hace en segundo plano (`gcloud auth login` con timeout de 1 h): la primera vez venció a los 15 min. Ojo: ese Python 3.14 no trae certificados, así que `urllib` falla con SSL: usar curl o `/usr/bin/python3`.
10. **Servidor `rosanta-nube` publicado (17-oct):** Cloud Run, Querétaro, `https://rosanta-nube-512086396641.northamerica-south1.run.app`, cuenta de servicio `rosanta-nube@rosanta-apps-script.iam.gserviceaccount.com` (solo `cloudsql.client` + leer los secretos `db-app` y `clave-tareas`). Base `rosanta` con `usuarios`, `pagos_proveedores`, `tiempos`; el usuario `app` no puede borrar pagos ni tocar tablas. Medido: `/salud` **0.30 s** total desde Guatemala, base 2 ms; ida y vuelta Guatemala–Querétaro **~116 ms** (sale por EE. UU.; el estudio decía 30–50 ms). Código en `cloud/` (rama `claude/infallible-roentgen-5185e3`): `cloud/herramientas/migrar.js` (migraciones; una aplicada NO se edita), `sellar-nube.py` (batería Node + sello `~/.rosanta-sellos/bateria-nube.json` por huella del código), `.claude/hooks/candado-nube.py` (sin sello vigente no hay `gcloud run deploy`; borrar la base solo con `ROSANTA_NUBE_BORRAR="motivo"`), simulador `prueba-candado-nube.py` 12/12. Publicar: `python3 cloud/herramientas/sellar-nube.py` y después `gcloud run deploy rosanta-nube --source cloud/app --region northamerica-south1` (ver la bitácora del estudio). Hoja Config = `1OMFJUuW9TEp4cMaVculJgegDF1PqrsRJOQCT3VQX2Rw`. Compartida con `rosanta-nube@…` como **Lector** (17-oct; lo hizo Claude desde el navegador de la app: el conector de Drive NO puede compartir, "caller does not have permission"). Primera copia de USUARIOS: 7 usuarios, 7 con enlace. La tarea se dispara con `POST /tareas/sincronizar-usuarios` y la cabecera `x-rosanta-tarea` = secreto `clave-tareas`. El google-auth-library de `cloud/app` tiene que ser la MISMA versión que usa el conector de Cloud SQL (11.x); con otra el conector dice "Login Required".
11. **Respaldo semanal y cierre de la Fase 0 (17-oct):** depósito `gs://rosanta-respaldos-nube` (Querétaro, versiones, se guardan 12 semanas), reloj de Scheduler `respaldo-semanal-base` en **us-central1** (Querétaro no tiene Scheduler), domingos 3:00 GT, cuenta `rosanta-respaldos@…` con rol propio `respaldoSql` (solo exportar). Primera corrida verificada: 4 tablas, 7 usuarios. **Manual de operación: `cloud/README.md`.** Pendiente menor: copia en Drive (una cuenta de servicio no tiene espacio en Drive). **Ensayo de restauración HECHO (17-oct, pedido de Juanma):** minuto exacto (clone) ~11.5 min, 6/6 tablas idénticas; respaldo diario/bajo demanda ~5 min instancia + 8 min restaurar, 6/6; semanal importado <1 min, 8/8. Temporales borradas con su sí (el clone hereda la protección contra borrado: se le quita SOLO a él). Herramienta `cloud/herramientas/contar-base.js` (foto filas+huella). Procedimiento en `cloud/README.md` › Restaurar. Quedó un respaldo bajo demanda del 17-oct (1792268687872) en rosanta-db: no se borra solo, cuesta centavos. **Siguiente: Fase 1, Pagos.**
12. **Fase 1, Pagos en SOMBRA publicado (17-oct, revisión `rosanta-nube-00002`):** el servidor corre el **código real** de la intranet (PagosProveedores.js + 8 archivos que necesita, y la pantalla ProfitPagosJs.html + GuardadoEstado + paleta + PF_ERROR/PF_DONDE), copiados TAL CUAL en `cloud/app/intranet/` con `cloud/herramientas/traer-intranet.sh`; una prueba falla si se separan de `apps-script/rosanta-intranet`. **Si cambia uno de esos archivos en la intranet, correr traer-intranet.sh, sellar y republicar.** Lee de una copia de las hojas en la tabla `hojas_copia` (maestro: FEL, 01c, BI, BAC, tarjetas BAC y BI; Config: PAGOS_PROVEEDORES, FEL_CORREO, BANCO_CORREO; COMPRAS_2026 entera), refrescada por el reloj `refrescar-copia-pagos` cada 15 min de 6 a 23 GT (8 s por copia). Maestro y COMPRAS_2026 compartidos con `rosanta-nube@` como **Lector** (con el sí de Juanma). Pantalla: `https://rosanta-nube-512086396641.northamerica-south1.run.app/pagos?u=<enlace>`. **En sombra toda función que escribe devuelve 409** ("solo muestra"); max 1 instancia (el motor vive en memoria); TZ=America/Guatemala obligatorio. Medido sobre el espejo: pantalla 70–115 ms, guardar un pago 106 ms (hoy 4.1 s). **Primera comparación (17-oct 12:48, Juanma): IGUALES** a la intranet (66 facturas por pagar, Q36,562.95); pantalla con datos reales en **195 ms**. Para entrar, Juanma usa su token de la columna F de USUARIOS (él entra a la intranet por la sesión de rosanta.rest, sin `?u=`). Su token quedó visible en una captura del chat del 17-oct (riesgo bajo; ofrecido cambiarlo). **Comparación automática HECHA (17-oct, rev. 00003):** reloj `comparar-pagos-noche` 23:52 GT relee las hojas, arma Pagos con eso y con la copia y compara recuadro + cuadre (409 si no coincide); fotos en `/pagos/fotos` (solo dueño). Primera corrida: al día, sin diferencias. **Alerta por correo** (Cloud Monitoring, política "Rosanta nube: falló una tarea automática") a restaurante@rosanta.rest si falla cualquier reloj; probada con una tarea de mentira: **el correo llegó a las 13:11 (17-oct)**, a la pestaña Actualizaciones de Gmail, remitente alerting-noreply@google.com, asunto "[ALERT - Error] Rosanta nube: …". La primera prueba (12:58, 18 s después de crear la alerta) NO disparó: una alerta por registros recién creada tarda unos minutos en activarse, y el correo llega ~2 min después del error. Halló 3 celdas `#VALUE!` en `03_Banco_Industrial` fila 5 (Año/Mes/Semana de un VISANET sin fecha). El arreglo del botón "Ver" (intranet **@209**, commit 2b52777) ya está también en el servidor nuevo (rev. `rosanta-nube-00004`, main traído a la rama con el merge a0345a9). **Regla:** el servidor nuevo trae un archivo de la intranet solo DESPUÉS de que la intranet lo publica, para que las dos pantallas muestren lo mismo durante la sombra. **Hallazgo para el modo en vivo (17-oct):** Caja chica y Compras en efectivo de la intranet también escriben en PAGOS_PROVEEDORES (con `_pagEscribir_`/`_pagRegistrarPago_`); con la base mandando, esas filas tienen que entrar a la base. Recomendado (a): el servidor importa cada 15 min las filas nuevas de la hoja por ID; alternativa (b): Pagos, Caja y Compras juntos. **Decidir con Juanma antes del 1-nov.** Fase 2 y Marketing OS los prepara la sesión "Nube: preparar la fase 2 (Caja) y Marketing OS" (diseño: `00_Admin/Apps_Script_e_IA/2026-10-17_Nube_Fase2_y_MarketingOS.md`, rama futura `claude/nube-fase2-mkt` desde e9511e4, servicio aparte `rosanta-nube-sombra2`, misma cuenta de servicio, migraciones 010–019, sello por servicio con `sellar-nube.py --servicio`). Rev. 00005: el motor ya no intenta leer Gmail. Falta el modo **vivo** (escribir en la base + copia a la hoja; necesita cambiar la intranet con su batería).
**Lección:** los dos agentes Explore se trabaron a los 10 min sin avanzar (watchdog); el inventario salió más rápido con `grep` directo sobre los `.js`.

---

## Investigación del 16 oct 2026 (v50): WhatsApp solo mensajes, coexistencia y Flows — sin cambios, espera aprobación

Documento: `05_Marketing_OS/Bot_WhatsApp_IG/WhatsApp_Solo_Mensajes_Coexistencia_Flows_2026-10-16.md`. No se tocó Meta, el número ni el bot.

**CORRECCIÓN (16-oct, mismo día): NO hay coexistencia.** Al abrir WhatsApp Business en su teléfono, la app le pide escanear un código QR para enlazar: el número no está activo ahí; todo va solo por la API (como se instaló con `activarWhatsApp` /register). Lo de "ver llegar los mensajes" fue un malentendido. Por eso los puntos 1 y 2 de abajo quedan OBSOLETOS: con la API sola Meta dice que las llamadas vienen apagadas de fábrica y el cliente no ve el botón de llamar; no hay riesgo de 14 días ni de `smb_message_echoes`.
1. ~~**El +502 3082-6935 está en COEXISTENCIA**~~ (OBSOLETO, ver corrección) (Juanma, 16-oct: la app WhatsApp Business de su teléfono tiene ese número y ve llegar los mensajes). Por eso las llamadas **suenan en la app del teléfono** (Meta: llamadas "sin cambio" en la app, "no soportadas" en la API); la premisa "la API no recibe llamadas" era incompleta. La Calling API (`/settings` calling DISABLED, `call_icon_visibility`) no aplica en coexistencia (y pide límite de 2,000/día): **no se puede esconder el botón de llamar sin sacar el número de la app**. Con la API sola, llamadas vienen apagadas de fábrica y no hay botón.
2. **Riesgos de coexistencia:** si la app del teléfono pasa ~14 días sin abrirse, Meta desconecta el número de la API (`PRIMARY_INACTIVITY`) y el bot cae en WhatsApp. **El bot no lee `smb_message_echoes`:** lo que Juanma contesta desde el teléfono no llega a `Conversaciones` ni a `Humano.js` (el bot sigue "esperando a Juanma" hasta 24 h). Propuesto suscribir ese campo; mientras, contestar desde la consola.
3. **Recomendado (Juanma lo hace en el teléfono):** Info y Descripción del perfil "solo mensajes, no llamadas" (textos SALE de revisor-marca en el documento) + Ajustes › Privacidad › Llamadas › silenciar desconocidos (sin verificar en Meta).
4. **Flows:** funcionan con la API directa, sin proveedor, gratis dentro de 24 h, solo WhatsApp. Sin endpoint (Apps Script no sirve de endpoint: cifrado + 10 s); datos dinámicos se pasan al abrir (`flow_action_payload.data`), la respuesta llega como `nfm_reply` (hoy `btEntradaWhatsApp_` la ignora). Propuesto piloto del **formulario de evento** primero. Marca: "Tapas y barra libre" NO va como opción del formulario.
0. **DECISIÓN de Juanma (16-oct, tras leer el documento): "el cambio no vale la pena".** No se hace nada en el bot ni en Meta: ni `smb_message_echoes`, ni Flows, ni sacar el número de la app. No reproponerlo salvo que Juanma lo pida.
5. **Línea:** Tigo Q140/mes. Meta no cobra por el número. Propuesto preguntar a Tigo el plan más barato que mantenga el número vivo. Kapso sigue descartado (la coexistencia ya existe).

---

## Cierre del 16 oct 2026 (v49): campaña de retención — fases 1 a 3 (sesión CRM y Retención)

Campaña aprobada el 16-oct en la sesión del mentor. Archivos: `05_Marketing_OS/CRM_y_Retencion/Campana_Retencion_2026-10/`. **Sin código ni publicaciones.**

1. **Regla nueva de Juanma (16-oct): los eventos se trabajan desde el pipeline (Marketing OS › `cotizaciones`), no desde una campaña de retención.** La campaña queda para clientes de mesa.
2. **Fase 1 (eventos perdidos "sin respuesta"):** de 7 filas, ninguna cumplía las reglas tal cual. **Geraldine Weddings SÍ había contestado** (el 2-oct pidió 2 semanas). Juanma le escribió el 16-oct por correo, con los dos PDF vencidos, porque no tiene su WhatsApp. Mollie y Clarisa: borrador en Gmail para el **29-oct**, Tapas + Paquete de bebidas, 80 pax, **Q36,165.78** con montaje Q5,048.50 (2 cocineros, 3 meseros, 1 bartender + material La Meg); su consulta no entró por bot, correo ni chat (fue por teléfono y no se anotó el número). Vania (grupo 47) quedó fuera: sigue activa con el grupo de 20. Todo anotado en las filas del pipeline. Medición: 6-nov.
3. **Una opción "más simple" puede salir MÁS cara:** el coctel con barra libre para 80 con montaje (Q43,985.77) superaba la cena de agosto (Q42,998.50, Lista 2026). Antes de ofrecer, calcular con montaje (>50 pax).
4. **Fase 2 (locales sin visita en 60 días): EN PAUSA**, porque Juanma mejora el correo. Universo: 79 locales (67 seguros), prueba de 25 en `Fase2_Prueba25_2026-10-16.csv`, correo "La carta cambió desde tu última visita" (platos nuevos de la carta 2027: brócoli con nduja, arroz meloso, vegetales fermentados) con UTM `retencion_carta_nueva`. CRM: 35 duplicados por teléfono; la fila "Gabi" trae juanma.lemus@gmail.com.
5. **Fase 3 (reseñas):** meta **7 reseñas nuevas de Google por semana** (el 4.9 se trabaja en el salón). Hoy van ~5 por semana y subiendo; la fuente es la hoja `Rosanta - Control de Reseñas GBP` (`17VHTRhel…`, la llena el bot de reseñas cada hora desde el 7-jul): jul 23, ago 19, sep 17, oct 16 al día 15. **El QR de mesa abre `rosanta.rest/encuesta`, una encuesta de estrellas dentro de Wix (según Juanma, los comentarios llegan a la hoja GBP), no la encuesta Apps Script** (esa tiene 2 respuestas desde el 12-sep), y se da solo a clientes elegidos (Juanma no quiere dárselo a todos). **Correo automático a las mesas "Llegó": NO por ahora**; se retoma el 15-nov si el promedio de 4 semanas sigue bajo 7 (el diseño está en el plan de la sesión). Eventos ganados: próximo paso en el pipeline para pedir reseña y permiso de fotos (Ashley y Jonathan 10-nov, Krystal 11-nov, Nutrifert con nota para el 23-oct).

**Lecciones:**
1. **"Sin respuesta" en el pipeline no prueba silencio:** leer el hilo antes de armar la lista.
2. **Por esta conexión de Gmail no entra un adjunto de 2.7 MB en un borrador:** los PDF se adjuntan desde Drive en Gmail.

---

## Cierre del 16 oct 2026 (v48): informe mensual del embudo de eventos + arrastrar tarjetas — intranet @203

Sesión "Revisión mensual del embudo de eventos" (punto 3 del plan del mentor) y, en la misma versión, el arrastre de "Rediseñar el pipeline de eventos como embudo". **Producción: intranet @203** (= `73bce64`, verificada bajándola aparte, 98/98). Batería sobre ese HEAD, leída en el Chrome de Juanma: **197 OK · 0 fallas · 3 avisos · 2 saltadas = 202**. En main por el merge `b12e135` (sin push a GitHub).

1. **`EventosMes.js` (prefijo `evm`), un solo motor:** `evmCalc_(filas, anio, mes, hoy)` (pura) arma el informe del mes con el anterior al lado: nuevas (por `fecha_consulta`, o `fecha_envio` contada como faltante), ganadas y perdidas del mes, tasa de cierre por cantidad y por Q, `etapa_max` de las perdidas, motivos, cierre y nuevas por canal, respuesta (mediana y <24 h), cuentas clave, monto abierto que vence el mes siguiente, aviso de datos y **UNA recomendación por reglas fijas** (gana la que más Q mueve; si falta una fecha de cierre, eso va primero). Lo usan la sección **"El mes"** de Sistema de Marketing › Eventos (`getInformeEventos`, guarda `requiereEventos_`, selector de mes) y el **correo "Rosanta · Eventos: informe de <mes>"**, que manda `evmCadaHora_` **colgado del vigía el día 3 de 9:00 a 12:00** (llave `EVM_AVISO_AAAAMM`, marca `PROC_eventosMes` en Procesos). Primer correo: **3-nov con octubre**. Prueba en el editor: `evmProbarInforme()` ("[PRUEBA]", mes en curso). Arnés: `node tools/harness-intranet/harness-eventos.js <cot.json> 2026 10`. Batería: "El informe del mes cuenta cada fila cerrada en su mes" (6 filas inventadas; con el cierre mirando etapa_desde antes que el depósito da FALLA).
2. **Fecha de cierre = `etapa_desde`** (Ganada: `deposito_fecha` si existe). No hay columna nueva: la pantalla, el arrastre y la revisión diaria ya ponen `etapa_desde` al cambiar de etapa. Con el sí de Juanma se rellenaron 11 filas cerradas que no la tenían (desde el historial; PepsiCo 12-ago … Geraldine ×2 y Mollie 15-oct, Jacob 17-sep), verificado releyendo.
3. **Descartado** ponerlo en `rosanta-reporte-mensual` (esa tarea solo verifica el maestro, y las tareas de la Mac se traban). No se creó ni cambió ninguna tarea.
4. **Arrastre de tarjetas** (de la otra sesión, commit `a7bf869`): arrastrar entre etapas y "Mover a…" en el celular; Ganada pide depósito, Perdida motivo, Pausa fecha, Visita fecha. La revisión diaria (paso 3a) mueve sola cuando el correo lo dice.
5. **Informe de prueba al 16-oct:** octubre 5 nuevas (Q179k) · 2 ganadas (Q20k: Ashley, Nutrifert) · 5 perdidas (Q139k, todas sin respuesta) · cierre 29% por cantidad, 13% por Q (septiembre 20%) · respuesta mediana 3 h (sept 28 h) · vencen en noviembre Q51.8k (Porres, Sophie y Kyle). Recomendación: las que se van callando en Cotizada. **Ojo al leerlo:** 4 de las perdidas de octubre son la limpieza del 15-oct (cotizaciones viejas vencidas), no un mal mes.
6. **Datos que dejan cojo el informe:** sin `fecha_consulta` Aniesa, Deepa, MJ Porres, Mollie y Nikita; José y Frida (27-nov) siguen fuera del pipeline.

**Lecciones:**
1. **Un campo "fecha de la etapa" ya era la fecha de cierre:** antes de agregar una columna, mirar si la pantalla y la tarea ya escriben algo equivalente. Lo vacío no era el diseño, era la migración del 15-oct.
2. **Otra sesión hizo push a mitad de mi batería:** se repitió la batería entera sobre el HEAD nuevo (comparado con el commit del merge, 98/98) y se publicó UNA versión para las dos. Un sello solo vale para el HEAD que probó.
3. **La franja roja del 16-oct era real: la revisión diaria nunca había corrido** (0 corridas). La causa: el registro de la app decía `Skipping dispatch … global_limit (active=3, limit=3)` cada minuto, y también saltaba el morning brief. Los 3 lugares los ocupaban 3 sesiones "Recordatorio a blogs (p225) · 7-oct", de una tarea ya BORRADA, en curso desde el 7 y 8-oct. Con el sí de Juanma, la otra sesión las detuvo, las archivó y corrió la revisión a mano. **Una tarea borrada puede dejar corridas vivas que lo traban todo: se buscan con `list_sessions` (isRunning: true), no con `list_task_runs`, que no las muestra.**
4. Para ver una sección baja de la intranet desde Claude in Chrome: estirar el iframe (`height:9000px; position:absolute; top:-Npx`) y capturar; `get_page_text` no entra.

---

## Cierre del 16 oct 2026 (v47): reputación en línea, foto y plan de 30 días

Sesión "Reputación en línea: TripAdvisor, Google y listas" (punto 2 del plan del mentor). Nada publicado ni enviado. Documento: `05_Marketing_OS/Resenas_y_Reputacion/2026-10-16_Reputacion_Foto_y_Plan_30d.md`. CLAUDE.md nuevo del subproyecto: `~/Documents/Claude/Projects/05_Marketing_OS/Resenas_y_Reputacion/CLAUDE.md` (acceso directo en Drive).

1. **Línea base nueva (16-oct):** TripAdvisor **14 reseñas · 4.2 · #161 de 464** (17-jun: 9 · 4.1 · #204 de 418; 6-sep: 12 · 4.4 · #146). Google **4.8 · 450**. El retroceso desde septiembre es un 1★ del 12-sep ("Big Tee", cuenta cobrada al doble). **2 de las 4 negativas de TripAdvisor son por la cuenta.** Value es la nota más baja (3.7).
2. **Sin respuestas pendientes:** TripAdvisor 14 de 14 respondidas; Google las responde la plataforma (las de octubre, todas 5★).
3. **Listas:** Rosanta en ninguna de las 6. Outreach a blogs CERRADO por Juanma el 12-oct (dos correos 27-sep + recordatorio 7-oct, sin respuesta). **Perplexity** a "best restaurant Antigua Guatemala" cita TripAdvisor (Adra Kitchen #1), OpenTable y Thoroughly Travel; Rosanta no sale.
4. **Errores públicos encontrados:** la publicación de Google del 17-ago (Marvin y las plantas) tiene pegada una nota interna de traducción; TripAdvisor muestra el domingo "3:00 AM - 8:00 PM" y la cocina "French"; el nombre del GBP lleva palabras clave ("Cocina sostenible | Farm to Table"), riesgo de suspensión.
5. **La encuesta se queda como está (decisión de Juanma, 16-oct): solo 5★ van a Google** (`apps-script/rosanta-encuesta/Code.js`). "A la fecha ha funcionado bien." No reproponer cambiarla.
8. **TripAdvisor NO es prioridad (Juanma, 16-oct): se usa poco.** El foco de reputación es Google (4.8 · 450). TripAdvisor queda como una línea de referencia en el seguimiento; no planear acciones grandes ahí.
6. **El correo de TripAdvisor (events.js) solo sale con FINISHED** y la intranet nunca marca FINISHED: casi no sale. El pedido de reseñas a quien ya vino lo hace SOLO la sesión de retención (FASE 3); el mensaje de coordinación venció sin entregarse.
7. **Tarea `rosanta-seguimiento-offsite`: APAGADA y se queda así (Juanma, 16-oct): "TripAdvisor bloquea, no vale la pena; lo sigo trabajando manual".** No reproponer encenderla ni agregarle permisos web. (Dato técnico: TripAdvisor da 403 a WebFetch y la búsqueda devuelve el ranking viejo.)

9. **CIERRE de Juanma (16-oct, vía "IA Mentor"): tema cerrado.** Los 4 errores públicos (nota en el post de Google, domingo 3:00 AM y "French" en TripAdvisor, nombre del perfil) ya están corregidos. **OpenTable: se perdió el contacto, se deja como está, CERRADO.** **TripAdvisor es complementario y no hace daño: no proponer acciones sobre su operación ni la regla de la cuenta impresa.** No reproponer nada de esto.

---

## Cierre del 16 oct 2026 (v46): alarma de canales del bot — intranet @202

Sesión "Alarma si un canal del bot se queda en silencio" (pedida por Juanma el 16-oct, sesión del mentor). **Producción: intranet @202** (verificada 5/5 con `list-deployments` y bajando la 202 aparte: 97 archivos iguales a la rama). Batería sobre ese HEAD, leída en el Chrome de Juanma: **197 OK · 0 fallas · 2 avisos · 2 saltadas = 201, 203 s**. Rama `claude/alarma-canales`, en main por el merge `a264e47` (sin push a GitHub). El bot no cambió de versión.

1. **Causa del hueco de Instagram (26-sep 11:27 → 7-oct 15:51): NADIE ESCRIBIÓ.** No fue el token ni el webhook. Prueba: `diagnosticoCanales` (solo lectura, archivado en `apps-script/_archivo/2026-10-16_bot_diagnostico_canales/`) leyó la bandeja de Meta con la API de conversaciones: **0 mensajes de clientes dentro del hueco** en Instagram (28 del 20-sep al 11-oct, los mismos días que anotó el bot) y 0 en Messenger (5). Token de IG válido, cuenta suscrita a `messages`, activador `refrescarTokenIG` presente. Por eso NO se hizo la alarma de "token por vencer" (Paso 4 condicional). Juanma revisó a mano la carpeta Solicitudes de @rosanta.rest (16-oct): vacía para esas fechas. Caso cerrado. La página no deja leer su `subscribed_apps` con el token actual (#200 pages_manage_metadata), sin importancia.
2. **`CanalesLatido.js` (prefijo `clat`), colgado del vigía a las 9:00:** hora del último mensaje ENTRANTE por canal en Rosanta Leads › Conversaciones (`leadsSheetId_()`). Umbrales en PARAMETROS (`canal_whatsapp_h` 72, `canal_instagram_h` 96, `canal_messenger_h` sin umbral, `canal_correo_h` 72), medidos con 90 días: WhatsApp 48 h habría dado 10 falsas alarmas y 72 h 3; Instagram 96 h ~4 y habría avisado el 30-sep; Messenger pasa 83 de 90 días sin mensajes, no sirve vigilarlo por silencio. Correo: además avisa si Gmail tiene un hilo de cliente (01-CLIENTES (Reservas), sin Cotizaciones) cuyo último mensaje es del cliente, de hace más de 2 h, sin borrador, y el bot no anotó ningún correo en 48 h (lector parado). Sin ningún mensaje registrado no opina. Correo **"Rosanta · canal callado: …"** uno por día (llave `CLAT_AVISO`) + marca `PROC_canales` (max 30 h, racha 24 h) + 8ª señal del Latido del lunes. `canalesProbarAlarma()` (editor, solo dueño) manda el mismo correo con "[PRUEBA]" y umbral de 1 h.
3. **Probado:** control negativo con `canalesProbarAlarma` (llegó "[PRUEBA] Rosanta · canal callado: WhatsApp, Instagram, Messenger" a las 09:18). La primera prueba destapó un falso positivo: el hilo de Elise (llegó antes de encender el canal de correo y ya estaba contestado) contaba como "pendiente"; se arregló contando hilos y no mensajes. Prueba de batería "El latido de canales distingue sano de callado" (5 casos, esperado 0/1/0/1/0; con el umbral roto da FALLA). **Prueba en vivo (16-oct, cuentas personales de Juanma, hora anotada): Instagram entró 09:36:27, WhatsApp 09:37:28, Messenger 09:39:38; el bot contestó a los 5-6 s en los tres.** Además Meta y Conversaciones coinciden día por día hasta el 11-oct.
4. **Tarea `rosanta-salud-intranet`:** ahora busca "Rosanta · canal callado" (sin [PRUEBA]), y se corrigió que buscaba "Rosanta · procesos" cuando el asunto real de `procAvisar_` es "Rosanta · N proceso(s) automático(s) con problemas" (respaldo `SKILL.md.antes-canales-16oct`).

**Lecciones:**
1. **Antes de culpar al webhook, mirar la bandeja de Meta por API**: decide en un minuto entre "no llegó" y "nadie escribió". El LEEME del 15-oct ya había concluido lo mismo para otro "silencio".
2. **Un mensaje entrante se anota ANTES de usar el token** (Code.js): un token vencido no explica un canal callado en la hoja; un webhook caído o nadie escribiendo, sí.
3. **`clasp push` no borra un archivo remoto si nada más cambió** (otra vez): el diagnóstico archivado lo sacó el siguiente push de la otra sesión.
4. **En el editor de Apps Script, `UrlFetchApp` rechaza llaves `{}` sin codificar** en la URL ("Invalid argument"): `encodeURIComponent` en `fields`.
5. Coordinación de push del bot con la sesión "Que el bot pase menos chats a Juanma" por mensajes: funcionó sin pisarse.

---

## Cierre del 17 oct 2026 (v45b): reservas sin pasar por Juanma — bot @56

Revisión de 5 casos con Juanma (17-oct). **Producción: bot @56** (verificada en `list-deployments`, tardó ~1 min en verse; volver atrás = `-V 55`). Wix: duplicado de reserva compara también el correo (`rosanta-wix`). Código en main y GitHub (`35a1a2a`).
1. **Etiquetas de Gmail:** ningún código las pone; el filtro solo etiqueta respuestas a "Your reservation at Rosanta is confirmed" y OpenWidget. Elan, Jenni, Nutrifert y otros clientes nuevos llegan SIN etiqueta → el bot no los leía. Desde @56 el bot lee toda la bandeja Principal (con exclusiones) y a quien no es cliente (`tipo otro/spam`) no le contesta.
2. **Decisiones de Juanma (17-oct):** con el bot callado esperando a Juanma, las reservas (crear/cambiar/cancelar/consultar) las atiende el bot y el chat vuelve al bot; algo parecido en la base (picnic → Cena Romántica) se ofrece sin escalar; **reserva creada por correo se contesta sola** (plantilla revisada: "Hola X, Tu mesa queda confirmada: … Te esperamos en el jardín. Para cambiarla o cancelarla, responde a este correo."); aviso del día con `resumenDiarioBot` (activador 21-22 h creado por Juanma). Por correo sin teléfono va el del restaurante (`RV_TEL_CORREO`).
3. **Casos:** Elise bien (3→2 el 15-oct). Jenni (Keep In Touch) entró al pipeline 17 h después por la revisión diaria, que arrancó a las 9:02 y no a las 7:15. **Elan Halpern**: pedía desde julio el 26-dic, 4 personas; nunca se había creado → creada hoy 19:30 y contestada (script de una vez, archivado). **Abdiel** (Cena Romántica, 16-oct 22:16): escaló por "picnic" y el bot se calló; su "Sí, quiero reservar" quedó sin respuesta → origen de los cambios.
5. **Limpieza (17-oct, bot @57):** 9 funciones de una vez (testBot, probarConversaciones, rvProbar —creaba reserva REAL—, activarWhatsApp, activarMessenger, obtenerPageToken, crearTriggerRespuestas, crearTriggerTokenIG, archivarSalientesAhora) y PruebaModelo.js archivados en `apps-script/_archivo/2026-10-17_bot_limpieza`. Quedan 10 archivos. La prueba es `probarEscaladas`. Se quedan los interruptores (btApagar, btAbrirATodos, btModoPrueba, correoEncender/Apagar).
4. `probarEscaladas` 15 de 15. `clasp` vence seguido (`invalid_rapt`): `clasp logout` + `clasp login` lo hace Juanma. `clasp push` que solo borra un archivo no lo saca del remoto (ElanReserva.js sigue en HEAD hasta el próximo push con cambios).

---

## Cierre del 16 oct 2026 (v45): menos chats pasan a Juanma — bot @55, Wix `consultarBot`

Sesión "Bajar los chats que el bot pasa a Juanma" (sesión del mentor, 16-oct). **Producción: bot @55** (verificada con `list-deployments`; @54 = consultar/propuestas/anticipo, @55 = nombre del perfil; volver atrás = `-V 53`). Wix publicado con `post_consultarBot` (`rosanta-wix` `75899de`). Código en `main` local (merge `8fcc419`), **sin push a GitHub**.

1. **Diagnóstico (16-sep→15-oct, leyendo cada conversación):** 38 chats, 12 pasaron a persona (**3.2 de cada 10**). **7 de los 12 eran reservas**: 6 de cambiar o cancelar ("No pude cancelarla en el sistema", el error que arregló la @50 del 15-oct) y 1 de consultar la hora. El resto fue 1 chat por motivo: fotos de la Cena Romántica, anticipo, queja de pago, influencer, reenviar una propuesta y un evento. **7 de los 12 no tienen ninguna respuesta humana en `Conversaciones`.** Esperado con @54: ~1.3 de cada 10.
2. **La línea la puso Juanma (16-oct):** confirmar transferencias y anticipos = **siempre Juanma** (el bot pide el comprobante UNA vez y no insiste). Colaboraciones, influencers, proveedores, músicos y prensa = **al correo, sin pasar el chat**. Siguen con Juanma: quejas, pagos, propuestas y negociación de eventos, reenvío de cotizaciones, casos delicados y "quiero una persona".
3. **Consultar reserva (@54):** acción nueva `consultar_reserva` → `Consultar.js` (`rvConsultar`) → Wix `POST /_functions/consultarBot`, que **solo lee** (mismo filtro que `cancelarBot`, ordenado por fecha). Regla en el prompt: preguntar por una reserva NUNCA es cancelar ni cambiar (antes, con la cancelación ya funcionando, "¿a qué hora era?" podía terminar CANCELANDO la reserva). Textos revisados por revisor-marca. Arnés en Node 10/10 con control negativo.
4. **Prueba de conversaciones simuladas `probarEscaladas` (`PruebaEscaladas.js`, no envía nada): 12 de 12** en ES/EN con Sonnet 5.5 (16-oct 09:19).
5. **Base de conocimiento (Doc), con un script de una vez `kbEscaladas`** (corrido por Juanma 09:21, verificado leyendo el Doc; archivado en `_archivo/2026-10-16_bot_kb_escaladas`): sección 4 = cambiar en un paso + consultar; Cena Romántica = video `1Yd4f33…` (es de Dani, se abre con el enlace) y anticipo una vez. **El segundo video y las fotos que mandó Juanma el 29-sep son privados** (uno compartido con bpacheco@econtrisa.com): no se pusieron. La copia `.md` de Drive estaba atrasada (decía "el bot NO toma reservas"): se corrigieron la sección 4 y la Cena Romántica.
6. **Medición (16-nov-2026):** `~/Dev/Rosanta/tools/bot-medicion/medir.py <xlsx> desde hasta [--detalle]`. Con el mismo criterio de la línea base da 3.7 (la línea base dice 3.8). Foto y motivos en `Bot_WhatsApp_IG/Medicion_Escaladas_2026-10-16.md`. Las reservas de cada 10 chats no deben bajar de 1.6 (2.5 desde el 8-sep).
8. **Nombre del perfil (decisión de Juanma, 16-oct, @55):** el nombre de WhatsApp no siempre es el de la persona. Si el bot lo conoce, pregunta "¿Pongo la reserva a nombre de Juanma?" con los botones Sí, a mi nombre · Otro nombre (en inglés: Yes, under my name · Someone else; frase revisada por marca). Si el nombre no parece de persona, pide el nombre directo. **La prueba en vivo de Juanma salió bien:** crear, consultar y mover a 20:00 con 3 personas en un paso. Su reserva de prueba (sáb 17-oct 20:00, 3p, Juan Lemus) la canceló él mismo por el bot (16-oct). `probarEscaladas` dio 13 de 14; el caso que no coincidió fue el bot pidiendo aclarar "7:15", sin pasar el chat.
7. Se coordinó con la sesión "Alarma si un canal del bot se queda en silencio": ella subió y archivó `DiagnosticoCanales.js`, y el push de esta sesión lo sacó de HEAD. Su hallazgo: el hueco de IG del 26-sep al 7-oct **no fue ni el token ni el webhook**: Meta tenía 0 mensajes de clientes en ese tramo.

**Lecciones:**
1. **Antes de diseñar "bajar escaladas", mirar qué arreglo reciente ya las cubre:** la mitad venía de un error que se arregló el día anterior. El trabajo principal era comprobar el arreglo.
2. **Una acción nueva que solo lee protege a las que escriben:** sin `consultar_reserva`, el modelo mandaba la consulta a la única acción parecida (cancelar).
3. **`git commit -a` en `~/Dev/Rosanta` se lleva los cambios sin guardar de otras sesiones** (pasó con `rosanta-cerebro/SKILL.md` y se deshizo con `reset --soft`). Siempre `git add <ruta>` explícito.

---

## Cierre del 15 oct 2026, noche (v44): el bot con botones, Sonnet 5.5, se calla al pasarte el chat y manda los eventos al pipeline — producción @49

Sesión "Chatbot: botones, eventos al pipeline y modelo nuevo" (decisiones de Juanma del 15-oct, sesión del mentor). **Producción: bot @49 · consola @13** (verificadas bajándolas aparte). Código en `main` local (`claude/bot-botones`), **sin push a GitHub**. CLAUDE.md nuevo del subproyecto: `~/Documents/Claude/Projects/05_Marketing_OS/Bot_WhatsApp_IG/CLAUDE.md` (acceso directo en la carpeta de Drive).

1. **Línea base (hoja Rosanta Leads, 14-jun→14-oct, 250 chats):** de cada 10 chats, 0.5 terminan en reserva creada en Wix (**2.5 desde el 8-sep**, cuando el bot empezó a reservar), 2.1 piden evento, 3.8 pasan a persona. Respuesta humana registrada: mediana 14 min. **Instagram no recibió nada del 26-sep al 7-oct** (11 días: webhook o token). El después se mide igual a los 30 días, más tres datos nuevos: botón tocado (`Fichas.ultimo_boton`), eventos con fecha/personas/presupuesto completos, y paso a persona contestado en <1 h.
2. **Modelo `claude-sonnet-5-5`:** effort low, salida estructurada (json_schema: se acabaron los reintentos por JSON roto), fallbacks "default", texto leído por tipo de bloque. Prueba `probarModeloBot` (archivo `PruebaModelo.js`): 6 de 6 ES/EN. **La propiedad vieja `CLAUDE_MODEL` (=sonnet-4-6) se ignora; el modelo se cambia sin publicar con `CLAUDE_MODELO_BOT`.**
3. **Botones (`Botones.js`):** Reservar mesa · Ver menú · Evento privado · Hablar con alguien (WhatsApp lista de 4; IG/Messenger quick replies), en el saludo y cuando no hay siguiente paso; nunca mientras junta datos (`lead.mostrar_menu:false`). Evento: presupuesto con botones (Hasta Q400 · Q400 a Q550 · Más de Q550 · Aún no lo sé, con bebidas) y formato. Si Meta rechaza los botones sale el texto. Llave `BOTONES_MODO`: **"todos" desde el 15-oct 16:43**; apagar con `btApagar()`.
4. **Paso a persona (decisión de Juanma: él es el único que atiende, horario del chat 9:00–21:00):** "Te escribe Juanma en menos de una hora" hasta las 20:00; después "mañana/hoy a partir de las 9:00". **El bot se calla al escalar** (salvo eventos: avisa y sigue preguntando) y **retoma** con "🤖 Devolver al bot" de la consola o a los 30 min sin que Juanma escriba; al retomar **escribe primero** un seguimiento leyendo `Conversaciones` (solo dentro de 24 h). Si Juanma no contesta en 24 h, el bot vuelve. Estado en Propiedades `hum_<id>` (`Humano.js`).
5. **Eventos → pipeline:** el correo "🔔 Lead para atender — evento" lleva `---DATOS_PIPELINE---` (cliente, contacto, canal bot, canal_detalle, primer_contacto, fecha_consulta, fecha_evento, pax, presupuesto, formato_menu, idioma, id_chat). Pestaña nueva **`Fichas`** (una fila por contacto, el bot solo completa): la lee la consola ("Lo que ya sabe el bot") y el CRM. Formato en `Bot_WhatsApp_IG/Bot_a_Pipeline_Formato_2026-10-15.md`; la sesión del Pipeline lo aceptó con ajustes (ya aplicados). **Hecho (15-oct, noche):** la revisión diaria lee `DATOS_PIPELINE` y `Fichas`; el Pipeline se mudó a la pestaña `cotizaciones` de Rosanta Marketing OS (sesión CRM) y la consola @14 muestra la etapa leyendo esa pestaña (por id_chat, correo o teléfono). El Pipeline se va a mudar a la pestaña `cotizaciones` de Marketing OS (sesión CRM): ahí el bot podrá crear la consulta directo.
6. **Base de conocimiento del bot:** el bloque de eventos tenía la **Lista 2026** (servido Q320, bebidas Q150, combo Q375); quedó en **Lista 2027** (Q345/375, Q165, Q415, entrantes Q185 por cada 2, 15% y regla del alquiler), revisado por revisor-marca, verificado leyendo el Doc. Las secciones 4 (reservas: el bot sí toma, cambia y cancela) y 11 (paso a persona con la frase de Juanma) también quedaron corregidas (16:49, verificado).

7. **Cambiar reserva en un paso (bot @50, Wix `post_cambiarBot`, publicado con `wix publish --source remote`):** revisa lugar, crea la nueva y recién cancela la vieja; si no hay lugar no toca nada. Cancelar y cambiar aceptan la hora para elegir entre varias reservas. **Wix ahora exige el teléfono EXACTO de la reserva para cancelar** (`PHONE_NUMBER_INCORRECT`): la cancelación por el bot estaba rota sin que nadie lo notara; `botCancelarSeguro` prueba el teléfono del cliente y el guardado. Prueba completa en vivo 8/8 (archivada en `apps-script/_archivo/2026-10-15_bot_prueba_reservas`). Quedaron 3 reservas "PRUEBA BOT" del martes 20-oct con teléfono inválido que solo se cancelan a mano en Wix.

8. **Canal de correo (bot @51, encendido 15-oct 17:26):** cada 5 min (`revisarCorreosClientes`, `Correo.js`) el bot lee los correos NUEVOS con la etiqueta `01-CLIENTES (Reservas)` (sin la subetiqueta Cotizaciones; incluye el chat de Wix que llega de noreply@openwidget.com) y **deja la respuesta como BORRADOR en Gmail** para que Juanma la revise y envíe. Las reservas que pida el cliente (crear/cambiar/cancelar) sí se ejecutan en Wix; por correo el bot no manda su propio correo de confirmación (va en el borrador) ni se calla esperando a Juanma. Permiso de Gmail autorizado el 15-oct. Apagar: `correoApagar()`. Elise Adreon (21-oct 19:30) pasó de 3 a 2 con el cambio en un paso; respuesta en borrador. **Decisiones de Juanma (15-oct, tarde):** por correo, si el cliente pide cambiar o cancelar y quedó hecho en Wix, el bot contesta SOLO (sin borrador), con el correo revisado por marca (bot @53); en cancelaciones el cliente recibe dos correos (el de Wix en inglés y el del bot en su idioma) y se dejan así. Cambiar fecha/hora MODIFICA la reserva en Wix (sin aviso de cancelación); subir personas la reemplaza (Wix no agranda la mesa: TIME_NOT_AVAILABLE/TOO_SMALL) y Wix sí manda su aviso, que el correo 'Tu reserva cambió' explica.

**Lecciones:**
1. **Un "no llegó nada" se confirma con la hora de la prueba**, no con la hoja: la exportación de Drive y la lista de ejecuciones se leyeron minutos ANTES de que Juanma probara, y casi se dio por caído un canal que estaba sano.
2. **Para correr una función desde Claude in Chrome, ponerla sola en su archivo:** el menú de funciones no responde, pero al abrir un archivo queda elegida su primera función pública (las que terminan en `_` no salen).
3. **Una propiedad de script vieja manda sobre el código nuevo** (CLAUDE_MODEL): cambiarla habría movido también la versión en producción. Mejor una propiedad nueva.
4. **El conector de Drive no edita el cuerpo de un Doc, pero Apps Script sí** (DocumentApp, con el proyecto que ya tiene el scope): un script de una vez con chequeos antes de borrar.

---

## Cierre del 15 oct 2026, noche (v43): la lectura del CRM era un error de medida, botones de mesa y ficha de cliente

Sesión "CRM: mesas automáticas y ficha de cliente" (decisiones de Juanma del 15-oct, sesión del mentor). **Producción: @200** (= `1387e62` de la rama `claude/crm-ficha`, en main por el merge `233e352`; verificada bajando la 200 aparte, 94/94). Batería sobre ese HEAD en el Chrome de Juanma **194 OK · 0 fallas · 3 avisos · 2 saltadas = 199, 114.3 s**. El sello lo corrió Juanma en su Terminal: el modo automático de la sesión bloqueó `sellar-bateria.py` dos veces. CLAUDE.md nuevo del subproyecto: `~/Documents/Claude/Projects/05_Marketing_OS/CRM_y_Retencion/CLAUDE.md` (acceso directo en Drive).

1. **La lectura del CRM en 35% NO era el hábito del salón: era la medida.** Del 1 al 14-oct, 26 de 27 reservas no canceladas ya estaban cerradas en Wix. `crmAltasPorMes_` y el Latido medían sobre las ALTAS del CRM por `fecha_alta` (el día en que la persona reserva), así que contaban como "no sabemos" reservas para fechas futuras (21-oct, 4-nov, 22-ene…) y canceladas (el segmento del CRM nunca baja de rango: un cancelado se queda en "Reserva histórica"). **Regla nueva: la lectura se mide por RESERVA, en Marketing OS › `reservas`, por fecha de la mesa**: base = fecha ≤ hoy−3 y no canceladas; leídas = consumo > 0, SEATED, FINISHED, o NO_SHOW desde el 15-oct (antes NO_SHOW = "no sabemos"). `crmLecturaCalc_` / `crmLecturaReservas_` en CrmDatos.js; la usan `crmAltasPorMes_` (→ MarketingDatos, PautaSistema, Medición) y `latCaptura_`. **Octubre: 35% → 95% (18 de 19).** Agosto 63%, septiembre 40% (siguen como estaban: ahí sí faltó cerrar mesas). El CAC (denominador "Cliente que visitó") no cambió.
2. **Cruce automático reserva ↔ POS (opción a) DESCARTADO:** el POS nuevo (ReporteFacturas, desde el 1-oct) no trae hora ni mesa. Medido 1-11-oct: solo 7 de 19 reservas con un ticket único de los mismos comensales, y en 3 de esas 7 el monto no era el del consumo anotado. No reproponerlo salvo que PosFile exporte hora o mesa.
3. **Botones "Llegó" (SEATED) y "No vino" (NO_SHOW) en Profit OS › Barra y Sala › Mesas por cerrar** (`salaMarcarMesa`, guarda `exigirSala_` en `PR_GUARDAS_PROPIAS_`, rol sala o dueño). **Nunca FINISHED desde la intranet** (dispara el correo de TripAdvisor). Solo mesas en RESERVED con fecha de hoy o anterior; GET + PATCH a la API de Wix como `CerrarMesasNoShow.js`. **Pendiente: que Juanma copie `WIX_API_KEY` y `WIX_SITE_ID` de Propiedades del script del Marketing OS a las de la intranet**; sin eso el botón responde "Falta conectar Wix".
4. **Ficha de cliente** en el CRM (tocar el nombre): cajón lateral, a pantalla completa en el celular. `crmFicha(auth, clave, email)`: reservas y visitas (consumo promedio, no-shows, canceladas), últimos 20 mensajes del bot, la fila de `Fichas` del bot (pestaña nueva de la sesión del bot en Rosanta Leads, llave `canal|contacto_id`), consultas de evento de `Leads` y cotizaciones de Marketing OS › `cotizaciones` cuando exista. Caché 5 min. Solo tokens de la paleta.
5. **HECHO la misma noche: el Pipeline de Eventos ya vive en Rosanta Marketing OS › `cotizaciones`** (30 filas migradas y verificadas: mismas etapas, montos por etapa e historiales; más la pestaña `revisiones`). Escritura con `version` (todo o nada, como el `if_version` del artifact). Tres caminos: (a) intranet, Sistema de Marketing › **Eventos** (`?page=eventos`, `EventosDatos.js` + `EventosVista.html`, port de la página vieja con la paleta), **publicada en la @201 (16-oct)**, verificada 96/96, batería 195 OK · 0 fallas · 3 avisos · 2 saltadas = 200 (sello corrido por Juanma); (b) la revisión diaria de las 7:15 lee y escribe por `~/Dev/Rosanta/tools/cotizaciones/cot.sh` → hook `?hook=cotizaciones` del web app del Marketing OS (**@21**), con token `COTIZ_TOKEN` (Propiedades del Marketing OS; copia local en `~/.rosanta-secretos/cotizaciones-token`); SKILL.md de la tarea reescrito (respaldo `.antes-sheets-15oct`); permiso `Bash(~/Dev/Rosanta/tools/cotizaciones/cot.sh *)` agregado a `~/.claude/settings.json` el 16-oct con el sí de Juanma (respaldo `settings.json.antes-cotsh-16oct`); (c) el bot, con la forma en `05_Marketing_OS/Bot_WhatsApp_IG/Pipeline_en_MarketingOS.md`. El token quedó escrito en el chat del 15-oct; Juanma decidió no cambiarlo (16-oct). Borrar versiones de Apps Script no lo hace Claude (borrado permanente): lo hace Juanma; Claude junta los cambios y publica una sola versión por sesión. La página de claude.ai se republicó (v6) con el aviso "se mudó" y en solo lectura; sus datos quedan como respaldo al 15-oct. A propósito las pestañas NO están en `SCHEMA` del Marketing OS: la API general (token viejo, público en el código de Wix) no puede tocarlas. Antes: decisión de Juanma: el Pipeline de Eventos sale de claude.ai y se muda a una pestaña `cotizaciones` del Marketing OS ("no debería haber nada en claude.ai"). Proyecto aparte, después de la ficha; coordinar con la sesión del pipeline y con la del bot (que podría crear ahí las filas "consulta").
6. Hallazgo sin tocar: en CRMSync (Marketing OS) un contacto que cancela se queda en "Reserva histórica" porque el segmento solo sube. Ya no afecta la lectura ni el CAC.
7. **Tope de 200 versiones de Apps Script: resuelto el 16-oct.** Juanma borró en lote las viejas: quedan 22 (180 a 201), 178 lugares libres. Google no deja borrar versiones por clasp ni por la API: solo desde el editor › Historial del proyecto, que SÍ tiene borrado en lote (ícono de papelera "Bulk delete versions", abajo a la derecha del panel), y lo hace Juanma (es borrado permanente). Antes, al publicar la @200 (15-oct, al publicar la @200): `clasp create-version` ahora responde "Cannot create more versions". **Antes de la próxima publicación, Juanma tiene que borrar versiones viejas** desde el editor (historial del proyecto). Se conservan la @199 (para volver atrás) y la @200 (producción). Ninguna sesión puede publicar hasta que se haga.
8. **Mesas automáticas, en pausa (Juanma, 15-oct: "dejémoslo así por ahora").** Ningún reporte de PosFile trae hora ni mesa (ni ReporteFacturas ni VentasProductos). Opciones evaluadas por si se retoma: (1, la recomendada) mensaje del bot al día siguiente con "Muy bien" / "No pude ir" que cierra la mesa sola y pide la reseña; (2) confirmación el mismo día; (3) nombre de la reserva en el campo Cliente del POS; (4) pedirle a PosFile que exporte la hora o la mesa. No reproponer hasta que Juanma lo pida.
9. Pendiente para la próxima subida: mostrar en la ficha la columna `estado_bot` de `Fichas` ("Esperando a Juanma" / "Juanma atendiendo"), que el bot agregó en su @47.

**Lecciones:**
1. **Antes de pedirle un hábito al equipo, medir el dato crudo.** La alarma decía "las mesas no se marcan" y el dato crudo decía que sí.
2. Una medida por fecha de alta mezcla el pasado con el futuro: toda tasa de "¿vino?" se mide por la fecha del hecho.
3. La lista de reservas que exporta Drive corre las columnas cuando falta el teléfono: al leerla por texto, revisar filas raras antes de contar.

---

## Cierre del 15 oct 2026, noche (v42): el Pipeline de Eventos pasa a embudo por etapas, con revisión diaria

Sesión "Rediseño del Pipeline de Eventos" (decisiones de Juanma del 15-oct, sesión del mentor). Página: https://claude.ai/artifact/5PV1npns9aDu9oAGKiD69j (versión 4, mismo `db`). Procedimiento reescrito: `05_Marketing_OS/Eventos_y_Cotizaciones/Procedimiento_Seguimiento_Cotizaciones.md`.

1. **Etapas:** Consulta → Cotizada (incluye "por enviar") → En conversación → Visita/degustación → Reservada (esperando el 50%) → Ganada / Perdida (con motivo) · En pausa. Campo `etapa` (y `estado` sigue en sync para compatibilidad), `etapa_max`, `etapa_desde`, `canal` (instagram/web/bot/planner/referido/tripadvisor/otro), `fecha_consulta`, `fecha_primera_respuesta`, `respuesta_horas`, `ultimo_cliente`, `proximo_paso {texto, fecha}`. Los toques son un contador dentro de la etapa.
2. **Ritmos:** Cotizada = los 4 toques del 8-oct. En conversación = 4 correos con reloj desde el ÚLTIMO mensaje del cliente (<30 d: +1/+3/+5/día antes de vencer; 1-3 m: +3 d/1 sem/2 sem/jueves antes; 3-6 m: 1/2/4/7 sem; >6 m: 1/3/6 sem/jueves antes). Visita: resumen <24 h. Reservada: 2 recordatorios del depósito (+2 y +5 d). **El vencimiento solo cambia con una versión nueva del PDF.** La página tiene candados: sin fecha del evento ni `vence` no guarda, y `vence` de una cotización enviada solo cambia marcando "versión nueva del PDF".
3. **Regla nueva de Juanma: la vigencia sale de la distancia al evento, nunca 15 días para todos** (Geraldine perdió Q57k así). `rosanta_cotizador.py` ahora frena "válida por N días" / "valid for N days" (respaldo `.bak-2026-10-15`). Hoy se regeneraron Nikita y Adam y Aniesa y Ravinder (v4, vencen 8-ene-2027, revisor SALE; Aniesa ahora a nombre de Patricia y con portada de boda) y se regeneraron Barrie (v4, vence 15-ene-2027), Louren (v3, 15-ene), Adris, Sofía y Orlando (v3, 10-dic-2026) con los totales iguales, corregidas con las decisiones de Juanma y aprobadas por el revisor (SALE las 5), con sus correos en borrador. **Decisiones del 15-oct: ningún evento lleva platos de la carta** (se usan los menús de evento: MENÚ BODAS / EN MENU EVENTS; corregidos la skill y `revisor-marca`); **los entrantes para compartir son 1 por cada 2 personas**, también en cotizaciones viejas (sube la opción B de Barrie a Q40,848, Adris Q30,578.50, Orlando Q32,631.25); las 5 son bodas (portada de boda). 
4. **Migración de las 30 filas** con un batch e `if_version` (al 15-oct: 9 cotizadas, 3 en conversación, 2 reservadas: Nuria y Nutrifert, 3 ganadas, 1 en pausa, 10 perdidas con monto). Hallazgos: Nutrifert escribió 2 veces sin leer; Nuria sí apartó (paga el 24-oct); Abigaíl y Porres figuraban como "respondió" sin ningún correo suyo; **José y Frida (evento 27-nov) están confirmados en Gmail y no están en el pipeline**.
5. **Revisión diaria `revision-diaria-cotizaciones` (L-S 7:15) CREADA con el sí de Juanma; `revision-jueves-cotizaciones` APAGADA. Se agregaron a `~/.claude/settings.json` `create_draft`, `list_drafts`, `ArtifactData` y `Agent(revisor-marca)` (respaldo `settings.json.antes-revision-diaria-15oct`); enviar sigue sin permiso. Diseño:** `Propuesta_Tarea_Revision_Diaria_Cotizaciones.md`. **Causa de que la del jueves se trabe: las tareas solo tienen permisos de LECTURA** (settings.json del 15-oct) y la revisión necesita `create_draft`, `ArtifactData` y `Agent(revisor-marca)`: se quedaba esperando aprobación y ocupaba uno de los 3 lugares. Aviso si no corre: push al terminar (si a las 8:00 no llegó, no corrió) + franja roja en la página (colección `revisiones`, un doc por día).
6. **Consultas desde el inicio:** el bot (v46) ya manda correo "🔔 Lead para atender (canal) — tipo" a restaurante@rosanta.rest; la revisión diaria los convierte en filas `consulta` sin tocar el bot. Lo mismo con los avisos de `noreply@openwidget.com` (web).
7. **Cuenta BI monetaria de CORSAGA para depósitos de clientes: 6500002057** (dada por Juanma el 15-oct para Nutrifert). Remitly va a la cuenta en QUETZALES de CORSAGA, nunca a la de dólares.
8. **Las 4 tareas de un solo uso** (Daniela 23-oct, Mollie 24-oct, Porres 24-oct, choque 20-mar 28-oct) quedaron como `proximo_paso` en sus filas; BORRADAS con el sí de Juanma (sus SKILL.md quedan en disco).

**Lecciones:**
1. **Un PDF parchado encima de una versión vieja arrastra todo lo viejo** (portada en usted, chimenea, texto oculto "Familia Herrera"): el revisor lo rechazó. Una versión nueva se REGENERA con el script actual.
2. **Un adjunto de 3 MB no se puede pasar desde la sesión a un borrador de Gmail**: los borradores quedan sin adjunto y Juanma lo agrega desde Drive.
3. **"Cliente respondió" en el pipeline no prueba que respondió:** dos filas lo decían sin un solo correo del cliente. La revisión diaria verifica en el hilo antes de mover la etapa.

---

## Cierre del 15 oct 2026, noche (v41): guardar en Pagos y Recetas se ve, y Pagos devuelve solo lo que cambió — producción @199

Sesión "Guardados rápidos y visibles: pagos y recetas". Juanma: en Pagos y Recetas "tarda mucho y no sabes si está cargando o no". **Producción: @199 = `4418e69`** (verificada bajando la 199 aparte, 94/94; batería 191 OK · 0 fallas · 3 avisos · 2 saltadas = 196, 187.7 s). Lo grueso salió en la @198 (ver v38); la @199 suma la medición fina de Recetas, un arreglo del aviso y el celular de Marketing (`cbf2d49`, de la paleta). Rama `claude/gifted-dhawan-45914f`.

1. **Medir primero: `Tiempos.js` + `?page=tiempos` (solo dueño).** Cada guardado de Pagos (`_pagMedir_`) y del recetario (`conCambiosDeModelo_`) deja en CacheService (anillo de 60, 6 h) cuánto tardó, quién, y cada tramo (`tiempoTramo_`: abrir ficha, ubicar líneas, escribir, bitácora, flush, releer, parchear caché; en Pagos validar/escribir/recalcular). La pantalla también anota lo que sintió la persona (`anotarTiempoPantalla`, fila "pantalla · …"). "Medir lectura" corre SOLO lecturas. Guarda propia `exigirDuenoTiempos_` (registrada en `PR_GUARDAS_PROPIAS_`).
2. **Números (15-oct):** Pagos — compra de mercado: servidor 4.1 s (1.2 escribir + 2.9 rearmar TODA la pantalla, 134 KB), en pantalla 10–20 s y el formulario desaparecía sin aviso. Leer el maestro NO era lo lento (~2 s todo; ya se leía una vez por ejecución). Recetas — cambiar una cantidad: servidor 2.2–3.6 s en caliente (8.2 s recién subido), en pantalla 5–7 s; ningún tramo domina (flush 0.4–1.4, releer ficha 0.5, parchear caché 0.4–0.5, bitácora 0.3–0.4). **Cada llamada a Google suma ~3 s fijos** (arranque del script, identificar a la persona, ida y vuelta): no se baja desde el código. Decisión de Juanma: **parar ahí con la velocidad de Recetas**; no se cacheó la hoja USUARIOS (ahorraba ~0.3 s a cambio de 1 min de demora al revocar un enlace).
3. **Pagos devuelve solo lo que cambió (`_pagCambios_`, patrón `cambios` de recetas):** las facturas y la fila del cuadre de los proveedores tocados, su saldo a favor, mercado y por devolver, más un `resumen` ("Pago guardado: Q995.60 a BELCA GUATEMALA"). ~4 KB contra 57 KB. Mercado y devolución al equipo no leen el maestro. Sale del MISMO estado que la pantalla (`_pagVisibles_`, `_pagPantalla_`, `_pagCuadre_`); anular un "No pertenece", "Confirmado con banco", IVA o traídas sigue devolviendo la pantalla entera. **Orden total** de facturas (llave) y cuadre (nit) para que pegar == recargar. Pruebas: batería "El camino rapido de Pagos da lo mismo que la pantalla completa"; `harness-pagos.js` compara rápido == pantalla y pegado (la `aplicarCambios` real de ProfitPagosJs) == recargar, con control negativo (77 OK).
4. **Que se vea: `GuardadoEstado.html` (`PF_GUARDADO`), en Pagos y Recetas.** "Guardando…" al instante; a los 4 s "Sigue guardando, no cierres esta página"; al terminar "✓ …" 6 s; en Pagos el proveedor se marca en verde y la pantalla no salta ni se cierra la pestaña. Errores: **Reintentar solo si nada se escribió** (alguien más guardando); **con el internet cortado dice "No sé si se guardó" y pide Actualizar, nunca repetir** (podría duplicar un pago); un dato rechazado queda en el panel. Recetas: sin `alert` salvo con más cosas en fila; el aviso negro de "Deshacer" esconde el ✓ verde. Colores solo de la paleta; botón 44 px.
5. **Arreglados de paso:** `harness-caja.js`, `harness-compras.js` y `harness-pagos.js` leían `~/Dev/Rosanta` fijo y no cargaban `Tiempos.js` (se rompieron con la @197): DIR relativo. Falla conocida que NO es de esta sesión: harness-pagos "Balance: Cofradia facturado Q22,268" (dato del espejo del 14-oct).

**Lecciones:**
1. **Medir antes de creerle al diagnóstico:** el mentor apuntaba a la lectura del maestro; lo lento era rearmar y repintar toda la pantalla, y sobre todo que no se veía nada.
2. **Un guardado de prueba que no se puede deshacer no se hace.** La ventanita `confirm()` de "anular" no aparece en el navegador de la app (queda en "no"), y escribir en una celda de Sheets desde ese navegador no llega a la celda. Desde **Claude in Chrome** sí se edita Sheets. Para medir Recetas sin ensuciar: cambiar una cantidad y devolverla (sin confirm).
3. **El navegador de la app a veces muestra capturas viejas** en páginas de Apps Script y Sheets: un scroll de una línea fuerza el repintado antes de creerle a la imagen.
4. **Maqueta local para una pantalla con `google.script.run`:** datos reales del arnés (Node) + un `google.script.run` falso con demora y casillas para simular errores, servida con `python3 -m http.server` desde el scratchpad (`.claude/launch.json` temporal). Así se vio el aviso antes de publicar.

---

## Cierre del 15 oct 2026, noche (v40): el candado ya no frena falso desde un worktree

Sesión "candado: historia de la rama". Solo configuración de Claude Code: no tocó la intranet ni lo publicado. **En main y en GitHub (`d143ba9`).**

1. **`verificar_push` (`.claude/hooks/candado-clasp.py`) acepta cualquier versión de la historia de la rama.** Antes comparaba el archivo del servidor solo contra el ÚLTIMO commit: un worktree nuevo (sin foto de push) cuyo último commit cambió un archivo veía la versión del servidor —la de main o de un merge ya traído— como "de otra sesión" (15-oct, gifted-dhawan: dos `ROSANTA_PUSH_PISAR` innecesarios). Ahora busca el blob del contenido bajado entre las versiones de esa ruta alcanzables desde HEAD (`git log --full-history`, hasta 200, `.js` o `.gs`). **Sigue frenando** lo que no está en la historia: otra rama sin traer, o algo nunca commiteado. De paso se corrigió que las rutas no partían de la raíz del repo.
2. **Simulador guardado en el repo: `python3 .claude/hooks/prueba-candado.py`** (repo de juguete, `clasp` falso en el PATH, sellos en carpeta temporal: nunca toca `~/.rosanta-sellos`). **26/26**; el candado anterior da 22/26 (fallan justo los 4 casos nuevos: control negativo). El "20/20" del 14-oct nunca se había guardado. Correrlo después de tocar el candado.
3. **Solo lo toman las sesiones nuevas** (el hook se lee de `$CLAUDE_PROJECT_DIR`; un worktree viejo sigue con el suyo hasta traer main).

**Lección:** la ruta de la skill instalada que daba el CLAUDE.md (`…/skills-plugin/…/skills/rosanta-cerebro/`) ya no existe: **la instalada es `~/.claude/skills/rosanta-cerebro/`**. CLAUDE.md corregido.

---

## Cierre del 15 oct 2026, tarde (v39): una sola paleta y la intranet en el celular

Sesión "Intranet: una sola paleta y vista en celular". **Publicado en la @197 (paleta) y la @198 (celular, tandas a y b)**; las baterías y versiones las sacó "Solidez día 3" (ver v38). Encima, `cbf2d49` (tanda c, solo CSS de Marketing en el celular): **publicado en la @199 (= `4418e69`), batería 191 OK · 0 fallas · 3 avisos · 2 saltadas = 196** (lo publicó "Guardados rápidos", ver v41).

1. **Paleta única (decisión de Juanma, 15-oct).** `PaletaServidor.js`: `PALETA_` (31 tokens), `PALETA_ALIAS_` (--superficie, --fondo, --encabezado, letras, radios), `PALETA_OSCURO_` (solo Profit OS). Cada página pega `<?!= paletaCss_() ?>` (CosteoVista además `paletaCssOscuro_()`); correos, PDF e Inventario consolidado leen `paletaHex_('--token')` **dentro de getters**, porque `PALETA_` puede cargarse después del archivo que la usa. De 143 colores sueltos y **cuatro semáforos** a uno: `--ok #1E6A50`, `--alerta #8A6420` (texto) / `--alerta-relleno #C89A3C`, `--mal #B23A1E` / `--mal-relleno #C4553B`, cada uno con `-tint`. Verde y rojo se movieron para que se distingan con daltonismo; todo texto ≥4.5:1 sobre crema. Tabla aprobada: https://claude.ai/artifact/Svx9stSZN5vgqwFxotyAHd
2. **Letras: el sistema de diseño tal cual** (decisión de Juanma): títulos Playfair (`--rosanta-font-title`), etiquetas en mayúsculas Poppins (`--rosanta-font-label`), cuerpo Avenir→Lato (`--rosanta-font-body`). Las fuentes ahora cargan en TODAS las páginas (antes solo Profit OS).
3. **Marketing se unificó** (Juanma, 15-oct): **OBSOLETA la decisión del 22-sep** de conservar sus cafés y dorados. El brief impreso ya no cita colores viejos.
4. **Regla nueva: ningún .html escribe un color hexadecimal.** Lo vigilan dos pruebas de 1. Cimientos: "Ningun color suelto fuera de la paleta" (lista `PR_HTML_PALETA_` en Pruebas.js: **un .html nuevo va ahí**) y "Toda variable de color existe en la paleta". Para SVG y Chart.js se usa `RC('--token')` (lo define `paletaCss_`).
5. **Celular (375 px)**, solo CSS: Barra y Sala (tablas que heredaban `table{min-width:640px}`), Tablero (el `margin:0 auto` de `main` cancelaba el estirado en la columna flex — mismo error que Finanzas el 22-sep), campos a 16 px (el iPhone ya no agranda la página), botones de 44 px, encabezado compacto en Profit OS, grillas del reporte en una columna, Marketing. Recetas, Inventarios, Finanzas, Caja y Reporte ya estaban bien (sus tablas se deslizan dentro de la tarjeta). Arreglos de paso: `LecturaEstilo` iba anidado en otro `<style>` y se comía la regla `.lx`; "Anotar compras en efectivo" del panel abría Cocina (ahora Compras) y "Por devolver" abría Pagos (ahora `adm-equipo`). Antes/después: https://claude.ai/artifact/LLwqMRhonrS4Drkz7KbqRQ

**Lecciones:**
1. **Una variable local con el mismo nombre que un token** (`--panel:var(--panel)`, `--ok:var(--ok)`) se anula sola. La prueba nueva no lo ve; se cazó con un barrido aparte.
2. **Capturas del celular:** el navegador de la app no entra al iframe de Apps Script; se ve la página entera poniendo el viewport en 375×2600. Una pantalla alta inventa huecos (la grilla reparte el alto sobrante): confirmar en un alto real. El primer screenshot tras cargar a veces sale en blanco: tomar dos.
3. Tres sesiones publicando a la vez funcionó con una regla: **antes de publicar, bajar HEAD aparte**; esta vez reveló trabajo de otra sesión subido después del "visto bueno" y se publicó solo con su aprobación.

---

## Cierre del 15 oct 2026 (v38): cierres de PosFile, tareas de la Mac destrabadas y latido de reservas en Apps Script

**ACTUALIZACIÓN (15-oct, tarde): producción = @198** = commit `db45694` (en main por el merge `2e45238`, verificada 94/94). Sobre la @197 suma: vista de celular de la sesión de la paleta (aprobada por Juanma en su teléfono), aviso de guardado Guardando/✓/Reintentar en Pagos y Recetas (`GuardadoEstado.html`, `_pagCambios_`, de "Guardados rápidos", aprobado por Juanma) y la tarea 3 (mktReplace y retiros viejos archivados). **Batería sobre db45694, leída en el Chrome de Juanma: 191 OK · 0 fallas · 3 avisos · 2 saltadas = 196, 132.5 s.** El centinela de cierres bajó de 10 a 1 cierre sin cuadrar: se están releyendo solos.

Sesión "Solidez de la intranet, día 3". **Producción: @197** (15-oct, = commit `9858bf3` de la rama `claude/infallible-meninsky-5b49b4`, verificada bajando la versión aparte, 93/93). Lleva el trabajo de TRES sesiones con una sola batería y una sola versión: los cierres y el latido de reservas (esta), Tiempos (cronómetro de guardados, `?page=tiempos` solo dueño, de "Guardados rápidos y visibles") y la paleta única (`PaletaServidor.js`, de "Intranet: una sola paleta y vista en celular", con visto bueno de Juanma). **Batería sobre ese HEAD, leída en el Chrome de Juanma: 190 OK · 0 fallas · 3 avisos · 2 saltadas = 195, 160.6 s** (avisos: equilibrio 7/10, caja contra bancos y el centinela de cierres sin cuadrar). Encima viene `52a4c76` de la sesión de la paleta (solo CSS de celular), sin publicar.

1. **Cierres de PosFile (el "tarjeta Q0 · efectivo Q0" del vigía): era código, no faltaba dato.** Drive exporta el texto del PDF con `\r\n`; el lector del formato nuevo busca los renglones de "Tarjetas" y "Caja (efectivo)" con `[ \t]*(?=\n)` y el `\r` los rompía. Del 1 al 14-oct los 14 cierres quedaron con tarjeta 0, efectivo 0 y CUADRA = NO; el total sí salía (esa búsqueda usa `\s`). Arreglo: `cieParsear_` normaliza `\r\n` → `\n` (commit `7941ac8`). Probado con el texto REAL guardado de los 14 días: los 14 cuadran (13-oct = Q3,129.50 todo tarjeta; 11-oct tarjeta Q1,771 + efectivo Q209 y 12-oct efectivo Q297, iguales a lo que Juanma anotó en Caja chica). Prueba nueva "El cierre de PosFile se lee con los saltos de linea que exporta Drive" (texto real del 11-oct con `\r\n`; con el código viejo da FALLA) + centinela: AVISO si algún cierre guardado de los últimos 10 días no cuadra. **Las filas viejas se corrigen solas al releerse** (filas NO se releen pasadas 20 h; la lectura de las 10:00 cubre 20 días) o con Caja chica › Leer cierres.
2. **Tareas programadas de la Mac: causa EXACTA (registro de la app, `~/Library/Logs/Claude/main*.log`).** No era la app cerrada (abierta desde el 2-oct) ni la Mac dormida (al despertar corre lo atrasado). Era **`Skipping dispatch … global_limit (active=3, limit=3)`**: máximo 3 corridas de tareas activas a la vez y **1 por tarea** (`per_task_limit`). Una corrida que se queda esperando aprobar un permiso ("Not auto-approving Bash … no suggestions on request") o contestar un AskUserQuestion sigue contando como activa días enteros. Desde el 4-oct, miles de saltos; **desde el 13-oct ninguna tarea corrió sola** (solo "Ejecutar ya"); el cierre semanal del 11-oct, el mantenimiento del cerebro del 1-oct y la revisión del jueves 15-oct no corrieron. **Hecho con el sí de Juanma:** (a) 18 corridas viejas archivadas (queda abierta la de Salud del 15-oct); (b) `~/.claude/settings.json` con permisos de SOLO lectura para las tareas (Read/Glob/Grep, git status/log/fetch/diff, ls/cat/find, curl a rosanta.rest/_functions, clasp list-*, lectura de Gmail/Calendar/Drive, PushNotification; respaldo `settings.json.antes-15oct`). **Regla:** una tarea programada no debe preguntar nada; si una corrida queda esperando, archívala o se traban todas.
3. **Latido de reservas web ahora es Apps Script** (`ReservasLatido.js`, prefijo `rlat`): el vigía lo corre a las **8:00 y 14:00** (slots de mañana y pasado, reservaPing, POST /reservar vacío = 400). Correo al dueño si falla (uno por día) + marca `PROC_reservasWeb` en Procesos (max 30 h, racha 6 h). Probado en vivo: 37 franjas · 37 · bot ok · 400. Prueba "El latido de reservas web distingue sano de caido". **La tarea de la Mac `rosanta-latido-reservas-web` quedó APAGADA (Juanma, 15-oct, 12:00).** La primera corrida del vigía es a las 14:00 del 15-oct: si un día falla, llega el correo "Rosanta · FALLA el canal de reservas web"; si el latido deja de correr, avisa Procesos (`PROC_reservasWeb`, 30 h).
4. **Latido del repo → launchd (hecho, 15-oct):** `~/Dev/Rosanta/tools/latido-repo/latido-repo.sh` + `~/Library/LaunchAgents/rest.rosanta.latido.repo.plist` (copia en el mismo folder del repo), todos los días 8:24; si la Mac duerme, corre al despertar. No depende de la app de Claude ni de permisos. Solo mira (fetch, status, log). Si algo lleva >1 día sin guardar o hay commits sin subir: **notificación en la Mac** (no llega al teléfono) y deja `~/.rosanta-sellos/latido-repo.json`, que ahora revisa la tarea "Salud de la intranet" (punto 5) y avisa al teléfono los lunes. Probado con control negativo. La tarea de Claude `rosanta-latido-repo` quedó **APAGADA**. `rosanta-seguimiento-offsite` **APAGADA** (Juanma, 15-oct; estaba encendida aunque el cerebro la daba apagada).
6. **Tarea 3 hecha (después de la @197, en HEAD `cd98dcb`, sin publicar):** archivados `mktReplace` (MarketingDatos.js) y la pantalla vieja de retiros de MedicionDatos (`getRetirosPendientes`, `registrarRetiro`, `leerComprobanteRetiros`, `medPuedeRetiros_`, `_medRet*`, `MED_RET_*`) en `apps-script/_archivo/2026-10-15_mktreplace_y_retiros_viejos/` con LEEME. `TABS_SIN_REPLACE` y `medRetirosMes_` se quedan. La prueba "Solo cocina o el dueño anotan retiros; la Sala solo sala o dueño" ahora vigila que no vuelvan. Parcial finanzas,pauta: 98 OK · 0 fallas. **Publicado en la @198.**
5. **Lectura del CRM** (pedido de "IA Mentor"): Juanma marcó las mesas en Wix el 15-oct, pero a las 9:38 octubre seguía en **35.4%** (17 visitó / 31 histórica; sep 32.1%). **Revisar el lunes 19 en "Salud de la intranet"** si pasó del 50%.

Una primera batería (sobre 853299b) dio 1 falla: "Ninguna funcion publica queda abierta" por `exigirDuenoTiempos_` (guarda propia sin registrar) → agregada a `PR_GUARDAS_PROPIAS_` (`12f9dae`). La de @197 ya salió en 0.

**Lecciones:**
1. **Una prueba con texto "limpio" no prueba el lector**: hay que usar el texto tal como llega de la fuente (aquí, la columna TEXTO_SI_NO_CUADRA de CIERRES_DIARIOS lo guarda).
2. ~~**El candado bloquea falso desde un worktree** cuando el servidor = un commit ANTERIOR al último propio.~~ **RESUELTO (v40):** ahora acepta cualquier versión de la historia de la rama.
3. **`clasp logout` borra `~/.clasprc.json` para TODAS las sesiones.** Avisar antes.
4. Tres sesiones subieron a la intranet en una hora: el aviso entre sesiones + un solo push funcionó.

---

## Cierre del 14 oct 2026, noche (v37): intranet más sólida — @195 y @196, pruebas-node y "Salud de la intranet"

Sesión "Solidez de la intranet, día 2" (la que cruzó PosPauta con la v36: su versión quedó descartada y revertida en su rama).

1. **Candado probado en vivo: funciona.** `false && cd apps-script/rosanta-intranet && clasp pull` salió "Bloqueado". Ojo: el candado NO resuelve variables de shell (`cd $S && clasp pull` lo bloqueó creyendo que bajaba dentro del repo): escribir la ruta completa.
2. **@195 — coma decimal en el lector único.** `_finNumero_` (y `invNumero_`, `psNum_`): la coma es de MILES solo con 3 dígitos detrás y algo distinto de 0 delante (`1,234` · `12,500`); si no, DECIMAL (`12,5` = 12.5 · `0,750` = 0.75). Con punto y coma a la vez, el último es el decimal (`1.234,50` = 1234.5). Caché Finanzas **v17**. Prueba "Un solo lector de numeros" con 13 casos.
3. **@196 — `registrarPrecio` sin área** (`Proveedores.js`): sala podía escribir el precio de COCINA omitiendo el área (el comentario del 14-sep decía haberlo cerrado y no). Ahora, sin área, se exige permiso sobre el área donde cae el producto, y la BITACORA escribe `BANCO DE DATOS · ÁREA`. Centinela en la batería (4. Accesos: "Registrar precio exige el area del producto"). Lo cazaron las pruebas de Node reparadas.
4. **pruebas-node/ (decisión de Juanma: arreglar 4, archivar 5).** Vivas y en verde: `prueba_ventas` (34), `prueba_areas` (27), `prueba_registrarprecio` (26), `prueba_revertir` (42), `prueba_bitacora` (30), con control negativo. Prueban ESCRITURAS contra un simulador de hojas; la batería del navegador solo lee. `DIR` ahora es relativo al archivo (corren en cualquier worktree). Archivadas en `apps-script/_archivo/2026-10-14_pruebas-node/` con LEEME: `prueba_barra`, `prueba_indice`, `prueba_semaforo`, `verif_negativa`, `verif_pruebas` (leían scripts ya archivados). **No corren solas**: se corren con `node pruebas-node/<archivo>` antes de tocar el recetario.
5. **Tarea nueva `rosanta-salud-intranet`** (lunes ~9:15, aprobada por Juanma): code-review de los commits de la semana en la intranet, antigüedad y conteo del sello de batería, correos del Latido/procesos con señales frías y versión en producción contra el cerebro. Solo avisa al teléfono si algo está mal. ~~Pide "Ejecutar ya" una vez~~ **HECHO (Juanma, 15-oct, 9:17).**
6. **Latido del repo: la tarea está sana** (corrida a mano el 14-oct: OK, main al día con GitHub). No corría desde el 8-oct porque las tareas solo se disparan con la app abierta; el Latido de reservas tuvo el mismo hueco (25-sep → 13-oct). El 13-oct, al abrir la app, se pusieron al día el brief y reservas pero el repo no: causa exacta no visible desde las herramientas. **Las tareas de la Mac NO son un vigilante confiable; los vigilantes de verdad son los activadores de Apps Script (Latido, vigía, procesos).**

**Batería al cierre:** @195: 186 OK · 0 fallas · 2 avisos · 2 saltadas = 190. @196: 186 OK · 0 fallas · 3 avisos (los 2 de datos + el calentador lento) · 2 saltadas = 191, 152.8 s. **Producción: @196**, verificada bajándola aparte (89/89).

**Lecciones:**
1. **Un `&&` después de un glob que no existe en zsh corta TODO**: un "0 distintos" salió de una bajada que no ocurrió. Exigir la línea "Pulled N files" en la misma salida antes de creer una comparación.
2. **`git commit --amend` después de un `git revert` fallido enmienda el commit equivocado.** Revisar `git log` antes de enmendar.
3. Una prueba que nadie corre se pudre en un mes (pruebas-node: 12-sep → 14-oct). Lo que importa de verdad se copia como centinela a la batería del navegador.

**Pendientes que deja:**
- **Lectura del CRM ~30%** (vigía del 14-oct): las mesas no se marcan Seated/Finished en Wix. Hábito del salón, no código ni falta en el maestro. **Juanma ya se lo pidió al salón y las mesas se cerraron el 15-oct; falta ver el lunes 19 si la lectura pasó del 50%.**
- El resumen del vigía del 14-oct dice "tarjeta Q0 · efectivo Q0" para ayer con Q2,845 de venta: revisar si `CierresDiarios` lee el PDF del cierre del PosFile nuevo (no verificado).
- ~~Opcional: `mktReplace` y retiros viejos de MedicionDatos~~ **HECHO 15-oct (v38).**

---

## Cierre del 14 oct 2026, noche (v36): la pauta lee el PosFile nuevo (S40 y S41)

**Qué se rompió:** el Latido del lunes 13-oct salió con 100% de error. La señal fría era
**"pauta · POS"**: S40 y S41 no tenían comensales ni ticket en `pauta_semanal` (Sheet Rosanta
Marketing OS). `posActualizarPauta()` (`apps-script/rosanta-marketing-os/PosPauta.js`) solo
buscaba archivos `POS*`/`ReporteVentas*`, y desde el 1-oct-2026 PosFile deja **`ReporteFacturas-DD-MM-YYYY`**.
No falló: actualizaba las semanas viejas y dejaba las nuevas en blanco.

**El arreglo (commit `d9487f7`, en main; Marketing OS en HEAD, verificado bajándolo aparte):**
- Acepta también `ReporteFacturas*`. **Decisión de Juanma: Marketing OS lee el archivo, la intranet NO escribe `pauta_semanal`.** La sesión "Auditar scripts" había propuesto tomar `com`/`tp` de `_finDatos_`, y se descartó.
- Lee igual que `_cargarPOSFacturas` del cargador del maestro, para que los comensales cuadren con `02_Ventas_Maestro`. Solo descarta las facturas **anuladas** ("finalizado" y **"contingencia"** cuentan: S40 trae contingencia en todas). Comensales = `Notas` solo si es un entero (`/^\d+$/`: "1 persona" queda sin comensales). **No filtra `Contable`**: mientras la SAT no reciba, todas dicen "no".
- **El ticket de pauta NO cambió (decisión de Juanma): venta CON IVA y con el 10% de servicio ÷ comensales.** No es el `tp` de Finanzas, que va sin IVA.
- Acepta el prefijo **"Copy of " / "Copia de "**: así quedó en S40 el último ReporteVentas viejo (28–30 sep).
- Los reportes viejos (S1–S39) se leen igual que antes.

**Corrida de Juanma desde el editor (19:36, 18 archivos):** **S40 = 60 comensales, ticket Q353.10** (49 del 1 al 4 de octubre + 11 del 28 al 30 de septiembre) · **S41 = 74 comensales, ticket Q279.70**. El ticket de S40 es alto frente a Q250–300: sale tal cual de las facturas.

**Lecciones:**
1. **`clasp run` tampoco sirve en Marketing OS** ("Unable to run script function"). Lo que el cerebro v33 decía ("`clasp run` funciona en Marketing OS") queda OBSOLETO: Juanma corre la función desde el editor.
2. **Dos sesiones arreglaron lo mismo a la vez.** "Solidez de la intranet, día 2" subió a HEAD su versión de PosPauta, sin commit en main, y filtraba Estado = "finalizado": S40 perdía todo octubre. Se detectó bajando HEAD aparte antes del push, y se coordinó con un mensaje entre sesiones. **El candado solo protege la intranet: en Marketing OS la comparación de HEAD hay que hacerla a mano.**
3. **Si cambia el proveedor de un archivo, hay que revisar a TODOS sus lectores, no solo al cargador.** Esta vez el cargador del maestro se adaptó el 1-oct y el lector de la pauta se quedó atrás dos semanas.

**Pendiente que deja:** el mismo Latido marcó la **lectura del CRM en 36%** (mínimo 50%). Las mesas no se marcan Seated/Finished en Wix. Es un recordatorio para el equipo de sala; mientras tanto, el CAC de octubre no se publica.

---

## Cierre del 14 oct 2026, noche (v35): auditoría de la intranet, 5 fases publicadas (@188 → @194)

Sesión "Auditar scripts de la intranet" (empezó el 9-oct, se ejecutó el 14-oct). Auditoría con 4
sub-agentes (acceso, dinero, código muerto, procesos), re-verificada sobre la @187 y ejecutada en 5
fases + la batería. **Producción: @194** (verificada bajándola aparte, 89/89 = commit `60300c2`).
Todo en GitHub (`6f5fbaf`). Las publicaciones se coordinaron con la sesión "Mejoras a Profit OS" y
la de "Cuadro de caja proposal" (sus @188, @190 y Pagos van mezclados en esta cuenta).

| Versión | Qué trajo |
|---|---|
| @188 | **Seguridad:** Marketing escapa el texto de afuera (`escH/escJ/escUrl`: carritos de Wix, Espía, aprendizajes, campañas, botones por fila); `?page=diag` solo dueño; `generarTokensUsuarios` ya no escribe todos los enlaces en el Log; recibos solo `https://(drive|docs).google.com`. + Profit OS de la otra sesión (auditado: `asignarFacturaACompra` pagaba doble → candado `_pagConCandado_` reentrante, anular primero y pagar después). |
| @189 | **Procesos que avisan** (`Procesos.js`): cada proceso deja marca `PROC_<nombre>` (vigía, calentador, puente, correo del martes, ventas, cierres, FEL); `procAvisar_` manda UN correo al día al dueño si uno no corre o falla seguido; vigía y calentador se cuidan entre ellos y el Latido lo repite como 7ª señal. Vigía reintenta el resumen hasta 3 h; "Sin dato (error al leer)" en vez de omitir; el log del reporte del martes ya no le quita el resumen a los supervisores. Calentador: si algo no queda en caché 2 veces seguidas, espera 30 min. **La carga de ventas ya NO usa el ScriptLock** (marca `ventas_cargando` en caché). |
| @190 | **Números consistentes:** prime cost SEMANAL con el IGSS del mes (igual que el mensual); el DRE suma los meses con gasto y sin venta (`meses_sin_venta_dre`) → lucro del año igual en DRE y Finanzas; CMV del DRE rotulado "sobre la venta total" con la meta de PARAMETROS (se fue el "28–32%" escrito); `_finParamCelda_` lee celdas con formato % y vacías (la usan `_finParametro_` y `tabParametros_`); colchón de caja de PARAMETROS (`_cajaColchonDias_`) y **el tablero pinta rojo bajo el colchón (7), no bajo 3**. Caché Finanzas v15. + arranque Caja chica Q2,676 al 13-oct (otra sesión). |
| @192 | **Limpieza** (la 191 es un duplicado sin usar): archivados `RaaDatos.js`, `SemaforoPrecios.js` (sin activador), `REGENERAR_INDICE.js`, PROMPT_*.txt y ~20 funciones sin llamadas → `apps-script/_archivo/2026-10-14_limpieza_auditoria/` con LEEME. Quedaron a propósito `mktReplace` y los retiros viejos de MedicionDatos. + Posibles pagos "No pertenece" y alias Doorways (otra sesión). |
| @193 | **Año nuevo:** `_finAnioVigente_` — en enero, hasta la primera venta cargada, Finanzas y el DRE siguen en el año anterior (antes quedaban vacíos). **Lector único de números:** `_finNumero_` (acepta q minúscula); `invNumero_` y `psNum_` delegan (idénticos en 16 casos); CierresDiarios conserva el suyo. **Creador de IA: tope 30 usos/persona/día, el dueño sin tope** (`_iaContar_`). Caché Finanzas v16. |
| @194 | **Batería en carriles:** `PRUEBAS_CARRILES_` = [recetario] · [finanzas, cimientos, accesos, pauta] · [modulos, web, sync, inventario, pos], corren a la vez → **~2 min** (antes 5,5–6,6 y se colgaba). `?page=pruebas&grupos=finanzas,web` = CORRIDA PARCIAL (no sella). Prueba "Los carriles cubren cada grupo una vez". |

**Batería al cierre: 185 OK · 0 fallas · 3 avisos · 2 saltadas = 190 pruebas, 129 s.** Avisos de
siempre: equilibrio 7/10 y caja contra bancos (datos), y el calentador lento con los carriles en
paralelo. "Modelo de la pantalla = hojas" a veces sale SALTADA: el recetario sin caché al arrancar.

**Candado, regla nueva (main `ce82c4b`/`6f5fbaf`):** antes de cada `clasp push` de la intranet baja el
HEAD a una carpeta temporal y FRENA si el servidor tiene archivos que la carpeta que sube no conoce
(ni en disco, ni en su último commit, ni en su último push, foto en `~/.rosanta-sellos/push-foto-*.json`).
Pisar solo con el sí de Juanma: `ROSANTA_PUSH_PISAR="motivo" clasp push`. Hook con timeout 200 s.
Nació de que hoy una sesión borró del /dev la Fase 1 de otra. **El sello compara contra el MÁXIMO
histórico (190)**: si una batería revisa menos, pide `--acepto-conteo-menor` con el motivo de Juanma.

**Decisiones de Juanma del día:** tokens `?u=` sin vencimiento (riesgo aceptado); tope IA 30, él sin
tope; publicar fase por fase; la mejora de la batería al final; el CMV del DRE sigue sobre venta
total (decisión del 15-sep), solo se rotula.

**Lecciones:**
1. **Cambiar el cálculo = subir la versión de la caché** (`finCacheClave_`). La v14 vieja mezcló prime nuevo y viejo y la batería lo cazó (K06).
2. **Un cortador de funciones por "primer `}` en la columna 0" se come la función siguiente si la anterior es de UNA línea** (`_finAnio2025_` se llevó `_finBaseAnterior_`; la batería lo cazó en Metas). Verificar lo archivado contra el código vivo.
3. **Una corrida que se queda en "Corriendo…" más de 7 min es el límite de 6 min**, típico con la caché recién invalidada: recargar. Con carriles ya no debería pasar.
4. Los clics del navegador de la app SÍ funcionan en la página de Activadores del editor (no dentro de las web apps).

**Pendientes que deja:**
- ~~**Latido del lunes 13-oct con 100% de error**~~ **HECHO (v36):** la señal fría era "pauta · POS" (S40/S41 sin comensales) y está arreglada. Sigue abierta la lectura del CRM en 36%.
- ~~Pruebas a mano de Profit OS en producción~~ **HECHO (Juanma, 14-oct noche): "todo funciona correctamente"** — pagar 2 juntas y anular; Compras retiro + 3 filas + asignar factura; Caja › Leer cierres; Barra y Sala.
- Precio escrito A MANO en la hoja con coma decimal ("12,5") se lee 125 (siempre fue así; la pantalla de Inventario ya convierte).
- Opcional: `mktReplace` y el bloque viejo de retiros de MedicionDatos (ver LEEME del archivo).

---

## Cierre del 14 oct 2026 (v34): candado de publicación de la intranet

**Dos reglas del CLAUDE.md de Apps Script dejaron de ser solo texto: ahora las hace cumplir un hook.** Está en main (`f6d595e`, en GitHub) y es configuración de Claude Code: no tocó el código de la intranet.

- **`.claude/settings.json` + `.claude/hooks/candado-clasp.py`** (PreToolUse y PostToolUse sobre Bash) hacen tres cosas:
  1. **Bloquea `clasp pull` que baje DENTRO de `~/Dev/Rosanta`**, en cualquier proyecto. Se permite bajar a una carpeta aparte: copiar el `.clasp.json` fuera del repo y hacer `cd` ahí, o usar `-P` apuntando a esa copia. **clasp 3.3 no tiene `--rootDir` en pull.**
  2. **Bloquea `create-version`/`version`/`update-deployment`/`redeploy`/`deploy` de la intranet** (por scriptId) si no hay un sello vigente en `~/.rosanta-sellos/bateria-intranet.json`. Vigente = 0 fallas y posterior al último push registrado. Así se respeta publicar SIN push.
  3. **Anota cada `clasp push` de la intranet** en `~/.rosanta-sellos/ultimo-push-intranet.json`, ya desde el Pre: un push fallido también invalida el sello.
- **El sello se crea SOLO con `.claude/hooks/sellar-bateria.py --ok --fallas --avisos --saltadas --fuente`** y con el conteo REAL que Juanma reporta o que se lee en su Chrome. **Nunca inventarlo ni editarlo para destrabar.** Si el total de pruebas baja frente al historial (`bateria-intranet-historial.jsonl`), se rechaza salvo `--acepto-conteo-menor "motivo"`.
- **Primer sello real (14-oct, 16:55): 183 OK · 0 fallas · 2 avisos · 2 saltadas = 187 pruebas, 252 s.** Avisos: el equilibrio concuerda con el resultado en 7 meses de 10 esperados (el gasto se aparta del presupuesto), y la caja no arranca del saldo de los bancos (falta un estado de cuenta reciente). **Ojo:** el commit `1d45806` (Calentador, 16:53) es casi de la misma hora. Si se subió con push después de la batería, el sello no lo cubre: repetir la batería antes de publicar.
- **Límites:** no ve los push hechos fuera de Claude (la terminal de Juanma, otra máquina). Solo aplica a sesiones abiertas DESPUÉS de que el hook llegó a main. La prueba en vivo quedó pendiente para la primera sesión nueva: `false && cd apps-script/rosanta-intranet && clasp pull` tiene que salir "Bloqueado". Simulado: 20/20.
- **Lecciones técnicas:**
  - **Una sesión abierta NO toma hooks nuevos.** Ni un `settings.json` nuevo ni hooks agregados a un `settings.local.json` existente; se verificó con un registro temporal que nunca se escribió. Se prueban en una sesión nueva.
  - `claude -p` desde la terminal no sirve para eso hoy: "OAuth session expired".
  - `.gitignore` ahora excluye `.claude/settings.local.json`, `.claude/worktrees/` y `__pycache__/`.

---

## Mantenimiento mensual de octubre (v33, 9 oct 2026): lo que pasó del 28-sep al 9-oct

Corrida manual (la programada del 1-oct no quedó registrada). Fuente: memorias de los proyectos, `git log` de `~/Dev/Rosanta`, `list_scheduled_tasks`, la lista de Artifacts y las sesiones. **Al empezar, la copia instalada en `~/.claude/skills/` estaba en la v31 y la fuente en la v32**: hasta hoy Claude Code arrancaba con contexto de dos versiones atrás.

### 1. Intranet: de la @142 a la @168
- **Producción en la @168 (8-oct)** según el último commit (`a63fbd4`: el caché del reporte semanal lleva la huella del motor). Releer `list-deployments` antes de afirmarlo.
- **@141 DRE en su formato original** (9 bloques, `?page=dre`): impuestos = gasto operativo, aguinaldo/Bono 14 en Nómina, eventos en "Otros ingresos". **Un solo punto de equilibrio: el del PRESUPUESTO** (`_finEquilibrioPresu_`, ~Q39.8k/semana). No reintroducir otro.
- **@139 cada KPI vive en UNA pantalla** (su casa); en las demás se quita o es enlace. Antes de agregar un número, buscar si ya vive en otra.
- **@143–@156 reporte semanal para supervisores**: el PDF oficial VOLVIÓ al estilo S38 (Python, routine `rosanta-reporte-semanal` recreada el 28-sep, lunes 16:24, formato v1.1 en `Maestro/Rosanta_Formato_Reporte_Semanal.md`). Del costo solo va **prime cost**. Página 6 = acciones amarradas a METAS. Se manda por correo a Jeffry y José el **martes 12:00** (`ReporteCorreo.js`). Puente por Drive `PuenteReporte.js`. Las acciones de Vanessa (Reservas) y del dueño (Administración) se aprueban en la sección 8, aparte, sin imprimirse (@155). Lo que en la v28–v32 diga que el reporte vive solo en la intranet o que la tarea del lunes se eliminó queda **OBSOLETO**.
- **@157–@160 Pagos a proveedores (p213)**: reemplaza a COMPRAS_2026 desde el 5-oct (queda como historial). Módulo `pagos`; Jeffry confirma cocina y Maco barra. Herramienta "Pagos" en Profit OS, con "Balance del año" por proveedor.
- **@154** comprobantes en Compras en efectivo leídos con Claude. **@161** tarjeta de crédito BI en el cálculo. **@162–@167** Inventarios: por rubro y consolidado del cierre para Contabilidad. **@164** las comisiones de tarjeta salen de Pagos.
- **`clasp run` funciona** (28-sep) en la intranet, el maestro (desde el 5-oct) y Marketing OS *(OBSOLETO: el 14-oct contesta "Unable to run script function" en Marketing OS y en la intranet; ver v36)*: proyecto GCP 512086396641, `--use-project-scopes`. Corre HEAD. Trampa: si solo borraste archivos, `clasp push` no los saca del remoto.

### 2. Finanzas & Data OS: reglas nuevas
- **Todo nativo de Google** (5-oct): nada de `.xlsx`. El espejo sigue generándose porque lo leen el reporte y el harness; no proponer soluciones sobre él.
- **Fuentes crudas solo en `Reportes 2026/SXX/`** (2-oct); `3_Bancos` y `FEL_SAT` son históricas. **No crear carpetas en Reportes 2026**: las del período las crea Juanma (5-oct).
- **Los estados de cuenta se guardan con extensión `.pdf`**: un archivo sin extensión no se puede leer y deja el cuadre a medias (pasó con la tarjeta de septiembre).
- **El BI se carga con `cargador.js` desde un Sheet nativo `BANCO_BI_SXX`** en la carpeta SXX (p233, 8-oct, commit `7357045`): frena si no cuadra al centavo contra los totales del PDF o si hay categorías vacías o nuevas. No volver a escribir `cargar_banco_SXX.js`. BAC y tarjetas siguen fuera del cargador.
- **No código paralelo** (28-sep): extender lo que existe. Se retiró `CargaBanco.js` (@147). Nada de funciones "herramienta" de una sola corrida sin su sí.
- **PosFile cambió de sistema el 1-oct-2026**: `ReporteFacturas` (lo carga `cargador.js` como POS_FACTURAS) y `VentasProductos` (intranet). Sin FEL emitidas mientras la SAT no reciba.
- **Tarjeta de crédito BI 4132** (desde ago-2026) en hoja propia `06_Tarjeta_Credito_BI`. Fuente: captura de Bi Banking.
- **Nómina:** 4 fijos (Jeffry, José, Nadia, Efraín); extras de sala por nombre y de cocina agrupados. La propina de agosto se paga en octubre y se imputa a agosto. La cuenta 974954208 y Tigo 30795252 son PERSONALES de Juanma.
- **p261 (BAC septiembre) CERRADO el 9-oct**: cuadró al centavo contra los PDF del banco.

### 3. Sub-agentes (2-oct)
`auditor-finanzas`, `revisor-marca` y `buscador-drive` en `~/.claude/agents/`. Cuándo se llaman está en `~/.claude/CLAUDE.md`. El revisor es obligatorio antes de entregar cotizaciones y correos a clientes.

### 4. Eventos y cotizaciones
- **Pipeline de Eventos** (artefacto fijado, https://claude.ai/artifact/5PV1npns9aDu9oAGKiD69j, colección `cotizaciones`) es la fuente única del estado de cada cotización (8-oct). Seguimiento con `Procedimiento_Seguimiento_Cotizaciones.md`: 4 recordatorios según la distancia al evento, revisión los jueves (routine `revision-jueves-cotizaciones`). Toda cotización entra como `porenviar`.
- **Precios solo en `~/.claude/skills/rosanta-cotizador/PRECIOS.md`** (8-oct); las memorias no guardan precios.
- **Las cotizaciones 2027 tienen pendiente propio y un chat cada una** (una sesión por cliente en `05_Marketing_OS/Eventos_y_Cotizaciones`).
- Toda cotización lleva portada + "Por qué Rosanta" + cotización, también en inglés (Henry, 2-oct). El 15% de servicio va siempre aparte. Antes de dar algo por abierto, revisar bot, Gmail, Wix y el pipeline (9-oct).
- El SWIFT del BAC solo se manda si el cliente lo pide. **Peskia solo en títulos cortos** (8-oct); cifras y frases van en Avenir. Queda OBSOLETO "Peskia en titulares y cifras" del reporte.
- Consola de respuestas @12 (29-sep): botón 📎 para fotos (carpeta "Contenido para clientes") y enlaces clicables; los videos van como enlace de Drive.

### 5. Morning brief
- **Desde el 9-oct no va nada personal** (PERSONAL, SIC, SoF, salud, entrenamiento): solo Rosanta.
- En la sesión del brief no se trabaja ningún pendiente: se abre una tarjeta por cliente o pendiente en el folder de su proyecto (2-oct).
- **Un chat de morning brief que queda abierto parece bloquear los briefs siguientes** (última corrida registrada: 6-oct). Cerrar o archivar la sesión del brief al terminar.

### 6. Tareas programadas (leídas con `list_scheduled_tasks` el 9-oct)
Recurrentes activas: `morning-brief-juanma` (L–V 6:06), `rosanta-latido-reservas-web` (8:10), `rosanta-latido-repo` (8:24), `rosanta-reporte-semanal` (lunes 16:24, **recreada**), `revision-jueves-cotizaciones` (jueves 8:11, **nueva**), `rosanta-cierre-semanal` (dom 18:20), `rosanta-cerebro-mantenimiento` (día 1, 9:07), `rosanta-reporte-mensual` y `auditoria-meta-ads-rosanta-mensual` (día 3). Apagada: `rosanta-seguimiento-offsite`. De una vez: seguimientos de Daniela Torres (23-oct), Mollie y Clarisa y Porres (24-oct), choque del 20-mar-2027 (28-oct); `rosanta-recordatorio-blogs-7oct` ya corrió y quedó apagada. **Ojo: hay sesiones del recordatorio de blogs que siguen marcadas como "en curso"**.

### 7. Artefactos
Nuevo: **Pipeline de Eventos** (fijado). El tablero `rosanta-seguimiento-semanal` es https://claude.ai/artifact/NoUtgqdF33nzh59zmihGfj, con su fuente en `Rosanta OS/03_Finance_Data_OS/tablero/tablero.html` (movida desde `~/Documents/Claude/Projects/` el 13-oct-2026). Los demás nuevos (I Do It Anyways, Active Living, Sesión Ferrer) son personales. `~/Claude/Artifacts/` está vacía: los artefactos son Artifacts publicados.

---

## Cierre del 28 sep 2026 (v32): el shell de Finanzas dice para qué sirve cada grupo — producción en la @142

**El equipo está en la @142** (28-sep; `list-deployments` releído tres veces, la @142 bajada aparte idéntica al disco, 80 archivos). Va sobre la @141 de la sesión "Inventario de KPIs intranet" y lleva dos cosas de la sesión del tablero global:

- **Rótulos del shell de Finanzas** (`SistemaFinanzas.html`, solo rótulos, `data-sub` intactos). Juanma no entendía "Módulos" en el lateral y "Herramientas" arriba (su propia regla del 27-sep, bien aplicada pero sin decir el criterio). Ahora el lateral es **"Cada semana"** (lo que se sigue cada semana y lleva a una acción: Pulso · Reporte semanal · Caja · Metas) y arriba va **"El año"** (análisis: DRE · El gasto · Mes a mes · Escenarios). "Cómo vamos" pasó a "Pulso" y "La semana" a "Reporte semanal". Se avisó a la sesión dueña de la @141 antes de tocar el archivo y confirmó no tener cambios pendientes.
- **El caché del reporte semanal sigue al motor** (`ReporteSemanalDatos.js`, `_repDatos_`): la llave lleva clave, venta y comensales de la última semana del motor. Antes solo llevaba `finCacheClave_()`, que es una VERSIÓN del motor y no un sello de datos, y el motor se refresca solo cada 3 h bajo la misma llave: el lunes 28 el reporte quedó cacheado en S38 con el motor ya en S39.

**Reglas que dejó el lunes:**
- **Los lunes la batería puede dar fallas de datos en movimiento**: el cargador de las 10:00 mete el domingo y la "última semana" cambia durante la corrida ("Las ventas del año se leen igual que el cálculo", K06 en "El tablero global no calcula"). Repetirla antes de buscar un bug; la segunda corrida las limpió.
- **La batería tarda 324 s con 175 pruebas, cerca del límite de 360 s.** Si crece, partirla en dos corridas; si no, se corta sola y parece rota.
- El PDF del reporte se genera en el servidor (`?page=reporte-semanal-pdf&semana=CLAVE`, botón "Guardar PDF en Drive", @128, v28); el reporte viejo en Python quedó archivado el 27-sep en `_Archive/2026-09-27_Reporte_Semanal_Python` y la tarea del lunes se eliminó (ocho routines).

---

## Cierre del 27 sep 2026, noche (v31): se retira el cotejo A/B

**Decisión de Juanma (27-sep-2026): el cotejo A/B se elimina.** `generar_finanzas.py` repetía en Python, sobre el espejo `.xlsx`, el mismo cálculo que la intranet hace sobre el Sheet nativo, para comparar los dos. Se retira porque era un **segundo motor**: cada regla nueva (9, 10 a 15, servicio) había que programarla dos veces, y casi nunca se corría completo (p196 existía porque la última vez solo se corrió la mitad Python). Es el mismo criterio que retiró los dashboards y el reporte semanal en Python.

- Archivado en `~/Dev/Rosanta/scripts/maestro-finanzas/_archivo/2026-09-27_cotejo_AB_retirado/` con `rutas.py` y el README viejo (última referencia medida: 23-sep). Commit `20ada38`. En la carpeta quedan `extraer_proveedores.py`, `medir_doble_conteo.py` y `p96_2026-09-15/`, que no dependen de él.
- **La única comprobación de los números del pilar 3 es la batería de la intranet** (`?page=pruebas`). Lo que se pierde, dicho claro: si una regla del motor tiene un error de lógica que ninguna prueba cubre, ya no hay un segundo cálculo que lo delate.
- **OBSOLETO desde hoy** todo lo que en este cerebro diga "`generar_finanzas.py` es el validador A/B", "intranet y Python dan lo mismo al centavo", o que una regla nueva hay que escribirla también en `casar_pagos()`. **No revivirlo sin una decisión nueva de Juanma.** Cerrados con esto p196 (la mitad de intranet del A/B) y p192 (pago agrupado de la regla 15, ~Q777).

**Otros hechos del mismo cierre, para no re-investigarlos:**
- **El conector de Google Drive YA TRAE el nombre de cada pestaña de un Sheet.** `get_file_metadata` con `snippetVerbosity: "MAX_ALLOWED"` devuelve cada pestaña como `# AAAA-MM` con su contenido (verificado en Planilla 2026: las nueve, con su Sub total; ago Q31,450, sep Q25,050). Queda OBSOLETA la regla del 23-sep que decía que el conector concatena sin nombres. La tarea del día 3 (`rosanta-reporte-mensual`, paso 2) ya lee por nombre de pestaña (p181 cerrado).
- **`01b_FEL_Emitidas` tiene el mismo desfase de zona horaria de p120:** 529 de 748 facturas guardadas a las 23:00 del día anterior (espejo del 21-sep). No mueve ningún número: el motor de la intranet no lee esa pestaña. Las FEL emitidas de enero a septiembre 2026 están en `03_Finance_Data_OS/Bancos_y_Conciliaciones/FEL_SAT/01_FEL/FEL_2026` (1T, 2T, 3T y zips de ene-mar); la pestaña del maestro arranca en junio y eso no es un faltante.
- Decisiones de Juanma en el tablero: EEGSA jul-ago **pagado**; lo de EX Security eran **pagos pendientes** y lo de Edwin Flores un **pago adicional** (no son pagos de más); p96 (brecha de food cost) y p122 (camino al piso) salen del tablero porque los vigilan la intranet y el vigía; queda p88 (detalle de retiros de cajero).
- **El equipo está en la @138** (27-sep, noche; batería 170 OK · 0 fallas · 1 aviso · 3 saltadas; la @138 bajada aparte es idéntica al disco, 78 archivos). Lleva: el tamaño `-1` de Meta como "sin dato" en la captura de pauta; piezas y propuestas del Marketing OS fila por fila (ya **ninguna** pestaña se reemplaza completa: `OS_MAP` vacío y `mktReplace` las rechaza); lista blanca `SRV_PERMITIDAS` en `srv()` de Marketing (16 funciones, sin `mktReplace`); pruebas del recetario al día, que ahora **solo fallan si el conteo baja** (pre-elaborados 50, platos con CMV 30).
- **TODO EL CMV ES SIN IVA, TAMBIÉN EN LAS HOJAS** (decisión de Juanma, 27-sep): `CMV_SIN_IVA.js` reescribió y verificó 210 fórmulas (cocina: 34 CMV de ficha, 38 sugeridos, 35 del RESUMEN; barra: 27 + 27 + 24 de ESCENARIO + 24 de VENTAS) y se archivó en `apps-script/_archivo/2026-09-27_cmv_sin_iva`. El precio sugerido de la hoja es ahora **precio de carta con IVA** a la meta de PARAMETROS. `CrearFicha` ya crea fichas así. Queda sin tocar el INDICE de barra (texto fijo). El control de la Ensalada Rosanta es 17.2 porque el aguacate subió de Q1.50 a Q2.00 en el Banco.
- **El desplegable de funciones del editor de Apps Script NO responde a la automatización** (Claude in Chrome: ni clic, ni teclado, ni selección por DOM). Se puede correr la función que ya esté seleccionada; para elegir otra, lo hace Juanma. Y `clasp push` no borra un archivo remoto si nada más cambió: hace falta un cambio real en otro archivo.
- Web: el parche de hreflang se **apagó** (no borró) en home, gift-ideas, events y reservas; verificado en vivo, un solo juego de etiquetas por página. `faq` sigue encendido. Outreach a blogs enviado el 27-sep **sin mencionar TripAdvisor** (decisión de Juanma: los correos a terceros no citan la nota ni las reseñas de TripAdvisor).

---


## Cierre del 27 sep 2026, noche (v30): Sistema de Medición, Visión 2027, vigía y la intranet reordenada — producción en la @137

Sesión larga "Objetivos organizacionales únicos para Rosanta". Empezó como inventario de metas de los 7 pilares y
terminó con el sistema de medición montado en la intranet, un vigía que avisa solo y la navegación rehecha.
**Producción: @137** (verificada contra el disco, 78 archivos). Volver atrás = `clasp update-deployment
AKfycby814… -V 136`.

### 1. Los documentos que mandan

- `02_Management_OS/2026-09-27_Sistema_de_Medicion_Rosanta.md` — **EL plan**: 22 números en 4 niveles, metas
  realistas y programa. `2026-09-27_Objetivos_Organizacion.md` queda como diagnóstico.
- `01_Business_Fundamentals/2026-09-27_Vision_2027.md` — **Visión 2027, aprobada**: *"En 2027 Rosanta se paga
  sola. Cubre todos los meses el costo de vida de su dueño, devuelve lo invertido a Raúl, hace de los eventos su
  segunda línea de negocio y funciona una semana completa sin Juanma, sin bajar la experiencia de mesa ni la
  cocina de temporada."* Q2.10M · piso 12 de 12 meses · Raúl Q100k el 15-mar-2027 · eventos 15% del ingreso ·
  food 28 / EBITDA >10 / caja 21 días · ensayo sin Juanma en **junio 2027**, semana completa desde el
  **18-oct-2027** · **reseñas NUNCA bajo 4.8★** (piso duro de Juanma).
- Metas 2026 (pestaña METAS, instalada): oct Q142k venta (mínimo Q140k, no cruzar cero) · nov Q154k · dic
  Q205k; comensales 580/630/800; ticket Q245 → Q255 en dic; food cost por tramos ≤36/36/34/33 hacia 28; brecha
  ≤5/5/4/3. **El piso = Q18,896/mes** = retiro Q5,000 + alquiler US$1,800 (costo de vida de Juanma).
- **Control y ajuste (§4.3bis):** una meta sube tras 3 meses en verde (al promedio, un escalón como máximo);
  baja solo tras 3 meses en rojo Y pasando 3 filtros (dato, acciones, premisa). **Anclas que no se mueven por
  desempeño:** food cost final 28/20, el piso, 4.8★. Recalibración: **15-nov**; curva 2027 en METAS el **15-ene**.
- Mapa visual del sistema (artefacto): https://claude.ai/artifact/5MoLGBuVjUw3Jfv4cKQt6Y

### 2. Reglas de Juanma que salieron hoy (no reabrir)

1. **Quién ve quetzales:** el equipo NO ve montos, caja ni EBITDA de la visión ni de la Cascada (el piso es el
   costo de vida personal de Juanma). **Chef y sala leen su lectura sin quetzales.** Los montos de su área en
   el reporte (compra, costo, margen) sí, porque es el documento de la reunión con los jefes.
2. **Vigía solo por correo.** WhatsApp apagado (Meta rechazaba la plantilla como Utilidad). Se enciende con la
   propiedad `VIGIA_WHATSAPP = SI` si algún día hay plantilla aprobada. **No reproponerlo sin que Juanma lo pida.**
3. **SPLH no se mide.** Tampoco rotación de mesa (ya estaba).
4. **Las mesas NO salen del cierre diario de PosFile**: solo del reporte semanal.
5. **Profit es cocina Y barra juntas.** José es dueño de la barra (y de sala); Jeffry, de cocina.
6. **Navegación de TODA la intranet: los MÓDULOS en la barra lateral izquierda** (molde `.sm-side` del Sistema
   de Marketing) **y las HERRAMIENTAS en la barra de arriba.** "Cada uno tiene su propio intranet": el lateral
   muestra solo lo del rol.
7. **Sala y Compras en efectivo son secciones internas de Profit, no sistemas de Rosanta OS.**
8. "Si Juanma dice algo distinto al cerebro, gana Juanma" (regla que ya existía, reafirmada).

### 3. Lo que quedó en la intranet (todo publicado en la @137)

- **Tablero global** (`?page=tablero`, dueño): lateral = los 6 pilares (01 Cascada … 06 Expansión); arriba =
  **Metas y ajustes** (instalador, tabla METAS, vista previa de ajustes, panel del vigía) y **Reporte semanal**
  (el reporte ENTERO sigue ahí y en el PDF: es el documento de la reunión). Visión 2027 arriba de la Cascada y
  del panel principal.
- **Cada pilar se lee con el molde del reporte semanal** (`LecturaJs.html`): pregunta y número · ruta con gráfico
  · qué lo mueve · con qué no contamos · qué hacemos esta semana. Está en el tablero y arriba de Finanzas, Profit
  OS, Marketing y Sala.
- **Una sola lista de acciones:** pestaña `ACCIONES` de la config (el reporte ya no usa REPORTE_ACCIONES). El
  vigía escribe acciones **"sugeridas"** que Juanma aprueba o descarta los lunes. Hay 4 sugeridas sin aprobar
  (S39: caja, food cost, retiros, reseñas).
- **Profit OS** (`?page=costeo`, arriba dice "Profit OS"): lateral = **Profit OS** (Inicio: *"¿Se nos va la plata
  en la mercadería, cocina y barra?"*, con el food cost de cada área) · **Cocina** (chef y dueño: food cost,
  compra contra techo y platos de cocina + **Compras en efectivo**, los retiros de cajero) · **Barra y Sala**
  (sala y dueño: **Sala** con mesas por cerrar en Wix, reseñas y huddle + comensales y reservas + barra).
  Arriba: Ingeniería de menú · Inventarios · Recetas · Productos · Proveedores · Higiene · Cómo funciona, más el
  selector Cocina/Barra/Todo. `?page=sala` y `?page=retiros` ya no existen como pantallas: **redirigen** a
  `?page=costeo&vista=barrasala|cocina` (el correo del vigía y los enlaces viejos siguen sirviendo).
- **Finanzas:** lateral = Cómo vamos · **La semana** (secciones 1, 2, 3, 7 y 8 del reporte: venta, cuatro
  semanas, ritmo, personal y P&L, equilibrio y acciones) · Caja · Metas; arriba = El gasto · Mes a mes ·
  Escenarios.
- **Reporte repartido:** secciones 5-6 (food cost, compras, platos) por área en Profit OS; sección 4 (comensales
  y reservas) en Barra y Sala. `getReporteArea(auth, clave, area)` (módulo recetario + rol) recorta sin P&L,
  equilibrio ni venta del día. `ReporteSemanalJs` se pinta varias veces en una página con
  `RP_INICIAR(cfg, raiz)`.
- **Marketing:** la franja "Mi palanca" se reemplazó por la lectura del pilar (`getLecturaPauta`).
- Ticket (`tp`) = venta de los tickets con comensales ÷ comensales. Retiros de cajero = descripción del banco
  que empieza con ATM, RETIRO, A- o F- (agosto: 18 por Q21,800; septiembre: 11 sin detalle).

### 4. El vigía (`Vigia.js`) y los cierres de PosFile (`CierresDiarios.js`)

- Activador cada hora `vigiaCadaHora`. Destinos en `VIGIA_DESTINOS`: Juanma 7:00 L-V · Vanessa lunes 9:00 ·
  Jeffry y José 12:00 L-D. Reglas V1–V12 (V11 = falta cierre de PosFile; **V12 = reseñas bajo 4.8★, urgente a
  Juanma y José**). Registro en `VIGIA_LOG`.
- **Cierres diarios:** lee el PDF de `noreply@posfile.com` ("Cierre de Caja") con el servicio avanzado de Gmail
  → pestaña `CIERRES_DIARIOS`. Suma a la venta del mes los días que la carga del lunes todavía no trae, **sin
  duplicar** (el 20-sep coincide exacto con el maestro: Q4,191 · Q3,810 · Q381). **CUADRA = las formas de pago
  suman el gran total**; las filas que no cuadran se releen solas. 34 días guardados (18-ago a 20-sep).
  **PosFile está caído desde el 20-sep** (el proveedor lo está arreglando).
- **LECCIÓN, costó media hora:** para usar Gmail avanzado NO basta el scope en `appsscript.json` y la
  autorización en el editor: **la Gmail API se habilita en el proyecto de Google Cloud 512086396641** (Juanma
  lo hizo el 27-sep). Y el adjunto llega en un formato que `base64DecodeWebSafe` no lee ("Could not decode
  string" en 38 de 38 correos): se decodifica con `_cieBytes_`.

### 5. Reglas técnicas nuevas

1. **Dos sesiones comparten la carpeta `rosanta-intranet`** (hoy: la de inventarios). Un `clasp push -f` sube
   TODO el disco, incluido el trabajo ajeno sin commit; y otra sesión puede publicar lo tuyo (la de inventarios
   publicó la @136 desde HEAD con toda la tanda de medición adentro). Antes de subir: bajar HEAD y compararlo
   con lo último verificado, **encadenando con `&&` y no con `;`** (hoy el `;` dejó seguir el push aunque la
   comparación había mostrado cambios). **No commitear archivos de otra sesión** (se deshizo con
   `git reset --soft`).
2. **Una página de la intranet dentro de otra (iframe) no funciona en /dev**: Google contesta "refused to
   connect". En `/exec` sí (así funcionan los shells de Finanzas y Marketing). Para contenido nuevo, pintar dentro
   de la página.
3. **Los clics del navegador de la app tampoco llegan dentro de las páginas de Apps Script** (igual que con
   Claude in Chrome): los botones de la intranet los aprieta Juanma. Sí sirve para la consola de Google Cloud.
4. **Los activadores corren el código de HEAD**, no la versión publicada: un arreglo subido a /dev ya lo usa el
   vigía de la mañana siguiente.
5. **Maqueta local para ver una pantalla antes de subirla:** evaluar la plantilla con un mini-evaluador en Node,
   simular `google.script.run` con los datos del arnés y servirla con `.claude/launch.json` (`maqueta-intranet`,
   python http.server en el scratchpad). Así se revisaron Profit OS, Finanzas y el tablero.
6. **La hoja `Rosanta_Intranet_Config` muestra los tokens de acceso de todo el equipo** (pestaña USUARIOS):
   quien tenga la hoja puede entrar como cualquiera. No compartirla; no repetir tokens en chat.

### 6. Pendientes que deja

- **Aprobar o descartar las 4 acciones sugeridas del vigía** (tablero › cada pestaña › qué hacemos esta semana).
- **Reseñas:** las últimas 4 semanas promedian **4.4★**, bajo el piso de 4.8 (Google muestra 4.8 total). El
  vigía ya avisa a Juanma y José.
- **Caja:** con el banco cargado, el escenario base habría cruzado cero el 26-sep; cargar el estado de cuenta.
- POS cargado solo hasta el 20-sep; food cost semanal por área necesita las ventas por plato de la semana.
- **PARA EL 28-SEP (Juanma lo pidió): trabajar juntos los 11 retiros de cajero de septiembre sin detalle**
  (Q17,000; acción V5-retiros, dueño Jeffry, en Profit OS › Cocina › Compras en efectivo). Arrancar por ahí.
- Acciones del vigía, estado al cierre: **V4-food la está trabajando cocina** (aprobarla en 04 Profit);
  **V12-reseñas también en marcha** (el equipo ya trabaja la recolección de reseñas; aprobarla en 02 Management);
  V2-caja explicada a Juanma (la alarma sale de un banco viejo: BI al 6-sep, BAC al 31-ago).
- Recalibración de metas el **15-nov**; curva de METAS 2027 el **15-ene-2027**.
- K08 comisión de tarjeta: ya hay T-Crédito diario en `CIERRES_DIARIOS` para cruzar contra los depósitos del
  banco (no construido).
- **OBSOLETO de la v26:** "filas de PARAMETROS y pestaña METAS" y "meta de food cost 26 contra 28/20": ya
  resuelto (METAS instalada; 28/20 con tramos).

---

## Cierre del 27 sep 2026, tarde (v29): la pauta decide con hechos; el Panel de Asesores se retira

### 1. Lo que se publicó en la @131 (27-sep, mañana), que ninguna versión del cerebro tenía

- **Sistema de decisión de pauta** (`PautaSistema.js`, commit 1056076), pestaña **⚖️ Decisiones de pauta**
  de Marketing. Proceso **sin juicio de IA** (decisión de Juanma): hechos → validación → reglas → **UNA
  decisión por semana** → aprendizaje. Pestañas propias en la Sheet del Marketing OS: `hechos_semana`,
  `pixel_semana`, `estados_semana`, `reglas` (umbrales, los edita solo el dueño), `supuestos`
  (verificado / por_verificar / falso) y `bitacora_pruebas`. **A propósito NO están en `SCHEMA`**, para
  que `mktReplace` no las pise. Activador semanal `psCapturaLunes` (se crea a mano en Editor ›
  Activadores). Batería: grupo "9. Sistema de pauta" en `PruebasPauta.js`.
- **Sistema de Medición v1** (commit 3c2cd87): franja **"Mi palanca"** arriba del Dashboard de Pauta
  (`MedicionDatos.js › getMiPalancaPauta`), roles pauta y dueño. Plan en
  `02_Management_OS/2026-09-27_Sistema_de_Medicion_Rosanta.md`: **el número de Marketing es COMENSALES DEL
  MES** (dueño Juanma; oct 580 · nov 630 · dic 800). Palancas de Vanessa: **clientes nuevos** (oct 40 ·
  nov 50 · dic 55) y **CAC ≤ Q60**, publicado solo con lectura de Wix ≥ 50%. **"Reservas atribuidas"
  quedó DESCARTADA como North Star: no se puede medir.**
- **El 🧠 Diagnóstico IA se retiró**: recomendaba escalar con CTR y CPC sin ver una sola reserva.
- La @131 se publicó sin abrir /dev ni correr la batería en el servidor (decisión de Juanma).

### 2. Tarde: tres commits en git, subidos a HEAD, SIN publicar

Commits `0f2dc6f`, `acd6b3d` y `beec65e`. `clasp push` verificado bajando HEAD aparte. **Producción
sigue en la @131** hasta que Juanma corra la batería en /dev y diga sí. Informe:
`apps-script/_informes/2026-09-27_Pauta_verificacion_congruencia_retiro_Panel.md`.

1. **Panel de Asesores RETIRADO COMPLETO, lentes incluidas** (decisión de Juanma): fuera la pestaña 🧠, los
   debates, `panelInvestigar`, el **AI CMO** ("Regenerar con aprendizajes" de la Estrategia) y las
   constantes `LOOMER`/`SAVANNAH`. Razón: el sistema de decisión decide con hechos y reglas y el Sistema
   de Medición fija las metas; cualquier "opinión experta" aparte es una **tercera voz que contradice a
   las otras dos**. `debates` salió de `SCHEMA`; su pestaña **queda como historial OBSOLETO, no se borra**.
   La Estrategia quedó como documento fijo que apunta al Sistema de Medición. **NO construir nada sobre el
   Panel ni reponer lentes con nombre de experto.** La sesión "Panel de asesores de marketing" quedó vieja.
2. **Estándar creativo de pauta de Rosanta** (`ESTANDAR_PAUTA` en `Marketing.html`): el Creador de pauta
   sigue (produce anuncios, **no decide dinero**), pero como **regla de la casa sin nombres de personas**,
   igual que Kaprica para el orgánico. Método: gancho de 3 s, video nativo UGC, el creativo es la
   segmentación, iterar sobre ganadores, conceptos distintos (regla Andromeda). A cámara solo **Jeffry,
   Maco o clientes reales**. Los números de "qué medir" **ya no están en el prompt**: salen de `reglas` y
   solo de supuestos **verificados** (`psContextoCreativo`); el hook rate no se pide mientras
   `s_definicion_video` esté por verificar. Cada concepto trae **"Registrar como prueba"** → bitácora como
   *propuesta*; **una prueba en curso a la vez y solo el dueño la arranca**. El Creador lee como contexto
   solo aprendizajes con fuente `prueba`. **Decidido: no hay skill local `rosanta-pauta-creativa`**; si
   algún día hace falta, lee la constante del repo en vez de copiarla.
3. **La decisión se amarró al Sistema de Medición:** ESCALAR (R3) ahora pide volumen (`reservas_min_escalar`
   = 6), reservas de Wix ≥ su base, **comensales de la semana ≥ ritmo de la meta del mes** y, con lectura
   ≥ `lectura_min_juez` (50%), clientes nuevos al ritmo de su meta. **Sin meta de comensales en METAS no
   se escala.** Métricas juez: entra `clientes_nuevos_negocio` (rechazada con lectura < 50%), **sale
   `reservas_atribuidas`** (queda como diagnóstico). Motivo: con ~17 NewReservation por semana en la cuenta,
   por conjunto son 0-2 y "subir dos semanas" era ruido. `MedicionDatos.js` **no se tocó**: solo se leen
   `medMetasMes_`, `tabParametros_` y `crmAltasPorMes_`.

### 3. Hallazgos y pendientes

- **La captura nunca escribió:** al cierre, `hechos_semana` y `pixel_semana` tenían solo el encabezado.
  Pendiente: que Juanma presione "📥 Capturar semana" y confirme filas.
- Activador `psCapturaLunes`: sin confirmar (solo se ve en el editor).
- `debates` tenía un debate **del mismo 27-sep**: el Panel se seguía usando el día que se retiró.
- La pestaña `aprendizajes` tiene 3 filas de agosto con fuente "Panel de Asesores / AI CMO": se quedan como
  historia; el Creador no las lee, el Plan del mes todavía sí.
- Arnés nuevo: `tools/harness-intranet/harness-pauta.js` corre el grupo 9 y las guardas de srv() en Node
  sin datos (26 pruebas del grupo 9, todas OK). Marketing quedó con 26 llamadas `srv('…')` (mínimo 10).
- Aviso para Vanessa redactado en el informe (Diagnóstico IA retirado + instructivo de ⚖️ y "Mi palanca"):
  **no se ha enviado**.

---

## Cierre del 26 sep 2026 (v28): el reporte semanal vive en la intranet, publicado en la @126 y la @127

**27-sep: @128** (el PDF desde el servidor y el botón "Guardar PDF en Drive" en producción; 68 archivos, idéntica al disco). **Tarde del 26-sep: @127.** Juanma revisó la @126 y pidió cuatro cosas, más una nueva; todo salió en la @127 (batería 128 OK · 0 fallas · 4 avisos; 67 archivos, idéntica al disco):
- **El reporte ya no va en iframe:** tres parciales crudos sin scriptlets (`ReporteSemanalEstilo`, `ReporteSemanalCuerpo`, `ReporteSemanalJs`) que pegan con `incluirCrudo_` tanto `ReporteSemanalVista` como la pestaña del tablero. Cada página declara `window.RP_CFG` (token, urlBase, embebido) antes del JS; ids con prefijo `rp-`. En el tablero el botón es "Abrir para imprimir / PDF" y "Actualizar" llama `RP.recargar(true)`. Los tres parciales están en las tres listas `VISTAS` de `Pruebas.js`.
- **Gráfico de cuatro semanas:** barras y línea del equilibrio en la misma escala (140 px sobre un área de 170), etiquetas en fila aparte. `.rp-barra` estaba definida dos veces: ahora `.rp-cab` (cabecera) y `.rp-col` (columna).
- **Compras contra su techo (pedido de Juanma):** en la sección 5, por área y para las cuatro semanas, compra del motor contra techo = venta del área × meta, barra en rojo si se pasó, y la **venta extra que exige** el exceso (× 100 ÷ margen de contribución, hoy ×1.99). La venta por área de cada semana sale de UNA lectura de VENTAS x PLATO sobre las cuatro semanas (`ventasDelRango_` devuelve ahora `fecha` por línea). Caché `rep_sem_v2_`. En la S38: cocina +Q2,091 sobre el techo (exige Q4,160 de venta), barra +Q161.
- **La S37 no tenía PDF** en `Reportes 2026/S37`: era dato, no código. Se generó la noche del 26-sep con lo de abajo.

**Noche del 26-sep: el PDF del reporte sale del servidor (`ReporteSemanalPdf.js`).** Juanma pidió "Genera el PDF de la S37 en su carpeta". El generador viejo (`Maestro/generar_reporte_semanal.py`) tiene todos los números de la S38 escritos a mano: alimentarlo para la S37 habría sido un segundo motor. Ahora `_repHtmlPdf_(d)` arma el HTML estático de las 8 secciones desde `_repDatos_` (tablas simples; las barras son bordes de ancho %, porque el conversor de Apps Script ignora los fondos de celda), `Utilities.newBlob(html).getAs(PDF)` lo convierte y `_repPdfGuardar_(clave)` lo guarda con Drive v3 en `Reportes 2026/SXX/Rosanta_SXX_AAAA.pdf`, **archivando el anterior en `SXX/_Archive` con fecha** (nada se borra) y borrando el caché `tab_docs_v1`. Entradas: `generarPdfReporteSemanal(auth, clave)` (dueño) y la ruta **`?page=reporte-semanal-pdf&semana=CLAVE`** (clave = año×100 + semana ISO, p. ej. 202637), que es el destino del botón **"Guardar PDF en Drive"** de la pantalla y del tablero. Prueba: "El PDF del reporte semanal se arma desde el servidor con los datos de la pantalla" (8 secciones, la venta, `%PDF`; no escribe en Drive). `Rosanta_S37_2026.pdf` quedó en su carpeta: 6 páginas, S37 07/09–13/09, ventas Q27,628, PE Q34,052 (mc 45.3% con la móvil de esa semana), cocina +Q6,699 sobre el techo. **27-sep-2026, decisión de Juanma ("elimina el reporte y todos sus componentes"): el reporte viejo se ARCHIVÓ entero en `Rosanta OS/_Archive/2026-09-27_Reporte_Semanal_Python/` (el Python, `Rosanta_Formato_Reporte_Semanal.md`, el SKILL.md de la tarea y la skill `rosanta-reporte-semanal-formato`, con LEEME) y la tarea del lunes `rosanta-reporte-semanal` se eliminó del programador. Son OCHO routines desde entonces. El único reporte semanal es el de la intranet; su PDF sale de `?page=reporte-semanal-pdf`.** Cuando la extensión de Chrome se cae, el navegador propio de la app sirve si Juanma inicia sesión en el panel: `navigate` y `screenshot` funcionan; `get_page_text` no ve el iframe.

**El equipo estuvo en la @126** (verificado: `list-deployments` releído tres veces y la @126 bajada aparte idéntica al disco, 64 archivos). Batería sobre ese HEAD: **127 OK · 0 fallas · 5 avisos · 3 saltadas** (237 s). Commits `c0a0cb7` y `a03479b` en `rosanta-os/main`. Informe: `apps-script/_informes/2026-09-25_Tablero_global_etapa2.md` (secciones @125, corrección y @126).

### 1. Qué cambió: el reporte semanal ya no es solo el PDF

Juanma (25-sep): "Yo no quiero ver el pdf. Quiero mover el artefacto completo a esta sección y agregar la descarga del pdf para poder enviar al equipo." Y sobre las reglas: "Usa las reglas de la intranet".

- **`?page=reporte-semanal`** (módulo finanzas; `&embed=1` sin cabecera) y la **séptima pestaña "Reporte semanal" del tablero global**, que lo embebe y debajo pone las tarjetas de descarga de `Reportes 2026 / SXX / Rosanta_SXX_2026.pdf` (para mandar al equipo).
- **`ReporteSemanalDatos.js`** arma las 8 secciones del formato S38 **con los motores, sin calcular aparte**: semana de `getFinanzasData` (selector de 12 semanas), serie diaria de `02_Ventas_Maestro`, reservas de la pestaña `reservas` del Marketing OS, platos por `ventasDelRango_` (venta de área ÷ 1.12, top 6 + otros), food cost por área contra `metasFoodCost_()`, personal (labor, planilla del mes), P&L del mes y acciones en la pestaña `REPORTE_ACCIONES` del config (se crea sola al guardar la primera; responsables = departamentos, nunca nombres). Caché `rep_sem_v1_…`, botón Actualizar, Imprimir/PDF con `window.print`.
- **`ReporteSemanalVista.html`**: 8 secciones en el orden del S38, formulario de acciones, CSS de impresión. Dos pruebas nuevas en `PruebasFinanzas.js` ("El reporte semanal en vivo cuadra con la semana del motor": Σ días = venta de la semana y comensales; "El tablero encuentra el reporte semanal y el plan de Meta Ads en Drive").
- **Marketing OS**: la pestaña 05 del tablero muestra los planes `Plan_Meta_Ads_*.docx` de la carpeta de planes (la auditoría de Meta Ads como puntaje sigue sin fila: pendiente `AUDITORIA_META`).

### 2. El equilibrio semanal se arma con el PRESUPUESTO (decisión de Juanma, 26-sep: "sí, por presupuesto")

La @125 mostraba **Q155,894 por semana**: salía del equilibrio mensual del motor del último mes cerrado, y agosto tiene margen de contribución 8.3%, así que el cociente explota. Es coherente mes a mes pero no sirve como vara semanal. **Desde la @126**: fijos del PRESUPUESTO del 22-sep (Inmueble Q20,212.50 · Nómina Q29,000 · Tarifas Q6,600 · Prestadores Q5,500 · Marketing Q5,700 = Q67,012.50 al mes, con el mes si lo trae) ÷ 4.345 semanas = Q15,423; variables = filas %venta del presupuesto (comisiones 6.5, propinas 4.24) + mercadería con la **móvil de 4** (Σcompra ÷ Σventa de las 4 semanas). Margen 50.3%, **PE Q30,641 por semana**. El PDF de la S38 traía Q35,097 con su propia estructura; el mensual del motor queda como referencia en la sección 8.

### 3. Lo que quedó abierto

- **Reservas S38: 13 canceladas de 14** en la pestaña `reservas`; el PDF decía 4 de 14. La sección 4 muestra el desglose por estado (canceladas = CANCEL, DECLIN, NO SHOW; sin cerrar = RESERVED). **Cerrado el 26-sep: son dato real, Juanma mismo canceló esas reservas en Wix después del PDF. El criterio de estados queda como está.**
- **PDF desde el servidor** guardado en la carpeta SXX (decisión "me parece bien, recomendado"), personal extra por semana pagada, comisión de tarjeta separada (K08 FALTA DATO), y retirar después la tarea del lunes que hace el PDF con Chrome headless.
- **Las 16 filas de `PARAMETROS` ya existen (Juanma las pegó el 26-sep):** las 13 con su defecto más `meta_venta_anio` 1,950,000 (real ene–ago + curva H2), `compra_sin_factura_max_pct` 40 (el año va en 45%; bajar a 30 en enero) y `cac_max_q` 60 (CAC del año Q53.6). Batería: 128 OK · 0 fallas · 4 avisos, "todas en PARAMETROS". Sin fila todavía: `comision_tarjeta_max_pct` (K08), `resenas_rating_meta` (K18), la pestaña `METAS`. El resto de decisiones de la v26 §4 sigue.

### 4. clasp vuelve a morir cada día

`invalid_rapt` apareció el 25 y otra vez el 26 (credenciales de la noche anterior). Es la política de reautenticación del Workspace, no un error de clasp. La cura es siempre la misma y solo la hace Juanma: `clasp logout` y `clasp login`, y **`clasp login` solo, sin el logout, dice "already logged in" y deja el push fallando en silencio**. Verificar `~/.clasprc.json` con fecha de hoy antes de publicar.

## Cierre del 25 sep 2026, noche (v27): el sitio pasa a Git, el código sale de la Mac

Esta versión recoge lo que la v26 no vio: la v26 se escribió desde la sesión del tablero
global y solo cubre la intranet. El mismo día hubo otras tres sesiones —el sitio, el orden
de Drive y el repo, y el morning brief— y nada de eso estaba escrito.

### 1. El sitio quedó CONECTADO a Git Integration de Wix (p168 cerrado)

**Se acabaron las dos copias del backend.** El repo manda y el panel de código del Editor
quedó en **solo lectura**: "You're viewing the latest code from origin/main as read-only".

- **Repo nuevo: `Rosanta2024/rosanta-wix`**, privado, clonado en **`~/Dev/rosanta-wix`**.
  Wix NO adopta un repo existente: crea uno. El paso 2 venía precargado con el nombre
  `rosanta`, que es el repo VIEJO, y hubo que corregirlo a mano.
- **El botón NO está en el Dashboard**, como decían las notas viejas: está en el
  **Editor › barra de código › ícono de GitHub › Connect to GitHub**, en tres pasos.
- **Ciclo completo probado:** `wix publish --source remote -y` corrió bien desde el clon
  ("UI version 2191 · Your site has been published successfully"). Es exactamente el
  comando que en julio devolvía `NOT_CONNECTED_TO_GIT`. Verificado contra el sitio en vivo,
  no contra el editor: `/_functions/slots` devuelve horarios a +1, +60 y +200 días.
- **El CLI pide una autorización de dispositivo aparte de `wix whoami`.** Da un código de un
  solo uso que se pega en `https://users.wix.com/login/device-login`. **En la terminal se
  aprieta ENTER, no espacio**: el espacio abre el registro de una cuenta nueva. El código
  vence rápido; si vence, se vuelve a correr el comando.

**EL HALLAZGO QUE IMPORTA, y era una bomba armada desde julio.** Al comparar el repo nuevo
(lo que el Editor tenía publicado de verdad) contra `~/Dev/rosanta-site`: `http-functions.js`
tenía **55 líneas con UNA función** en el repo viejo contra **437 con nueve** en producción,
entre ellas `get_slots` y `post_reservar`, que son los dos endpoints del formulario de
reservas. `events.js` 53 contra 140, `capi.js` 84 contra 56, y `crmReservas.js` y
`jobs.config` directamente no existían. **Publicar desde el repo viejo no habría
"desincronizado" nada: habría BORRADO la API de reservas del sitio.** No un formulario que
miente — reservas caídas del todo.

**LO QUE GIT NO CUBRE, para que nadie se confunda:** el repo lleva solo `src/backend`,
`src/pages` y `src/public`. **El componente HTML del formulario de reservas (43 KB) vive en
la configuración del elemento** y se sigue editando a mano en el Editor, que sigue siendo
editable para todo lo que no sea código.

**`~/Dev/rosanta-site` y `Rosanta2024/rosanta` son HISTÓRICOS** (p199): su README ya lo
avisa en bloque, con la tabla del diff y la frase que importa. `notes/wix-deploy-setup.md`
quedó marcado DESACTUALIZADO. **No confundirse de repo: el vivo es `rosanta-wix`.**

### 2. El formulario de reservas: dejó de mentir y llega a 12 meses

- **p166 cerrado.** `loadSlots()` ahora mira `r.ok`, `j.error` y `Array.isArray(j.slots)`
  ANTES del `if` de longitud, y muestra un mensaje nuevo **`T.roto`** ("No pudimos cargar los
  horarios… escribinos por WhatsApp al +502 3082 6935") en vez del de noche llena. Verificado
  sobre el archivo ya publicado en los cinco casos: backend 500, cuerpo no-JSON, sin red, día
  realmente lleno y backend sano (37 horarios).
- **p198: calendario de 12 meses.** El síntoma era que en el teléfono la última fecha
  ofrecida era el 23 de noviembre. No era un bug: `buildDates()` generaba exactamente 60
  opciones. **Antes de tocar nada se probó el backend con curl a +60, +75, +90, +120, +180,
  +270 y +365 días: los siete dan 200 con horarios reales**, o sea que el tope era solo del
  formulario. El `<select>` pasó a botón + panel de calendario flotante (no inline: el
  componente de Wix tiene altura fija y uno inline se habría cortado), con el horizonte en una
  sola constante, `MESES_VISIBLES`. Se conservó un `<input type="hidden" id="date">` con el
  mismo ISO de siempre, así que validación, confirmación y carritos abandonados no se tocaron.
- **La URL del componente cambia con cada publicación.** Hoy es
  `3de38d_f57f2495ccd58105fc33080f44ff1cb6.html`; la vieja `3de38d_9a4a77a3…` ya no es la
  viva. **Cualquier nota que fije un hash queda vieja sola.**
- **Trampa que costó un pegado:** `pbcopy` metió el archivo al portapapeles como **MacRoman**
  y rompió todos los acentos en el Editor. Se detectó porque el editor reportaba 36660
  caracteres cuando el archivo tiene 36660 **bytes** pero 36593 caracteres. **Copiar siempre
  con `LANG=en_US.UTF-8` y comparar CARACTERES, no bytes.**

### 3. El código de Rosanta tiene respaldo fuera de la Mac por primera vez

`~/Dev/Rosanta` tenía git desde el 12-sep pero **no tenía remoto**: 104 commits vivían solo en
el disco. Se subió a **`github.com/Rosanta2024/rosanta-os`** (privado) después de barrer los
104 commits buscando secretos —las 31 coincidencias eran nombres de campo OAuth e IDs de
hojas, no valores, y `clasp-creds.json` nunca entró al historial—. Quedó en **111 commits**, y
el repo del sitio en 57.

Se cerraron además **21 cambios sin commitear** que llevaban días en el disco, de sesiones ya
terminadas, en cinco tandas por área. **El disco no era trabajo a medias: era el estado real
que nadie había registrado.**

**Routine nueva: `rosanta-latido-repo`, diaria 8:24.** Avisa si algo lleva más de un día sin
commitear o si hay commits sin subir. **NUNCA hace commit, push ni pull**: con varias sesiones
escribiendo a la vez, una tarea que guarde sola es la forma más rápida de perder trabajo ajeno.

### 4. Drive y las carpetas, ordenados de punta a punta

- **`_Archive` pasó de 822 MB a 16 MB**, pero cada archivo se verificó por contenido contra su
  original vivo, y otra vez en el momento de borrar. Aparecieron dos capturas (EEGSA y Claro)
  que no eran duplicados de nada y se devolvieron a su carpeta.
- **`00_Admin` dejó de ser el cajón de sastre:** de 366 a 276 archivos.
- **`~/Claude` quedó VACÍA.** Era el almacén de Cowork. `_App` se repuntó de `~/Claude` a
  **`~/.claude`**, que es donde está lo vivo.
- **Los proyectos de la app se llaman como su pilar** (`02_Management_OS`, no "Rosanta 02
  Management"). El prefijo "Rosanta 0X" nunca lo aprobó Juanma: salió de la migración de
  Cowork. Son **once espacios, nueve carpetas, cero rutas rotas**.
- **SIC y SafeTour son PERSONALES**, no del pilar 1 (corrección de Juanma).
- **REGLA NUEVA DE JUANMA: los expedientes NO se deduplican.** Un trámite guarda el juego
  completo que se presentó, aunque repita patente, RTU o DPI. Lo que sí se deduplica son las
  copias sueltas.
- **Los nombres con espacios sobrantes rompen los movimientos**, y costó tres fallos antes de
  atacarlo: una carpeta con espacio al final se lee como vacía. Se normalizaron **124 nombres**.
- **Hallazgo al repartir:** los tres "recibos de servicios del local" eran del **IGSS** —cuotas
  patronales de mayo a julio sobre Q11,450.70 de salarios, o sea planilla, no luz ni internet—.
  Se abrió `03_Finance_Data_OS/Planilla_y_Propinas/IGSS_2026`.

### 5. Las tareas programadas son NUEVE, verificadas con la herramienta hoy

**OBSOLETA la tabla de ocho de la v24.** Leído con `list_scheduled_tasks` el 25-sep:

| Routine | Cuándo | Estado |
|---|---|---|
| `rosanta-latido-reservas-web` | diaria 8:10 | activa |
| `rosanta-latido-repo` | diaria 8:24 | activa, **nueva** |
| `morning-brief-juanma` | L–V 6:06 | activa |
| ~~`rosanta-reporte-semanal`~~ | ~~lunes 16:24~~ | **eliminada el 27-sep-2026 y RECREADA el 28-sep** (lunes 16:24, PDF estilo S38; ver v33 §1) |
| `rosanta-cierre-semanal` | domingos 18:20 | activa |
| `rosanta-cerebro-mantenimiento` | día 1, 9:07 | activa |
| `rosanta-reporte-mensual` | día 3, 9:08 | activa |
| `auditoria-meta-ads-rosanta-mensual` | **día 3, 8:11** | activa (se movió del día 25) |
| `rosanta-seguimiento-offsite` | lunes 8:24 | **apagada** hasta que termine la intranet |

`rosanta-analista-pauta-lunes` sigue **borrada**; su carpeta en disco no significa nada.

### 6. Tres routines apuntaban a una carpeta que ya no existe

Consecuencia directa del renombrado del punto 4, y **nadie se iba a enterar**: la carpeta vieja
`Projects/Rosanta 03 Finanzas` **todavía existe pero está vacía**, así que ninguna habría
fallado con "no existe" — habrían leído nada y seguido de largo.

- `morning-brief-juanma` y `rosanta-cierre-semanal`: la ruta del tablero.
- `rosanta-reporte-mensual`: mandaba a correr `.venv/bin/python` desde la carpeta vieja, y ese
  venv vive en la nueva.

Las tres corregidas a `Projects/03_Finance_Data_OS`, con respaldo `SKILL.md.antes-ruta-25sep`.
Verificado después: cero menciones a la ruta vieja en `~/.claude/scheduled-tasks` y las dos
rutas nuevas resuelven en disco.

**REGLA: renombrar una carpeta de proyecto no avisa a las tareas programadas que la tienen
escrita. Después de un renombrado hay que barrer `~/.claude/scheduled-tasks` igual que se
barren los alias.**

### 7. Un conteo de fallos sin denominador no es un hallazgo

El morning brief del 25-sep levantó tres cosas y **dos no sobrevivieron a su propia
verificación**. Vale escribirlas porque el error es repetible:

1. **`calentarCaches` NO "lleva cinco días fallando".** Corre **cada 5 minutos** (documentado
   en la cabecera de `CalentarCaches.js` y verificado en p107), o sea ~288 corridas por día:
   cinco fallos en seis días son **5 de ~1,730, el 0.3%**. La corrida que muere a las 04:23 la
   reemplaza la de las 04:28. Y **la función no puede lanzar esos errores**: cada bloque va en
   su propio try/catch y termina en `Logger.log`; no lanza a propósito, porque no es un monitor
   sino una comodidad (Latido es el que avisa). Los dos mensajes que llegan por correo son de
   la plataforma matando la ejecución antes de que el código atrape nada, así que **un
   reintento con espera no tendría dónde ir**. No se tocó código.
   - Lo único real, y es chico: esos fallos transitorios mandan correo de "activador fallido",
     que es **el mismo canal** por el que avisa Latido. Ruido inofensivo en el canal de las
     alarmas de verdad. La palanca, si algún día molesta, es bajar la frecuencia del activador.
2. **La colección `tablero` del artefacto está vacía y NO es un defecto.** Cero documentos:
   `marcas` y `manuales` no existen, no es que existan vacíos. El JS del tablero escribe en
   `db.doc('tablero/marcas')` y `db.doc('tablero/manuales')`, exactamente las direcciones que
   lee el brief, así que el cableado está bien. Está vacía porque **desde que el tablero dejó el
   localStorage (23-sep) nadie ha marcado nada desde la página**. El día que Juanma marque una
   tarea, el documento nace.

### 8. Decisiones de Juanma del día

- **La colaboración de Ingrid Altamirano (actriz e influencer, viaje a Antigua del 8 al 10 de
  octubre) NO interesa**, y **no se envió ningún correo**. El hilo queda sin contestar.
- **El seguimiento del depósito de Krystal Nwankwo sale del tablero** y se lleva en el directo.
  Estado al cerrar: prueba de Q73.89 confirmada, faltan Q10,851.11 de los Q10,925.

---

## Cierre del 25 sep 2026 (v26): el tablero global, publicado en la @124

**El equipo está en la @124** (verificado: `list-deployments` releído tres veces y la @124 bajada aparte idéntica al disco, 62 archivos). Batería sobre HEAD: **126 OK · 0 fallas · 4 avisos · 3 saltadas** (177 s). Informe: `apps-script/_informes/2026-09-25_Tablero_global_etapa2.md`; catálogo en `Rosanta OS/03_Finance_Data_OS/KPIs/KPI_Definiciones.md`.

### 1. Qué es el tablero global

`?page=tablero`, **solo rol dueño** (misma guarda que `pruebas`), puerta "Tablero global" en el panel principal. Seis pestañas, una por pilar, con tarjetas: valor · semáforo contra su meta · tendencia contra el mes anterior · enlace a la pestaña del pilar. **Regla que lo hace funcionar: NO CALCULA NADA.** Cada valor es el campo del motor de su pilar (`FinanzasDatos`, `CajaDatos`, `Dashboard` + `PuenteCmv`, `InventarioDatos`, `MarketingDatos` + `CrmDatos`); `TableroDatos.js` solo elige el campo, lee la meta de `PARAMETROS`, compara y pone al lado el mes anterior. La batería lo vigila ("El tablero global no calcula: cada valor es el campo de su motor"). Una llamada por pilar (`getTableroPilar`), para que Profit OS no frene a los otros cinco.

19 KPIs en catálogo: 9 ya existían, 7 se construyeron en el motor de su pilar, 3 esperan dato (comisión de tarjeta, reseñas, clientes que vuelven). Fuera de alcance por decisión de Juanma: rotación de mesa, SPLH, merma como registro propio.

### 2. Lo que se construyó en los motores (25-sep)

- **`FinanzasDatos.js`**, por mes: `ebitda`, `ebitdap`, `eventos_n`, `sin_factura`, `sin_factura_iva`, `mb_comensal`, `com_lmx_dia`, `medios`; totales del año; caché `finanzas_v11`. Espejo en `generar_finanzas.py`: **motor == Python en los 9 campos, los 9 meses**.
- **EBITDA (decisión de Juanma, 25-sep): `neto + Impuestos + venta de eventos`.** Sin depreciación (el maestro no la registra) ni intereses (no hay deuda). **Bienes de uso NO se suma de vuelta** hasta que exista una categoría de inversión. En vivo: año Q54,227 (4.0%).
- **`InventarioDatos.js`** › `invEstadoCierre_`: el mes anterior al actual, por área, contra el día límite (`inventario_cierre_dia`, 5 por defecto). Al 25-sep: barra agosto cerrado (verde); cocina agosto abierto desde el 14-sep (rojo). **Los inventarios se cierran desde la intranet** (Juanma, 25-sep).
- **`CrmDatos.js`** › `crmAltasPorMes_`: solo "Cliente que visitó" (regla del 23-sep) con la tasa de lectura al lado; **`MarketingDatos.js`** › `mktKpisMes_`: CAC (medios de Finanzas ÷ altas), ROAS proxy de `pauta_semanal` y eventos por mes.
- **Metas:** `PARAMETROS` sigue con dos filas. El tablero propone 15 más (tabla §8 del catálogo) y las marca "defecto" en rojo hasta que existan. `_finParametro_` trata el 0 como fila vacía: una meta de cero no se puede guardar ahí.

### 3. Decisiones y hallazgos del día

- **Archivados con el sí de Juanma:** `Rosanta_Tablero_de_Metas.xlsx`, `rosanta_ruta_metas.html` y `PnL_5_Numeros/` → `Rosanta OS/_Archive/Tablero_Metas_2026-09-25/`. Verificado antes: nada los referenciaba. El artefacto `rosanta-ruta-metas` ya no existía.
- **Sin decidir:** meta del año y curva H2 en `METAS` (recomendación: la curva, ~Q1.95M; la automática es un piso); fuente de la comisión de tarjeta (recomendación: liquidaciones de VISANET y BAC Credomatic, que traen bruto, comisión, ISR e IVA; el POS solo da el bruto); **y cuál meta de food cost manda: el reporte semanal S38 usa cocina 26% y barra ponderada, `PARAMETROS` e intranet 28 y 20.**
- **El despliegue estaba en la @123, no en la @101** que decía el cerebro: 22 versiones entre el 22 y el 25-sep. Y **git iba por delante de lo publicado** en `EdicionRecetario.js` (candado "una unidad no es un número") y `Latido.js` (sexta señal, p164): la @124 los lleva.
- **La regla 9 ya no existe** en `FinanzasDatos.js` (retirada el 23-sep, la reemplaza la 15). Cualquier catálogo o informe que la cite quedó viejo.

### 4. Reglas nuevas

1. **`clasp login` con la autorización vencida dice "You are logged in" y no renueva nada.** El archivo `~/.clasprc.json` conserva la fecha vieja y `push` sale con código 0 sin subir. Arreglo: `clasp logout` y `clasp login`; verificar la **fecha del archivo** y `tokeninfo` antes de creerle.
2. **Probar sin clasp:** `tools/harness-intranet/` corre el código real de la intranet en Node sobre el espejo (mocks de Apps Script). No cubre Profit OS, HtmlService ni la planilla externa. Sirvió para probar el tablero entero antes de que Juanma pudiera renovar clasp.
3. **Los clics de Claude in Chrome no llegan a las páginas de Apps Script** (ni botones ni enlaces dentro del sandbox), y las pestañas vivas se leen estirando el iframe con JS y capturando pantalla. La revisión visual de una pantalla nueva la hace Juanma en su Chrome.
4. **Antes de un push, bajar la versión publicada aparte y compararla con git:** si otra sesión versionó desde un disco distinto, el push la pisaría. Hoy la comparación mostró lo contrario (git más nuevo), pero es lo que hay que mirar.
5. **`generar_finanzas.py` no lee el Sheet de planilla:** su respaldo en código se queda en el último mes cargado y el prime cost difiere 1-2 puntos de la intranet sin que sea error del motor. Comparar primero food cost y ventas.

### 5. Pendientes que deja

- Filas de `PARAMETROS` y pestaña `METAS` (`instalarMetas()`), con los números que Juanma decida.
- K08 comisión de tarjeta (fuente), K18 reseñas (`RESENAS_SHEET_ID` + pestaña `RESENAS_TA`), K19 retención (p163).
- ~~Revisar en Chrome las seis pestañas del tablero en producción.~~ Hecho por Juanma el 25-sep: "se ven bien las seis".
- Commit en git del trabajo del 25-sep (13 archivos, sin commitear hasta que Juanma lo pida).
- Meta de food cost: 26/ponderado (reporte semanal) contra 28/20 (`PARAMETROS`).

---

## Cierre del 23 sep 2026, tarde (v25): p163, el CRM mide visitas y el consumo tiene dueño

**Regla nueva en el CRM, publicada (clasp push, proyecto Rosanta Marketing OS, `CRMSync.js`):** una persona pasa a **"Cliente que visitó"** si tiene consumo tecleado **o** si su reserva quedó **Seated/Finished** en Wix. Reserved y No-show siguen en "Reserva histórica" (sin evidencia). Verificado: la corrida de las 14:34 subió exactamente **18 filas** (14 de agosto, 4 de septiembre) y ninguna otra. **El CAC ya no depende del consumo**: se mide por visita, que es lo que Juanma pidió.

**Regla operativa en Wix, acordada con Juanma (pasársela al equipo):**
1. Al sentarse la mesa → **Seated**. No dispara nada más que el aviso al CRM.
2. Al terminar el servicio → escribir el total del ticket en "Consumo total de la mesa (Q)" y **dejarla en Seated**. Probado el mismo día con Juanma: la edición posterior del monto llega a la pestaña `reservas` igual (id 71c938e1, 225 → 300).
3. **Finished solo para pedir la reseña**: `events.js` dispara el correo de TripAdvisor únicamente con FINISHED. Por eso Juanma NO cerraba mesas y usaba No-show para "cerrar".
4. **No-show solo si de verdad no llegó.** Si no se sabe, se deja en Reserved.
- **OJO con la historia:** los No-show de agosto y septiembre 2026 **no son ausencias reales**, significan "no sabemos". No leerlos como no-shows. Juanma decidió NO crear un segmento propio para No-show.

**Lista corta semanal (`ConsumoPendiente.js`, mismo proyecto):** cada **lunes a las 8** llega a restaurante@rosanta.rest un correo con las reservas de la semana anterior que siguen Seated/Finished sin consumo o Reserved sin cerrar, cada una con enlace directo a la reserva en Wix; si no falta nada no manda correo; los No-show no salen. Activador instalado por Juanma desde el editor; primer correo recibido a las 14:41. **Juanma es quien lo trabaja.** Complemento de la otra sesión: chequeo 4 de `Verificador.js` (alarma si hay más de 10 mesas abiertas con 3 días de gracia). p186 queda cubierto sin duplicarlo en Latido.

**El cruce con el POS NO sirve para llenar el consumo solo** (corrida en seco, 91 reservas reales del 1-ago al 22-sep): ticket único en 32 (35%), ambiguo en 51, sin ticket en 8; y de 10 con consumo tecleado que resolvió, falló 3. Causa: la hora del POS es la del cierre en caja, no la de la mesa (41% de los tickets se cierran en racimos de 4+ en 10 minutos) y "Comensales" viene vacío 1 de cada 10. Solo se reactiva si caja cierra cada ticket cuando la mesa paga. Archivos en `CRM_y_Retencion/2026-09-23_p163_*`.

**Quién recibe el consumo:** la pestaña CRM de la intranet y la 6ª señal del Latido lo leen solos del CRM. `ValorReserva.js` (Purchase con valor a Meta) **nunca corrió** (no existe `capi_log`) y Meta rechaza eventos de más de 7 días; **decisión de Juanma: se deja así, el frente de pauta queda cerrado.**

**Números para el CAC:** agosto 72 altas Wix / **33 visitas confirmadas** → CAC ~**Q67** como techo (antes Q116 con 19). Septiembre no legible aún: 42 altas, 7 confirmadas, 26 en No-show ("no sabemos"). Desde hoy septiembre arranca medible si el equipo marca Seated.

**De la otra sesión del mismo día (workspace-pauta-b8), para no rehacerlo:**
- **p164 hecho:** sexta señal en `Latido.js` (rosanta-intranet) con DOS medidas separadas: **captura** = altas del CRM / tickets del POS, avisa bajo 15%; **lectura** = confirmadas / altas, avisa bajo 50%, 3 días de gracia. Calibrado con `latidoCapturaHistorico()`: captura 20% a 180 días y 29% a 30 días (canal sano); lectura 77% a 180 días cayendo a 29% a 30 días. Agosto obliga a separarlas: captura 25% con lectura 57%; con una sola medida parecía canal roto y no lo era.
- **p10, regla del denominador — DECIDIDO por Juanma el 23-sep, no reabrir** (`_informes/2026-09-23_p10_CAC_regla_denominador.md`): el denominador del CAC son **solo las altas del mes con segmento "Cliente que visitó"**. Quedan fuera carritos abandonados, cancelados **y "Reserva histórica"** (la reserva que llegó al CRM pero cuya mesa nadie marcó, así que no se sabe si vino). Un CAC cuenta clientes que entraron, no reservas. Denominador por mes, leído el 23-sep: ene 47 · feb 47 · mar 41 · abr 15 · may 59 · jun 35 · jul 31 · ago 33 · sep 7. Serie de CAC ya calculada: ene Q47 · feb Q32 · mar Q20 · may Q30 · jun Q58 · jul ~Q98 · ago ~Q67.
  - **GUARDA OBLIGATORIA, es parte de la regla y no un comentario.** Junto al CAC se publica siempre la **tasa de lectura** del mes = `Cliente que visitó / (Cliente que visitó + Reserva histórica)`. Umbrales: **≥90% comparable · 50-90% se publica advirtiendo que sale inflado · <50% NO se publica**, no hay CAC sino un dato faltante. Sin esta guarda la regla convierte un descuido del salón en una conclusión falsa sobre la pauta. Se vigila sola desde el 23-sep: sexta señal de `Latido.gs` (p164).
  - **Meses que no son comparables, y por qué cada uno es distinto:** abril (15 clientes con lectura 100% — no es que no se registrara, es que no entraron reservas); julio (reconstruido a mano, sin dato del 23 al 31, el 31 es un piso); **agosto (lectura 57%, su CAC sale cerca del doble del real) y septiembre (lectura 18%, no se publica)**. Agosto y septiembre no son meses caros, son meses mal registrados, y la causa quedó resuelta el 23-sep con la regla de visita de p163.
  - El argumento descartado (usar visitó + histórica, para que el CAC no se mueva por el hábito del salón) queda escrito al final del informe con su razón. La guarda de lectura existe justamente para administrar ese riesgo.

**Reglas técnicas del día:**
- **No dejar respaldos dentro de la carpeta de un proyecto clasp**: `clasp push` los sube como archivos del proyecto y duplica funciones (pasó con `_Archive/`; se corrigió con un segundo push; los respaldos van en `apps-script/_Archive/<proyecto>/`). Y `clasp push` nunca borra archivos remotos: para sacar uno hay que hacer un push con un cambio real.
- **El tablero `rosanta-seguimiento-semanal` ya no está en `~/Claude/Artifacts/`**: se edita bajando el HTML del artifact publicado (`Artifact read` + republicar con `url`). Hoy quedó en la v12.
- La pestaña `reservas` escapa el guion bajo en el dump de Drive (`NO\_SHOW`): filtrar por estado con eso en cuenta.
- El formulario web y el bot siguen bien: el latido diario de las 8 corrió el 16-sep (33 franjas, bot ok).

---

## Cierre del 23 sep 2026 (v24): todo se muda a Claude Code

**Decisión de Juanma: el trabajo se hace en Claude Code. En Cowork quedan solo el proyecto SIC y las preguntas sueltas del día a día.** Se vació: sus 12 tareas programadas están borradas y `~/Claude/Scheduled/` quedó sin carpetas.

**OBSOLETA la tabla de abajo desde el 25-sep-2026: son NUEVE routines, no ocho, y hay una nueva (`rosanta-latido-repo`). La tabla verificada con `list_scheduled_tasks` está en la v27 §5.** **Las tareas son ahora routines de Claude Code**, en `~/.claude/scheduled-tasks/`, creadas con `mcp__scheduled-tasks__create_scheduled_task`. Corren como sesión de Code en la Mac, con el Drive montado y las skills locales, y solo con la app abierta. Son ocho:

| Routine | Cuándo |
|---|---|
| `rosanta-latido-reservas-web` | diaria 8:10 |
| `morning-brief-juanma` | L–V 6:06 |
| `rosanta-analista-pauta-lunes` | **borrada** el mismo día por Juanma |
| ~~`rosanta-reporte-semanal`~~ | eliminada el 27-sep-2026 |
| `rosanta-cierre-semanal` | domingos 18:20 |
| `rosanta-cerebro-mantenimiento` | día 1, 9:07 |
| `rosanta-reporte-mensual` | día 3, 9:08 |
| `auditoria-meta-ads-rosanta-mensual` | día 25, 8:11 |
| `rosanta-seguimiento-offsite` | lunes 8:24, **apagada** hasta que termine la intranet |

**Las 18 skills propias viven en `~/.claude/skills/`.** Las de claude.ai son un caché que se sincroniza y se pisa: de ahora en adelante se edita la copia local. Las 17 de Anthropic (docx, pdf, xlsx, skill-creator…) no se copiaron: Code ya las trae.

**Los 12 artefactos de Cowork se publicaron como Artifacts de Code**, cada uno con su enlace; la lista está en `Rosanta 03 Finanzas/_archivo/artefactos-publicados.md`. Dos novedades técnicas: el **tablero `rosanta-seguimiento-semanal`** dejó el `localStorage` y guarda lo que Juanma marca o agrega en el almacenamiento del propio artefacto (`db`), así que **el cierre del domingo ya puede leer sus marcas**; y el CRM y el panel del bot leen su Google Sheet con la capacidad `mcp` del artefacto, porque `window.cowork.callMcpTool` no existe fuera de Cowork.

**Las memorias de proyecto se rescataron**: 141 archivos importados a `~/.claude/projects/<proyecto>/memory/` (Pauta 33 de 56, Eventos 31, Profit 45, Finanzas 25, Branding 4, Management 3). Se limpiaron 13 con nota fechada y se borraron 3 obsoletas. SIC y Safe Tour quedan fuera: son personales. Las instrucciones de cada espacio de Cowork se escribieron como `CLAUDE.md` en la carpeta de su proyecto.

**El reporte semanal cambió de formato y de casa.** Ya no es el PDF de una página: son **6 páginas** y la especificación única es `Rosanta_Formato_Reporte_Semanal.md` en la carpeta Maestro (la skill `rosanta-reporte-semanal-formato` se borró para no tener dos versiones). Cada reporte vive en la carpeta de su semana, `Reportes 2026 / SXX / Rosanta_SXX_2026.pdf`; si no está ahí, se elimina. Lleva punto de equilibrio semanal y diario (Q35,097 y Q5,014, margen de contribución 43.1%), excluye el gasto de marketing y **no lleva nombres de personas**: los responsables son departamentos. Las reservas salen del Marketing OS, no de SonTickets. En la Mac no hay weasyprint ni Homebrew: el PDF lo imprime **Chrome headless** y el generador verifica solo que no se corte ninguna sección.

**Marca aplicada al reporte:** paleta Segunda Cosecha completa (Verde Bosque `#4E6D5A`, Verde Medio `#57A77F`, Lila Lavanda `#AEAAE2`) y tipografía **Peskia** en titulares y cifras con **Avenir** en cuerpo. Peskia ya está comprada e instalada en `~/Library/Fonts`.

**Precios de evento cerrados este día:**
- **Barra Libre Q200 → Q225** (a 4 bebidas por persona el CMV estaba en 28.2%; ahora 25%).
- **Combo Tapas + Barra Libre Q350 → Q375**. El combo nunca tuvo descuento: siempre fue la suma.
- **Mocktails: Q55 el de la casa (llave POS 153) y Q75 el Plus (llave 179)**, ya cambiados en el POS. Los dos tienen ficha nueva en `Rosanta_Recetario_Barra_v6_2026-09-23.xlsx`: el de la casa son dos ingredientes a base de pulpa (maracuyá o mango) y cuesta Q4.27 a Q7.91; el Plus es la receta completa y cuesta Q2.89 a Q6.23. Ojo con la paradoja: el simple con maracuyá es el más caro de producir.
- El paquete limitado se queda en **Q150** (22% de CMV). Falta recalcular el **fuerte con postre Q260** de Para Compartir con el tier nuevo (lomito Q225 premium, pollo Q210 estándar).

**Regla nueva sobre los mocktails:** ninguno subió con la carta 2027 hasta hoy; el mix real de barra medido en el POS (S31–S38, 588 unidades) es **54% coctel, 24% vino de copa, 22% cerveza**, con precio de carta medio Q65.55 y costo medio Q14.11.

---

## Cierre del 22 sep 2026 (v23): el pilar 3 rediseñado, publicado en la @101

**El equipo está en la @101.** Batería sobre lo publicado: **120 OK · 2 fallas · 1 aviso ·
3 saltadas** (126 pruebas, 220 s). Las dos fallas son conocidas y se publicó a sabiendas
(decisión de Juanma); las dos apuntan a defectos viejos, no al trabajo del día.

### 1. Finanzas pasó de una pantalla a seis pestañas

Juanma rechazó dos versiones antes de la que quedó, y las dos veces tenía razón. La primera
era "La semana" con cinco de sus siete secciones del AÑO. La segunda movió ese análisis anual
a "El gasto" — seguía siendo anual para alguien que decide por semana.

**Lo que quedó:** `Cómo vamos · Metas · Caja · El gasto · Mes a mes · Escenarios`, en una
barra de pestañas ARRIBA. El lateral se retiró.

- **Cómo vamos** abre con cinco KPIs de la semana y el mes: venta de la semana contra su
  meta, contra la semana anterior, acumulado del mes contra su meta, ritmo, y caja en días.
  Trae la meta de `getMetasData`, el mismo motor de la pestaña Metas.
- **El gasto** es SEMANAL: compra de Cocina y Barra contra su techo, y las secciones del DRE
  de la semana contra su media de 4 y contra la anterior. El año quedó plegado al final.
- **Mes a mes** juntó el P&L mensual con el comparativo contra el año anterior, y sumó la
  tabla de mano de obra extra por área.
- **Escenarios** cambió su cinta por la brecha: resultado del año, margen de contribución,
  con cuánta más venta se cierra, o con cuánto menos gasto fijo, y meses bajo el equilibrio.

**Dos bugs de móvil, no uno.** El conocido: el shell dejaba el iframe sin altura y las cinco
vistas caían en una franja de 150 px. El segundo apareció construyendo: `.sf-main` es un
`<main>` y heredaba `margin: 0 auto` de `Estilos.html`; dentro de un flex en COLUMNA ese
`auto` cancela el estirado y la caja se encoge al ancho por defecto de un iframe —300 px— **en
la computadora**. El lateral viejo no lo sufría porque `.sm` era un flex de FILA.

**Paleta vigente aplicada** (#4E6D5A / #57A77F / #AEAAE2 / #F2EEEB / #000000), variables y los
19 tintes que estaban escritos a mano. **Verificado: Estilos.html NO es compartido.** Profit
OS (`CosteoEstilos.html`) define las suyas y ya estaba en la vigente; Marketing (`Marketing.html`)
tiene su propia familia de cafés y dorados, y **Juanma decidió dejarla así**. *(OBSOLETO desde el 15-oct-2026: Marketing se unificó a la paleta única, ver v39.)*

### 2. El punto de equilibrio estaba mal calculado desde siempre

`mc` era `(ventas - cogs) / ventas`: solo restaba la mercadería. El gasto operativo que se
mueve con la venta —lo variable más la mitad de lo semivariable— no estaba ni en el fijo ni
restado del margen: **desaparecía del cálculo**. El efecto: la tabla daba holgura positiva en
los NUEVE meses de un año que cerró en −Q51,014.

Corregido: `mc = (ventas - cogs - (tipo.V + tipo.S/2)) / ventas`. Con eso 7 de 9 meses quedan
bajo el equilibrio, que es lo coherente. Un mes con `mc <= 0` devuelve `bev: null` y la
pantalla dice **"No alcanzable"** en vez de dibujar un equilibrio de Q0.

**La prueba que faltaba:** la batería verificaba que el equilibrio fuera CALCULABLE, no que
fuera COHERENTE con el resultado del mes. Probada contra las dos fórmulas: con la corregida
0 incoherentes, con la vieja 7. Sigue marcando **abril** y eso es la segunda falla: el
equilibrio usa el fijo de la clasificación BANCARIA (nómina pagada) y el resultado va
devengado. Son dos bases distintas. **Pendiente: de dónde sale el gasto fijo.**

### 3. Presupuesto de gasto por sección: la pestaña PRESUPUESTO

No existía ninguno en el sistema. Vive en `Rosanta_Intranet_Config` › `PRESUPUESTO`, con
**tres tipos** porque un solo formato mensual no sirve para tres clases de gasto:

| Tipo | Qué es | Quiénes |
|---|---|---|
| `fijo` | monto mensual | Inmueble Q20,212.50 · Nómina Q29,000 · Tarifas Q6,600 · Prestadores Q5,500 · Marketing Q5,700 (Nov y Dic Q9,000) |
| `%venta` | porcentaje, se recalcula con la venta del mes | Propinas 4.24% · Comisiones 6.5% |
| `anual` | presupuesto del año contra el ACUMULADO | Impuestos Q107,000 · Bienes de uso Q70,000 · Mantención Q60,000 · Uniformes Q3,700 |

La primera versión metió los once en un mensual plano sacado de dividir el año entre 9.
**Juanma rechazó seis y tenía razón en las seis**: propinas y comisiones son proporcionales a
la venta; uniformes se compra cada cinco meses y Q300 al mes no compra nada; impuestos y
mantención caen a saltos. Una celda vacía NO es cero: es "sin presupuesto", y esa sección
cae a la banda del sector diciéndolo.

**Y el alquiler destapó un error de datos.** El promedio daba Q20,896 porque incluía la renta
de DICIEMBRE DE 2025, pagada el 2 de enero: el maestro es base caja y cayó en 2026. Son
**Q21,560 que no son del año**. El alquiler vigente es **Q20,212.50** (Q21,560 hasta abril,
Q19,250 en mayo). Sobran Q375 sueltos en febrero sin explicar, y el alquiler se paga en dos
partes algunos meses.

### 4. La planilla ahora distingue el personal variable por área

La hoja `Planilla 2026` tenía la columna `Puesto` con "Extra" desde siempre y **nadie la
leía**: el motor tomaba un solo número por mes. Ahora `_finPlanillaDetalle_` separa fijo de
extra y, desde el puesto, el área.

**Clasificación final (Juanma, 22-sep). BARRA Y SALA SON LO MISMO.**

- **Extra cocina:** Andre, Antony
- **Extra barra/sala:** Eddy, Melvin, Jorge (ya no está), **Marvin** y **Erickson**
- **En nómina de sala solo están Jose Mazate ("Maco", coctelero) y Efraín.** Todos los demás
  meseros son extras. Marvin figuraba como "Mesero" los nueve meses y **nunca estuvo en
  nómina**: se nota en el dato —Efraín cobra Q4,000 clavados y Marvin salta entre Q1,050 y
  Q3,150—. Son Q19,900 que pasaron de planilla fija a extras.

**Los números reales del año:** extras **Q53,710** (21% de la planilla), de los cuales
**Q40,750 —el 76%— son de barra/sala**. Barra pasó de Q450 en abril a Q3,700 en agosto;
cocina se mantuvo entre Q660 y Q2,825. **Todo el crecimiento de los extras es de un solo
lado.** Si junio–agosto hubieran corrido al 2.7% de abril, serían Q11,482 menos.

**El finiquito de Marvin (Q3,000, septiembre) era invisible:** está en la columna "Horas
extras" con el salario base vacío, y el motor leía solo "Salario base". Ahora lee base, bono
y horas extras, y el finiquito va en su propia bolsa — suma a la planilla total pero **no a
los extras**, porque no dice cuánta gente hizo falta. **"Salario devengado" entra SOLO si el
base está vacío:** en enero cuatro personas lo tienen repetido y sumarlo contaría Q18,000 dos
veces. Verificado fila por fila.

### 5. La regla 9 se retiró el 23-sep-2026, y el miedo que la sostenía estaba sobredimensionado

Juanma: *"La regla 9 no tiene sentido. La mayoría de proveedores generan FEL."* Tenía razón: la
**regla 9 corría ANTES que la 15 y saltaba el pago sin mirar si la factura existía**. Se retiró
entera el 23-sep —la lista también, para que nadie crea que sigue haciendo algo— y hoy manda la
**regla 15**, que casa cada pago con UNA factura (mismo bloque del DRE, monto ±Q0.01, factura de
45 días antes a 10 después) y sólo entonces lo descarta. Un pago sin factura cuenta como gasto,
que es lo conservador. La prueba que vigilaba la regla 9 quedó como centinela: avisa si
`FIN_PAGO_DE_FACTURA` vuelve a estar viva.

**Lo que frenaba el retiro era el pago agrupado, y medido vale mucho menos de lo que parecía.**
La medición vieja —394 pagos del BI a proveedores, con la regla que dio Juanma *"siempre es el
monto exacto o la suma de varias facturas"*: 319 casados, 273 con una factura y **46 con la suma
de varias**— tomaba el universo ENTERO de pagos del BI, que incluye nómina, impuestos, inmueble y
comisiones, bloques donde la regla 15 no aplica a propósito.

Acotado al alcance real de la regla (sus seis bloques) y medido el 23-sep sobre el espejo del
21-sep: **181 pagos, 84 casan uno a uno (Q42,913) y 97 quedan sueltos (Q105,100)**. De esos 97,
los que son la suma de 2 o 3 facturas del mismo NIT dentro de la ventana son **2, por Q1,027.46**,
y uno es coincidencia de monto. **El único caso real es Claro: Q388.58 + Q388.88 = Q777.46**,
pagados el 11-jun por el portal del BI.

O sea: enseñarle a la regla 15 a casar contra varias facturas no vale el trabajo hoy (p192). Y si
alguna vez se hace, primero hay que fijar el criterio —mismo NIT, ventana, cuántas facturas como
máximo—, porque combinar montos hasta que sumen es justo como se fabrican pares falsos: 1 de los
2 candidatos de hoy ya lo es.

**Regla de método que deja esto:** un número medido sobre un universo más grande que el de la
regla que se está evaluando no mide esa regla. El 46 sobrevivió tres días y volvió a citarse como
si fuera del alcance de la 15.

### 6. `COMPRAS_2026` es la pieza que faltaba para el cuadre de proveedores

Sheet `1Py2KLc8o2GYzJhosnpi_R0OsDU76xa6d_F9B_UuUq0o`, una pestaña por semana:
`AREA · PROVEEDOR · DTE · Fecha de Pagar · Fecha Pagado · Cantidad a Pagar · Estatus · Referencia`.

Tiene el número de factura **al lado del pago**, y tres cosas que ni el banco ni el FEL dan:
la forma de pago ("Pagado de caja", "Tarjeta", "Pagar a Maco", "Depositar a cuenta Jeffry"),
los **abonos parciales** y los **saldos a favor**. El efectivo de caja, que era invisible,
queda registrado ahí.

**No sirve leerlo desde una exportación de texto:** la columna AREA viene vacía en casi todas
las filas y las columnas se desalinean; además el campo DTE a veces trae cuentas bancarias.
Hay que leerlo del Sheet, con la grilla real.

**Y el problema de fondo no es técnico:** los proveedores de mercado no están en ese documento,
y *"Maco y Jeffry no actualizan el sistema cuando se debe, sino cuando se acuerdan"*.

### 7. Reglas nuevas, cada una de algo que pasó hoy

1. **La skill del cerebro INSTALADA puede estar ATRASADA respecto de la del repo.** Hoy la
   instalada era la v18 y la del repo la v22: cuatro versiones. La regla vieja —"partir siempre
   de la instalada"— habría borrado v19 a v22. **Comparar las dos fechas antes de reempaquetar
   y partir de la más nueva.** Y esta sesión arrancó con contexto de seis días atrás sin saberlo.
2. **No editar un archivo cortando por posiciones de texto.** Al recortar una tabla el corte
   terminó dentro de otra función y quedaron DOS `pintarPersonal`, una rota. `node --check`
   pasaba y la pantalla se veía casi bien. Se detectó porque las notas no coincidían con lo
   recién escrito. **Anclas exactas, y verificar cuántas definiciones quedan.**
3. **Una función que cambia datos tiene que reportar TODO lo que cambió.** `etiquetarExtrasPorArea`
   decía "28 etiquetadas" y dejaba la hoja con 38 filas cambiadas: los 10 cambios de ROL
   (Marvin, Erickson) se aplicaban en silencio. Ahora el resumen los lista aparte y **verifica
   que cuadre**: si las filas con puesto nuevo no coinciden con las reportadas, lo dice.
4. **Un `return` no sale en el registro de ejecución de Apps Script.** Usar `console.log` o
   el usuario ve "Execution completed" sin saber qué pasó.
5. **Un formato de celda puede mentir sobre un dato correcto.** La columna Valor del
   presupuesto quedó en `#,##0` y mostraba 6.5 como "7" y 4.24 como "4". El motor leía bien;
   la pantalla invitaba a "corregir" un dato que estaba bien.
6. **Una prueba que compara necesita señal de los DOS lados.** La de coherencia del equilibrio
   excluía los meses pegados al equilibrio pero no los de resultado ≈ 0, donde el signo no
   informa. Y **una falla sin números no se puede diagnosticar**: el mensaje ahora trae venta,
   equilibrio, diferencia, resultado, fijo y margen.
7. **Un umbral de RAZÓN no escala con el tamaño.** La prueba de la regla 9 avisa si un proveedor
   paga más de 1.3 veces lo que factura. Ponerse al día con tres meses de la alarma de EX Security
   son Q750 y un +33% que dispara; los mismos Q750 en EEGSA no mueven nada. **Falta un piso en
   quetzales.** Es la primera de las dos fallas de la batería, y es un falso positivo.
8. **`clasp` mintió dos veces más.** Devolvió código de salida 0 sobre un push que falló por
   `invalid_grant · invalid_rapt` —reautenticación vencida, un tercer modo de falla distinto de
   los dos ya documentados— y dijo "you seem to already be logged in" con la autorización muerta.
   El arreglo es `clasp login` con restaurante@rosanta.rest, que **solo puede hacerlo Juanma**
   porque abre el navegador.

### 8. Pendientes que deja el pilar 3

- **Captura de pagos dentro de la intranet**, para que Maco y Jeffry no dependan del Sheet.
  El diseño propuesto: invertir el flujo —el FEL ya entra solo, así que la pantalla muestra las
  facturas sin pagar y ellos confirman con un toque, eligiendo forma de pago— más un botón de
  "compra de mercado" sin factura. Necesita módulo y permisos nuevos: hoy Jeffry y Maco solo
  tienen `recetario`. **Primero la captura, después el balance:** un registro que se llena
  cuando alguien se acuerda produce un balance que dice que le debés a quien ya le pagaste.
- **Cuadre de cuenta por proveedor** sobre esa captura: facturado, pagado, pendiente y pagos
  de más, con abonos y saldos a favor.
- **Retirar la regla 9** proveedor por proveedor, después de enseñarle a la 15 a casar un pago
  contra varias facturas.
- **El gasto fijo del punto de equilibrio** sale del banco (nómina pagada) mientras el resultado
  va devengado. Es la causa de la falla de abril.
- **Piso en quetzales** para la prueba de la regla 9.
- **`Día laborados` de la planilla está vacía en los nueve meses.** Es lo único que habilita
  una vista SEMANAL de personal: hoy la mano de obra semanal es la planilla del mes dividida
  entre 4.345, el mismo número todas las semanas. Es el bloqueo del SPLH.

---

## Cierre del 17 sep 2026 (v22): seguimiento de cotizaciones de evento por correo

Sesión corta en Claude Code, solo Gmail. Se revisaron las **15 cotizaciones de evento enviadas desde el 17-jul** y se mandaron **9 correos**, todos como respuesta dentro de su hilo.

### 1. Estado del pipeline de eventos al 17-sep (solo lo que se ve en el correo)

| Cliente | Evento | Estado |
|---|---|---|
| Indira Rafael | Aniversario 25 años, sáb 19-sep, 30 pers., Q17,077.50 | Sin depósito ni respuesta desde el 12-sep (dudas de alcohol y copas). Seguimiento enviado hoy. Tel. 4220-2426 |
| Ashley & Jonathan | Cena de ensayo, lun 9-nov, 24 pers. | Lista para depositar; Juanma le respondió la cotización revisada el 17-sep |
| Krystal Nwankwo | Fiesta de bienvenida, 40 pers. | Quiso confirmar el 9-nov pero la fecha ya estaba cerrada; se le ofreció dom 8 o mar 10-nov con 5% (Q21,850) y 1 hora extra. Falta que elija |
| Jacob & Raquel | Boda, sáb 20-feb-2027, 12 pers. | Dejaron el menú de evento; se les confirmó **reserva normal a la carta**. Falta hora y teléfono, y anotarla en reservas |
| Barrie Ling | Cena de bienvenida, dom 25-abr-2027, ~75 pers. | Se le pasó el contacto de I Do Guatemala y dos videos del jardín montado. Ofrecida propuesta con comida de coctel + paquete de bebidas |
| María José Porres | Brunch, dom 29-nov, 15 pers., Q4,863.75 | Seguimiento enviado |
| Mollie & Clarisa | Restaurante completo, nov/dic, 80 pers., Q42,998.50 | Seguimiento enviado (la más grande) |
| Sparks · Louren & Kriston | Welcome event, vie 21-may-2027, 70 pers. | Seguimiento enviado |
| Adriana Valdez | Aniversario, 20-mar-2027, 40 pers. | Seguimiento enviado a adrianavaldez13@gmail.com (la otra dirección, adriana.valdez14, fue el primer envío) |
| Abigaíl Estrada | Boda civil, 22 pers., sin fecha | Seguimiento enviado; la cotización ya venció |

Cerradas: PepsiCo (realizado 12-ago), AICSA (eligieron otro lugar), Ibis & Tyler de Sparks (liberaron el 7-may-2027), Fernanda/Give Ventures y Melanie (fecha pasó sin respuesta).

### 2. Reglas que deja la sesión

1. **Tono de los seguimientos: el sencillo.** "Retomo la cotización de X. ¿Pudo revisarla? Si quiere ajustar algo, con gusto. La fecha sigue disponible y se aparta con el 50%." Juanma pidió probar el método de Chris Voss y rechazó las dos versiones: la directa ("¿Ya descartó...?") porque el estilo americano no funciona en Latinoamérica, y la suavizada ("¿Sería mal momento...?", "Me imagino que...") tampoco le gustó. No proponerlo por iniciativa propia; si lo vuelve a pedir, pedirle primero una frase que sí le suene.
2. **Los seguimientos se mandan como respuesta al último correo enviado del hilo**, nunca como correo nuevo. Se muestra el texto antes de enviar.
3. **Wedding planner de confianza: I Do Guatemala, Diana Sciarrillo.** Tel. +502 5778-2271 · weddingsinguatemala.com. Es el contacto que se da cuando un cliente pide música, micrófono o decoración (Rosanta no los ofrece).
4. **Videos para clientes de evento:** carpeta de Drive de Dani González (`1nLBVT7Jlm9NGn_Nn4Ffx1gfm-Qg5uM6p`): Boda1, Boda2, Cata de Vinos, Cocina, Jardín, Barra slow. Pesan 25-50 MB cada uno, así que **van como link, no adjuntos** (Gmail corta en 25 MB). Se manda el link del archivo, no el de la carpeta.
5. **Ojo con esa carpeta:** está compartida como "cualquiera con el link puede EDITAR". Pendiente pedirle a Dani que la baje a "puede ver".
6. **El conector de Drive no deja compartir archivos** desde la sesión (`share_file` devuelve "The caller does not have permission"). Para compartir algo con un cliente, el link tiene que existir ya o lo comparte Juanma.
7. La herramienta de Gmail agrega un "Re:" aunque el asunto ya lo tenga ("Re: Re: ..."). Es cosmético, no rompe el hilo.

### 3. Pendientes que deja

- **N1 · Indira:** llamarla si no contesta; el evento es el sábado 19 y no hay depósito.
- **N2 · Krystal:** esperar que elija 8 o 10-nov y mandar la cotización con el 5% y la hora extra.
- **N2 · Jacob & Raquel:** al recibir hora y teléfono, anotar la reserva de 12 para el 20-feb-2027.
- **N3 · Dani:** cambiar el permiso de la carpeta de videos a solo lectura.
- **N3 ·** revisar respuestas de los 6 seguimientos en una semana (24-sep).

---

## Cierre del 16 sep 2026, noche (v21): se retira la tarea `rosanta-analista-pauta-lunes`

**Juanma la borró desde la app de Cowork (Routines) el 16-sep-2026.** No era un artefacto: era la tarea de los lunes 8:08 que corría el analista de pauta contra Meta y le mandaba acciones a Vanessa. Se retira porque **el mismo análisis vive ahora en la intranet**: botón 🧠 Diagnóstico IA del Dashboard de Pauta, con Lente Loomer + AI CMO desde la @100. Una sola superficie, como en Finanzas.

**Lo que se pierde con ella, y queda como pendiente:** la tarea cerraba el círculo de aprendizaje escribiendo el hallazgo #1 de la semana en la pestaña `aprendizajes` de la Sheet Marketing OS. Desde hoy nadie escribe ese hallazgo solo. Es la misma "memoria del diagnóstico" de la v20 §3: cuando se construya, el botón de la intranet tiene que guardar el diagnóstico y su hallazgo en la Sheet.

Siguen vivas: `morning-brief-juanma`, `rosanta-reporte-semanal`, `rosanta-cierre-semanal`, `rosanta-reporte-mensual`, `auditoria-meta-ads-rosanta-mensual` (la auditoría mensual de Meta **sí** se queda: es otra cosa, mira la cuenta entera cada día 25), `rosanta-cerebro-mantenimiento`. La carpeta `~/Claude/Scheduled/rosanta-analista-pauta-lunes/` puede seguir en disco: es caché de la app y no significa que la tarea exista.

Artefactos de Cowork que quedan como candidatos a borrar (no se tocaron): `sistema-marketing-rosanta` (Marketing OS de julio, pre-intranet) y `rosanta-sistema-consolidado` (foto del 5-ago). Se borran desde la app; el cerebro se actualiza cuando pase.

---

## Cierre del 16 sep 2026, noche (v20): Diagnóstico IA con Lente Loomer, @100

**El equipo está en la @100** (verificado con `clasp list-deployments`). Dos cambios de vista en `Marketing.html`, pestaña Dashboard de Pauta, ninguno con funciones nuevas de servidor. Commits `d33890f` y `23e38ab`. **La batería no se volvió a correr para la @100** (decisión de Juanma con el aviso dado): la referencia sigue siendo la corrida de la @99, 118 OK · 0 fallas · 1 aviso · 3 saltadas.

### 1. El botón 🧠 Diagnóstico IA se subió al lado de "Actualizar"

Vivía al pie de la tarjeta "Campañas Meta", después de los dos gráficos, y Juanma lo dio por inexistente. Ahora está en la barra superior y su resultado se pinta **arriba de los benchmarks y los KPIs**. Regla: **una herramienta que hay que scrollear tres pantallas para encontrar es una herramienta que no existe.**

### 2. El diagnóstico razona con la Lente Jon Loomer y cierra con el AI CMO

Hallazgo de Juanma: las recomendaciones **no salían de ninguna lente**. Era un prompt genérico "analista de pauta" con los benchmarks de la casa, desconectado del Panel de Asesores. Desde la @100:
- Constante `LOOMER` en `Marketing.html`, copia de la metodología de la silla del Panel (estructura simple, fase de aprendizaje, creativo como targeting, frecuencia como fatiga, retargeting con exclusiones, regla Andromeda). Nombra el principio en cada juicio.
- Cierre **🎯 Veredicto AI CMO**: 3 acciones de la semana con presupuesto en Q y responsable, contra el North Star de reservas atribuidas, y qué medir en 7 días.
- **Regla de humildad temporal** aplicada: lo que dependa de mecánica actual de Meta sale con "⚠️ verificar en plataforma" y Vanessa lo valida. La tabla de campañas no trae hook rate ni retención: el prompt le exige decirlo, no inventarlos.
- Recibe alcance por campaña y el rango elegido; botón "Copiar diagnóstico" para pasárselo a Vanessa.

### 3. Pendiente que dejó el día (idea aprobada en principio, no construida)

**Memoria del diagnóstico.** Hoy se genera y se pierde; el del lunes (`rosanta-analista-pauta-lunes`, **retirada el mismo día, ver v21**) vivía en un chat. Propuesta: guardar cada diagnóstico en una pestaña de la Sheet Marketing OS (fecha, veredicto por campaña, acciones) y mostrar en el Dashboard el último con historial, para cerrar el loop de si la acción de la semana pasada se ejecutó. **No** convertir el análisis en artefacto aparte: sería una tercera superficie del mismo criterio.

---

## Cierre del 16 sep 2026, tarde (v19): Creador de pauta en la @99

**El equipo está en la @99** (verificado con `clasp list-deployments`). Trae una sola cosa: el **🎯 Creador de pauta con la Lente Savannah Sanchez**, dentro de ✍️ Creador de Contenido del Marketing OS, para Vanessa. Batería sobre ese HEAD: **118 OK · 0 fallas · 1 aviso · 3 saltadas** (122 pruebas, mismo total que la @98). El aviso es el calentador de cachés (8.3 s, Drive lento) y las 3 saltadas son las de siempre. Prueba funcional hecha por Juanma en el /dev: generó anuncios completos. Commits `c2d42e4` y `2ea5518`.

### 1. Qué es el Creador de pauta

- Vive en `Marketing.html`, pestaña `gen`, debajo de los tres generadores Kaprica, con su propio `pill-note`. Función `genPauta()`, constante `SAVANNAH`, salida en `#paOut`, borradores en la Biblioteca con 🎯. Manual actualizado (sección propia y "Quién hace qué").
- **Es un cerebro creativo aparte: KAPRICA no entra en su prompt a propósito; VOZ sí.** El orgánico nace de Kaprica (micro-historias); la pauta nace de la misma Lente Savannah que debate en el Panel de Asesores, aplicada a producir: gancho de los primeros 3 segundos, video nativo estilo UGC, el creativo es el targeting, iterar sobre ganadores, regla Andromeda (cada concepto es un video hermano distinto).
- Entradas: tema u oferta, objetivo de campaña (awareness, retargeting, conversión, evento), audiencia (turista en inglés, foodie en español, ambas), formato (video UGC 9:16, talking head Jeffry / Maco, foto 4:5, carrusel), 1 a 3 conceptos, ángulo opcional.
- Salida por concepto: gancho literal, guión con segundos, texto principal (primera línea ≤125 caracteres), titular (≤40), descripción (≤30), botón y destino, utm_content, qué medir a los 7 días (hook rate ≥40%, retención ≥10%, CTR ≥1%, CPE <Q0.05, frecuencia <3) y siguiente iteración. Cierra con nota de producción.
- **Sin funciones nuevas de servidor:** llega por `askIA → askClaudeSrv`, así que la prueba de guardas no cambió (14 llamadas `srv` revisadas). Prohibiciones dentro del prompt: "de autor", "signature", "Jardín Santa Rosa", "leña de café".

### 2. Wilson ya no colabora con Rosanta (Juanma, 16 sep 2026)

El cerebro lo tenía como "talento frente a cámara, colaborador externo" en `references/negocio.md` y de ahí se coló al desplegable del creador. **Corregido en el código (HEAD con 0 menciones) y marcado obsoleto en la referencia.** Talento a cámara: **Jeffry** (cocina y parrilla) y **Maco** (barra), o clientes reales. Regla: **los nombres de personas se verifican con lo que Juanma diga hoy, no con el cerebro**; una persona que salió del equipo puede seguir viva en una referencia meses después.

### 3. Reglas técnicas que dejó el día

1. **`invalid_rapt` en clasp = reauth.** `clasp login` lo arregla aunque diga "You seem to already be logged in"; la cuenta se confirma con `tokeninfo` (dio restaurante@rosanta.rest) y con un `list-deployments` que vuelva a contestar.
2. **La batería tardó 310 s, rozando los 6 minutos de Apps Script.** La primera corrida quedó en "Corriendo…" más de 9 minutos sin disparar el `withFailureHandler`; se recargó y la segunda terminó. Si pasa de 7 minutos, recargar, no esperar.
3. **Claude in Chrome sí opera el /dev, con límites.** Las pestañas se clican con coordenadas en píxeles CSS del viewport (1470×745 en la MacBook de Juanma), no en los de la captura escalada. **El iframe de Google bloquea el scroll y el teclado** desde la extensión (un `type` colgó el renderer 30 s): lo que queda debajo del pliegue lo prueba Juanma. La batería se lee con clic adentro, ⌘A, ⌘C y `pbpaste`; el texto sale en **latin-1**, no en UTF-8.
4. **Una plantilla se comprueba compilándola:** quitar los scriptlets `<? ?>`, extraer los `<script>` y pasarlos por `node --check` con un control negativo. Se hizo para la v99 y pasó.

---

## Cierre del 16 sep 2026 (v18): mantenimiento mensual, deriva corregida

Pasada mensual de `rosanta-cerebro-mantenimiento`. **No hubo jornada de trabajo nueva**: el contenido sustantivo del mes ya entró por las sesiones (v9 → v17, del 6 al 15 de septiembre). Lo que esta versión arregla es la **deriva entre lo que el cerebro dice y lo que existe de verdad**, verificado contra `list_scheduled_tasks` y `list_artifacts`, no contra la memoria.

### 1. Tareas programadas: la tabla de `ecosistema.md` estaba vencida

| Lo que decía el cerebro | Lo que hay de verdad (16-sep) |
|---|---|
| `rosanta-reporte-semanal` lunes 10:06 | **Lunes 16:06** (`0 16 * * 1`) |
| `rosanta-seguimiento-offsite` lunes 8:05, activa | **Apagada** (`enabled: false`) desde antes del 14-sep |
| `rosanta-dashboard-refresh` lunes 11:04 | **Ya no existe.** Coherente con que la intranet sea la única superficie del pilar 3 |
| — | **`rosanta-reporte-mensual`, día 3 a las 9:00**, existía y no estaba escrita: verifica que el mes anterior esté completo en el maestro y avisa qué falta. No calcula ni toca artefactos |

Sin cambio: `morning-brief-juanma` (L–V 6:02), ~~`rosanta-analista-pauta-lunes` (lunes 8:08)~~ (**retirada la noche del 16-sep, v21**), `rosanta-cierre-semanal` (domingos 18:03), `auditoria-meta-ads-rosanta-mensual` (día 25, 8:00), `rosanta-cerebro-mantenimiento` (día 1, 9:00).

### 2. Artefactos de Finanzas: ya no existen como artefacto

`rosanta-dre-mensual`, `rosanta-finanzas-semanal` y `rosanta-dashboard-semanal` **no están en el manifiesto**. Es la consecuencia de la decisión del 12-sep (v12 §1): **la intranet es la única superficie del pilar 3**. Quedan escritos como retirados para que nadie los busque ni los reconstruya. Tampoco está `patagonia-feb-2027` (sí `mapa-trekkings-chalten`). El último artefacto creado es del 2-sep (`rosanta-honorarios-reclasificacion`): **en dos semanas no se creó ninguno**, señal de que el trabajo migró a la intranet, no de que se haya parado.

### 3. Números obsoletos marcados donde vivían

El `−Q88,205 / −7.2%` de `references/negocio.md` estaba señalado como obsoleto en el SKILL.md desde la v16, pero **seguía escrito sin marcar en la referencia**, que es donde alguien lo iba a leer. Ya está tachado con el número vigente al lado (**Q1,288,737 de venta · COGS 34.7% · prime cost 55.0% · −Q44,650 / −3.5%**, espejo del 15-sep). Mismo tratamiento para el forecast de caja, que era el "primer entregable" del pilar y **está hecho** desde la @93 (pestaña Caja).

### 4. Regla que deja esta pasada

**El cerebro se verifica contra las herramientas, no contra sí mismo.** Tareas programadas y artefactos se leen con `list_scheduled_tasks` y `list_artifacts` antes de darlos por ciertos: las dos tablas se habían quedado en el 6-sep mientras el resto del cerebro iba por el 15-sep. Cuando una sesión retire una tarea o un artefacto, borrarlo de `ecosistema.md` en el mismo movimiento.

---

## Cierre del 15 sep 2026, tarde (v17): pestaña Caja y camino al piso

**El equipo está en la @98** · batería 119 OK · 0 fallas · 0 avisos · 3 saltadas. (verificado con `clasp list-deployments`; HEAD de 58 archivos idéntico a lo probado). La @93 trajo la pestaña Caja, la @94 el food cost sin servicio, la @95 la tarjeta real contra teórico de Profit OS (+12.3 pts jun–ago), la @96 la tanda 4, la @97 la tanda 5 y la @98 la categoría MARKETING_HONORARIOS.

### Marketing: honorarios aparte de la pauta (@98)

- **`MARKETING_HONORARIOS`**: mismo bloque Marketing del DRE que la pauta, así que el resultado no cambia; existe para que el CAC excluya honorarios **por categoría** y no por el texto del banco.
- **Vanessa Wilches** (marketing digital): 4 transferencias "BANCA ELECTRONICA" de abr–jul (~US$207/mes) y PayPal de agosto (US$190) = Q8,032. **No eran pauta.**
- **Edwin Flores** (agencia, Q2,000/mes): siempre estuvo en `SERVICIOS_PROFESIONALES` y la regla 9 descuenta sus pagos de banco. No tocarlo.
- **Meta y Google se cobran a la tarjeta del BAC**, en la **columna de dólares**: la pauta 2026 es **Q16,521**, no Q10,800. Quien sume solo quetzales pierde el Google Ads. **Las 3 saltadas de la batería están identificadas** (p162, cerrado): RECETARIO_FOTOS_FOLDER_ID sin configurar (Profit OS), "Meta (red)" que se salta a propósito (`PRUEBAS_CFG.incluirRed = true` para incluirla) y el cierre de inventario de barra sin mes abierto. Ninguna es de Finanzas.

### Tanda 4 (M9, M15, M26)

- **RAA:** `guardarRaa` escribe con `LockService`; sin candado dos guardados a la vez perdían uno.
- **El año se calcula (M15):** comparativo y metas van contra el **año anterior**, no contra 2025 fijo. `_finVentasAnio_(anio)` lee 2025 de `02b_Ventas_2025` y **2026 en adelante de `02_Ventas_Maestro`**, que sigue acumulando años (decisión de Juanma: en 2027 no se mueve nada). `_finAnio2025_` y `FIN_NOTAS_2025` se quedan porque la Caja los usa.
- **La batería dibuja las vistas de Finanzas (tanda 5, p142):** las 5 vistas en sus dos modos y el shell en sus 5 pestañas, con control negativo adentro (si dibujar una vista inexistente no falla, lo dice). Antes solo las leía crudas y un scriptlet mal cerrado pasaba en verde. Guardiana de A11: la meta de Metas tiene que ser la de PARAMETROS.
- **Cachés (M26):** `calentarCaches` calienta Finanzas y la tarjeta real contra teórico. **La respuesta de Finanzas pesa 24 KB de los 100 KB del límite: el riesgo que marcaba la auditoría no existía.**

Informe: `~/Dev/Rosanta/apps-script/_informes/2026-09-15_Finanzas_tanda2_Caja.md`.

### 1. Qué es la pestaña Caja (p94 hecho, p89 hecho)

- Intranet › Finanzas › Caja (`CajaDatos.js`, `CajaVista.html`). Calendario día por día desde el último saldo hasta hoy + 90 días, escenarios pesimista/base/optimista, fecha en que cruza cero y el colchón de **7 días de gasto** (exigido desde el día 30), y cuánta venta o costo hace falta.
- **Compromisos** en la pestaña `COMPROMISOS` de `Rosanta_Intranet_Config` (ya instalada): retiro Q5,000/mes en retiros semanales, alquiler de la casa US$1,800 cuando alcance, Raúl Q100,000 el 15-mar-2027. Aguinaldo 50% el 10-dic y 50% el 20-ene. No hay línea de crédito ni deuda fuera del banco.
- **Estacionalidad por defecto: la de 2025** (Juanma, 15-sep), con selector.
- **Es un calendario de riesgo, no una predicción de venta.** La prueba contra el pasado mostró que el costo se proyecta bien (±10%) y que el error viene de la venta.
- Proyección del 15-sep: el base **cruza cero el 26-oct**; +6.7% de venta o Q6,464/mes menos de costo lo evitan. Saldo de partida Q24,011, ya bajo el colchón.

### 2. Camino al piso decidido (p122, sigue activo)

Piso Q18,860/mes, objetivo Q27,193/mes.
1. **Septiembre y octubre: no cruzar cero**, no el piso. +6.7% de venta ≈ Q2,500 más por semana.
2. **Fecha del piso: noviembre 2026.** Con la estacionalidad de 2025 noviembre deja ~Q51,000.
3. **Mezcla: casi toda venta** (el problema es tamaño). El costo es respaldo, **solo operativo, nunca personal**.
4. **Punto de control a mediados de noviembre:** si la venta semanal no sube cerca de 40%, se activa la palanca de costo operativo.

### 2b. p96 medido (tanda 3, mismo día)

**Los "9 puntos" de p96 eran real contra META, no contra teórico.** Enero–agosto, sobre venta sin IVA ni servicio: meta 28.0% · **teórico 31.8%** · **real 37.1%**.
- **3.8 puntos** vienen de las fichas y los precios de carta.
- **5.3 puntos (Q60,926)** son la brecha real.

Detalles:
- **Agosto** es el 40% de la brecha: Q21,800 en 18 retiros de cajero sin detalle (del 11 al 29-ago, máximo Q2,000 por retiro), marcados como ALIMENTOS_EFECTIVO.
- **Base de la venta (regla 14, publicada en la @94):** la venta de Finanzas incluye el 10% de servicio y la ficha no. Desde la @94 el food cost de Finanzas, su móvil 4, la tarjeta de food del RAA y el techo de compra van sobre venta sin servicio: la base de cada ticket es Costo + Ganancia ÷ 1.12. **Prime cost, neto y DRE siguen sobre la venta total** (Juanma). Food cost del año: 34.7% → 38.3%. Batería de la @94: 111 OK · 0 fallas · 3 saltadas.
- **Tarjeta "CMV real contra teórico" del tablero de Profit OS (parte B):** `getCmvRealTeorico(auth)` en `PuenteCmv.js`, pedida aparte desde `aplicarProfitOS`. Muestra la brecha de los últimos 3 meses cerrados (≤2 merma normal, 2–4 revisar porcionado, >4 fuga; bajo −2 es dato incompleto). **Decisión de Juanma: quien no es dueño ve solo porcentajes, sin quetzales.**
- **Retiros de cajero (decisión de Juanma, 15-sep):** son compras de mercado y se quedan en `ALIMENTOS_EFECTIVO`. Lo que falta no es la clasificación sino el detalle de qué se compró (p88).
- **Eventos:** van en los dos lados, su venta y su compra.
- **No hay comida de personal.**
- **Herramientas:**
  - `revisarPuenteCmv()` en `PuenteCmv.js` da el teórico por mes;
  - el puente está en `scripts/maestro-finanzas/p96_2026-09-15/`.
- **Informe:** `_informes/2026-09-15_Finanzas_tanda3_p96_puente_CMV.md`.

### 3. Hechos de datos que no hay que re-investigar

- **La columna Saldo del BI no sirve como serie** (vacía en mayo y casi todo junio, orden intradía distinto al banco). La caja reconstruye el saldo con movimientos, anclado en el último saldo del estado de cuenta.
- **Traspasos BAC → BI:** "TF: ACH INMEDIATO/PERSONAS 900" del BAC llega el mismo día como "ACH CORSAGA" al BI (Q30,800 abr-ago). No es gasto.
- **Transferencias a la cuenta 974954208 = retiro de Juanma → PERSONAL.** Corregidas 17 filas (Q15,240). Las del 18-ago a Fernanda y Jeffry (Q1,650) son planilla → NOMINA: algunos de cocina no tienen cuenta y Jeffry les entrega el efectivo.

---

## Cierre del 15 sep 2026 (v16): Finanzas & Data OS, tanda 1

**El equipo quedó en la @92** (verificado: la @92 bajada aparte, idéntica a lo que se probó). Batería sobre esa versión: **103 OK · 0 fallas · 0 avisos · 3 saltadas**. Con la @88 las saltadas eran 2; la nueva no está identificada.

Informe: `~/Dev/Rosanta/apps-script/_informes/2026-09-15_Finanzas_tanda1.md`.

### 1. Números del año con el cálculo nuevo (espejo del 15-sep, 13:21)

Ventas Q1,288,737 · COGS 34.7% · prime cost 55.0% · **resultado −Q44,650 (−3.5%)** · fugas Q0.
- Intranet y `generar_finanzas.py` dan lo mismo al centavo.
- **OBSOLETO:** el −Q88,205 / −7.2% de `references/negocio.md`. Eran 8 meses con las reglas viejas.

### 2. Reglas nuevas del cálculo (motor y Python, las dos)

| Regla | Qué hace |
|---|---|
| 10 | Una fecha con hora se lleva a su día: de 12:00 en adelante, el día siguiente |
| 11 | Un mes sin planilla usa la última cargada. **El mes en curso lleva solo la parte de los días con venta cargada** (Juanma, 15-sep). Se acabó el 29000 fijo de la semana |
| 12 | UNIFORMES es su propio bloque |
| 13 | **Una factura con Estado "Anulado" no suma.** Se sumaban 15 anuladas, Q7,535 |

Además:
- Semanas con año (AAAAWW) y consecutivas. Las cortas y las sin venta entran a la móvil de 4, por decisión de Juanma.
- `LICORES` pasa a barra.
- Los números escritos como texto se leen.
- Un mes con gasto y sin venta suma al año.

### 3. El maestro, corregido por Juanma con scripts de simulación

- **157 fechas** (38 FEL + 119 ventas) movidas a su día verdadero.
- **p121:** 6 pagos de mercado, Q6,605, a ALIMENTOS_EFECTIVO.
- **Abogada:** la factura de Q2,000 pasa a SERVICIOS PROFESIONALES y el proveedor entra a `00_Proveedores`.
- **Retiro de mercado:** Q500 "F-TORRE CUIDAD VIEJA" del 28-06 a ALIMENTOS_EFECTIVO.

### 4. Hechos verificados que no hay que re-investigar

- **Zona horaria:** el Sheet maestro está en (GMT-06:00) Guatemala, locale es_MX.
- **Filas a 22/23 h:** eran del **día siguiente**. Verificado contra el reporte del POS (julio y S37) y el FEL de S37. Queda **OBSOLETA** la hipótesis de p120 de que el Sheet mostraba la fecha real. Nacieron por escribir la medianoche de Guatemala en un Sheet que estaba en otra zona; `cargador.js` ahora frena si las zonas difieren.
- **Proveedores que sí facturan:**
  - COMESA: 7 facturas por Q3,628, igual a lo pagado.
  - Vinos de Altura: factura como **VIÑEDOS DE ALTURA / ENTREVINOS** (NIT 74382489).
  - La Torre Q67.24: tiene su factura.
- **Elder:** Q2,285 y Q2,385 son pagos fraccionados de una factura de 2025; la regla 3 los deja fuera.
- **Anuladas sin reemplazo:** GRUPO ECO Q1,467.14 (1-abr) y Los Alpes Q1,500 (25-ene). Son errores del proveedor y quedan fuera.

### 5. Decisiones de Juanma del día

- **Pago a Raúl:** Q100,000 el **15 de marzo de 2027**.
- **Máquina de agua de GRUPO ECO:** la mensualidad bajó de Q1,467.14 a **Q1,250**, negociado.

### 6. Reglas técnicas nuevas

1. **En el maestro, una fecha se escribe como TEXTO `AAAA-MM-DD`.** `setValue(new Date(...))` no cambió 37 celdas del FEL y no dio error; como texto entraron a la primera.
2. **Un script de datos relee lo que escribió** (`flush` y lectura en la misma corrida). El primer "157 escritas" era mentira para 37 filas, y solo lo destapó volver a correr la revisión.
3. **El total de la batería sube al agregar pruebas.** Si suben las saltadas, pedir las líneas antes de publicar.

### 7. Pendiente del pilar

- **Tanda 2** (p94 pestaña Caja + p122). Faltan respuestas de Juanma:
  - línea de crédito;
  - aguinaldo;
  - deuda fuera del banco;
  - mezcla entre vender más y bajar costo;
  - fecha para llegar al piso.
- **Tandas 3-5:** p96, robustez y batería.
- Identificar las 3 saltadas.
- Actualizar en el tablero p15, p120 y p121.

---

## Cierre del 14 sep 2026 (v15): la intranet de Profit OS

**Estado al cierre: el equipo está en la @88** (verificado con `clasp list-deployments`). Batería
sobre esa versión: **89 OK · 0 fallas · 2 avisos · 2 saltadas (93 pruebas)**. Los dos avisos no
son errores: el calentador de cachés tardó 6,7 s (Drive lento; avisa arriba de 5 s) y el cierre
de inventario propone bajar el **Tomate Ciruelo de Q7 a Q5 (−28,6%)** en el Banco.

Tres versiones en el día, para no confundirlas:

| | Qué trajo | Batería |
|---|---|---|
| v86 | recetario sin recarga | 89 OK · 0 fallas · 1 aviso (92) |
| v87 | la "regla 9" de Finanzas, creada por OTRA sesión y nunca desplegada sola | — |
| **v88** | meta 28% sin IVA desde PARAMETROS (**idéntica a la 87 + lo mío**, ver §4) | **89 OK · 0 fallas · 2 avisos (93)** |

### 1. Auditoría completa de la intranet

- Informe con archivo y línea: `~/Dev/Rosanta/apps-script/_informes/2026-09-14_Auditoria_intranet_Profit_OS.md`.
  Página: https://claude.ai/artifact/DGJDtLYyHGaiaNiG2DeNGB
- **7 críticos, 24 altos, 30 medios.** Causa raíz principal: el despliegue es `access: ANYONE` +
  `executeAs: USER_DEPLOYING`, así que **toda función global sin guion bajo final se puede llamar
  con `google.script.run` desde cualquier página del despliegue, incluida "Esta puerta está
  cerrada"**, ejecutándose como Juanma. Había 52 públicas sin guarda. **La batería no lo ve:**
  solo audita las funciones que las vistas nombran.
- **Cerrados hoy:** C5 (registrar precio sin área: el ajo de barra pisaba el de cocina y sala
  escribía en cocina), A11 (Metas usaba su copia congelada de la meta), A12 (tres food cost
  distintos), M25 (cada export del POS borraba el caché del recetario), Higiene en 40 s.
- **Siguen abiertos, en este orden:** C1 las nueve escrituras de `EdicionRecetario.js`/`CrearFicha.js`
  aceptan el ROL que manda el cliente · C2 `fijarUrlIntranet` pública (secuestro de enlaces y
  tokens) · C3 `aplicarSincronizacion`/`sincronizarPreciosDeCierre` públicas y `APLICAR_SYNC.js`
  sin bandera · C4 Marketing OS: `store()` → `mktReplace` pisa piezas, carritos, propuestas y
  debates con el localStorage del dispositivo · C6 `LICORES` suma al COGS pero no al techo de
  barra · C7 fugas de lectura por funciones públicas. Arreglo general: sufijo `_` a lo que ninguna
  vista llama, guarda de dueño a lo de editor, y una prueba que enumere `globalThis`.

### 2. El recetario ya no recarga la página (v86)

- **Síntoma de cocina:** cada ingrediente agregado dejaba la pantalla en blanco ~45 s. **Causa:**
  toda escritura terminaba en `invalidarCache_()` (borraba el modelo cacheado) y la pantalla
  hacía `location.reload()`: la recarga reconstruía leyendo las dos hojas enteras (~40 s). Una
  receta de 8 ingredientes con 2 productos nuevos eran más de 8 minutos en blanco. Registrar
  un precio, ~80 s.
- **Ahora:** la escritura ANOTA qué tocó (ficha, producto, precio), relee solo eso, corrige el
  modelo cacheado y lo devuelve en `cambios` (`conCambiosDeModelo_`, `aplicarToques_`,
  `parchearCacheCosteo_` en `CosteoDatos.js`). La pantalla corrige su copia (`aplicarCambios`),
  guarda en una fila de a uno con una píldora "Guardando en la hoja…", abre la ficha nueva en el
  acto y ofrece crear un producto que no está en el Banco sin salir de la receta. Enter carga rápido.
- **Bugs corregidos de paso:** crear un producto o proveedor parecido a otro no hacía nada ni
  preguntaba (la pregunta viaja dentro de `resultado` y la pantalla miraba el `ok` de afuera);
  registrar precio escribía "Sin proveedor" encima del proveedor del Banco.
- **Reglas para no romperlo:**
  1. Una escritura nueva del recetario llama `invalidarCache_({ficha|insumo|precio, area})`.
     A secas cuenta como "no se sabe qué cambió" y borra el caché.
  2. `enlazarModelo_` (servidor) y `enlazarModelo` (`CosteoJs_Base.html`) son copias.
  3. **La fila de guardado es obligatoria:** dos `agregarLinea` simultáneos eligen la misma fila
     libre y se pisan; una inserción corre los números de fila. Por eso la pantalla no deja editar
     cantidades de una ficha con algo en fila y el servidor verifica `exigirMismaLinea_`.
  4. Marca de generación del caché: una reconstrucción de 40 s que se cruza con un guardado no
     guarda el modelo viejo.
- Informe: `~/Dev/Rosanta/apps-script/_informes/2026-09-14_Recetario_sin_recarga.md`.

### 3. Meta de food cost: 28%, sobre precio sin IVA, de un solo lugar (v88)

**Decisión de Juanma (14-sep-2026):** CMV sobre precio **neto**; meta **28%** global y de cocina;
barra **20% plana**. **OBSOLETO:** el "30% fijo" del 10-sep, el techo "cocina 30", la tabla
`metasBarra` por categoría (20 a 35%) y `FIN_META_AREA` (ya no existe).

- **Una sola fuente:** `Rosanta_Intranet_Config` › `PARAMETROS` › `food_cost_objetivo_pct` = **28**
  (Juanma ya la cambió) y `food_cost_barra_pct` (la fila no existe: vale 20). Las lee
  `metasFoodCost_()` en `ConfigCosteo.js`, y de ahí salen el semáforo y el techo de compra de
  Finanzas, las fichas, la ingeniería de menú, el tablero y las fichas nuevas.
  `generar_finanzas.py` usa `meta_cogs = 28.0`.
- **El CMV de la ficha subió ~12%** (26,5% → 29,7% el mismo plato): ahora es igual al tablero.
  Precio sugerido = precio de carta con IVA que deja el CMV sin IVA en la meta.
- **Las fórmulas de las hojas NO cambiaron:** la celda "CMV % ACTUAL" de cada pestaña sigue sobre
  precio con IVA y no coincide con la intranet. "Sobre meta" sigue marcando desde meta + 5 puntos.
- Números de control de la batería pasados a sin IVA (×1,12): ensalada 16,8 · tabla de jamones
  25,3 · gratín 22,2 · mix de fritas 26,4 · peras 22,1.
- **Una meta dentro de un cálculo cacheado es una meta vieja.** Para que cambiar la celda se vea
  en el acto hubo que meter la meta en la clave de tres cachés (tablero `claveProfitOS_`,
  Finanzas `finCacheClave_`, RAA) y renombrar el de parámetros a `fin_par_v2_` con 10 min en vez
  de 6 h: la versión anterior había dejado el 30 guardado 6 horas bajo el mismo nombre, y la
  batería leyó 30 con la celda en 28.

### 4. La v88 salió con código de otra sesión que la batería no había probado

Otra sesión subió la **regla 9 de Finanzas** —siete proveedores que siempre facturan por FEL
(EEGSA, Claro, Doorways, Posfile, EX Security, Edwin Flores, Aseguradora La Ceiba): su pago de
banco o tarjeta no suma; quita **Q49,629 de doble conteo del 2026**— y creó la v87 a las ~21:50,
**después** de la batería de Juanma. La v88 quedó idéntica a la 87. Se verificó HEAD == disco ==
git y dio verde porque git ya tenía ese commit. Juanma corrió la batería sobre lo publicado:
0 fallas, la prueba nueva de la regla 9 en OK. **Queda publicada y probada.**

### 5. Reglas nuevas, cada una de algo que pasó hoy

1. **Antes de `create-version`, `clasp list-versions`:** si la última no es la publicada, otra
   sesión versionó algo. Y comparar HEAD contra la bajada del momento de la batería, no solo
   contra el disco.
2. **Una verificación que baja 0 archivos da el mismo verde que una que bajó todo.** clasp falló
   con `ENOTFOUND` (sin red), la bajada quedó vacía y el comparador dijo "HEAD == disco". Exigir el
   conteo: 66 archivos.
3. **Si el total de la batería sube y los OK no,** alguna prueba pasó de OK a aviso: pedir las
   líneas, no suponer.
4. **Probar escrituras sin batería:** se armó un simulador de hojas en Node que evalúa las
   fórmulas de las fichas y corre el código real del servidor y de la pantalla (53
   comprobaciones). Quedó en el scratchpad de la sesión, no en el repo.

### 6. Pendientes que deja

- Tomate Ciruelo Q7 → Q5: confirmar con Jeffry y, si es real, Productos › Registrar precio.
- Los 6 críticos abiertos de la auditoría (§1).
- Las hojas de las fichas siguen mostrando CMV con IVA; la banda +5 de "Sobre meta"; cada llamada
  al servidor lee la hoja USUARIOS entera (~0,5 s).

---

## Cena Romántica y cuenta de cobro (12 sep 2026 · noche, v14)

- **Cena Romántica para Dos: Q900, valorada en Q1,120.** La de **Q800 / valorada en Q1,000 queda OBSOLETA**. Contenido: Pulpo a la parrilla, dos Lomitos a la Parrilla (lomito de la casa), postre para compartir, botella de Cabernet Sauvignon y decoración. Reserva con 24 h. **Anticipo 50% = Q450** por transferencia; el resto, el día de la cena. Detalle y la advertencia del cálculo (a carta suma Q1,075) en `references/negocio.md` › Menú.
- **Cuenta BAC Monetaria de cobro a clientes: `904802543`** (9 dígitos, confirmada contra los estados de cuenta del BAC). El Doc del bot tenía `9048025432`, que **estaba mal** y la usaban las gift cards.
- **El bot lee su conocimiento del Google Doc `1a85WPjmr5e_Lybc8Mzw1YH38cBWsGc5mSgK00cmeY6I` en vivo, con caché de 10 min** (`Code.js` › `getKnowledgeBase`). Cambiar un precio para el bot = editar ese Doc; no hace falta publicar código. El `.md` de `00_Admin/Apps_Script_e_IA/` es solo una copia de referencia y el bot **no** lo lee. El conector de Drive de Claude **no puede editar el cuerpo de un Doc** (solo título y carpeta): se edita desde el navegador.
- **Web actualizada a Q900 por Juanma (12 sep 2026)**, a mano en Wix. **Ojo:** `sitio-wix/cargar-tanda3.js` todavía trae el texto de Q800; si se vuelve a correr ese cargador, pisa el precio nuevo.
- **Carta del bot = carta 2027 (12 sep 2026).** Fuente: `04_Profit_OS/Ingenieria_de_Menu/MENU_Legado/MENUS_VF/Cartas - Menu 2027/Menu ES 2027 VF.pdf` (19-ago, la más reciente; trae **dos lomitos: Lomito Rosanta Q190 y Lomito de la Casa Q180**) y `Menu Vinos 2027.pdf` (copa Q70, botellas Q350–Q535). Decisiones de Juanma: **en el bot solo llevan precio los platos y los vinos**; cócteles, licores, cervezas y bebidas sin alcohol se mencionan como "amplia carta de licores por copa y por botella", **sin precios**. **Postres: sin lista**, "según los productos de temporada".
- **Precio mínimo de cualquier copa: Q70, confirmado por Juanma (12 sep 2026).** Vale igual para licores y vinos. Queda obsoleto lo que dice el POS del 24-ago (Botran Q50, Colonial Q60, etc.). Los precios por copa de cada licor salen del checklist del 30-ago (`2026-08-30_Actualizacion_POS_Checklist.html`), que ya no hay que tratar como propuesta. En el bot los licores siguen **sin precio**, por decisión de Juanma.

---

## Regla dura: un proveedor se identifica por NIT (14 sep 2026)

**Nunca filtrar facturas por un pedazo del nombre del emisor. El identificador es el
NIT**, que es el identificador tributario y es único. Regla dada por Juanma.

Se paga con un ejemplo real. El 12-sep se movieron **23 facturas por Q11,845.10** de
`COCTELERIA` a `ALIMENTOS` con un filtro `"LICO" in Nombre_Emisor`, creyendo que eran de
Migdalia Lico. Hay **tres** proveedores cuyo nombre contiene "LICO":

| Emisor | NIT | Establecimiento |
|---|---|---|
| MIGDALIA AZUCENA, LICO LÓPEZ | 110989163 | Distribuidora de Alimentos Los Alpes |
| CRISTINA, ANONA LICO | 52496325 | Doña Mina y Don Rolando (verduras) |
| DISTRIBUIDORA DE **LICO**RES, S.A. | 345377 | **LA NACIONAL** |

Las 23 eran del tercero: **un distribuidor de licor**. Entró compra de licor al food
cost, que es el número que se mide contra la meta de 28% (30% hasta el 14-sep). Los NIT no se parecen en nada:
con el NIT el error era imposible.

**Y ojo con los tres primeros:** Juanma dejó de comprarle a Migdalia y hoy le compra a
**Anona** (Doña Mina y Don Rolando). Son proveedores distintos de verdura, no el mismo
con otro nombre.

Dos corolarios que también costaron:

- **Un número que se mueve mucho después de un cambio propio no es un hallazgo.**
  "La coctelería estaba inflada en más de un tercio" no era un descubrimiento: era el
  efecto de haberla vaciado. Antes de reportar un salto, descartar que lo haya causado
  uno mismo.
- **No bundlear un juicio nuevo dentro de una corrección.** Al revertir un error se
  restaura el estado anterior exacto; si además hay dudas sobre si ese estado era el
  correcto, eso es una decisión aparte y se toma aparte.

## Cierre del 12 sep 2026 · tarde (v13)

Sesión de limpieza de pendientes. **De 35 activos a 23.** Lo que sigue no es el listado —
ese vive en el tablero— sino lo que cambió de entender.

### Lo que se cerró tocando producción

- **La encuesta de satisfacción dejó de escribir en la hoja de un tercero.** Caía en
  `Recolección de data - Rosanta`, propiedad de `Eli_Juli@lacocinaquesuena.com`, con quien
  Rosanta ya no trabaja. Se copió a
  `05_Marketing_OS/Resenas_y_Reputacion/Rosanta_Encuesta_Satisfaccion`
  (`1zZuqsBgjC3hYRJfdXe6zz8SxYCNbMBtBDvc3qy1nPf0`) y se publicó en la **v5**.
- **Las tres URLs de `Config.gs` de la intranet** perdieron el prefijo `/a/macros/rosanta.rest/`,
  y hay una prueba nueva que falla si vuelven a torcerse. **Publicado en la v82.** El mismo push
  sacó del proyecto vivo los 6 diagnósticos archivados: quedan 7 scripts sueltos, no 13.
  *Al verificar un redeploy, releer `clasp list-deployments` hasta que confirme: el primero
  después del redeploy todavía decía @81.*
- **La documentación del cargador** ya vive en `00_Instrucciones` del maestro, filas 77-97,
  y esa hoja ahora dice **16 hojas**, no 14.
- **6 diagnósticos de un solo uso** salieron de `rosanta-intranet` a `_archivo/`.

### Reglas nuevas, cada una pagada con un error de hoy

1. **`prop_('X') || defecto` significa que el defecto es el ÚLTIMO recurso, no el valor.**
   El primer arreglo de la encuesta respetaba la propiedad `SHEET_ID` ignorando solo el id
   ajeno exacto. Se publicó, se envió una respuesta real y la fila cayó **igual** en la hoja
   del tercero: la propiedad tiene ese id en una variante que `===` no atrapa, y no se puede
   leer desde fuera del editor. Cuando una propiedad de script puede pisar un valor crítico y
   no se puede leer, **dejar de consultarla**.
2. **Leer el código no prueba dónde cae el dato.** Lo único que lo probó fue mandar una
   respuesta de verdad por el formulario y mirar el `modifiedTime` de las **dos** hojas.
3. **Documentación que vive en el repo no existe para quien usa la herramienta.** Mismo
   patrón dos veces hoy: el texto del cargador en `_informes/`, y un puntero `.gsheet` en
   `CRM_y_Retencion` que seguía abriendo la hoja ajena aunque el código ya estaba corregido.
   **Al corregir un destino, barrer también los punteros de Drive.**
4. **Una guarda que vigila una instancia de un problema que tiene tres da la misma sensación
   de cubierto que una que las vigila todas.** La prueba del `/a/` existía desde el 10-sep y
   estaba bien escrita: miraba `INTRANET_URL` y no las otras dos URLs del mismo archivo.
5. **El texto de un pendiente es una afirmación vieja, no una fuente.** Hoy fallaron cuatro:
   `p143` llamaba "scripts de un solo uso" a 7 herramientas que el código vivo manda a correr;
   `p80` decía que seguía expuesta una key que estaba en Propiedades desde el 31-ago; `p71`
   proponía como palanca gratis algo que ya tenía su propio canal; `p110` apuntaba a una hoja
   donde el dato no está.
6. **Preguntar "quién es este proveedor" y cotejar contra la hoja vale más que cualquiera de
   las dos cosas por separado.** De siete identificaciones que dio Juanma, cuatro cuadraban y
   **tres no**, y ninguna de esas tres estaba marcada como pendiente.
7. **Un `for` de zsh sobre una variable sin comillas no separa la lista.** Un chequeo de
   seguridad devolvió "limpio" sin haber leído un solo archivo. Un verificador que no encuentra
   nada porque no leyó nada da el mismo verde que uno que leyó todo.

### Antes de preguntar quién es un proveedor, leer `Establecimiento`

**`01_FEL_Maestro` tiene una columna `Establecimiento` y está poblada en las 1,018 facturas,
sin una sola vacía.** `Nombre_Emisor` trae el nombre legal o de la persona; `Establecimiento`
trae el nombre comercial. Hay **107 proveedores** donde los dos no coinciden.

Los dos "destinatarios sin identificar" de `p102` estaban ahí todo el tiempo:
`GRUPO AGMN, S.A.` → **Clínica de Fisioterapia Roca**, y
`Edi Joaquín Gaitán García` → **Alquifiestas MEG**. El pendiente mandaba al Histórico
transaccional del banco para algo que estaba en la columna de al lado. Y Migdalia Lico figura
como **Distribuidora de Alimentos Los Alpes**: el nombre comercial decía "alimentos" mientras
23 de sus facturas vivían en `COCTELERIA`.

### Finanzas: lo que apareció y todavía no se escribió

**Hay un lote de 39 reclasificaciones subido a `rosanta-maestro` y SIN CORRER.** Está en
`reclasificar_sin_clasificar.js`. Empezó siendo 3 filas y creció a 39 al cotejar proveedores:

| Qué | Filas | Monto |
|---|---|---|
| Migdalia Lico, `COCTELERIA` → `ALIMENTOS` | 23 | Q11,845.10 |
| GRUPO ECO, `BEBIDAS` → `ALQUILER_EQUIPO` | 2 | Q2,717.14 |
| Jonas Dobias (BAC), → `PERSONAL` | 2 | Q2,000.00 |
| Alquifiestas MEG, `MANTENIMIENTO…` → `EVENTOS` | 6 | Q2,241.00 |
| Las 3 originales de `p119` | 3 | Q7,611.25 |

Para correrlo: `revisarSinClasificar()` **y leer el log**; solo si dice "Sin avisos",
`reclasificarSinClasificar()` y después **`generarEspejo()`**.

- **GRUPO AGMN, S.A. = Clínica de Fisioterapia Roca.** Se identificó desde el propio FEL, sin
  pedirle nada al banco: 17 facturas cuyos pagos del BAC calzan el mismo día y por el mismo
  monto. Estaba como `VIATICOS`/`Es_Personal=No` en el FEL y `PERSONAL`/`Sí` en el BAC — **el
  mismo gasto con dos clasificaciones opuestas en dos pestañas.** Juanma ya lo corrigió.
- **El desfase horario (`p120`) dejó de ser teórico.** `reclasificar_ECO.js` del 4-sep movió
  8 de las 10 mensualidades del alquiler de la máquina de agua; la del **31/03 23:00**, que
  Apps Script lee como 01/04, quedó fuera de la lista y sigue en `BEBIDAS`. El script reportó
  éxito sobre las 8 que sí estaban en su lista.
- **Los Q21,000 del 04/02 quedan sin explicación** (`p101` cerrado): el banco ve lo mismo que
  nosotros. Ya están como `PERSONAL` y caen fuera de la ventana may-ago, así que no mueven la
  extracción medida.

### Verificado y que conviene no volver a dudar

- **El activador de `latido()` existe y corre**: última corrida lunes 8 sep 09:30, 0% de error.
  Se ve **solo** en la página de Activadores del editor — ni `clasp` ni la API los listan, y
  buscar el correo de fallo no sirve porque `latido` avisa lanzando excepción: si nunca
  encontró nada frío, nunca hubo correo.
- **El QR manda a Google y los correos del día después mandan a TripAdvisor.** Son dos canales
  distintos y no hay nada que reasignar (`p71` cerrado por decisión de Juanma).
- **Solo Juanma tiene acceso a la hoja `Rosanta Marketing OS`**, así que el token de Meta en
  `config!A1` queda como riesgo aceptado y entendido (`p80` cerrado).

## Cambios clave del 12 sep 2026 (v12)

Dos frentes en paralelo: **la unificación del pilar 3 en la intranet** (hecha por las
sesiones de Finanzas y Profit) y el cierre de la arquitectura de archivos. Detalle completo
en `Rosanta OS/03_Finance_Data_OS/2026-09-12_Unificacion_Intranet.md`.

### 1. La intranet es la ÚNICA superficie del pilar 3

Motor único: **`FinanzasDatos.gs`**, que lee el Sheet nativo del maestro **en vivo**. Toma la
meta de food cost y el tipo de cambio de `PARAMETROS`, y la planilla devengada del Sheet de
planilla (una pestaña `AAAA-MM` por mes). Con eso quedan **resueltas** dos alertas viejas: la
meta de 27.8 mal puesta en la intranet y la planilla escrita en dos lugares.

**Pantallas nuevas:** RAA (pestaña `RAA` en **`Rosanta_Intranet_Config`**, no en el maestro,
creada con `instalarRAA()`) y **Escenarios**, que reemplaza al artefacto `rosanta-dre-mensual`.

**El panel pasó de 5 tarjetas a 3 puertas** (Finanzas & Data · Profit OS · Sistema de
Marketing), con el shell `SistemaFinanzas` y su lateral: La semana · Metas · 2026 contra 2025
· Escenarios. `CosteoVista.html` se partió de 2.000 líneas en **11 parciales**, con la
reconstrucción verificada byte a byte, y se archivaron **3 `.gs` duplicados** que tenían 31
funciones globales repetidas — ahora 0. Detalle en
`~/Dev/Rosanta/apps-script/_informes/2026-09-12_Unificacion_intranet.md`.

**Jubilados el 12-sep:** `generar_dashboard.py` (a `_archivo/`), los `Rosanta_Dashboard*.html`,
la tarea de Cowork `rosanta-dashboard-refresh` (borrada) y el artefacto
`rosanta-dashboard-semanal`. **~~`generar_finanzas.py` se queda como validador A/B~~ (OBSOLETO: retirado el 27-sep-2026, ver v31)**: era el mismo
cálculo por otro camino —espejo `.xlsx` y Python contra Sheet nativo y Apps Script— y si los
dos dan distinto, uno se desvió. Es la única comprobación independiente que hay.

**Versión: v81 publicada el 12-sep-2026.** Batería **88 OK · 0 fallas · 0 avisos · 2 saltadas**
(90 pruebas). Las tres versiones del día, para no confundirlas:

| | Qué trajo | Batería |
|---|---|---|
| v79 | unificación: panel de 3 puertas, shell `SistemaFinanzas`, Finanzas con planilla y RAA | 90 · 0 fallas |
| v80 | token en las tres funciones del CRM y las pruebas nuevas (srv, corchetes, grupo 8) | 91 · 89 OK |
| **v81** | doble cabecera del shell y retiro de la prueba vieja de corchetes | **90 · 88 OK** |

El token funciona de punta a punta, verificado con el enlace de Jeffry.

> **Qué está probado y qué no, al cierre del 12-sep.** Lo verificado es que **el token
> funciona**: con el enlace de Jeffry en incógnito la intranet saluda "Hola Jeffry · rol:
> chef" y le muestra **solo Profit OS**. Esa misma pantalla es evidencia de que Jeffry **no**
> tiene `crm`, `marketing` ni `contenido` — si los tuviera, vería esas puertas.
>
> **Lo que NO está probado es el CRM con un Gmail real.** Hubo un reporte de que el CRM
> cargaba con el enlace de Jeffry, pero contradice la captura y el código: `?page=crm` exige
> `usuarioTieneModulo(usuario, 'crm')` (Code.js:165) y la puerta de Marketing exige
> `marketing` o `contenido` (Code.js:92). Lo más probable es que esa prueba corriera sobre la
> sesión de Juanma. **La prueba definitiva, pendiente:** enlace de Jeffry en incógnito
> **sin ninguna sesión de Google**, con `&page=crm`.

**Pantallas nuevas:** RAA (pestaña `RAA` en **`Rosanta_Intranet_Config`**, no en el maestro,
creada con `instalarRAA()`) y **Escenarios**, que reemplaza al artefacto `rosanta-dre-mensual`.

**El panel pasó de 5 tarjetas a 3 puertas** (Finanzas & Data · Profit OS · Sistema de
Marketing), con el shell `SistemaFinanzas` y su lateral: La semana · Metas · 2026 contra 2025
· Escenarios. `CosteoVista.html` se partió de 2.000 líneas en **11 parciales**, con la
reconstrucción verificada byte a byte, y se archivaron **3 `.gs` duplicados** que tenían 31
funciones globales repetidas — ahora 0. Detalle en
`~/Dev/Rosanta/apps-script/_informes/2026-09-12_Unificacion_intranet.md`.

### 2. Reglas técnicas nuevas (cada una de un incidente del día)

> **Todas son la misma regla vista por otra puerta: reconocer un patrón no es verificar.**
> El 12-sep se cometió cuatro veces en un día. La batería pasaba en verde porque buscaba
> `run.nombre(` y la llamada usaba corchetes. Un barrido dijo que el CRM estaba abierto
> porque buscaba `exigirModulo_` y la convención del repo era `requiere*_`. Se dio por hecho
> que Dev era un repo git por ver un `.git` sin mirar de quién era. Y se estuvo a punto de
> rehacer el panel entero por un iframe que salía vacío **solo** en la ventana de
> automatización. Cuando algo se da por bueno, **abrir el contenido**: el cuerpo de la guarda,
> el destino del `.git`, el navegador de la persona.

1. **Una guarda se verifica LEYENDO SU CUERPO, no reconociendo su nombre.** Los dos errores
   se cometieron el mismo día, uno en cada dirección. Método: (1) encontrar la llamada,
   (2) confirmar que se le pasa `auth`, (3) abrir el cuerpo y confirmar el `throw`.
2. **Una prueba que compara tiene que saltarse o fallar cuando no hay nada que comparar.**
   Una comparación sin datos que devuelve "igual" es una prueba en verde que no probó nada.
3. **Publicar = `create-version` + `update-deployment`, sin `push`**, y con HEAD verificado
   bajándolo aparte y comparando.
4. **Las carpetas de `~/Claude/Scheduled/` NO reflejan qué tareas existen.** Manda la app: una
   tarea borrada deja su carpeta en disco. No inventariar tareas leyendo esa carpeta.

### 3. Pendientes que deja el pilar 3

- Pegar en Cowork la tarea mensual nueva, que **verifica el cierre y avisa, sin calcular
  números** (`03_Finance_Data_OS/2026-09-12_Tarea_reporte_mensual_v2.md`).
- Actualizar el prompt del forecast de caja (p94), que todavía apunta a los JSON viejos.

### 4. Dos números de food cost que NO son el mismo, y conviven a propósito

> **OBSOLETO desde el 14-sep-2026 (v15):** la meta pasó a **28%** (global y cocina) y barra
> **20% plana**, y las dos salen de `PARAMETROS` por `metasFoodCost_`. `FIN_META_AREA` ya no
> existe. Siguen siendo dos usos distintos —el semáforo mide, el techo limita la compra—, pero ya
> no son números escritos a mano en dos lugares. La tabla de abajo queda como historia.

Decidido por Juanma el 12-sep-2026. **No reproponer unificarlos.**

| | Valor | Qué es |
|---|---|---|
| **Meta global de food cost** | **30% fijo** | el **semáforo**: contra qué se mide el resultado. Vive en `PARAMETROS!food_cost_objetivo_pct` |
| **Techo de compra por área** | **cocina 30 · barra 20** | la **herramienta de compra**: cuánto se puede comprar esta semana. Vive en `FIN_META_AREA` de `FinanzasDatos.gs` |

El primero mide lo que pasó; el segundo limita lo que se va a gastar. Que la barra tenga un
techo más bajo que la meta global no es una inconsistencia: es que la barra deja más margen y
su compra se aprieta más. No hubo que tocar código — `FIN_META_AREA.barra` ya valía 20.

---

## Cambios clave del 11 sep 2026 (v11)

Día de **arquitectura de archivos**, no de negocio. Ningún número del DRE cambió. Lo que
cambió es dónde vive cada cosa y qué lo vigila. Reportes en
`Rosanta OS/00_Admin/Auditorias/` (carpeta nueva): `2026-09-11_Guardian.md`,
`_Duplicados.md`, `_Inspeccion_carpeta_Claude.md`, `_Conversion_punteros.log`,
`_Rescate_Documents.log`, `_Sesion_Code.log`.

### 1. Rosanta OS es la puerta única (regla 0 nueva del README)

Se agregaron dos **alias** en la raíz de `~/My Drive/Rosanta OS/`:

- `_Codigo` → `~/Dev/Rosanta`
- `_App` → `~/Claude`

Abrir `Rosanta OS` ahora muestra todo: los 6 pilares, el código y la carpeta de la app.
**Son symlinks a propósito y tienen que seguir siéndolo.** Si alguna se convierte en
carpeta real, Drive Desktop empieza a sincronizar los `.git` y `node_modules` de adentro
y corrompe los repos. El guardián revisa las tres cosas —que existan, que sean alias y
que apunten a donde deben— y cualquiera de las tres sale como crítica.

**Por qué NO se movieron Dev ni ~/Claude adentro de Drive:** `Dev` tiene dos `node_modules`
(466 archivos que npm reescribe seguido) y `~/Claude` toca ~19 archivos por día él solo. Un
sincronizador encima de eso produce archivos `(1)` y carpetas corruptas.

> **RESUELTO el 12-sep-2026: `~/Dev/Rosanta` YA es un repositorio git.** Primer commit
> `00eae34`, 465 archivos, rama `main`, identidad local al repo. Fuera del historial:
> `node_modules/`, `_backups/`, **`clasp-creds.json`** (cliente OAuth con `client_secret`) y
> `tools/ui-ux-pro-max-skill/` (repo de terceros). `_archivo/` sí entra: es historia de código.
> **El `.gitignore` se escribió ANTES del primer `add`** — sacar un secreto del historial
> después es mucho más trabajo que ignorarlo antes. **Desde ahora: `git status` antes de
> escribir y `git diff` para ver qué tocó otra sesión.**
>
> El texto de abajo queda como registro de por qué hizo falta:
>
> **Hasta el 12-sep-2026 `~/Dev/Rosanta` NO era un repositorio git.**
> `git rev-parse` contesta "not a git repository". El único `.git` en todo Dev está en
> `tools/ui-ux-pro-max-skill/`, que es una skill de terceros y no cubre nada de Rosanta.
> **Ningún código de Rosanta tiene control de versiones**: ni la intranet, ni el maestro, ni
> el sitio. La única red son los respaldos manuales de `_backups/`, que son voluntarios —
> el 12-sep se modificó `SistemaFinanzas.html` sin dejar uno.
> Eso importó ese día: **cinco sesiones escribían `rosanta-intranet` a la vez.** Si dos tocan
> el mismo archivo, gana el último que guarda y no queda rastro. Ver el pendiente abierto.

### 2. Cero código ejecutable en Drive

Se archivaron **73 archivos** `.gs/.js/.ts/.py/.sh` a `_Archive/Guardian_2026-09-11/`,
conservando la ruta relativa. Nada se borró. Hoy quedan **0** fuera de `_Archive/`.

Los **dos generadores del maestro se mudaron** a `~/Dev/Rosanta/scripts/maestro-finanzas/`:
`generar_finanzas.py` y `generar_dashboard.py`, más un `rutas.py` que es lo único que sabe
dónde están los datos (`--datos RUTA` > `ROSANTA_MAESTRO_DIR` > el default en Drive).
**El espejo, `_datos_finanzas/` y los dos `Rosanta_Dashboard*.html` siguen en Drive**: son
datos y entregables. Verificado A/B contra el mismo espejo: las seis salidas, byte a byte
idénticas.

### 3. Tres herramientas nuevas en `~/Dev/Rosanta/tools/`

| Herramienta | Qué hace |
|---|---|
| `guardian-estructura/` | valida las 7 reglas del README en <1 s sobre los ~6.800 archivos. Solo reporta; `--fix` mueve a `_Archive/` o `_Inbox/` y `--realias` repara los alias rotos. **Ninguno borra.** Los dos tienen su `--dry-run-*` |
| `duplicados/` | hashea por contenido (md5) y agrupa; solo reporta |
| `convertir-punteros/` | `.gdoc/.gsheet/.gslides` → `.docx/.xlsx/.pptx` al lado del puntero, sin borrarlo |

### 4. Los punteros de Google

En Rosanta OS hay **426 punteros** (131 `.gdoc`, 291 `.gsheet`, 3 `.gslides`, 1 `.gform`).
Un `.gdoc` es un JSON de ~180 bytes con el ID: **Cowork y Claude no lo pueden leer.**

Se convirtieron **12** (los que Cowork necesitaba, venían del knowledge de claude.ai).
Quedan **374 sin archivo real al lado**, listados por pilar en el reporte del guardián.
**No convertirlos en bloque:** muchos `.gsheet` son hojas vivas que Juanma edita en Google,
y una copia `.xlsx` al lado se desactualiza el mismo día. Se convierte por demanda.
`.gform` no se puede exportar a Office (403).

**Un alias no guarda información.** `Documents/Claude/Projects/Rosanta Pauta` son 70 bytes
que apuntan a `05_Marketing_OS/Workspace_Pauta` (143 archivos, 19 MB). No hay copia ni
duplicado: es la misma carpeta vista por otra puerta. Borrar el alias no libera nada y
desvincula el proyecto de Cowork — si un proyecto ya no se usa, se elimina **desde la app**,
que se lleva el alias con él.

**Auth:** `clasp-creds.json` es solo un cliente OAuth — no trae tokens ni scopes — y el
token de clasp (`~/.clasprc.json`) no incluye `drive.readonly`. Los 12 se exportaron con el
**conector de Google Drive de Claude**. El conversor propio lleva su OAuth con scope
`drive.readonly` y guarda el token en `~/.rosanta-drive-token.json`.

### 5. `~/Documents` pasó de 11 MB a 268 KB, y se ocultó

**No se puede borrar**, por dos razones: está sincronizada con **iCloud** (Escritorio y
Documentos activado), y adentro viven los **9 alias** de `Claude/Projects/` que son la
vinculación de cada proyecto de Cowork con su carpeta. Eso no es información: es un enlace,
y no hay copia en ningún lado.

Lo que sí se hizo: de los 23 archivos reales que había, **8 estaban repetidos** en Drive
(fueron a `_Archive/Duplicados_Documents_2026-09-11/`) y **8 eran únicos** y se repartieron
a su pilar. Quedan los 9 alias, los 6 `.md` de `_migracion_nube/` y el LEEME de la
centralita. La carpeta se ocultó del Finder con `chflags hidden ~/Documents` (revertir con
`chflags nohidden`).

### 6. `~/Claude` está sana

15 MB, 267 archivos: 23 artefactos con su historial, 17 tareas programadas y 2 alias.
**Cero archivos duplican contenido de Drive o de Dev**, comparado por md5. Es el caché de
la app, no una cuarta capa; no se toca ni se renombra. Lo único que sobra son
`Finanzas_preview.html` y `Metas_preview.html` en la raíz — del 4-sep, con la **paleta
vieja** incrustada.

### 7. Duplicados: 1,0 GB recuperable

**396 grupos** idénticos por contenido, **520 archivos sobrantes**. El 70% del peso son
videos de marca copiados 3 y 4 veces en `05_Marketing_OS`. El reporte recomienda cuál
conservar pero **no mueve nada**: es decisión a ojo.

### Reglas nuevas (cada una salió de algo que pasó hoy)

1. **Apps Script busca las carpetas de Drive por ID, no por ruta** (`getFolderById`). Mover
   carpetas en Drive **no rompe nada** del código. Las dos únicas excepciones se buscan por
   **nombre** y por eso no se pueden renombrar: la hoja `Rosanta Leads` y
   `Rosanta_Maestro_ESPEJO.xlsx`. Lo único que sí se rompe al mover una carpeta son los
   **alias**, y en silencio: la app sigue listando el proyecto pero no ve nada. Por eso el
   ritual después de reorganizar es **correr el guardián** y, si aparece alguna crítica,
   **`--realias`**, que busca la carpeta por nombre y reconecta. Si hay varias con el mismo
   nombre no adivina: las lista.
2. **Antes de archivar un script, mirar si lee datos de al lado.** `generar_finanzas.py`
   (tocado el día anterior) resolvía `BASE = dirname(__file__)`: archivarlo lo rompía. Se
   devolvió en el acto y después se mudó bien.
3. **Una carpeta vacía en `Documents/Claude/Projects/` no se mueve.** Suele ser un proyecto
   que la app acaba de crear; moverla lo desvincula. El guardián solo la reporta.
4. **El `birthtime` en Drive Desktop sí conserva la fecha real** — sirve para la regla de
   nombres. Pero en archivos rescatados o vueltos a descargar se pierde y quedan todos con
   la fecha de hoy.
5. **Los symlinks dentro de una carpeta de Drive sobreviven:** Drive Desktop no los sube ni
   los rompe. Es lo que hace posible la regla 0.
6. **claude.ai queda FUERA del stack (11 sep 2026).** Juanma borró los tres proyectos de la
   nube y decidió no volver a usarlo para nada. **No proponer guardar nada ahí, ni el
   knowledge de un proyecto.** Todo vive en las tres capas: Drive (datos), Dev (código) y
   Projects (alias). Esto termina la duplicidad entre "proyectos de la nube" y "proyectos
   locales con carpeta conectada", que era la causa del falso diagnóstico de proyectos
   idénticos. Costo del cierre, medido: se perdieron 3 PDFs de lectura de terceros y 3 notas
   de trabajo de la intranet, todas cubiertas por otra vía. **Ningún dato de negocio.**
7. **Hay DOS almacenes de artefactos y son distintos.** `~/Claude/Artifacts/` tiene los **23**
   de Cowork, que se actualizan con `update_artifact` por id — **ahí vive
   `rosanta-seguimiento-semanal`**. La galería `claude.ai/code/artifact/…` tiene los **10**
   publicados desde una sesión, y el tablero **nunca estuvo ahí**. El 11 sep una sesión buscó
   en la galería, no lo encontró y concluyó que se había borrado; estuvo a un paso de
   reconstruirlo desde cero sobre 62 versiones de historial. **Antes de dar por perdido un
   artefacto, mirar el archivo en `~/Claude/Artifacts/<id>/index.html`.**

---

## Cambios clave del 10 sep 2026 (v10)

Día completo de trabajo en la **intranet** (Apps Script), ocho versiones publicadas (69 → **76**). Batería de pruebas: **71 OK · 0 fallas · 2 saltadas**. Detalle en `references/proyectos.md` §3.

- **El código de la intranet se movió** a `~/Dev/Rosanta/apps-script/rosanta-intranet`. La ruta vieja (`~/Documents/Claude/Projects/Claude/rosanta-intranet`) queda obsoleta. Deployment publicado: `AKfycby814wYbLt784xWEZThfi0SgRn_afPV3KlLAecu7g9iKqgKINqlH5MqcM77PhT38oYb`. **Al cierre del 12-sep-2026 ese deployment está en la v81, no en la 76: cinco versiones más en una sola tarde.** Por eso un número de versión escrito no sirve: **verificarlo con `clasp list-deployments` antes de dar por buena una versión de memoria.**
- **Acceso por token resuelto.** El equipo con Gmail personal (fuera del dominio rosanta.rest) entra con `?u=<token>`. Jeffry (chef) fue el primero en recorrer el camino completo. Eran **tres bugs encadenados**, cada uno tapando al siguiente.
- **El recetario en frío pasó de 46,7 s a 0,44 s.** La causa no era cómputo sino llamadas a servicio dentro de bucles.
- **Agujero de permisos cerrado:** `doGet` protege la PÁGINA, no la FUNCIÓN. Cuatro funciones no verificaban a quien las llamaba — dos de ellas leían el maestro financiero entero. Se corrigió con `exigirModulo_(auth, modulo)`.
- **Desde S36 los reportes del POS se suben ya convertidos a hoja de Google** y el cargador lee el nativo directo. El camino del `.xlsx` se mantiene porque S35 y anteriores lo necesitan.
- **Ventas por producto al día:** de terminar el 23 ago a terminar el 6 sep (9.502 → 10.068 filas).

### Reglas técnicas de Apps Script (cada una salió de un bug real, no repetirlas)

1. **El token va como PRIMER argumento.** Servidor: `resolverUsuario_(auth)` o `exigirModulo_(auth, modulo)`, nunca `getUsuarioActual()` a secas. Vista: `var AUTH = '<?= authToken ?>';` declarado una vez y pasado en TODAS las llamadas a `google.script.run`. `doGet` resuelve la identidad UNA vez al abrir; cada `google.script.run` es una petición nueva.
2. **Dentro de un `href` la query va SIN escapar:** `<?!= qs ?>`, no `<?= qs ?>` — el escapado contextual convierte `&u=` en `%26u%3d`. **Apps Script NO tiene sintaxis de comentario `<?# ?>`**: se parsea como scriptlet y tira SyntaxError.
3. **Nada de `Utilities.*`, `SpreadsheetApp.*` ni `DriveApp.*` dentro de un bucle.** Son llamadas a servicio, no JavaScript. Si un tramo mide 10 s en una corrida y 97 s en otra del mismo día, es latencia de servicio, no cómputo.
4. **Para leer el contenido de una vista:** `createTemplateFromFile(v).getRawContent()`. `createHtmlOutputFromFile` **sanitiza** (devolvía 108.722 de 121.691 caracteres y rechaza Marketing con "Malformed HTML content").
5. **Un cache sin su invalidación es otra regresión.** Al cachear algo accionable, borrar ese cache donde se ejecuta la acción que lo resuelve.
6. **Un corte de red NO significa que la escritura no ocurrió.** `clasp run` devolvió ECONNRESET y la carga sí se había completado. Verificar estado antes de reintentar: reintentar habría duplicado dos semanas de ventas.
6bis. **`clasp` falla de DOS formas distintas y las dos terminan igual: no podés publicar.**
   Pasó el 12-sep-2026 en una hora. (a) `~/.clasprc.json` con un token de la **cuenta
   personal**: la API contesta *"The caller does not have permission"* y **nunca dice que el
   problema es la cuenta**. (b) El archivo **vacío** (`{"tokens": {}}`, 18 bytes): contesta
   *"No credentials found"*. Distinto síntoma, misma parálisis. El arreglo de las dos es
   `clasp login` con **restaurante@rosanta.rest**, pero si no distinguís el síntoma buscás
   en el lugar equivocado. Confirmado también: **clasp 3.3.0 sigue usando `~/.clasprc.json`**
   — no hay `~/.config/clasp`.
6ter. **No creerle a lo que clasp IMPRIME.** Dos mentiras vistas el 12-sep-2026:
   *"You are logged in as restaurante@rosanta.rest"* apareció con un token de
   `juanma.lemus@gmail.com`, y *"Script is already up to date"* apareció con un push que sí
   subió 15 archivos. **La cuenta se verifica** con `tokeninfo` del access_token; **un push o
   una versión se verifican** bajando el proyecto —o `clasp pull --versionNumber N`— a una
   carpeta **aparte** y comparando archivo por archivo.
6quater. **Nunca `clasp pull` sobre el repo.** Pisa lo que haya en disco, incluido el trabajo
   sin guardar de las otras sesiones. Siempre a una carpeta aparte.
6quinquies. **Si hay cambios de otras sesiones en disco sin probar, se publica con
   `create-version` + `update-deployment` y SIN `push`.** `create-version` congela lo que está
   en el servidor, no lo del disco: es la forma de sacar una versión sin arrastrar trabajo ajeno
   a medio hacer.
6sexies. **`include()` SANITIZA** (usa `createHtmlOutputFromFile`), así que no sirve para
   parciales con JavaScript: se come contenido. Para eso está **`incluirCrudo_()`**, con
   `getRawContent`. El guion bajo final es a propósito: devuelve código fuente, y sin él
   cualquiera podría llamarla desde `google.script.run`.
6septies. **Una vista partida en parciales tiene que tener sus parciales en las listas `VISTAS`
   de `Pruebas.js`**, o las llamadas de esos parciales quedan sin proteger y la prueba sigue
   en verde. Mismo punto ciego de siempre, por otra puerta.
6decies. **La batería solo EVALÚA dos páginas: `Index` y `CosteoVista`** (vía `doGet`). Las
   demás vistas las lee **crudas**, sin ejecutarlas. Un scriptlet mal cerrado en una vista de
   Finanzas **pasa en verde**. Después de tocar una plantilla hay que **abrirla, directa y
   embebida**; y antes de publicar, compilar cada plantilla a JavaScript y pasarla por
   `node --check` con control negativo, que es lo que se hizo para la v81.
6nonies. **Un iframe vacío visto desde la ventana de automatización NO prueba nada.** Esa
   ventana bloquea cookies de terceros, así que cualquier contenido embebido sale en blanco.
   Pasó el 12-sep: se dio por roto el shell de Finanzas —y de paso el de Marketing, que
   funcionaba desde antes— y estuvo a punto de rehacerse el lateral para que navegara en vez
   de embeber. **Juanma lo abrió en su Chrome y cargaba perfecto.** Lo que se ve embebido se
   confirma en el navegador de la persona, no en el de la automatización.
6octies. **Si `clasp login` da 400 por `authuser=1`** (varias cuentas abiertas en Chrome):
   pegar la URL de autorización en una ventana de **incógnito**.
7. **Los activadores se crean A MANO** (Editor › Activadores): `ScriptApp.newTrigger()` necesita el scope `script.scriptapp`, que el manifiesto no declara. Y que un activador esté guardado no prueba que corra.
8. **Mirar el conteo, no el color.** La prueba de permisos pasó en VERDE habiendo revisado 2 de 21 llamadas.
   **Segundo caso, 12-sep-2026, peor que el primero:** el barrido de `Pruebas.js` solo reconoce
   llamadas con la forma `run.nombre(`, y la vista llamaba con `run['getFinanzasData']()`.
   La llamada era **invisible para la prueba**, así que el grupo pasaba en verde con
   `getFinanzasData` sin guarda — o sea con la puerta abierta al maestro entero.
   **Las llamadas a `google.script.run` se escriben SIEMPRE con el nombre literal**, nunca
   con corchetes. Si hay un dispatcher genérico, **cada nombre que pase por él necesita su
   propio chequeo de guarda**, porque el barrido no lo va a ver. **La prueba vigente** se llama
   *"Ninguna vista llama al servidor con el nombre en una variable"* (`Pruebas.js`) y se apoya
   en el helper **`_prLlamadasConCorchetes`** de `PruebasFinanzas.js`: recorre la cadena de
   handlers con **paréntesis balanceados** y marca solo si el corchete viene pegado al último
   `)`. Cubre las 25 vistas, con el dispatcher de `Marketing.html` como excepción declarada.

   **Citar las pruebas por NOMBRE, no por número de línea**: los números se mueven con cada
   edición.

   Como antecedente, la primera versión fue una ventana fija:
   `/google\.script\.run[\s\S]{0,400}?\[\s*[a-zA-Z_$]/`. Encontró el bug original, pero
   sobre las 25 vistas daba **falsos positivos** —corchetes de array dentro del handler— y se
   retiró en la v81. **No copiarla.**

      La regla general: **una prueba que busca por patrón de texto solo encuentra el patrón
   que conoce.**
8bis. **`clasp push` sube TODO lo que hay en la carpeta si no existe `.claspignore`.** Y como
   todos los `.js` comparten un solo ámbito global, un respaldo de `Code.js` subido al lado de
   `Code.js` redefine cada función y gana el que cargue último — sin un solo error. El
   `.claspignore` de `rosanta-intranet` (creado el 12-sep-2026) excluye `_backups/**`, `*.bak`,
   `.git/**`, `node_modules/**` y `*.md`. **Cualquier repo de Apps Script nuevo necesita el
   suyo antes del primer push.**
8ter. **Una guarda se verifica LEYENDO SU CUERPO, no reconociendo su nombre.** Los dos
   errores posibles se cometieron el 12-sep, uno en cada dirección: un barrido que busca
   `exigirModulo_` no ve `requiereCrm_` y reporta abierto lo que está cerrado —hace perder
   tiempo—; y un barrido que ve `requiereAlgo_()` y concluye "cerrado" sin abrirla puede
   estar bendiciendo una guarda que no niega nada —eso es un incidente—. El método correcto
   son tres pasos: **(1)** encontrar la llamada a la guarda, **(2)** confirmar que se le pasa
   `auth`, **(3)** abrir el cuerpo de la guarda y confirmar que hay un `throw` ante usuario
   inexistente o sin módulo.
9. **Antes de nombrar una función nueva, verificar que no exista.** Los `.gs` comparten un solo ámbito global y un nombre repetido pisa al otro en silencio.

### Cómo se trabaja la intranet (reglas de Juanma)

- **No reescribir módulos que funcionan.** Los cambios son incrementales.
- **No cambiar roles ni permisos de la hoja USUARIOS sin pedirlo.**
- Publicar = `clasp create-version` + `clasp update-deployment -V <n> <deploymentId>`. `clasp push` solo actualiza HEAD.
- **Verificar YA NO es `clasp run`.** Con el login actual `clasp run-function correrPruebasTexto`
  contesta *"Unable to run script function"*. La batería se corre **en el navegador**, sobre el
  `/dev` del @HEAD: `…AKfycbxw_…/dev?page=pruebas`. Para leerla desde Claude in Chrome el iframe
  no deja scrollear ni `get_page_text`: clic adentro, `cmd+a`, `cmd+c`, `pbpaste`.

---

## Cambios clave del 6 sep 2026 (v9)

Esta versión cierra una brecha de tres semanas: la v8 quedó al 14 ago y las referencias al 26 jul. Se integran las semanas S35 (24–30 ago) y S36 (31 ago–3 sep) y el bloque de POS/sitio del 10–20 ago.

### 1. Estructura nueva: Rosanta OS de 6 pilares

El mapa viejo de "proyectos sueltos" quedó obsoleto. Todo se organiza ahora en **6 pilares**, y Drive está reorganizado igual:

| Pilar | Qué cubre | Estado |
|---|---|---|
| **Finanzas & Data OS** | Maestro, DRE, P&L, prime cost, caja | Arrancó 2 sep. Vista v1 viva |
| **Profit OS** | Recetario, costeo, inventarios, merma | En funcionamiento desde S35 |
| **Marketing OS** | Pauta, CAC, ROAS, reseñas, carritos, encuesta | En funcionamiento |
| **Back office / Operations Hub** | **12 sep:** Rosanta OS es la puerta única (`_Codigo`/`_App`), una **centralita por proyecto** en `Documents/Claude/Projects/` con solo alias adentro, 0 código en Drive, guardián vivo y **`~/Dev/Rosanta` ya es repo git**. Abierto: 232 MB en duplicados chicos, 374 punteros, la key de Wix en texto plano | `references/ecosistema.md` |
| **Web Rosanta** | rosanta.rest (Wix), SEO, multilingüe | Activo |
| **Reservas / Ticketing (WIX)** | Reservas, webhooks, monitoreo | Activo, con fallo abierto |

Auditoría de artefactos cerrada bajo esta estructura: **10 vivos, 9 borrados, 3 pasan a referencia**. Hallazgo de producto: **la app no permite renombrar artefactos** (solo Pop out, Unpin, Move down, Delete), así que el mapa oficial pasa a ser el archivo `_Indice_Artefactos.md`.

### 2. Finanzas & Data OS — el pilar nuevo (arrancó 2 sep 2026)

- **El maestro migró a Google Sheet NATIVO** `1_ZiUlIUG3HIDkYmcpXbykgJ7hh3vlhsu21b6aUOzEmk`. Decisión de Juanma de alejarse del xlsx. **El .xlsx ya NO es la fuente**; existe un espejo `Rosanta_Maestro_ESPEJO.xlsx` que Apps Script exporta cada semana para que las herramientas locales de Python lo lean vía Drive Desktop. Se encontraron y desactivaron **tres archivos distintos** llamados `Rosanta_Reporte_Maestro_v2_2026`; los sobrantes quedaron como `ZZ_ARCHIVO_`.
- **Cargador automático** en Apps Script: Juanma deja los archivos en la carpeta de la semana y el sistema los identifica **por contenido, no por nombre** (POS / FEL emitidas / FEL recibidas), convierte los .xls y lleva registro de lo procesado. Código en `Maestro/AppsScript_cargador.gs`.
- **Los ocho meses del año validados al centavo** contra los PDF originales: 8/8 en Banco Industrial y 8/8 en BAC.
- **DRE anual construido:** ventas Q1,220,487 · COGS Q450,227 (36.9%) · gasto operativo Q858,465 (70.3%) · **resultado −Q88,205 (−7.2%)**. Equilibrio en Q90,612/mes contra Q152,561 de venta real. Lectura: **el problema no es vender, es la estructura de costo.**
- **Prime cost** calculado por primera vez: 56.9% en el año (bajo el límite de 60%), pero **julio 66.0% y agosto 67.5%** se rompieron contra 49–59% de enero a junio.
- **Hallazgo de método (importante):** el maestro es **base caja**, y eso rompía el prime cost mensual (saltaba de 40% a 76% sin que la operación cambiara). Se conectó la **planilla devengada** como fuente de nómina y el rango se volvió señal real.
- **Reporte del contador DESCONTINUADO** → reemplazado por un **reporte interno mensual**, que arrancó con el cierre de agosto. Carpeta: `1Dfkg52IphK3V1hWCaDQ2MAqqxzMQxmju`.
- Artefacto: **`rosanta-dre-mensual`** (vista Finanzas v1: los 5 números del P&L con semáforo contra benchmark del sector, prime cost mensual, gasto operativo contra rango, punto de equilibrio y simulador de escenarios).

### 3. Alertas rojas abiertas (N1) — leer antes de proponer cualquier cosa

**Revisadas el 11 sep 2026 contra el tablero.** Cuatro de las seis que traía la v9 se
cerraron o cambiaron de forma. No reproponer las cerradas.

1. **La caja: el problema es la extracción, no la operación.** Medido el 11 sep sobre ocho
   meses y una semana: la operación **genera Q188,547** (cobrado Q1,337,332 − salidas de
   operación Q1,148,786). Lo que descuadra es la extracción: **Q136,546 de gasto personal
   por las cuentas de la empresa + Q100,325 de retiros del socio = Q236,871**, el **126%**
   de lo que el negocio produce. Resultado de caja del año: **−Q48,325**. En promedio la
   operación deja Q22,993/mes y se extraen Q28,887.
   El saldo bajo no es un mal mes: estuvo bajo una semana de gasto **230 de 244 días** con
   movimiento (94% del año), tocó **Q0.00 exactos el 31 de julio** y su máximo anual fueron
   Q56,772, que duraron once días. Junio (−Q8,725) y julio (−Q3,023) son los dos únicos
   meses en que la operación misma quemó caja, y son los del food cost más alto.
   **Pendiente vivo (p122, N1):** definir un nivel de extracción sostenible. Es una decisión
   de Juanma, no un análisis. El forecast a 30/60/90 es p94, con diagnóstico completo y
   prompt de arranque ya entregado.

2. **Devoluciones de inversión: eran tres acreedores, queda uno.** Kristinsa
   (Q32,535) y Manuel Lemus (Q6,000) **ya están pagados en su totalidad**. Queda
   **Raúl, el socio**, a quien en 2026 se le pagaron Q50,000 (la fila del 18-feb).
   **Para 2027 el objetivo es Q100,000**, una vez al año y en el primer trimestre.
   La categoría `DEVOLUCION_INVERSION` estaba bien puesta: los Q100,325 de 2026 son
   los tres acreedores. **La carga no sube en 2027** — es el mismo total, concentrado
   en una sola persona.

   **Raúl puede recibir menos**, pero Q100,000 es el número que se intenta entregar.
   Eso lo hace distinto del retiro y del alquiler, que salen sí o sí.

3. **La vara de la caja son DOS umbrales, no uno** (Juanma, 12 sep 2026):

   | | Por mes | Naturaleza |
   |---|---:|---|
   | Retiro de Juanma | Q5,000 | fijo |
   | Alquiler de su casa, US$1,800 | ~Q13,896 | fijo |
   | **PISO** | **Q18,896** | **sale sí o sí** |
   | Devolución a Raúl, Q100,000/año | Q8,333 | objetivo, flexible |
   | **OBJETIVO** | **Q27,229** | |

   Contra los **Q12,845/mes** que dejó la operación en may–ago:

   - cubrir el **piso** pide **+Q6,051/mes** → **+5.4% de venta** (~Q8,600/mes más)
   - cubrir el **objetivo** pide **+Q14,384/mes** → **+12.8% de venta** (~Q20,500/mes)

   **No hay sobregasto: hay un problema de tamaño.** En may–ago se extrajo Q14,132/mes
   de personal contra Q18,896 de necesidad real — Juanma se está quedando **corto en
   Q4,764/mes**, no pasándose. La pregunta del pilar no es cómo recortar la extracción
   sino cómo la operación llega a Q18,896 primero y a Q27,229 después. Un 5% de venta
   es una meta, no un milagro.

   **Y la palanca ya está identificada, en el pilar 4.** La pantalla de Profit OS tiene medido
   al 12-sep: **Q24,983/año recuperables contra meta** (33 productos por encima de su costo
   objetivo — el Brisket en Salsa Bordelesa solo son Q9,838, con 44.8% contra 30%) y
   **Q38,320/año de oportunidad en sala** (9 rompecabezas con venta al menos mensual). Son
   **Q63,303/año = Q5,275/mes**, o sea el **87% del hueco contra el piso** y el 37% contra el
   objetivo.

   Eso cambia la conversación: el hueco **no se cierra solo vendiendo más**. Una parte grande
   sale de costo, con trabajo que el pilar 4 ya hizo y que está con nombre y monto por
   producto. **No hay que buscar la palanca: hay que ejecutarla.**

   **Documento de arranque, autocontenido:**
   `Rosanta OS/03_Finance_Data_OS/2026-09-12_Objetivo_Operacional.md`. Se trabaja en
   **sesión dedicada** del pilar, amarrado al forecast de caja (p94). Trae también lo que
   tiene margen: el tipo de cambio de los cargos en dólares (73% del gasto personal), y
   cuánto del histórico se marcó con la regla de clasificación vieja.

4. **Meta de food cost: ~~30% fijo~~ 28% desde el 14-sep-2026, sobre precio sin IVA (ver v15).** Decisión de Juanma del 10 sep, corregida el 14. **Queda descartada** la
   fórmula del mix y el 27.8% ponderado que traía la v9 — eso es **obsoleto, no repetirlo**.
   Ya está aplicado en los tres lugares donde vivía: intranet (`PARAMETROS!B3`, de 32 a 30),
   `generar_finanzas.py` (de la fórmula a 30.0 fijo, con el razonamiento escrito en el
   código) y el recetario, que ya estaba bien. El mix se sigue publicando como información,
   pero deja de definir la meta.

5. **Alquiler: CERRADO como palanca.** Juanma confirma que ya se negoció a la baja y no hay
   más margen. Pasa de pendiente a **restricción conocida** de la estructura de costo. No
   reproponer bajarlo.

6. **Reservas: CERRADO.** El canal se rehízo en Claude Code: el cliente reserva desde el chat
   del bot, la reserva se crea en Wix y el bot confirma; por el mismo camino cancela. Cierra
   el N1 de los webhooks mudos que venía del 6 de agosto. Abierto menor: confirmar que el
   activador de `latido()` existe (p107), y borrar los deployments v2 y v3 del Marketing OS,
   que siguen siendo dos URLs vivas que se tragan tráfico (p82, N3).

7. **Credenciales: matizado.** El **token de Meta en `config!A1` NO es un descuido** — lo lee
   un Google Ads Script, que corre fuera de Apps Script y no tiene `PropertiesService`, así
   que la celda es la única alternativa a hardcodearlo. La mitigación real es **restringir el
   acceso a la hoja y rotar**, no mudarlo. Lo que sigue siendo exposición real es la API
   key/JWT de Wix y el site id en esa misma pestaña.

8. **Nómina de febrero: CERRADO.** Las 73 filas se reclasificaron el 7 sep y las seis
   transferencias del 16/02 ya dicen NOMINA; el maestro y el espejo se regeneraron.

**Del 10-11 sep, para no volver a asustarse:** el recetario de barra nativo estuvo en la
**papelera de Drive** con borrado a 30 días mientras la intranet lo leía todos los días.
Se restauró el mismo día que se descubrió (27 fichas, 29 sub-recetas, Banco de 200 insumos).
Causa raíz: vivía en `Downloads`. Ya está en `04_Profit_OS/Recetario`, al lado del de cocina.

### 4. Profit OS (S35)

Recetario y costeo pasan a tablero propio; se cerró un bloque de 33 pendientes arrastrados desde el 22 ago. Recetario migrado a **v14 en hoja nativa** `1oxVJIaplR7Ofk4_lYgvIsOMBonUGrcoDa0J099vnlxg` (33 platos mapeados, VLOOKUP contra el Banco de Datos sobrevivieron). Banco de Datos limpiado. Inventarios integrados a Profit OS (dejan de ser sistema aparte). MAPA POS ejecutado: 5 productos retirados, 7 activos sin ficha resueltos, 2 altas (~Q1,145/semana que se cobraban a mano).

**Diferidos por Juanma el 3 sep — no reproponerlos hasta que él lo decida:** SPLH (ventas por hora-hombre, imposible hoy porque no se registran horas por turno) y **merma** (no existe ningún dato).

### 5. Web, sitio y POS (10–20 ago)

- **Sitio multilingüe ES/EN completo y verificado en vivo.** Menú en español terminado: 18 descripciones de sección, 77 platos, etiquetas y variantes.
- **Brunch eliminado de la web** — no se sirve desde hace más de un año. (Coherente con "Rosanta NO vende brunch", v8.)
- Decisión de marca: **"Farm to Table" se queda en inglés** porque es el término que buscan los turistas; el jardín vive en el cuerpo de la página.
- **Reglas operativas de Wix (no repetir errores):** (a) editar el texto en inglés en la app de menús **borra su traducción al español** → primero se cierra el inglés, después se carga el español; (b) cargar la traducción no basta, **solo publicar** invalida el caché de render; (c) el SEO por idioma se edita **en el Editor con el selector en Spanish**, no en el Translation Manager.
- **hreflang:** Wix no lo emite en 8 de 9 páginas pese a prometerlo por escrito. Corre un parche por Custom Code en 5 páginas (`RUNBOOK_hreflang_parche.md`); Wix **nunca respondió** al escalamiento. Quitar el parche cuando lo arreglen o quedan etiquetas duplicadas.
- **POS y carta 2026-2027:** 187 productos fuera de carta dados de baja, 71 cambios de precio, precios de los 212 productos actualizados, carta de vinos 2027 cargada, etiqueta de carta 2027 marcada (144 de 212). **La carta nueva ya corre en el restaurante con el POS sincronizado.**
- **Google Ads reactivado** el 10 ago (método de pago actualizado, riesgo de suspensión resuelto).

### 6. Marketing y reputación

- **TripAdvisor sube en las tres métricas** contra el baseline del 17 jun: 9 → 12 reseñas, 4.1 → 4.4 estrellas, #204 de 418 → **#146 de 463** (58 posiciones, con la lista creciendo).
- **La encuesta de satisfacción manda el 100% de las 5★ a Google**, que ya tiene volumen. Re-apuntarla a TripAdvisor es cambiar UNA propiedad del script y es la palanca más barata. **Ojo:** el Sheet donde cae la encuesta es propiedad de un tercero (`Eli_Juli@lacocinaquesuena.com`), no de Rosanta — resolver antes.
- **ROAS:** en el denominador solo entra inversión en medios (FACEBK, GOOGLE*ADS). **Los honorarios de gestión de pauta cuentan en el bloque Marketing del DRE pero NO en el ROAS.**
- **El COGS semanal no es señal, es ruido** (desviación 13.9 puntos). Usar **media móvil de 4 semanas** como número principal; la semana cruda solo como contexto.

### 7. Reglas nuevas de trabajo

- **Las reseñas de Google se responden automáticamente** por la plataforma de reservas. Nunca listarlas como pendiente.
- **Comando "Consolidar tablero":** al cerrar una sesión, los cierres se escriben en el acto en `rosanta-seguimiento-semanal`. El tablero es un archivo local: `~/Claude/Artifacts/rosanta-seguimiento-semanal/index.html`, con los datos en el `<script id="seguimiento-data">`. **Desde Claude Code se edita ese JSON directo y se deja copia en `versions/`** — el cierre dominical automático solo lee sesiones de Cowork, así que todo lo que pasa en Claude Code hay que escribirlo a mano o se pierde. Formato: `cerrado: …` / `pendiente-1: … — N# — proyecto`. La skill `cierre` maneja el ritual.
- **Los consumos en restaurantes NO se clasifican por el nombre del comercio.** El mismo lugar puede ser comida personal de Juanma o comida con el equipo.

---

## Cambios clave anteriores (vigentes)

### 14 ago 2026
- **PROHIBIDO decir "leña de café". No existe.** La leña de la parrilla es de **gravilea**, el árbol que da sombra a los cafetales. Se compra a fincas de café con prácticas regenerativas; no se nombran fincas ni certificaciones en público sin consentimiento escrito. Sirve como prueba de origen del farm to table.
- **Vocabulario prohibido:** "coctel de autor" y "cocina de autor". Aquí se dice **gastrococtelería**. La lista dura vive en `rosanta-brand-guidelines`, que hay que cargar antes de escribir cualquier texto de Rosanta.
- **Rosanta NO vende brunch** y **NO trabaja con OpenTable.** Existe una ficha en OpenTable que dice que no acepta reservas y ChatGPT la cita; reclamarla o darla de baja.
- **Menú web:** carta 2026-2027 (7 secciones plegables, ES/EN) servida desde GitHub Pages (`Rosanta2024/rosanta-menu`) en un iframe en `rosanta.rest/menu-completo`. Cambiar precios = editar `index.html` en GitHub, sin tocar Wix. **La altura del Embed HTML de Wix no se controla por Velo**: fija, 1019px escritorio / 832px móvil, con scroll interno.
- **SEO:** datos estructurados Restaurant + Menu en `/menu-completo`; se eliminó el `aggregateRating` auto-declarado (Google lo prohíbe); Bing Webmaster verificado; `llms.txt` editado a mano.

### 30 jul 2026
- **La identidad se llama "LA SEGUNDA COSECHA"**, no "La Segunda Floración" (obsoleto).
- **Documentos: fondo BLANCO y CERO cajas de texto.** El Crema sigue siendo fondo en redes/menús/flyers, pero en briefings, reportes, propuestas y guiones el fondo de color y las tarjetas redondeadas delatan "hecho por IA". Estándar editorial: tipografía, jerarquía y aire.
- **Meta (Andromeda): las variantes de un mismo video se tratan como duplicado.** Diversificar = videos conceptualmente distintos sobre UN mismo concepto, jamás el mismo material con otro gancho.
- **Panel de Asesores:** expertos reales verificables con link a su contenido, jamás personas inventadas, y nunca atribuirles citas (siempre "Lente X").
- **Rol "contenido" en la intranet:** ve solo Calendario, Creador Kaprica, Checklist y Manual, con permisos también del lado del servidor.

### 26 jul 2026
- **Anti-brand INTEGRADO a `rosanta-brand-guidelines`**: 5 pilares, el enemigo (trampa para turistas + barra de licuadora), los 4 filos, la flor, Fresco & Fuego · Urban Garden, arquetipo Cuidador/Explorador, frases firma, reglas de emojis. **Paleta HEX vigente:** Verde Bosque #4E6D5A, Verde Medio #57A77F, Lila #AEAAE2, Crema #F2EEEB, Negro #000000. (La pre-sprint #456B50/#4CAF7D/#A89DC8/#F0EDE6/#1A1A1A está obsoleta.)
- Desinstaladas: `xlsx-pro`, `pdf-pro`, `internal-comms`, `rosanta-recetario-costeo`. **`rosanta-eventos` DESCARTADA — no se creará. No reproponerla.**
- **SonTickets y GHL: cerrados.** Migración a WIX **ejecutada el 10 ago 2026**.

### 17 jul 2026
- **Bot WhatsApp/IG: COMPLETO.** WhatsApp vivo con token permanente (+502 3082-6935 en la API). Plantillas post-24h activadas. Messenger cerrado.
- **Notas de voz del bot: DESCARTADO** hasta que exista transcripción de audio nativa en Claude. No reproponerlo antes de eso.

---

## Quién es Juanma y qué es Rosanta

- Juanma Lemus, dueño de **Rosanta** ("Cocina con Carisma"), restaurante en Antigua Guatemala. Empresa: CORSAGA, S.A. Correo: restaurante@rosanta.rest. Sitio: rosanta.rest.
- Está en Plaza/Parque Santa Rosa ("Santa Rosa" vale solo como nombre del lugar físico y su parqueo).
- **PROHIBIDO usar "Jardín Santa Rosa"** — sub-marca descontinuada (jun 2026). Regla dura: nunca usarla.
- **Firma de marca: coordenada 14·91.** Forma oficial **14° N · 91° W**; corta **14·91 / #1491**. Igual en cada plato como sello, sin sufijos por platillo.
- Stack: todo interno con Google (Apps Script, Sheets, Drive) + Claude. Sin n8n, Make ni plataformas externas. GHL y SonTickets cerrados.

## Mapa de proyectos (estado al 15 sep 2026; lo posterior, en las secciones de cierre de arriba)

| Pilar / proyecto | Estado | Detalle |
|---|---|---|
| **Finanzas & Data OS** | ARRANCADO 2 sep. Maestro nativo validado 8/8 meses, cálculo nuevo (reglas 10–14), ~~forecast de caja~~ **HECHO** (pestaña Caja, @93). Falta: panel de integridad, registro de compra de mercado, documentar el cargador | `references/negocio.md`, `references/proyectos.md` §5 |
| **Profit OS** | En funcionamiento (S35). Recetario v14 nativo, inventarios integrados. Merma y SPLH diferidos | `references/proyectos.md` §2 |
| **Marketing OS** | En funcionamiento. **Desde el 27-sep (v29): decide ⚖️ Decisiones de pauta (hechos + reglas, sin IA), las metas las fija el Sistema de Medición (comensales del mes, clientes nuevos, CAC), el Creador de pauta aplica el estándar creativo de la casa. Panel de Asesores, lentes, AI CMO y Diagnóstico IA RETIRADOS.** ~~En funcionamiento. **Creador de pauta (Lente Savannah Sanchez) vivo en la @99 y Diagnóstico IA con Lente Loomer + AI CMO en la @100, ambos del 16 sep.** Pendiente: memoria del diagnóstico en la Sheet (v20 §3). Abierto: webhooks mudos, credenciales expuestas, encuesta a TripAdvisor~~ | `references/marketing.md` |
| **Back office / Operations Hub** | **11 sep:** Rosanta OS es la puerta única (`_Codigo`/`_App`), 0 código en Drive, guardián vivo. Abierto: 1,0 GB en duplicados, 374 punteros, credenciales en texto plano | `references/ecosistema.md` |
| **Web Rosanta** | Sitio multilingüe ES/EN vivo, carta 2027 en POS. Abierto: hreflang (Wix no responde) | `references/marketing.md` |
| **Reservas / Ticketing (WIX)** | Migración COMPLETA (10 ago). Abierto: webhooks mudos 25 días + falta monitor de caídas | `references/marketing.md` |
| Bot WhatsApp/IG | **@57 (17-oct, limpieza; @56 = reservas con el bot callado, opción parecida, bandeja Principal, reserva por correo sola, resumen diario.** Antes **@55 (16-oct, v45): consulta de reserva (solo lee), propuestas al correo, anticipo una vez, pregunta si la reserva va al nombre del perfil; 3.2 → ~1.3 de cada 10 chats pasan a Juanma (se mide el 16-nov).** Antes, **@49 (15-oct, v44):** Sonnet 5.5, botones, se calla al pasar a Juanma y retoma, eventos al pipeline por correo + pestaña Fichas | `references/proyectos.md` §1 |
| Intranet/ERP | **Al 17-oct-2026: @210 (accesos: anular solo lo propio, precio de carta solo dueño; ver v52).** Antes: **Al 15-oct-2026, noche: @199 (= `4418e69`: medición fina de Recetas, el ✓ no tapa Deshacer, celular en Marketing; ver v41).** Antes: **Al 15-oct-2026, tarde: @198 (celular, aviso de guardado, tarea 3).** Antes: **@197 (cierres PosFile, latido de reservas en Apps Script, Tiempos y paleta; ver v38).** Antes: **Al 14-oct-2026, cierre: @196 (coma decimal y guarda de área, ver v37).** Antes: **@194, auditoría en 5 fases cerrada (ver v35).** Antes: **Al 8-oct-2026: @168 (ver v33 §1).** Antes: **El equipo está en la @124 (25 sep): tablero global de los 6 pilares, solo dueño (`?page=tablero`), más EBITDA, compra sin factura, comensales L–X, medios, CAC y cierre de inventario en sus motores. Batería 126 OK · 0 fallas · 4 avisos · 3 saltadas. Entre la @101 (22 sep, pilar 3 rediseñado) y la @123 hubo 22 versiones de otras sesiones.** Antes, al 16 sep, noche: @100: Diagnóstico IA de pauta con Lente Loomer + AI CMO, arriba junto a Actualizar. @99 (16 sep): Creador de pauta con la Lente Savannah Sanchez para Vanessa. Batería sobre la @99: 118 OK · 0 fallas · 1 aviso (calentador) · 3 saltadas conocidas; la @100 no se volvió a probar (cambios de vista).** Antes, al 15 sep: @98: pestaña Caja, food cost sin servicio, tarjeta real contra teórico, MARKETING_HONORARIOS. Batería 119 OK · 0 fallas · 0 avisos · 3 saltadas, las 3 identificadas. Abiertos 6 críticos de la auditoría del 14-sep (ver v15 §1).** Antes, al 14 sep: v88. Antes, al 12 sep: v81. Token verificado con Jeffry; el CRM con token queda **cerrado por decisión de Juanma**, con la batería de la v80 como evidencia. Abierto: Jose no probó su acceso, marcadores con la URL vieja `/a/macros/`, y 13 scripts de un solo uso viviendo en el proyecto vivo. | `references/proyectos.md` |
| Mejoras impacto real v2 | Activo: 8 palancas, Q280–390K/año | `references/negocio.md` |
| Eventos y grupos | Pilar continuo mes a mes (mejora #1) | `references/marketing.md` |
| Sistema Operativo / SIC | Mandala V4 + Ruta 2×3×5. Social = Niños de Guatemala + plato solidario | proyecto SIC (aparte) |
| Personal: UTG 42K | Plan de 15 semanas para la Ultramaratón Guatemala 42K (21 nov 2026). Artefacto `plan-utg-42k` | fuera de Rosanta |

Antes de trabajar en cualquiera, lee la sección correspondiente de `references/proyectos.md`.

## Datos maestros del negocio

`references/negocio.md`: mapa del "corazón de Rosanta" en Drive, menú, equipo y roles, SOPs, proveedores, **el DRE y los números vigentes**, y el CRM. `references/marketing.md`: audiencias (80% turista angloparlante / foodie local), estacionalidad (alta nov–dic), campaña activa, reputación y reglas de voz. Leerlos antes de cualquier tarea de negocio, contenido o análisis.

## Ecosistema: skills, artefactos y conexiones

`references/ecosistema.md` tiene el mapa de skills instaladas, herramientas locales, artefactos vivos, tareas programadas y el flujo que los conecta. Leerlo antes de crear contenido, paneles o documentos, para reutilizar en vez de duplicar.

## Reglas de trabajo con Juanma (siempre aplican)

0. **BUSCAR ES SEGUIR LOS ENLACES Y MIRAR TAMBIÉN DRIVE.** Los proyectos de la app son carpetas
   chicas con un acceso directo al pilar: una búsqueda que no sigue enlaces no ve los documentos y
   devuelve casi nada SIN avisar. Medido el 25-sep-2026 en 00_Admin: `grep -r` dio 1 archivo y
   `grep -R` dio 8; `find` vio 1 y `find -L` vio 336. Reglas: usar `grep -Ril` y `find -L`, nunca
   `grep -r` ni `find` a secas; los nativos de Google (`.gdoc`, `.gsheet`, `.gslides`) NO tienen
   texto en disco —un `.gdoc` pesa 179 bytes, es un puntero— y se leen con el conector de Google
   Drive (`search_files`, `read_file_content`, `get_file_metadata`); una búsqueda completa mira los
   dos lados; y al reportar se dice CUÁNTOS archivos se revisaron, porque "no encontré nada"
   después de mirar uno no es un resultado, es una búsqueda que no corrió. El mismo protocolo está
   escrito en los nueve CLAUDE.md de los proyectos.

1. **Confirmar la fuente de datos ANTES de construir.** Si un análisis depende de una pestaña/Sheet/export, preguntar primero si es la fuente vigente y cómo tratar huecos. Hoy la fuente financiera es el **Sheet nativo del maestro**, no el xlsx.
2. **NO mencionar la rotación de la API key de Anthropic.** Juanma pidió explícitamente que no se le vuelva a preguntar.
3. **Marca (FORMATO OBLIGATORIO de TODO diseño Rosanta):** anti-branding + storytelling, sin excepción. Toda salida pasa por `rosanta-brand-guidelines` (identidad) COMBINADA con `visual-storytelling-docs` (estructura). En documentos: **fondo blanco y cero cajas de texto**. Para copy: `rosanta-kaprica`. Cotizaciones: `rosanta-cotizador`. Finanzas: `rosanta-maestro`.
4. **Abogado del diablo:** cuando Juanma pida crítica sin filtros, aplicar el método completo de `abogado-del-diablo` — brutal con la idea, nunca con la persona.
5. **Rosanta NO hace delivery y NO vende brunch.** Nunca ofrecerlos.
6. **Calibrar el detalle:** explicaciones y diagnósticos cortos y directos; instrucciones técnicas que Juanma va a ejecutar, completas y paso a paso (skill `calibrar-respuestas`).
7. Respuestas concisas y en español.

## Cómo mantener vivo este cerebro

**Claude Code lo actualiza solo. No se le pide a Juanma que instale nada** — orden explícita del 11-sep-2026. La skill instalada es escribible desde la sesión; el procedimiento completo, con la ruta, está en `~/Dev/Rosanta/CLAUDE.md`, sección "Al CERRAR la sesión".

- Cuando Juanma diga "actualiza el cerebro", "guarda esto en el cerebro" o al cerrar una sesión con avances importantes: regenerar partiendo de la **instalada**, subir versión y fecha, escribir encima, verificar leyendo desde la ruta instalada, y sincronizar la copia de `~/Dev/Rosanta/rosanta-cerebro/`. ~~más el `.skill` de respaldo en `tools/`~~ (OBSOLETO: ya no se empaqueta ningún `.skill`; se instala con `cp -R` de la fuente a `~/.claude/skills/rosanta-cerebro/`). **Antes de editar, comparar "Última actualización" de la fuente y la instalada y partir de la más nueva** (el 9-oct la instalada estaba dos versiones atrás).
- Lo hace también la tarea programada **`rosanta-cerebro-mantenimiento`** (día 1 de cada mes, 9:00).
- Integrar lo nuevo de la memoria automática y del tablero `rosanta-seguimiento-semanal`.
- Marcar lo obsoleto como obsoleto en vez de borrarlo, para que Juanma vea qué cambió, **y marcarlo donde vive el dato** (la referencia), no solo en el SKILL.md.
- **Verificar contra las herramientas, no contra el propio cerebro:** `list_scheduled_tasks` y `list_artifacts` antes de dar por ciertas las tablas de `ecosistema.md`. Si una sesión retira una tarea o un artefacto, borrarlo de la tabla en el mismo movimiento.
- Si el cerebro contradice algo que Juanma dice hoy, **gana Juanma**; ofrecer actualizar el cerebro.
