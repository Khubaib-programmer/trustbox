import React, { useState, useEffect, useCallback, useRef } from 'react';
import { io } from 'socket.io-client';
import { 
  ResponsiveContainer, 
  AreaChart,
  Area,
  XAxis, 
  YAxis, 
  Tooltip, 
  ReferenceLine 
} from 'recharts';
import { 
  Box, 
  Check, 
  X, 
  ChevronDown, 
  Sun, 
  Moon, 
  ShieldCheck, 
  ShieldAlert, 
  Clock, 
  QrCode,
  RotateCcw,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  WifiOff,
  Radio
} from 'lucide-react';
import { Link } from 'react-router-dom';
import RouteMap from '../components/RouteMap';
import PayoutCard from '../components/PayoutCard';
import QRCodeModal from '../components/QRCodeModal';
import KpiTile from '../components/KpiTile';
import StatusPill from '../components/StatusPill';
import Skeleton from '../components/Skeleton';
import { API_BASE_URL, SOCKET_URL } from '../config';

export default function Dashboard() {
  const [boxId, setBoxId] = useState('TB-001');
  const [availableBoxes, setAvailableBoxes] = useState(['TB-001', 'TB-DEMO-01', 'TB-TEST']);
  const [isDeviceMenuOpen, setIsDeviceMenuOpen] = useState(false);
  const [customInputBox, setCustomInputBox] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const [records, setRecords] = useState([]);
  const [claims, setClaims] = useState([]);
  const [payouts, setPayouts] = useState([]);
  const [latestRecord, setLatestRecord] = useState(null);
  const [chainVerify, setChainVerify] = useState(null);

  // ESP32 Hardware inactivity watchdog (> 30s timeout)
  const [isDeviceTimedOut, setIsDeviceTimedOut] = useState(false);
  const [secondsSinceLastReading, setSecondsSinceLastReading] = useState(0);
  const lastReadingTimestampRef = useRef(Date.now());
  const [isAlertDismissed, setIsAlertDismissed] = useState(false);

  // Chart view metric: 'temp' | 'humidity'
  const [activeMetric, setActiveMetric] = useState('temp');
  // Timeline view: collapsed (max 8) or expanded
  const [showAllTimeline, setShowAllTimeline] = useState(false);
  // Modal for sharing proof
  const [isQrOpen, setIsQrOpen] = useState(false);

  // Discreet test incident controls
  const [showSimControls, setShowSimControls] = useState(false);
  const [isTamperLoading, setIsTamperLoading] = useState(false);
  const [tamperSuccessMsg, setTamperSuccessMsg] = useState(null);
  const [selectedTamperSeq, setSelectedTamperSeq] = useState('');

  // Dark mode toggle (React state + root class)
  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('trustbox_theme');
      if (stored) return stored === 'dark';
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('trustbox_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('trustbox_theme', 'light');
    }
  }, [isDark]);

  // Race condition protection refs
  const activeBoxRef = useRef(boxId);
  const activeRequestIdRef = useRef(0);

  useEffect(() => {
    activeBoxRef.current = boxId;
  }, [boxId]);

  // Fetch all known box IDs in system to populate selector
  const fetchBoxes = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/boxes`);
      if (res.ok) {
        const data = await res.json();
        if (data.boxes && Array.isArray(data.boxes)) {
          setAvailableBoxes((prev) => {
            return Array.from(new Set([...data.boxes, ...prev, 'TB-001', 'TB-DEMO-01', 'TB-TEST']));
          });
        }
      }
    } catch {
      // Backend starting up
    }
  };

  // Device switch handler
  const handleDeviceChange = (newId) => {
    const cleanId = String(newId || '').trim();
    if (!cleanId) return;

    setBoxId(cleanId);
    activeBoxRef.current = cleanId;
    lastReadingTimestampRef.current = Date.now();
    setIsDeviceTimedOut(false);
    setIsAlertDismissed(false);
    setSecondsSinceLastReading(0);
    setIsDeviceMenuOpen(false);
    setTamperSuccessMsg(null);
    setIsLoading(true);
    setRecords([]);
    setClaims([]);
    setPayouts([]);
    setLatestRecord(null);
    setChainVerify(null);
  };

  // Fetch telemetry and verification status
  const fetchData = useCallback(async (targetId) => {
    const targetBox = (targetId || activeBoxRef.current).trim();
    if (!targetBox) return;

    const requestId = ++activeRequestIdRef.current;
    setIsLoading(true);

    try {
      const [recRes, claimRes, payRes, verifyRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/records/${encodeURIComponent(targetBox)}?limit=200`),
        fetch(`${API_BASE_URL}/api/claims/${encodeURIComponent(targetBox)}`),
        fetch(`${API_BASE_URL}/api/payouts/${encodeURIComponent(targetBox)}`),
        fetch(`${API_BASE_URL}/api/verify/${encodeURIComponent(targetBox)}`)
      ]);

      if (requestId !== activeRequestIdRef.current || targetBox !== activeBoxRef.current) {
        return;
      }

      let parsedRecords = [];
      let parsedClaims = [];
      let parsedPayouts = [];
      let parsedVerify = null;

      if (recRes.ok) {
        const rawRec = await recRes.json();
        if (Array.isArray(rawRec)) parsedRecords = rawRec;
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

      setRecords(parsedRecords);
      setClaims(parsedClaims);
      setPayouts(parsedPayouts);
      setChainVerify(parsedVerify);

      if (parsedRecords.length > 0) {
        const latest = parsedRecords[parsedRecords.length - 1];
        setLatestRecord(latest);
        const latestTsMs = latest.receivedAt ? new Date(latest.receivedAt).getTime() : (latest.ts * 1000);
        const elapsed = Math.floor((Date.now() - latestTsMs) / 1000);
        if (elapsed >= 0 && elapsed < 86400) {
          lastReadingTimestampRef.current = latestTsMs;
          setSecondsSinceLastReading(elapsed);
          if (elapsed >= 30) {
            setIsDeviceTimedOut(true);
          }
        }
      } else {
        setLatestRecord(null);
      }
    } catch (err) {
      console.error('Data fetch error:', err);
    } finally {
      if (requestId === activeRequestIdRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  // Poll and establish real-time socket connection
  useEffect(() => {
    fetchBoxes();
    fetchData(boxId);

    const socket = SOCKET_URL ? io(SOCKET_URL, { transports: ['websocket', 'polling'] }) : io();

    socket.on('connect', () => setIsConnected(true));
    socket.on('disconnect', () => setIsConnected(false));

    socket.on('record', (newRecord) => {
      if (newRecord.box_id === activeBoxRef.current) {
        lastReadingTimestampRef.current = Date.now();
        setIsDeviceTimedOut(false);
        setIsAlertDismissed(false);
        setSecondsSinceLastReading(0);

        setRecords((prev) => {
          if (prev.some((r) => r.seq === newRecord.seq)) return prev;
          const updated = [...prev, newRecord].sort((a, b) => a.seq - b.seq);
          return updated;
        });
        setLatestRecord(newRecord);
        // Refresh verify state quietly
        fetch(`${API_BASE_URL}/api/verify/${encodeURIComponent(activeBoxRef.current)}`)
          .then((r) => r.json())
          .then((v) => setChainVerify(v))
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
        fetchData(activeBoxRef.current);
      }
    });

    const fallbackInterval = setInterval(() => {
      fetchData(activeBoxRef.current);
    }, 6000);

    return () => {
      socket.disconnect();
      clearInterval(fallbackInterval);
    };
  }, [boxId, fetchData]);

  // 30-Second ESP32 Inactivity Watchdog Timer
  useEffect(() => {
    const watchdog = setInterval(() => {
      const elapsed = Math.floor((Date.now() - lastReadingTimestampRef.current) / 1000);
      setSecondsSinceLastReading(elapsed);
      if (elapsed >= 30) {
        setIsDeviceTimedOut(true);
      } else {
        setIsDeviceTimedOut(false);
      }
    }, 1000);

    return () => clearInterval(watchdog);
  }, []);

  // Tamper simulation handler (kept minimal for review/demo)
  const handleTamper = async () => {
    const seqToTamper = selectedTamperSeq !== '' 
      ? selectedTamperSeq 
      : (latestRecord ? Math.max(0, latestRecord.seq - 1) : 0);

    setIsTamperLoading(true);
    setTamperSuccessMsg(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/tamper/${encodeURIComponent(boxId)}/${seqToTamper}`, {
        method: 'POST'
      });
      const data = await res.json();
      if (res.ok) {
        setTamperSuccessMsg(`Reading #${seqToTamper} was modified.`);
        fetchData(boxId);
      }
    } catch {
      // ignore
    } finally {
      setIsTamperLoading(false);
    }
  };

  // Status computation
  const isBroken = chainVerify && chainVerify.ok === false;
  const isDrop = latestRecord?.event === 'DROP' || latestRecord?.shock === 1;
  const isTempBreach = latestRecord?.event === 'TEMP_BREACH' || (latestRecord?.box_id?.startsWith('CAKE') && latestRecord?.temp_c > 8.0);
  const isHumidityBreach = latestRecord?.event === 'HUMIDITY_BREACH' || (latestRecord?.humidity > 75.0 && latestRecord?.box_id?.startsWith('TV'));
  const isLidOpen = latestRecord?.event === 'LID_OPEN' || latestRecord?.lid_open === 1;
  const isFlipped = latestRecord?.event === 'FLIPPED' || latestRecord?.flipped === 1;
  const isHighRisk = isDrop || isTempBreach || isHumidityBreach || isBroken || claims.length > 0;

  let statusSentenceStart = "Your delivery is ";
  let statusKeyword = "safe.";
  let statusTone = "safe";

  if (isBroken) {
    statusSentenceStart = "Security Breach — ";
    statusKeyword = "NOT DELIVERED (Records Tampered).";
    statusTone = "danger";
  } else if (isDrop && isTempBreach) {
    statusSentenceStart = "High Risk Damage — ";
    statusKeyword = "NOT DELIVERED (Shock Impact & Melted).";
    statusTone = "danger";
  } else if (isTempBreach) {
    statusSentenceStart = "High Risk Spoilage — ";
    statusKeyword = "NOT DELIVERED (Temperature Breached).";
    statusTone = "danger";
  } else if (isHumidityBreach) {
    statusSentenceStart = "High Risk Damage — ";
    statusKeyword = "NOT DELIVERED (Moisture Hazard).";
    statusTone = "danger";
  } else if (isDrop) {
    statusSentenceStart = "High Risk Impact — ";
    statusKeyword = "NOT DELIVERED (Heavy Shock / Dropped).";
    statusTone = "danger";
  } else if (isLidOpen) {
    statusSentenceStart = "Box lid was ";
    statusKeyword = "opened.";
    statusTone = "warning";
  } else if (isFlipped) {
    statusSentenceStart = "Package was ";
    statusKeyword = "flipped.";
    statusTone = "warning";
  }

  // Hero band background tints
  const heroStyles = {
    safe: 'bg-safe-tint/70 border-safe/20',
    warning: 'bg-warning-tint/70 border-warning/20',
    danger: 'bg-danger-tint/70 border-danger/20',
  }[statusTone] || 'bg-surface border-hairline';

  const heroStatusTextColors = {
    safe: 'text-safe',
    warning: 'text-warning',
    danger: 'text-danger',
  }[statusTone] || 'text-ink';

  const currentTemp = latestRecord?.temp_c ?? 4.8;
  const currentHumidity = latestRecord?.humidity ?? 52.0;
  const currentShock = latestRecord?.shock ?? 0;
  const hasShock = currentShock === 1 || latestRecord?.event === 'DROP';
  const tempProgress = Math.min(Math.max((currentTemp / 16) * 100, 0), 100);

  // Timeline events mapping (human titles, newest first)
  const timelineEvents = [...records].reverse();
  const visibleTimeline = showAllTimeline ? timelineEvents : timelineEvents.slice(0, 8);

  const getEventTitle = (event) => {
    switch (event) {
      case 'DROP': return 'Package dropped';
      case 'TEMP_BREACH': return 'Temperature went above limit';
      case 'HUMIDITY_BREACH': return 'Humidity exceeded limit (Damage risk)';
      case 'LID_OPEN': return 'Lid was opened';
      case 'FLIPPED': return 'Package was flipped';
      default: return 'Everything normal';
    }
  };

  const activePayout = payouts[0] || null;
  const activeClaim = claims[0] || null;

  return (
    <div className="min-h-screen bg-background text-ink flex flex-col transition-colors duration-200">
      {/* A) Top Bar (Sticky, 64px, bottom hairline) */}
      <header className="sticky top-0 z-40 h-16 bg-surface/95 backdrop-blur-sm border-b border-hairline px-4 sm:px-6 lg:px-8 flex items-center justify-between">
        <div className="flex items-center gap-4 sm:gap-6">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-ink text-surface flex items-center justify-center">
              <Box className="w-4 h-4" strokeWidth={2} />
            </div>
            <span className="text-[17px] font-semibold tracking-tight text-ink">
              TrustBox
            </span>
          </Link>

          {/* Minimal Pill Device Selector */}
          <div className="relative">
            <button
              onClick={() => setIsDeviceMenuOpen(!isDeviceMenuOpen)}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-background hover:bg-surface border border-hairline text-[13px] font-medium text-ink transition duration-150"
              aria-label="Select device box"
            >
              <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-safe' : 'bg-muted'}`} />
              <span className="tabular font-medium">{boxId}</span>
              <ChevronDown className="w-3.5 h-3.5 text-muted" strokeWidth={1.75} />
            </button>

            {/* Custom Minimal Dropdown Popover */}
            {isDeviceMenuOpen && (
              <>
                <div 
                  className="fixed inset-0 z-40" 
                  onClick={() => setIsDeviceMenuOpen(false)} 
                />
                <div className="absolute left-0 mt-2 w-56 rounded-20 bg-surface border border-hairline p-2 shadow-modal z-50 animate-scale-in">
                  <div className="text-[11px] font-medium uppercase tracking-widest text-muted px-2.5 py-1.5">
                    Select Box
                  </div>
                  <div className="space-y-0.5 max-h-48 overflow-y-auto">
                    {availableBoxes.map((id) => (
                      <button
                        key={id}
                        onClick={() => handleDeviceChange(id)}
                        className={`w-full text-left px-2.5 py-1.5 rounded-xl text-[13px] font-medium flex items-center justify-between transition ${
                          id === boxId 
                            ? 'bg-background text-ink font-semibold' 
                            : 'text-muted hover:text-ink hover:bg-background'
                        }`}
                      >
                        <span className="tabular">{id}</span>
                        {id === boxId && <Check className="w-3.5 h-3.5 text-ink" strokeWidth={2} />}
                      </button>
                    ))}
                  </div>

                  {/* Quick Custom ID Input */}
                  <div className="pt-2 mt-1 border-t border-hairline">
                    <form 
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (customInputBox.trim()) {
                          handleDeviceChange(customInputBox.trim());
                          setCustomInputBox('');
                        }
                      }}
                      className="flex gap-1"
                    >
                      <input
                        type="text"
                        placeholder="Other ID..."
                        value={customInputBox}
                        onChange={(e) => setCustomInputBox(e.target.value)}
                        className="w-full px-2.5 py-1 rounded-lg bg-background border border-hairline text-[12px] text-ink focus:outline-none"
                      />
                      <button
                        type="submit"
                        className="px-2 py-1 rounded-lg bg-accent text-accent-ink text-[12px] font-medium"
                      >
                        Go
                      </button>
                    </form>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Right side controls */}
        <div className="flex items-center gap-3">
          {/* Live indicator with 30s timeout alert */}
          <div className="hidden sm:inline-flex items-center gap-1.5 text-[12px] text-muted tabular">
            <span className="relative flex h-2 w-2">
              {isConnected && !isDeviceTimedOut && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-safe opacity-75" />
              )}
              <span className={`relative inline-flex rounded-full h-2 w-2 ${
                isDeviceTimedOut ? 'bg-danger' : isConnected ? 'bg-safe' : 'bg-muted'
              }`} />
            </span>
            <span className={isDeviceTimedOut ? 'text-danger font-medium' : ''}>
              {isDeviceTimedOut ? 'Model Disconnected (>30s)' : isConnected ? 'Live' : 'Offline'}
            </span>
          </div>

          {/* Theme Toggle */}
          <button
            onClick={() => setIsDark(!isDark)}
            className="p-2 rounded-full text-muted hover:text-ink hover:bg-background border border-transparent hover:border-hairline transition duration-150"
            aria-label="Toggle dark mode"
          >
            {isDark ? <Sun className="w-4 h-4" strokeWidth={1.75} /> : <Moon className="w-4 h-4" strokeWidth={1.75} />}
          </button>

          {/* Share proof button */}
          <button
            onClick={() => setIsQrOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-[12px] bg-accent text-accent-ink hover:opacity-90 active:scale-[0.98] text-[13px] font-medium transition duration-150"
          >
            <QrCode className="w-3.5 h-3.5" strokeWidth={1.75} />
            <span>Share proof</span>
          </button>
        </div>
      </header>

      {/* ⚠️ ESP32 / Hardware Inactivity Popup Notification (>30s) */}
      {isDeviceTimedOut && !isAlertDismissed && (
        <div 
          className="fixed top-20 right-4 sm:right-8 z-50 max-w-md w-[calc(100%-2rem)] bg-surface/95 border-2 border-danger/60 shadow-2xl rounded-2xl p-5 backdrop-blur-xl animate-in fade-in slide-in-from-top-4 duration-300"
          role="alert"
        >
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-full bg-danger/15 border border-danger/30 flex items-center justify-center shrink-0">
              <WifiOff className="w-5 h-5 text-danger animate-pulse" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[13px] font-bold text-danger uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-danger animate-ping inline-block" />
                  Model is not connected
                </span>
                <span className="text-[11px] font-mono font-medium bg-danger/15 text-danger px-2 py-0.5 rounded-full tabular">
                  {secondsSinceLastReading}s elapsed
                </span>
              </div>
              <p className="mt-1.5 text-[13px] text-ink/90 leading-snug">
                No telemetry response received from ESP32 (<strong className="font-semibold text-ink">{boxId}</strong>) for over 30 seconds.
              </p>
              <p className="mt-1 text-[11px] text-muted">
                Please check your ESP32 Wi-Fi connection, power, or EMQX broker topic.
              </p>
              <div className="mt-3.5 flex items-center gap-2">
                <button
                  onClick={() => {
                    lastReadingTimestampRef.current = Date.now();
                    setIsDeviceTimedOut(false);
                    fetchData(boxId);
                  }}
                  className="px-3.5 py-1.5 bg-danger hover:bg-danger/90 text-white text-[12px] font-semibold rounded-lg shadow-sm transition"
                >
                  Retry Ping
                </button>
                <button
                  onClick={() => setIsAlertDismissed(true)}
                  className="px-3 py-1.5 bg-background hover:bg-surface border border-hairline text-muted hover:text-ink text-[12px] font-medium rounded-lg transition"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Container */}
      <main className="flex-1 max-w-[1200px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {/* B) Hero Status Band (Full width card) */}
        <section 
          className={`w-full rounded-20 border p-6 sm:p-8 transition-colors duration-400 ${heroStyles}`}
          aria-live="polite"
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            {/* Left: Giant status sentence */}
            <div className="max-w-xl">
              <div className="mb-3 flex items-center gap-2">
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold tracking-wide uppercase shadow-sm ${
                  isHighRisk ? 'bg-danger text-white' : 'bg-safe text-white'
                }`}>
                  {isHighRisk ? '❌ NOT DELIVERED' : '✅ DELIVERED SAFELY'}
                </span>
                {isHighRisk && (
                  <span className="text-xs font-semibold text-danger uppercase tracking-wider">
                    High Risk: Cargo Compromised
                  </span>
                )}
              </div>

              <h1 className="text-[34px] sm:text-[44px] lg:text-[48px] font-semibold tracking-tighter leading-tight text-ink">
                <span>{statusSentenceStart}</span>
                <span className={heroStatusTextColors}>{statusKeyword}</span>
              </h1>
              <p className="mt-2 text-[14px] text-muted">
                {latestRecord ? (
                  <>Last update {new Date(latestRecord.ts * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })} · Box {boxId}</>
                ) : (
                  <>Waiting for initial readings · Box {boxId}</>
                )}
              </p>
            </div>

            {/* Right: Giant live temperature number */}
            <div className="flex flex-col md:items-end justify-center min-w-[200px]">
              <div className="flex items-baseline gap-1">
                <span className="text-[64px] sm:text-[96px] font-semibold tracking-tightest leading-none text-ink tabular">
                  {currentTemp.toFixed(1)}
                </span>
                <span className="text-[28px] sm:text-[36px] font-medium text-muted">°C</span>
              </div>

              <div className="text-[13px] text-muted mt-1">
                Safe range up to 8.0°C
              </div>

              {/* Thin progress track */}
              <div className="w-full max-w-[220px] h-1.5 bg-hairline rounded-full overflow-hidden mt-2.5">
                <div 
                  className={`h-full transition-all duration-500 rounded-full ${
                    currentTemp > 8 ? 'bg-danger' : 'bg-safe'
                  }`}
                  style={{ width: `${tempProgress}%` }}
                />
              </div>
            </div>
          </div>
        </section>

        {/* C) KPI Row (5 Minimal Tiles with Shock Sensor beside Temp & Humidity) */}
        <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-6 sm:gap-6 py-2 border-y border-hairline">
          <KpiTile 
            label="Temperature"
            value={currentTemp.toFixed(1)}
            unit="°C"
            delta={currentTemp <= 8.0 ? "Safe cold chain" : "Limit exceeded"}
            statusTone={currentTemp <= 8.0 ? "safe" : "danger"}
          />

          <KpiTile 
            label="Humidity"
            value={currentHumidity.toFixed(1)}
            unit="%"
            delta={currentHumidity <= 75.0 ? "Nominal humidity" : "Limit exceeded"}
            statusTone={currentHumidity <= 75.0 ? "safe" : "danger"}
          />

          <KpiTile 
            label="Shock / Drop"
            value={hasShock ? "DETECTED" : "None"}
            statusIcon={hasShock ? AlertTriangle : Check}
            statusTone={hasShock ? "danger" : "safe"}
            delta={hasShock ? "SW-420 Impact > 3G" : "Stable sensor (0G)"}
          />

          <KpiTile 
            label="Readings"
            value={records.length}
            delta={records.length > 0 ? "Total recorded" : "Awaiting data"}
          />

          <KpiTile 
            label="Integrity"
            value={isBroken ? "Broken" : "Verified"}
            statusIcon={isBroken ? X : Check}
            statusTone={isBroken ? "danger" : "safe"}
            delta={isBroken ? `Problem at #${chainVerify?.brokenAt}` : "All checks passed"}
          />
        </section>

        {/* D) Main Chart Card (Full width with Segmented Control) */}
        <section className="rounded-20 bg-surface border border-hairline p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="text-[20px] font-semibold tracking-tight text-ink">
                {activeMetric === 'temp' ? 'Temperature over time' : 'Humidity over time'}
              </h2>
              <p className="text-[13px] text-muted mt-0.5">
                Continuous custody monitoring
              </p>
            </div>

            {/* Segmented Control */}
            <div className="inline-flex p-1 rounded-[12px] bg-background border border-hairline self-start sm:self-auto">
              <button
                onClick={() => setActiveMetric('temp')}
                className={`px-3 py-1.5 rounded-[9px] text-[13px] font-medium transition duration-150 ${
                  activeMetric === 'temp'
                    ? 'bg-surface text-ink shadow-sm'
                    : 'text-muted hover:text-ink'
                }`}
              >
                Temperature
              </button>
              <button
                onClick={() => setActiveMetric('humidity')}
                className={`px-3 py-1.5 rounded-[9px] text-[13px] font-medium transition duration-150 ${
                  activeMetric === 'humidity'
                    ? 'bg-surface text-ink shadow-sm'
                    : 'text-muted hover:text-ink'
                }`}
              >
                Humidity
              </button>
            </div>
          </div>

          {/* Chart View */}
          <div className="h-[240px] sm:h-[320px] w-full">
            {records.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={records} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={isDark ? '#E5E7EB' : '#0A0A0A'} stopOpacity={0.08} />
                      <stop offset="95%" stopColor={isDark ? '#E5E7EB' : '#0A0A0A'} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  
                  {/* Faint horizontal lines only */}
                  <YAxis 
                    stroke="none"
                    tick={{ fill: 'var(--muted)', fontSize: 11 }}
                    domain={activeMetric === 'temp' ? [0, 18] : [20, 80]}
                    tickCount={5}
                  />
                  <XAxis 
                    dataKey="ts" 
                    stroke="none"
                    tick={{ fill: 'var(--muted)', fontSize: 11 }}
                    tickFormatter={(ts) => new Date(ts * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  />

                  {/* 8°C Limit on temperature chart */}
                  {activeMetric === 'temp' && (
                    <ReferenceLine 
                      y={8} 
                      stroke="var(--danger)" 
                      strokeDasharray="4 4" 
                      strokeWidth={1.5}
                      label={{ 
                        value: 'Limit 8°C', 
                        fill: 'var(--danger)', 
                        fontSize: 11, 
                        position: 'right' 
                      }} 
                    />
                  )}

                  {/* Minimalist Tooltip */}
                  <Tooltip 
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const rec = payload[0].payload;
                        return (
                          <div className="bg-surface border border-hairline rounded-xl px-3 py-2 shadow-modal text-left">
                            <div className="text-[11px] text-muted tabular">
                              {new Date(rec.ts * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            </div>
                            <div className="text-[16px] font-semibold text-ink tabular mt-0.5">
                              {activeMetric === 'temp' ? `${rec.temp_c}°C` : `${rec.humidity}%`}
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />

                  <Area 
                    type="monotone" 
                    dataKey={activeMetric === 'temp' ? 'temp_c' : 'humidity'} 
                    stroke={isDark ? '#FAFAFA' : '#0A0A0A'}
                    strokeWidth={2}
                    fill="url(#chartGradient)"
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-[14px] text-muted">
                Waiting for telemetry readings...
              </div>
            )}
          </div>
        </section>

        {/* E) Two-Column Section (7/12 Timeline + 5/12 Insurance) */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left Column (7/12): Timeline Card */}
          <div className="lg:col-span-7 rounded-20 bg-surface border border-hairline p-6 sm:p-8 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-[20px] font-semibold tracking-tight text-ink">
                    Timeline
                  </h2>
                  <p className="text-[13px] text-muted mt-0.5">
                    Custody status records
                  </p>
                </div>
                {timelineEvents.length > 8 && (
                  <button
                    onClick={() => setShowAllTimeline(!showAllTimeline)}
                    className="text-[13px] font-medium text-muted hover:text-ink transition"
                  >
                    {showAllTimeline ? 'Show less' : 'Show all'}
                  </button>
                )}
              </div>

              {/* Clean Vertical Timeline */}
              {visibleTimeline.length > 0 ? (
                <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-[1px] before:bg-hairline">
                  {visibleTimeline.map((rec) => {
                    const isIncident = rec.event && rec.event !== 'NONE';
                    const dotColor = isIncident ? 'bg-danger' : 'bg-faint';

                    return (
                      <div key={rec.seq} className="relative flex items-center justify-between gap-4 text-left">
                        {/* Status Dot */}
                        <div className={`absolute -left-6 top-1.5 w-2 h-2 rounded-full ${dotColor}`} />

                        <div>
                          <div className="text-[15px] font-medium text-ink">
                            {getEventTitle(rec.event)}
                          </div>
                          <div className="text-[12px] text-muted mt-0.5">
                            {rec.temp_c}°C · {rec.humidity}%
                          </div>
                        </div>

                        <div className="text-[13px] text-muted tabular whitespace-nowrap">
                          {new Date(rec.ts * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-12 text-center text-muted flex flex-col items-center justify-center">
                  <CheckCircle2 className="w-8 h-8 text-safe mb-2" strokeWidth={1.5} />
                  <p className="text-[15px] font-medium text-ink">No incidents. All good.</p>
                  <p className="text-[13px] text-muted mt-0.5">All monitored conditions remain within safe limits.</p>
                </div>
              )}
            </div>
          </div>

          {/* Right Column (5/12): Insurance Card */}
          <div className="lg:col-span-5 rounded-20 bg-surface border border-hairline p-6 sm:p-8 flex flex-col justify-between">
            <div>
              <h2 className="text-[20px] font-semibold tracking-tight text-ink mb-1">
                Insurance
              </h2>
              <p className="text-[13px] text-muted mb-6">
                Parametric coverage protection
              </p>

              {activePayout || activeClaim ? (
                <PayoutCard claim={activeClaim} payout={activePayout} />
              ) : (
                <div className="py-12 text-center text-muted flex flex-col items-center justify-center h-[240px]">
                  <ShieldCheck className="w-8 h-8 text-safe mb-2" strokeWidth={1.5} />
                  <p className="text-[15px] font-medium text-ink">No claims. You are covered.</p>
                  <p className="text-[13px] text-muted mt-0.5 max-w-xs">
                    Automatic compensation will trigger instantly if temperature exceeds 8°C for 15s or drop occurs.
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* F) Route Map Card (Full width) */}
        <section className="space-y-3">
          <div className="flex items-baseline justify-between px-1">
            <h2 className="text-[20px] font-semibold tracking-tight text-ink">
              Route
            </h2>
            <span className="text-[13px] text-muted">
              Origin: Airport Pharma Cargo · Destination: Regional Hospital
            </span>
          </div>

          <RouteMap currentSeq={latestRecord?.seq ?? 0} />
        </section>

        {/* Quiet Incident Simulation Controls (For presentation/demo test) */}
        <section className="pt-4 border-t border-hairline text-center">
          <button
            onClick={() => setShowSimControls(!showSimControls)}
            className="text-[12px] font-medium text-muted hover:text-ink inline-flex items-center gap-1.5 transition"
          >
            <Sliders className="w-3.5 h-3.5" strokeWidth={1.75} />
            <span>{showSimControls ? 'Hide demonstration controls' : 'Demonstration controls'}</span>
          </button>

          {showSimControls && (
            <div className="mt-4 p-5 rounded-20 bg-surface border border-hairline max-w-lg mx-auto text-left animate-fade-in">
              <div className="text-[13px] font-semibold text-ink mb-1">
                Tamper Injection Test
              </div>
              <p className="text-[12px] text-muted mb-3">
                Simulate a database modification to verify that the cryptographic audit catches alterations immediately.
              </p>

              <div className="flex items-center gap-2">
                <input
                  type="number"
                  placeholder="Reading #"
                  value={selectedTamperSeq}
                  onChange={(e) => setSelectedTamperSeq(e.target.value)}
                  className="w-28 px-3 py-2 rounded-xl bg-background border border-hairline text-[13px] text-ink focus:outline-none"
                />
                <button
                  onClick={handleTamper}
                  disabled={isTamperLoading}
                  className="flex-1 py-2 px-3 rounded-xl bg-accent text-accent-ink text-[13px] font-medium hover:opacity-90 disabled:opacity-50 transition"
                >
                  {isTamperLoading ? 'Injecting...' : 'Modify reading'}
                </button>
              </div>

              {tamperSuccessMsg && (
                <div className="mt-3 text-[12px] text-danger flex items-center justify-between">
                  <span>{tamperSuccessMsg}</span>
                  <Link to={`/verify/${boxId}`} className="underline font-medium text-ink">
                    View audit
                  </Link>
                </div>
              )}
            </div>
          )}
        </section>

        {/* G) Footer */}
        <footer className="text-center pt-8 pb-12 border-t border-hairline">
          <p className="text-[13px] text-faint">
            Every reading is sealed and cannot be changed without detection.
          </p>
        </footer>
      </main>

      {/* Share Proof QR Modal */}
      <QRCodeModal 
        boxId={boxId} 
        isOpen={isQrOpen} 
        onClose={() => setIsQrOpen(false)} 
      />
    </div>
  );
}
