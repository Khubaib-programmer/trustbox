require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const mongoose = require('mongoose');
const mqtt = require('mqtt');
const { Record, Claim, Payout } = require('./models');
const { verifyChain, verifySingleRecord, GENESIS_PREV_HASH } = require('./chain');
const InsuranceEngine = require('./insurance');

const app = express();
const server = http.createServer(app);

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json());

// Socket.io for live updates
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Environment Configuration
const PORT = process.env.PORT || 4000;
const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/trustbox';
const MQTT_URL = process.env.MQTT_URL; // e.g. mqtts://xxxx.hivemq.cloud:8883
const MQTT_USER = process.env.MQTT_USER;
const MQTT_PASS = process.env.MQTT_PASS;
const DEVICE_KEY = process.env.DEVICE_KEY || 'trustbox-super-secret-key-32ch';
const CLAIM_TEMP_C = parseFloat(process.env.CLAIM_TEMP_C) || 8.0;
const CLAIM_WINDOW_SEC = parseInt(process.env.CLAIM_WINDOW_SEC, 10) || 15;
// IoT raw topic — the exact topic your hardware publishes to
// e.g. "box-001/telemetry" or "trustbox/raw" or "#" (wildcard all)
const IOT_MQTT_TOPIC = process.env.IOT_MQTT_TOPIC || 'trustbox/raw/#';

// In-memory fallback if MongoDB is offline during hackathon demo
let isMongoConnected = false;
const inMemoryRecords = new Map(); // boxId -> array of records
const inMemoryClaims = new Map();  // boxId -> array of claims
const inMemoryPayouts = new Map(); // boxId -> array of payouts

// Connect to MongoDB
mongoose.connect(MONGO_URI, {
  serverSelectionTimeoutMS: 3000
}).then(() => {
  isMongoConnected = true;
  console.log(' Connected to MongoDB:', MONGO_URI);
}).catch((err) => {
  console.warn('⚠️ MongoDB connection failed. Falling back to high-speed in-memory store for demo resilience.');
  console.warn('  Error detail:', err.message);
  isMongoConnected = false;
});

// Initialize Insurance Engine
const insuranceEngine = new InsuranceEngine({
  claimTempC: CLAIM_TEMP_C,
  claimWindowSec: CLAIM_WINDOW_SEC,
  onClaimApproved: (claim, payout) => {
    if (!isMongoConnected) {
      const boxClaims = inMemoryClaims.get(claim.box_id) || [];
      boxClaims.push(claim);
      inMemoryClaims.set(claim.box_id, boxClaims);

      const boxPayouts = inMemoryPayouts.get(payout.box_id) || [];
      boxPayouts.push(payout);
      inMemoryPayouts.set(payout.box_id, boxPayouts);
    }
  }
});

/**
 * Helper to get the most recent record for a box ID
 */
async function getLatestBoxRecord(boxId) {
  if (isMongoConnected) {
    return await Record.findOne({ box_id: boxId }).sort({ seq: -1 }).lean();
  } else {
    const list = inMemoryRecords.get(boxId) || [];
    return list.length > 0 ? list[list.length - 1] : null;
  }
}

/**
 * Maps raw IoT device payload → TrustBox internal schema.
 * Handles field renames, boolean→int coercion, sensor selection,
 * and event string derivation.
 *
 * IoT device fields:
 *   device_id, uptime_ms, temperature_dht_c, humidity_pct,
 *   temperature_ds18b20_c, photo_raw, light_inside, shock, tilt,
 *   ball_switch, reed_triggered, delivery_button, breach
 */
