require('dotenv').config();
const mqtt = require('mqtt');
const http = require('http');
const { GENESIS_PREV_HASH, signRecord } = require('./chain');

// Parse CLI flags
const args = process.argv.slice(2);
function getArg(flag, defaultValue) {
  const index = args.indexOf(flag);
  if (index !== -1 && index + 1 < args.length) {
    return args[index + 1];
  }
  return defaultValue;
}
const hasFlag = (flag) => args.includes(flag);

const rawBoxId = getArg('--boxId', 'TB-001');
const BOX_ID = String(rawBoxId).trim();
const rawInterval = parseInt(getArg('--interval', '1500'), 10);
const INTERVAL_MS = isNaN(rawInterval) || rawInterval < 100 ? 1500 : rawInterval;
const rawCount = parseInt(getArg('--count', '0'), 10);
const MAX_RECORDS = isNaN(rawCount) || rawCount < 0 ? 0 : rawCount;

const MODE_HEAT = hasFlag('--heat');
const MODE_DROP = hasFlag('--drop');
const MODE_FLIPPED = hasFlag('--flipped');
const MODE_LID = hasFlag('--lid');
const HTTP_MODE = hasFlag('--http');
const FRESH_MODE = hasFlag('--fresh');

const MQTT_URL = process.env.MQTT_URL;
const MQTT_USER = process.env.MQTT_USER;
const MQTT_PASS = process.env.MQTT_PASS;
const DEVICE_KEY = process.env.DEVICE_KEY || 'trustbox-super-secret-key-32ch';
const BACKEND_PORT = process.env.PORT || 4000;

let currentSeq = 0;
let currentPrevHash = GENESIS_PREV_HASH;
let recordsSentThisRun = 0;
let mqttClient = null;
let timerId = null;

// Graceful exit
process.on('SIGINT', () => {
  console.log('\n\n🛑 Simulation terminated by user (SIGINT). Exiting.');
  if (timerId) clearInterval(timerId);
  if (mqttClient) mqttClient.end();
  process.exit(0);
});

/**
 * Fetch latest known device state from backend to resume chain safely
 */
function fetchLatestDeviceState(boxId) {
  return new Promise((resolve) => {
    const req = http.request({
      hostname: 'localhost',
      port: BACKEND_PORT,
      path: `/api/devices/${encodeURIComponent(boxId)}/latest`,
      method: 'GET',
      timeout: 3000
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const data = JSON.parse(body);
          resolve(data);
        } catch {
          resolve(null);
        }
      });
    });

    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
    req.end();
  });
}

/**
 * Helper to send record via HTTP POST fallback with full response parsing
 */
function sendViaHttp(record) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(record);
    const req = http.request({
      hostname: 'localhost',
      port: BACKEND_PORT,
      path: '/api/records',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      },
      timeout: 5000
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ ok: true, status: res.statusCode, body: parsed });
          } else {
            resolve({ ok: false, status: res.statusCode, error: parsed.error || `HTTP ${res.statusCode}` });
          }
        } catch {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ ok: true, status: res.statusCode, body });
          } else {
            resolve({ ok: false, status: res.statusCode, error: `HTTP ${res.statusCode}: ${body}` });
          }
        }
      });
    });

    req.on('error', (e) => reject(e));
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout to backend')); });
    req.write(data);
    req.end();
  });
}

/**
 * Generates next valid cryptographically signed record
 */
function generateNextRecord() {
  const ts = Math.floor(Date.now() / 1000);

  // Baseline temperature: 4.5 - 5.2 C (Safe cold chain)
  // If --heat: 13.5 - 15.2 C (Triggers temperature breach claim when sustained >15s)
  let temp_c = MODE_HEAT 
    ? 13.5 + (Math.random() * 2.0)
    : 4.6 + (Math.random() * 0.8);

  let humidity = 54.0 + (Math.random() * 3.0);
  let shock = MODE_DROP ? 1 : 0;
  let tilt = MODE_FLIPPED ? 1 : 0;
  let flipped = MODE_FLIPPED ? 1 : 0;
  let light = MODE_LID ? 350 : 35;
  let lid_open = MODE_LID ? 1 : 0;

  let event = 'NONE';
  if (MODE_DROP) event = 'DROP';
  else if (MODE_HEAT) event = 'TEMP_BREACH';
  else if (MODE_FLIPPED) event = 'FLIPPED';
  else if (MODE_LID) event = 'LID_OPEN';

  const rawRecord = {
    box_id: BOX_ID,
    seq: currentSeq,
    ts,
    temp_c: parseFloat(temp_c.toFixed(1)),
    humidity: parseFloat(humidity.toFixed(1)),
    shock,
    tilt,
    flipped,
    light,
    lid_open,
    event,
    prev_hash: currentPrevHash
  };

  // Sign and hash with DEVICE_KEY (HMAC-SHA256)
  const signed = signRecord(rawRecord, DEVICE_KEY);
  return signed;
}

/**
 * Publish one record tick
 */
