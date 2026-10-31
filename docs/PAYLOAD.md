# TrustBox Payload & Cryptographic Specification

## 1. Overview
TrustBox is a tamper-evident delivery black box. Every sensor reading is hash-chained to the previous reading and cryptographically signed with HMAC-SHA256 using a shared secret (`DEVICE_KEY`). Any modification of telemetry records stored in transit or at rest will break either the cryptographic signature or the hash chain.

---

## 2. MQTT Topics
- **Telemetry stream (every 1-2 seconds):** `trustbox/<box_id>/telemetry`
- **Event stream (immediate trigger):** `trustbox/<box_id>/event`

Where `<box_id>` is the identifier of the physical box (e.g., `TB-001`).

---

## 3. Record Schema (JSON)

Every MQTT message is a valid JSON object containing all of the following fields:

| Field | Type | Description | Example |
| :--- | :--- | :--- | :--- |
| `box_id` | String | Unique identifier for the box | `"TB-001"` |
| `seq` | Integer | Monotonically increasing sequence number starting at 0 | `0` |
| `ts` | Integer | Unix epoch timestamp in seconds | `1730380000` |
| `temp_c` | Float | Temperature in Celsius (formatted to 1 decimal place) | `4.5` |
| `humidity` | Float | Relative humidity in % (formatted to 1 decimal place) | `55.0` |
| `shock` | Integer (0/1) | High impact / drop detection (1 = shock detected) | `0` |
| `tilt` | Integer (0/1) | Orientation tilt warning (1 = tilted > 45 deg) | `0` |
| `flipped` | Integer (0/1) | Upside-down orientation (1 = inverted) | `0` |
| `light` | Integer | Ambient light intensity (lux or raw ADC value) | `45` |
| `lid_open` | Integer (0/1) | Box enclosure lid state (1 = open, 0 = closed) | `0` |
| `event` | String | Event status enum (`NONE`, `TEMP_BREACH`, `DROP`, `FLIPPED`, `LID_OPEN`, `DELIVERED`) | `"NONE"` |
| `prev_hash` | Hex String | 64-character lowercase hex SHA-256 hash of previous record | `"0000...0000"` (64 zeros for seq 0) |
| `hash` | Hex String | 64-character lowercase hex SHA-256 of current record's serialized input | `"8f43...9a12"` |
| `sig` | Hex String | 64-character lowercase hex HMAC-SHA256(`DEVICE_KEY`, `hash`) | `"3e81...5b77"` |

---

## 4. Hash & Signing Specification

To guarantee deterministic parity across embedded C++ (ESP32) and Node.js:

### Step 1: Canonical Serialization String
Concatenate the 12 fields using the pipe delimiter (`|`) in this strict order:
```text
box_id|seq|ts|temp_c|humidity|shock|tilt|flipped|light|lid_open|event|prev_hash
```

Formatting rules:
- `temp_c` and `humidity` MUST be formatted with exactly **1 decimal place** (e.g., `8.0`, `22.5`).
- Booleans (`shock`, `tilt`, `flipped`, `lid_open`) MUST be numeric `0` or `1`.
- If no event has occurred, `event` MUST be `"NONE"`.
- Genesis record (`seq = 0`) MUST have `prev_hash` equal to 64 ASCII `'0'` characters:
  `0000000000000000000000000000000000000000000000000000000000000000`

### Step 2: Compute Hash
```text
hash = SHA256(canonical_string).toLowerHex()
```

### Step 3: Compute Signature
```text
sig = HMAC_SHA256(key = DEVICE_KEY, message = hash).toLowerHex()
```

---

## 5. Sample Genesis Record (seq: 0)

### Canonical Input:
```text
TB-001|0|1730380000|4.5|55.0|0|0|0|45|0|NONE|0000000000000000000000000000000000000000000000000000000000000000
```

### JSON Payload:
```json
{
  "box_id": "TB-001",
  "seq": 0,
  "ts": 1730380000,
  "temp_c": 4.5,
  "humidity": 55.0,
  "shock": 0,
  "tilt": 0,
  "flipped": 0,
  "light": 45,
  "lid_open": 0,
  "event": "NONE",
  "prev_hash": "0000000000000000000000000000000000000000000000000000000000000000",
  "hash": "cb17d83fcf6b69d80dcfbbf5d8364a9386c9d09cba1572fc712da09919f8ecf4",
  "sig": "3a7491cf085b542e718222b40ee536643ad9d1297e68cfb99db1019a712c4ca9"
}
```

---

## 6. Chain Verification Algorithm
When verifying records for `box_id`:
1. Retrieve all stored records sorted ascending by `seq`.
2. For each record at index $i$:
   - If $i == 0$: verify `record.prev_hash == "0000...0000"` (64 zeros).
   - If $i > 0$: verify `record.prev_hash == records[i - 1].hash`.
   - Recompute canonical string $\to$ `expectedHash = SHA256(canonical_string)`. Verify `record.hash == expectedHash`.
   - Recompute `expectedSig = HMAC_SHA256(DEVICE_KEY, expectedHash)`. Verify `record.sig == expectedSig`.
3. If any check fails, immediately halt and report `{ ok: false, count: records.length, brokenAt: record.seq, latestHash: records[records.length - 1].hash }`.
4. If all records pass, report `{ ok: true, count: records.length, brokenAt: null, latestHash: records[records.length - 1].hash }`.

