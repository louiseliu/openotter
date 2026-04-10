#!/bin/bash
# Creates a dev sidecar wrapper that delegates to the local hermes-agent install.
# For production, PyInstaller replaces this with a standalone binary.

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BINARIES_DIR="$SCRIPT_DIR/../src-tauri/binaries"
TARGET_TRIPLE=$(rustc --print host-tuple)

mkdir -p "$BINARIES_DIR"

WRAPPER="$BINARIES_DIR/hermes-sidecar-$TARGET_TRIPLE"

cat > "$WRAPPER" << 'WRAPPER_SCRIPT'
#!/bin/bash
# Dev wrapper: delegates to the installed hermes-agent venv
HERMES_VENV="$HOME/.hermes/hermes-agent/venv"

if [ ! -d "$HERMES_VENV" ]; then
    echo '{"error": "hermes-agent not installed. Run: curl -fsSL https://raw.githubusercontent.com/NousResearch/hermes-agent/main/scripts/install.sh | bash"}' >&2
    exit 1
fi

exec "$HERMES_VENV/bin/python" -u "$@"
WRAPPER_SCRIPT

chmod +x "$WRAPPER"
echo "Created dev sidecar: $WRAPPER"