async function tick() {
  const record = generateNextRecord();
  const topic = (record.event !== 'NONE') 
    ? `trustbox/${BOX_ID}/event` 
    : `trustbox/${BOX_ID}/telemetry`;

  if (mqttClient && mqttClient.connected) {
    mqttClient.publish(topic, JSON.stringify(record));
    console.log(`[MQTT SENT #${record.seq}] Temp: ${record.temp_c}°C | Event: ${record.event} | Hash: ${record.hash.substring(0, 10)}... | Sig: ${record.sig.substring(0, 10)}...`);
  } else {
    try {
      const resp = await sendViaHttp(record);
      if (resp.ok) {
        console.log(`[HTTP SENT #${record.seq}] Temp: ${record.temp_c}°C | Event: ${record.event} | Hash: ${record.hash.substring(0, 10)}... | Sig: ${record.sig.substring(0, 10)}...`);
      } else if (resp.status === 409) {
        console.warn(`[DUPLICATE SEQUENCE #${record.seq}] ${resp.error}`);
        // Advance sequence state to attempt recovery on next tick
        currentSeq++;
        return;
      } else {
        console.error(`[INGEST REJECTED #${record.seq}] HTTP ${resp.status}: ${resp.error}`);
      }
    } catch (e) {
      console.error(`[SEND FAILED #${record.seq}] Ensure backend is running at http://localhost:${BACKEND_PORT}: ${e.message}`);
      return;
    }
  }

  // Update internal hash chaining state
  currentPrevHash = record.hash;
  currentSeq++;
  recordsSentThisRun++;

  if (MAX_RECORDS > 0 && recordsSentThisRun >= MAX_RECORDS) {
    console.log(`\n🎉 Reached requested count of ${MAX_RECORDS} records. Exiting.`);
    if (timerId) clearInterval(timerId);
    if (mqttClient) mqttClient.end();
    process.exit(0);
  }
}

/**
 * Initialize publisher with automatic chain resumption
 */
async function start() {
  console.log('==================================================');
  console.log('  TRUSTBOX FAKE PUBLISHER (Hardware Simulator)    ');
  console.log('==================================================');
  console.log(`Box ID:          ${BOX_ID}`);
  console.log(`Interval:        ${INTERVAL_MS}ms`);
  console.log(`Max Records:     ${MAX_RECORDS > 0 ? MAX_RECORDS : 'Continuous'}`);
  console.log(`Heat Breach:     ${MODE_HEAT ? '🔥 ENABLED (~14.5°C)' : '❌ Disabled (Safe ~4.8°C)'}`);
  console.log(`Drop Impact:     ${MODE_DROP ? '💥 ENABLED' : '❌ Disabled'}`);
  console.log(`Flipped:         ${MODE_FLIPPED ? '🙃 ENABLED' : '❌ Disabled'}`);
  console.log(`Lid Open:        ${MODE_LID ? '📦 OPEN' : '❌ Closed'}`);
  console.log(`HMAC Key:        ${DEVICE_KEY.substring(0, 8)}... (shared secret)`);
  console.log('==================================================\n');

  // Query backend to resume chain if records already exist
  console.log(`Checking existing state for device ${BOX_ID} at backend port ${BACKEND_PORT}...`);
  const state = await fetchLatestDeviceState(BOX_ID);

  if (state && state.exists) {
    if (FRESH_MODE) {
      console.error(`❌ Box "${BOX_ID}" already has ${state.latestSeq + 1} recorded entries (latest seq: #${state.latestSeq}).`);
      console.error(`   To avoid sequence collisions, specify a new box ID: --boxId TB-${Date.now().toString().slice(-4)}`);
      console.error(`   Or remove the --fresh flag to automatically continue the existing chain.`);
      process.exit(1);
    }
    currentSeq = state.nextSeq;
    currentPrevHash = state.prevHash;
    console.log(`🔗 [RESUMING CHAIN] Continuing ${BOX_ID} from seq #${currentSeq}`);
    console.log(`   Previous hash: ${currentPrevHash.substring(0, 16)}...\n`);
  } else {
    currentSeq = 0;
    currentPrevHash = GENESIS_PREV_HASH;
    console.log(`🌱 [GENESIS CHAIN] Starting new chain for ${BOX_ID} from seq #0\n`);
  }

  if (MQTT_URL && !HTTP_MODE) {
    console.log(`Connecting to MQTT Broker: ${MQTT_URL}`);
    mqttClient = mqtt.connect(MQTT_URL, {
      username: MQTT_USER,
      password: MQTT_PASS,
      rejectUnauthorized: false
    });

    mqttClient.on('connect', () => {
      console.log(' Connected to MQTT Broker! Publishing live telemetry...\n');
      tick();
      timerId = setInterval(tick, INTERVAL_MS);
    });

    mqttClient.on('error', (err) => {
      console.warn(`⚠️ MQTT Connection error (${err.message}), falling back to direct HTTP transmission.`);
      tick();
      timerId = setInterval(tick, INTERVAL_MS);
    });
  } else {
    console.log(`Transmitting directly to Backend at http://localhost:${BACKEND_PORT}/api/records`);
    tick();
    timerId = setInterval(tick, INTERVAL_MS);
  }
}

start();
