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
"""

import sys
import os
import subprocess
import warnings
warnings.filterwarnings("ignore")

def ensure_faster_whisper():
    """Ensure faster-whisper is installed. If not, install it via pip."""
    try:
        from faster_whisper import WhisperModel
        return WhisperModel
    except ImportError:
        print("faster-whisper not found. Installing via pip...", file=sys.stderr)
        # Get the pip executable for THIS Python
        pip_cmd = [sys.executable, "-m", "pip", "install", "faster-whisper"]
        print(f"Running: {' '.join(pip_cmd)}", file=sys.stderr)
        try:
            result = subprocess.run(
                pip_cmd,
                capture_output=True,
                text=True,
                timeout=300,  # 5 min timeout
            )
            if result.returncode != 0:
                print(f"pip install failed:", file=sys.stderr)
                print(result.stderr, file=sys.stderr)
                print(f"\nTo fix manually, run:", file=sys.stderr)
                print(f"  {sys.executable} -m pip install faster-whisper", file=sys.stderr)
                sys.exit(1)
            print("faster-whisper installed successfully.", file=sys.stderr)
            # Now try the import again
            from faster_whisper import WhisperModel
            return WhisperModel
        except subprocess.TimeoutExpired:
            print("pip install timed out.", file=sys.stderr)
            print(f"\nTo fix manually, run:", file=sys.stderr)
            print(f"  {sys.executable} -m pip install faster-whisper", file=sys.stderr)
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
        print("Models: tiny | base | small | medium | large-v3 (default: base)")
        sys.exit(1)

    input_path = sys.argv[1]
    output_path = sys.argv[2]
    model_size = sys.argv[3] if len(sys.argv) > 3 else "base"

    if not os.path.exists(input_path):
        print(f"Error: Input file not found: {input_path}", file=sys.stderr)
        sys.exit(1)

    # Ensure faster-whisper is installed (auto-installs if missing)
    WhisperModel = ensure_faster_whisper()

    print(f"Loading Whisper model '{model_size}'...", file=sys.stderr)

    # Use int8 quantization for CPU — lowest memory footprint
    model = WhisperModel(model_size, device="cpu", compute_type="int8")

    print(f"Transcribing {input_path}...", file=sys.stderr)
    segments, info = model.transcribe(
        input_path,
        language=None,  # auto-detect
        beam_size=5,
        vad_filter=True,  # skip silence — faster
        vad_parameters={"min_silence_duration_ms": 500},
        word_timestamps=True,  # needed for accurate timing
    )

    print(f"Detected language: {info.language} (prob: {info.language_probability:.2%})", file=sys.stderr)
    print(f"Duration: {info.duration:.1f}s", file=sys.stderr)

    # Write SRT
    with open(output_path, "w", encoding="utf-8") as f:
        for i, segment in enumerate(segments, 1):
            start = format_timestamp(segment.start)
            end = format_timestamp(segment.end)
            text = segment.text.strip()
            if text:
                f.write(f"{i}\n")
                f.write(f"{start} --> {end}\n")
                f.write(f"{text}\n\n")

    print(f"SRT written to {output_path}", file=sys.stderr)

if __name__ == "__main__":
    main()
