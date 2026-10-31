require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const mongoose = require('mongoose');
const mqtt = require('mqtt');
const { Record, Claim, Payout } = require('./models');
const { verifyChain } = require('./chain');
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
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/trustbox';
const MQTT_URL = process.env.MQTT_URL; // e.g. mqtts://xxxx.hivemq.cloud:8883
const MQTT_USER = process.env.MQTT_USER;
const MQTT_PASS = process.env.MQTT_PASS;
const DEVICE_KEY = process.env.DEVICE_KEY || 'trustbox-super-secret-key-32ch';
const CLAIM_TEMP_C = parseFloat(process.env.CLAIM_TEMP_C) || 8.0;
const CLAIM_WINDOW_SEC = parseInt(process.env.CLAIM_WINDOW_SEC, 10) || 15;

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
 * Handle new record ingestion (from MQTT or REST)
 */
async function handleIncomingRecord(record) {
  const boxId = record.box_id;
  const seq = parseInt(record.seq, 10);

  try {
    let savedRecord = record;

    if (isMongoConnected) {
      // Check duplicate
      const exists = await Record.findOne({ box_id: boxId, seq });
      if (exists) {
        console.log(`[INGEST] Duplicate record rejected: ${boxId} #${seq}`);
        return;
      }
      savedRecord = await Record.create(record);
    } else {
      const boxRecords = inMemoryRecords.get(boxId) || [];
      if (boxRecords.some(r => r.seq === seq)) {
        console.log(`[INGEST] Duplicate record rejected (memory): ${boxId} #${seq}`);
        return;
      }
      boxRecords.push(record);
      boxRecords.sort((a, b) => a.seq - b.seq);
      inMemoryRecords.set(boxId, boxRecords);
      savedRecord = record;
    }

    // Broadcast live over Socket.io
    io.emit('record', savedRecord);
    if (record.event && record.event !== 'NONE') {
      io.emit('event', savedRecord);
    }

    // Pass through insurance evaluation
    await insuranceEngine.processRecord(
      record,
      isMongoConnected ? Claim : null,
      isMongoConnected ? Payout : null,
      io
    );

    console.log(`[RECORD] ${boxId} #${seq} | Temp: ${record.temp_c}°C | Event: ${record.event} | Hash: ${record.hash.substring(0, 8)}...`);
  } catch (err) {
    if (err.code === 11000) {
      console.log(`[INGEST] Mongo duplicate key on ${boxId} #${seq}`);
    } else {
      console.error('[INGEST ERROR]', err);
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
    console.log(' Connected to HiveMQ / MQTT Broker!');
    mqttClient.subscribe('trustbox/+/telemetry', (err) => {
      if (!err) console.log(' Subscribed to trustbox/+/telemetry');
    });
    mqttClient.subscribe('trustbox/+/event', (err) => {
      if (!err) console.log(' Subscribed to trustbox/+/event');
    });
  });

  mqttClient.on('message', async (topic, message) => {
    try {
      const payload = JSON.parse(message.toString());
      await handleIncomingRecord(payload);
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

// 1. Direct record ingestion endpoint (for testing or direct HTTP push)
app.post('/api/records', async (req, res) => {
  const record = req.body;
  if (!record || !record.box_id || record.seq === undefined) {
    return res.status(400).json({ error: 'Invalid record format. box_id and seq are required.' });
  }
  await handleIncomingRecord(record);
  res.status(201).json({ status: 'received', box_id: record.box_id, seq: record.seq });
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

