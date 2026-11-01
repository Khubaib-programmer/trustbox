const crypto = require('crypto');

const GENESIS_PREV_HASH = '0'.repeat(64);

function normalizeFlag(value) {
  if (value === null || value === undefined || value === '') {
    return 0;
  }

  if (typeof value === 'boolean') {
    return value ? 1 : 0;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) && value !== 0 ? 1 : 0;
  }

  const stringValue = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'y', 'on'].includes(stringValue)) {
    return 1;
  }
  return 0;
}

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
  const shock = normalizeFlag(record.shock);
  const tilt = normalizeFlag(record.tilt);
  const flipped = normalizeFlag(record.flipped);
  const light = parseInt(record.light, 10) || 0;
  const lidOpen = normalizeFlag(record.lid_open);
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
 * Sorts by seq ascending and checks:
 * 1. Genesis record starts at seq 0 with 64-zero prev_hash
 * 2. Strict sequence number continuity (no gaps or duplicates)
 * 3. Previous hash cryptographic linkage
 * 4. SHA-256 canonical hash integrity
 * 5. HMAC-SHA256 device key signature validity
 *
 * Returns: { ok: boolean, empty?: boolean, count: number, brokenAt: number|null, latestHash: string|null, reason?: string, genesisHash?: string }
 */
function verifyChain(records, deviceKey) {
  if (!records || records.length === 0) {
    return {
      ok: true,
      empty: true,
      count: 0,
      brokenAt: null,
      latestHash: null,
      genesisHash: GENESIS_PREV_HASH,
      reason: 'No telemetry records stored for this box ID.'
    };
  }

  // Sort by sequence number ascending
  const sorted = [...records].sort((a, b) => a.seq - b.seq);
  const latestHash = sorted[sorted.length - 1].hash;

  for (let i = 0; i < sorted.length; i++) {
    const record = sorted[i];

    // 1. Check sequence ordering and continuity
    if (i === 0) {
      if (record.seq !== 0) {
        return {
          ok: false,
          count: sorted.length,
          brokenAt: record.seq,
          latestHash,
          reason: `Genesis block missing at seq #${record.seq}. Expected sequence #0 as initial record.`
        };
      }
    } else {
      const prevRecord = sorted[i - 1];
      if (record.seq === prevRecord.seq) {
        return {
          ok: false,
          count: sorted.length,
          brokenAt: record.seq,
          latestHash,
          reason: `Duplicate sequence number detected at seq #${record.seq}.`
        };
      }
      if (record.seq !== prevRecord.seq + 1) {
        return {
          ok: false,
          count: sorted.length,
          brokenAt: record.seq,
          latestHash,
          reason: `Sequence discontinuity detected at seq #${record.seq}. Expected #${prevRecord.seq + 1}, gap detected.`
        };
      }
    }

    // 2. Verify prev_hash continuity
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

    // 3. Recompute canonical SHA-256 hash
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

    // 4. Verify HMAC-SHA256 signature using shared secret DEVICE_KEY
    const expectedSig = computeSignature(deviceKey, record.hash);
    if ((record.sig || '').toLowerCase() !== expectedSig) {
      return {
        ok: false,
        count: sorted.length,
        brokenAt: record.seq,
        latestHash,
        reason: `HMAC signature mismatch at seq #${record.seq}. Shared secret signature does not match.`
      };
    }
  }

  return {
    ok: true,
    empty: false,
    count: sorted.length,
    brokenAt: null,
    latestHash
  };
}

/**
 * Validates a single incoming record's cryptographic integrity and signature.
 */
function verifySingleRecord(record, deviceKey) {
  if (!record || typeof record !== 'object') {
    return { valid: false, error: 'Record must be a non-empty object.' };
  }
  const canonical = buildCanonicalString(record);
  const expectedHash = computeHash(canonical);
  if ((record.hash || '').toLowerCase() !== expectedHash) {
    return {
      valid: false,
      error: `Calculated hash (${expectedHash}) does not match payload hash (${record.hash}).`
    };
  }

  const expectedSig = computeSignature(deviceKey, record.hash);
  if ((record.sig || '').toLowerCase() !== expectedSig) {
    return {
      valid: false,
      error: 'HMAC signature verification failed. Invalid DEVICE_KEY signature.'
    };
  }

  return { valid: true };
}

module.exports = {
  GENESIS_PREV_HASH,
  buildCanonicalString,
  computeHash,
  computeSignature,
  signRecord,
  verifyChain,
  verifySingleRecord
};

