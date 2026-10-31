import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { 
  Check, 
  X, 
  Copy, 
  ArrowLeft, 
  QrCode, 
  RefreshCw,
  Box
} from 'lucide-react';
import { io } from 'socket.io-client';
import Skeleton from '../components/Skeleton';

export default function VerifyPage() {
  const { boxId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [lastAuditTime, setLastAuditTime] = useState(new Date());
  const [isScanning, setIsScanning] = useState(false);
  const [scanInput, setScanInput] = useState('');

  const checkChain = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/verify/${encodeURIComponent(boxId)}`);
      const json = await res.json();
      setData(json);
      setLastAuditTime(new Date());
    } catch (e) {
      setData({ 
        ok: false, 
        count: 0, 
        brokenAt: 0, 
        reason: 'Unable to communicate with verification service.' 
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkChain();

    // Auto-refresh when record or tamper event arrives
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

  const copyFingerprint = () => {
    const val = data?.latestHash || '0000000000000000000000000000000000000000000000000000000000000000';
    navigator.clipboard.writeText(val);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleScanSubmit = (e) => {
    e.preventDefault();
    if (scanInput.trim()) {
      const clean = scanInput.trim();
      setScanInput('');
      setIsScanning(false);
      navigate(`/verify/${encodeURIComponent(clean)}`);
    }
  };

  const isEmpty = data && (data.count === 0 || data.empty === true);
  const isVerified = data && data.ok === true && !isEmpty;
  const isTampered = data && data.ok === false;

  const rawHash = data?.latestHash || '0000000000000000000000000000000000000000000000000000000000000000';
  const shortFingerprint = `${rawHash.slice(0, 8)}...${rawHash.slice(-4)}`;

  return (
    <div className="min-h-screen bg-background text-ink flex flex-col justify-between p-4 sm:p-6 lg:p-10 transition-colors duration-200">
      {/* Top bar with logo and back link */}
      <header className="max-w-[560px] w-full mx-auto flex items-center justify-between pb-6">
        <Link 
          to="/" 
          className="inline-flex items-center gap-1.5 text-[14px] font-medium text-muted hover:text-ink transition duration-150"
        >
          <ArrowLeft className="w-4 h-4" strokeWidth={1.75} />
          <span>Dashboard</span>
        </Link>

        {/* Brand identity */}
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-ink text-surface flex items-center justify-center">
            <Box className="w-3.5 h-3.5" strokeWidth={2} />
          </div>
          <span className="text-[14px] font-semibold tracking-tight text-ink">TrustBox</span>
        </div>

        <button
          onClick={checkChain}
          disabled={loading}
          className="p-1.5 rounded-lg text-muted hover:text-ink hover:bg-surface transition duration-150"
          aria-label="Refresh audit"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} strokeWidth={1.75} />
        </button>
      </header>

      {/* Main card */}
      <main className="max-w-[560px] w-full mx-auto my-auto py-6">
        {loading && !data ? (
          <div className="space-y-6 text-center py-10">
            <div className="w-24 h-24 rounded-full mx-auto skeleton" />
            <Skeleton className="h-10 w-48 mx-auto" />
            <Skeleton className="h-5 w-64 mx-auto" />
            <div className="pt-6 space-y-4">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          </div>
        ) : isTampered ? (
          /* TAMPERED STATUS */
          <div className="text-center animate-fade-in">
            {/* 96px danger circle */}
            <div className="w-24 h-24 rounded-full bg-danger-tint border border-danger/20 text-danger flex items-center justify-center mx-auto mb-6">
              <X className="w-12 h-12" strokeWidth={2.25} />
            </div>

            <h1 className="text-[44px] sm:text-[48px] font-bold tracking-tight text-ink leading-tight">
              Tampered
            </h1>

            <p className="mt-2 text-[16px] text-muted">
              Records were changed after delivery began.
            </p>

            {data?.brokenAt !== null && data?.brokenAt !== undefined && (
              <p className="mt-1 text-[14px] text-danger font-medium">
                First problem found at reading #{data.brokenAt}
              </p>
            )}

            {/* 3-row list with hairline dividers */}
            <div className="mt-10 border-t border-hairline text-left divide-y divide-hairline">
              <div className="py-4 flex items-center justify-between text-[15px]">
                <span className="text-muted">Readings checked</span>
                <span className="font-semibold text-ink tabular">{data?.count ?? 0}</span>
              </div>

              <div className="py-4 flex items-center justify-between text-[15px]">
                <span className="text-muted">Last reading</span>
                <span className="font-medium text-ink tabular">
                  {lastAuditTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>

              <div className="py-4 flex items-center justify-between text-[15px]">
                <span className="text-muted">Digital fingerprint</span>
                <button
                  onClick={copyFingerprint}
                  className="inline-flex items-center gap-1.5 font-mono text-[13px] text-ink hover:text-muted transition"
                  title="Copy full fingerprint"
                >
                  <span className="tabular">{shortFingerprint}</span>
                  <Copy className="w-3.5 h-3.5 text-muted" strokeWidth={1.75} />
                  {copied && <span className="text-[12px] text-safe font-sans font-medium">Copied</span>}
                </button>
              </div>
            </div>
          </div>
        ) : isEmpty ? (
          /* EMPTY STATE */
          <div className="text-center animate-fade-in">
            <div className="w-24 h-24 rounded-full bg-surface border border-hairline text-muted flex items-center justify-center mx-auto mb-6">
              <Box className="w-10 h-10" strokeWidth={1.5} />
            </div>

            <h1 className="text-[40px] sm:text-[48px] font-bold tracking-tight text-ink leading-tight">
              Awaiting data
            </h1>

            <p className="mt-2 text-[16px] text-muted">
              No readings recorded yet for box {boxId}.
            </p>

            <div className="mt-10 border-t border-hairline text-left divide-y divide-hairline">
              <div className="py-4 flex items-center justify-between text-[15px]">
                <span className="text-muted">Readings checked</span>
                <span className="font-semibold text-ink tabular">0</span>
              </div>
              <div className="py-4 flex items-center justify-between text-[15px]">
                <span className="text-muted">Status</span>
                <span className="font-medium text-muted">Awaiting initial reading</span>
              </div>
            </div>
          </div>
        ) : (
          /* VERIFIED STATUS */
          <div className="text-center animate-fade-in">
            {/* 96px safe circle */}
            <div className="w-24 h-24 rounded-full bg-safe-tint border border-safe/20 text-safe flex items-center justify-center mx-auto mb-6">
              <Check className="w-12 h-12" strokeWidth={2.25} />
            </div>

            <h1 className="text-[44px] sm:text-[48px] font-bold tracking-tight text-ink leading-tight">
              Verified
            </h1>

            <p className="mt-2 text-[16px] text-muted">
              This delivery's records are untouched.
            </p>

            {/* 3-row list with hairline dividers */}
            <div className="mt-10 border-t border-hairline text-left divide-y divide-hairline">
              <div className="py-4 flex items-center justify-between text-[15px]">
                <span className="text-muted">Readings checked</span>
                <span className="font-semibold text-ink tabular">{data?.count ?? 0}</span>
              </div>

              <div className="py-4 flex items-center justify-between text-[15px]">
                <span className="text-muted">Last reading</span>
                <span className="font-medium text-ink tabular">
                  {lastAuditTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>

              <div className="py-4 flex items-center justify-between text-[15px]">
                <span className="text-muted">Digital fingerprint</span>
                <button
                  onClick={copyFingerprint}
                  className="inline-flex items-center gap-1.5 font-mono text-[13px] text-ink hover:text-muted transition"
                  title="Copy full fingerprint"
                >
                  <span className="tabular">{shortFingerprint}</span>
                  <Copy className="w-3.5 h-3.5 text-muted" strokeWidth={1.75} />
                  {copied && <span className="text-[12px] text-safe font-sans font-medium">Copied</span>}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Scan another box action */}
        <div className="mt-8 text-center">
          {!isScanning ? (
            <button
              onClick={() => setIsScanning(true)}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-[12px] bg-surface hover:bg-background border border-hairline text-ink text-[14px] font-medium transition duration-150"
            >
              <QrCode className="w-4 h-4 text-muted" strokeWidth={1.75} />
              <span>Scan another box</span>
            </button>
          ) : (
            <div className="relative p-6 rounded-20 bg-surface border border-hairline overflow-hidden animate-scale-in text-left">
              {/* Thin corner bracket overlay */}
              <div className="absolute top-3 left-3 w-3 h-3 border-t border-l border-ink" />
              <div className="absolute top-3 right-3 w-3 h-3 border-t border-r border-ink" />
              <div className="absolute bottom-3 left-3 w-3 h-3 border-b border-l border-ink" />
              <div className="absolute bottom-3 right-3 w-3 h-3 border-b border-r border-ink" />

              <div className="text-[12px] font-medium uppercase tracking-widest text-muted mb-2">
                Verify Box ID
              </div>

              <form onSubmit={handleScanSubmit} className="flex gap-2">
                <input
                  type="text"
                  value={scanInput}
                  onChange={(e) => setScanInput(e.target.value)}
                  placeholder="e.g. TB-001 or TB-DEMO-01"
                  className="flex-1 px-3.5 py-2 rounded-[10px] bg-background border border-hairline text-[14px] text-ink focus:outline-none focus:ring-1 focus:ring-ink"
                  autoFocus
                />
                <button
                  type="submit"
                  className="px-4 py-2 rounded-[10px] bg-accent text-accent-ink text-[14px] font-medium hover:opacity-90 transition"
                >
                  Verify
                </button>
              </form>

              <button
                type="button"
                onClick={() => setIsScanning(false)}
                className="mt-3 text-[12px] text-muted hover:text-ink"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-[560px] w-full mx-auto text-center pt-6 border-t border-hairline">
        <p className="text-[12px] text-faint">
          Every reading is sealed and cannot be changed without detection.
        </p>
      </footer>
    </div>
  );
}
