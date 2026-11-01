/**
 * Insurance Engine for TrustBox
 * Auto-approves insurance claims upon cold chain breach or shock/drop impact.
 */

class InsuranceEngine {
  constructor({ claimTempC = 8.0, claimWindowSec = 15, onClaimApproved }) {
    this.claimTempC = parseFloat(claimTempC) || 8.0;
    this.claimWindowSec = parseInt(claimWindowSec, 10) || 15;
    this.onClaimApproved = onClaimApproved || (() => {});

    // In-memory tracking per box:
    // { [boxId]: { tempExceedStartTs: number|null, hasTempClaim: boolean, hasDropClaim: boolean } }
    this.boxState = new Map();
  }

  getBoxState(boxId) {
    if (!this.boxState.has(boxId)) {
      this.boxState.set(boxId, {
        tempExceedStartTs: null,
        hasTempClaim: false,
        hasDropClaim: false,
        hasHumidityClaim: false
      });
    }
    return this.boxState.get(boxId);
  }

  generatePayoutId() {
    return 'pay_' + Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 6);
  }

  /**
   * Evaluates a new telemetry or event record
   */
  async processRecord(record, ClaimModel, PayoutModel, io) {
    const boxId = record.box_id;
    const state = this.getBoxState(boxId);

    // 1. Check DROP / SHOCK
    const isDrop = (record.shock === 1 || record.shock === true || record.event === 'DROP');
    if (isDrop && !state.hasDropClaim) {
      // Check if claim already exists in DB to prevent duplicates across restarts
      let existingClaim = null;
      if (ClaimModel) {
        existingClaim = await ClaimModel.findOne({ box_id: boxId, type: 'DROP' });
      }

      if (!existingClaim) {
        state.hasDropClaim = true;
        const claimData = {
          box_id: boxId,
          type: 'DROP',
          status: 'APPROVED',
          reason: `High impact drop detected at seq #${record.seq} (Shock: 1)`,
          triggerSeq: record.seq,
          ts: record.ts,
          createdAt: new Date()
        };

        let savedClaim = claimData;
        if (ClaimModel) {
          savedClaim = await ClaimModel.create(claimData);
        }

        const payoutData = {
          payout_id: this.generatePayoutId(),
          claim_id: String(savedClaim._id || savedClaim.triggerSeq || 'claim_drop'),
          box_id: boxId,
          amount_inr: 25000,
          currency: 'INR',
          status: 'TRANSFERRED',
          beneficiary: 'PharmaSupply Logistics Ltd.',
          timestamp: new Date()
        };

        let savedPayout = payoutData;
        if (PayoutModel) {
          savedPayout = await PayoutModel.create(payoutData);
        }

        console.log(`[INSURANCE] DROP Claim APPROVED for ${boxId} -> Payout ${savedPayout.payout_id} (₹${savedPayout.amount_inr})`);
        
        if (io) {
          io.emit('claim', savedClaim);
          io.emit('payout', savedPayout);
        }

        this.onClaimApproved(savedClaim, savedPayout);
      } else {
        state.hasDropClaim = true;
      }
    }

    // 2. Check TEMPERATURE BREACH
    // Perishable goods (CAKE, cold chain pharmaceuticals) have cold-chain <= 8°C limit.
    // General dry cargo / electronics (TV, BOOKS) have normal industrial heat limit (50°C).
    const isColdChain = !boxId.toUpperCase().startsWith('TV') && !boxId.toUpperCase().startsWith('BOOKS');
    const tempThreshold = isColdChain ? this.claimTempC : 50.0;
    const tempExceeded = record.temp_c > tempThreshold || record.event === 'TEMP_BREACH';

    if (tempExceeded) {
      if (state.tempExceedStartTs === null) {
        state.tempExceedStartTs = record.ts;
      }

      const elapsedSec = record.ts - state.tempExceedStartTs;

      if (elapsedSec >= this.claimWindowSec && !state.hasTempClaim) {
        let existingClaim = null;
        if (ClaimModel) {
          existingClaim = await ClaimModel.findOne({ box_id: boxId, type: 'TEMP_BREACH' });
        }

        if (!existingClaim) {
          state.hasTempClaim = true;
          const claimData = {
            box_id: boxId,
            type: 'TEMP_BREACH',
            status: 'APPROVED',
            reason: `Temperature exceeded ${tempThreshold}°C for ${elapsedSec}s (Threshold: ${this.claimWindowSec}s, Current: ${record.temp_c}°C) - Cargo Spoiled, Returned`,
            triggerSeq: record.seq,
            ts: record.ts,
            createdAt: new Date()
          };

          let savedClaim = claimData;
          if (ClaimModel) {
            savedClaim = await ClaimModel.create(claimData);
          }

          const payoutData = {
            payout_id: this.generatePayoutId(),
            claim_id: String(savedClaim._id || savedClaim.triggerSeq || 'claim_temp'),
            box_id: boxId,
            amount_inr: 50000,
            currency: 'INR',
            status: 'TRANSFERRED',
            beneficiary: 'CakeCraft Confectionery Ltd.',
            timestamp: new Date()
          };

          let savedPayout = payoutData;
          if (PayoutModel) {
            savedPayout = await PayoutModel.create(payoutData);
          }

          console.log(`[INSURANCE] TEMP_BREACH Claim APPROVED for ${boxId} -> Payout ${savedPayout.payout_id} (₹${savedPayout.amount_inr})`);

          if (io) {
            io.emit('claim', savedClaim);
            io.emit('payout', savedPayout);
          }

          this.onClaimApproved(savedClaim, savedPayout);
        } else {
          state.hasTempClaim = true;
        }
      }
    } else {
      // Temperature returned to normal before window elapsed
      if (!state.hasTempClaim) {
        state.tempExceedStartTs = null;
      }
    }

    // 3. Check HUMIDITY BREACH (Critical for Electronics / TV)
    const humidityThreshold = 75.0; // Standard electronics humidity limit %
    const humidityExceeded = (record.humidity > humidityThreshold) || (record.event === 'HUMIDITY_BREACH');

    if (humidityExceeded && !state.hasHumidityClaim) {
      let existingClaim = null;
      if (ClaimModel) {
        existingClaim = await ClaimModel.findOne({ box_id: boxId, type: 'HUMIDITY_BREACH' });
      }

      if (!existingClaim) {
        state.hasHumidityClaim = true;
        const claimData = {
          box_id: boxId,
          type: 'HUMIDITY_BREACH',
          status: 'APPROVED',
          reason: `High humidity breach detected: ${record.humidity}% (Threshold: ${humidityThreshold}%) - Circuit Short Risk, Returned`,
          triggerSeq: record.seq,
          ts: record.ts,
          createdAt: new Date()
        };

        let savedClaim = claimData;
        if (ClaimModel) {
          savedClaim = await ClaimModel.create(claimData);
        }

        const payoutData = {
          payout_id: this.generatePayoutId(),
          claim_id: String(savedClaim._id || savedClaim.triggerSeq || 'claim_humidity'),
          box_id: boxId,
          amount_inr: 30000,
          currency: 'INR',
          status: 'TRANSFERRED',
          beneficiary: 'Sony Electronics Logistics Ltd.',
          timestamp: new Date()
        };

        let savedPayout = payoutData;
        if (PayoutModel) {
          savedPayout = await PayoutModel.create(payoutData);
        }

        console.log(`[INSURANCE] HUMIDITY_BREACH Claim APPROVED for ${boxId} -> Payout ${savedPayout.payout_id} (₹${savedPayout.amount_inr})`);

        if (io) {
          io.emit('claim', savedClaim);
          io.emit('payout', savedPayout);
        }

        this.onClaimApproved(savedClaim, savedPayout);
      } else {
        state.hasHumidityClaim = true;
      }
    }
  }
}

module.exports = InsuranceEngine;

