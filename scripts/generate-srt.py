#!/usr/bin/env python3
"""
generate-srt.py — Transcribe a video file and output an SRT subtitle file.

Uses faster-whisper (CTranslate2 backend) which runs efficiently on CPU,
making it suitable for low-spec PCs. The "base" model is used by default
(~150MB RAM, good balance of speed/accuracy). For better accuracy, use
"small" or "medium"; for maximum speed, use "tiny".

Usage:
    python3 scripts/generate-srt.py <input-video> <output-srt> [model-size]

Models: tiny | base | small | medium | large-v3
Default: base (recommended for low-spec PCs — ~1x realtime on CPU)

Output: SRT file with word-level timestamps.
        Progress is written to stderr for the SSE stream to pick up.
"""

import sys
import os
import subprocess
import json
import warnings
warnings.filterwarnings("ignore")

def ensure_faster_whisper():
    """Ensure faster-whisper is installed. If not, install it via pip."""
    try:
        from faster_whisper import WhisperModel
        return WhisperModel
    except ImportError:
        print("PROGRESS:installing", file=sys.stderr, flush=True)
        pip_cmd = [sys.executable, "-m", "pip", "install", "faster-whisper"]
        print(f"Running: {' '.join(pip_cmd)}", file=sys.stderr, flush=True)
        try:
            result = subprocess.run(pip_cmd, capture_output=True, text=True, timeout=300)
            if result.returncode != 0:
                print(f"pip install failed:", file=sys.stderr, flush=True)
                print(result.stderr, file=sys.stderr, flush=True)
                print(f"\nTo fix manually, run:", file=sys.stderr, flush=True)
                print(f"  {sys.executable} -m pip install faster-whisper", file=sys.stderr, flush=True)
                sys.exit(1)
            print("faster-whisper installed successfully.", file=sys.stderr, flush=True)
            from faster_whisper import WhisperModel
            return WhisperModel
        except subprocess.TimeoutExpired:
            print("pip install timed out.", file=sys.stderr, flush=True)
            sys.exit(1)

def format_timestamp(seconds: float) -> str:
    """Convert seconds to SRT timestamp format: HH:MM:SS,mmm"""
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    millis = int((seconds - int(seconds)) * 1000)
    return f"{hours:02d}:{minutes:02d}:{secs:02d},{millis:03d}"

def main():
    if len(sys.argv) < 3:
        print("Usage: python generate-srt.py <input-video> <output-srt> [model-size]")
        sys.exit(1)

    input_path = sys.argv[1]
    output_path = sys.argv[2]
    model_size = sys.argv[3] if len(sys.argv) > 3 else "base"

    if not os.path.exists(input_path):
        print(f"Error: Input file not found: {input_path}", file=sys.stderr, flush=True)
        sys.exit(1)

    WhisperModel = ensure_faster_whisper()

    print(f"PROGRESS:loading_model", file=sys.stderr, flush=True)
    model = WhisperModel(model_size, device="cpu", compute_type="int8")

    print(f"PROGRESS:transcribing", file=sys.stderr, flush=True)

    # First pass: get duration via VAD or just start transcribing
    segments_iter, info = model.transcribe(
        input_path,
        language=None,
        beam_size=5,
        vad_filter=True,
        vad_parameters={"min_silence_duration_ms": 500},
        word_timestamps=True,
    )

    total_duration = info.duration
    print(f"PROGRESS:language:{info.language}:{total_duration}", file=sys.stderr, flush=True)

    # Write SRT while tracking progress
    segments_list = []
    seg_count = 0
    last_progress = 35

    with open(output_path, "w", encoding="utf-8") as f:
        for i, segment in enumerate(segments_iter, 1):
            start = format_timestamp(segment.start)
            end = format_timestamp(segment.end)
            text = segment.text.strip()
            if text:
                f.write(f"{i}\n")
                f.write(f"{start} --> {end}\n")
                f.write(f"{text}\n\n")
                f.flush()  # Write incrementally

            seg_count += 1

            # Calculate progress based on segment end time vs total duration
            if total_duration > 0:
                pct = 35 + int((segment.end / total_duration) * 50)  # 35% to 85%
                if pct > last_progress:
                    last_progress = pct
                    print(f"PROGRESS:transcribing:{pct}:{seg_count}:{segment.end:.1f}/{total_duration:.1f}s", file=sys.stderr, flush=True)

    print(f"PROGRESS:writing_srt:{seg_count}", file=sys.stderr, flush=True)
    print(f"SRT written to {output_path} ({seg_count} segments)", file=sys.stderr, flush=True)

if __name__ == "__main__":
    main()
