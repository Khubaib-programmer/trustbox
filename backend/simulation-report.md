# 📦 TrustBox 3-Item Delivery Simulation Report

**Execution Time:** 1/11/2026, 6:41:22 am

## 📋 Summary Table

| Item | Box ID | Category | Breach Type | Outcome | Payout (INR) | Status |
|---|---|---|---|---|---|---|
| 🎂 Cream Cake (Perishable Cold-Chain) | `CAKE-001` | Perishable Food | TEMP_BREACH + DROP | **❌ NOT DELIVERED** | ₹75,000 | ✅ PASS |
| 📺 55" OLED Smart TV (Electronics) | `TV-001` | Sensitive Electronics | HUMIDITY_BREACH | **❌ NOT DELIVERED** | ₹30,000 | ✅ PASS |
| 📚 Educational Hardcover Books (Dry Goods) | `BOOKS-001` | Non-Perishable Goods | None (Safe) | **✅ DELIVERED** | ₹0 | ✅ PASS |

---

## 🔍 Item-by-Item Detailed Breakdown

### 🎂 Cream Cake (Perishable Cold-Chain) (`CAKE-001`)
- **Category:** Perishable Food
- **Condition:** Requires cold chain ≤ 8.0°C & gentle handling. Suffers multiple severe shock impacts (SW-420 > 4G) + cooler failure (16°C).
- **Cryptographic Hash Chain:** ✅ 100% Unbroken & Verified
- **Final Delivery Outcome:** **NOT DELIVERED** (Expected: NOT DELIVERED)
- **Claims Filed:** 2
  - **Type:** `TEMP_BREACH`
  - **Reason:** Temperature exceeded 8°C for 17s (Threshold: 15s, Current: 16.5°C) - Cargo Spoiled, Returned
  - **Status:** `APPROVED`
  - **Type:** `DROP`
  - **Reason:** High impact drop detected at seq #3 (Shock: 1)
  - **Status:** `APPROVED`
- **Insurance Payouts:** 2
  - **Amount:** **₹50,000 INR**
  - **Payout ID:** `pay_wqsyr467hy59`
  - **Beneficiary:** CakeCraft Confectionery Ltd.
  - **Status:** `TRANSFERRED`
  - **Amount:** **₹25,000 INR**
  - **Payout ID:** `pay_3ors2qtoqjsi`
  - **Beneficiary:** PharmaSupply Logistics Ltd.
  - **Status:** `TRANSFERRED`

---

### 📺 55" OLED Smart TV (Electronics) (`TV-001`)
- **Category:** Sensitive Electronics
- **Condition:** Requires dry storage ≤ 75% humidity. Heavy rain causes water leakage in container.
- **Cryptographic Hash Chain:** ✅ 100% Unbroken & Verified
- **Final Delivery Outcome:** **NOT DELIVERED** (Expected: NOT DELIVERED)
- **Claims Filed:** 1
  - **Type:** `HUMIDITY_BREACH`
  - **Reason:** High humidity breach detected: 88% (Threshold: 75%) - Circuit Short Risk, Returned
  - **Status:** `APPROVED`
- **Insurance Payouts:** 1
  - **Amount:** **₹30,000 INR**
  - **Payout ID:** `pay_h58smoefmu72`
  - **Beneficiary:** Sony Electronics Logistics Ltd.
  - **Status:** `TRANSFERRED`

---

### 📚 Educational Hardcover Books (Dry Goods) (`BOOKS-001`)
- **Category:** Non-Perishable Goods
- **Condition:** Standard cargo with no temperature sensitivity. Delivered safely without incident.
- **Cryptographic Hash Chain:** ✅ 100% Unbroken & Verified
- **Final Delivery Outcome:** **DELIVERED** (Expected: DELIVERED)
- **Claims Filed:** 0
- **Insurance Payouts:** 0

---

