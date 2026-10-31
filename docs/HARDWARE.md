X## TrustBox Hardware Architecture & Wiring Specification

This document details the physical hardware design, pin mapping, sensor interfaces, and power budget for the **TrustBox** physical black box unit.

---

## 1. Hardware Architecture Overview

```mermaid
flowchart TD
    subgraph Power ["⚡ Power Management"]
        BAT["3.7V 18650 / LiPo Battery"] --> BMS["TP4056 Charger & Protection"]
        BMS --> REG["3.3V LDO / Boost Converter"]
        REG --> ESP["ESP32 Microcontroller Core"]
    end

    subgraph Sensors ["🌡️ Environmental & Tamper Sensors"]
        TEMP["DHT22 / SHT31<br/>(Temperature & Humidity)"] -->|GPIO 15 / I2C| ESP
        SHOCK["SW-420 / MPU-6050<br/>(Shock & Drop Impact)"] -->|GPIO 4 / I2C| ESP
        TILT["MPU-6050 / Tilt Switch<br/>(Tilt & Flipped Inversion)"] -->|I2C (SDA 21 / SCL 22)| ESP
        LID["Magnetic Reed Switch<br/>(Box Lid Seal Detection)"] -->|GPIO 5 (Pull-Up)| ESP
        LDR["Photoresistor LDR<br/>(Ambient Light Sensor)"] -->|GPIO 34 (ADC)| ESP
    end

    subgraph Security ["🔒 Hardware Cryptographic Engine"]
        ESP --> MBED["ESP32 Hardware SHA Accelerator<br/>& mbedtls HMAC Engine"]
        ESP --> NVS["NVS Flash Memory<br/>(Chained Hash & Seq Storage)"]
    end

    subgraph Telemetry ["📡 Wireless Telemetry"]
        ESP -->|TLS 1.2 / Port 8883| WIFI["WiFi / 4G Cellular Hotspot"]
        WIFI --> HIVEMQ["HiveMQ Cloud MQTT Broker"]
    end
```

---

## 2. Complete Pinout & Wiring Table

These GPIO pins match the firmware in [`trustbox_esp32.ino`](file:///Users/wamiq/multi/trustbox/firmware/trustbox_esp32.ino):

| Component | Sensor Model | ESP32 GPIO | Mode / Interface | Purpose & Thresholds |
| :--- | :--- | :--- | :--- | :--- |
| **Shock / Impact** | SW-420 or Piezo | `GPIO 4` | Digital Input (Pull-up) | Detects drops > 1.0m (Shock = 1) |
| **Lid Reed Switch** | Magnetic NC/NO Reed | `GPIO 5` | Digital Input (Pull-up) | Box sealed = `LOW (0)`, Box opened = `HIGH (1)` |
| **Ambient Light** | GL5528 LDR + 10kΩ | `GPIO 34` | Analog ADC1 (Input only) | Detects light intrusion if box is pried open |
| **Status LED** | Onboard Blue LED | `GPIO 2` | Digital Output | Pulses on MQTT transmit; solid on TLS connect |
| **Temp & Humidity** | DHT22 (AM2302) | `GPIO 15` | Single-Bus Digital | Cold-chain monitoring (2.0°C – 8.0°C range) |
| **Orientation / IMU** | MPU-6050 (Optional) | `GPIO 21` (SDA) / `GPIO 22` (SCL) | I2C Bus | Detects tilt > 45° and inverted (flipped) cargo |

---

## 3. Sensor Subsystem Details

### 3.1. Cold Chain Temperature & Humidity (`temp_c`, `humidity`)
- **Recommended Sensor:** DHT22 or Sensirion SHT31.
- **Placement:** Suspended inside the thermal insulation cavity, proximate to medicine vials or perishables.
- **Behavior:** Samples every 2 seconds. Formatted to strictly 1 decimal place (`sprintf("%.1f")`) for cryptographic determinism.

### 3.2. Shock & Drop Impact (`shock`, `event: "DROP"`)
- **Sensor:** SW-420 High-Sensitivity Vibration Switch or MPU-6050 accelerometer ($> 3g$ threshold).
- **Behavior:** Hardware interrupt triggers an immediate priority message to `trustbox/<box_id>/event` with `event = "DROP"`.

### 3.3. Enclosure Lid & Seal Security (`lid_open`, `light`, `event: "LID_OPEN"`)
- **Sensors:** 
  1. Magnetic Reed Switch embedded in the lid lip (magnet on lid, reed on chassis).
  2. Photoresistor (LDR) placed on the main PCB inside the sealed dark compartment.
- **Double-Check Logic:** If the lid is opened, the reed switch disconnects AND ambient light spikes from $< 20$ lux to $> 200$ lux, confirming enclosure breach even if a thief attempts to spoof the reed switch with an external magnet.

### 3.4. Orientation & Tilt (`tilt`, `flipped`, `event: "FLIPPED"`)
- **Sensor:** Ball tilt switch or MPU-6050 6-axis gyro/accelerometer.
- **Logic:** Many vaccines and chemical payloads cannot be inverted or tilted beyond 45°. If inverted for $> 2$ readings, `flipped = 1` and `event = "FLIPPED"`.

---

## 4. Power & Energy Budget

| Component | Active Current | Sleep / Idle Current | Notes |
| :--- | :--- | :--- | :--- |
| **ESP32 (WiFi Active + TLS)** | 120 mA – 180 mA | 15 mA (Modem sleep) | Peak during TLS handshake ~240 mA |
| **DHT22 Sensor** | 1.5 mA | 0.05 mA | Periodic read every 2s |
| **LDR Voltage Divider** | 0.3 mA | 0.3 mA | Continuous analog read |
| **Reed Switch** | < 0.1 mA | < 0.1 mA | Passive contact |
| **Total Typical Average** | **~130 mA** | **~16 mA** | |

### Battery Runtime Scenarios:
- **Continuous Hackathon Demo Mode (WiFi streaming every 2s):**
  - Standard 2500 mAh 18650 Cell: **~18 to 20 hours of continuous live streaming**.
- **Production Courier Mode (Wake every 60s, burst telemetry, light sleep):**
  - Average current drops to ~22 mA $\to$ **~4.5 days** uninterrupted transit runtime.

---

## 5. Embedded Cryptographic Execution

The ESP32 features dedicated hardware cryptographic extensions:
1. **Hardware SHA Accelerator:** The Tensilica Xtensa core utilizes dedicated hardware registers for SHA-256 calculation, executing 512-bit message digests in $< 12 \ \mu\text{s}$.
2. **Deterministic Canonicalization:** The embedded sketch uses a single static memory buffer (`StaticJsonDocument<768>`) to format the canonical string with zero dynamic heap fragmentation.
3. **Key Safety:** For production, `DEVICE_KEY` can be burned into the ESP32's **eFuse blocks (BLOCK3)** with read-protection enabled, making extraction physically impossible even with hardware debuggers.

