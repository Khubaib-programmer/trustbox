# 🛠️ TrustBox — Hardware Architecture & Specification

## 1. System Overview
TrustBox is an autonomous, tamper-evident black box designed to ride with sensitive cargo (vaccines, biologics, pharmaceuticals, premium electronics). It continuously monitors temperature, humidity, shock, tilt, enclosure light, and lid state. Every sensor record is hash-chained and HMAC-signed on-chip using the ESP32 hardware cryptographic accelerator.

---

## 2. Hardware Architecture Diagram

```mermaid
flowchart TD
    subgraph Power ["⚡ Power Management"]
        BAT["3.7V 18650 Li-Ion / LiPo Cell"] --> BMS["TP4056 Charger & Protection Module"]
        BMS --> REG["3.3V Low-Dropout Regulator (LDO)"]
        REG --> ESP["ESP32 Microcontroller Core<br/>(Dual Core 240MHz, 520KB SRAM)"]
    end

    subgraph Sensors ["🌡️ Environmental & Tamper Sensors"]
        TEMP["DHT22 / SHT31<br/>Temperature & Humidity"] -->|GPIO 15 / I2C| ESP
        SHOCK["SW-420 / Piezo Sensor<br/>Drop & Shock Impact"] -->|GPIO 4 (Interrupt)| ESP
        TILT["MPU-6050 / Ball Switch<br/>Tilt & Flipped Inversion"] -->|I2C SDA:21, SCL:22| ESP
        LID["Magnetic Reed Switch<br/>Enclosure Lid Seal"] -->|GPIO 5 (Internal Pull-Up)| ESP
        LDR["Photoresistor LDR<br/>Ambient Light Intrusion"] -->|GPIO 34 (ADC1)| ESP
    end

    subgraph Security ["🔒 On-Chip Cryptographic Engine"]
        ESP --> SHA["Hardware SHA-256 Accelerator"]
        ESP --> HMAC["mbedtls HMAC-SHA256 Engine"]
        ESP --> NVS["NVS Flash Memory<br/>(Persistent seq & hash chain)"]
    end

    subgraph Comms ["📡 Telemetry Channel"]
        ESP -->|TLS 1.2 / Port 8883| WIFI["WiFi / 4G Cellular Hotspot"]
        WIFI --> BROKER["HiveMQ Cloud MQTT Broker"]
    end
```

---

## 3. Pin Mapping & Wiring Specification

