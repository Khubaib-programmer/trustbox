const assert = require('assert');
const { 
  GENESIS_PREV_HASH, 
  buildCanonicalString, 
  computeHash, 
  computeSignature, 
  signRecord, 
  verifyChain 
} = require('./chain');

const TEST_KEY = 'trustbox-test-secret-key-12345';

console.log('🧪 RUNNING CRYPTOGRAPHIC HASH CHAIN & HMAC TESTS...\n');

// Test 1: Canonical String Formatting
const testRecord0 = {
  box_id: 'TB-001',
  seq: 0,
  ts: 1730380000,
  temp_c: 4.5,
  humidity: 55.0,
  shock: 0,
  tilt: 0,
  flipped: 0,
  light: 45,
  lid_open: 0,
  event: 'NONE',
  prev_hash: GENESIS_PREV_HASH
};

const canonical = buildCanonicalString(testRecord0);
const expectedCanonical = `TB-001|0|1730380000|4.5|55.0|0|0|0|45|0|NONE|${GENESIS_PREV_HASH}`;
assert.strictEqual(canonical, expectedCanonical, 'Canonical string mismatch!');
console.log(' Test 1: Canonical string formatting verified.');

// Test 2: Genesis Hash & HMAC
const signed0 = signRecord(testRecord0, TEST_KEY);
assert.strictEqual(signed0.hash.length, 64, 'Hash must be 64-char hex');
assert.strictEqual(signed0.sig.length, 64, 'Sig must be 64-char hex');
console.log(' Test 2: SHA256 and HMAC-SHA256 signatures generated.');

// Test 3: Multi-record valid chain
const chain = [signed0];
for (let i = 1; i <= 5; i++) {
  const prev = chain[i - 1];
  const rec = {
    box_id: 'TB-001',
    seq: i,
    ts: 1730380000 + (i * 2),
    temp_c: 4.8 + (i * 0.1),
    humidity: 54.2,
    shock: 0,
    tilt: 0,
    flipped: 0,
    light: 50,
    lid_open: 0,
    event: 'NONE',
    prev_hash: prev.hash
  };
  chain.push(signRecord(rec, TEST_KEY));
}

const verifyResultValid = verifyChain(chain, TEST_KEY);
assert.strictEqual(verifyResultValid.ok, true, 'Valid chain should pass verification');
assert.strictEqual(verifyResultValid.count, 6, 'Should verify all 6 records');
assert.strictEqual(verifyResultValid.brokenAt, null, 'No broken records in valid chain');
console.log(` Test 3: Full 6-record chain verification passed (${verifyResultValid.count} intact).`);

// Test 4: Tampered record detection (temperature modified)
const tamperedChainTemp = JSON.parse(JSON.stringify(chain));
// Adversary modifies temperature of record #3 from 5.1 to 24.5 without valid key
tamperedChainTemp[3].temp_c = 24.5;

const verifyResultTamperedTemp = verifyChain(tamperedChainTemp, TEST_KEY);
assert.strictEqual(verifyResultTamperedTemp.ok, false, 'Tampered chain must fail');
assert.strictEqual(verifyResultTamperedTemp.brokenAt, 3, 'Must identify record #3 as tampered');
console.log(` Test 4: Detected temperature tampering at seq #${verifyResultTamperedTemp.brokenAt}.`);

// Test 5: Broken hash link detection
const tamperedChainLink = JSON.parse(JSON.stringify(chain));
// Adversary changes prev_hash of record #4
tamperedChainLink[4].prev_hash = 'abcdef1234567890'.repeat(4);

const verifyResultTamperedLink = verifyChain(tamperedChainLink, TEST_KEY);
assert.strictEqual(verifyResultTamperedLink.ok, false, 'Broken hash link must fail');
assert.strictEqual(verifyResultTamperedLink.brokenAt, 4, 'Must identify record #4 as broken link');
console.log(` Test 5: Detected broken hash linkage at seq #${verifyResultTamperedLink.brokenAt}.`);

// Test 6: Invalid HMAC signature detection
const tamperedChainSig = JSON.parse(JSON.stringify(chain));
// Adversary tampers signature on record #2
tamperedChainSig[2].sig = '00'.repeat(32);

const verifyResultTamperedSig = verifyChain(tamperedChainSig, TEST_KEY);
assert.strictEqual(verifyResultTamperedSig.ok, false, 'Invalid HMAC must fail');
assert.strictEqual(verifyResultTamperedSig.brokenAt, 2, 'Must identify record #2 signature forgery');
console.log(` Test 6: Detected invalid cryptographic signature at seq #${verifyResultTamperedSig.brokenAt}.`);

console.log('\n🎉 ALL CRYPTOGRAPHIC CHAIN & INTEGRITY TESTS PASSED!');

