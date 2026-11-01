/**
 * TrustBox — Comprehensive Hackathon Pitching Test Suite
 * =======================================================
 * Demonstrates 6 Real-World Cargo Scenarios for Judges:
 * 1. 💉 VACCINE-001    (Critical Biologics)   → Cold Chain Spoilage (>8°C)    → NOT DELIVERED ❌ (₹1,50,000 Payout)
 * 2. 🎂 CAKE-001       (Perishable Bakery)    → Severe Drop + Heat Melt       → NOT DELIVERED ❌ (₹75,000 Payout)
 * 3. 📺 TV-001         (Fragile OLED Display) → High Humidity + Screen Impact → NOT DELIVERED ❌ (₹70,000 Payout)
 * 4. 💎 FRAGILE-001    (Luxury Crystal Glass) → Tilted / Inverted Upside Down → NOT DELIVERED ❌ (₹35,000 Payout)
 * 5. 💻 ELECTRONIC-001 (Gaming Laptop)        → Violent Mechanical Drop Shock → NOT DELIVERED ❌ (₹45,000 Payout)
 * 6. 📚 BOOKS-001      (Dry Goods - Baseline) → Normal Safe Delivery          → DELIVERED SAFELY ✅ (₹0 Claims)
 *
 * Results saved to: simulation-results.json & simulation-report.md
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const http = require('http');
const https = require('https');
const fs = require('fs');
const { GENESIS_PREV_HASH, signRecord } = require('./chain');

const DEVICE_KEY = process.env.DEVICE_KEY || 'trustbox-super-secret-key-32ch';
const BACKEND_PORT = process.env.PORT || 4000;
const TARGET_URL = process.env.TARGET_URL || `http://localhost:${BACKEND_PORT}`;
const targetUrlObj = new URL(TARGET_URL);
const isHttps = targetUrlObj.protocol === 'https:';
const client = isHttps ? https : http;

const INTERVAL_MS = 600; // Fast 600ms per step for snappy pitching demo
const RESULTS_JSON = __dirname + '/simulation-results.json';
const REPORT_MD = __dirname + '/simulation-report.md';

const ITEMS = [
  {
    boxId: 'VACCINE-001',
    name: '💉 mRNA Polio/COVID Vaccine (Cold Chain Biologics)',
    category: 'Critical Biological Vaccine',
    monitoredHazard: 'Strict Cold Chain (2.0°C – 8.0°C)',
    description: 'Dry ice packaging depletes midway in remote transit. Temperature exceeds 8°C for >15s, neutralizing active viral antigens.',
    expectedOutcome: 'RETURNED',
    expectedClaimType: 'TEMP_BREACH',
    records: [
      { temp_c: 4.2, humidity: 45.0, shock: 0, tilt: 0, flipped: 0, event: 'NONE', note: 'Central Pharma Depository: Dispatched in cryogenic cooler (4.2°C)', dt: 2 },
      { temp_c: 4.8, humidity: 46.0, shock: 0, tilt: 0, flipped: 0, event: 'NONE', note: 'Regional Hub Transit: Thermal box intact (4.8°C)', dt: 2 },
      { temp_c: 5.5, humidity: 48.0, shock: 0, tilt: 0, flipped: 0, event: 'NONE', note: 'Last-mile ambulance van: Insulation weakening (5.5°C)', dt: 2 },
      // Thermal Breach begins
      { temp_c: 12.8, humidity: 55.0, shock: 0, tilt: 0, flipped: 0, event: 'TEMP_BREACH', note: '⚠️ Dry ice exhausted! Temp spiked to 12.8°C (> 8.0°C limit)', dt: 2 },
      { temp_c: 15.6, humidity: 58.0, shock: 0, tilt: 0, flipped: 0, event: 'TEMP_BREACH', note: '⚠️ Critical warning: Temperature sustained at 15.6°C for 8s', dt: 8 },
      { temp_c: 17.2, humidity: 60.0, shock: 0, tilt: 0, flipped: 0, event: 'TEMP_BREACH', note: '🚨 Sustained thermal breach (>15s at 17.2°C)! Active antigens spoiled. Claim auto-settled!', dt: 9 }
    ]
  },
  {
    boxId: 'CAKE-001',
    name: '🎂 Designer 3-Tier Cream Cake (Perishable Confectionery)',
    category: 'Perishable & Fragile Bakery',
    monitoredHazard: 'Cold Chain (≤ 8°C) & Mechanical Vibration',
    description: 'Van hits a major roadway pothole (SW-420 > 4.5G drop), cracking refrigeration seal. Temperature surges to 36.5°C in direct heat, melting cream.',
    expectedOutcome: 'RETURNED',
    expectedClaimType: 'DROP & TEMP_BREACH',
    records: [
      { temp_c: 4.8, humidity: 55.0, shock: 0, tilt: 0, flipped: 0, event: 'NONE', note: 'Bakery dispatch: Chilled display box (4.8°C, 0G shock)', dt: 2 },
      { temp_c: 5.1, humidity: 54.5, shock: 0, tilt: 0, flipped: 0, event: 'NONE', note: 'Suburban transit: Smooth driving, stable temperature', dt: 2 },
      { temp_c: 5.0, humidity: 56.0, shock: 0, tilt: 0, flipped: 0, event: 'NONE', note: 'City approach: Temperature holding steady (5.0°C)', dt: 2 },
      // Severe drop pothole impact + soaring heat (36.5°C)
      { temp_c: 24.5, humidity: 62.0, shock: 1, tilt: 0, flipped: 0, event: 'DROP', note: '💥 SEVERE POTHOLE IMPACT (SW-420 > 4.5G)! Cake dropped off rack, cooler cracked!', dt: 2 },
      { temp_c: 31.8, humidity: 65.0, shock: 1, tilt: 0, flipped: 0, event: 'TEMP_BREACH', note: '⚠️ Cooling failure! Temp surging rapidly to 31.8°C under direct heat (> 8.0°C limit)', dt: 8 },
      { temp_c: 36.5, humidity: 68.0, shock: 1, tilt: 0, flipped: 0, event: 'TEMP_BREACH', note: '🚨 Sustained extreme heat (36.5°C) + shock damage! Cream liquefied. DELIVERY CANCELLED!', dt: 9 }
    ]
  },
  {
    boxId: 'TV-001',
    name: '📺 55" 4K OLED Smart TV (High-End Electronics)',
    category: 'Fragile Glass & Precision Circuitry',
    monitoredHazard: 'High-G Drop Shock & Moisture (≤ 70% Humidity)',
    description: 'Cargo truck container experiences violent drop impacts (>6.5G to 8.0G) off transport pallet, shattering OLED panel followed by roof leak.',
    expectedOutcome: 'RETURNED',
    expectedClaimType: 'DROP & HUMIDITY_BREACH',
    records: [
      { temp_c: 22.0, humidity: 50.0, shock: 0, tilt: 0, flipped: 0, event: 'NONE', note: 'Sony Central Warehouse: Dispatched in sealed foam packaging', dt: 2 },
      { temp_c: 22.5, humidity: 52.0, shock: 0, tilt: 0, flipped: 0, event: 'NONE', note: 'Highway freight: Nominal air humidity (52%)', dt: 2 },
      // High-G multiple shock impacts
      { temp_c: 23.0, humidity: 58.0, shock: 1, tilt: 0, flipped: 0, event: 'DROP', note: '💥 VIOLENT TRANSIT DROP (SW-420 > 6.5G Shock)! Box thrown off transport pallet during emergency brake!', dt: 2 },
      { temp_c: 23.5, humidity: 88.0, shock: 1, tilt: 0, flipped: 0, event: 'DROP', note: '💥 CRITICAL REPEATED SHOCK IMPACT (>8.0G)! OLED display panel shattered against vehicle bulkhead! Moisture entering!', dt: 2 },
      { temp_c: 23.8, humidity: 92.5, shock: 1, tilt: 0, flipped: 0, event: 'HUMIDITY_BREACH', note: '🚨 Severe high-G drop shock + moisture flood (92.5%)! Complete panel & board destruction. RETURNED!', dt: 2 }
    ]
  },
  {
    boxId: 'FRAGILE-001',
    name: '💎 Luxury Bohemian Crystal Glassware (Ultra-Fragile)',
    category: 'Ultra-Fragile Glassware',
    monitoredHazard: 'Upright Orientation (Tilt / Inversion) & Shock',
    description: 'Courier ignores "THIS SIDE UP" labels. Package is tilted over 60° and flipped upside down on automated sorting conveyor.',
    expectedOutcome: 'RETURNED',
    expectedClaimType: 'TILT & DROP',
    records: [
      { temp_c: 21.0, humidity: 48.0, shock: 0, tilt: 0, flipped: 0, event: 'NONE', note: 'Artisan Glass Studio: Packed with air bubble cushioning, upright (0° tilt)', dt: 2 },
      { temp_c: 21.5, humidity: 49.0, shock: 0, tilt: 0, flipped: 0, event: 'NONE', note: 'Loaded into express van: Kept vertical on padded pallet', dt: 2 },
      // Tipping / Inversion
      { temp_c: 22.0, humidity: 50.0, shock: 0, tilt: 1, flipped: 0, event: 'TILT', note: '⚠️ Package tilted over 65° during rapid van turn!', dt: 2 },
      { temp_c: 22.2, humidity: 50.0, shock: 1, tilt: 1, flipped: 1, event: 'FLIPPED', note: '🚨 Package flipped upside down on sorting chute! Stemware shattered inside!', dt: 2 }
    ]
  },
  {
    boxId: 'ELECTRONIC-001',
    name: '💻 RTX 4090 Gaming Laptop (Precision Hardware)',
    category: 'Premium Computing Electronics',
    monitoredHazard: 'Mechanical G-Force Impact & Moisture',
    description: 'Delivery agent accidentally drops laptop case from 1.5 meters during delivery handoff (> 5G impact detected).',
    expectedOutcome: 'RETURNED',
    expectedClaimType: 'DROP',
    records: [
      { temp_c: 23.0, humidity: 45.0, shock: 0, tilt: 0, flipped: 0, event: 'NONE', note: 'Tech hub dispatch: Sealed antistatic enclosure', dt: 2 },
      { temp_c: 23.5, humidity: 46.0, shock: 0, tilt: 0, flipped: 0, event: 'NONE', note: 'Courier bag transit: Normal urban movement', dt: 2 },
      { temp_c: 24.0, humidity: 47.0, shock: 0, tilt: 0, flipped: 0, event: 'NONE', note: 'Customer apartment lobby arrival', dt: 2 },
      // Drop impact
      { temp_c: 24.2, humidity: 48.0, shock: 1, tilt: 0, flipped: 0, event: 'DROP', note: '💥 VIOLENT 1.5M DROP (SW-420 > 5.0G Shock)! Motherboard solder joint crack hazard!', dt: 2 }
    ]
  },
  {
    boxId: 'BOOKS-001',
    name: '📚 Hardcover Medical Encyclopedias (Durable Goods)',
    category: 'Standard Cargo (Control Baseline)',
    monitoredHazard: 'Complete Cryptographic Proof-of-Delivery',
    description: 'Standard shipment with zero hazards. Demonstrates that safe transit triggers zero false positives and records complete SHA-256 chain.',
    expectedOutcome: 'DELIVERED',
    expectedClaimType: null,
    records: [
      { temp_c: 21.5, humidity: 48.0, shock: 0, tilt: 0, flipped: 0, event: 'NONE', note: 'Publisher warehouse: Packed and strapped securely' },
      { temp_c: 22.0, humidity: 49.0, shock: 0, tilt: 0, flipped: 0, event: 'NONE', note: 'Sorting hub: Barcode verified, loaded on pallet' },
      { temp_c: 22.8, humidity: 51.0, shock: 0, tilt: 0, flipped: 0, event: 'NONE', note: 'Highway transit: Normal road vibrations (0G)' },
      { temp_c: 23.0, humidity: 50.0, shock: 0, tilt: 0, flipped: 0, event: 'NONE', note: 'Local delivery hub arrival: Sorted for dispatch' },
      { temp_c: 22.4, humidity: 47.0, shock: 0, tilt: 0, flipped: 0, event: 'NONE', note: 'Out for delivery: Courier on delivery route' },
      { temp_c: 22.0, humidity: 46.0, shock: 0, tilt: 0, flipped: 0, event: 'NONE', note: '✅ Safely delivered to recipient doorstep without single breach!' }
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
    const req = client.request({
      hostname: targetUrlObj.hostname,
      port: targetUrlObj.port || (isHttps ? 443 : 80),
      path: '/api/records',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      },
      timeout: 10000
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
    const req = client.request({
      hostname: targetUrlObj.hostname,
      port: targetUrlObj.port || (isHttps ? 443 : 80),
      path: `/api/admin/reset/${encodeURIComponent(boxId)}`,
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      },
      timeout: 10000
    }, (res) => resolve(res.statusCode === 200));
    req.on('error', () => resolve(false));
    req.write(data);
    req.end();
  });
}

function fetchClaims(boxId) {
  return new Promise((resolve) => {
    const req = client.request({
      hostname: targetUrlObj.hostname,
      port: targetUrlObj.port || (isHttps ? 443 : 80),
      path: `/api/claims/${encodeURIComponent(boxId)}`,
      method: 'GET',
      timeout: 10000
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
    const req = client.request({
      hostname: targetUrlObj.hostname,
      port: targetUrlObj.port || (isHttps ? 443 : 80),
      path: `/api/payouts/${encodeURIComponent(boxId)}`,
      method: 'GET',
      timeout: 10000
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
    const req = client.request({
      hostname: targetUrlObj.hostname,
      port: targetUrlObj.port || (isHttps ? 443 : 80),
      path: `/api/verify/${encodeURIComponent(boxId)}`,
      method: 'GET',
      timeout: 10000
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
  console.log('\n' + '═'.repeat(70));
  console.log(`  📦 SCENARIO: ${item.name}`);
  console.log(`  Box ID    : ${item.boxId} | Category: ${item.category}`);
  console.log(`  Hazard    : ${item.monitoredHazard}`);
  console.log(`  Narrative : ${item.description}`);
  console.log('═'.repeat(70));

  // Reset demo state for clean run
  await resetBox(item.boxId);
  log(`Resetting and initializing clean chain for ${item.boxId}...`);

  let currentSeq = 0;
  let currentPrevHash = GENESIS_PREV_HASH;
  let currentTs = Math.floor(Date.now() / 1000) - 60; // 1 min ago so latest matches now
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
      tilt: step.tilt || 0,
      flipped: step.flipped || 0,
      light: 35,
      lid_open: 0,
      event: step.event || 'NONE',
      prev_hash: currentPrevHash
    };

    const signed = signRecord(raw, DEVICE_KEY);
    const resp = await sendRecord(signed);

    if (resp.ok) {
      log(`[STEP ${i + 1}/${item.records.length}] Seq #${signed.seq} | Temp: ${signed.temp_c}°C | Hum: ${signed.humidity}% | Shock: ${signed.shock} | Tilt: ${signed.tilt} | ${step.note}`);
      sentRecords.push({ ...signed, note: step.note });
      currentPrevHash = signed.hash;
      currentSeq++;
    } else {
      console.error(`❌ Ingestion failed for seq #${signed.seq}:`, resp.error);
    }

    await sleep(INTERVAL_MS);
  }

  // Allow insurance engine to finalize
  await sleep(1200);

  const claims = await fetchClaims(item.boxId);
  const payouts = await fetchPayouts(item.boxId);
  const verify = await fetchVerify(item.boxId);

  const isReturned = claims.length > 0;
  const actualOutcome = isReturned ? 'RETURNED' : 'DELIVERED';
  const testPassed = isReturned ? (item.expectedOutcome === 'RETURNED' || item.expectedOutcome === 'NOT DELIVERED' || item.expectedOutcome === 'DELIVERY CANCELLED') : (item.expectedOutcome === 'DELIVERED');
  const totalPayout = payouts.reduce((sum, p) => sum + (p.amount_inr || 0), 0);

  console.log('\n' + '─'.repeat(70));
  console.log(`  📊 AUDIT & DECISION VERDICT FOR ${item.boxId}:`);
  console.log(`  • Delivery Verdict : ${testPassed ? '✅' : '❌'} ${actualOutcome} (Expected: ${item.expectedOutcome})`);
  console.log(`  • Risk Assessment  : ${isReturned ? '🚨 HIGH RISK (BREACH / CARGO DAMAGED)' : '🟢 LOW RISK (SAFE TRANSIT)'}`);
  console.log(`  • Hash Chain Audit : ${verify && verify.ok ? '✅ 100% CRYPTOGRAPHICALLY INTACT' : '❌ BROKEN'}`);
  console.log(`  • Total Telemetry  : ${sentRecords.length} chained sequential blocks`);
  console.log(`  • Auto Claims (${claims.length}) :`);
  if (claims.length === 0) {
    console.log(`      └─ None (Zero incidents recorded)`);
  } else {
    claims.forEach(c => console.log(`      └─ [${c.type}] ${c.reason}`));
  }
  console.log(`  • Insurance Payouts (${payouts.length}) :`);
  if (payouts.length === 0) {
    console.log(`      └─ ₹0 INR (Clean delivery)`);
  } else {
    payouts.forEach(p => console.log(`      └─ ₹${p.amount_inr.toLocaleString()} INR [${p.payout_id}] -> ${p.beneficiary}`));
  }
  console.log(`  • Total Settled    : ₹${totalPayout.toLocaleString()} INR`);
  console.log('─'.repeat(70));

  return {
    boxId: item.boxId,
    item: item.name,
    category: item.category,
    monitoredHazard: item.monitoredHazard,
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
  console.log('\n' + '█'.repeat(70));
  console.log('  🚀 TRUSTBOX: PITCH-READY TEST SUITE (6 REAL-WORLD SCENARIOS)');
  console.log('  Vaccines | Cakes | OLED TV | Fragile Glass | Laptops | Books');
  console.log('█'.repeat(70));

  const results = [];
  for (const item of ITEMS) {
    const res = await simulateItem(item);
    results.push(res);
    await sleep(1000);
  }

  // Summary Table
  console.log('\n\n' + '█'.repeat(70));
  console.log('  🏁 FINAL PITCHING DEMO SUMMARY TABLE (ALL SCENARIOS)');
  console.log('█'.repeat(70));
  results.forEach(r => {
    const mark = r.testPassed ? '✅ PASS' : '❌ FAIL';
    const statusLabel = r.actualOutcome === 'RETURNED' ? '❌ RETURNED' : '📦 DELIVERED';
    console.log(`  ${mark} | ${r.boxId.padEnd(14)} | ${r.item.slice(0, 30).padEnd(30)} | ${statusLabel.padEnd(16)} | Payout: ₹${r.totalPayoutINR.toLocaleString()}`);
  });
  console.log('█'.repeat(70));

  // Save JSON
  const outputData = {
    simulationTimestamp: new Date().toISOString(),
    backendUrl: TARGET_URL,
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
  let md = `# 📦 TrustBox Pitching Test Suite — Full Audit Report\n\n`;
  md += `**Execution Time:** ${new Date().toLocaleString('en-IN')}\n\n`;
  md += `## 📋 Judge Presentation Summary Table\n\n`;
  md += `| Item | Box ID | Monitored Hazard | Breach Detected | Final Verdict | Parametric Payout | Test Status |\n`;
  md += `|---|---|---|---|---|---|---|\n`;

  results.forEach(r => {
    const claimType = r.claims.length > 0 ? r.claims.map(c => c.type).join(' + ') : 'None (Safe)';
    const outcome = r.actualOutcome === 'RETURNED' ? '❌ RETURNED' : '✅ DELIVERED';
    const testStatus = r.testPassed ? '✅ PASS' : '❌ FAIL';
    md += `| ${r.item} | \`${r.boxId}\` | ${r.monitoredHazard} | ${claimType} | **${outcome}** | ₹${r.totalPayoutINR.toLocaleString()} | ${testStatus} |\n`;
  });

  md += `\n---\n\n## 🔍 Scenario-by-Scenario Audit Details\n\n`;

  results.forEach(r => {
    md += `### ${r.item} (\`${r.boxId}\`)\n`;
    md += `- **Cargo Category:** ${r.category}\n`;
    md += `- **Monitored Hazard:** ${r.monitoredHazard}\n`;
    md += `- **Incident Narrative:** ${r.description}\n`;
    md += `- **Cryptographic Hash Chain:** ${r.chainVerified ? '✅ 100% Intact & Unbroken (SHA-256 + HMAC-SHA256 Valid)' : '❌ Broken'}\n`;
    md += `- **Final Delivery Verdict:** **${r.actualOutcome}** (Expected: ${r.expectedOutcome})\n`;
    md += `- **Parametric Claims Approved:** ${r.claims.length}\n`;
    if (r.claims.length > 0) {
      r.claims.forEach(c => {
        md += `  - **Claim Type:** \`${c.type}\`\n`;
        md += `  - **Trigger Reason:** ${c.reason}\n`;
        md += `  - **Status:** \`${c.status}\`\n`;
      });
    }
    md += `- **Automated Insurance Settlement:** ${r.payouts.length}\n`;
    if (r.payouts.length > 0) {
      r.payouts.forEach(p => {
        md += `  - **Settlement Amount:** **₹${p.amount_inr.toLocaleString()} INR**\n`;
        md += `  - **Transaction ID:** \`${p.payout_id}\`\n`;
        md += `  - **Beneficiary:** ${p.beneficiary}\n`;
        md += `  - **Status:** \`${p.status}\` (Instant Parametric Transfer)\n`;
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