function adaptIoTPayload(raw) {
  // Prefer DS18B20 (more accurate probe) if present and valid, else fall back to DHT
  const temp_c = (raw.temperature_ds18b20_c != null && !isNaN(raw.temperature_ds18b20_c))
    ? parseFloat(Number(raw.temperature_ds18b20_c).toFixed(1))
    : parseFloat(Number(raw.temperature_dht_c).toFixed(1));

  const humidity = parseFloat(Number(raw.humidity_pct).toFixed(1));

  // Booleans → 0/1
  const b = (v) => (v === true || v === 1 || v === '1') ? 1 : 0;

  const shock     = b(raw.shock);
  const tilt      = b(raw.tilt) || b(raw.ball_switch);   // ball_switch = tilt sensor
  const flipped   = b(raw.tilt) && b(raw.ball_switch) ? 1 : 0; // both active = flipped
  const lid_open  = b(raw.reed_triggered);               // reed switch = magnetic lid sensor
  const light     = parseInt(raw.photo_raw, 10) || 0;   // raw lux/ADC reading

  // Derive event string from breach flags
  let event = 'NONE';
  if (raw.breach === true || raw.breach === 1) {
    if (temp_c > CLAIM_TEMP_C)       event = 'TEMP_BREACH';
    else if (shock)                   event = 'DROP';
    else if (flipped)                 event = 'FLIPPED';
    else if (lid_open)                event = 'LID_OPEN';
    else                              event = 'TEMP_BREACH'; // fallback
  } else if (shock)   event = 'DROP';
  else if (flipped)   event = 'FLIPPED';
  else if (lid_open)  event = 'LID_OPEN';

  return {
    box_id:   String(raw.device_id || 'box-001').trim(),
    ts:       Math.floor(Date.now() / 1000),   // server timestamp (seconds)
    temp_c,
    humidity,
    shock,
    tilt,
    flipped,
    light,
    lid_open,
    event,
    // seq, prev_hash, hash, sig are computed server-side in ingestIoTRecord()
  };
}

/**
 * Server-side chain computation + ingestion for raw IoT payloads.
 * The IoT device does NOT send seq/hash/sig — the backend computes them.
 */
const { signRecord, buildCanonicalString, computeHash, computeSignature } = require('./chain');

async function ingestIoTRecord(rawIoT, source = 'IOT-MQTT') {
  let adapted;
  try {
    adapted = adaptIoTPayload(rawIoT);
  } catch (e) {
    console.error(`[IOT ADAPT ERROR] Failed mapping IoT payload: ${e.message}`);
    return { success: false, error: e.message };
  }

  const boxId = adapted.box_id;

  // Get latest chain state to determine next seq + prev_hash
  const latest = await getLatestBoxRecord(boxId);
  const seq       = latest ? latest.seq + 1 : 0;
  const prev_hash = latest ? latest.hash : GENESIS_PREV_HASH;

  // Assemble full record
  const rawRecord = { ...adapted, seq, prev_hash };

  // Compute hash + HMAC signature server-side
  const signed = signRecord(rawRecord, DEVICE_KEY);

  // Pass through the normal ingestion pipeline
  const result = await handleIncomingRecord(signed, source);
  if (result.success) {
    console.log(`[IOT ${source}] ${boxId} #${seq} | Temp: ${signed.temp_c}°C | Event: ${signed.event}`);
  } else {
    console.warn(`[IOT INGEST FAILED] ${boxId} #${seq}: ${result.error}`);
  }
  return result;
}

/**
 * Validates payload schema and physical range limits
 */
