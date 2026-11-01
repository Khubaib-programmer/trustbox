# 📦 TrustBox — Tamper-Evident Smart Delivery & Parametric Insurance

> **A hardware-integrated, cryptographically secured IoT delivery monitoring and instant parametric insurance platform.**

[![HackCulture Submission](https://img.shields.io/badge/HackCulture-Hackathon%20Submission-FF3B30?style=for-the-badge&logo=target)](https://github.com/Khubaib-programmer/trustbox)
[![Live Frontend](https://img.shields.io/badge/Vercel-Live%20Frontend%20App-000000?style=for-the-badge&logo=vercel)](https://frontend-nine-lac-9i1472sb0c.vercel.app/)
[![Live Backend](https://img.shields.io/badge/Backend-Vercel%20API-0070F3?style=for-the-badge&logo=vercel)](https://trustbox-nine.vercel.app/)
[![Repository](https://img.shields.io/badge/GitHub-Repo-181717?style=for-the-badge&logo=github)](https://github.com/Khubaib-programmer/trustbox)
[![Node.js](https://img.shields.io/badge/Node.js-v20+-339933?style=for-the-badge&logo=node.js)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react)](https://react.dev/)
[![Database](https://img.shields.io/badge/MongoDB-Atlas%20Cloud-47A248?style=for-the-badge&logo=mongodb)](https://www.mongodb.com/atlas)

---

## 🌐 Live Deployed Application Links

- 🖥️ **Live Web Dashboard:** [https://frontend-nine-lac-9i1472sb0c.vercel.app/](https://frontend-nine-lac-9i1472sb0c.vercel.app/)
- ⚙️ **Production REST API:** [https://trustbox-nine.vercel.app/](https://trustbox-nine.vercel.app/)
- 🔍 **Public QR Verification Audit Portal:** [https://frontend-nine-lac-9i1472sb0c.vercel.app/verify/VACCINE-001](https://frontend-nine-lac-9i1472sb0c.vercel.app/verify/VACCINE-001)
- 📂 **GitHub Repository:** [https://github.com/Khubaib-programmer/trustbox](https://github.com/Khubaib-programmer/trustbox)

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

## 🧪 Real-World Test Cases & Pitching Scenarios (6 Verified Scenarios)

TrustBox has been rigorously tested across 6 specialized cargo categories with automated Proof-of-Delivery, risk mitigation, and instant parametric claim execution:

| Cargo Class | Box ID | Monitored Hazards | Incident Occurred | Delivery Verdict | Insurance Settlement & Beneficiary |
|---|---|---|---|---|---|
| **💉 mRNA Vaccines** | `VACCINE-001` | Strict Cold Chain (2.0°C – 8.0°C) | Dry ice depleted; sustained 17.2°C (>8°C) for >15s | **❌ DELIVERY CANCELLED** *(High Risk: Spoiled Biologics)* | **₹1,50,000 INR** *(Serum Institute Logistics Ltd.)* |
| **🎂 Designer Cake** | `CAKE-001` | Cold-chain ≤8°C & Drop Handling | Van pothole drop (>4.5G) + Severe heat breach (36.5°C sustained) | **❌ DELIVERY CANCELLED** *(High Risk: Smashed & Melted)* | **₹75,000 INR** *(₹50k Heat + ₹25k Shock — CakeCraft Ltd.)* |
| **📺 OLED 4K Smart TV** | `TV-001` | High-G Drop Shock & Moisture | Multiple violent drops (>6.5G to 8.0G) + Roof leak (92.5% humidity) | **❌ DELIVERY CANCELLED** *(High Risk: Screen Shattered & Circuit Short)* | **₹75,000 INR** *(₹45k Shock + ₹30k Moisture — Sony Electronics)* |
| **💎 Crystal Glassware** | `FRAGILE-001` | Upright Orientation (Tilt / Inversion) & Shock | Package tilted >65° & flipped upside down on sorting chute | **❌ DELIVERY CANCELLED** *(High Risk: Stemware Shattered)* | **₹70,000 INR** *(₹35k Inversion + ₹35k Shock — Bohemia Crystal)* |
| **💻 Gaming Laptop** | `ELECTRONIC-001` | Mechanical Shock (>5G) & Moisture | 1.5m courier drop shock impact (>5G detected) | **❌ DELIVERY CANCELLED** *(High Risk: Motherboard Micro-Crack)* | **₹45,000 INR** *(Dell Global Logistics Corp.)* |
| **📚 Medical Encyclopedias** | `BOOKS-001` | Standard Cargo (Control Baseline) | Safe transit (22°C, 48% Humidity, 0G Shock, Upright) | **✅ DELIVERED SAFELY** *(Zero Claims Triggered)* | **₹0 INR** *(Clean Delivery Proof)* |

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
mosquitto -d
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

Run the complete 6-item delivery simulation (Vaccine, Cake, OLED TV, Crystal Glass, Laptop, Books) with a single command:
```bash
cd backend
npm run simulate:items
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
| `MQTT_URL` | No | *(MQTT disabled)* | EMQX Cloud broker URL e.g. `mqtts://xxx.emqxsl.com:8883` |
| `MQTT_USER` | No* | — | MQTT broker username (*required if MQTT_URL is set) |
| `MQTT_PASS` | No* | — | MQTT broker password (*required if MQTT_URL is set) |
| `MQTT_CA_PATH` | No | *(system CA)* | Path to EMQX Cloud CA root certificate file (optional) |
| `IOT_MQTT_TOPIC` | No | `trustbox/raw/#` | Comma-separated topics for raw IoT hardware payloads |
| `DEVICE_KEY` | No | `trustbox-super-secret-key-32ch` | Shared HMAC secret — **must match firmware** |
| `CLAIM_TEMP_C` | No | `8.0` | Temperature breach threshold in °C |
| `CLAIM_WINDOW_SEC` | No | `15` | Seconds above threshold before claim fires |

> **Security:** Never commit `.env` to git. It is excluded by `.gitignore`. Use `.env.example` as the template.

---

## 13. MQTT Integration Guide (EMQX Cloud & HiveMQ)

TrustBox connects securely over **TLS on port 8883** to any managed MQTT broker, optimized specifically for **EMQX Cloud Serverless/Dedicated** and **HiveMQ Cloud**.

### EMQX Cloud Setup
1. **Locate Broker Host & Port:**
   - Log into [EMQX Cloud Console](https://cloud.emqx.com/) and navigate to your Deployment Overview.
   - Find your **Connect Address** (e.g., `xxx.emqxsl.com`) and **Port** (`8883` for TLS).
   - Set in `backend/.env`:
     ```env
     MQTT_URL=mqtts://xxx.emqxsl.com:8883
     ```
2. **Create Authentication User:**
   - In EMQX Console, go to **Authentication** → **Users** → **Add User**.
   - Set a dedicated Username and a secure Password.
   - Enter credentials in `backend/.env`:
     ```env
     MQTT_USER=your_emqx_username
     MQTT_PASS=your_emqx_password
     ```
3. **CA Certificate (Optional):**
   - EMQX Cloud TLS endpoints work automatically with Node.js's standard root CA store (`rejectUnauthorized: true`).
   - If your deployment uses a custom CA certificate, download the root CA `.crt`/`.pem` from the EMQX deployment page, save it locally (e.g., `backend/emqx-ca.crt`), and set:
     ```env
     MQTT_CA_PATH=/absolute/path/to/emqx-ca.crt
     ```
4. **Security Notice:**
   - ⚠️ **Always rotate any credentials that were ever pasted into chat, logs, or screenshots.**
   - Never commit `.env` files or password strings to git.

### HiveMQ Cloud Alternative (Free)
1. Sign up at [hivemq.com/mqtt-cloud-broker](https://www.hivemq.com/mqtt-cloud-broker/)
2. Create a cluster → copy the **Cluster URL** (e.g., `abc123.s1.eu.hivemq.cloud`)
3. Go to **Access Management** → Create a username and password
4. Update `.env`:
   ```env
   MQTT_URL=mqtts://abc123.s1.eu.hivemq.cloud:8883
   MQTT_USER=your_username
   MQTT_PASS=your_password
   ```

### Topics the Backend Subscribes To

| Topic Pattern | Expected Payload | Used By |
|---|---|---|
| `trustbox/+/telemetry` | Fully signed TrustBox record (includes `hash`, `sig`, `seq`) | ESP32 firmware, fake-publisher in MQTT mode |
| `trustbox/+/event` | Fully signed TrustBox record (same format, event anomalies) | ESP32 firmware on breach |
| `trustbox/raw/#` (configurable) | Raw IoT sensor JSON (no `hash`/`sig`/`seq` required) | ESP32 hardware, test scripts, IoT devices |

### MQTT Message Routing Logic
When a message arrives, the backend checks:
```
payload.device_id exists (or derived from topic) AND payload.hash is missing
  → Raw IoT path: adapt + validate + compute chain server-side → ingest
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
Returns `{ status, mongo, mqtt, time }`.

#### `GET /api/mqtt/status` — Live MQTT Connection & Telemetry Status
```bash
curl http://localhost:4000/api/mqtt/status
```
Returns `{ enabled, connected, broker_host, subscribed_topics, messages_received, messages_accepted, messages_rejected, last_message_at, last_device_id, last_error }`.

#### `GET /api/mqtt/rejected` — Rejected / Invalid Payloads Log
```bash
curl http://localhost:4000/api/mqtt/rejected
```
Returns ring buffer of last 20 rejected messages with reasons and timestamps.

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
| `mqtt_status` | `{ connected, last_message_at }` | When broker connection state changes and every 5 seconds |
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
