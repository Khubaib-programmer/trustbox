require('dotenv').config();
const fs = require('fs');
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
const MQTT_URL = process.env.MQTT_URL; // e.g. mqtts://xxxx.emqxsl.com:8883
const MQTT_USER = process.env.MQTT_USER;
const MQTT_PASS = process.env.MQTT_PASS;
const MQTT_CA_PATH = process.env.MQTT_CA_PATH;
const DEVICE_KEY = process.env.DEVICE_KEY || 'trustbox-super-secret-key-32ch';
const CLAIM_TEMP_C = parseFloat(process.env.CLAIM_TEMP_C) || 8.0;
const CLAIM_WINDOW_SEC = parseInt(process.env.CLAIM_WINDOW_SEC, 10) || 15;
// IoT raw topic — comma-separated list of topics or wildcards
const IOT_MQTT_TOPIC = process.env.IOT_MQTT_TOPIC || 'trustbox/raw/#';

// MQTT Runtime State & Diagnostics
let mqttClient = null;
let mqttConnected = false;
const subscribedTopics = [];
const mqttStats = {
  messages_received: 0,
  messages_accepted: 0,
  messages_rejected: 0,
  last_message_at: null,
  last_device_id: null,
  last_error: null
};
const rejectedMessages = []; // Ring buffer of last 20 rejected/invalid messages

function recordRejection(topic, reason, rawPayload) {
  mqttStats.messages_rejected++;
  const entry = {
    topic: String(topic || 'unknown'),
    reason: String(reason || 'Unknown rejection reason'),
    timestamp: new Date().toISOString(),
    payload: typeof rawPayload === 'string'
      ? rawPayload.slice(0, 200)
      : JSON.stringify(rawPayload).slice(0, 200)
  };
  rejectedMessages.unshift(entry);
  if (rejectedMessages.length > 20) {
    rejectedMessages.pop();
  }
  console.warn(`⚠️ [MQTT REJECTED] on ${topic}: ${reason}`);
}

// In-memory per-device serialization queue to prevent sequence collisions
const deviceIngestionQueues = new Map();

function enqueueDeviceIngestion(boxId, taskFn) {
  const previousPromise = deviceIngestionQueues.get(boxId) || Promise.resolve();
  const nextPromise = previousPromise
    .then(() => taskFn())
    .catch((err) => {
      console.error(`[INGESTION QUEUE ERROR] ${boxId}:`, err);
      throw err;
    });
  deviceIngestionQueues.set(boxId, nextPromise);
  nextPromise.finally(() => {
    if (deviceIngestionQueues.get(boxId) === nextPromise) {
      deviceIngestionQueues.delete(boxId);
    }
  });
  return nextPromise;
}

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

function normalizeBool(v) {
  if (v === true || v === 1 || v === '1' || v === 'true') return 1;
  return 0;
}

function findFirstNumber(obj, keys) {
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null && obj[k] !== '') {
      const num = Number(obj[k]);
      if (Number.isFinite(num)) {
        return num;
      }
    }
  }
  return null;
}

/**
 * Maps raw IoT device payload → TrustBox internal schema.
 * Tolerant of field variants, validates physical ranges (-40 to 125 C, 0 to 100 % humidity),
 * extracts device_id with topic fallback, and prioritizes breach/alarm events.
 */
