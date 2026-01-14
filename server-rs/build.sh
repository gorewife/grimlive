# Build script
#!/bin/bash
set -e

echo "🔨 Building Rust server..."

# Check if Rust is installed
if ! command -v cargo &> /dev/null; then
    echo "❌ Rust is not installed. Install from https://rustup.rs/"
    exit 1
fi

# Build release binary
cargo build --release

echo "✅ Build complete!"
echo "📦 Binary location: target/release/grimlive-server"
echo ""
echo "To run:"
echo "  ./target/release/grimlive-server"
