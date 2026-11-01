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
      let existingClaim = null;
      if (ClaimModel) {
        existingClaim = await ClaimModel.findOne({ box_id: boxId, type: 'DROP' });
      }

      if (!existingClaim) {
        state.hasDropClaim = true;

        // Custom amount & beneficiary per category
        let amount_inr = 25000;
        let beneficiary = 'PharmaSupply Logistics Ltd.';
        let reason = `High impact drop detected at seq #${record.seq} (Shock: 1)`;

        const upperBox = boxId.toUpperCase();
        if (upperBox.startsWith('VACCINE')) {
          amount_inr = 75000;
          beneficiary = 'Serum Institute Logistics Ltd.';
          reason = `Violent impact drop detected (>4.5G): High risk of vial micro-fractures and vaccine degradation.`;
        } else if (upperBox.startsWith('TV')) {
          amount_inr = 45000;
          beneficiary = 'Sony Electronics Logistics Ltd.';
          reason = `Violent High-G Drop Impact Detected: OLED display panel shattered against cargo barrier. Delivery cancelled.`;
        } else if (upperBox.startsWith('FRAGILE') || upperBox.startsWith('GLASS')) {
          amount_inr = 35000;
          beneficiary = 'Bohemia Crystal Imports Ltd.';
          reason = `Drop shock detected: Ultra-fragile glassware shattered in transit.`;
        } else if (upperBox.startsWith('ELECTRONIC') || upperBox.startsWith('LAPTOP')) {
          amount_inr = 45000;
          beneficiary = 'Dell Global Logistics Corp.';
          reason = `Severe mechanical shock (>5G): Motherboard micro-trace crack hazard detected.`;
        } else if (upperBox.startsWith('CAKE')) {
          amount_inr = 25000;
          beneficiary = 'CakeCraft Confectionery Ltd.';
          reason = `Violent van pothole impact: Cake structural collapse and side container damage. Delivery cancelled.`;
        }

        const claimData = {
          box_id: boxId,
          type: 'DROP',
          status: 'APPROVED',
          reason,
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
          amount_inr,
          currency: 'INR',
          status: 'TRANSFERRED',
          beneficiary,
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
    // Perishable goods (VACCINE, CAKE, cold chain biologics) have cold-chain <= 8°C limit.
    // General dry cargo / electronics (TV, BOOKS, FRAGILE) have normal industrial heat limit (50°C).
    const upperBox = boxId.toUpperCase();
    const isColdChain = upperBox.startsWith('VACCINE') || upperBox.startsWith('CAKE') || upperBox.startsWith('TB');
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

          let amount_inr = 50000;
          let beneficiary = 'PharmaSupply Logistics Ltd.';
          let reason = `Temperature exceeded ${tempThreshold}°C for ${elapsedSec}s (Threshold: ${this.claimWindowSec}s, Current: ${record.temp_c}°C) - Cargo Spoiled, Returned`;

          if (upperBox.startsWith('VACCINE')) {
            amount_inr = 150000;
            beneficiary = 'Serum Institute Logistics Ltd.';
            reason = `Critical Vaccine Cold-Chain Failure: Temperature ${record.temp_c}°C exceeded 8.0°C for ${elapsedSec}s. Active antigens neutralized. Payout auto-settled.`;
          } else if (upperBox.startsWith('CAKE')) {
            amount_inr = 50000;
            beneficiary = 'CakeCraft Confectionery Ltd.';
            reason = `Severe Temperature Breach: Reached ${record.temp_c}°C (> 8.0°C limit) for ${elapsedSec}s. Cream melted and decorations liquefied. Delivery cancelled.`;
          }

          const claimData = {
            box_id: boxId,
            type: 'TEMP_BREACH',
            status: 'APPROVED',
            reason,
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
            amount_inr,
            currency: 'INR',
            status: 'TRANSFERRED',
            beneficiary,
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

    // 3. Check HUMIDITY BREACH (Critical for Electronics / TV / Laptops)
    const humidityThreshold = 70.0; // Standard electronics humidity limit %
    const humidityExceeded = (record.humidity > humidityThreshold) || (record.event === 'HUMIDITY_BREACH');

    if (humidityExceeded && !state.hasHumidityClaim) {
      let existingClaim = null;
      if (ClaimModel) {
        existingClaim = await ClaimModel.findOne({ box_id: boxId, type: 'HUMIDITY_BREACH' });
      }

      if (!existingClaim) {
        state.hasHumidityClaim = true;

        let amount_inr = 30000;
        let beneficiary = 'Sony Electronics Logistics Ltd.';
        let reason = `High humidity breach detected: ${record.humidity}% (Threshold: ${humidityThreshold}%) - Circuit Short Risk, Returned`;

        if (upperBox.startsWith('ELECTRONIC') || upperBox.startsWith('LAPTOP')) {
          amount_inr = 45000;
          beneficiary = 'Dell Global Logistics Corp.';
          reason = `Critical Moisture Breach: Humidity ${record.humidity}% (>70%) detected inside sealed computing enclosure. High corrosion risk.`;
        }

        const claimData = {
          box_id: boxId,
          type: 'HUMIDITY_BREACH',
          status: 'APPROVED',
          reason,
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
          amount_inr,
          currency: 'INR',
          status: 'TRANSFERRED',
          beneficiary,
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

    // 4. Check TILT / FLIPPED (Critical for Fragile Glassware, Ceramics & TVs)
    const isTilt = (record.tilt === 1 || record.flipped === 1 || record.event === 'FLIPPED' || record.event === 'TILT');
    if (isTilt && !state.hasTiltClaim) {
      let existingClaim = null;
      if (ClaimModel) {
        existingClaim = await ClaimModel.findOne({ box_id: boxId, type: 'TILT' });
      }

      if (!existingClaim) {
        state.hasTiltClaim = true;

        let amount_inr = 35000;
        let beneficiary = 'Bohemia Crystal Imports Ltd.';
        let reason = `Fragile cargo tipped / inverted (Tilt/Flipped: 1) - 'THIS SIDE UP' violation, Glassware shattered.`;

        if (upperBox.startsWith('TV')) {
          amount_inr = 40000;
          beneficiary = 'Sony Electronics Logistics Ltd.';
          reason = `TV transported horizontally/flipped: Mechanical pressure exceeded panel tolerance.`;
        }

        const claimData = {
          box_id: boxId,
          type: 'TILT',
          status: 'APPROVED',
          reason,
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
          claim_id: String(savedClaim._id || savedClaim.triggerSeq || 'claim_tilt'),
          box_id: boxId,
          amount_inr,
          currency: 'INR',
          status: 'TRANSFERRED',
          beneficiary,
          timestamp: new Date()
        };

        let savedPayout = payoutData;
        if (PayoutModel) {
          savedPayout = await PayoutModel.create(payoutData);
        }

        console.log(`[INSURANCE] TILT Claim APPROVED for ${boxId} -> Payout ${savedPayout.payout_id} (₹${savedPayout.amount_inr})`);

        if (io) {
          io.emit('claim', savedClaim);
          io.emit('payout', savedPayout);
        }

        this.onClaimApproved(savedClaim, savedPayout);
      } else {
        state.hasTiltClaim = true;
      }
    }
  }
}

module.exports = InsuranceEngine;

