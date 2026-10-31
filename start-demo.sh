#!/usr/bin/env bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"

echo "========================================================"
echo "  🚀 STARTING TRUSTBOX SYSTEM (HACKATHON DEMO RUNNER)   "
echo "========================================================"

# Check Node
if ! command -v node &> /dev/null; then
  echo "❌ Node.js is not found in PATH. Please install Node v18+ or run: brew install node"
  exit 1
fi

echo " Node.js version: $(node -v)"
echo " npm version:     $(npm -v)"

# 1. Install Backend Dependencies
echo -e "\n📦 [1/4] Checking Backend dependencies..."
cd "$DIR/backend"
if [ ! -d "node_modules" ]; then
  npm install
fi

# 2. Run Cryptographic Tests
echo -e "\n🧪 [2/4] Verifying Cryptographic Parity & Chain Engine..."
node test-chain.js

# 3. Install Frontend Dependencies
echo -e "\n📦 [3/4] Checking Frontend dependencies..."
cd "$DIR/frontend"
if [ ! -d "node_modules" ]; then
  npm install
fi

echo -e "\n========================================================"
echo "  🎉 TrustBox setup verified and ready!"
echo "========================================================"
echo "To run the demo:"
echo "1. Terminal 1 (Backend):"
echo "   cd trustbox/backend && npm run dev"
echo ""
echo "2. Terminal 2 (Frontend):"
echo "   cd trustbox/frontend && npm run dev"
echo ""
echo "3. Terminal 3 (Simulator):"
echo "   cd trustbox/backend && npm run simulate"
echo "   - To breach cold chain: npm run simulate:heat"
echo "   - To drop box:         npm run simulate:drop"
echo "========================================================"