function adaptIoTPayload(raw, topic = '') {
  if (!raw || typeof raw !== 'object') {
    return { valid: false, reason: 'Payload must be a non-empty object.' };
  }

  // 1. Device ID extraction with topic fallback (trustbox/raw/TB-DEMO-01 -> TB-DEMO-01)
  let deviceId = raw.device_id || raw.box_id || raw.boxId;
  if (!deviceId && topic) {
    const segments = String(topic).split('/').filter(Boolean);
    const lastSeg = segments[segments.length - 1];
    if (lastSeg && lastSeg !== '#' && lastSeg !== '+') {
      deviceId = lastSeg;
    }
  }
  if (!deviceId || typeof deviceId !== 'string' || !deviceId.trim()) {
    return { valid: false, reason: 'Field "device_id" missing and could not be determined from topic.' };
  }
  deviceId = String(deviceId).trim();

  // 2. Temperature resolution & validation (-40 to 125 C)
  // Priority: temperature_ds18b20_c, temperature_dht_c, temperature_c, temperature, temp_c, temp
  const tempKeys = ['temperature_ds18b20_c', 'temperature_dht_c', 'temperature_c', 'temperature', 'temp_c', 'temp'];
  const rawTemp = findFirstNumber(raw, tempKeys);
  if (rawTemp === null || rawTemp < -40 || rawTemp > 125) {
    return {
      valid: false,
      reason: `Invalid temperature value: ${rawTemp} (must be a finite number between -40°C and 125°C)`
    };
  }
  const temp_c = parseFloat(rawTemp.toFixed(1));

  // 3. Humidity resolution & validation (0 to 100 %)
  // Priority: humidity_pct, humidity
  const humKeys = ['humidity_pct', 'humidity'];
  const rawHum = findFirstNumber(raw, humKeys);
  if (rawHum === null || rawHum < 0 || rawHum > 100) {
    return {
      valid: false,
      reason: `Invalid humidity value: ${rawHum} (must be a finite number between 0% and 100%)`
    };
  }
  const humidity = parseFloat(rawHum.toFixed(1));

  // 4. Sensor Flags & Booleans normalization (supports true/false, 1/0, "true"/"false", "1"/"0")
  const shock = normalizeBool(raw.shock);
  const tilt = normalizeBool(raw.tilt);
  const ball_switch = normalizeBool(raw.ball_switch);
  const flipped = (normalizeBool(raw.flipped) === 1 || (tilt === 1 && ball_switch === 1)) ? 1 : 0;
  
  // lid_open: reed_triggered or lid_open
  const lid_open = (raw.reed_triggered !== undefined) 
    ? normalizeBool(raw.reed_triggered) 
    : normalizeBool(raw.lid_open);

  // light: photo_raw or light
  const rawLight = findFirstNumber(raw, ['photo_raw', 'light']);
  const light = rawLight !== null ? Math.max(0, Math.round(rawLight)) : 0;

  // 5. Event derivation priority:
  // breach -> TEMP_BREACH, shock -> DROP, tilt or ball_switch -> FLIPPED, reed_triggered -> LID_OPEN, otherwise NONE
  let event = 'NONE';
  if (normalizeBool(raw.breach) === 1) {
    event = 'TEMP_BREACH';
  } else if (shock === 1) {
    event = 'DROP';
  } else if (tilt === 1 || ball_switch === 1 || flipped === 1) {
    event = 'FLIPPED';
  } else if (lid_open === 1) {
    event = 'LID_OPEN';
  }

  const boxId = String(raw.device_id || raw.box_id || 'ESP32-BOX').trim();

  return {
    valid: true,
    data: {
      box_id: deviceId,
      ts: Math.floor(Date.now() / 1000), // server timestamp in seconds
      temp_c,
      humidity,
      shock,
      tilt,
      flipped,
      light,
      lid_open,
      event
    }
  };
}

/**
 * Server-side chain computation + ingestion for raw IoT payloads.
 * Serialized per device_id using an in-memory queue to prevent duplicate sequence creation.
 */
const { signRecord, buildCanonicalString, computeHash, computeSignature } = require('./chain');

