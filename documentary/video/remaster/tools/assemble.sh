#!/usr/bin/env bash
# Builds the edited film: the upload's intro, then the rebuilt narration section.
#
#   PY=/path/to/venv/bin/python ./assemble.sh /path/to/documentry-2.mp4
#
# Expects ../build/scenes/rA.mp4 and rB.mp4 from:
#   node ../../tools/render.mjs --root .. --parts 4
set -euo pipefail
SRC="$1"
cd "$(dirname "$0")/.."
PY="${PY:-python3}"
KEEP=$(node -e 'console.log(require("./cues.json").keep_intro_until)')

"$PY" -I tools/mix_edit.py "$SRC"

mkdir -p out
ffmpeg -y -loglevel error -i "$SRC" -i build/scenes/rA.mp4 -i build/scenes/rB.mp4 -i build/mix.wav \
  -filter_complex "[0:v]trim=0:${KEEP},setpts=PTS-STARTPTS,fps=60,format=yuv420p[v0];\
[1:v]fps=60,format=yuv420p,setpts=PTS-STARTPTS[v1];\
[2:v]fps=60,format=yuv420p,setpts=PTS-STARTPTS[v2];\
[v0][v1][v2]concat=n=3:v=1:a=0[v];\
[3:a]alimiter=limit=0.89:level=false[a]" \
  -map "[v]" -map "[a]" -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p -r 60 \
  -c:a aac -b:a 192k -ar 48000 -shortest -movflags +faststart \
  out/documentary-2-edit.mp4

ffprobe -v error -show_entries format=duration,size -of default=nw=1 out/documentary-2-edit.mp4
