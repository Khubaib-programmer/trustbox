const crypto = require('crypto');

const GENESIS_PREV_HASH = '0'.repeat(64);

/**
 * Builds canonical string formatted strictly according to spec:
 * box_id|seq|ts|temp_c|humidity|shock|tilt|flipped|light|lid_open|event|prev_hash
 */
function buildCanonicalString(record) {
  const boxId = String(record.box_id || '');
  const seq = parseInt(record.seq, 10);
  const ts = parseInt(record.ts, 10);
  const tempC = Number(record.temp_c).toFixed(1);
  const humidity = Number(record.humidity).toFixed(1);
  const shock = (record.shock === 1 || record.shock === true || record.shock === '1') ? 1 : 0;
  const tilt = (record.tilt === 1 || record.tilt === true || record.tilt === '1') ? 1 : 0;
  const flipped = (record.flipped === 1 || record.flipped === true || record.flipped === '1') ? 1 : 0;
  const light = parseInt(record.light, 10) || 0;
  const lidOpen = (record.lid_open === 1 || record.lid_open === true || record.lid_open === '1') ? 1 : 0;
  const event = (record.event && String(record.event).trim() !== '') ? String(record.event).trim() : 'NONE';
  const prevHash = String(record.prev_hash || GENESIS_PREV_HASH).toLowerCase();

  return `${boxId}|${seq}|${ts}|${tempC}|${humidity}|${shock}|${tilt}|${flipped}|${light}|${lidOpen}|${event}|${prevHash}`;
}

/**
 * SHA-256 hash as lowercase hex string
 */
function computeHash(canonicalString) {
  return crypto.createHash('sha256').update(canonicalString, 'utf8').digest('hex').toLowerCase();
}

/**
 * HMAC-SHA256 signature using DEVICE_KEY as lowercase hex string
 */
function computeSignature(deviceKey, hash) {
  return crypto.createHmac('sha256', deviceKey).update(hash, 'utf8').digest('hex').toLowerCase();
}

/**
 * Computes and attaches hash and sig to record
 */
function signRecord(record, deviceKey) {
  const canonical = buildCanonicalString(record);
  const hash = computeHash(canonical);
  const sig = computeSignature(deviceKey, hash);
  return {
    ...record,
    temp_c: parseFloat(Number(record.temp_c).toFixed(1)),
    humidity: parseFloat(Number(record.humidity).toFixed(1)),
    shock: (record.shock === 1 || record.shock === true) ? 1 : 0,
    tilt: (record.tilt === 1 || record.tilt === true) ? 1 : 0,
    flipped: (record.flipped === 1 || record.flipped === true) ? 1 : 0,
    lid_open: (record.lid_open === 1 || record.lid_open === true) ? 1 : 0,
    event: (record.event && String(record.event).trim() !== '') ? String(record.event).trim() : 'NONE',
    hash,
    sig
  };
}

/**
 * Verifies full chain of records for a box.
 * Sorts by seq ascending and finds the first tamper/mismatch.
 * Returns: { ok: boolean, count: number, brokenAt: number|null, latestHash: string|null, reason?: string }
 */
function verifyChain(records, deviceKey) {
  if (!records || records.length === 0) {
    return {
      ok: true,
      count: 0,
      brokenAt: null,
      latestHash: null
    };
  }

  // Sort by sequence number ascending
  const sorted = [...records].sort((a, b) => a.seq - b.seq);
  const latestHash = sorted[sorted.length - 1].hash;

  for (let i = 0; i < sorted.length; i++) {
    const record = sorted[i];

    // 1. Verify prev_hash
    const expectedPrevHash = (i === 0) ? GENESIS_PREV_HASH : sorted[i - 1].hash;
    if ((record.prev_hash || '').toLowerCase() !== expectedPrevHash.toLowerCase()) {
      return {
        ok: false,
        count: sorted.length,
        brokenAt: record.seq,
        latestHash,
        reason: `Previous hash mismatch at seq #${record.seq}. Expected: ${expectedPrevHash}, got: ${record.prev_hash}`
      };
    }

    // 2. Recompute hash
    const canonical = buildCanonicalString(record);
    const expectedHash = computeHash(canonical);
    if ((record.hash || '').toLowerCase() !== expectedHash) {
      return {
        ok: false,
        count: sorted.length,
        brokenAt: record.seq,
        latestHash,
        reason: `Hash mismatch at seq #${record.seq}. Expected: ${expectedHash}, got: ${record.hash}`
      };
    }

    // 3. Verify HMAC signature
    const expectedSig = computeSignature(deviceKey, record.hash);
    if ((record.sig || '').toLowerCase() !== expectedSig) {
      return {
        ok: false,
        count: sorted.length,
        brokenAt: record.seq,
        latestHash,
        reason: `Cryptographic signature mismatch at seq #${record.seq}`
      };
    }
  }

  return {
    ok: true,
    count: sorted.length,
    brokenAt: null,
    latestHash
  };
}

module.exports = {
  GENESIS_PREV_HASH,
  buildCanonicalString,
  computeHash,
  computeSignature,
  signRecord,
  verifyChain
};

