import React, { useEffect } from 'react';
import { ShieldCheck, Check } from 'lucide-react';
import confetti from 'canvas-confetti';

export default function PayoutCard({ claim, payout }) {
  useEffect(() => {
    if (payout?.payout_id) {
      try {
        // Subtle, refined celebration
        confetti({
          particleCount: 28,
          spread: 45,
          startVelocity: 25,
          ticks: 120,
          origin: { y: 0.65 },
          colors: ['#0A0A0A', '#059669', '#6B7280']
        });
      } catch {
        // ignore
      }
    }
  }, [payout?.payout_id]);

  if (!claim && !payout) return null;

  const rawAmount = payout?.amount_inr || 50000;
  const formattedAmount = `₹${rawAmount.toLocaleString('en-IN')}`;

  // Plain human language reason
  let humanReason = claim?.reason || 'Verified breach of delivery temperature threshold.';
  if (claim?.type === 'TEMP_BREACH') {
    humanReason = 'Temperature stayed above 8°C for more than 15 seconds.';
  } else if (claim?.type === 'DROP') {
    humanReason = 'High-impact drop occurred during transport.';
  }

  const beneficiary = payout?.beneficiary || 'PharmaSupply Logistics Ltd.';
  const dateStr = payout?.timestamp 
    ? new Date(payout.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <div className="flex flex-col justify-between h-full">
      <div>
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-1.5 text-safe text-[13px] font-medium">
            <ShieldCheck className="w-4 h-4" strokeWidth={1.75} />
            <span>Automatic settlement</span>
          </div>
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[12px] font-medium bg-safe-tint text-safe border border-safe/20">
            <Check className="w-3 h-3" strokeWidth={2} />
            Paid
          </span>
        </div>

        <div className="text-[52px] sm:text-[56px] font-bold tracking-tight text-ink leading-none tabular my-2">
          {formattedAmount}
        </div>

        <p className="text-[14px] text-ink font-normal leading-relaxed mt-3">
          {humanReason}
        </p>
      </div>

      <div className="pt-4 mt-6 border-t border-hairline flex items-center justify-between text-[12px] text-muted">
        <span>Beneficiary: {beneficiary}</span>
        <span className="tabular">{dateStr}</span>
      </div>
    </div>
  );
}
