#!/usr/bin/env bash
# Uso:
#   FECHA=2026-02-20 TITULO="Búsquedas..." ENLACE="https://github.com/sharkdp/fd" ./enviar_pildora.sh
# o sin variables: te preguntará.

set -euo pipefail

repo="erseco/pildora_del_viernes"
plantilla="pildora.yml"

read_var() {
  local varname="$1" prompt="$2" default="${!varname:-}"
  if [ -n "$default" ]; then printf -v "$varname" '%s' "$default"; else read -rp "$prompt: " "$varname"; fi
}

read_var TITULO "Título de la píldora (sin el prefijo [Píldora])"
read_var FECHA "Fecha de la píldora (YYYY-MM-DD)"
read_var ENLACE "Enlace relevante (opcional, dejar vacío si no hay)"
read_var DESCRIPCION "Descripción (markdown; fin con CTRL+D)" || true
if [ -z "${DESCRIPCION:-}" ]; then
  echo "Escribe la descripción y prensa CTRL+D:"
  DESCRIPCION="$(</dev/stdin)"
fi

gh issue create \
  --repo "$repo" \
  --template "$plantilla" \
  --title "[Píldora] ${TITULO}" \
  --field "fecha=${FECHA}" \
  --field "enlace=${ENLACE}" \
  --field "descripcion=${DESCRIPCION}"
