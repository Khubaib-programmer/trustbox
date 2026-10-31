# 📦 TrustBox — Tamper-Evident Smart Delivery System

> **A hardware-integrated, cryptographically secured, IoT-powered delivery monitoring and parametric insurance platform.**

TrustBox monitors the physical condition of a delivery box in real-time using an ESP32 microcontroller, publishes tamper-proof cryptographic telemetry over MQTT, verifies an unbreakable SHA-256 hash chain, and automatically approves insurance payouts the moment a cold-chain breach or drop impact is detected — all visible live on a React dashboard.

---

## 📋 Table of Contents

1. [System Overview](#1-system-overview)
2. [Architecture Diagram](#2-architecture-diagram)
3. [Complete File Structure](#3-complete-file-structure)
4. [Technology Stack](#4-technology-stack)
5. [How the Full Workflow Works](#5-how-the-full-workflow-works)
6. [Cryptographic Security Model](#6-cryptographic-security-model)
7. [Insurance Engine Logic](#7-insurance-engine-logic)
8. [Prerequisites — Install Before Anything](#8-prerequisites--install-before-anything)
9. [Quick Start (5 Minutes)](#9-quick-start-5-minutes)
10. [Detailed Backend Setup](#10-detailed-backend-setup)
11. [Detailed Frontend Setup](#11-detailed-frontend-setup)
12. [Environment Variables Reference](#12-environment-variables-reference)
13. [MQTT Integration Guide](#13-mqtt-integration-guide)
14. [IoT Hardware Integration (ESP32)](#14-iot-hardware-integration-esp32)
15. [Raw IoT Payload — New Hardware Format](#15-raw-iot-payload--new-hardware-format)
16. [API Reference](#16-api-reference)
17. [Socket.IO Real-Time Events](#17-socketio-real-time-events)
18. [Telemetry Simulator (No Hardware Needed)](#18-telemetry-simulator-no-hardware-needed)
19. [Running Tests](#19-running-tests)
20. [Dashboard Pages Guide](#20-dashboard-pages-guide)
21. [Database Schema](#21-database-schema)
22. [Troubleshooting](#22-troubleshooting)
23. [Demo Scenarios](#23-demo-scenarios)
24. [Pushing to GitHub](#24-pushing-to-github)

---

## 1. System Overview

TrustBox is built around three independent but tightly integrated layers:

| Layer | What it does |
|---|---|
| **Hardware (ESP32 Firmware)** | Reads sensors, computes SHA-256 hash chain + HMAC-SHA256 signature, publishes signed telemetry over MQTT/TLS |
| **Backend (Node.js + Express)** | Receives telemetry via MQTT or HTTP, verifies cryptographic integrity, persists to MongoDB, runs insurance engine, broadcasts via Socket.IO |
| **Frontend (React + Vite)** | Live dashboard — real-time charts, chain verification status, custody log, claim/payout display, QR scanner, route map |

### What makes it tamper-evident?

Every telemetry record includes:
- A **SHA-256 hash** computed from its own sensor data + the hash of the previous record (blockchain-style linking)
- An **HMAC-SHA256 signature** using a device secret key

If anyone modifies even a single byte of any record, the entire chain breaks. The dashboard shows this instantly.

---

## 2. Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         HARDWARE LAYER                              │
│                                                                     │
│   [DHT22/DS18B20]  [MPU-6050]  [Reed Switch]  [LDR]  [SW-420]     │
│        │               │             │           │        │         │
│        └───────────────┴─────────────┴───────────┘        │         │
│                              │                            │         │
│                        [ESP32 MCU]                                  │
│                   SHA-256 + HMAC-SHA256                             │
│                   Hash chain computation                            │
│                              │                                      │
│                     [WiFi / TLS 8883]                               │
└──────────────────────────────│──────────────────────────────────────┘
                               │ MQTT over TLS
                               ▼
                   [HiveMQ Cloud Broker]
                               │
┌──────────────────────────────│──────────────────────────────────────┐
│                         BACKEND LAYER                               │
│                                                                     │
│              [Node.js + Express — port 4000]                        │
│                              │                                      │
│   ┌──────────────────────────┼────────────────────────────────┐    │
│   │                          │                                 │    │
│   ▼                          ▼                                 ▼    │
│ [MQTT Subscriber]    [REST API Endpoints]    [IoT Raw Adapter]      │
│ trustbox/+/telemetry  POST /api/records      POST /api/iot/ingest   │
│ trustbox/+/event      GET  /api/verify/:id                          │
│ trustbox/raw/#                                                       │
│   │                          │                                 │    │
│   └──────────────────────────┴────────────────────────────────┘    │
│                              │                                      │
│   ┌───────────────┬──────────┴──────────┬───────────────────────┐  │
│   │               │                     │                       │  │
│   ▼               ▼                     ▼                       ▼  │
│ [chain.js]  [insurance.js]        [MongoDB Atlas]          [Socket.IO] │
│ SHA-256      Auto claim +         Records / Claims          Broadcasts  │
│ HMAC verify  Payout engine        Payouts stored            to browser  │
└─────────────────────────────────────────────────────────────────────┘
                               │ WebSocket
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         FRONTEND LAYER                              │
│                                                                     │
│              [React + Vite — port 3000]                             │
│                                                                     │
│   [Dashboard.jsx]              [VerifyPage.jsx]                     │
│   • Device selector            • QR code scanner                   │
│   • Live temp/humidity chart   • Hash chain audit result           │
│   • Custody event log          • Record-by-record verification      │
│   • Claims & Payout cards      • Tamper detection banner            │
│   • Route map (Leaflet)                                             │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. Complete File Structure

```
trustbox-main/
├── README.md                       ← This file
├── start-demo.sh                   ← One-command full demo launcher
├── .gitignore                      ← Excludes .env, node_modules, dist
│
├── backend/
│   ├── server.js                   ← Main Express server (all API + MQTT + Socket.IO)
│   ├── chain.js                    ← SHA-256 hash chain + HMAC-SHA256 logic
│   ├── insurance.js                ← Parametric insurance engine
│   ├── models.js                   ← Mongoose schemas (Record, Claim, Payout)
│   ├── fake-publisher.js           ← Hardware simulator (no ESP32 needed)
│   ├── test-chain.js               ← Unit tests: cryptographic chain
│   ├── test-api.js                 ← Integration tests: all REST endpoints
│   ├── package.json                ← Backend dependencies
│   ├── .env                        ← Secret credentials (NEVER committed to git)
│   └── .env.example                ← Template — copy this to create .env
│
├── frontend/
│   ├── index.html                  ← App shell
│   ├── vite.config.js              ← Vite dev server + API proxy to :4000
│   ├── tailwind.config.js          ← Tailwind CSS config
│   ├── package.json                ← Frontend dependencies
│   └── src/
│       ├── main.jsx                ← React entry point
│       ├── App.jsx                 ← Router (Dashboard + VerifyPage routes)
│       ├── index.css               ← Global styles + Tailwind directives
│       ├── pages/
│       │   ├── Dashboard.jsx       ← Main live monitoring dashboard
│       │   └── VerifyPage.jsx      ← Public chain verification + QR scanner
│       └── components/
│           ├── PayoutCard.jsx      ← Insurance payout display card
│           ├── QRCodeModal.jsx     ← QR code generator modal
│           └── RouteMap.jsx        ← Leaflet GPS route map
│
├── firmware/
│   └── trustbox_esp32.ino          ← Arduino sketch for ESP32 hardware
│
└── docs/
    ├── HARDWARE.md                 ← Hardware wiring + pinout reference
    └── PAYLOAD.md                  ← MQTT payload format specification
```

---

## 4. Technology Stack

### Backend
| Package | Version | Purpose |
|---|---|---|
| `express` | ^4.21 | REST API server |
| `mongoose` | ^8.8 | MongoDB ODM |
| `mqtt` | ^5.10 | MQTT client (subscriber + publisher) |
| `socket.io` | ^4.8 | Real-time WebSocket broadcast |
| `cors` | ^2.8 | Cross-origin header handling |
| `dotenv` | ^16.4 | Environment variable loader |
| Node.js `crypto` | built-in | SHA-256, HMAC-SHA256 |

### Frontend
| Package | Version | Purpose |
|---|---|---|
| `react` | ^18.3 | UI framework |
| `vite` | ^5.4 | Dev server + bundler |
| `react-router-dom` | ^6.28 | Client-side routing |
| `recharts` | ^2.13 | Temperature/humidity charts |
| `socket.io-client` | ^4.8 | Live data from backend |
| `leaflet` | ^1.9 | GPS route map |
| `qrcode.react` | ^4.2 | QR code generation |
| `lucide-react` | ^1.16 | Icons |
| `canvas-confetti` | ^1.9 | Payout celebration effect |
| `tailwindcss` | ^3.4 | Utility CSS |

### Services
| Service | Purpose |
|---|---|
| **MongoDB Atlas** | Cloud database — records, claims, payouts |
| **HiveMQ Cloud** | Managed MQTT broker with TLS (free tier available) |

---

## 5. How the Full Workflow Works

This section traces a single telemetry record from sensor reading to dashboard display.

### Step 1 — Sensor Reading (Hardware)
The ESP32 reads all sensors every 2 seconds:
- Temperature from DHT22 or DS18B20 (formatted to 1 decimal place)
- Humidity from DHT22
- Shock from SW-420 vibration sensor (0 or 1)
- Tilt/flipped from ball switch or MPU-6050 gyro
- Lid open from magnetic reed switch (GPIO 5)
- Light level from LDR photoresistor (ADC on GPIO 34)

### Step 2 — Canonical String Construction (Hardware)
The firmware builds a deterministic pipe-delimited string from the sensor values:
```
box_id|seq|ts|temp_c|humidity|shock|tilt|flipped|light|lid_open|event|prev_hash
```
Example:
```
TB-001|55|1746030000|4.8|54.2|0|0|0|35|0|NONE|1c7060b22f26390...
```

### Step 3 — Cryptographic Signing (Hardware)
1. **SHA-256** of the canonical string → `hash` (64 hex chars)
2. **HMAC-SHA256** of the `hash` using `DEVICE_KEY` → `sig` (64 hex chars)
3. Sequence number `seq` increments by 1
4. `prev_hash` is set to the `hash` of the previous record (or 64 zeros for record #0)

### Step 4 — MQTT Publish (Hardware → Broker)
The full signed JSON is published over TLS to the broker:
```
Topic:   trustbox/TB-001/telemetry
Payload: { box_id, seq, ts, temp_c, humidity, shock, tilt, flipped,
           light, lid_open, event, prev_hash, hash, sig }
```

### Step 5 — Backend MQTT Receive
The backend is subscribed to `trustbox/+/telemetry` and `trustbox/+/event`. On message arrival it calls `handleIncomingRecord()` which:

1. **Schema validation** — checks all required fields, physical range limits
2. **Hash verification** — recomputes SHA-256 from canonical string, compares with payload `hash`
3. **Signature verification** — recomputes HMAC-SHA256 using `DEVICE_KEY`, compares with payload `sig`
4. **Chain continuity** — checks `seq == latest_seq + 1` and `prev_hash == latest_hash`
5. **Duplicate rejection** — rejects if seq already exists (MongoDB unique index)
6. **MongoDB persistence** — saves to `records` collection
7. **Socket.IO broadcast** — emits `record` event to all connected dashboards
8. **Insurance evaluation** — passes to insurance engine

### Step 6 — Insurance Engine Evaluation
`insurance.js` checks every record:
- If `temp_c > 8.0°C` for more than 15 consecutive seconds → auto-approve `TEMP_BREACH` claim → create payout of ₹50,000
- If `shock == 1` or `event == "DROP"` → auto-approve `DROP` claim → create payout of ₹25,000
- Claims and payouts are saved to MongoDB and broadcast via Socket.IO

### Step 7 — Frontend Dashboard Update
The React dashboard receives the Socket.IO `record` event, updates:
- Live temperature/humidity chart
- Custody event log (tamper/drop/breach events)
- Chain integrity status badge
- Claims and payout cards (with confetti animation on first payout)

### Step 8 — Chain Verification (Public Audit)
Any stakeholder can visit `/verify/TB-001` or scan a QR code to run a full cryptographic audit:
- Fetches all records from `GET /api/verify/:boxId`
- Re-verifies every SHA-256 hash and HMAC signature in the chain
- Shows exactly which record was tampered (if any) and when

---

## 6. Cryptographic Security Model

### Hash Chain Structure

```
Record #0               Record #1               Record #2
┌────────────────┐      ┌────────────────┐      ┌────────────────┐
│ prev_hash:     │      │ prev_hash:     │      │ prev_hash:     │
│ 0000...0000    │      │ hash of #0     │      │ hash of #1     │
│                │      │                │      │                │
│ sensor data    │─────▶│ sensor data    │─────▶│ sensor data    │
│                │      │                │      │                │
│ hash: SHA256   │      │ hash: SHA256   │      │ hash: SHA256   │
│ (canonical)    │      │ (canonical)    │      │ (canonical)    │
│                │      │                │      │                │
│ sig: HMAC      │      │ sig: HMAC      │      │ sig: HMAC      │
│ (DEVICE_KEY)   │      │ (DEVICE_KEY)   │      │ (DEVICE_KEY)   │
└────────────────┘      └────────────────┘      └────────────────┘
```

### Canonical String Format
```
box_id|seq|ts|temp_c|humidity|shock|tilt|flipped|light|lid_open|event|prev_hash
```

**Critical formatting rules:**
- `temp_c` and `humidity` → exactly **1 decimal place** (e.g., `4.8` not `4.80`)
- `shock`, `tilt`, `flipped`, `lid_open` → integer `0` or `1` (not `true`/`false`)
- `ts` → Unix epoch in **seconds** (not milliseconds)
- `prev_hash` → 64-character lowercase hex string
- `event` → `"NONE"` when no anomaly (not empty string)

### Why This Is Tamper-Proof
If an attacker modifies `temp_c` in record #7:
1. The SHA-256 hash of record #7's canonical string changes
2. Record #8's `prev_hash` no longer matches record #7's new hash
3. Record #8's own canonical string is now wrong, cascading to #9, #10...
4. The chain verification catches this immediately and reports: `brokenAt: 7`

---

## 7. Insurance Engine Logic

The engine in `backend/insurance.js` runs automatically on every ingested record.

### Temperature Breach Claim
```
Trigger:  temp_c > CLAIM_TEMP_C (default 8.0°C) sustained for > CLAIM_WINDOW_SEC (default 15s)
Payout:   ₹50,000 INR
Claim:    { type: "TEMP_BREACH", status: "APPROVED" }
```

### Drop/Impact Claim
```
Trigger:  shock == 1 OR event == "DROP" (first occurrence per box)
Payout:   ₹25,000 INR
Claim:    { type: "DROP", status: "APPROVED" }
```

### Claim De-duplication
Each box gets at most **one TEMP_BREACH claim** and **one DROP claim** per delivery lifecycle. The engine checks MongoDB on startup to restore state across server restarts.

### In-Memory Fallback
If MongoDB is unavailable, claims and payouts are stored in memory (survive until process restart) and the full insurance flow still works for demo purposes.

---

## 8. Prerequisites — Install Before Anything

### Required Software

| Tool | Minimum Version | Check Command | Install |
|---|---|---|---|
| **Node.js** | v18.0+ | `node -v` | [nodejs.org](https://nodejs.org) |
| **npm** | v9.0+ | `npm -v` | Bundled with Node.js |
| **Git** | Any | `git --version` | [git-scm.com](https://git-scm.com) |

### Required Accounts (Free)

| Service | Why | Sign Up |
|---|---|---|
| **MongoDB Atlas** | Cloud database | [mongodb.com/atlas](https://www.mongodb.com/atlas) |
| **HiveMQ Cloud** | MQTT broker (optional for demo) | [hivemq.com](https://www.hivemq.com/mqtt-cloud-broker/) |

### For Hardware (Optional — Simulator Available)

| Item | Purpose |
|---|---|
| ESP32 DevKit V1 or equivalent | Main microcontroller |
| DHT22 or DS18B20 | Temperature + humidity sensor |
| SW-420 vibration switch | Shock/drop detection |
| Magnetic reed switch | Lid tamper detection |
| LDR photoresistor | Light intrusion detection |
| Arduino IDE 2.x | Firmware flashing |

---

## 9. Quick Start (5 Minutes)

> No ESP32 hardware required. Uses the built-in software simulator.

### Clone the Repository
```bash
git clone https://github.com/Khubaib-programmer/trustbox.git
cd trustbox
```

### Terminal 1 — Backend
```bash
cd backend
npm install
cp .env.example .env
# Edit .env and add your MongoDB Atlas connection string (see step below)
npm run dev
```

### Terminal 2 — Frontend
```bash
cd frontend
npm install
npm run dev
```

### Terminal 3 — Simulate Telemetry
```bash
cd backend
npm run simulate
```

Open your browser: **http://localhost:3000**

Select device **TB-001** from the dropdown to see live data.

---

## 10. Detailed Backend Setup

### Step 1 — Install Dependencies
```bash
cd backend
npm install
```

### Step 2 — Create Your .env File
```bash
cp .env.example .env
```

Open `.env` in any text editor and fill in the values:

```env
# Server Port
PORT=4000

# MongoDB Atlas — Get from Atlas dashboard → Connect → Connect your application
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/trustbox?retryWrites=true&w=majority
MONGO_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/trustbox?retryWrites=true&w=majority

# MQTT — HiveMQ Cloud (leave commented out if running simulator-only)
# MQTT_URL=mqtts://your-cluster-id.hivemq.cloud:8883
# MQTT_USER=your_hivemq_username
# MQTT_PASS=your_hivemq_password

# MQTT topic your IoT hardware publishes raw sensor data to
# (Only needed when MQTT_URL is set)
IOT_MQTT_TOPIC=trustbox/raw/#

# Cryptographic shared secret — must match DEVICE_KEY on the ESP32 firmware
DEVICE_KEY=trustbox-super-secret-key-32ch

# Insurance Engine Parameters
CLAIM_TEMP_C=8.0          # Temperature threshold in Celsius (default: 8.0)
CLAIM_WINDOW_SEC=15       # How many seconds above threshold triggers claim (default: 15)
```

### Step 3 — Set Up MongoDB Atlas (First Time)
1. Go to [mongodb.com/atlas](https://www.mongodb.com/atlas) → Create free account
2. Create a free **M0 cluster** (choose any region)
3. Click **Database Access** → **Add New Database User**
   - Username: e.g., `trustbox_user`
   - Password: a strong password
   - Privilege: **Atlas Admin**
4. Click **Network Access** → **Add IP Address** → **Allow Access From Anywhere** (for development)
5. Click **Connect** → **Connect your application** → Copy the connection string
6. Replace `<password>` in the string with your actual password
7. Paste into `.env` as `MONGODB_URI`

### Step 4 — Start the Backend
```bash
npm run dev
```

Expected output:
```
ℹ️ MQTT_URL not configured. Running in HTTP/WebSocket mode.
🚀 TrustBox Backend running on http://localhost:4000
   - Verify endpoint: http://localhost:4000/api/verify/:boxId
   - Tamper endpoint: POST http://localhost:4000/api/admin/tamper/:boxId/:seq
   - Claim Temp Threshold: 8°C
   - Claim Window: 15s
✅ Connected to MongoDB: mongodb+srv://...
```

### Step 5 — Verify Backend Health
```bash
curl http://localhost:4000/health
```
Expected: `{"status":"ok","mongo":"connected","time":"..."}`

---

## 11. Detailed Frontend Setup

### Step 1 — Install Dependencies
```bash
cd frontend
npm install
```

### Step 2 — Start Dev Server
```bash
npm run dev
```

Expected output:
```
  VITE v5.4.x  ready in 127 ms

  ➜  Local:   http://localhost:3000/
  ➜  Network: use --host to expose
```

### How the Proxy Works
Vite automatically forwards all `/api/*` and `/socket.io/*` requests to the backend at `http://localhost:4000`. **You do not need to configure anything.** This is set up in `vite.config.js`:

```js
proxy: {
  '/api':       { target: 'http://localhost:4000', changeOrigin: true },
  '/socket.io': { target: 'http://localhost:4000', ws: true }
}
```

### Build for Production
```bash
npm run build
```
Output is placed in `frontend/dist/`. Serve with any static hosting (Vercel, Netlify, GitHub Pages).

---

## 12. Environment Variables Reference

| Variable | Required | Default | Description |
|---|---|---|---|
| `PORT` | No | `4000` | Express server port |
| `MONGODB_URI` | **Yes** | local mongo | MongoDB Atlas connection string |
| `MONGO_URI` | No | same as above | Alias fallback for MongoDB URI |
| `MQTT_URL` | No | *(MQTT disabled)* | HiveMQ broker URL e.g. `mqtts://xxx.hivemq.cloud:8883` |
| `MQTT_USER` | No* | — | MQTT broker username (*required if MQTT_URL is set) |
| `MQTT_PASS` | No* | — | MQTT broker password (*required if MQTT_URL is set) |
| `IOT_MQTT_TOPIC` | No | `trustbox/raw/#` | MQTT topic for raw IoT hardware payloads |
| `DEVICE_KEY` | No | `trustbox-super-secret-key-32ch` | Shared HMAC secret — **must match firmware** |
| `CLAIM_TEMP_C` | No | `8.0` | Temperature breach threshold in °C |
| `CLAIM_WINDOW_SEC` | No | `15` | Seconds above threshold before claim fires |

> **Security:** Never commit `.env` to git. It is excluded by `.gitignore`. Use `.env.example` as the template.

---

## 13. MQTT Integration Guide

### Setting Up HiveMQ Cloud (Free)
1. Sign up at [hivemq.com/mqtt-cloud-broker](https://www.hivemq.com/mqtt-cloud-broker/)
2. Create a cluster → copy the **Cluster URL** (e.g., `abc123.s1.eu.hivemq.cloud`)
3. Go to **Access Management** → Create a username and password
4. Update `.env`:
   ```env
   MQTT_URL=mqtts://abc123.s1.eu.hivemq.cloud:8883
   MQTT_USER=your_username
   MQTT_PASS=your_password
   ```
5. Restart the backend — you should see:
   ```
   ✅ Connected to HiveMQ / MQTT Broker!
   ✅ Subscribed to trustbox/+/telemetry  (signed TrustBox records)
   ✅ Subscribed to trustbox/+/event      (signed TrustBox records)
   ✅ Subscribed to trustbox/raw/#        (raw IoT hardware payloads)
   ```

### Topics the Backend Subscribes To

| Topic Pattern | Expected Payload | Used By |
|---|---|---|
| `trustbox/+/telemetry` | Fully signed TrustBox record (includes `hash`, `sig`, `seq`) | ESP32 firmware, fake-publisher in MQTT mode |
| `trustbox/+/event` | Fully signed TrustBox record (same format, event anomalies) | ESP32 firmware on breach |
| `trustbox/raw/#` | Raw IoT sensor JSON (no `hash`/`sig`/`seq` required) | Any IoT device with `device_id` field |

### MQTT Message Routing Logic
When a message arrives, the backend checks:
```
payload.device_id exists AND payload.hash is missing
  → Raw IoT path: adapt + compute chain server-side → ingest
  → Otherwise: standard signed TrustBox path → verify + ingest
```

---

## 14. IoT Hardware Integration (ESP32)

### Firmware Location
```
firmware/trustbox_esp32.ino
```

### Setup in Arduino IDE
1. Install **Arduino IDE 2.x** from [arduino.cc](https://www.arduino.cc/en/software)
2. Add ESP32 board support:
   - File → Preferences → Additional Boards Manager URLs:
     ```
     https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
     ```
   - Tools → Board → Boards Manager → Search "esp32" → Install
3. Install required libraries (Sketch → Include Library → Manage Libraries):
   - `PubSubClient` by Nick O'Leary
   - `ArduinoJson` by Benoit Blanchon (v7)
   - `DHT sensor library` by Adafruit (if using DHT22)
4. Open `firmware/trustbox_esp32.ino`
5. Fill in your credentials at the top of the sketch:
   ```cpp
   const char* WIFI_SSID     = "YOUR_WIFI_SSID";
   const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";
   const char* MQTT_BROKER   = "your-cluster.hivemq.cloud";
   const char* MQTT_USER     = "your_hivemq_user";
   const char* MQTT_PASS     = "your_hivemq_password";
   const char* BOX_ID        = "TB-001";
   const char* DEVICE_KEY    = "trustbox-super-secret-key-32ch"; // Must match backend .env
   ```
6. Select your board: Tools → Board → ESP32 Dev Module
7. Select your COM port: Tools → Port
8. Upload the sketch

### ESP32 Pin Wiring

| Sensor | GPIO | Mode | Purpose |
|---|---|---|---|
| DHT22 (Temp + Humidity) | GPIO 15 | Digital Input | Cold-chain temperature monitoring |
| SW-420 Shock Sensor | GPIO 4 | Digital Input (Pull-up) | Drop/impact detection |
| Reed Switch (Lid) | GPIO 5 | Digital Input (Pull-up) | Lid tamper detection |
| LDR Photoresistor | GPIO 34 | Analog ADC | Light intrusion detection |
| MPU-6050 SDA | GPIO 21 | I2C | Tilt/orientation |
| MPU-6050 SCL | GPIO 22 | I2C | Tilt/orientation |
| Status LED | GPIO 2 | Digital Output | Heartbeat / connection indicator |

---

## 15. Raw IoT Payload — New Hardware Format

Your IoT hardware can send a simplified JSON payload **without computing hash/sig/seq**. The backend adapts it automatically.

### Your Device Publishes This (MQTT or HTTP)
```json
{
  "device_id": "box-001",
  "uptime_ms": 123456,
  "temperature_dht_c": 24.1,
  "humidity_pct": 52.0,
  "temperature_ds18b20_c": 24.3,
  "photo_raw": 1200,
  "light_inside": false,
  "shock": false,
  "tilt": false,
  "ball_switch": false,
  "reed_triggered": false,
  "delivery_button": false,
  "breach": false
}
```

### What the Backend Does With It
The server automatically:
1. Maps `device_id` → `box_id`
2. Picks `temperature_ds18b20_c` (preferred) or falls back to `temperature_dht_c` → `temp_c`
3. Maps `humidity_pct` → `humidity`
4. Maps `reed_triggered` → `lid_open`
5. Maps `photo_raw` → `light`
6. Converts all booleans to `0`/`1`
7. Derives `event` string from `breach`, `shock`, `tilt` flags
8. **Computes `seq`, `prev_hash`, `hash`, `sig` entirely on the server** (chain maintained per `device_id`)
9. Saves to MongoDB, broadcasts via Socket.IO, runs insurance engine

### Field Mapping Table

| IoT Field | TrustBox Field | Notes |
|---|---|---|
| `device_id` | `box_id` | Direct rename |
| `temperature_ds18b20_c` | `temp_c` | Preferred over DHT |
| `temperature_dht_c` | `temp_c` | Fallback if DS18B20 absent |
| `humidity_pct` | `humidity` | |
| `photo_raw` | `light` | ADC integer lux value |
| `reed_triggered` | `lid_open` | Magnetic lid reed switch |
| `shock` | `shock` | bool → 0/1 |
| `tilt` | `tilt` | bool → 0/1 |
| `breach` | `event` | Derives TEMP_BREACH / DROP / etc. |
| *(server clock)* | `ts` | Unix timestamp in seconds |
| *(computed)* | `seq` | Next sequence number in chain |
| *(computed)* | `prev_hash` | Hash of previous record |
| *(computed)* | `hash` | SHA-256 of canonical string |
| *(computed)* | `sig` | HMAC-SHA256 signature |

### Sending via MQTT (Raw IoT Topic)
Set `IOT_MQTT_TOPIC` in `.env` to match what your device publishes to:
```env
IOT_MQTT_TOPIC=box-001/telemetry
# or
IOT_MQTT_TOPIC=trustbox/raw/#
```

Your ESP32 or any MQTT client publishes to that topic — the backend handles the rest.

### Sending via HTTP (No MQTT Needed)
```bash
curl -X POST http://localhost:4000/api/iot/ingest \
  -H "Content-Type: application/json" \
  -d '{
    "device_id": "box-001",
    "temperature_dht_c": 24.1,
    "humidity_pct": 52.0,
    "temperature_ds18b20_c": 24.3,
    "photo_raw": 1200,
    "shock": false,
    "tilt": false,
    "reed_triggered": false,
    "breach": false
  }'
```

Expected response:
```json
{
  "ok": true,
  "record": {
    "box_id": "box-001",
    "seq": 0,
    "temp_c": 24.3,
    "hash": "1c7060b2...",
    "sig": "c1f1d0fa..."
  }
}
```

---

## 16. API Reference

Base URL: `http://localhost:4000`

### Records & Telemetry

#### `GET /` — Server Status
```bash
curl http://localhost:4000/
```
Returns service info, MongoDB status, and all endpoint paths.

#### `POST /api/records` — Ingest Signed Telemetry Record
For fully signed records (from ESP32 firmware or fake-publisher in MQTT mode).
```bash
curl -X POST http://localhost:4000/api/records \
  -H "Content-Type: application/json" \
  -d '{ "box_id": "TB-001", "seq": 0, "ts": 1746030000, "temp_c": 4.8,
        "humidity": 54.2, "shock": 0, "tilt": 0, "flipped": 0,
        "light": 35, "lid_open": 0, "event": "NONE",
        "prev_hash": "0000000000000000000000000000000000000000000000000000000000000000",
        "hash": "<sha256>", "sig": "<hmac>" }'
```

#### `POST /api/iot/ingest` — Ingest Raw IoT Payload
For devices that send simplified sensor data without crypto fields.
```bash
curl -X POST http://localhost:4000/api/iot/ingest \
  -H "Content-Type: application/json" \
  -d '{ "device_id": "box-001", "temperature_dht_c": 24.1, "humidity_pct": 52.0, ... }'
```

#### `GET /api/records/:boxId` — Fetch All Records
```bash
curl "http://localhost:4000/api/records/TB-001?limit=50"
```
Returns array of records in ascending sequence order.

#### `GET /api/verify/:boxId` — Full Chain Verification
```bash
curl http://localhost:4000/api/verify/TB-001
```
Response:
```json
{
  "ok": true,
  "empty": false,
  "count": 214,
  "brokenAt": null,
  "latestHash": "a21020c5..."
}
```
If tampered: `"ok": false, "brokenAt": 7, "reason": "Hash mismatch at seq #7..."`

#### `GET /api/devices/:boxId/latest` — Latest Record State
```bash
curl http://localhost:4000/api/devices/TB-001/latest
```
Returns `{ exists, latestSeq, prevHash, nextSeq }` — used by fake-publisher to resume chain.

#### `GET /api/boxes` — List All Known Box IDs
```bash
curl http://localhost:4000/api/boxes
```

### Insurance & Claims

#### `GET /api/claims/:boxId` — Get All Claims
```bash
curl http://localhost:4000/api/claims/TB-001
```

#### `GET /api/payouts/:boxId` — Get All Payouts
```bash
curl http://localhost:4000/api/payouts/TB-001
```

### Admin / Demo Tools

#### `POST /api/admin/tamper/:boxId/:seq` — Simulate Tamper Attack
> ⚠️ Demo only. Modifies a record to simulate database tampering — chain verification will then catch it.
```bash
curl -X POST http://localhost:4000/api/admin/tamper/TB-001/5
```

#### `POST /api/admin/reset/:boxId` — Reset Demo Data
```bash
curl -X POST http://localhost:4000/api/admin/reset/TB-NEW-DEVICE
# TB-TEST is protected: requires confirm:true in body
```

#### `GET /health` — Health Check
```bash
curl http://localhost:4000/health
```

---

## 17. Socket.IO Real-Time Events

The backend broadcasts these events to all connected browser clients.

| Event Name | Payload | When Fired |
|---|---|---|
| `record` | Full record object | Every new telemetry record ingested |
| `event` | Full record object | When `record.event !== "NONE"` |
| `claim` | Claim object | When insurance claim is auto-approved |
| `payout` | Payout object | When payout is created |
| `tamper` | `{ box_id, seq, new_temp }` | When admin tamper endpoint is called |
| `reset` | `{ box_id }` | When reset endpoint is called |

### Connecting from Frontend
```js
import { io } from 'socket.io-client';
const socket = io(); // proxied by Vite to ws://localhost:4000

socket.on('record', (record) => {
  console.log('New record:', record.temp_c, '°C');
});
socket.on('payout', (payout) => {
  console.log('Payout approved:', payout.amount_inr, 'INR');
});
```

---

## 18. Telemetry Simulator (No Hardware Needed)

`fake-publisher.js` acts as a virtual ESP32 — it generates cryptographically valid records and sends them to the backend.

### Normal Simulation (Safe Cold Chain)
```bash
cd backend
npm run simulate
```
Sends records every 1.5 seconds with `temp_c` ~4.6–5.4°C (safe range).

### Simulate Temperature Breach
```bash
npm run simulate:heat
```
Sends records with `temp_c` ~13.5–15.5°C. After 15 seconds the insurance engine fires a `TEMP_BREACH` claim.

### Simulate Drop/Shock
```bash
npm run simulate:drop
```
Immediately sends a `DROP` event. Insurance engine fires a `DROP` claim.

### Advanced Options
```bash
# Custom box ID (preserves existing demo data)
node fake-publisher.js --boxId TB-HARDWARE-TEST

# Specific number of records
node fake-publisher.js --count 20 --boxId TB-TEST-BOX

# Faster publishing (500ms interval)
node fake-publisher.js --interval 500

# Simulate lid open
node fake-publisher.js --lid

# Simulate flipped cargo
node fake-publisher.js --flipped

# Force HTTP mode (skip MQTT even if MQTT_URL is set)
node fake-publisher.js --http

# Start fresh chain (fails if box already has records, prevents chain corruption)
node fake-publisher.js --fresh --boxId TB-NEW-001
```

### Transport Priority
1. If `MQTT_URL` is set in `.env` → publishes via MQTT
2. If MQTT connection fails → auto-falls back to `POST /api/records`
3. If `--http` flag is passed → always uses HTTP

---

## 19. Running Tests

### Unit Tests — Cryptographic Chain (`test-chain.js`)
```bash
cd backend
npm test
```
Tests: genesis record creation, hash chain integrity, HMAC signature, tamper detection, chain verification.

### Integration Tests — All API Endpoints (`test-api.js`)
```bash
npm run test:api
```
Tests: record ingestion, duplicate rejection, chain continuity enforcement, verification endpoint, tamper admin endpoint, claims, payouts.

> Requires backend to be running (`npm run dev` in another terminal) before running `test:api`.

---

## 20. Dashboard Pages Guide

### Main Dashboard — `http://localhost:3000/`

| Section | Description |
|---|---|
| **Device Selector** | Dropdown to switch between box IDs |
| **Chain Status Badge** | Green = verified / Red = tampered with seq number |
| **Record Count** | Total telemetry records stored |
| **Temperature Chart** | Live recharts line graph with breach threshold line |
| **Humidity Chart** | Live humidity percentage over time |
| **Custody Event Log** | All anomaly events (DROP, TEMP_BREACH, LID_OPEN, FLIPPED) |
| **Claims Panel** | All approved insurance claims |
| **Payout Cards** | Insurance payouts with amount and beneficiary |
| **Route Map** | Leaflet map showing GPS coordinates from telemetry |
| **QR Code Button** | Generates a scannable verification URL for the current box |

### Verification Page — `http://localhost:3000/verify/:boxId`

Accessible by scanning the QR code or visiting the URL directly. Shows:
- Full chain integrity result
- Record count
- Tamper detection status (broken at which seq)
- Latest hash fingerprint
- Timestamp of latest record

---

## 21. Database Schema

### Record Collection
```js
{
  box_id:    String,   // Device identifier (e.g., "TB-001")
  seq:       Number,   // Sequence number (0-indexed, unique per box)
  ts:        Number,   // Unix timestamp in seconds
  temp_c:    Number,   // Temperature in Celsius (1 decimal)
  humidity:  Number,   // Relative humidity % (1 decimal)
  shock:     Number,   // 0 or 1 — shock/drop detected
  tilt:      Number,   // 0 or 1 — tilted
  flipped:   Number,   // 0 or 1 — inverted
  light:     Number,   // Light level (ADC / lux)
  lid_open:  Number,   // 0 or 1 — lid tamper detected
  event:     String,   // "NONE" | "TEMP_BREACH" | "DROP" | "FLIPPED" | "LID_OPEN"
  prev_hash: String,   // 64-char hex — hash of previous record
  hash:      String,   // 64-char SHA-256 hex
  sig:       String,   // 64-char HMAC-SHA256 hex
  receivedAt: Date,    // Server receipt timestamp
  createdAt: Date,     // Auto (mongoose timestamps)
  updatedAt: Date
}
// Unique index on { box_id, seq }
```

### Claim Collection
```js
{
  box_id:     String,   // Device identifier
  type:       String,   // "TEMP_BREACH" | "DROP" | "TILT" | "TAMPER"
  status:     String,   // "APPROVED"
  reason:     String,   // Human-readable trigger description
  triggerSeq: Number,   // Sequence number that triggered the claim
  ts:         Number,   // Timestamp of trigger record
  createdAt:  Date
}
```

### Payout Collection
```js
{
  payout_id:   String,   // Unique ID e.g. "pay_abc123xyz"
  claim_id:    String,   // Reference to claim _id
  box_id:      String,   // Device identifier
  amount_inr:  Number,   // Payout amount in Indian Rupees
  currency:    String,   // "INR"
  status:      String,   // "TRANSFERRED"
  beneficiary: String,   // "PharmaSupply Logistics Ltd."
  timestamp:   Date
}
```

---

## 22. Troubleshooting

### Backend won't start — `EADDRINUSE: port 4000`
Port is already in use. Kill the existing process:
```bash
# Linux/Mac
fuser -k 4000/tcp

# Or find and kill manually
lsof -i :4000
kill -9 <PID>
```

### MongoDB connection failed
- Check your `MONGODB_URI` in `.env` — no trailing spaces, password URL-encoded
- Check MongoDB Atlas → Network Access → your IP is whitelisted (or set `0.0.0.0/0` for dev)
- Check Atlas → Database Access → user has correct permissions
- Backend will fall back to in-memory store if MongoDB is unreachable

### Frontend shows "Cannot GET /"
The frontend is running on port **3000**, not 4000. Open **http://localhost:3000**, not 4000.

### Dashboard shows 0 records
- Confirm backend is running: `curl http://localhost:4000/health`
- Run the simulator in another terminal: `cd backend && npm run simulate`
- Select a device from the dropdown (e.g., `TB-001`)
- Check browser console for API errors

### MQTT errors: `getaddrinfo ENOTFOUND`
MQTT is disabled or credentials are wrong. This is expected if `MQTT_URL` is commented out. The system works fully via HTTP — just run `npm run simulate`.

### Simulator fails: `Sequence gap detected`
The box already has records. The simulator tries to continue the chain automatically. If it fails:
```bash
# Use a completely new box ID
node fake-publisher.js --boxId TB-FRESH-$(date +%s)
```

### Chain verification shows `ok: false`
The tamper demo was run (`/api/admin/tamper`). Reset the box to clear tampered records:
```bash
curl -X POST http://localhost:4000/api/admin/reset/TB-001
```
Then run the simulator again to rebuild a clean chain.

### IoT HTTP ingest returns 400
Check that:
- `device_id` field is present in the payload
- `temperature_dht_c` or `temperature_ds18b20_c` is a valid number
- `humidity_pct` is between 0 and 100

---

## 23. Demo Scenarios

### Scenario A — Normal Cold Chain (Green)
```bash
# Terminal 1: Backend
npm run dev

# Terminal 2: Frontend
cd ../frontend && npm run dev

# Terminal 3: Normal simulator
npm run simulate -- --boxId TB-DEMO

# Browser: http://localhost:3000
# Select TB-DEMO → watch live temperature chart
# Chain status: ✅ VERIFIED
```

### Scenario B — Temperature Breach → Auto Insurance Claim
```bash
npm run simulate:heat -- --boxId TB-BREACH-TEST

# Wait ~15 seconds...
# Dashboard shows: TEMP_BREACH event, Claim APPROVED, Payout ₹50,000
# Confetti animation fires
```

### Scenario C — Drop Impact → Instant Claim
```bash
npm run simulate:drop -- --boxId TB-DROP-TEST

# Instant: DROP event, Claim APPROVED, Payout ₹25,000
```

### Scenario D — Tamper Detection Demo
```bash
# 1. Simulate a few records
npm run simulate -- --boxId TB-TAMPER-TEST --count 10

# 2. Maliciously alter a record (simulate database hack)
curl -X POST http://localhost:4000/api/admin/tamper/TB-TAMPER-TEST/5

# 3. Verify chain — shows tampered
curl http://localhost:4000/api/verify/TB-TAMPER-TEST
# → { "ok": false, "brokenAt": 5, "reason": "Hash mismatch at seq #5..." }

# 4. Dashboard shows: ❌ CHAIN BROKEN at #5
```

### Scenario E — Real Hardware Integration
```bash
# 1. Flash firmware/trustbox_esp32.ino to ESP32
# 2. Set MQTT credentials in both firmware and backend .env
# 3. Start backend with MQTT enabled
# 4. Power on ESP32 → watch live data appear in dashboard
# --- OR for raw IoT format ---
# POST to /api/iot/ingest from any device
```

---

## 24. Pushing to GitHub

### First Time Setup
```bash
cd trustbox-main
git init
git remote add origin https://github.com/Khubaib-programmer/trustbox.git
```

### Stage and Commit
```bash
git add .
git status          # Verify .env is NOT listed (should be gitignored)
git commit -m "feat: your commit message"
```

### Push
```bash
git push -u origin main
```

GitHub will prompt for credentials:
- **Username:** your GitHub username
- **Password:** a [Personal Access Token](https://github.com/settings/tokens/new) with `repo` scope (NOT your GitHub password)

### Verify .env is Protected
```bash
git check-ignore backend/.env
# Should print: backend/.env
# If no output, add to .gitignore:
echo "backend/.env" >> .gitignore
```

---

## Project Status

| Feature | Status |
|---|---|
| Hash-chain cryptographic engine | ✅ Complete |
| HMAC-SHA256 record signing | ✅ Complete |
| MongoDB persistence + fallback | ✅ Complete |
| MQTT subscriber (signed format) | ✅ Complete |
| Raw IoT payload adapter (`/api/iot/ingest`) | ✅ Complete |
| Parametric insurance engine | ✅ Complete |
| Socket.IO real-time broadcast | ✅ Complete |
| React dashboard with live charts | ✅ Complete |
| Chain verification page | ✅ Complete |
| QR code generation | ✅ Complete |
| Route map (Leaflet) | ✅ Complete |
| Hardware simulator (fake-publisher) | ✅ Complete |
| ESP32 firmware | ✅ Complete |
| Unit + integration test suite | ✅ Complete |
| In-memory fallback (no MongoDB) | ✅ Complete |

---

*Built with ❤️ for hackathon — TrustBox Team*
