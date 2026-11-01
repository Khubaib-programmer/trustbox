/**
 * TrustBox EMQX Cloud Integration Test
 *
 * Connects to the EMQX broker specified in .env, publishes 5 raw IoT telemetry
 * payloads to `trustbox/raw/TB-DEMO-01`, and audits the backend API and
 * cryptographic chain verification status.
 */

require('dotenv').config();
const fs = require('fs');
const http = require('http');
const mqtt = require('mqtt');

const MQTT_URL = process.env.MQTT_URL;
const MQTT_USER = process.env.MQTT_USER;
const MQTT_PASS = process.env.MQTT_PASS;
const MQTT_CA_PATH = process.env.MQTT_CA_PATH;
const BACKEND_PORT = process.env.PORT || 4000;
const DEVICE_ID = 'TB-DEMO-01';
const TOPIC = `trustbox/raw/${DEVICE_ID}`;

function fetchJson(path) {
  return new Promise((resolve, reject) => {
    const req = http.get({
      hostname: 'localhost',
      port: BACKEND_PORT,
      path,
      timeout: 5000
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Timeout fetching ${path}`));
    });
  });
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function run() {
  console.log('====================================================');
  console.log('  🧪 TRUSTBOX EMQX CLOUD INTEGRATION TEST SUITE      ');
  console.log('====================================================\n');

  if (!MQTT_URL) {
    console.error('❌ FAIL: MQTT_URL is not configured in backend/.env.');
    console.error('   Please set MQTT_URL (e.g. mqtts://<host>.emqxsl.com:8883) to run this test.');
    process.exit(1);
  }

  let results = {
    connection: false,
    recordsStored: false,
    chainVerified: false
  };

  // 1. Check if backend is alive
  console.log(`Checking backend API on http://localhost:${BACKEND_PORT}...`);
  let initialSeq = -1;
  try {
    const health = await fetchJson('/health');
    if (health.status !== 200) {
      console.error(`❌ Backend returned status ${health.status} on /health. Ensure server is running.`);
      process.exit(1);
    }
    // Use /api/verify to get the total record count — avoids the default limit=100 cap
    const verifyBefore = await fetchJson(`/api/verify/${DEVICE_ID}`);
    if (verifyBefore.body && typeof verifyBefore.body.count === 'number') {
      initialSeq = verifyBefore.body.count; // total records stored so far
    }
    console.log(`✅ Backend is online. Current record count for ${DEVICE_ID}: ${initialSeq}\n`);
  } catch (err) {
    console.error(`❌ Cannot connect to backend on port ${BACKEND_PORT}: ${err.message}`);
    console.error('   Please start the backend with `npm run dev` before running this test.');
    process.exit(1);
  }

  // 2. Connect to EMQX
  console.log(`Connecting to EMQX Broker: ${MQTT_URL}...`);
  const connectOptions = {
    username: MQTT_USER,
    password: MQTT_PASS,
    clientId: 'trustbox-test-runner-' + Math.random().toString(16).substring(2, 8),
    clean: true,
    connectTimeout: 10000,
    keepalive: 30,
    protocolVersion: 4,
    rejectUnauthorized: true
  };

  if (MQTT_CA_PATH) {
    try {
      connectOptions.ca = fs.readFileSync(MQTT_CA_PATH);
      console.log(`   Loaded CA certificate from: ${MQTT_CA_PATH}`);
    } catch (err) {
      console.warn(`   ⚠️ Warning: Failed reading MQTT_CA_PATH (${err.message})`);
    }
  }

  const client = mqtt.connect(MQTT_URL, connectOptions);

  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      client.end();
      reject(new Error('Connection to EMQX broker timed out after 10s.'));
    }, 10000);

    client.on('connect', () => {
      clearTimeout(timer);
      results.connection = true;
      console.log('✅ Connection to EMQX succeeded!\n');
      resolve();
    });

    client.on('error', (err) => {
      clearTimeout(timer);
      client.end();
      reject(err);
    });
  }).catch((err) => {
    console.error(`❌ Connection to EMQX failed: ${err.message}`);
    process.exit(1);
  });

  // 3. Publish 5 raw payloads 2 seconds apart
  // First 3: Safe readings (~4.8 C)
  // Last 2: Hot readings (~14.2 C)
  console.log(`Publishing 5 raw IoT payloads to "${TOPIC}" (2s intervals)...`);
  for (let i = 1; i <= 5; i++) {
    const isHot = i > 3;
    const temp = isHot ? (14.0 + (Math.random() * 0.5)) : (4.7 + (Math.random() * 0.3));
    const payload = {
      device_id: DEVICE_ID,
      uptime_ms: 100000 + (i * 2000),
      temperature_ds18b20_c: parseFloat(temp.toFixed(1)),
      temperature_dht_c: parseFloat((temp - 0.1).toFixed(1)),
      humidity_pct: 54.0,
      photo_raw: 35,
      light_inside: false,
      shock: false,
      tilt: false,
      ball_switch: false,
      reed_triggered: false,
      delivery_button: false,
      breach: isHot
    };

    client.publish(TOPIC, JSON.stringify(payload), { qos: 1 });
    console.log(`   [${i}/5] Published reading: ${payload.temperature_ds18b20_c}°C (breach: ${payload.breach})`);
    if (i < 5) await delay(2000);
  }

  client.end();
  console.log('\nAll 5 payloads published. Waiting 2.5s for backend chain computation and database persistence...');
  await delay(2500);

  // 4. Poll and verify backend
  try {
    const verifyResp = await fetchJson(`/api/verify/${DEVICE_ID}`);
    const newCount = verifyResp.body && typeof verifyResp.body.count === 'number' ? verifyResp.body.count : 0;
    console.log(`Updated record count for ${DEVICE_ID}: ${newCount} (was ${initialSeq})`);

    if (newCount >= initialSeq + 5) {
      results.recordsStored = true;
    } else {
      console.warn(`⚠️ Warning: Expected at least ${initialSeq + 5} total records, found ${newCount}.`);
    }

    if (verifyResp.body && verifyResp.body.ok === true) {
      results.chainVerified = true;
    } else {
      console.warn(`⚠️ Verification failed:`, verifyResp.body);
    }
  } catch (err) {
    console.error('Error polling backend verification:', err.message);
  }

  // 5. Final Report
  console.log('\n====================================================');
  console.log('  TEST SUMMARY REPORT');
  console.log('====================================================');
  console.log(`  a) EMQX Connection:     ${results.connection ? 'PASS ✅' : 'FAIL ❌'}`);
  console.log(`  b) Records Stored:      ${results.recordsStored ? 'PASS ✅' : 'FAIL ❌'}`);
  console.log(`  c) Chain Verification:  ${results.chainVerified ? 'PASS ✅' : 'FAIL ❌'}`);
  console.log('====================================================\n');

  const allPass = results.connection && results.recordsStored && results.chainVerified;
  if (allPass) {
    console.log('🎉 ALL EMQX INTEGRATION CHECKS PASSED!\n');
    process.exit(0);
  } else {
    console.error('❌ ONE OR MORE CHECKS FAILED.\n');
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
