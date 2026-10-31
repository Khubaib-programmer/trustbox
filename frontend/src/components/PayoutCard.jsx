import React, { useEffect } from 'react';
import { CheckCircle2, ShieldCheck, Banknote, ArrowRight, Sparkles } from 'lucide-react';
import confetti from 'canvas-confetti';

export default function PayoutCard({ claim, payout }) {
  useEffect(() => {
    // Trigger confetti burst on payout arrival
    try {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 }
      });
    } catch (e) {
      // ignore
    }
  }, [payout?.payout_id]);

  if (!claim && !payout) return null;

  const isTemp = claim?.type === 'TEMP_BREACH';
  const amount = payout?.amount_inr ? `₹${payout.amount_inr.toLocaleString('en-IN')}` : '₹50,000';
  const payoutId = payout?.payout_id || 'pay_live_mock';

  return (
    <div className="relative overflow-hidden rounded-2xl border border-emerald-500/40 bg-gradient-to-br from-emerald-950/60 via-slate-900/90 to-slate-950 p-6 shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-bottom duration-500">
      {/* Background radial glow */}
      <div className="absolute -top-12 -right-12 w-48 h-48 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />

      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-wider font-bold text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-500/40">
                Parametric Insurance
              </span>
              <span className="flex items-center gap-1 text-xs text-emerald-300 font-semibold">
                <Sparkles className="w-3.5 h-3.5" /> Auto-Approved
              </span>
            </div>
            <h3 className="text-lg font-bold text-white mt-0.5">
              Instant Claim Settlement
            </h3>
          </div>
        </div>

        <div className="text-right">
          <div className="text-2xl font-extrabold text-emerald-400 tracking-tight">
            {amount}
          </div>
          <div className="text-xs text-slate-400">Instant Mock UPI/NEFT</div>
        </div>
      </div>

      {/* Reason Banner */}
      <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-sm text-slate-300 mb-4 flex items-start gap-2">
        <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
        <div>
          <span className="font-semibold text-white">Trigger: </span>
          <span>{claim?.reason || 'Verified breach of custody parameter.'}</span>
        </div>
      </div>

      {/* Forensic Verification Metadata */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-3 border-t border-slate-800 text-xs">
        <div>
          <span className="text-slate-500 block">Payout Reference</span>
          <span className="mono font-semibold text-emerald-300 truncate block">{payoutId}</span>
        </div>
        <div>
          <span className="text-slate-500 block">Settlement Status</span>
          <span className="font-semibold text-emerald-400 flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            TRANSFERRED
          </span>
        </div>
        <div className="col-span-2 sm:col-span-1">
          <span className="text-slate-500 block">Beneficiary</span>
          <span className="text-slate-200 truncate block">{payout?.beneficiary || 'PharmaSupply Logistics Ltd.'}</span>
        </div>
      </div>
    </div>
  );
}

