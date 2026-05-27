// shared.jsx — Mission Control: data, hooks, mini-components shared across variations.
// All exports go on window so each <script type="text/babel"> file can access them.

const { useState, useEffect, useRef, useMemo, useCallback, createContext, useContext } = React;

/* ────────────────────────────────────────────────────────────────────────
   SEED DATA — pulled from the user's screenshots, plus realistic siblings.
   ──────────────────────────────────────────────────────────────────────── */

const TODAY = new Date('2026-05-27T09:12:00');
const fmtDate = (d) => d.toISOString().slice(0,10);

// Last 14 days of Temporal hours (real-looking pattern matching the chart in the screenshot).
const TEMPORAL_14 = [0, 0, 0, 5, 4, 0, 0, 0, 0, 0, 0, 0, 1, 0];
const DEEPWORK_14 = [0, 0, 0, 3, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0];
const PIPELINE_14 = [0, 0, 0, 4, 3, 0, 0, 0, 0, 0, 0, 0, 1, 0];
const CASH_30 = [11, 12, 11, 10, 12, 14, 15, 17, 18, 20, 22, 24, 25, 27, 28, 29, 30, 31, 32, 33, 34, 34, 35, 35, 35, 35, 35, 35, 35, 35.3];
const NETWORTH_30 = [932, 935, 940, 942, 950, 953, 955, 958, 960, 962, 965, 967, 968, 970, 972, 974, 975, 976, 977, 978, 979, 980, 980, 981, 981, 982, 982, 982, 982, 982];

// Three to Thrive — daily journaling prompts.
const T3T_PROMPTS = [
  { id: 'courage', q: 'How can I live with even more courage and determination?', tag: null },
  { id: 'serve',   q: 'How can I serve even more?', tag: null },
  { id: 'redo',    q: 'What would I do differently if I could live my day over?', tag: 'Daily random' },
];

const DEFAULT_METRICS = {
  cash:       { id:'cash',       label:'Cash',         today:35300,   prev_mo:10800,  unit:'$',  fmt:'money', goal:null,   spark:CASH_30,    note:'No burn',           color:'#5b59ff' },
  cashMoM:    { id:'cashMoM',    label:'Cash MoM',     today:228.0,                   unit:'%',  fmt:'pct',                                  delta:2400, spark:null,   color:'#16a34a',  note:'+$2.4K vs last mo' },
  netWorth:   { id:'netWorth',   label:'Net worth',    today:982000,  prev_mo:957000, unit:'$',  fmt:'money',                  spark:NETWORTH_30, note:'$1.01M − $27.9K', color:'#0ea5e9' },
  debt:       { id:'debt',       label:'Total debt',   today:27900,                   unit:'$',  fmt:'money',                                color:'#dc2626', note:'liabilities' },
  temporal:   { id:'temporal',   label:'Temporal',     today:0,       week:6.5,       goal:5,    unit:'h',  fmt:'hours',  spark:TEMPORAL_14, color:'#7c3aed', note:'this week' },
  focus:      { id:'focus',      label:'Focus hours',  today:0,       week:0,         goal:15,   unit:'h',  fmt:'hours',                    color:'#0ea5e9', note:'this week' },
  moneyMoved: { id:'moneyMoved', label:'Money moved',  today:0,       week:0,         goal:null, unit:'$',  fmt:'money',                    color:'#f59e0b', note:'this week' },
  pipeline:   { id:'pipeline',   label:'Pipeline',     today:0,       week:0,         goal:3,    unit:'h',  fmt:'hours',  spark:PIPELINE_14, color:'#a855f7', note:'this week' },
  deepWork:   { id:'deepWork',   label:'Deep work',    today:0,       week:0,         goal:10,   unit:'h',  fmt:'hours',  spark:DEEPWORK_14, color:'#3b82f6', note:'this week' },
  trained:    { id:'trained',    label:'Trained',      today:0,       week:0,         goal:4,    unit:'×',  fmt:'count',                    color:'#10b981', note:'this week' },
};

// Streaks
const STREAKS = {
  temporal: { days:6,  emoji:'🔥', label:'6-day Temporal streak'  },
  cash:     { days:14, emoji:'📈', label:'14 consecutive non-burn days' },
  trained:  { days:0,  emoji:'',  label:'No training this week' },
};

// Initial activity feed (newest first)
const SEED_ACTIVITY = [
  { t:'09:12', kind:'temporal',  delta:'+1h',         label:'Temporal',  meta:'Brief read · investor deck' },
  { t:'09:15', kind:'money',     delta:'+ Generated', label:'$2,000',    meta:'Annual contract · Vega' },
  { t:'09:20', kind:'pipeline',  delta:'+ Lead',      label:'Pipeline',  meta:'Outbound · Northway' },
  { t:'08:48', kind:'cash',      delta:'sync',        label:'Cash',      meta:'Monarch · $35.3K' },
  { t:'08:30', kind:'deepwork',  delta:'+0.5h',       label:'Deep work', meta:'Architecture doc' },
];