function validateRecordPayload(record) {
  if (!record || typeof record !== 'object') {
    return { valid: false, status: 400, error: 'Record payload must be a JSON object.' };
  }
  const { box_id, seq, ts, temp_c, humidity, shock, tilt, flipped, light, lid_open, event, prev_hash, hash, sig } = record;

  if (!box_id || typeof box_id !== 'string' || box_id.trim().length === 0) {
    return { valid: false, status: 400, error: 'Field "box_id" is required and must be a non-empty string.' };
  }
  if (seq === undefined || seq === null || isNaN(parseInt(seq, 10)) || parseInt(seq, 10) < 0) {
    return { valid: false, status: 400, error: 'Field "seq" must be a non-negative integer.' };
  }
  if (ts === undefined || ts === null || isNaN(parseInt(ts, 10)) || parseInt(ts, 10) <= 0) {
    return { valid: false, status: 400, error: 'Field "ts" must be a valid positive UNIX timestamp in seconds.' };
  }
  if (temp_c === undefined || isNaN(Number(temp_c)) || Number(temp_c) < -60 || Number(temp_c) > 120) {
    return { valid: false, status: 400, error: 'Field "temp_c" out of realistic physical range (-60°C to 120°C).' };
  }
  if (humidity === undefined || isNaN(Number(humidity)) || Number(humidity) < 0 || Number(humidity) > 100) {
    return { valid: false, status: 400, error: 'Field "humidity" out of valid percentage range (0% to 100%).' };
  }
  if (!prev_hash || typeof prev_hash !== 'string' || prev_hash.length !== 64) {
    return { valid: false, status: 400, error: 'Field "prev_hash" must be a 64-character hex string.' };
  }
  if (!hash || typeof hash !== 'string' || hash.length !== 64) {
    return { valid: false, status: 400, error: 'Field "hash" must be a 64-character SHA-256 hex string.' };
  }
  if (!sig || typeof sig !== 'string' || sig.length !== 64) {
    return { valid: false, status: 400, error: 'Field "sig" must be a 64-character HMAC-SHA256 hex signature.' };
  }

  return { valid: true };
}

/**
 * Handle new record ingestion (from MQTT or REST) with validation,
 * cryptographic verification, and strict sequence/chain continuity.
 */
async function handleIncomingRecord(record, source = 'REST') {
  // 1. Schema & Range Validation
  const valResult = validateRecordPayload(record);
  if (!valResult.valid) {
    return { success: false, status: valResult.status, error: valResult.error };
  }

  const boxId = String(record.box_id).trim();
  const seq = parseInt(record.seq, 10);

  // 2. Cryptographic Signature & Hash Verification
  const cryptoCheck = verifySingleRecord(record, DEVICE_KEY);
  if (!cryptoCheck.valid) {
    console.warn(`[INGEST REJECTED] Cryptographic verification failed for ${boxId} #${seq}: ${cryptoCheck.error}`);
    return { success: false, status: 401, error: cryptoCheck.error };
  }

  // 3. Chain Continuity & Duplicate Sequence Validation
  try {
    const latest = await getLatestBoxRecord(boxId);

    if (!latest) {
      // New box device: must start at seq 0 with GENESIS_PREV_HASH
      if (seq !== 0) {
        return {
          success: false,
          status: 400,
          error: `First record for new box ${boxId} must have sequence #0. Received #${seq}.`
        };
      }
      if (record.prev_hash.toLowerCase() !== GENESIS_PREV_HASH.toLowerCase()) {
        return {
          success: false,
          status: 400,
          error: `Genesis record (seq #0) must use 64-zero genesis prev_hash.`
        };
      }
    } else {
      // Subsequent records: must continue chain strictly
      if (seq <= latest.seq) {
        console.log(`[INGEST DUPLICATE] Duplicate/outdated record rejected: ${boxId} #${seq} (latest is #${latest.seq})`);
        return {
          success: false,
          status: 409,
          error: `Duplicate sequence number #${seq} for box ${boxId}. Current latest sequence is #${latest.seq}.`
        };
      }
      if (seq !== latest.seq + 1) {
        return {
          success: false,
          status: 400,
          error: `Sequence gap detected for box ${boxId}. Expected #${latest.seq + 1}, received #${seq}.`
        };
      }
      if (record.prev_hash.toLowerCase() !== latest.hash.toLowerCase()) {
        return {
          success: false,
          status: 400,
          error: `Chain broken: record #${seq} prev_hash (${record.prev_hash.substring(0, 10)}...) does not match previous record #${latest.seq} hash (${latest.hash.substring(0, 10)}...).`
        };
      }
    }

    // 4. Persistence
    let savedRecord = record;
    if (isMongoConnected) {
      savedRecord = await Record.create(record);
    } else {
      const boxRecords = inMemoryRecords.get(boxId) || [];
      boxRecords.push(record);
      boxRecords.sort((a, b) => a.seq - b.seq);
      inMemoryRecords.set(boxId, boxRecords);
      savedRecord = record;
    }

    // 5. Broadcast live over Socket.io
    io.emit('record', savedRecord);
    if (record.event && record.event !== 'NONE') {
      io.emit('event', savedRecord);
    }

    // 6. Pass through parametric insurance evaluation
    await insuranceEngine.processRecord(
      record,
      isMongoConnected ? Claim : null,
      isMongoConnected ? Payout : null,
      io
    );

    console.log(`[RECORD ${source}] ${boxId} #${seq} | Temp: ${record.temp_c}°C | Event: ${record.event} | Hash: ${record.hash.substring(0, 8)}...`);
    return { success: true, record: savedRecord };
  } catch (err) {
    if (err.code === 11000) {
      console.log(`[INGEST] Mongo duplicate key on ${boxId} #${seq}`);
      return { success: false, status: 409, error: `Record ${boxId} #${seq} already exists in database.` };
    } else {
      console.error('[INGEST ERROR]', err);
      return { success: false, status: 500, error: 'Internal storage error during record ingestion.' };
    }
  }
}

