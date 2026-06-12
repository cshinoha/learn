#!/usr/bin/env bash
set -euo pipefail

URL="${1:-}"
MODE="${2:-quiet}"

if [ -z "$URL" ]; then
  echo "Usage: $0 <youtube-url> [quiet|verbose]" >&2
  echo "Example: $0 'https://www.youtube.com/watch?v=VIDEO_ID'" >&2
  echo "Example: $0 'https://www.youtube.com/watch?v=VIDEO_ID' verbose" >&2
  exit 1
fi

mkdir -p subs

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

SELECTED="$(
python3 - "$URL" "$TMP_DIR" <<'PY'
import re
import sys
from pathlib import Path
from yt_dlp import YoutubeDL

url = sys.argv[1]
tmp_dir = Path(sys.argv[2])

opts = {
    "quiet": True,
    "no_warnings": True,
    "skip_download": True,
    "noplaylist": True,
}

def find_lang(pool, base_lang):
    for code in pool.keys():
        c = code.lower()
        if c == base_lang or c.startswith(base_lang + "-"):
            return code
    return None

def fmt_time(seconds):
    if seconds is None:
        return "?"
    seconds = int(float(seconds))
    h = seconds // 3600
    m = (seconds % 3600) // 60
    s = seconds % 60
    return f"{h:02d}:{m:02d}:{s:02d}"

def clean_title(title):
    return re.sub(r"\s+", " ", str(title or "")).strip()

with YoutubeDL(opts) as ydl:
    info = ydl.extract_info(url, download=False)

manual = info.get("subtitles") or {}
auto = info.get("automatic_captions") or {}

manual_ru = find_lang(manual, "ru")
manual_en = find_lang(manual, "en")
auto_en = find_lang(auto, "en")
auto_ru = find_lang(auto, "ru")

chapters = info.get("chapters") or []
duration = info.get("duration")

if chapters:
    lines = []
    lines.append(f"Title: {clean_title(info.get('title'))}")
    lines.append(f"Video ID: {info.get('id')}")
    lines.append("")
    lines.append("Chapters:")
    lines.append("")

    for ch in chapters:
        start = ch.get("start_time")
        end = ch.get("end_time")
        if end is None:
            end = duration

        title = clean_title(ch.get("title"))
        lines.append(f"[{fmt_time(start)} - {fmt_time(end)}] {title}")

    (tmp_dir / "chapters.txt").write_text("\n".join(lines).strip() + "\n", encoding="utf-8")

# Priority:
# 1. manual ru
# 2. manual en
# 3. auto en
# 4. auto ru
# Other manual languages are ignored.

if manual_ru:
    print(f"manual\t{manual_ru}")
elif manual_en:
    print(f"manual\t{manual_en}")
elif auto_en:
    print(f"auto\t{auto_en}")
elif auto_ru:
    print(f"auto\t{auto_ru}")
else:
    print("NONE\tNONE")
PY
)"

KIND="$(printf '%s' "$SELECTED" | cut -f1)"
LANG="$(printf '%s' "$SELECTED" | cut -f2)"

if [ "$KIND" = "NONE" ]; then
  echo "No Russian or English subtitles found" >&2
  exit 2
fi

YTDLP_OPTS=(
  --sub-langs "$LANG"
  --sub-format "vtt"
  --convert-subs "srt"
  --skip-download
  --no-warnings
  --no-progress
  -o "$TMP_DIR/%(title).80s [%(id)s].%(ext)s"
)

if [ "$KIND" = "manual" ]; then
  YTDLP_OPTS+=(--write-subs)
else
  YTDLP_OPTS+=(--write-auto-subs)
fi

if [ "$MODE" != "verbose" ]; then
  YTDLP_OPTS+=(--quiet)
fi

yt-dlp "${YTDLP_OPTS[@]}" "$URL"

SAVED_COUNT=0

while IFS= read -r file; do
  base="$(basename "${file%.srt}")"

  # yt-dlp adds the language before .srt, e.g.:
  # Video title [VIDEO_ID].ru.srt
  # Strip the selected language from the final filename.
  base="${base%.$LANG}"

  sub_dest="subs/${base}.srt.txt"
  mv "$file" "$sub_dest"

  if [ -s "$TMP_DIR/chapters.txt" ]; then
    chapters_dest="subs/${base}.chapters.txt"
    cp "$TMP_DIR/chapters.txt" "$chapters_dest"
  fi

  SAVED_COUNT=$((SAVED_COUNT + 1))

  if [ "$MODE" = "verbose" ]; then
    echo "Saved subtitles: $sub_dest"
    if [ -s "$TMP_DIR/chapters.txt" ]; then
      echo "Saved chapters:  $chapters_dest"
    else
      echo "No chapters found"
    fi
  fi
done < <(find "$TMP_DIR" -type f -name "*.srt")

if [ "$SAVED_COUNT" -eq 0 ]; then
  echo "Subtitle file was not created" >&2
  exit 3
fi

if [ "$MODE" = "verbose" ]; then
  echo "Selected kind: $KIND"
  echo "Selected language: $LANG"
fi