The GPIO pins below match the firmware in [`firmware/trustbox_esp32.ino`](file:///Users/wamiq/multi/trustbox/firmware/trustbox_esp32.ino):

| Subsystem | Sensor / Module | ESP32 GPIO | Mode / Interface | Purpose & Trigger Logic |
| :--- | :--- | :--- | :--- | :--- |
| **Drop & Shock** | SW-420 Vibration Module | `GPIO 4` | Digital Input (`INPUT_PULLUP`) | Hardware interrupt triggers on impact $> 3g$ $\to$ `event: "DROP"`. |
| **Lid Seal** | Magnetic Reed Switch | `GPIO 5` | Digital Input (`INPUT_PULLUP`) | Box closed = `LOW (0)`; Lid opened = `HIGH (1)` $\to$ `event: "LID_OPEN"`. |
| **Light Intrusion**| GL5528 Photoresistor (LDR) | `GPIO 34` | Analog Input (ADC1) | Confirms lid breach if internal lux jumps from $< 20$ to $> 200$. |
| **Cold Chain Temp**| DHT22 / AM2302 (or SHT31) | `GPIO 15` | Single-Wire Digital | Monitors storage temperature ($2.0^\circ\text{C} - 8.0^\circ\text{C}$ range). |
| **Orientation/IMU**| MPU-6050 / Tilt Switch | `GPIO 21` (SDA)<br/>`GPIO 22` (SCL) | I2C Bus | Detects tilt $> 45^\circ$ or inverted cargo $\to$ `event: "FLIPPED"`. |
| **Status Heartbeat**| Onboard Blue LED | `GPIO 2` | Digital Output | Pulses on MQTT publish; solid on TLS connect. |

---

## 4. Sensor Subsystems Breakdown

### 4.1. Cold Chain Temperature & Humidity (`temp_c`, `humidity`)
- **Sensor:** DHT22 (AM2302) or Sensirion SHT31.
- **Operating Range:** $-40^\circ\text{C}$ to $+80^\circ\text{C}$ ($\pm 0.5^\circ\text{C}$ accuracy).
- **Sampling:** Every 2 seconds.
- **Cryptographic Formatting:** Both floats are strictly formatted to **1 decimal place** (`%.1f`) so SHA-256 digests generated in embedded C++ match Node.js byte-for-byte.

### 4.2. Shock & Impact Detection (`shock`, `event: "DROP"`)
- **Sensor:** SW-420 High-Sensitivity Vibration Switch or MPU-6050.
- **Operation:** Connected to `GPIO 4` with a hardware interrupt. An impact exceeding threshold triggers an immediate out-of-band publish to `trustbox/<box_id>/event` with `event = "DROP"`.

### 4.3. Enclosure Lid & Anti-Tamper Seal (`lid_open`, `light`, `event: "LID_OPEN"`)
- **Dual-Sensor Tamper Defense:**
  1. **Magnetic Reed Switch:** Detects physical opening of the lid.
  2. **LDR Photoresistor:** Detects photon leakage inside the sealed black box.
- **Anti-Spoofing:** If an attacker attempts to fool the reed switch using an external magnet, the optical LDR detects light penetration and marks `lid_open = 1` and `event = "LID_OPEN"`.

### 4.4. Orientation & Tilt (`tilt`, `flipped`, `event: "FLIPPED"`)
- **Sensor:** MPU-6050 or Ball Tilt Switch.
- **Requirement:** Fragile vaccines and reagents degrade if placed upside down or tilted past $45^\circ$. If detected for $\ge 2$ consecutive readings, `flipped = 1`.

---

## 5. Power & Battery Management

| Operating Mode | Current Draw | Battery Life (2500 mAh 18650 Cell) |
| :--- | :--- | :--- |
| **Continuous Demo Mode** (Live streaming every 2s over TLS) | ~130 mA | **~19 hours** |
| **Production Courier Mode** (Deep sleep, wake every 60s for burst) | ~18 mA | **~5.5 days** |

- **Charging Circuit:** TP4056 Micro-USB / USB-C lithium charging module with over-discharge protection.
- **Regulator:** ME6211 or AMS1117 3.3V low-dropout voltage regulator.

---

## 6. Embedded Cryptographic Architecture

1. **Hardware SHA-256 Accelerator:**
   The ESP32 Tensilica Xtensa core uses dedicated hardware silicon registers for SHA-256 calculation, finishing in $< 12 \ \mu\text{s}$.
2. **Deterministic Canonicalization:**
   ```text
   box_id|seq|ts|temp_c|humidity|shock|tilt|flipped|light|lid_open|event|prev_hash
   ```
3. **On-Chip HMAC-SHA256:**
   Uses `mbedtls` to compute the signature using `DEVICE_KEY`.
4. **Key Security:**
   The `DEVICE_KEY` can be burned into the ESP32's write-once **eFuse BLOCK3** with read protection enabled, making key extraction impossible even with physical JTAG probes.

---

## 7. Bill of Materials (BOM) & Estimated Cost

| Component | Model / Spec | Est. Cost (INR) | Est. Cost (USD) |
| :--- | :--- | :--- | :--- |
| **Microcontroller** | ESP32 NodeMCU / DevKit V1 | ₹350 | $4.20 |
| **Temp/Humidity** | DHT22 (AM2302) | ₹220 | $2.60 |
| **Shock Sensor** | SW-420 Vibration Module | ₹50 | $0.60 |
| **Lid Sensor** | Magnetic Reed Switch Module | ₹60 | $0.70 |
| **Light Sensor** | GL5528 LDR + 10k Resistor | ₹15 | $0.20 |
| **Battery & Charger**| 18650 Cell (2500mAh) + TP4056 | ₹200 | $2.40 |
| **Enclosure** | Weatherproof ABS Project Box | ₹150 | $1.80 |
| **Total Hardware Cost** | | **₹1,045** | **~$12.50** |

