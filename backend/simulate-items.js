/**
 * TrustBox — 3-Item Delivery Simulation
 * =======================================
 * Item 1: CAKE  (Perishable)   → High Temp (>8°C)    → RETURNED ❌ + ₹50,000 Payout
 * Item 2: TV    (Electronics)  → High Humidity (>75%)→ RETURNED ❌ + ₹30,000 Payout
 * Item 3: BOOKS (Durable)      → Normal Safe Transit → DELIVERED ✅ (Zero Claims)
 *
 * Runs sequentially and saves results to simulation-results.json & simulation-report.md
 */

require('dotenv').config();
const http = require('http');
const fs = require('fs');
const { GENESIS_PREV_HASH, signRecord } = require('./chain');

const DEVICE_KEY = process.env.DEVICE_KEY || 'trustbox-super-secret-key-32ch';
const BACKEND_PORT = process.env.PORT || 4000;
const INTERVAL_MS = 1000; // 1s between steps
const RESULTS_JSON = __dirname + '/simulation-results.json';
const REPORT_MD = __dirname + '/simulation-report.md';

const ITEMS = [
  {
    boxId: 'CAKE-001',
    name: '🎂 Cream Cake (Perishable Cold-Chain)',
    category: 'Perishable Food',
    description: 'Requires cold chain ≤ 8.0°C & gentle handling. Suffers multiple severe shock impacts (SW-420 > 4G) + cooler failure (16°C).',
    expectedOutcome: 'NOT DELIVERED',
    expectedClaimType: 'DROP & TEMP_BREACH',
    records: [
      { temp_c: 4.8, humidity: 55.0, shock: 0, event: 'NONE', note: 'Dispatch from bakery: Normal cold storage (4.8°C)', dt: 2 },
      { temp_c: 5.1, humidity: 54.5, shock: 0, event: 'NONE', note: 'In transit van: Temperature safe (5.1°C), shock stable (0G)', dt: 2 },
      { temp_c: 5.0, humidity: 56.0, shock: 0, event: 'NONE', note: 'Transit checkpoint: Temperature safe (5.0°C)', dt: 2 },
      // Heavy Shock 1: Van hits deep pothole!
      { temp_c: 14.2, humidity: 60.0, shock: 1, event: 'DROP', note: '💥 SEVERE SHOCK DETECTED (SW-420 > 4.5G)! Cake dropped inside van! Cooling unit cracked!', dt: 2 },
      // Heavy Shock 2 + sustained rising temperature
      { temp_c: 15.5, humidity: 62.0, shock: 1, event: 'DROP', note: '💥 SECONDARY SHOCK IMPACT! Cake box flipped on side! Temp rising to 15.5°C', dt: 8 },
      // Final sustained heat breach + damaged physical structure
      { temp_c: 16.5, humidity: 65.0, shock: 1, event: 'TEMP_BREACH', note: '🚨 Sustained heat breach (16.5°C for 17s) + physical impact -> HIGH RISK: NOT DELIVERED!', dt: 9 }
    ]
  },
  {
    boxId: 'TV-001',
    name: '📺 55" OLED Smart TV (Electronics)',
    category: 'Sensitive Electronics',
    description: 'Requires dry storage ≤ 75% humidity. Heavy rain causes water leakage in container.',
    expectedOutcome: 'NOT DELIVERED',
    expectedClaimType: 'HUMIDITY_BREACH',
    records: [
      { temp_c: 22.0, humidity: 50.0, shock: 0, event: 'NONE', note: 'Warehouse dispatch: Dry environment (50% humidity)' },
      { temp_c: 22.5, humidity: 52.0, shock: 0, event: 'NONE', note: 'Highway transit: Safe condition (52% humidity)' },
      { temp_c: 23.0, humidity: 55.0, shock: 0, event: 'NONE', note: 'Approaching city: Weather turning humid (55%)' },
      // Moisture ingress
      { temp_c: 23.5, humidity: 88.0, shock: 0, event: 'HUMIDITY_BREACH', note: '🚨 Van roof water leak! Humidity spikes to 88% (> 75%) -> Circuit damage risk! HIGH RISK: NOT DELIVERED!' }
    ]
  },
  {
    boxId: 'BOOKS-001',
    name: '📚 Educational Hardcover Books (Dry Goods)',
    category: 'Non-Perishable Goods',
    description: 'Standard cargo with no temperature sensitivity. Delivered safely without incident.',
    expectedOutcome: 'DELIVERED',
    expectedClaimType: null,
    records: [
      { temp_c: 21.5, humidity: 48.0, shock: 0, event: 'NONE', note: 'Publisher warehouse: Packed securely' },
      { temp_c: 22.0, humidity: 49.0, shock: 0, event: 'NONE', note: 'Sorting hub: Scanned and loaded' },
      { temp_c: 22.8, humidity: 51.0, shock: 0, event: 'NONE', note: 'Midway transit: Normal road conditions' },
      { temp_c: 23.0, humidity: 50.0, shock: 0, event: 'NONE', note: 'Local delivery hub arrival' },
      { temp_c: 22.4, humidity: 47.0, shock: 0, event: 'NONE', note: 'Out for delivery to customer' },
      { temp_c: 22.0, humidity: 46.0, shock: 0, event: 'NONE', note: '✅ Safely delivered to recipient doorstep!' }
    ]
  }
];

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function log(msg) {
  const ts = new Date().toLocaleTimeString('en-IN', { hour12: false });
  console.log(`[${ts}] ${msg}`);
}

