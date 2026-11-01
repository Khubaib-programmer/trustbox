#!/usr/bin/env bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"

echo "========================================================"
echo "  🚀 STARTING TRUSTBOX SYSTEM (HACKATHON DEMO RUNNER)   "
echo "========================================================"

# ── Check Node ──────────────────────────────────────────────
if ! command -v node &> /dev/null; then
  echo "❌ Node.js not found. Install from https://nodejs.org or: brew install node"
  exit 1
fi
echo "✅ Node.js $(node -v)  |  npm $(npm -v)"

# ── Check / Start Mosquitto ──────────────────────────────────
echo -e "\n🦟 [0/4] Checking Mosquitto MQTT broker..."
if ! command -v mosquitto &> /dev/null; then
  echo "❌ Mosquitto not found. Install with: brew install mosquitto"
  exit 1
fi

if lsof -i :1883 -t &> /dev/null; then
  echo "✅ Mosquitto already running on port 1883."
else
  echo "▶️  Starting local Mosquitto on port 1883..."
  mosquitto -c "$DIR/mosquitto.conf" -d
  sleep 1
  echo "✅ Mosquitto started."
fi

# ── Backend Dependencies ─────────────────────────────────────
echo -e "\n📦 [1/4] Checking Backend dependencies..."
cd "$DIR/backend"
if [ ! -d "node_modules" ]; then
  npm install
fi
echo "✅ Backend dependencies ready."

# ── Cryptographic Tests ──────────────────────────────────────
echo -e "\n🧪 [2/4] Verifying cryptographic chain engine..."
node test-chain.js

# ── Frontend Dependencies ────────────────────────────────────
echo -e "\n📦 [3/4] Checking Frontend dependencies..."
cd "$DIR/frontend"
if [ ! -d "node_modules" ]; then
  npm install
fi
echo "✅ Frontend dependencies ready."

# ── .env check ──────────────────────────────────────────────
echo -e "\n🔑 [4/4] Checking environment config..."
if [ ! -f "$DIR/backend/.env" ]; then
  echo "⚠️  No backend/.env found — copying from .env.example"
  cp "$DIR/backend/.env.example" "$DIR/backend/.env"
  echo "   ✏️  Edit backend/.env and set MONGODB_URI if you have Atlas credentials."
fi
echo "✅ .env present."

# ── Done ─────────────────────────────────────────────────────
echo -e "\n========================================================"
echo "  🎉 TrustBox verified and ready!"
echo "========================================================"
echo ""
echo "  Mosquitto:  mqtt://localhost:1883  🟢 running"
echo ""
echo "  Open 3 more terminals and run:"
echo ""
echo "  Terminal 1 — Backend:"
echo "    cd $(basename $DIR)/backend && npm run dev"
echo ""
echo "  Terminal 2 — Frontend:"
echo "    cd $(basename $DIR)/frontend && npm run dev"
echo ""
echo "  Terminal 3 — Simulator:"
echo "    cd $(basename $DIR)/backend && npm run simulate"
echo ""
echo "  Then open: http://localhost:3000 and select TB-001"
echo ""
echo "  Demo scenarios:"
echo "    npm run simulate:heat   → Temperature breach + ₹50,000 payout"
echo "    npm run simulate:drop   → Drop impact + ₹25,000 payout"
echo "========================================================"