// ==========================================
// MQTT CLIENT SETUP
// ==========================================
if (MQTT_URL) {
  console.log(`Connecting to MQTT broker: ${MQTT_URL}`);
  const mqttClient = mqtt.connect(MQTT_URL, {
    username: MQTT_USER,
    password: MQTT_PASS,
    rejectUnauthorized: false,
    reconnectPeriod: 3000
  });

  mqttClient.on('connect', () => {
    console.log('✅ Connected to HiveMQ / MQTT Broker!');

    // --- TrustBox internal signed records (fake-publisher / another TrustBox node) ---
    mqttClient.subscribe('trustbox/+/telemetry', (err) => {
      if (!err) console.log('✅ Subscribed to trustbox/+/telemetry  (signed TrustBox records)');
    });
    mqttClient.subscribe('trustbox/+/event', (err) => {
      if (!err) console.log('✅ Subscribed to trustbox/+/event  (signed TrustBox records)');
    });

    // --- Raw IoT device topic (hardware team payload, no hash/sig) ---
    mqttClient.subscribe(IOT_MQTT_TOPIC, (err) => {
      if (!err) console.log(`✅ Subscribed to ${IOT_MQTT_TOPIC}  (raw IoT hardware payloads)`);
    });
  });

  mqttClient.on('message', async (topic, message) => {
    try {
      const payload = JSON.parse(message.toString());

      // Route: raw IoT payload has device_id but no hash/sig/seq
      const isRawIoT = payload.device_id !== undefined && payload.hash === undefined;

      if (isRawIoT) {
        // Adapt + compute chain server-side, then ingest
        await ingestIoTRecord(payload, 'IOT-MQTT');
      } else {
        // Already a signed TrustBox record — validate and ingest directly
        await handleIncomingRecord(payload, 'MQTT');
      }
    } catch (e) {
      console.error(`[MQTT ERROR] Failed parsing message on ${topic}:`, e.message);
    }
  });

  mqttClient.on('error', (err) => {
    console.error('⚠️ MQTT Broker Error:', err.message);
  });
} else {
  console.log('ℹ️ MQTT_URL not configured. Running in HTTP/WebSocket mode (Use fake-publisher.js or REST).');
}

// ==========================================
// REST API ENDPOINTS
// ==========================================

// Root status endpoint
app.get('/', (req, res) => {
  res.json({
    status: 'online',
    service: 'TrustBox Backend API',
    mongoConnected: isMongoConnected,
    frontend: 'http://localhost:3000',
    endpoints: {
      records: '/api/records/:boxId',
      verify: '/api/verify/:boxId',
      claims: '/api/claims/:boxId',
      payouts: '/api/payouts/:boxId',
      boxes: '/api/boxes',
      latest_device_state: '/api/devices/:boxId/latest',
      tamper: 'POST /api/admin/tamper/:boxId/:seq',
      reset: 'POST /api/admin/reset/:boxId'
    }
  });
});