function sendRecord(record) {
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
          resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode, body: parsed });
        } catch {
          resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode, body });
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Backend timeout')); });
    req.write(data);
    req.end();
  });
}

function resetBox(boxId) {
  return new Promise((resolve) => {
    const data = JSON.stringify({ confirm: true });
    const req = http.request({
      hostname: 'localhost',
      port: BACKEND_PORT,
      path: `/api/admin/reset/${encodeURIComponent(boxId)}`,
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      },
      timeout: 3000
    }, (res) => resolve(res.statusCode === 200));
    req.on('error', () => resolve(false));
    req.write(data);
    req.end();
  });
}

function fetchClaims(boxId) {
  return new Promise((resolve) => {
    const req = http.request({
      hostname: 'localhost',
      port: BACKEND_PORT,
      path: `/api/claims/${encodeURIComponent(boxId)}`,
      method: 'GET',
      timeout: 3000
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(body)); } catch { resolve([]); }
      });
    });
    req.on('error', () => resolve([]));
    req.end();
  });
}

function fetchPayouts(boxId) {
  return new Promise((resolve) => {
    const req = http.request({
      hostname: 'localhost',
      port: BACKEND_PORT,
      path: `/api/payouts/${encodeURIComponent(boxId)}`,
      method: 'GET',
      timeout: 3000
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(body)); } catch { resolve([]); }
      });
    });
    req.on('error', () => resolve([]));
    req.end();
  });
}

function fetchVerify(boxId) {
  return new Promise((resolve) => {
    const req = http.request({
      hostname: 'localhost',
      port: BACKEND_PORT,
      path: `/api/verify/${encodeURIComponent(boxId)}`,
      method: 'GET',
      timeout: 3000
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(body)); } catch { resolve(null); }
      });
    });
    req.on('error', () => resolve(null));
    req.end();
  });
}

