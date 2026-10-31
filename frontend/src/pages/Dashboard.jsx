import React, { useState, useEffect, useCallback, useRef } from 'react';
import { io } from 'socket.io-client';
import { 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ReferenceLine, 
  CartesianGrid 
} from 'recharts';
import { 
  Thermometer, 
  Droplets, 
  Activity, 
  ShieldAlert, 
  ShieldCheck, 
  Flame, 
  Compass, 
  Lock, 
  Unlock, 
  QrCode, 
  RotateCcw, 
  AlertTriangle,
  Radio,
  ExternalLink,
  Clock,
  Inbox,
  RefreshCw
} from 'lucide-react';
import { Link } from 'react-router-dom';
import RouteMap from '../components/RouteMap';
import PayoutCard from '../components/PayoutCard';
import QRCodeModal from '../components/QRCodeModal';

export default function Dashboard() {
  const [boxId, setBoxId] = useState('TB-001');
  const [inputBoxId, setInputBoxId] = useState('TB-001');
  const [availableBoxes, setAvailableBoxes] = useState(['TB-001', 'TB-DEMO-01', 'TB-TEST']);
  const [isConnected, setIsConnected] = useState(false);
  const [backendError, setBackendError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const [records, setRecords] = useState([]);
  const [claims, setClaims] = useState([]);
  const [payouts, setPayouts] = useState([]);
  const [latestRecord, setLatestRecord] = useState(null);
  const [chainVerify, setChainVerify] = useState(null);

  const [isTamperLoading, setIsTamperLoading] = useState(false);
  const [tamperSuccessMsg, setTamperSuccessMsg] = useState(null);
  const [selectedTamperSeq, setSelectedTamperSeq] = useState('');
  const [isQrOpen, setIsQrOpen] = useState(false);

  // References to prevent race conditions and cross-device stale overwrites
  const activeBoxRef = useRef(boxId);
  const activeRequestIdRef = useRef(0);

  // Always keep activeBoxRef in sync with boxId
  useEffect(() => {
    activeBoxRef.current = boxId;
  }, [boxId]);

  // Fetch all known box IDs in system to populate selector
  const fetchBoxes = async () => {
    try {
      const res = await fetch('/api/boxes');
      if (res.ok) {
        const data = await res.json();
        if (data.boxes && Array.isArray(data.boxes)) {
          // Merge discovered boxes with defaults
          setAvailableBoxes((prev) => {
            const combined = Array.from(new Set([...data.boxes, ...prev, 'TB-001', 'TB-DEMO-01', 'TB-TEST']));
            return combined;
          });
        }
      }
    } catch {
      // Backend may be starting
    }
  };

  // Dedicated device change handler
  const handleDeviceChange = (newId) => {
    const cleanId = String(newId || '').trim();
    if (!cleanId) return;

    // Immediately update input and active box
    setInputBoxId(cleanId);
    setBoxId(cleanId);
    activeBoxRef.current = cleanId;

    // Clear stale state for previous device
    setTamperSuccessMsg(null);
    setBackendError(null);
    setIsLoading(true);
    setRecords([]);
    setClaims([]);
    setPayouts([]);
    setLatestRecord(null);
    setChainVerify(null);
  };

  // Form submit handler for custom box ID input
  const handleBoxSubmit = (e) => {
    e.preventDefault();
    if (inputBoxId.trim()) {
      handleDeviceChange(inputBoxId.trim());
    }
  };

  // Fetch box data and chain integrity with race-condition protection
  const fetchData = useCallback(async (targetId) => {
    const targetBox = (targetId || activeBoxRef.current).trim();
    if (!targetBox) return;

    const requestId = ++activeRequestIdRef.current;
    setIsLoading(true);
    setBackendError(null);

    try {
      const [recRes, claimRes, payRes, verifyRes] = await Promise.all([
        fetch(`/api/records/${encodeURIComponent(targetBox)}?limit=200`),
        fetch(`/api/claims/${encodeURIComponent(targetBox)}`),
        fetch(`/api/payouts/${encodeURIComponent(targetBox)}`),
        fetch(`/api/verify/${encodeURIComponent(targetBox)}`)
      ]);

      // If another request started while this was in-flight, discard this response
      if (requestId !== activeRequestIdRef.current || targetBox !== activeBoxRef.current) {
        return;
      }

      let parsedRecords = [];
      let parsedClaims = [];
      let parsedPayouts = [];
      let parsedVerify = null;

      if (recRes.ok) {
        const rawRec = await recRes.json();
        if (Array.isArray(rawRec)) {
          parsedRecords = rawRec;
        }
      } else {
        setBackendError(`Backend returned HTTP ${recRes.status} for records.`);
      }

      if (claimRes.ok) {
        const rawClaims = await claimRes.json();
        if (Array.isArray(rawClaims)) parsedClaims = rawClaims;
      }

      if (payRes.ok) {
        const rawPayouts = await payRes.json();
        if (Array.isArray(rawPayouts)) parsedPayouts = rawPayouts;
      }

      if (verifyRes.ok) {
        parsedVerify = await verifyRes.json();
      }

      // Check once more after async json() deserialization
      if (requestId !== activeRequestIdRef.current || targetBox !== activeBoxRef.current) {
        return;
      }

      // Atomically commit state for this device
      setRecords(parsedRecords);
      setClaims(parsedClaims);
      setPayouts(parsedPayouts);
      setChainVerify(parsedVerify);

      if (parsedRecords.length > 0) {
        // Records are in ascending seq order; last element is latest
        const latest = parsedRecords[parsedRecords.length - 1];
        setLatestRecord(latest);
        const midIndex = Math.floor(parsedRecords.length / 2);
        setSelectedTamperSeq(String(parsedRecords[midIndex].seq));
      } else {
        setLatestRecord(null);
        setSelectedTamperSeq('');
      }
    } catch (err) {
      if (requestId === activeRequestIdRef.current && targetBox === activeBoxRef.current) {
        console.error('Error fetching data from backend:', err);
        setBackendError('Cannot connect to backend server on port 4000. Ensure backend is running.');
      }
    } finally {
      if (requestId === activeRequestIdRef.current && targetBox === activeBoxRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  // Fetch available boxes on initial mount
  useEffect(() => {
    fetchBoxes();
  }, []);

  // Main data sync & Socket.io setup when active boxId changes
  useEffect(() => {
    fetchData(boxId);

    // Setup Socket.io connection for real-time live feed
    const socket = io();

    socket.on('connect', () => {
      setIsConnected(true);
      setBackendError(null);
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    socket.on('record', (newRecord) => {
      if (newRecord.box_id === activeBoxRef.current) {
        setLatestRecord(newRecord);
        setRecords((prev) => {
          if (prev.some(r => r.seq === newRecord.seq)) return prev;
          const updated = [...prev, newRecord];
          return updated.slice(-100);
        });
        // Re-verify chain tip on incoming record
        fetch(`/api/verify/${encodeURIComponent(activeBoxRef.current)}`)
          .then(r => r.json())
          .then(v => {
            if (activeBoxRef.current === newRecord.box_id) {
              setChainVerify(v);
            }
          })
          .catch(() => {});
      }
    });

    socket.on('claim', (newClaim) => {
      if (newClaim.box_id === activeBoxRef.current) {
        setClaims((prev) => [newClaim, ...prev]);
      }
    });

    socket.on('payout', (newPayout) => {
      if (newPayout.box_id === activeBoxRef.current) {
        setPayouts((prev) => [newPayout, ...prev]);
      }
    });

    socket.on('tamper', (info) => {
      if (info.box_id === activeBoxRef.current) {
        fetchData(activeBoxRef.current);
      }
    });

    socket.on('reset', (info) => {
      if (info.box_id === activeBoxRef.current) {
        setRecords([]);
        setClaims([]);
        setPayouts([]);
        setLatestRecord(null);
        setTamperSuccessMsg(null);
        setChainVerify({ ok: true, empty: true, count: 0 });
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [boxId, fetchData]);

  // Handle Admin Tamper action
  const handleTamper = async () => {
    if (records.length === 0) {
      alert('No records stored yet for this box. Run fake-publisher.js first.');
      return;
    }
    const seqNum = selectedTamperSeq !== '' ? parseInt(selectedTamperSeq, 10) : records[0].seq;
    if (isNaN(seqNum)) {
      alert('Please enter a valid sequence number to tamper.');
      return;
    }

    if (!confirm(`Demonstrate Tamper Detection?\nThis will mutate record #${seqNum} of ${boxId} in the database without re-signing it.\nThe verification engine should immediately detect the altered hash.`)) {
      return;
    }

    setIsTamperLoading(true);
    try {
      const res = await fetch(`/api/admin/tamper/${encodeURIComponent(boxId)}/${seqNum}`, {
        method: 'POST'
      });
      const data = await res.json();
      if (res.ok) {
        setTamperSuccessMsg(`Record #${seqNum} of ${boxId} was modified in database! Verification will now flag this record.`);
        fetchData(boxId);
      } else {
        alert(data.error || 'Failed to tamper record');
      }
    } catch (e) {
      alert(e.message);
    } finally {
      setIsTamperLoading(false);
    }
  };

  // Handle Admin Reset action
  const handleReset = async () => {
    if (!confirm(`Reset all telemetry records, claims, and payouts for ${boxId}?\n(This will clear the chain for this box)`)) return;
    try {
      const res = await fetch(`/api/admin/reset/${encodeURIComponent(boxId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: true })
      });
      const data = await res.json();
      if (res.ok) {
        setRecords([]);
        setClaims([]);
        setPayouts([]);
        setLatestRecord(null);
        setTamperSuccessMsg(null);
        setChainVerify({ ok: true, empty: true, count: 0 });
        fetchBoxes();
      } else {
        alert(data.error || 'Failed to reset box');
      }
    } catch (e) {
      console.error(e);
      alert('Network error while resetting box.');
    }
  };

  // Authoritative record count from verification engine or records array
  const totalCount = (chainVerify?.count !== undefined && chainVerify?.count !== null)
    ? chainVerify.count
    : records.length;

  // Determine overall status flags
  const isTampered = chainVerify && chainVerify.ok === false;
  const isEmpty = !isLoading && totalCount === 0 && !isTampered;
  const hasBreach = claims.length > 0 || (latestRecord && (latestRecord.temp_c > 8.0 || latestRecord.shock === 1));

  // Chart data formatting
  const chartData = records.map(r => ({
    time: new Date(r.ts * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    temp: r.temp_c,
    humidity: r.humidity,
    seq: r.seq
  }));

  const activeClaim = claims[0];
  const activePayout = payouts[0];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Backend Offline Warning Banner */}
      {backendError && (
        <div className="p-3.5 rounded-xl bg-rose-950/90 border border-rose-500/70 text-rose-200 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span className="font-semibold">{backendError}</span>
          </div>
          <button 
            onClick={() => fetchData(boxId)} 
            className="px-2.5 py-1 rounded bg-rose-800 hover:bg-rose-700 text-white font-bold transition"
          >
            Retry Connection
          </button>
        </div>
      )}

      {/* Top Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
            <Radio className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">TrustBox Live Telemetry</h1>
              <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full border ${
                isConnected 
                  ? 'bg-emerald-950/80 text-emerald-400 border-emerald-500/40' 
                  : 'bg-rose-950/80 text-rose-400 border-rose-500/40'
              }`}>
                {isConnected ? 'LIVE FEED' : 'OFFLINE / RECONNECTING'}
              </span>
            </div>
            <p className="text-xs text-slate-400">Cryptographically Hash-Chained Parcel Custody Tracker &middot; SHA-256 + HMAC</p>
          </div>
        </div>

        {/* Box Selector & Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Quick Dropdown Selector for All Available Devices */}
          <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs shadow-inner">
            <span className="text-slate-400 font-medium">Device:</span>
            <select
              value={availableBoxes.includes(boxId) ? boxId : ''}
              onChange={(e) => {
                if (e.target.value) handleDeviceChange(e.target.value);
              }}
              className="bg-slate-950 text-emerald-400 font-mono font-bold px-2 py-0.5 rounded border border-slate-800 focus:outline-none focus:border-emerald-500 cursor-pointer"
            >
              {availableBoxes.map((id) => (
                <option key={id} value={id}>{id}</option>
              ))}
              {!availableBoxes.includes(boxId) && (
                <option value={boxId}>{boxId} (Custom)</option>
              )}
            </select>
          </div>

          {/* Custom Box ID Input Form */}
          <form onSubmit={handleBoxSubmit} className="flex items-center gap-1.5 bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs shadow-inner focus-within:border-emerald-500 focus-within:ring-1 focus-within:ring-emerald-500/50 transition">
            <input 
              type="text" 
              value={inputBoxId} 
              onChange={(e) => setInputBoxId(e.target.value)}
              placeholder="Custom Box ID"
              className="bg-slate-950 text-white font-mono font-bold w-24 sm:w-28 px-2 py-0.5 rounded border border-slate-800 focus:outline-none focus:border-emerald-500"
            />
            <button
              type="submit"
              className="px-2 py-0.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] transition"
            >
              Load
            </button>
          </form>

          {/* Quick device chips */}
          <div className="hidden sm:flex items-center gap-1 text-[11px]">
            {availableBoxes.slice(0, 4).map((b) => (
              <button
                key={b}
                type="button"
                onClick={() => handleDeviceChange(b)}
                className={`px-2 py-1 rounded-lg font-mono transition ${
                  b === boxId 
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold shadow-sm' 
                    : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                {b}
              </button>
            ))}
          </div>

          <button
            onClick={() => setIsQrOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition"
          >
            <QrCode className="w-4 h-4 text-emerald-400" />
            <span>Scan QR</span>
          </button>

          <Link
            to={`/verify/${encodeURIComponent(boxId)}`}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-lg shadow-emerald-900/30 transition"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Verify Chain</span>
            <ExternalLink className="w-3.5 h-3.5 opacity-70" />
          </Link>
        </div>
      </div>

      {/* Main Status Banner */}
      {isLoading ? (
        /* Loading Skeletons State */
        <div className="p-4 sm:p-5 rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-md flex items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="p-3 rounded-2xl bg-slate-800 text-slate-400 border border-slate-700 animate-spin">
              <RefreshCw className="w-8 h-8 text-emerald-400" />
            </div>
            <div>
              <div className="text-xs uppercase font-extrabold tracking-wider text-slate-400">Ledger Synchronization</div>
              <div className="text-xl sm:text-2xl font-black text-slate-200">
                SYNCING TELEMETRY LEDGER FOR {boxId}...
              </div>
              <div className="text-xs text-slate-400 mt-0.5">
                Verifying cryptographic hash chain and retrieving signed telemetry records...
              </div>
            </div>
          </div>
          <div className="bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-2 text-right">
            <div className="text-[11px] uppercase text-slate-400 font-semibold">Chained Records</div>
            <div className="text-2xl font-black text-slate-500 mono">--</div>
          </div>
        </div>
      ) : isTampered ? (
        /* Tampered State Banner */
        <div className="p-4 sm:p-5 rounded-2xl border border-rose-500/80 bg-rose-950/40 glow-red backdrop-blur-md flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="p-3 rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-500/40 animate-pulse">
              <ShieldAlert className="w-8 h-8" />
            </div>
            <div>
              <div className="text-xs uppercase font-extrabold tracking-wider text-rose-300">Cryptographic Integrity Alert</div>
              <div className="text-xl sm:text-2xl font-black text-rose-400">
                TAMPER DETECTED AT SEQ #{chainVerify?.brokenAt ?? '?'}
              </div>
              <div className="text-xs text-rose-200 mt-0.5">
                {chainVerify?.reason || 'Record hash mismatch detected in database ledger. Tampering identified.'}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link 
              to={`/verify/${encodeURIComponent(boxId)}`}
              className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-lg transition"
            >
              Inspect Forensic Report &rarr;
            </Link>
            <div className="bg-slate-900/80 border border-slate-800 rounded-xl px-4 py-2 text-right">
              <div className="text-[11px] uppercase text-slate-400 font-semibold">Chained Records</div>
              <div className="text-2xl font-black text-rose-400 mono">{totalCount}</div>
            </div>
          </div>
        </div>
      ) : isEmpty ? (
        /* Honest Empty State Banner */
        <div className="p-4 sm:p-5 rounded-2xl border border-slate-700 bg-slate-900/80 backdrop-blur-md flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="p-3 rounded-2xl bg-slate-800 text-slate-400 border border-slate-700">
              <Inbox className="w-8 h-8" />
            </div>
            <div>
              <div className="text-xs uppercase font-extrabold tracking-wider text-slate-400">Device Ledger Status</div>
              <div className="text-xl sm:text-2xl font-black text-slate-200">
                NO TELEMETRY RECORDED YET
              </div>
              <div className="text-xs text-slate-400 mt-0.5">
                Chain anchor is at genesis block <span className="mono text-white">#0</span>. Transmit records using <span className="mono text-emerald-400 font-semibold">fake-publisher.js</span> or physical ESP32 box.
              </div>
            </div>
          </div>
          <div className="bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-2 text-right">
            <div className="text-[11px] uppercase text-slate-400 font-semibold">Chained Records</div>
            <div className="text-2xl font-black text-slate-500 mono">0</div>
          </div>
        </div>
      ) : (
        /* Safe / Breach Banner */
        <div className={`p-4 sm:p-5 rounded-2xl border transition-all duration-300 flex flex-wrap items-center justify-between gap-4 ${
          hasBreach ? 'glass-panel-danger glow-red' : 'glass-panel-success glow-green'
        }`}>
          <div className="flex items-center gap-3.5">
            <div className={`p-3 rounded-2xl ${hasBreach ? 'bg-rose-500/20 text-rose-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
              {hasBreach ? <ShieldAlert className="w-8 h-8" /> : <ShieldCheck className="w-8 h-8" />}
            </div>
            <div>
              <div className="text-xs uppercase font-extrabold tracking-wider text-slate-400">Box Custody Health</div>
              <div className={`text-xl sm:text-2xl font-black ${hasBreach ? 'text-rose-400' : 'text-emerald-400'}`}>
                {hasBreach ? 'BREACH DETECTED — CLAIM TRIGGERED' : 'SAFE COLD CHAIN — ALL PARAMETERS INTACT'}
              </div>
              <div className="text-xs text-slate-300 mt-0.5">
                {latestRecord ? (
                  <span>Last verified record <span className="mono font-bold text-white">#{latestRecord.seq}</span> at {new Date(latestRecord.ts * 1000).toLocaleTimeString()}</span>
                ) : (
                  'Waiting for incoming records...'
                )}
              </div>
            </div>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-xl px-4 py-2 text-right">
            <div className="text-[11px] uppercase text-slate-400 font-semibold">Chained Records</div>
            <div className="text-2xl font-black text-white mono">
              {totalCount}
            </div>
          </div>
        </div>
      )}

      {/* Payout & Claim Card if Triggered */}
      {activePayout && (
        <PayoutCard claim={activeClaim} payout={activePayout} />
      )}

      {/* Live Metric Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Metric 1: Temperature */}
        <div className={`p-4 rounded-xl border glass-panel transition ${
          latestRecord?.temp_c > 8.0 ? 'border-rose-500/60 bg-rose-950/20' : 'border-slate-800'
        }`}>
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium mb-1">
            <span>Temperature</span>
            <Thermometer className={`w-4 h-4 ${latestRecord?.temp_c > 8.0 ? 'text-rose-400 animate-bounce' : 'text-emerald-400'}`} />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className={`text-2xl sm:text-3xl font-extrabold mono ${
              latestRecord?.temp_c > 8.0 ? 'text-rose-400' : 'text-emerald-400'
            }`}>
              {latestRecord ? `${latestRecord.temp_c.toFixed(1)}°C` : '--'}
            </span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
            <span>Limit: &le; 8.0°C</span>
            {latestRecord?.temp_c > 8.0 && <span className="text-rose-400 font-bold">(EXCEEDED)</span>}
          </div>
        </div>

        {/* Metric 2: Humidity */}
        <div className="p-4 rounded-xl border border-slate-800 glass-panel">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium mb-1">
            <span>Humidity</span>
            <Droplets className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl sm:text-3xl font-extrabold mono text-cyan-400">
              {latestRecord ? `${latestRecord.humidity.toFixed(1)}%` : '--'}
            </span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Normal target (40% - 70%)</div>
        </div>

        {/* Metric 3: Shock & Drop */}
        <div className={`p-4 rounded-xl border glass-panel transition ${
          latestRecord?.shock === 1 ? 'border-rose-500/60 bg-rose-950/20' : 'border-slate-800'
        }`}>
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium mb-1">
            <span>Impact / Shock</span>
            <Activity className={`w-4 h-4 ${latestRecord?.shock === 1 ? 'text-rose-400' : 'text-slate-400'}`} />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className={`text-xl sm:text-2xl font-bold ${
              latestRecord?.shock === 1 ? 'text-rose-400' : 'text-slate-200'
            }`}>
              {latestRecord ? (latestRecord.shock === 1 ? 'DROP DETECTED' : 'NORMAL (0g)') : '--'}
            </span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Orientation: {latestRecord ? (latestRecord.flipped === 1 ? 'FLIPPED' : latestRecord.tilt === 1 ? 'TILTED' : 'UPRIGHT') : '--'}
          </div>
        </div>

        {/* Metric 4: Lid Status */}
        <div className={`p-4 rounded-xl border glass-panel transition ${
          latestRecord?.lid_open === 1 ? 'border-amber-500/60 bg-amber-950/20' : 'border-slate-800'
        }`}>
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium mb-1">
            <span>Box Enclosure Lid</span>
            {latestRecord?.lid_open === 1 ? <Unlock className="w-4 h-4 text-amber-400" /> : <Lock className="w-4 h-4 text-emerald-400" />}
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className={`text-xl sm:text-2xl font-bold ${
              latestRecord ? (latestRecord.lid_open === 1 ? 'LID OPEN' : 'SEALED & LOCKED') : '--'
            }`}>
              {latestRecord ? (latestRecord.lid_open === 1 ? 'LID OPEN' : 'SEALED & LOCKED') : '--'}
            </span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Light reading: {latestRecord?.light !== undefined ? `${latestRecord.light} lux` : '--'}
          </div>
        </div>
      </div>

      {/* Middle Row: Temperature Chart & Map */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Temperature Chart (2 Cols) */}
        <div className="lg:col-span-2 p-5 rounded-2xl border border-slate-800 glass-panel flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Thermometer className="w-4 h-4 text-emerald-400" />
                Live Temperature Stream (°C)
              </h2>
              <p className="text-xs text-slate-400">Target cold-chain range: 2.0°C – 8.0°C &middot; Breach threshold: &gt;8.0°C</p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5 text-slate-300">
                <span className="w-3 h-0.5 bg-emerald-400 inline-block"></span> Sensor Temp
              </span>
              <span className="flex items-center gap-1.5 text-rose-400">
                <span className="w-3 h-0.5 bg-rose-500 inline-block"></span> 8.0°C Breach Limit
              </span>
            </div>
          </div>

          <div className="w-full h-64">
            {chartData.length === 0 ? (
              <div className="w-full h-full flex flex-col items-center justify-center text-slate-500 text-xs">
                <Inbox className="w-8 h-8 mb-2 opacity-50" />
                <span>No telemetry data yet. Run fake-publisher.js or connect ESP32.</span>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis 
                    dataKey="time" 
                    stroke="#64748b" 
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                  />
                  <YAxis 
                    domain={[0, 25]} 
                    stroke="#64748b" 
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    unit="°C"
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#0f172a', 
                      borderColor: '#334155', 
                      borderRadius: '0.75rem', 
                      fontSize: '12px' 
                    }} 
                  />
                  <ReferenceLine 
                    y={8.0} 
                    stroke="#ef4444" 
                    strokeDasharray="4 4" 
                    strokeWidth={2}
                    label={{ value: 'Claim Threshold (8.0°C)', fill: '#ef4444', fontSize: 11, position: 'top' }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="temp" 
                    stroke="#10b981" 
                    strokeWidth={2.5} 
                    dot={false}
                    activeDot={{ r: 5, fill: '#10b981' }}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Map Route (1 Col) */}
        <div className="p-5 rounded-2xl border border-slate-800 glass-panel flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Compass className="w-4 h-4 text-cyan-400" />
              Delivery Corridor Replay
            </h2>
          </div>
          <div className="flex-1 min-h-[260px]">
            <RouteMap currentSeq={latestRecord?.seq || 0} />
          </div>
        </div>
      </div>

      {/* Admin Demo Controls & Tamper Bar */}
      <div className="p-5 rounded-2xl border border-purple-500/30 bg-purple-950/20 backdrop-blur-md">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-purple-900/60 text-purple-300 border border-purple-500/40">
                Hackathon Judge Controls
              </span>
              <h3 className="text-base font-bold text-white">Live Cryptographic Tamper Simulation</h3>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Simulate an adversary modifying a stored telemetry record in database storage without possessing the shared secret DEVICE_KEY.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Target record selector */}
            <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs">
              <span className="text-slate-400">Target Seq:</span>
              <input
                type="number"
                min="0"
                value={selectedTamperSeq}
                onChange={(e) => setSelectedTamperSeq(e.target.value)}
                placeholder={records.length > 0 ? String(records[0].seq) : '#'}
                disabled={records.length === 0}
                className="bg-slate-950 text-white font-mono w-14 px-1.5 py-0.5 rounded border border-slate-800 text-center focus:outline-none focus:border-rose-500"
              />
            </div>

            <button
              onClick={handleTamper}
              disabled={isTamperLoading || records.length === 0}
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-white text-xs font-bold shadow-lg shadow-rose-900/40 flex items-center gap-2 transition"
            >
              <AlertTriangle className="w-4 h-4" />
              <span>{isTamperLoading ? 'Tampering...' : `Tamper Record #${selectedTamperSeq || '0'}`}</span>
            </button>

            <button
              onClick={handleReset}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 flex items-center gap-1.5 transition"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset State</span>
            </button>
          </div>
        </div>

        {tamperSuccessMsg && (
          <div className="mt-4 p-3 rounded-xl bg-rose-950/80 border border-rose-500/50 text-xs text-rose-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{tamperSuccessMsg}</span>
            </div>
            <Link 
              to={`/verify/${encodeURIComponent(boxId)}`} 
              className="underline font-bold text-white hover:text-rose-300 flex items-center gap-1"
            >
              <span>View Verify Page Now</span>
              <ExternalLink className="w-3 h-3" />
            </Link>
          </div>
        )}
      </div>

      {/* Bottom Row: Recent Event Timeline & Latest Hash Chain */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Event Timeline */}
        <div className="p-5 rounded-2xl border border-slate-800 glass-panel">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-400" />
              Live Custody Event Log
            </h2>
            <span className="text-xs text-slate-400">Latest 5 events</span>
          </div>

          <div className="space-y-2.5">
            {records.slice(-5).reverse().map((rec) => (
              <div 
                key={rec.seq}
                className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 flex items-center justify-between text-xs"
              >
                <div className="flex items-center gap-2.5">
                  <span className={`w-2 h-2 rounded-full ${
                    rec.event !== 'NONE' ? 'bg-rose-400 animate-ping' : 'bg-emerald-400'
                  }`} />
                  <div>
                    <span className="font-semibold text-white">Seq #{rec.seq}</span>
                    <span className="text-slate-400 ml-2">
                      {new Date(rec.ts * 1000).toLocaleTimeString()}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded font-mono font-bold text-[11px] ${
                    rec.event === 'TEMP_BREACH' ? 'bg-rose-950 text-rose-400 border border-rose-800' :
                    rec.event === 'DROP' ? 'bg-amber-950 text-amber-400 border border-amber-800' :
                    rec.event === 'FLIPPED' ? 'bg-purple-950 text-purple-400 border border-purple-800' :
                    rec.event === 'LID_OPEN' ? 'bg-yellow-950 text-yellow-400 border border-yellow-800' :
                    'bg-slate-800 text-slate-300'
                  }`}>
                    {rec.event}
                  </span>
                  <span className="mono text-slate-400">{rec.temp_c}°C</span>
                </div>
              </div>
            ))}
            {records.length === 0 && (
              <div className="text-slate-500 text-xs py-4 text-center">No telemetry logs recorded yet.</div>
            )}
          </div>
        </div>

        {/* Cryptographic Hash Ledger */}
        <div className="p-5 rounded-2xl border border-slate-800 glass-panel">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              Cryptographic Chain Tip
            </h2>
            <span className="text-xs text-slate-400">HMAC-SHA256 (Shared Secret)</span>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <span className="text-slate-400 block mb-1">Latest SHA-256 Block Hash</span>
              <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 mono text-emerald-400 break-all select-all">
                {latestRecord?.hash || '0000000000000000000000000000000000000000000000000000000000000000 (Genesis Anchor)'}
              </div>
            </div>

            <div>
              <span className="text-slate-400 block mb-1">Previous Chained Hash (prev_hash)</span>
              <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 mono text-slate-400 break-all select-all">
                {latestRecord?.prev_hash || '0000000000000000000000000000000000000000000000000000000000000000 (Genesis Anchor)'}
              </div>
            </div>

            <div>
              <span className="text-slate-400 block mb-1">Device HMAC Signature (sig)</span>
              <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 mono text-purple-400 break-all select-all">
                {latestRecord?.sig || 'Awaiting initial signed record...'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* QR Code Modal */}
      <QRCodeModal 
        boxId={boxId} 
        isOpen={isQrOpen} 
        onClose={() => setIsQrOpen(false)} 
      />
    </div>
  );
}
