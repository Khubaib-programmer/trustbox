import React, { useState, useEffect } from 'react';
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
  Clock
} from 'lucide-react';
import { Link } from 'react-router-dom';
import RouteMap from '../components/RouteMap';
import PayoutCard from '../components/PayoutCard';
import QRCodeModal from '../components/QRCodeModal';

export default function Dashboard() {
  const [boxId, setBoxId] = useState('TB-001');
  const [isConnected, setIsConnected] = useState(false);
  const [records, setRecords] = useState([]);
  const [claims, setClaims] = useState([]);
  const [payouts, setPayouts] = useState([]);
  const [latestRecord, setLatestRecord] = useState(null);
  const [isTamperLoading, setIsTamperLoading] = useState(false);
  const [tamperSuccessMsg, setTamperSuccessMsg] = useState(null);
  const [isQrOpen, setIsQrOpen] = useState(false);

  // Fetch initial box data
  const fetchData = async () => {
    try {
      const [recRes, claimRes, payRes] = await Promise.all([
        fetch(`/api/records/${boxId}?limit=50`),
        fetch(`/api/claims/${boxId}`),
        fetch(`/api/payouts/${boxId}`)
      ]);

      if (recRes.ok) {
        const recData = await recRes.json();
        setRecords(recData);
        if (recData.length > 0) {
          setLatestRecord(recData[recData.length - 1]);
        }
      }
      if (claimRes.ok) {
        const claimData = await claimRes.json();
        setClaims(claimData);
      }
      if (payRes.ok) {
        const payData = await payRes.json();
        setPayouts(payData);
      }
    } catch (err) {
      console.error('Error fetching initial data:', err);
    }
  };

  useEffect(() => {
    fetchData();

    // Setup Socket.io connection
    const socket = io();

    socket.on('connect', () => {
      console.log('Socket connected');
      setIsConnected(true);
    });

    socket.on('disconnect', () => {
      console.log('Socket disconnected');
      setIsConnected(false);
    });

    socket.on('record', (newRecord) => {
      if (newRecord.box_id === boxId) {
        setLatestRecord(newRecord);
        setRecords((prev) => {
          // Avoid duplicates
          if (prev.some(r => r.seq === newRecord.seq)) return prev;
          const updated = [...prev, newRecord];
          return updated.slice(-60); // keep last 60 records for smooth chart
        });
      }
    });

    socket.on('claim', (newClaim) => {
      if (newClaim.box_id === boxId) {
        setClaims((prev) => [newClaim, ...prev]);
      }
    });

    socket.on('payout', (newPayout) => {
      if (newPayout.box_id === boxId) {
        setPayouts((prev) => [newPayout, ...prev]);
      }
    });

    socket.on('tamper', (info) => {
      if (info.box_id === boxId) {
        fetchData();
      }
    });

    socket.on('reset', (info) => {
      if (info.box_id === boxId) {
        setRecords([]);
        setClaims([]);
        setPayouts([]);
        setLatestRecord(null);
        setTamperSuccessMsg(null);
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [boxId]);

  // Handle Admin Tamper action
  const handleTamper = async () => {
    if (records.length === 0) {
      alert('No records stored yet. Run the publisher first!');
      return;
    }
    // Pick an existing record to tamper with (mid-chain or latest)
    const targetSeq = Math.floor(records.length / 2);
    const seqToTamper = records[targetSeq]?.seq || records[0].seq;

    setIsTamperLoading(true);
    try {
      const res = await fetch(`/api/admin/tamper/${boxId}/${seqToTamper}`, {
        method: 'POST'
      });
      const data = await res.json();
      if (res.ok) {
        setTamperSuccessMsg(`Record #${seqToTamper} maliciously modified! Check Verify page.`);
        fetchData();
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
    if (!confirm(`Reset all telemetry, claims, and payouts for ${boxId}?`)) return;
    try {
      await fetch(`/api/admin/reset/${boxId}`, { method: 'POST' });
      setRecords([]);
      setClaims([]);
      setPayouts([]);
      setLatestRecord(null);
      setTamperSuccessMsg(null);
    } catch (e) {
      console.error(e);
    }
  };

  // Determine overall status
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
                {isConnected ? 'LIVE FEED' : 'RECONNECTING'}
              </span>
            </div>
            <p className="text-xs text-slate-400">Cryptographically Hash-Chained Parcel Custody Tracker</p>
          </div>
        </div>

        {/* Box Selector & Action Buttons */}
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs">
            <span className="text-slate-400">Box ID:</span>
            <input 
              type="text" 
              value={boxId} 
              onChange={(e) => setBoxId(e.target.value.trim())}
              className="bg-transparent text-white font-mono font-bold w-16 focus:outline-none"
            />
          </div>

          <button
            onClick={() => setIsQrOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition"
          >
            <QrCode className="w-4 h-4 text-emerald-400" />
            <span>Scan QR</span>
          </button>

          <Link
            to={`/verify/${boxId}`}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-lg shadow-emerald-900/30 transition"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Verify Chain</span>
            <ExternalLink className="w-3.5 h-3.5 opacity-70" />
          </Link>
        </div>
      </div>

      {/* Main Status Banner */}
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

        {/* Live Sequence Counter */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl px-4 py-2 text-right">
          <div className="text-[11px] uppercase text-slate-400 font-semibold">Chained Records</div>
          <div className="text-2xl font-black text-white mono">
            {records.length}
          </div>
        </div>
      </div>

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
              {latestRecord?.shock === 1 ? 'DROP DETECTED' : 'NORMAL (0g)'}
            </span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Orientation: {latestRecord?.flipped === 1 ? 'FLIPPED' : latestRecord?.tilt === 1 ? 'TILTED' : 'UPRIGHT'}
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
              latestRecord?.lid_open === 1 ? 'text-amber-400' : 'text-emerald-400'
            }`}>
              {latestRecord?.lid_open === 1 ? 'LID OPEN' : 'SEALED & LOCKED'}
            </span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Light reading: {latestRecord?.light ?? '--'} lux
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
              <p className="text-xs text-slate-400">Target storage: 2.0°C – 8.0°C (Vaccine / Cold Chain)</p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5 text-slate-300">
                <span className="w-3 h-0.5 bg-emerald-400 inline-block"></span> Temp
              </span>
              <span className="flex items-center gap-1.5 text-rose-400">
                <span className="w-3 h-0.5 bg-rose-500 inline-block"></span> 8.0°C Breach Limit
              </span>
            </div>
          </div>

          <div className="w-full h-64">
            {chartData.length === 0 ? (
              <div className="w-full h-full flex items-center justify-center text-slate-500 text-xs">
                No telemetry data yet. Run fake-publisher.js or connect ESP32.
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
              Simulate an adversary modifying a stored telemetry record in the database without valid private key.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleTamper}
              disabled={isTamperLoading || records.length === 0}
              className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-xs font-bold shadow-lg shadow-rose-900/40 flex items-center gap-2 transition"
            >
              <AlertTriangle className="w-4 h-4" />
              <span>{isTamperLoading ? 'Tampering...' : 'Tamper A Record'}</span>
            </button>

            <button
              onClick={handleReset}
              className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 flex items-center gap-1.5 transition"
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
              to={`/verify/${boxId}`} 
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
            <span className="text-xs text-slate-400">HMAC-SHA256</span>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <span className="text-slate-400 block mb-1">Latest SHA-256 Block Hash</span>
              <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 mono text-emerald-400 break-all select-all">
                {latestRecord?.hash || '0000000000000000000000000000000000000000000000000000000000000000'}
              </div>
            </div>

            <div>
              <span className="text-slate-400 block mb-1">Previous Chained Hash (prev_hash)</span>
              <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 mono text-slate-400 break-all select-all">
                {latestRecord?.prev_hash || '0000000000000000000000000000000000000000000000000000000000000000'}
              </div>
            </div>

            <div>
              <span className="text-slate-400 block mb-1">Device HMAC Signature (sig)</span>
              <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 mono text-purple-400 break-all select-all">
                {latestRecord?.sig || 'Awaiting first signed payload...'}
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

