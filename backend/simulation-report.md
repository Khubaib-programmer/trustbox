# 📦 TrustBox Pitching Test Suite — Full Audit Report

**Execution Time:** 1/11/2026, 10:42:58 am

## 📋 Judge Presentation Summary Table

| Item | Box ID | Monitored Hazard | Breach Detected | Final Verdict | Parametric Payout | Test Status |
|---|---|---|---|---|---|---|
| 💉 mRNA Polio/COVID Vaccine (Cold Chain Biologics) | `VACCINE-001` | Strict Cold Chain (2.0°C – 8.0°C) | TEMP_BREACH | **❌ NOT DELIVERED** | ₹150,000 | ✅ PASS |
| 🎂 Designer 3-Tier Cream Cake (Perishable Confectionery) | `CAKE-001` | Cold Chain (≤ 8°C) & Mechanical Vibration | DROP + TEMP_BREACH | **❌ NOT DELIVERED** | ₹75,000 | ✅ PASS |
| 📺 55" 4K OLED Smart TV (High-End Electronics) | `TV-001` | Moisture (≤ 70% Humidity) & Drop Shock | HUMIDITY_BREACH + DROP | **❌ NOT DELIVERED** | ₹70,000 | ✅ PASS |
| 💎 Luxury Bohemian Crystal Glassware (Ultra-Fragile) | `FRAGILE-001` | Upright Orientation (Tilt / Inversion) & Shock | TILT + DROP | **❌ NOT DELIVERED** | ₹70,000 | ✅ PASS |
| 💻 RTX 4090 Gaming Laptop (Precision Hardware) | `ELECTRONIC-001` | Mechanical G-Force Impact & Moisture | DROP | **❌ NOT DELIVERED** | ₹45,000 | ✅ PASS |
| 📚 Hardcover Medical Encyclopedias (Durable Goods) | `BOOKS-001` | Complete Cryptographic Proof-of-Delivery | None (Safe) | **✅ DELIVERED** | ₹0 | ✅ PASS |

---

## 🔍 Scenario-by-Scenario Audit Details

### 💉 mRNA Polio/COVID Vaccine (Cold Chain Biologics) (`VACCINE-001`)
- **Cargo Category:** Critical Biological Vaccine
- **Monitored Hazard:** Strict Cold Chain (2.0°C – 8.0°C)
- **Incident Narrative:** Dry ice packaging depletes midway in remote transit. Temperature exceeds 8°C for >15s, neutralizing active viral antigens.
- **Cryptographic Hash Chain:** ✅ 100% Intact & Unbroken (SHA-256 + HMAC-SHA256 Valid)
- **Final Delivery Verdict:** **NOT DELIVERED** (Expected: NOT DELIVERED)
- **Parametric Claims Approved:** 1
  - **Claim Type:** `TEMP_BREACH`
  - **Trigger Reason:** Critical Vaccine Cold-Chain Failure: Temperature 17.2°C exceeded 8.0°C for 17s. Active antigens neutralized. Payout auto-settled.
  - **Status:** `APPROVED`
- **Automated Insurance Settlement:** 1
  - **Settlement Amount:** **₹150,000 INR**
  - **Transaction ID:** `pay_lpcqdjrs4do8`
  - **Beneficiary:** Serum Institute Logistics Ltd.
  - **Status:** `TRANSFERRED` (Instant Parametric Transfer)

---

### 🎂 Designer 3-Tier Cream Cake (Perishable Confectionery) (`CAKE-001`)
- **Cargo Category:** Perishable & Fragile Bakery
- **Monitored Hazard:** Cold Chain (≤ 8°C) & Mechanical Vibration
- **Incident Narrative:** Van hits a major roadway pothole (SW-420 > 4.5G drop), cracking the refrigeration seal and melting cream decorations.
- **Cryptographic Hash Chain:** ✅ 100% Intact & Unbroken (SHA-256 + HMAC-SHA256 Valid)
- **Final Delivery Verdict:** **NOT DELIVERED** (Expected: NOT DELIVERED)
- **Parametric Claims Approved:** 2
  - **Claim Type:** `DROP`
  - **Trigger Reason:** Violent van pothole impact: Cake structural collapse and side container damage.
  - **Status:** `APPROVED`
  - **Claim Type:** `TEMP_BREACH`
  - **Trigger Reason:** Confectionery Cold-Chain Failure: Temperature reached 16.5°C for 17s. Icing and cream spoiled. Delivery rejected.
  - **Status:** `APPROVED`
- **Automated Insurance Settlement:** 2
  - **Settlement Amount:** **₹25,000 INR**
  - **Transaction ID:** `pay_trcbogjxqsg7`
  - **Beneficiary:** CakeCraft Confectionery Ltd.
  - **Status:** `TRANSFERRED` (Instant Parametric Transfer)
  - **Settlement Amount:** **₹50,000 INR**
  - **Transaction ID:** `pay_emztxelrc9cz`
  - **Beneficiary:** CakeCraft Confectionery Ltd.
  - **Status:** `TRANSFERRED` (Instant Parametric Transfer)

---

