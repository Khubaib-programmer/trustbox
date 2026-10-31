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

const BOX_ID = getArg('--boxId', 'TB-001');
const INTERVAL_MS = parseInt(getArg('--interval', '1500'), 10);
const MAX_RECORDS = parseInt(getArg('--count', '0'), 10); // 0 = continuous
const MODE_HEAT = hasFlag('--heat');
const MODE_DROP = hasFlag('--drop');
const MODE_FLIPPED = hasFlag('--flipped');
const MODE_LID = hasFlag('--lid');
const HTTP_MODE = hasFlag('--http');

const MQTT_URL = process.env.MQTT_URL;
const MQTT_USER = process.env.MQTT_USER;
const MQTT_PASS = process.env.MQTT_PASS;
const DEVICE_KEY = process.env.DEVICE_KEY || 'trustbox-super-secret-key-32ch';
const BACKEND_PORT = process.env.PORT || 4000;

console.log('==================================================');
console.log('  TRUSTBOX FAKE PUBLISHER (Hardware Simulator)    ');
console.log('==================================================');
console.log(`Box ID:          ${BOX_ID}`);
console.log(`Interval:        ${INTERVAL_MS}ms`);
console.log(`Heat Breach:     ${MODE_HEAT ? '🔥 ENABLED (14.2°C)' : '❌ Disabled (Safe ~4.8°C)'}`);
console.log(`Drop Impact:     ${MODE_DROP ? '💥 ENABLED' : '❌ Disabled'}`);
console.log(`Flipped:         ${MODE_FLIPPED ? '🙃 ENABLED' : '❌ Disabled'}`);
console.log(`Lid Open:        ${MODE_LID ? '📦 OPEN' : '❌ Closed'}`);
console.log(`Crypto Key:      ${DEVICE_KEY.substring(0, 8)}...`);
console.log('==================================================\n');

let currentSeq = 0;
let currentPrevHash = GENESIS_PREV_HASH;
let mqttClient = null;

// Helper to send record via HTTP POST fallback
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
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve(body));
    });

    req.on('error', (e) => reject(e));
    req.write(data);
    req.end();
  });
}

// Generates next valid signed record
function generateNextRecord() {
  const ts = Math.floor(Date.now() / 1000);

  // Baseline temperature: 4.5 - 5.2 C (Safe cold chain)
  // If --heat: 13.5 - 15.0 C (Triggers temperature breach claim)
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

  // Sign and hash with DEVICE_KEY
  const signed = signRecord(rawRecord, DEVICE_KEY);
  return signed;
}

// Publish tick
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
      await sendViaHttp(record);
      console.log(`[HTTP SENT #${record.seq}] Temp: ${record.temp_c}°C | Event: ${record.event} | Hash: ${record.hash.substring(0, 10)}... | Sig: ${record.sig.substring(0, 10)}...`);
    } catch (e) {
      console.error(`[SEND FAILED #${record.seq}] Ensure backend is running: ${e.message}`);
    }
  }

  // Update hash chaining state
  currentPrevHash = record.hash;
  currentSeq++;

  if (MAX_RECORDS > 0 && currentSeq >= MAX_RECORDS) {
    console.log(`\n Reached requested count of ${MAX_RECORDS} records. Exiting.`);
    process.exit(0);
  }
}

// Start simulation
async function start() {
  if (MQTT_URL && !HTTP_MODE) {
    console.log(`Connecting to MQTT Broker: ${MQTT_URL}`);
    mqttClient = mqtt.connect(MQTT_URL, {
      username: MQTT_USER,
      password: MQTT_PASS,
      rejectUnauthorized: false
    });

    mqttClient.on('connect', () => {
      console.log(' Connected to MQTT Broker! Publishing live telemetry...\n');
      setInterval(tick, INTERVAL_MS);
      tick();
    });

    mqttClient.on('error', (err) => {
      console.warn('⚠️ MQTT Connection failed, falling back to direct HTTP backend transmission.');
      setInterval(tick, INTERVAL_MS);
      tick();
    });
  } else {
    console.log(`Transmitting directly to Backend at http://localhost:${BACKEND_PORT}/api/records`);
    setInterval(tick, INTERVAL_MS);
    tick();
  }
}

start();

