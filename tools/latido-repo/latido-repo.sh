#!/bin/bash
# LATIDO DEL REPO (launchd, 15-oct-2026). Reemplaza a la tarea programada rosanta-latido-repo, que
# dependia de la app de Claude y se trababa por el limite de 3 corridas activas (no corrio del 8 al
# 14-oct). Lo corre launchd todos los dias a las 8:24; si la Mac estaba dormida, corre al despertar.
#
# SOLO MIRA: nunca commit, push, pull, checkout, stash ni reset (varias sesiones escriben a la vez).
# git fetch si: no toca el disco de trabajo.
#
# Avisa con una notificacion de la Mac solo si algo lleva mas de 1 dia sin guardar o hay commits
# sin subir. Siempre deja el resultado en ~/.rosanta-sellos/latido-repo.json (lo lee la tarea
# "Salud de la intranet" de los lunes) y una linea en ~/.rosanta-sellos/latido-repo.log.

REPO="${LATIDO_REPO:-$HOME/Dev/Rosanta}"   # LATIDO_REPO solo para probarlo
SALIDA="${LATIDO_SALIDA:-$HOME/.rosanta-sellos}"
mkdir -p "$SALIDA"
AHORA=$(date +%s)
CUANDO=$(date '+%Y-%m-%d %H:%M')
avisos=()

cd "$REPO" 2>/dev/null || avisos+=("No existe $REPO")
if [ ${#avisos[@]} -eq 0 ]; then
  git rev-parse --is-inside-work-tree >/dev/null 2>&1 || avisos+=("$REPO no es un repo git")
  git remote get-url origin >/dev/null 2>&1 || avisos+=("El repo no tiene remoto: no hay respaldo en GitHub")
fi

if [ ${#avisos[@]} -eq 0 ]; then
  if ! err=$(GIT_TERMINAL_PROMPT=0 git fetch -q origin main 2>&1); then
    avisos+=("git fetch fallo: ${err:0:150}")
  fi

  # 1. sin commitear, con su antiguedad (los borrados no tienen fecha: cuentan como de hoy)
  viejo=0; viejoNombre=""; n=0; sinRastrear=()
  while IFS= read -r linea; do
    [ -z "$linea" ] && continue
    n=$((n+1))
    ruta="${linea:3}"; ruta="${ruta#\"}"; ruta="${ruta%\"}"; ruta="${ruta##* -> }"
    if [ "${linea:0:2}" = "??" ]; then
      case "$ruta" in *.js|*.py|*.gs|*.html|*.md|*/) sinRastrear+=("$ruta");; esac
    fi
    if m=$(stat -f %m "$ruta" 2>/dev/null); then
      dias=$(( (AHORA - m) / 86400 ))
      if [ $dias -gt $viejo ]; then viejo=$dias; viejoNombre="$ruta"; fi
    fi
  done < <(git status --porcelain)
  if [ $viejo -ge 1 ]; then
    avisos+=("$n archivo(s) sin commitear; el mas viejo lleva $viejo dia(s): $viejoNombre")
  fi
  if [ ${#sinRastrear[@]} -gt 0 ] && [ $viejo -ge 1 ]; then
    avisos+=("Sin rastrear: ${#sinRastrear[@]} (${sinRastrear[*]:0:5})")
  fi

  # 2. commits sin subir
  sinSubir=$(git log --oneline origin/main..HEAD 2>/dev/null | wc -l | tr -d ' ')
  if [ "$sinSubir" -gt 0 ]; then
    masViejo=$(git log --reverse --format='%h %ad' --date=short origin/main..HEAD | head -1)
    avisos+=("$sinSubir commit(s) sin subir a GitHub; el mas viejo: $masViejo")
  fi
fi

if [ ${#avisos[@]} -eq 0 ]; then
  texto="Latido repo OK · sin cambios pendientes · main al dia con origin"
  ok=true
else
  texto="LATIDO REPO: $(printf '%s · ' "${avisos[@]}")Se cierra con: cd ~/Dev/Rosanta && git add -A && git commit -m '...' && git push"
  ok=false
  t=$(printf '%s' "$texto" | sed 's/"/\\"/g' | cut -c1-230)
  /usr/bin/osascript -e "display notification \"$t\" with title \"Rosanta · Latido del repo\" sound name \"Funk\"" >/dev/null 2>&1
fi

/usr/bin/python3 - "$SALIDA/latido-repo.json" "$CUANDO" "$ok" "$texto" <<'PY'
import json, sys
p, cuando, ok, texto = sys.argv[1:5]
json.dump({"cuando": cuando, "ok": ok == "true", "texto": texto}, open(p, "w"), ensure_ascii=False, indent=1)
PY
echo "$CUANDO $texto" >> "$SALIDA/latido-repo.log"
echo "$texto"
