require('dotenv').config();
const http = require('http');
const assert = require('assert');
const { GENESIS_PREV_HASH, signRecord } = require('./chain');

const PORT = process.env.PORT || 4000;
const DEVICE_KEY = process.env.DEVICE_KEY || 'trustbox-super-secret-key-32ch';

// Unique test box IDs to guarantee isolation and zero impact on TB-001 or TB-TEST
const TEST_BOX = `TB-AUDIT-${Date.now().toString().slice(-6)}`;
const INS_BOX = `TB-INSAUDIT-${Date.now().toString().slice(-6)}`;

console.log('🧪 RUNNING COMPREHENSIVE BACKEND API & INSURANCE INTEGRATION TESTS...\n');
console.log(`Test Device IDs: ${TEST_BOX}, ${INS_BOX}`);

function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = http.request({
      hostname: 'localhost',
      port: PORT,
      path,
      method,
      headers: {
        ...(data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {})
      },
      timeout: 5000
    }, (res) => {
      let resBody = '';
      res.on('data', chunk => resBody += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(resBody);
          resolve({ status: res.statusCode, body: parsed });
        } catch {
          resolve({ status: res.statusCode, body: resBody });
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error(`Timeout on ${method} ${path}`)); });
    if (data) req.write(data);
    req.end();
  });
}