async function simulateItem(item) {
  console.log('\n' + '═'.repeat(65));
  console.log(`  📦 ITEM: ${item.name}`);
  console.log(`  Box ID   : ${item.boxId} | Category: ${item.category}`);
  console.log(`  Scenario : ${item.description}`);
  console.log('═'.repeat(65));

  // Reset demo state for clean run
  await resetBox(item.boxId);
  log(`Cleaned existing demo records for ${item.boxId}`);

  let currentSeq = 0;
  let currentPrevHash = GENESIS_PREV_HASH;
  let currentTs = Math.floor(Date.now() / 1000);
  const sentRecords = [];

  for (let i = 0; i < item.records.length; i++) {
    const step = item.records[i];
    currentTs += (step.dt || 2);

    const raw = {
      box_id: item.boxId,
      seq: currentSeq,
      ts: currentTs,
      temp_c: step.temp_c,
      humidity: step.humidity,
      shock: step.shock || 0,
      tilt: 0,
      flipped: 0,
      light: 35,
      lid_open: 0,
      event: step.event || 'NONE',
      prev_hash: currentPrevHash
    };

    const signed = signRecord(raw, DEVICE_KEY);
    const resp = await sendRecord(signed);

    if (resp.ok) {
      log(`[STEP ${i + 1}/${item.records.length}] Seq #${signed.seq} | Temp: ${signed.temp_c}°C | Hum: ${signed.humidity}% | ${step.note}`);
      sentRecords.push({ ...signed, note: step.note });
      currentPrevHash = signed.hash;
      currentSeq++;
    } else {
      console.error(`❌ Ingestion failed for seq #${signed.seq}:`, resp.error);
    }

    await sleep(INTERVAL_MS);
  }

  // Allow insurance engine to finalize
  await sleep(1500);

  const claims = await fetchClaims(item.boxId);
  const payouts = await fetchPayouts(item.boxId);
  const verify = await fetchVerify(item.boxId);

  const isReturned = claims.length > 0;
  const actualOutcome = isReturned ? 'NOT DELIVERED' : 'DELIVERED';
  const testPassed = actualOutcome === item.expectedOutcome;
  const totalPayout = payouts.reduce((sum, p) => sum + (p.amount_inr || 0), 0);

  console.log('\n' + '─'.repeat(65));
  console.log(`  📊 VERDICT FOR ${item.name}:`);
  console.log(`  • Delivery Result : ${testPassed ? '✅' : '❌'} ${actualOutcome} (Expected: ${item.expectedOutcome})`);
  console.log(`  • Risk Assessment : ${isReturned ? '🚨 HIGH RISK (BREACH DETECTED)' : '🟢 LOW RISK (SAFE)'}`);
  console.log(`  • Hash Chain Audit: ${verify && verify.ok ? '✅ VERIFIED (SHA-256 + HMAC Valid)' : '❌ BROKEN'}`);
  console.log(`  • Total Telemetry : ${sentRecords.length} chained blocks`);
  console.log(`  • Claims Count    : ${claims.length}`);
  claims.forEach(c => console.log(`      └─ [${c.type}] ${c.reason}`));
  console.log(`  • Payouts Count   : ${payouts.length}`);
  payouts.forEach(p => console.log(`      └─ ₹${p.amount_inr.toLocaleString()} INR (ID: ${p.payout_id}) -> ${p.beneficiary}`));
  console.log(`  • Total Settled   : ₹${totalPayout.toLocaleString()} INR`);
  console.log('─'.repeat(65));

  return {
    boxId: item.boxId,
    item: item.name,
    category: item.category,
    description: item.description,
    recordsSent: sentRecords.length,
    chainVerified: verify && verify.ok,
    actualOutcome,
    expectedOutcome: item.expectedOutcome,
    testPassed,
    claims,
    payouts,
    totalPayoutINR: totalPayout
  };
}

