#!/usr/bin/env bash
# 使い方は skills/pixel-layout-check/SKILL.md を参照
set -euo pipefail

usage() {
  cat <<'EOF'
measure.sh body <part.png>
measure.sh border <part.png> <rgb>
measure.sh extent <img.png> <y0> <h>
measure.sh corners <img.png>
measure.sh zoom <img.png> <x> <y> <w> <h> [scale] <out.png>
EOF
}

cmd=${1:-}; shift || true
case "$cmd" in
  body)
    magick "$1" -channel A -threshold 85% +channel -alpha extract -trim -format "body=%wx%h off=%X,%Y\n" info:
    ;;
  border)
    magick "$1" -fuzz 6% -fill white -opaque "$2" -fill black +opaque white -trim -format "border=%wx%h off=%X,%Y\n" info:
    ;;
  extent)
    img=$1; y0=$2; h=$3
    W=$(magick "$img" -format "%w" info:)
    magick "$img" -crop "${W}x${h}+0+${y0}" +repage -colorspace Gray -threshold 30% -scale "${W}x1!" -threshold 1% -trim \
      -format "extent: left=%X width=%w (right margin = ${W} - left - width)\n" info:
    ;;
  corners)
    img=$1
    W=$(magick "$img" -format "%w" info:); H=$(magick "$img" -format "%h" info:)
    magick "$img" -format "tl=%[pixel:p{0,0}] tr=%[pixel:p{$((W-1)),0}] bl=%[pixel:p{0,$((H-1))}] br=%[pixel:p{$((W-1)),$((H-1))}] top=%[pixel:p{$((W/2)),0}] bottom=%[pixel:p{$((W/2)),$((H-1))}] left=%[pixel:p{0,$((H/2))}] right=%[pixel:p{$((W-1)),$((H/2))}]\n" info:
    ;;
  zoom)
    img=$1; x=$2; y=$3; w=$4; h=$5
    if [ $# -ge 7 ]; then scale=$6; out=$7; else scale=200; out=$6; fi
    magick "$img" -crop "${w}x${h}+${x}+${y}" +repage -scale "${scale}%" "$out"
    echo "wrote $out"
    ;;
  *)
    usage; exit 1
    ;;
esac
