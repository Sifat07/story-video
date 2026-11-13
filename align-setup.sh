#!/bin/sh
# Installs the optional word aligner for the free voices into .align/ next to this file:
# mlx-audio (~450 MB) plus the Qwen3-ForcedAligner-0.6B 8-bit model (~1.3 GB, Hugging Face cache).
# Apple Silicon Macs only (MLX). Remove with `rm -rf .align` and the model's folder in ~/.cache/huggingface/hub.
set -e
cd "$(dirname "$0")"
if [ "$(uname -s)" != "Darwin" ] || [ "$(uname -m)" != "arm64" ]; then
  echo "align-setup: the aligner runs on Apple Silicon Macs only (MLX); builds keep estimated word times"
  exit 1
fi
if command -v uv >/dev/null 2>&1; then
  uv venv -q -p 3.12 .align
  uv pip install -q --python .align/bin/python "mlx-audio==0.6.5"
else
  python3 -m venv .align
  .align/bin/pip install -q "mlx-audio==0.6.5"
fi
.align/bin/python align.py --download
