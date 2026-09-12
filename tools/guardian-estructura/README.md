# Guardián de estructura — Rosanta OS

Valida las reglas del README de `~/My Drive/Rosanta OS/` y escribe un reporte.
**Por defecto solo reporta.** Nunca borra nada.

## Correrlo

```bash
python3 ~/Dev/Rosanta/tools/guardian-estructura/guardian.py
```

Deja el reporte en `Rosanta OS/00_Admin/Auditorias/AAAA-MM-DD_Guardian.md`
y termina con una línea del estilo `819 violaciones · 73 críticas · 746 menores`.
Tarda menos de 1 segundo sobre los ~6.800 archivos. Se puede correr las veces
que sea: solo reescribe el reporte del día.

## Qué revisa

| | Regla | Severidad |
|---|---|---|
| R1 | archivos sueltos en la raíz de Rosanta OS; y que `_Codigo` / `_App` sigan siendo **alias** y no carpetas reales | menor / **crítica** |
| R2 | archivos reales en `Documents/Claude/Projects` (ahí solo van alias) | menor |
| R3 | código dentro de Drive (`.gs .js .ts .py .sh` crítico; `.html .json` a revisar) | crítica / menor |
| R4 | alias rotos: las 2 puertas de la raíz (`_Codigo`, `_App`), `Documents/Claude/Projects` y `~/Claude` | crítica |
| R5 | punteros de Google (`.gdoc .gsheet .gslides`) sin archivo real al lado, por pilar | menor |
| R6 | nombres fuera de `AAAA-MM-DD_Tema_vN.ext` en archivos nacidos desde 2026-08-18 | menor |
| R7 | `_Inbox/` con archivos de más de N días (default 7) | menor |

## Las dos puertas

`Rosanta OS/_Codigo` → `~/Dev/Rosanta` y `Rosanta OS/_App` → `~/Claude` existen para
que `Rosanta OS/` sea el único árbol que hay que abrir. **Son symlinks a propósito:**
si alguna se vuelve una carpeta real, Drive sincroniza los `.git` y los
`node_modules` de adentro y corrompe los repos. El guardián revisa las tres cosas
—que existan, que sean alias y que apunten a donde deben— y cualquiera de las tres
sale como crítica.

Están declaradas en el diccionario `PUERTAS` al inicio de `guardian.py`. Para
recrearlas:

```bash
ln -s ~/Dev/Rosanta "$HOME/My Drive/Rosanta OS/_Codigo"
```

```bash
ln -s ~/Claude "$HOME/My Drive/Rosanta OS/_App"
```

Excepciones que el guardián respeta por diseño:

- `_Archive/` no se revisa (ahí va lo viejo a propósito).
- No se entra por `_Codigo` ni `_App`: el recorrido nunca sigue symlinks, así
  que Dev y la carpeta de la app no se revisan dos veces.
- `_migracion_nube/` está permitida dentro de `Projects`.
- Una carpeta de `Projects` que contiene alias es una "centralita": su
  `LEEME.txt` / `README.md` / `.probe` sale como informativo, no como violación.
- `.DS_Store`, `Icon`, `._*`, `.git/`, `node_modules/` y las carpetas temporales
  de Drive Desktop se ignoran siempre.

## Arreglar

```bash
# 1. ver qué movería, sin tocar nada
python3 guardian.py --dry-run-fix

# 2. aplicarlo
python3 guardian.py --fix
```

`--fix` solo hace dos cosas:

- **archivar** el código ejecutable que está en Drive →
  `_Archive/Guardian_AAAA-MM-DD/<misma ruta relativa>`;
- **mandar a `_Inbox/`** lo que quedó suelto en la raíz o lo que es un archivo
  real dentro de `Projects`.

Nunca borra, nunca renombra alias, y si el destino ya existe le agrega `_2`.
Los `.html`/`.json`, los punteros de Google y los nombres fuera de norma **no**
los toca: son decisiones que dependen del contenido.

## Reparar alias rotos

Un alias roto es lo único que rompe un proyecto **en silencio**: la app lo sigue
listando pero no ve nada. Pasa cada vez que se mueve una carpeta en Drive.

```bash
python3 guardian.py --dry-run-realias
```

```bash
python3 guardian.py --realias
```

Cómo decide a dónde re-apuntar:

- **Las dos puertas** (`_Codigo`, `_App`) tienen el destino declarado en `PUERTAS`.
  No busca nada: las reconecta directo.
- **El resto**: toma el nombre de la carpeta a la que apuntaba y la busca en Drive
  y en Dev, empezando por la capa donde vivía. Si hay varias candidatas, gana la
  que comparte más tramos finales de ruta con el destino viejo.
- **Si quedan empatadas, no toca nada** y las lista para que decidas a mano. Nunca
  adivina.

El alias roto **no se borra**: se archiva en `_Archive/Alias_rotos_AAAA-MM-DD/`
como `<nombre>.roto`, con el destino viejo adentro, por si hace falta rastrear
qué apuntaba a dónde.

El nombre del alias nunca cambia — es la identidad del proyecto en la app. Lo
único que cambia es a dónde apunta.

## Opciones

```
--realias        repara los alias rotos (ver arriba)
--dry-run-realias  imprime qué repararía, sin tocar nada
--inbox-dias N   umbral de la regla 7 (default 7)
--salida RUTA    escribir el reporte en otro lado
--json RUTA      volcado adicional en JSON, para encadenar con otras herramientas
```
