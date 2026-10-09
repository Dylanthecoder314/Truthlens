#!/usr/bin/env bash
# Joins the rendered scenes, mixes the soundtrack and writes the finished film.
#
#   PY=/path/to/venv/bin/python ./assemble.sh
#
# Expects ../build/scenes/<id>.mp4 from render.mjs and ../build/narration.wav from tts.py.
set -euo pipefail
cd "$(dirname "$0")/.."
PY="${PY:-python3}"

order=$(node -e 'const t=JSON.parse(require("fs").readFileSync("scenes/timing.js","utf8").split("window.TIMING = ")[1].trim().replace(/;$/,""));console.log(t.order.join(" "))')
: > build/concat.txt
for id in $order; do
  [ -f "build/scenes/$id.mp4" ] || { echo "missing build/scenes/$id.mp4" >&2; exit 1; }
  echo "file 'scenes/$id.mp4'" >> build/concat.txt
done

ffmpeg -y -loglevel error -f concat -safe 0 -i build/concat.txt -c copy build/video.mp4
"$PY" -I tools/mix.py

mkdir -p out
ffmpeg -y -loglevel error -i build/video.mp4 -i build/mix.wav \
  -map 0:v -map 1:a -c:v libx264 -preset slow -crf 20 -tune animation -pix_fmt yuv420p \
  -af "loudnorm=I=-16:TP=-1.5:LRA=11" -c:a aac -b:a 192k -ar 48000 \
  -shortest -movflags +faststart \
  -metadata title="The Vanishing of MH370" -metadata comment="Narration: synthetic voice (Kokoro TTS). Maps: Natural Earth. No AI-generated footage." \
  out/MH370-documentary.mp4

ffprobe -v error -show_entries format=duration,size -of default=nw=1 out/MH370-documentary.mp4
