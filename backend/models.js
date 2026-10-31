const mongoose = require('mongoose');

const RecordSchema = new mongoose.Schema({
  box_id: { type: String, required: true, index: true },
  seq: { type: Number, required: true },
  ts: { type: Number, required: true },
  temp_c: { type: Number, required: true },
  humidity: { type: Number, required: true },
  shock: { type: Number, required: true },
  tilt: { type: Number, required: true },
  flipped: { type: Number, required: true },
  light: { type: Number, required: true },
  lid_open: { type: Number, required: true },
  event: { type: String, required: true, default: 'NONE' },
  prev_hash: { type: String, required: true },
  hash: { type: String, required: true },
  sig: { type: String, required: true },
  receivedAt: { type: Date, default: Date.now }
}, {
  timestamps: true
});

// Reject duplicates by box_id + seq
RecordSchema.index({ box_id: 1, seq: 1 }, { unique: true });

const ClaimSchema = new mongoose.Schema({
  box_id: { type: String, required: true, index: true },
  type: { type: String, required: true, enum: ['TEMP_BREACH', 'DROP', 'TILT', 'TAMPER'] },
  status: { type: String, default: 'APPROVED' },
  reason: { type: String, required: true },
  triggerSeq: { type: Number },
  ts: { type: Number },
  createdAt: { type: Date, default: Date.now }
});

const PayoutSchema = new mongoose.Schema({
  payout_id: { type: String, required: true, unique: true },
  claim_id: { type: String },
  box_id: { type: String, required: true },
  amount_inr: { type: Number, required: true },
  currency: { type: String, default: 'INR' },
  status: { type: String, default: 'TRANSFERRED' },
  beneficiary: { type: String, default: 'PharmaSupply Logistics Ltd.' },
  timestamp: { type: Date, default: Date.now }
});

const Record = mongoose.model('Record', RecordSchema);
const Claim = mongoose.model('Claim', ClaimSchema);
const Payout = mongoose.model('Payout', PayoutSchema);

module.exports = {
  Record,
  Claim,
  Payout
};

