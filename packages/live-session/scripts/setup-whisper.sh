#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PACKAGE_DIR="$(dirname "$SCRIPT_DIR")"
WHISPER_DIR="$PACKAGE_DIR/whisper.cpp"
MODEL_NAME="${1:-large-v3-turbo}"

echo "=== Whisper.cpp Setup ==="
echo "Directory: $WHISPER_DIR"
echo "Model: $MODEL_NAME"
echo ""

# Check ffmpeg
if ! command -v ffmpeg &>/dev/null; then
  echo "ffmpeg is required. Install with: brew install ffmpeg"
  exit 1
fi

# Clone whisper.cpp
if [ ! -d "$WHISPER_DIR" ]; then
  echo "Cloning whisper.cpp..."
  git clone https://github.com/ggerganov/whisper.cpp "$WHISPER_DIR"
else
  echo "whisper.cpp already cloned, pulling latest..."
  cd "$WHISPER_DIR" && git pull
fi

cd "$WHISPER_DIR"

# Build with Metal (Apple GPU) support
echo ""
echo "Building whisper.cpp with Metal support..."
cmake -B build -DWHISPER_METAL=ON -DCMAKE_BUILD_TYPE=Release
cmake --build build --config Release -j$(sysctl -n hw.ncpu)

# Download model
if [ ! -f "$WHISPER_DIR/models/ggml-${MODEL_NAME}.bin" ]; then
  echo ""
  echo "Downloading model: $MODEL_NAME..."
  ./models/download-ggml-model.sh "$MODEL_NAME"
else
  echo "Model already downloaded: $MODEL_NAME"
fi

echo ""
echo "=== Setup Complete ==="
echo ""
echo "To start the Whisper server:"
echo "  cd $WHISPER_DIR"
echo "  ./build/bin/whisper-server -m models/ggml-${MODEL_NAME}.bin -l ja --port 8178"
echo ""
echo "Or use: pnpm whisper:server"