async function ingestIoTRecord(rawIoT, source = 'IOT-MQTT', topic = '') {
  const adaptResult = adaptIoTPayload(rawIoT, topic);
  if (!adaptResult.valid) {
    recordRejection(topic || source, adaptResult.reason, rawIoT);
    return { success: false, status: 400, error: adaptResult.reason };
  }

  const adapted = adaptResult.data;
  const boxId = adapted.box_id;

  // Enqueue per boxId to serialize hash-chain calculation
  return enqueueDeviceIngestion(boxId, async () => {
    // Get latest chain state to determine next seq + prev_hash
    const latest = await getLatestBoxRecord(boxId);
    const seq = latest ? latest.seq + 1 : 0;
    const prev_hash = latest ? latest.hash : GENESIS_PREV_HASH;

    // Assemble full record
    const rawRecord = { ...adapted, seq, prev_hash };

    // Compute hash + HMAC signature server-side
    const signed = signRecord(rawRecord, DEVICE_KEY);

    // Pass through the normal ingestion pipeline
    const result = await handleIncomingRecord(signed, source);
    if (result.success) {
      mqttStats.messages_accepted++;
      mqttStats.last_device_id = boxId;
      console.log(`[IOT ${source}] ${boxId} #${seq} | Temp: ${signed.temp_c}°C | Event: ${signed.event}`);
    } else {
      recordRejection(topic || source, result.error, rawIoT);
    }
    return result;
  });
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

    // 7. Publish decision response back to MQTT (for ESP32 / EMQX)
    if (globalMqttClient && globalMqttClient.connected) {
      const isBreached = record.event && record.event !== 'NONE';
      const decisionPayload = {
        box_id: boxId,
        seq: record.seq,
        delivery_decision: isBreached ? "NOT DELIVERED" : "DELIVERED",
        risk_level: isBreached ? "HIGH_RISK" : "SAFE",
        event: record.event,
        temp_c: record.temp_c,
        humidity: record.humidity,
        shock: record.shock,
        timestamp: record.ts
      };
      globalMqttClient.publish(`trustbox/${boxId}/decision`, JSON.stringify(decisionPayload));
    }

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
// MQTT CLIENT SETUP (EMQX Cloud / TLS)
// ==========================================
if (MQTT_URL) {
  let brokerHost = 'unknown';
  try {
    brokerHost = new URL(MQTT_URL).hostname;
  } catch {
    brokerHost = MQTT_URL.split('://')[1]?.split(':')[0] || 'unknown';
  }

  const connectOptions = {
    username: MQTT_USER,
    password: MQTT_PASS,
    clientId: 'trustbox-backend-' + Math.random().toString(16).substring(2, 10),
    clean: true,
    reconnectPeriod: 3000,
    connectTimeout: 10000,
    keepalive: 30,
    protocolVersion: 4,
    rejectUnauthorized: true
  };

  if (MQTT_CA_PATH) {
    try {
      connectOptions.ca = fs.readFileSync(MQTT_CA_PATH);
      console.log(`🔒 Loaded EMQX CA certificate from: ${MQTT_CA_PATH}`);
    } catch (err) {
      console.error(`⚠️ Failed reading MQTT_CA_PATH at "${MQTT_CA_PATH}":`, err.message);
    }
  }

  console.log(`📡 Connecting to EMQX Cloud / MQTT broker: ${brokerHost} (TLS 8883)...`);
  mqttClient = mqtt.connect(MQTT_URL, connectOptions);

  // Parse comma-separated raw topics and merge with system topics
  const rawTopicList = (process.env.IOT_MQTT_TOPIC || 'trustbox/raw/#')
    .split(',')
    .map((t) => {
      let trimmed = t.trim();
      // Guard against dotenv comment-stripping on unquoted '#'
      if (trimmed === 'trustbox/raw/' || trimmed === 'trustbox/raw') {
        trimmed = 'trustbox/raw/#';
      }
      return trimmed;
    })
    .filter(Boolean);

  const topicsToSubscribe = Array.from(new Set([
    'trustbox/+/telemetry',
    'trustbox/+/event',
    ...rawTopicList
  ]));

  mqttClient.on('connect', () => {
    mqttConnected = true;
    mqttStats.last_error = null;
    console.log(`✅ Connected to EMQX Cloud MQTT broker (${brokerHost}) via TLS!`);
    io.emit('mqtt_status', { connected: true, last_message_at: mqttStats.last_message_at });

    subscribedTopics.length = 0;
    topicsToSubscribe.forEach((t) => subscribedTopics.push(t));

    // Re-subscribe to all topics on every connect/reconnect with QoS 1
    topicsToSubscribe.forEach((topic) => {
      mqttClient.subscribe(topic, { qos: 1 }, (err, granted) => {
        if (err) {
          console.error(`⚠️ Subscription to "${topic}" failed:`, err.message);
        } else if (granted && granted.length > 0) {
          granted.forEach((g) => {
            if (g.qos >= 128) {
              console.warn(`⚠️ Subscription denied for "${g.topic}" (QoS code ${g.qos})`);
            } else {
              console.log(`✅ Subscribed to ${g.topic} (QoS ${g.qos})`);
            }
          });
        }
      });
    });
  });

  mqttClient.on('reconnect', () => {
    console.log(`🔄 Reconnecting to EMQX Cloud broker (${brokerHost})...`);
  });

  mqttClient.on('offline', () => {
    mqttConnected = false;
    console.log('📡 MQTT client went offline.');
    io.emit('mqtt_status', { connected: false, last_message_at: mqttStats.last_message_at });
  });

  mqttClient.on('close', () => {
    mqttConnected = false;
  });

  mqttClient.on('error', (err) => {
    mqttConnected = false;
    mqttStats.last_error = `${err.message}${err.code ? ` (${err.code})` : ''}`;
    console.error('⚠️ MQTT Broker Error:', err.message, err.code ? `[Code: ${err.code}]` : '');
    io.emit('mqtt_status', { connected: false, last_message_at: mqttStats.last_message_at });
  });

  mqttClient.on('message', async (topic, message) => {
    mqttStats.messages_received++;
    mqttStats.last_message_at = new Date().toISOString();

    let payload;
    try {
      payload = JSON.parse(message.toString());
    } catch (e) {
      const preview = message.toString().slice(0, 120);
      console.error(`[MQTT ERROR] Invalid JSON on ${topic}:`, preview);
      recordRejection(topic, 'Invalid JSON: ' + e.message, preview);
      return;
    }

    // If device_id is missing on a raw topic, derive it from the last segment of the topic
    if (!payload.device_id && payload.hash === undefined) {
      const segments = topic.split('/').filter(Boolean);
      const last = segments[segments.length - 1];
      if (last && last !== '#' && last !== '+') {
        payload.device_id = last;
      }
    }

    // Route: raw IoT payload has device_id but no hash/sig/seq
    const isRawIoT = payload.device_id !== undefined && payload.hash === undefined;

    if (isRawIoT) {
      await ingestIoTRecord(payload, 'IOT-MQTT', topic);
    } else {
      const res = await handleIncomingRecord(payload, 'MQTT');
      if (res.success) {
        mqttStats.messages_accepted++;
        mqttStats.last_device_id = payload.box_id || payload.device_id;
      } else {
        recordRejection(topic, res.error, payload);
      }
    }
  });

  // Emit mqtt_status every 5 seconds for connected clients
  setInterval(() => {
    io.emit('mqtt_status', {
      connected: mqttConnected,
      last_message_at: mqttStats.last_message_at
    });
  }, 5000);
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

// =========================================================
// MQTT DIAGNOSTIC & MONITORING ENDPOINTS
// =========================================================

// GET /api/mqtt/status -> Real-time broker connection & telemetry metrics
app.get('/api/mqtt/status', (req, res) => {
  let brokerHost = null;
  if (MQTT_URL) {
    try {
      brokerHost = new URL(MQTT_URL).hostname;
    } catch {
      brokerHost = MQTT_URL.split('://')[1]?.split(':')[0] || null;
    }
  }
  res.json({
    enabled: Boolean(MQTT_URL),
    connected: mqttConnected,
    broker_host: brokerHost,
    subscribed_topics: subscribedTopics,
    messages_received: mqttStats.messages_received,
    messages_accepted: mqttStats.messages_accepted,
    messages_rejected: mqttStats.messages_rejected,
    last_message_at: mqttStats.last_message_at,
    last_device_id: mqttStats.last_device_id,
    last_error: mqttStats.last_error
  });
});

// GET /api/mqtt/rejected -> Ring buffer of last 20 rejected or invalid payloads
app.get('/api/mqtt/rejected', (req, res) => {
  res.json(rejectedMessages);
});

// Health check with database & MQTT status
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    mongo: isMongoConnected ? 'connected' : 'in-memory-fallback',
    mqtt: MQTT_URL ? (mqttConnected ? 'connected' : 'disconnected') : 'disabled',
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