// 1. Direct record ingestion endpoint (for testing or direct HTTP push)
app.post('/api/records', async (req, res) => {
  const record = req.body;
  const result = await handleIncomingRecord(record, 'HTTP');
  if (!result.success) {
    return res.status(result.status || 400).json({ error: result.error });
  }
  res.status(201).json({ 
    status: 'received', 
    box_id: record.box_id, 
    seq: record.seq, 
    hash: record.hash 
  });
});

// 1b. GET /api/devices/:boxId/latest -> Retrieve latest state to resume chain safely
app.get('/api/devices/:boxId/latest', async (req, res) => {
  const { boxId } = req.params;
  try {
    const latest = await getLatestBoxRecord(boxId);
    if (latest) {
      res.json({
        box_id: boxId,
        exists: true,
        latestSeq: latest.seq,
        latestHash: latest.hash,
        nextSeq: latest.seq + 1,
        prevHash: latest.hash,
        timestamp: latest.ts
      });
    } else {
      res.json({
        box_id: boxId,
        exists: false,
        latestSeq: null,
        latestHash: null,
        nextSeq: 0,
        prevHash: GENESIS_PREV_HASH
      });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 1c. GET /api/boxes -> List all known box IDs in system
app.get('/api/boxes', async (req, res) => {
  try {
    let boxes = [];
    if (isMongoConnected) {
      boxes = await Record.distinct('box_id');
    } else {
      boxes = Array.from(inMemoryRecords.keys());
    }
    // Ensure standard boxes appear in list if none exist
    if (boxes.length === 0) {
      boxes = ['TB-001', 'TB-TEST'];
    }
    res.json({ boxes });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. GET /api/verify/:boxId -> Chain verification endpoint
app.get('/api/verify/:boxId', async (req, res) => {
  const { boxId } = req.params;
  try {
    let records = [];
    if (isMongoConnected) {
      records = await Record.find({ box_id: boxId }).sort({ seq: 1 }).lean();
    } else {
      records = inMemoryRecords.get(boxId) || [];
    }

    const verificationResult = verifyChain(records, DEVICE_KEY);
    res.json(verificationResult);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. POST /api/admin/tamper/:boxId/:seq -> Modifies a stored record to demonstrate tamper detection
app.post('/api/admin/tamper/:boxId/:seq', async (req, res) => {
  const { boxId, seq } = req.params;
  const seqNum = parseInt(seq, 10);

  try {
    let tamperedRecord = null;
    if (isMongoConnected) {
      const target = await Record.findOne({ box_id: boxId, seq: seqNum });
      if (!target) {
        return res.status(404).json({ error: `Record #${seqNum} not found for box ${boxId}` });
      }
      // Maliciously alter temp_c without updating hash/sig
      target.temp_c = target.temp_c === 4.5 ? 28.5 : 4.5;
      await target.save();
      tamperedRecord = target;
    } else {
      const list = inMemoryRecords.get(boxId) || [];
      const index = list.findIndex(r => r.seq === seqNum);
      if (index === -1) {
        return res.status(404).json({ error: `Record #${seqNum} not found for box ${boxId}` });
      }
      list[index].temp_c = list[index].temp_c === 4.5 ? 28.5 : 4.5;
      tamperedRecord = list[index];
    }

    console.log(`😈 [TAMPER SIMULATED] Maliciously altered temp_c for ${boxId} #${seqNum} to ${tamperedRecord.temp_c}`);
    
    // Broadcast tamper event
    io.emit('tamper', { box_id: boxId, seq: seqNum, new_temp: tamperedRecord.temp_c });

    res.json({
      success: true,
      message: `Record #${seqNum} of ${boxId} was tampered! temp_c is now ${tamperedRecord.temp_c}`,
      record: tamperedRecord
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. GET /api/records/:boxId -> Retrieve stored records
app.get('/api/records/:boxId', async (req, res) => {
  const { boxId } = req.params;
  const limit = parseInt(req.query.limit, 10) || 100;
  try {
    let records = [];
    if (isMongoConnected) {
      records = await Record.find({ box_id: boxId }).sort({ seq: -1 }).limit(limit).lean();
      records.reverse(); // ascending order for charts
    } else {
      const all = inMemoryRecords.get(boxId) || [];
      records = all.slice(-limit);
    }
    res.json(records);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. GET /api/claims/:boxId -> Retrieve claims
app.get('/api/claims/:boxId', async (req, res) => {
  const { boxId } = req.params;
  try {
    let claims = [];
    if (isMongoConnected) {
      claims = await Claim.find({ box_id: boxId }).sort({ createdAt: -1 }).lean();
    } else {
      claims = inMemoryClaims.get(boxId) || [];
    }
    res.json(claims);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 6. GET /api/payouts/:boxId -> Retrieve payouts
app.get('/api/payouts/:boxId', async (req, res) => {
  const { boxId } = req.params;
  try {
    let payouts = [];
    if (isMongoConnected) {
      payouts = await Payout.find({ box_id: boxId }).sort({ timestamp: -1 }).lean();
    } else {
      payouts = inMemoryPayouts.get(boxId) || [];
    }
    res.json(payouts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 7. POST /api/admin/reset/:boxId -> Reset demo state
app.post('/api/admin/reset/:boxId', async (req, res) => {
  const { boxId } = req.params;
  const { confirm } = req.body || {};

  // Protect reference test device from accidental reset
  if (boxId === 'TB-TEST' && confirm !== true) {
    return res.status(403).json({
      error: 'Reset of reference test device TB-TEST is protected. Pass { "confirm": true } in request body to confirm.'
    });
  }

  try {
    if (isMongoConnected) {
      await Record.deleteMany({ box_id: boxId });
      await Claim.deleteMany({ box_id: boxId });
      await Payout.deleteMany({ box_id: boxId });
    }
    inMemoryRecords.delete(boxId);
    inMemoryClaims.delete(boxId);
    inMemoryPayouts.delete(boxId);

    // Reset engine state
    insuranceEngine.boxState.delete(boxId);

    console.log(`[RESET] State reset for box ${boxId}`);
    io.emit('reset', { box_id: boxId });
    res.json({ success: true, message: `Reset completed for ${boxId}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =========================================================
// IoT RAW INGEST — HTTP fallback for hardware teams
// POST /api/iot/ingest  { device_id, temperature_dht_c, ... }
// =========================================================
app.post('/api/iot/ingest', async (req, res) => {
  const raw = req.body;
  if (!raw || !raw.device_id) {
    return res.status(400).json({ error: 'Payload must include device_id.' });
  }
  try {
    const result = await ingestIoTRecord(raw, 'IOT-HTTP');
    if (result.success) {
      res.status(201).json({ ok: true, record: result.record });
    } else {
      res.status(result.status || 400).json({ error: result.error });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    mongo: isMongoConnected ? 'connected' : 'in-memory-fallback',
    time: new Date()
  });
});

// Socket.io connection handler
io.on('connection', (socket) => {
  console.log('⚡ Client connected via WebSocket:', socket.id);
  socket.on('disconnect', () => {
    console.log('⚡ Client disconnected:', socket.id);
  });
});

// Start Server
server.listen(PORT, () => {
  console.log(`🚀 TrustBox Backend running on http://localhost:${PORT}`);
  console.log(`   - Verify endpoint: http://localhost:${PORT}/api/verify/:boxId`);
  console.log(`   - Tamper endpoint: POST http://localhost:${PORT}/api/admin/tamper/:boxId/:seq`);
  console.log(`   - Claim Temp Threshold: ${CLAIM_TEMP_C}°C`);
  console.log(`   - Claim Window: ${CLAIM_WINDOW_SEC}s`);
});