async function main() {
  console.log('\n' + '█'.repeat(65));
  console.log('  🚀 TRUSTBOX HACKATHON: 3-ITEM DELIVERY SIMULATION');
  console.log('  Items: Cake (Perishable) | TV (Electronics) | Books (Safe)');
  console.log('█'.repeat(65));

  const results = [];
  for (const item of ITEMS) {
    const res = await simulateItem(item);
    results.push(res);
    await sleep(2000);
  }

  // Summary Table
  console.log('\n\n' + '█'.repeat(65));
  console.log('  🏁 FINAL SIMULATION SUMMARY TABLE');
  console.log('█'.repeat(65));
  results.forEach(r => {
    const mark = r.testPassed ? '✅ PASS' : '❌ FAIL';
    const statusLabel = r.actualOutcome === 'NOT DELIVERED' ? '❌ NOT DELIVERED' : '📦 DELIVERED';
    console.log(`  ${mark} | ${r.boxId.padEnd(10)} | ${r.item.padEnd(35)} | ${statusLabel} | Payout: ₹${r.totalPayoutINR.toLocaleString()}`);
  });
  console.log('█'.repeat(65));

  // Save JSON
  const outputData = {
    simulationTimestamp: new Date().toISOString(),
    backendUrl: `http://localhost:${BACKEND_PORT}`,
    allTestsPassed: results.every(r => r.testPassed),
    results
  };
  fs.writeFileSync(RESULTS_JSON, JSON.stringify(outputData, null, 2), 'utf8');
  console.log(`\n💾 Saved JSON results to: ${RESULTS_JSON}`);

  // Save Markdown Report
  const mdReport = generateMarkdownReport(results);
  fs.writeFileSync(REPORT_MD, mdReport, 'utf8');
  console.log(`📄 Saved Markdown Report to: ${REPORT_MD}\n`);
}

function generateMarkdownReport(results) {
  let md = `# 📦 TrustBox 3-Item Delivery Simulation Report\n\n`;
  md += `**Execution Time:** ${new Date().toLocaleString('en-IN')}\n\n`;
  md += `## 📋 Summary Table\n\n`;
  md += `| Item | Box ID | Category | Breach Type | Outcome | Payout (INR) | Status |\n`;
  md += `|---|---|---|---|---|---|---|\n`;

  results.forEach(r => {
    const claimType = r.claims.length > 0 ? r.claims.map(c => c.type).join(' + ') : 'None (Safe)';
    const outcome = r.actualOutcome === 'NOT DELIVERED' ? '❌ NOT DELIVERED' : '✅ DELIVERED';
    const testStatus = r.testPassed ? '✅ PASS' : '❌ FAIL';
    md += `| ${r.item} | \`${r.boxId}\` | ${r.category} | ${claimType} | **${outcome}** | ₹${r.totalPayoutINR.toLocaleString()} | ${testStatus} |\n`;
  });

  md += `\n---\n\n## 🔍 Item-by-Item Detailed Breakdown\n\n`;

  results.forEach(r => {
    md += `### ${r.item} (\`${r.boxId}\`)\n`;
    md += `- **Category:** ${r.category}\n`;
    md += `- **Condition:** ${r.description}\n`;
    md += `- **Cryptographic Hash Chain:** ${r.chainVerified ? '✅ 100% Unbroken & Verified' : '❌ Chain Broken'}\n`;
    md += `- **Final Delivery Outcome:** **${r.actualOutcome}** (Expected: ${r.expectedOutcome})\n`;
    md += `- **Claims Filed:** ${r.claims.length}\n`;
    if (r.claims.length > 0) {
      r.claims.forEach(c => {
        md += `  - **Type:** \`${c.type}\`\n`;
        md += `  - **Reason:** ${c.reason}\n`;
        md += `  - **Status:** \`${c.status}\`\n`;
      });
    }
    md += `- **Insurance Payouts:** ${r.payouts.length}\n`;
    if (r.payouts.length > 0) {
      r.payouts.forEach(p => {
        md += `  - **Amount:** **₹${p.amount_inr.toLocaleString()} INR**\n`;
        md += `  - **Payout ID:** \`${p.payout_id}\`\n`;
        md += `  - **Beneficiary:** ${p.beneficiary}\n`;
        md += `  - **Status:** \`${p.status}\`\n`;
      });
    }
    md += `\n---\n\n`;
  });

  return md;
}

main().catch(err => {
  console.error('Fatal simulation error:', err);
  process.exit(1);
});
