"""Optional word aligner for story-video's free voices (Kokoro, say, espeak). Apple Silicon only.

Forced alignment: given a line's audio and the exact text that was spoken, find when each word starts.
build.mjs runs this once per build for every line not already in .voice-cache, then maps the
tokens back onto its own words (and falls back to its estimate on any mismatch).

  stdin:  {"jobs": [{"wav": "/path/line.wav", "text": "What was said.", "language": "English"}]}
  stdout: [[["What", 0.12, 0.31], ["was", 0.31, 0.45], ...] or null, ...]   one entry per job

Install with `sh align-setup.sh` (mlx-audio in .align/, plus the model). `--download` fetches the
model; builds run with the Hugging Face hub offline, so a build never downloads it.
Model: Qwen3-ForcedAligner-0.6B (Apache-2.0), 8-bit MLX conversion by mlx-community.
"""
import json
import sys

MODEL = "mlx-community/Qwen3-ForcedAligner-0.6B-8bit"


def main():
    if "--download" in sys.argv:
        from huggingface_hub import snapshot_download

        snapshot_download(MODEL)
        print(f"aligner ready: {MODEL}")
        return
    jobs = json.load(sys.stdin)["jobs"]
    from mlx_audio.stt.utils import load_audio, load_model

    model = load_model(MODEL)
    out = []
    for job in jobs:
        try:
            audio = load_audio(job["wav"], sr=16000)
            items = model.generate(audio, text=job["text"], language=job.get("language", "English"))
            out.append([[i.text, round(float(i.start_time), 3), round(float(i.end_time), 3)] for i in items])
        except Exception as e:  # one bad line must not cost the others their timings
            print(f"align: {job['wav']}: {e}", file=sys.stderr)
            out.append(None)
    json.dump(out, sys.stdout)


if __name__ == "__main__":
    main()
