import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { 
  ShieldCheck, 
  ShieldAlert, 
  RefreshCw, 
  Copy, 
  Check, 
  ArrowLeft, 
  AlertTriangle,
  Lock,
  Layers,
  Clock,
  Sparkles
} from 'lucide-react';
import { io } from 'socket.io-client';

export default function VerifyPage() {
  const { boxId } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [lastChecked, setLastChecked] = useState(new Date());

  const checkChain = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/verify/${boxId}`);
      const json = await res.json();
      setData(json);
      setLastChecked(new Date());
    } catch (e) {
      console.error('Verification request failed:', e);
      setData({ ok: false, count: 0, brokenAt: 0, reason: 'Failed to communicate with verification node.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkChain();

    // Re-verify automatically on live records or tamper events
    const socket = io();
    socket.on('tamper', (info) => {
      if (info.box_id === boxId) checkChain();
    });
    socket.on('record', (rec) => {
      if (rec.box_id === boxId) checkChain();
    });
    socket.on('reset', (info) => {
      if (info.box_id === boxId) checkChain();
    });

    return () => {
      socket.disconnect();
    };
  }, [boxId]);

  const copyHash = () => {
    if (data?.latestHash) {
      navigator.clipboard.writeText(data.latestHash);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const isIntact = data?.ok === true;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between p-4 sm:p-6 lg:p-8">
      {/* Mobile-Friendly Top Bar */}
      <div className="max-w-md w-full mx-auto flex items-center justify-between pb-4 border-b border-slate-800">
        <Link 
          to="/" 
          className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Dashboard</span>
        </Link>

        <div className="flex items-center gap-2">
          <span className="mono text-xs font-bold text-slate-300 bg-slate-900 px-2 py-1 rounded border border-slate-700">
            {boxId}
          </span>
          <button
            onClick={checkChain}
            disabled={loading}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
            title="Re-run verification"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-emerald-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Main Verification Verdict Card */}
      <div className="max-w-md w-full mx-auto my-auto py-6">
        {loading && !data ? (
          <div className="text-center py-12">
            <RefreshCw className="w-8 h-8 animate-spin text-emerald-400 mx-auto mb-3" />
            <p className="text-sm text-slate-400 font-mono">Auditing cryptographic ledger...</p>
          </div>
        ) : isIntact ? (
          /* GREEN: CHAIN INTACT */
          <div className="rounded-3xl border border-emerald-500/50 bg-gradient-to-b from-emerald-950/40 via-slate-900 to-slate-950 p-6 sm:p-8 text-center shadow-2xl glow-green animate-in zoom-in-95 duration-300">
            <div className="mx-auto w-20 h-20 rounded-full bg-emerald-500/20 border-2 border-emerald-500/40 flex items-center justify-center text-emerald-400 mb-5 shadow-lg shadow-emerald-500/20">
              <ShieldCheck className="w-12 h-12" />
            </div>

            <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-950/80 px-3 py-1 rounded-full border border-emerald-500/40 mb-3">
              <Sparkles className="w-3.5 h-3.5" />
              Cryptographic Audit Passed
            </div>

            <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight mb-2">
              {data?.count || 0} Records Intact
            </h1>

            <p className="text-xs sm:text-sm text-slate-300 mb-6 max-w-xs mx-auto leading-relaxed">
              Every telemetry record has been cryptographically verified against the previous record's SHA-256 hash and HMAC-SHA256 device key signature. Zero tampering detected.
            </p>

            {/* Metrics Breakdown */}
            <div className="grid grid-cols-2 gap-2.5 text-left mb-6">
              <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
                <span className="text-[11px] text-slate-500 block">Verified Records</span>
                <span className="text-lg font-bold text-white mono">{data?.count || 0}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
                <span className="text-[11px] text-slate-500 block">Genesis Block</span>
                <span className="text-lg font-bold text-emerald-400 mono">Seq #0</span>
              </div>
            </div>

            {/* Latest Hash Display */}
            <div className="text-left bg-slate-950 p-3.5 rounded-2xl border border-slate-800">
              <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1.5">
                <span className="flex items-center gap-1 font-semibold text-slate-300">
                  <Lock className="w-3.5 h-3.5 text-emerald-400" /> Latest Block Hash
                </span>
                <button
                  onClick={copyHash}
                  className="flex items-center gap-1 text-emerald-400 hover:text-emerald-300 transition"
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <div className="mono text-[11px] text-emerald-400/90 break-all select-all leading-snug">
                {data?.latestHash || '0000000000000000000000000000000000000000000000000000000000000000'}
              </div>
            </div>
          </div>
        ) : (
          /* RED: TAMPER DETECTED */
          <div className="rounded-3xl border border-rose-500/60 bg-gradient-to-b from-rose-950/50 via-slate-900 to-slate-950 p-6 sm:p-8 text-center shadow-2xl glow-red animate-in zoom-in-95 duration-300">
            <div className="mx-auto w-20 h-20 rounded-full bg-rose-500/20 border-2 border-rose-500/50 flex items-center justify-center text-rose-400 mb-5 shadow-lg shadow-rose-500/30 animate-pulse">
              <ShieldAlert className="w-12 h-12" />
            </div>

            <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-rose-400 bg-rose-950/80 px-3 py-1 rounded-full border border-rose-500/50 mb-3">
              <AlertTriangle className="w-3.5 h-3.5" />
              Cryptographic Tamper Alert
            </div>

            <h1 className="text-3xl sm:text-4xl font-black text-rose-400 tracking-tight mb-2">
              Tampered at #{data?.brokenAt ?? '?'}
            </h1>

            <p className="text-xs sm:text-sm text-slate-300 mb-6 max-w-xs mx-auto leading-relaxed">
              Cryptographic integrity failure. The record stored at sequence #{data?.brokenAt} does not match its hash or device signature.
            </p>

            {/* Tamper Forensic Reason */}
            <div className="p-3.5 rounded-2xl bg-rose-950/80 border border-rose-500/40 text-left text-xs text-rose-200 mb-5">
              <div className="font-bold text-white mb-1 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                Forensic Breakdown
              </div>
              <p className="text-[11px] text-rose-200/90 leading-relaxed">
                {data?.reason || `Sequence #${data?.brokenAt} was modified in transit or database storage without possessing the cryptographic DEVICE_KEY.`}
              </p>
            </div>

            {/* Latest Hash Display */}
            <div className="text-left bg-slate-950 p-3.5 rounded-2xl border border-slate-800">
              <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1.5">
                <span className="flex items-center gap-1 font-semibold text-slate-300">
                  <Lock className="w-3.5 h-3.5 text-rose-400" /> Chain Tip Hash
                </span>
                <button
                  onClick={copyHash}
                  className="flex items-center gap-1 text-slate-400 hover:text-white transition"
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <div className="mono text-[11px] text-slate-400 break-all select-all leading-snug">
                {data?.latestHash || '0000000000000000000000000000000000000000000000000000000000000000'}
              </div>
            </div>
          </div>
        )}

        <div className="mt-4 flex items-center justify-center gap-2 text-xs text-slate-500">
          <Clock className="w-3.5 h-3.5" />
          <span>Last audit: {lastChecked.toLocaleTimeString()}</span>
        </div>
      </div>

      {/* Footer Info */}
      <div className="max-w-md w-full mx-auto text-center pt-4 border-t border-slate-800/80 text-[11px] text-slate-500">
        TrustBox Parametric Delivery Security &middot; SHA-256 + HMAC-SHA256
      </div>
    </div>
  );
}

