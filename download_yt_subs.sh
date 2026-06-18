#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 || "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
  cat >&2 <<'USAGE'
Usage: download_yt_subs.sh <youtube-url> [output-dir]
Downloads English subtitles as a timestamp evidence sidecar. Requires yt-dlp.
USAGE
  exit 2
fi

url="$1"
outdir="${2:-.}"
mkdir -p "$outdir"
yt-dlp --skip-download --write-subs --write-auto-subs --sub-langs 'en.*' --sub-format vtt --convert-subs srt -o "$outdir/%(title).120B [%(id)s].%(ext)s" "$url" >/dev/null
find "$outdir" -maxdepth 1 -type f \( -name '*.srt' -o -name '*.vtt' \) -printf '%p\n' | sort | tail -1