/* ────────────────────────────────────────────────────────────────────────
   FORMATTERS
   ──────────────────────────────────────────────────────────────────────── */

function fmt(value, kind) {
  if (value == null || Number.isNaN(value)) return '—';
  if (kind === 'money') {
    const v = Math.abs(value);
    const sign = value < 0 ? '−' : '';
    if (v >= 1_000_000) return `${sign}$${(v/1_000_000).toFixed(v >= 10_000_000 ? 1 : 2)}M`;
    if (v >= 1_000)     return `${sign}$${(v/1_000).toFixed(v >= 100_000 ? 0 : 1)}K`;
    return `${sign}$${v.toFixed(0)}`;
  }
  if (kind === 'pct')   return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`;
  if (kind === 'hours') return `${Number.isInteger(value) ? value : value.toFixed(1)}h`;
  if (kind === 'count') return `${value}`;
  return `${value}`;
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/* ────────────────────────────────────────────────────────────────────────
   MISSION STORE — single source of truth shared by all variations.
   Each variation pulls live state and dispatches actions; an activity feed
   is appended automatically.
   ──────────────────────────────────────────────────────────────────────── */

const MissionContext = createContext(null);

function MissionProvider({ children, initial }) {
  const [metrics, setMetrics] = useState(initial || DEFAULT_METRICS);
  const [activity, setActivity] = useState(SEED_ACTIVITY);
  const [answers, setAnswers] = useState({ courage:'', serve:'', redo:'' });
  const idRef = useRef(1);

  const log = useCallback((metricId, hours = 0.5, deltaLabel) => {
    const ts = new Date();
    const tStr = `${String(ts.getHours()).padStart(2,'0')}:${String(ts.getMinutes()).padStart(2,'0')}`;
    setMetrics(prev => {
      const m = prev[metricId];
      if (!m) return prev;
      const next = { ...m };
      if (m.fmt === 'hours') {
        next.today = (m.today || 0) + hours;
        next.week  = (m.week  || 0) + hours;
      } else if (m.fmt === 'money') {
        next.today = (m.today || 0) + hours;
      } else if (m.fmt === 'count') {
        next.today = (m.today || 0) + 1;
        next.week  = (m.week  || 0) + 1;
      }
      return { ...prev, [metricId]: next };
    });
    setActivity(prev => [{
      id: idRef.current++,
      t: tStr,
      kind: metricId,
      delta: deltaLabel || (typeof hours === 'number' ? `+${hours}h` : '+1'),
      label: DEFAULT_METRICS[metricId]?.label || metricId,
      meta: 'Quick log',
      _flash: true,
    }, ...prev].slice(0, 40));
    // Clear flash after a tick
    setTimeout(() => setActivity(prev => prev.map(a => ({ ...a, _flash: false }))), 1200);
  }, []);

  const setMetric = useCallback((metricId, partial) => {
    setMetrics(prev => ({ ...prev, [metricId]: { ...prev[metricId], ...partial } }));
  }, []);

  const setAnswer = useCallback((id, text) => {
    setAnswers(prev => ({ ...prev, [id]: text }));
  }, []);

  const value = useMemo(() => ({
    metrics, activity, answers, log, setMetric, setAnswer
  }), [metrics, activity, answers, log, setMetric, setAnswer]);

  return <MissionContext.Provider value={value}>{children}</MissionContext.Provider>;
}

function useMission() {
  const ctx = useContext(MissionContext);
  if (!ctx) throw new Error('useMission outside provider');
  return ctx;
}

/* ────────────────────────────────────────────────────────────────────────
   ORBIT STAR — the brand moment. 4-point orbital, two ellipses crossed
   at 90°, slowly rotating. Used in headers across all 3 variations.
   ──────────────────────────────────────────────────────────────────────── */

function OrbitStar({ size = 18, color = 'currentColor', spin = true, thickness = 1.5, glow = false }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{
      display:'inline-block', verticalAlign:'middle',
      animation: spin ? 'orbitspin 14s linear infinite' : 'none',
      filter: glow ? `drop-shadow(0 0 6px ${color})` : 'none',
    }}>
      <ellipse cx="12" cy="12" rx="10" ry="3" fill="none" stroke={color} strokeWidth={thickness} />
      <ellipse cx="12" cy="12" rx="3" ry="10" fill="none" stroke={color} strokeWidth={thickness} />
      <circle cx="12" cy="12" r="1.5" fill={color} />
    </svg>
  );
}

// Inject the orbit-star spin keyframes once.
if (typeof document !== 'undefined' && !document.getElementById('mc-keyframes')) {
  const s = document.createElement('style');
  s.id = 'mc-keyframes';
  s.textContent = `
    @keyframes orbitspin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    @keyframes mc-pulse { 0%, 100% { opacity: 0.4; transform: scale(1); } 50% { opacity: 1; transform: scale(1.15); } }
    @keyframes mc-blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.2; } }
    @keyframes mc-flash { 0% { background: rgba(94,90,236,0.18); } 100% { background: transparent; } }
    @keyframes mc-tickup { 0% { transform: translateY(8px); opacity: 0; } 100% { transform: translateY(0); opacity: 1; } }
    @keyframes mc-shine  { 0% { transform: translateX(-100%); } 100% { transform: translateX(200%); } }
  `;
  document.head.appendChild(s);
}

/* ────────────────────────────────────────────────────────────────────────
   SPARKLINE — tiny inline trend line. Pass {data, color, fill, height}.
   ──────────────────────────────────────────────────────────────────────── */

function Sparkline({ data, color = '#5b59ff', fill = null, height = 28, width = 100, strokeWidth = 1.5, dots = false, baseline = false }) {
  if (!data || !data.length) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const stepX = width / (data.length - 1 || 1);
  const points = data.map((v, i) => [i * stepX, height - 2 - ((v - min) / range) * (height - 4)]);
  const d = points.map(([x,y], i) => (i ? `L${x},${y}` : `M${x},${y}`)).join(' ');
  const fillD = fill ? `${d} L${points[points.length-1][0]},${height} L0,${height} Z` : '';
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" style={{display:'block'}}>
      {baseline && <line x1="0" x2={width} y1={height-2} y2={height-2} stroke={color} strokeWidth="0.5" opacity="0.2" />}
      {fill && <path d={fillD} fill={fill} opacity="0.5" />}
      <path d={d} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      {dots && points.map(([x,y], i) => (
        <circle key={i} cx={x} cy={y} r={i === points.length - 1 ? 2 : 1} fill={color} />
      ))}
    </svg>
  );
}

/* ────────────────────────────────────────────────────────────────────────
   PROGRESS RING — for streak/goal indicators.
   ──────────────────────────────────────────────────────────────────────── */

function Ring({ pct = 0, size = 32, stroke = 3, color = '#5b59ff', track = 'rgba(0,0,0,0.08)', children }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const off = c * (1 - clamp(pct, 0, 1));
  return (
    <div style={{ position:'relative', width:size, height:size, display:'inline-flex', alignItems:'center', justifyContent:'center' }}>
      <svg width={size} height={size} style={{ position:'absolute', top:0, left:0, transform:'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off} style={{ transition:'stroke-dashoffset 320ms cubic-bezier(.2,.7,.3,1)' }} />
      </svg>
      <div style={{ position:'relative', fontSize: size * 0.32, fontWeight:600 }}>{children}</div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────
   ICONS — lucide-style stroked, 24px, currentColor.
   ──────────────────────────────────────────────────────────────────────── */

const Icon = {
  flame: (p) => (<svg viewBox="0 0 24 24" width={p?.s||16} height={p?.s||16} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>),
  bolt: (p) => (<svg viewBox="0 0 24 24" width={p?.s||16} height={p?.s||16} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M13 2 3 14h9l-1 8 10-12h-9z"/></svg>),
  plus: (p) => (<svg viewBox="0 0 24 24" width={p?.s||16} height={p?.s||16} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M12 5v14M5 12h14"/></svg>),
  minus: (p) => (<svg viewBox="0 0 24 24" width={p?.s||16} height={p?.s||16} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M5 12h14"/></svg>),
  edit: (p) => (<svg viewBox="0 0 24 24" width={p?.s||14} height={p?.s||14} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z"/></svg>),
  arrowUp: (p) => (<svg viewBox="0 0 24 24" width={p?.s||14} height={p?.s||14} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="m5 12 7-7 7 7M12 5v14"/></svg>),
  arrowDown: (p) => (<svg viewBox="0 0 24 24" width={p?.s||14} height={p?.s||14} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M12 5v14m-7-7 7 7 7-7"/></svg>),
  arrowRight: (p) => (<svg viewBox="0 0 24 24" width={p?.s||14} height={p?.s||14} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M5 12h14m-7-7 7 7-7 7"/></svg>),
  search: (p) => (<svg viewBox="0 0 24 24" width={p?.s||16} height={p?.s||16} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>),
  cmd: (p) => (<svg viewBox="0 0 24 24" width={p?.s||14} height={p?.s||14} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M18 3a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0-3-3H6a3 3 0 0 0-3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3V6a3 3 0 0 0-3-3 3 3 0 0 0-3 3 3 3 0 0 0 3 3h12a3 3 0 0 0 3-3 3 3 0 0 0-3-3z"/></svg>),
  check: (p) => (<svg viewBox="0 0 24 24" width={p?.s||14} height={p?.s||14} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="m5 12 5 5 9-11"/></svg>),
  dollar: (p) => (<svg viewBox="0 0 24 24" width={p?.s||14} height={p?.s||14} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M12 2v20M17 6H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>),
  pipeline: (p) => (<svg viewBox="0 0 24 24" width={p?.s||14} height={p?.s||14} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M3 12h6m6 0h6M9 6v12m6-12v12"/></svg>),
  brain: (p) => (<svg viewBox="0 0 24 24" width={p?.s||14} height={p?.s||14} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M9 2a3 3 0 0 0-3 3v.5A3.5 3.5 0 0 0 3 9c0 1 .4 1.8 1 2.5-.6.7-1 1.5-1 2.5a3.5 3.5 0 0 0 3 3.5V18a3 3 0 0 0 3 3M15 2a3 3 0 0 1 3 3v.5A3.5 3.5 0 0 1 21 9c0 1-.4 1.8-1 2.5.6.7 1 1.5 1 2.5a3.5 3.5 0 0 1-3 3.5V18a3 3 0 0 1-3 3M12 4v18"/></svg>),
  chevron: (p) => (<svg viewBox="0 0 24 24" width={p?.s||14} height={p?.s||14} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="m9 6 6 6-6 6"/></svg>),
  close: (p) => (<svg viewBox="0 0 24 24" width={p?.s||14} height={p?.s||14} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M6 6l12 12M6 18 18 6"/></svg>),
  sparkles: (p) => (<svg viewBox="0 0 24 24" width={p?.s||14} height={p?.s||14} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8"/></svg>),
  dot: (p) => (<svg viewBox="0 0 24 24" width={p?.s||10} height={p?.s||10} {...p}><circle cx="12" cy="12" r="6" fill="currentColor"/></svg>),
};

/* ────────────────────────────────────────────────────────────────────────
   INLINE EDITABLE NUMBER — click to edit, blur/enter to commit.
   ──────────────────────────────────────────────────────────────────────── */

function InlineNumber({ value, onCommit, fmt: fmtKind = 'money', style, prefix = '', suffix = '' }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value ?? 0));
  const ref = useRef(null);
  useEffect(() => { if (editing && ref.current) { ref.current.focus(); ref.current.select(); } }, [editing]);

  const commit = () => {
    const num = parseFloat(draft.replace(/[$,kKhH%]/g,''));
    if (!Number.isNaN(num)) onCommit?.(num);
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        ref={ref}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); }}
        style={{ ...style, background:'transparent', border:'none', outline:'1.5px solid currentColor', borderRadius:4, padding:'0 4px', font:'inherit', color:'inherit', width:'auto' }}
      />
    );
  }
  return (
    <span
      onClick={() => { setDraft(String(value ?? 0)); setEditing(true); }}
      style={{ ...style, cursor:'text', borderRadius:4, padding:'0 2px', margin:'0 -2px' }}
      title="Click to edit"
    >
      {prefix}{fmt(value, fmtKind)}{suffix}
    </span>
  );
}

/* ────────────────────────────────────────────────────────────────────────
   ANIMATED TICKER — counts smoothly to the value.
   ──────────────────────────────────────────────────────────────────────── */

function Ticker({ value, fmt: kind = 'money', duration = 480, ...rest }) {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);
  useEffect(() => {
    const from = fromRef.current;
    const to = value;
    if (from === to) return;
    const start = performance.now();
    let raf;
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(from + (to - from) * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = to;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return <span {...rest}>{fmt(display, kind)}</span>;
}

/* ────────────────────────────────────────────────────────────────────────
   EXPORT
   ──────────────────────────────────────────────────────────────────────── */

Object.assign(window, {
  // Data
  DEFAULT_METRICS, T3T_PROMPTS, TEMPORAL_14, DEEPWORK_14, PIPELINE_14, CASH_30, NETWORTH_30, STREAKS, SEED_ACTIVITY, TODAY,
  // Hooks / store
  MissionProvider, useMission, MissionContext,
  // Formatters
  fmt, clamp, fmtDate,
  // Components
  OrbitStar, Sparkline, Ring, Icon, InlineNumber, Ticker,
});