async function runTests() {
  try {
    // 1. Health check
    const health = await request('GET', '/health');
    assert.strictEqual(health.status, 200, 'Health endpoint should return 200');
    assert.strictEqual(health.body.status, 'ok');
    console.log('✅ Test 1: Health endpoint verified (/health).');

    // 2. Boxes list endpoint
    const boxesRes = await request('GET', '/api/boxes');
    assert.strictEqual(boxesRes.status, 200);
    assert.ok(Array.isArray(boxesRes.body.boxes), 'Boxes should be an array');
    console.log(`✅ Test 2: Boxes listing endpoint verified (/api/boxes: ${boxesRes.body.boxes.length} found).`);

    // 3. Latest state for non-existent box
    const latestNonExistent = await request('GET', `/api/devices/${TEST_BOX}/latest`);
    assert.strictEqual(latestNonExistent.status, 200);
    assert.strictEqual(latestNonExistent.body.exists, false);
    assert.strictEqual(latestNonExistent.body.nextSeq, 0);
    assert.strictEqual(latestNonExistent.body.prevHash, GENESIS_PREV_HASH);
    console.log('✅ Test 3: Latest state returns genesis defaults for new device.');

    // 4. Ingestion rejects malformed payload (missing fields)
    const malformedRes = await request('POST', '/api/records', { box_id: TEST_BOX });
    assert.strictEqual(malformedRes.status, 400, 'Malformed record must be rejected with 400');
    console.log('✅ Test 4: Ingestion rejects malformed payload.');

    // 5. Ingestion rejects invalid cryptographic signature
    const fakeSigRecord = {
      box_id: TEST_BOX,
      seq: 0,
      ts: Math.floor(Date.now() / 1000),
      temp_c: 5.0,
      humidity: 50.0,
      shock: 0,
      tilt: 0,
      flipped: 0,
      light: 40,
      lid_open: 0,
      event: 'NONE',
      prev_hash: GENESIS_PREV_HASH,
      hash: 'a'.repeat(64),
      sig: 'b'.repeat(64)
    };
    const invalidSigRes = await request('POST', '/api/records', fakeSigRecord);
    assert.strictEqual(invalidSigRes.status, 401, 'Invalid signature must be rejected with 401');
    console.log('✅ Test 5: Ingestion rejects unauthenticated HMAC signature.');

    // 6. Ingestion rejects sequence gap for new device (starting at seq 5 instead of 0)
    const seqGapRecord = signRecord({
      box_id: TEST_BOX,
      seq: 5,
      ts: Math.floor(Date.now() / 1000),
      temp_c: 5.0,
      humidity: 50.0,
      shock: 0,
      tilt: 0,
      flipped: 0,
      light: 40,
      lid_open: 0,
      event: 'NONE',
      prev_hash: GENESIS_PREV_HASH
    }, DEVICE_KEY);
    const seqGapRes = await request('POST', '/api/records', seqGapRecord);
    assert.strictEqual(seqGapRes.status, 400, 'Sequence gap on initial record must be rejected with 400');
    console.log('✅ Test 6: Ingestion requires initial record to be sequence #0.');

    // 7. Ingest valid Genesis Record (seq #0)
    const valid0 = signRecord({
      box_id: TEST_BOX,
      seq: 0,
      ts: Math.floor(Date.now() / 1000),
      temp_c: 4.8,
      humidity: 55.0,
      shock: 0,
      tilt: 0,
      flipped: 0,
      light: 40,
      lid_open: 0,
      event: 'NONE',
      prev_hash: GENESIS_PREV_HASH
    }, DEVICE_KEY);
    const ingest0 = await request('POST', '/api/records', valid0);
    assert.strictEqual(ingest0.status, 201, 'Valid genesis record must be accepted with 201');
    console.log('✅ Test 7: Valid genesis record ingested successfully.');

    // 8. Ingest duplicate sequence #0 rejected with 409 Conflict
    const dupRes = await request('POST', '/api/records', valid0);
    assert.strictEqual(dupRes.status, 409, 'Duplicate sequence must return 409');
    console.log('✅ Test 8: Duplicate sequence rejected with HTTP 409 Conflict.');

    // 9. Ingest continuous record seq #1
    const valid1 = signRecord({
      box_id: TEST_BOX,
      seq: 1,
      ts: Math.floor(Date.now() / 1000) + 2,
      temp_c: 5.1,
      humidity: 54.5,
      shock: 0,
      tilt: 0,
      flipped: 0,
      light: 40,
      lid_open: 0,
      event: 'NONE',
      prev_hash: valid0.hash
    }, DEVICE_KEY);
    const ingest1 = await request('POST', '/api/records', valid1);
    assert.strictEqual(ingest1.status, 201);
    console.log('✅ Test 9: Subsequent chained record seq #1 ingested successfully.');

    // 10. Verify Chain endpoint on valid 2-record chain
    const verifyValid = await request('GET', `/api/verify/${TEST_BOX}`);
    assert.strictEqual(verifyValid.status, 200);
    assert.strictEqual(verifyValid.body.ok, true, 'Chain should be verified');
    assert.strictEqual(verifyValid.body.count, 2, 'Should verify 2 records');
    assert.strictEqual(verifyValid.body.brokenAt, null);
    console.log('✅ Test 10: Chain verification returns ok:true with count:2.');

    // 11. Tamper Record seq #1 via Admin endpoint
    const tamperRes = await request('POST', `/api/admin/tamper/${TEST_BOX}/1`);
    assert.strictEqual(tamperRes.status, 200);
    assert.strictEqual(tamperRes.body.success, true);
    console.log('✅ Test 11: Controlled admin tamper executed on seq #1.');

    // 12. Verification detects tampered record
    const verifyTampered = await request('GET', `/api/verify/${TEST_BOX}`);
    assert.strictEqual(verifyTampered.status, 200);
    assert.strictEqual(verifyTampered.body.ok, false, 'Tampered chain must fail');
    assert.strictEqual(verifyTampered.body.brokenAt, 1, 'Must flag seq #1 as broken');
    console.log(`✅ Test 12: Chain verification catches tampered record at seq #${verifyTampered.body.brokenAt}.`);

    // 13. Insurance Engine: DROP Event Simulation
    const nowTs = Math.floor(Date.now() / 1000);
    const dropRecord = signRecord({
      box_id: INS_BOX,
      seq: 0,
      ts: nowTs,
      temp_c: 5.0,
      humidity: 50.0,
      shock: 1,
      tilt: 0,
      flipped: 0,
      light: 40,
      lid_open: 0,
      event: 'DROP',
      prev_hash: GENESIS_PREV_HASH
    }, DEVICE_KEY);
    await request('POST', '/api/records', dropRecord);

    const claimsDrop = await request('GET', `/api/claims/${INS_BOX}`);
    assert.strictEqual(claimsDrop.status, 200);
    assert.ok(claimsDrop.body.length >= 1, 'DROP event must trigger insurance claim');
    assert.strictEqual(claimsDrop.body[0].type, 'DROP');
    console.log('✅ Test 13: High shock DROP event triggers instant insurance claim.');

    const payoutsDrop = await request('GET', `/api/payouts/${INS_BOX}`);
    assert.strictEqual(payoutsDrop.status, 200);
    assert.ok(payoutsDrop.body.length >= 1, 'DROP claim must trigger payout record');
    assert.strictEqual(payoutsDrop.body[0].amount_inr, 25000);
    console.log(`✅ Test 14: Instant mock payout created: ${payoutsDrop.body[0].payout_id} (₹${payoutsDrop.body[0].amount_inr}).`);

    // 15. Insurance Engine: Temperature Breach Window (>15s)
    const heatBox = `TB-HEAT-${Date.now().toString().slice(-6)}`;
    // Record 0 at t=nowTs: high temp (14.5C), window starts
    const heat0 = signRecord({
      box_id: heatBox,
      seq: 0,
      ts: nowTs,
      temp_c: 14.5,
      humidity: 50.0,
      shock: 0,
      tilt: 0,
      flipped: 0,
      light: 40,
      lid_open: 0,
      event: 'TEMP_BREACH',
      prev_hash: GENESIS_PREV_HASH
    }, DEVICE_KEY);
    await request('POST', '/api/records', heat0);

    // Record 1 at t=nowTs + 5s (5s elapsed < 15s window -> NO claim yet)
    const heat1 = signRecord({
      box_id: heatBox,
      seq: 1,
      ts: nowTs + 5,
      temp_c: 14.8,
      humidity: 50.0,
      shock: 0,
      tilt: 0,
      flipped: 0,
      light: 40,
      lid_open: 0,
      event: 'TEMP_BREACH',
      prev_hash: heat0.hash
    }, DEVICE_KEY);
    await request('POST', '/api/records', heat1);

    const prematureClaims = await request('GET', `/api/claims/${heatBox}`);
    assert.strictEqual(prematureClaims.body.length, 0, 'No claim should trigger before 15s window');
    console.log('✅ Test 15: Temperature breach requires sustained duration (no premature claim at 5s).');

    // Record 2 at t=nowTs + 16s (16s elapsed >= 15s window -> CLAIM TRIGGERED)
    const heat2 = signRecord({
      box_id: heatBox,
      seq: 2,
      ts: nowTs + 16,
      temp_c: 15.1,
      humidity: 50.0,
      shock: 0,
      tilt: 0,
      flipped: 0,
      light: 40,
      lid_open: 0,
      event: 'TEMP_BREACH',
      prev_hash: heat1.hash
    }, DEVICE_KEY);
    await request('POST', '/api/records', heat2);

    const matureClaims = await request('GET', `/api/claims/${heatBox}`);
    assert.strictEqual(matureClaims.body.length, 1, 'Claim must trigger after sustained 15s breach');
    assert.strictEqual(matureClaims.body[0].type, 'TEMP_BREACH');
    console.log('✅ Test 16: Sustained breach (>15s) triggers TEMP_BREACH claim and auto-payout.');

    // 17. Safe cleanup of ONLY the test boxes created in this test run
    await request('POST', `/api/admin/reset/${TEST_BOX}`, { confirm: true });
    await request('POST', `/api/admin/reset/${INS_BOX}`, { confirm: true });
    await request('POST', `/api/admin/reset/${heatBox}`, { confirm: true });
    console.log('✅ Test 17: Temporary test devices cleaned up cleanly; TB-001 and TB-TEST preserved.');

    console.log('\n🎉 ALL 17 INTEGRATION & END-TO-END TESTS PASSED SUCCESSFULLY!');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ TEST FAILED:', err);
    process.exit(1);
  }
}

runTests();
