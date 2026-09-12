# Conversor de punteros de Google — Rosanta OS

Un `.gdoc` / `.gsheet` / `.gslides` no es un archivo: es un JSON de ~180 bytes con
el ID del documento en Google. Cowork y Claude no lo pueden leer. Esta herramienta
exporta el documento real **al lado del puntero**, como
`AAAA-MM-DD_<nombre original>.docx` (o `.xlsx` / `.pptx`), con la fecha de la
conversión. **Nunca borra ni toca el puntero.**

## Correrlo

```bash
python3 ~/Dev/Rosanta/tools/convertir-punteros/convertir.py "ruta/al/Documento.gdoc"
```

```bash
python3 ~/Dev/Rosanta/tools/convertir-punteros/convertir.py --seco --recursivo "ruta/a/la/carpeta"
```

| Opción | Qué hace |
|---|---|
| `--recursivo` | entra en las subcarpetas |
| `--seco` | imprime qué haría, sin escribir nada |
| `--solo gdoc,gsheet` | filtra por tipo |
| `--rehacer` | reconvierte aunque el archivo de hoy ya exista |
| `--log RUTA` | dónde dejar el log (default: al lado de lo convertido) |

Si el archivo de hoy ya existe, lo salta. Se puede correr de nuevo sin efectos.

## Qué convertir y qué no

En Rosanta OS hay **426 punteros** (131 `.gdoc`, 291 `.gsheet`, 3 `.gslides`,
1 `.gform`). **No los conviertas todos.** Muchos `.gsheet` son hojas vivas que
Juanma edita en Google: una copia `.xlsx` al lado se desactualiza el mismo día y
después nadie sabe cuál manda. Convertí solo lo que Cowork necesita leer y que no
se va a volver a editar en Google.

El guardián de estructura los lista por pilar, en la regla 5 de su reporte, para
decidir uno por uno.

`.gform` no se puede exportar a Office: Drive devuelve 403. La herramienta lo
salta a propósito.

## Autenticación

La primera corrida abre el navegador y pide autorizar **solo lectura de Drive**
(`drive.readonly`). Entrá con `restaurante@rosanta.rest`. El token queda en
`~/.rosanta-drive-token.json` (permisos 600) y se renueva solo; no hay que volver
a autorizar.

Usa el `client_id`/`client_secret` de `~/Dev/Rosanta/clasp-creds.json`, que es un
cliente OAuth de aplicación instalada — **no** las credenciales de clasp. Se
revisó: `clasp-creds.json` no trae tokens ni scopes, y el token de clasp
(`~/.clasprc.json`) no incluye `drive.readonly`, así que reusarlo no servía.

Los 12 documentos del 2026-09-11 se convirtieron por otra vía: el conector de
Google Drive de Claude, que ya estaba autorizado con la misma cuenta y llama al
mismo endpoint de export. Log en
`Rosanta OS/00_Admin/Auditorias/2026-09-11_Conversion_punteros.log`.

## Límites de Drive

El export de Drive corta alrededor de **10 MB**. La herramienta captura ese error
(`exportSizeLimitExceeded`), lo reporta por archivo y sigue con el resto: no deja
nada a medias. El mayor de los 12 convertidos pesa 1.3 MB.
