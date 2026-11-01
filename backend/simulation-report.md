# 📦 TrustBox Pitching Test Suite — Full Audit Report

**Execution Time:** 1/11/2026, 11:22:28 am

## 📋 Judge Presentation Summary Table

| Item | Box ID | Monitored Hazard | Breach Detected | Final Verdict | Parametric Payout | Test Status |
|---|---|---|---|---|---|---|
| 💉 mRNA Polio/COVID Vaccine (Cold Chain Biologics) | `VACCINE-001` | Strict Cold Chain (2.0°C – 8.0°C) | TEMP_BREACH | **❌ NOT DELIVERED** | ₹150,000 | ✅ PASS |
| 🎂 Designer 3-Tier Cream Cake (Perishable Confectionery) | `CAKE-001` | Cold Chain (≤ 8°C) & Mechanical Vibration | DROP + TEMP_BREACH | **❌ DELIVERY CANCELLED** | ₹75,000 | ✅ PASS |
| 📺 55" 4K OLED Smart TV (High-End Electronics) | `TV-001` | High-G Drop Shock & Moisture (≤ 70% Humidity) | DROP + HUMIDITY_BREACH | **❌ DELIVERY CANCELLED** | ₹75,000 | ✅ PASS |
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
  - **Transaction ID:** `pay_tkreepq5ov34`
  - **Beneficiary:** Serum Institute Logistics Ltd.
  - **Status:** `TRANSFERRED` (Instant Parametric Transfer)

---

### 🎂 Designer 3-Tier Cream Cake (Perishable Confectionery) (`CAKE-001`)
- **Cargo Category:** Perishable & Fragile Bakery
- **Monitored Hazard:** Cold Chain (≤ 8°C) & Mechanical Vibration
- **Incident Narrative:** Van hits a major roadway pothole (SW-420 > 4.5G drop), cracking refrigeration seal. Temperature surges to 36.5°C in direct heat, melting cream.
- **Cryptographic Hash Chain:** ✅ 100% Intact & Unbroken (SHA-256 + HMAC-SHA256 Valid)
- **Final Delivery Verdict:** **DELIVERY CANCELLED** (Expected: DELIVERY CANCELLED)
- **Parametric Claims Approved:** 2
  - **Claim Type:** `DROP`
  - **Trigger Reason:** Violent van pothole impact: Cake structural collapse and side container damage. Delivery cancelled.
  - **Status:** `APPROVED`
  - **Claim Type:** `TEMP_BREACH`
  - **Trigger Reason:** Severe Temperature Breach: Reached 36.5°C (> 8.0°C limit) for 17s. Cream melted and decorations liquefied. Delivery cancelled.
  - **Status:** `APPROVED`
- **Automated Insurance Settlement:** 2
  - **Settlement Amount:** **₹25,000 INR**
  - **Transaction ID:** `pay_rq2r8xarx0pq`
  - **Beneficiary:** CakeCraft Confectionery Ltd.
  - **Status:** `TRANSFERRED` (Instant Parametric Transfer)
  - **Settlement Amount:** **₹50,000 INR**
  - **Transaction ID:** `pay_jq5ozi5xdjfb`
  - **Beneficiary:** CakeCraft Confectionery Ltd.
  - **Status:** `TRANSFERRED` (Instant Parametric Transfer)

---

### 📺 55" 4K OLED Smart TV (High-End Electronics) (`TV-001`)
- **Cargo Category:** Fragile Glass & Precision Circuitry
- **Monitored Hazard:** High-G Drop Shock & Moisture (≤ 70% Humidity)
- **Incident Narrative:** Cargo truck container experiences violent drop impacts (>6.5G to 8.0G) off transport pallet, shattering OLED panel followed by roof leak.
- **Cryptographic Hash Chain:** ✅ 100% Intact & Unbroken (SHA-256 + HMAC-SHA256 Valid)
- **Final Delivery Verdict:** **DELIVERY CANCELLED** (Expected: DELIVERY CANCELLED)
- **Parametric Claims Approved:** 2
  - **Claim Type:** `DROP`
  - **Trigger Reason:** Violent High-G Drop Impact Detected: OLED display panel shattered against cargo barrier. Delivery cancelled.
  - **Status:** `APPROVED`
  - **Claim Type:** `HUMIDITY_BREACH`
  - **Trigger Reason:** High humidity breach detected: 88% (Threshold: 70%) - Circuit Short Risk, Returned
  - **Status:** `APPROVED`
- **Automated Insurance Settlement:** 2
  - **Settlement Amount:** **₹45,000 INR**
  - **Transaction ID:** `pay_hvb5giz8y3og`
  - **Beneficiary:** Sony Electronics Logistics Ltd.
  - **Status:** `TRANSFERRED` (Instant Parametric Transfer)
  - **Settlement Amount:** **₹30,000 INR**
  - **Transaction ID:** `pay_tmsdmnas8u7g`
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
  - **Transaction ID:** `pay_kqmo9p1xsb7b`
  - **Beneficiary:** Bohemia Crystal Imports Ltd.
  - **Status:** `TRANSFERRED` (Instant Parametric Transfer)
  - **Settlement Amount:** **₹35,000 INR**
  - **Transaction ID:** `pay_rqf1xuvmk0kg`
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
  - **Transaction ID:** `pay_8k2deh92ocgq`
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