### 📺 55" 4K OLED Smart TV (High-End Electronics) (`TV-001`)
- **Cargo Category:** Fragile Glass & Precision Circuitry
- **Monitored Hazard:** Moisture (≤ 70% Humidity) & Drop Shock
- **Incident Narrative:** Cargo truck container develops roof leak during monsoon storm (88% humidity) followed by sudden deceleration impact.
- **Cryptographic Hash Chain:** ✅ 100% Intact & Unbroken (SHA-256 + HMAC-SHA256 Valid)
- **Final Delivery Verdict:** **NOT DELIVERED** (Expected: NOT DELIVERED)
- **Parametric Claims Approved:** 2
  - **Claim Type:** `HUMIDITY_BREACH`
  - **Trigger Reason:** High humidity breach detected: 88% (Threshold: 70%) - Circuit Short Risk, Returned
  - **Status:** `APPROVED`
  - **Claim Type:** `DROP`
  - **Trigger Reason:** Heavy shock impact detected: OLED panel shatter and internal ribbon cable displacement risk.
  - **Status:** `APPROVED`
- **Automated Insurance Settlement:** 2
  - **Settlement Amount:** **₹30,000 INR**
  - **Transaction ID:** `pay_b0v0e47f2y1f`
  - **Beneficiary:** Sony Electronics Logistics Ltd.
  - **Status:** `TRANSFERRED` (Instant Parametric Transfer)
  - **Settlement Amount:** **₹40,000 INR**
  - **Transaction ID:** `pay_fml6ld3700y5`
  - **Beneficiary:** Sony Electronics Logistics Ltd.
  - **Status:** `TRANSFERRED` (Instant Parametric Transfer)

---

### 💎 Luxury Bohemian Crystal Glassware (Ultra-Fragile) (`FRAGILE-001`)
- **Cargo Category:** Ultra-Fragile Glassware
- **Monitored Hazard:** Upright Orientation (Tilt / Inversion) & Shock
- **Incident Narrative:** Courier ignores "THIS SIDE UP" labels. Package is tilted over 60° and flipped upside down on automated sorting conveyor.
- **Cryptographic Hash Chain:** ✅ 100% Intact & Unbroken (SHA-256 + HMAC-SHA256 Valid)
- **Final Delivery Verdict:** **NOT DELIVERED** (Expected: NOT DELIVERED)
- **Parametric Claims Approved:** 2
  - **Claim Type:** `TILT`
  - **Trigger Reason:** Fragile cargo tipped / inverted (Tilt/Flipped: 1) - 'THIS SIDE UP' violation, Glassware shattered.
  - **Status:** `APPROVED`
  - **Claim Type:** `DROP`
  - **Trigger Reason:** Drop shock detected: Ultra-fragile glassware shattered in transit.
  - **Status:** `APPROVED`
- **Automated Insurance Settlement:** 2
  - **Settlement Amount:** **₹35,000 INR**
  - **Transaction ID:** `pay_pwbkd9np1xx4`
  - **Beneficiary:** Bohemia Crystal Imports Ltd.
  - **Status:** `TRANSFERRED` (Instant Parametric Transfer)
  - **Settlement Amount:** **₹35,000 INR**
  - **Transaction ID:** `pay_4g2caz14cjc8`
  - **Beneficiary:** Bohemia Crystal Imports Ltd.
  - **Status:** `TRANSFERRED` (Instant Parametric Transfer)

---

### 💻 RTX 4090 Gaming Laptop (Precision Hardware) (`ELECTRONIC-001`)
- **Cargo Category:** Premium Computing Electronics
- **Monitored Hazard:** Mechanical G-Force Impact & Moisture
- **Incident Narrative:** Delivery agent accidentally drops laptop case from 1.5 meters during delivery handoff (> 5G impact detected).
- **Cryptographic Hash Chain:** ✅ 100% Intact & Unbroken (SHA-256 + HMAC-SHA256 Valid)
- **Final Delivery Verdict:** **NOT DELIVERED** (Expected: NOT DELIVERED)
- **Parametric Claims Approved:** 1
  - **Claim Type:** `DROP`
  - **Trigger Reason:** Severe mechanical shock (>5G): Motherboard micro-trace crack hazard detected.
  - **Status:** `APPROVED`
- **Automated Insurance Settlement:** 1
  - **Settlement Amount:** **₹45,000 INR**
  - **Transaction ID:** `pay_ne852xpl849b`
  - **Beneficiary:** Dell Global Logistics Corp.
  - **Status:** `TRANSFERRED` (Instant Parametric Transfer)

---

### 📚 Hardcover Medical Encyclopedias (Durable Goods) (`BOOKS-001`)
- **Cargo Category:** Standard Cargo (Control Baseline)
- **Monitored Hazard:** Complete Cryptographic Proof-of-Delivery
- **Incident Narrative:** Standard shipment with zero hazards. Demonstrates that safe transit triggers zero false positives and records complete SHA-256 chain.
- **Cryptographic Hash Chain:** ✅ 100% Intact & Unbroken (SHA-256 + HMAC-SHA256 Valid)
- **Final Delivery Verdict:** **DELIVERED** (Expected: DELIVERED)
- **Parametric Claims Approved:** 0
- **Automated Insurance Settlement:** 0

---

