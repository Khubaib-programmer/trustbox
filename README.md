# 📦 TrustBox — Tamper-Evident Smart Delivery & Parametric Insurance

> **A hardware-integrated, cryptographically secured IoT delivery monitoring and instant parametric insurance platform.**

[![HackCulture Submission](https://img.shields.io/badge/HackCulture-Hackathon%20Submission-FF3B30?style=for-the-badge&logo=target)](https://github.com/Khubaib-programmer/trustbox)
[![Repository](https://img.shields.io/badge/GitHub-Repo-181717?style=for-the-badge&logo=github)](https://github.com/Khubaib-programmer/trustbox)
[![Node.js](https://img.shields.io/badge/Node.js-v20+-339933?style=for-the-badge&logo=node.js)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react)](https://react.dev/)
[![MQTT](https://img.shields.io/badge/MQTT-Mosquitto-660066?style=for-the-badge&logo=eclipsemosquitto)](https://mosquitto.org/)
[![Database](https://img.shields.io/badge/MongoDB-Atlas%20Cloud-47A248?style=for-the-badge&logo=mongodb)](https://www.mongodb.com/atlas)

---

## 🎯 Problem Statement

In modern logistics and high-value cargo transit (biologicals, vaccines, fresh confections, and sensitive electronics):

1. **Cold-Chain & Environmental Spoilage:** Over $35 Billion worth of pharmaceutical and perishable goods are wasted annually due to undetected temperature and humidity breaches in transit.
2. **Transit Shock & Concealed Damage:** Packages suffer violent drops, tipping, or moisture leaks inside transit vans, but damage is often discovered days after delivery, leading to disputed blame.
3. **Zero Accountability & Data Tampering:** Conventional data loggers store plain unverified records that can be modified, deleted, or falsified before presentation.
4. **Bureaucratic Insurance Claims:** Traditional cargo insurance takes **30 to 90 days** of paperwork, investigations, and disputes before settlement.

---

## 💡 The Solution — TrustBox

**TrustBox** transforms ordinary deliveries into autonomous, tamper-evident black boxes with automated insurance settlements:

- **IoT Telemetry Hardware:** An ESP32 microcontroller continuously samples environmental conditions (Temperature, Humidity, SW-420 Shock/Vibration, Tilt, Light intrusion, Lid state).
- **Zero-Trust Cryptographic Hash Chain:** Every telemetry packet is sequentially bound via **SHA-256** and signed with **HMAC-SHA256** on-chip. If even a single reading or timestamp is altered, the chain breaks mathematically.
- **Instant Parametric Insurance Engine:** The moment a cold-chain failure or severe shock threshold is crossed for the sustained window, claims are **auto-approved and settled within seconds** without manual paperwork.
- **High-Risk Cargo Protection:** Compromised packages are instantly flagged as **`NOT DELIVERED`** on the live dashboard to stop spoiled or broken goods from reaching customers.
- **Public Auditability:** Stakeholders can scan a QR code to verify the cryptographic chain of custody at `/verify/:boxId`.

---

## 👥 Team Details

- **Team Name:** TrustBox Innovations
- **Project Repository:** [https://github.com/Khubaib-programmer/trustbox](https://github.com/Khubaib-programmer/trustbox)

| Name | Role | Responsibilities |
|---|---|---|
| **Mohd Khubaib Ansari** | Full-Stack & IoT Lead | System Architecture, IoT Firmware, Hash-Chain Crypto Engine, Backend & Frontend Development |
| **Team Member 2** | Hardware & Sensors | Sensor Integration (DHT22, SW-420, MPU-6050), Circuit Design & Testing |
| **Team Member 3** | UI/UX & WebSockets | Dashboard UI, Real-time Charts, Mobile-first Audit Verification Page |
| **Team Member 4** | Insurance Logic & QA | Parametric Settlement Engine, Test Automation & Edge Case Validation |

---

## 📽️ Presentation & Pitch Deck

- **Presentation Link (Google Slides / PPT):** [🔗 Click Here to View TrustBox Pitch Deck](https://docs.google.com/presentation/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit?usp=sharing)
*(Replace with your finalized Google Slides public link before final submission)*

---

## 🏗️ System Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                        1. HARDWARE LAYER (ESP32)                       │
│  [DHT22: Temp/Humidity] [SW-420: Shock] [LDR: Light] [Reed: Lid Seal] │
│                                   │                                    │
│                     On-Chip SHA-256 + HMAC-SHA256                      │
│                  Sequence Chain: [prev_hash ➔ hash]                    │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ MQTT (port 1883)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        2. BROKER & BACKEND LAYER                       │
│                     [Mosquitto Local MQTT Broker]                      │
│                                   │                                    │
│                 [Node.js + Express Server — :4000]                     │
│   ├── Chain Verifier (verifyChain / verifySingleRecord)                │
│   ├── Parametric Insurance Engine (Auto Claims & Payouts)              │
│   ├── Persistence: MongoDB Atlas Cloud Database                        │
│   └── Real-time Broadcast: Socket.IO Server                            │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ WebSocket / REST API
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        3. CLIENT LAYER (REACT + VITE)                  │
│                     [Live Web Dashboard — :3000]                       │
│   • Live KPI Row: Temperature, Humidity, SW-420 Shock Indicator        │
│   • Delivery Verdict: [✅ DELIVERED SAFELY] vs [❌ NOT DELIVERED]       │
│   • Recharts Live Sensor Graphs & OpenStreetMap Route Tracking         │
│   • Auto-Settled Insurance Claim Card + Settlement Payout ID           │
│   • Public Verification Portal: /verify/:boxId (QR Scan Audit)         │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 🧪 Real-World Test Cases & Scenarios (Verified)

TrustBox has been evaluated against three real-world product classes with automated proof-of-delivery logic:

| Item | Box ID | Monitored Hazards | Incident Occurred | Delivery Verdict | Insurance Settlement |
|---|---|---|---|---|---|
| **🎂 Cream Cake** | `CAKE-001` | Cold-chain ≤8°C & Gentle Handling | Pothole drop (>4.5G) + Cooling failed (16.5°C sustained) | **❌ NOT DELIVERED** *(High Risk: Smashed & Melted)* | **₹75,000 INR** *(₹50k Heat + ₹25k Shock)* |
| **📺 55" Smart TV** | `TV-001` | Moisture ≤75% Humidity | Rain leakage in transit van (88% humidity) | **❌ NOT DELIVERED** *(High Risk: Circuit Damage)* | **₹30,000 INR** *(Humidity Breach Claim)* |
| **📚 Textbooks** | `BOOKS-001` | Standard Cargo | Safe transit (22°C, 48% Humidity, 0G Shock) | **✅ DELIVERED SAFELY** *(Zero Claims)* | **₹0 INR** *(Clean Delivery)* |

> Test outputs and verifiable cryptographic proofs are automatically saved to [`backend/simulation-results.json`](./backend/simulation-results.json) and [`backend/simulation-report.md`](./backend/simulation-report.md).

---

## 🔐 Cryptographic Integrity & Anti-Tamper Model

Every record builds a canonical cryptographic string:
```
box_id | seq | ts | temp_c | humidity | shock | tilt | flipped | light | lid_open | event | prev_hash
```

1. **SHA-256 Link:** `hash = SHA256(canonical_string)`.
2. **HMAC Signature:** `sig = HMAC_SHA256(DEVICE_KEY, hash)`.
3. **Sequential Immutability:** Block `N` incorporates `prev_hash = hash(N-1)`.
4. **Tamper Detection:** Modifying even **0.1°C** or a single bit in past records breaks all downstream hashes instantly. The dashboard alerts **`Records were tampered with at seq #N`**.

---

## ⚡ Quick Start Guide (5 Minutes)

### Prerequisites
- Node.js v18+ and npm installed
- Mosquitto MQTT broker (`brew install mosquitto` on macOS or `sudo apt install mosquitto` on Linux)

### 1. Automated Launcher (Recommended)
```bash
git clone https://github.com/Khubaib-programmer/trustbox.git
cd trustbox
chmod +x start-demo.sh
./start-demo.sh
```

### 2. Manual Startup (3 Terminals)

**Terminal 1 — MQTT Broker:**
```bash
mosquitto -c mosquitto.conf
```

**Terminal 2 — Backend Server:**
```bash
cd backend
npm install
npm run dev
```

**Terminal 3 — Frontend Dashboard:**
```bash
cd frontend
npm install
npm run dev
```

Open **`http://localhost:3000`** in your browser.

---

## 🚀 Running Simulations

Run the complete 3-item delivery simulation (Cake, TV, Books) with a single command:
```bash
cd backend
npm run simulate:items
```

Individual test scenarios:
```bash
# Temperature breach simulation (Cake / Vaccines)
npm run simulate:heat

# Heavy shock / drop impact simulation (TV / Fragile goods)
npm run simulate:drop
```

---

## 🧪 Test Suite

Run unit and end-to-end integration tests:
```bash
cd backend
# 1. Cryptographic chain unit tests (11/11 passed)
npm test

# 2. Complete REST API & Insurance integration tests (17/17 passed)
npm run test:api
```

---

## 📂 Project Structure

```
trustbox/
├── README.md                      ← Hackathon submission documentation
├── start-demo.sh                  ← One-command launcher
├── mosquitto.conf                 ← Local MQTT broker configuration
│
├── backend/
│   ├── server.js                  ← Express REST, MQTT ingestion & WebSockets
│   ├── chain.js                   ← SHA-256 hash-chaining & HMAC-SHA256 engine
│   ├── insurance.js               ← Automated parametric insurance engine
│   ├── models.js                  ← Mongoose schemas (Record, Claim, Payout)
│   ├── simulate-items.js          ← 3-Item simulation (Cake, TV, Books)
│   ├── simulation-results.json    ← Machine-readable simulation verification
│   ├── simulation-report.md       ← Comprehensive test audit report
│   ├── fake-publisher.js          ← Hardware telemetry simulator
│   ├── test-chain.js              ← Cryptographic chain test suite
│   ├── test-api.js                ← REST & Insurance end-to-end test suite
│   └── .env                       ← MongoDB Atlas & secret keys
│
├── frontend/
│   ├── src/
│   │   ├── pages/Dashboard.jsx    ← Live monitoring dashboard & hero risk badge
│   │   ├── pages/VerifyPage.jsx   ← Public QR-code audit verification page
│   │   ├── components/KpiTile.jsx ← KPI tile (Temp, Humidity, SW-420 Shock)
│   │   ├── components/PayoutCard.jsx ← Parametric settlement card
│   │   └── components/RouteMap.jsx   ← Leaflet transit route map
│   └── package.json
│
└── firmware/
    └── trustbox_esp32.ino         ← Arduino sketch for physical ESP32 device
```

---

*Submitted with ❤️ for HackCulture Hackathon 2026 — Team TrustBox*
