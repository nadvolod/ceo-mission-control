// v1-dark.jsx — Conservative layout (V1) reskinned in V3's dark UV palette.
// Same anatomy: header w/ tabs, chip strip, 6-card metric grid, collapsible
// panels (T3T compact, Trends, Tasks), live activity feed. New skin: warm
// near-black bg w/ aurora radial gradients, glass-tile surfaces, UV violet
// accent, instrument-serif for hero numerals, glow on the orbit star.

const { useState, useEffect, useRef } = React;

const D = {
  font: "'Geist','Inter',system-ui,sans-serif",
  mono: "'Geist Mono','JetBrains Mono',ui-monospace,monospace",
  numerics: "'JetBrains Mono','Geist Mono',ui-monospace,monospace",
  serif: "'Instrument Serif',Georgia,serif",
  bg: '#0E0C14',
  bgWarm: '#13111A',
  surface: 'rgba(255,255,255,0.04)',
  surfaceHi: 'rgba(255,255,255,0.07)',
  surfaceSolid: '#16141F',
  border: 'rgba(255,255,255,0.08)',
  borderHi: 'rgba(255,255,255,0.16)',
  ink: '#F5F1FF',
  fg: '#D7D2E8',
  fgDim: '#9890B5',
  fgMuted: '#5E5774',
  uv: '#7C7CFF',
  uvHi: '#9D9CFF',
  uvSoft: 'rgba(124,124,255,0.14)',
  uvVery: 'rgba(124,124,255,0.06)',
  pink: '#FF7AD8',
  green: '#3DDC97',
  amber: '#FFB454',
  red: '#FF6469',
  cyan: '#5DD9FF',
};

/* ────────────────────────────────────────────────────────────────────────
   AURORA — the page-level mood backdrop. Subtle, doesn't compete.
   ──────────────────────────────────────────────────────────────────────── */

// Techy display-numeric treatment: JetBrains Mono with feature settings
// (tabular numbers + slashed zero + alt 1) so values don't reflow on update
// and read like a console.
const numStyle = {
  fontFamily: "'JetBrains Mono','Geist Mono',ui-monospace,monospace",
  fontFeatureSettings: '"tnum" 1, "zero" 1, "ss01" 1, "cv11" 1',
  fontVariantNumeric: 'tabular-nums slashed-zero',
  letterSpacing: '-0.02em',
  fontWeight: 500,
};

function Aurora({ intensity = 1 }) {
  return (
    <div style={{
      position:'absolute', inset:0, opacity: 0.55 * intensity, pointerEvents:'none',
      background: `
        radial-gradient(60% 50% at 15% 0%, ${D.uv}33 0%, transparent 50%),
        radial-gradient(40% 30% at 90% 10%, ${D.pink}1A 0%, transparent 60%),
        radial-gradient(50% 40% at 80% 95%, ${D.cyan}14 0%, transparent 60%)
      `,
    }} />
  );
}

/* ────────────────────────────────────────────────────────────────────────
   DARK METRIC CARD — V1 anatomy, V3 skin.
   ──────────────────────────────────────────────────────────────────────── */

function DMetricCard({ metricId, sparkColor, big = false }) {
  const { metrics, log, setMetric } = useMission();
  const m = metrics[metricId];
  const [hover, setHover] = useState(false);
  const [flash, setFlash] = useState(false);
  const prevRef = useRef(m?.today);
  useEffect(() => {
    if (m && prevRef.current !== m.today && prevRef.current !== undefined) {
      setFlash(true);
      const t = setTimeout(() => setFlash(false), 900);
      return () => clearTimeout(t);
    }
  }, [m?.today]);
  useEffect(() => { if (m) prevRef.current = m.today; }, [m?.today]);
  if (!m) return null;

  const presets = {
    temporal:  [['+0.5h', 0.5], ['+1h', 1], ['+2h', 2]],
    focus:     [['+0.5h', 0.5], ['+1h', 1], ['+2h', 2]],
    pipeline:  [['+ Call', 0.5], ['+ Demo', 1], ['+ FU', 0.5]],
    deepWork:  [['+0.5h', 0.5], ['+1h', 1]],
    trained:   [['+ Session', 1]],
    moneyMoved:[['+ Moved', 250], ['+ Generated', 500], ['+ Cut', 100]],
  };

  const subValue = m.week != null ? `${fmt(m.week, m.fmt)} this week` : (m.note || '');
  const goalPct = m.goal ? clamp(m.week / m.goal, 0, 1) : null;
  const ahead   = m.goal && m.week >= m.goal;
  const colorKey = sparkColor || m.color;

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position:'relative', background: hover ? D.surfaceHi : D.surface,
        border:`1px solid ${flash ? colorKey : (hover ? D.borderHi : D.border)}`,
        borderRadius: 12, padding: 14, display:'flex', flexDirection:'column', gap:8,
        minHeight: 134, transition:'border-color .35s, background .15s, box-shadow .35s',
        overflow:'hidden',
        backdropFilter:'blur(20px)',
        boxShadow: flash ? `0 0 24px ${colorKey}55, inset 0 0 0 1px ${colorKey}` : 'none',
      }}>
      {/* subtle hue glow top-right */}
      <div style={{
        position:'absolute', top:-30, right:-30, width:90, height:90,
        background:`radial-gradient(circle, ${colorKey} 0%, transparent 70%)`,
        opacity: hover ? 0.32 : 0.18, transition:'opacity .2s', pointerEvents:'none',
      }} />

      <div style={{ position:'relative', display:'flex', alignItems:'baseline', justifyContent:'space-between', gap:8 }}>
        <span style={{ fontFamily:D.mono, fontSize:10, letterSpacing:'0.1em', textTransform:'uppercase', color: D.fgDim }}>{m.label}</span>
        {m.goal && (
          <span style={{
            fontSize:10, fontFamily:D.mono, color: ahead ? D.green : D.fgMuted,
            display:'inline-flex', alignItems:'center', gap:4,
          }}>
            {ahead && <Icon.check s={10} />}
            {fmt(m.week, m.fmt)}/{fmt(m.goal, m.fmt)}
          </span>
        )}
      </div>

      <div style={{ position:'relative', display:'flex', alignItems:'baseline', gap:6 }}>
        <InlineNumber
          value={m.today}
          onCommit={(v) => setMetric(metricId, { today: v })}
          fmt={m.fmt}
          style={{
            ...numStyle, fontSize: big ? 30 : 26,
            color: D.ink, lineHeight: 1,
          }}
        />
        {m.fmt !== 'pct' && m.id !== 'cashMoM' && (
          <span style={{ fontFamily:D.mono, fontSize:10, color:D.fgMuted, letterSpacing:'0.06em' }}>TODAY</span>
        )}
      </div>

      <div style={{ position:'relative', fontSize:11, color: D.fgDim, display:'flex', alignItems:'center', gap:6 }}>
        <span>{subValue}</span>
      </div>

      {/* Footer: sparkline / progress / quick-log */}
      <div style={{ marginTop:'auto', height:32, position:'relative' }}>
        <div style={{
          position:'absolute', inset:0,
          opacity: hover && presets[metricId]?.length ? 0 : 1,
          transition:'opacity .12s',
          pointerEvents: hover && presets[metricId]?.length ? 'none' : 'auto',
        }}>
          {m.spark ? (
            <Sparkline data={m.spark} color={colorKey} fill={colorKey} height={32} width={232} />
          ) : (
            goalPct != null ? (
              <div style={{ width:'100%', height:4, background:'rgba(255,255,255,0.06)', borderRadius:2, marginTop:14, overflow:'hidden' }}>
                <div style={{ width: `${goalPct*100}%`, height:'100%', background: ahead ? D.green : colorKey, boxShadow: `0 0 8px ${colorKey}66`, transition:'width .3s' }} />
              </div>
            ) : (
              <div style={{ marginTop:14, fontSize:10, fontFamily:D.mono, color:D.fgMuted, letterSpacing:'0.08em', textTransform:'uppercase' }}>{m.note}</div>
            )
          )}
        </div>
        <div style={{
          position:'absolute', inset:0, display:'flex', gap:4, alignItems:'center',
          opacity: hover && presets[metricId]?.length ? 1 : 0,
          transition:'opacity .12s',
          pointerEvents: hover && presets[metricId]?.length ? 'auto' : 'none',
        }}>
          {(presets[metricId] || []).map(([lbl, amt]) => (
            <button key={lbl} onClick={() => log(metricId, amt, lbl.trim())} style={{
              flex:1, padding:'6px 4px', fontSize:11, fontFamily:D.font, fontWeight:500,
              background:`${colorKey}22`, color:colorKey, border:`1px solid ${colorKey}40`,
              borderRadius:6, cursor:'pointer',
            }}>{lbl}</button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────
   PANELS, ROWS, T3T (dark variants of V1's same anatomy)
   ──────────────────────────────────────────────────────────────────────── */

function DPanel({ title, count, open: initialOpen = false, accent, children, action }) {
  const [open, setOpen] = useState(initialOpen);
  return (
    <div style={{
      background:D.surface, border:`1px solid ${D.border}`, borderRadius:12,
      overflow:'hidden', backdropFilter:'blur(20px)',
    }}>
      <button onClick={() => setOpen(o => !o)} style={{
        width:'100%', display:'flex', alignItems:'center', gap:10, padding:'12px 14px',
        background:'transparent', border:'none', cursor:'pointer', font:'inherit', textAlign:'left',
        color:D.fg,
      }}>
        <Icon.chevron s={12} style={{ transform: open ? 'rotate(90deg)' : 'rotate(0)', transition:'transform .15s', color:D.fgDim }} />
        <span style={{ fontSize:13, fontWeight:600, color:D.ink }}>{title}</span>
        {count != null && <span style={{ fontSize:11, fontFamily:D.mono, color:D.fgMuted }}>{count}</span>}
        {accent}
        <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:8 }}>{action}</div>
      </button>
      {open && <div style={{ borderTop:`1px solid ${D.border}`, padding:'4px 0' }}>{children}</div>}
    </div>
  );
}

function DActivityRow({ a }) {
  const isPositive = a.delta?.startsWith('+');
  return (
    <div style={{
      display:'flex', gap:10, alignItems:'flex-start', padding:'10px 14px',
      borderTop:`1px solid ${D.border}`,
      background: a._flash ? D.uvSoft : 'transparent', transition:'background .8s',
    }}>
      <span style={{ fontFamily:D.mono, fontSize:10, color:D.fgMuted, paddingTop:2, minWidth:34 }}>{a.t}</span>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:'flex', alignItems:'baseline', gap:6 }}>
          <span style={{
            fontFamily:D.mono, fontSize:11, fontWeight:500,
            color: isPositive ? D.green : D.fg,
          }}>{a.delta}</span>
          <span style={{ fontSize:12, color:D.ink, fontWeight:500 }}>{a.label}</span>
        </div>
        <div style={{ fontSize:11, color:D.fgDim, marginTop:1 }}>{a.meta}</div>
      </div>
    </div>
  );
}

/* ───────────────────────────────────────────────────────────────────────
   COMMAND PALETTE — ⌘K overlay. Filterable action list; press ↩ to run
   the top match. Used by the search bar and the Log button.
   ─────────────────────────────────────────────────────────────────────── */

function CmdKOverlay({ open, onClose }) {
  const { log } = useMission();
  const [q, setQ] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) { setQ(''); setTimeout(() => inputRef.current?.focus(), 20); }
  }, [open]);

  const actions = [
    { kw:'+0.5h temporal', label:'Log +0.5h Temporal',  hint:'temp 0.5', icon:'⏱', accent:D.pink, run:() => log('temporal', 0.5, '+0.5h') },
    { kw:'+1h temporal',   label:'Log +1h Temporal',    hint:'temp 1',   icon:'⏱', accent:D.pink, run:() => log('temporal', 1, '+1h') },
    { kw:'+2h temporal',   label:'Log +2h Temporal',    hint:'temp 2',   icon:'⏱', accent:D.pink, run:() => log('temporal', 2, '+2h') },
    { kw:'+gen generated', label:'+ Generated $2,000',  hint:'$ gen',    icon:'$', accent:D.green, run:() => log('moneyMoved', 2000, '+ Generated') },
    { kw:'+moved',         label:'+ Moved $500',        hint:'$ moved',  icon:'$', accent:D.green, run:() => log('moneyMoved', 500, '+ Moved') },
    { kw:'+cut',           label:'+ Cut $250',          hint:'$ cut',    icon:'$', accent:D.green, run:() => log('moneyMoved', 250, '+ Cut') },
    { kw:'+call pipeline', label:'+ Pipeline call',     hint:'pipe',     icon:'☎', accent:D.amber, run:() => log('pipeline', 0.5, '+ Call') },
    { kw:'+demo pipeline', label:'+ Pipeline demo',     hint:'pipe',     icon:'☎', accent:D.amber, run:() => log('pipeline', 1, '+ Demo') },
    { kw:'+0.5h deep',     label:'+0.5h Deep work',     hint:'deep',     icon:'◆', accent:D.cyan, run:() => log('deepWork', 0.5, '+0.5h') },
    { kw:'+1h deep',       label:'+1h Deep work',       hint:'deep 1',   icon:'◆', accent:D.cyan, run:() => log('deepWork', 1, '+1h') },
    { kw:'+train session', label:'+ Training session',  hint:'train',    icon:'△', accent:D.amber, run:() => log('trained', 1, '+ Session') },
    { kw:'reflect t3t',    label:'Open reflection',     hint:'⌘R',     icon:'❋', accent:D.pink, run:() => {} },
    { kw:'insights trends',label:'Open insights',       hint:'tab 2',    icon:'∿', accent:D.uv,   run:() => {} },
    { kw:'review',         label:'Open review',         hint:'tab 3',    icon:'▸', accent:D.uv,   run:() => {} },
  ];
  const filtered = q
    ? actions.filter(a => a.kw.includes(q.toLowerCase()) || a.label.toLowerCase().includes(q.toLowerCase()))
    : actions.slice(0, 8);

  const exec = (a) => { a.run(); onClose(); };

  if (!open) return null;
  return (
    <div onClick={onClose} style={{
      position:'absolute', inset:0, background:'rgba(0,0,0,0.55)', backdropFilter:'blur(6px)',
      display:'flex', alignItems:'flex-start', justifyContent:'center', paddingTop:80, zIndex:50,
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width:'min(560px, 92%)', background:D.bgWarm, border:`1px solid ${D.borderHi}`,
        borderRadius:14, overflow:'hidden',
        boxShadow:`0 30px 80px rgba(0,0,0,0.6), 0 0 0 1px ${D.uv}22, 0 0 80px ${D.uv}1A`,
      }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, padding:'14px 16px', borderBottom: filtered.length ? `1px solid ${D.border}` : 'none' }}>
          <Icon.search s={15} style={{ color:D.uvHi }} />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && filtered[0]) { e.preventDefault(); exec(filtered[0]); }
              if (e.key === 'Escape') onClose();
            }}
            placeholder="Log, jump, search… try “+1h temporal” or “gen 2000”"
            style={{
              flex:1, background:'transparent', border:'none', outline:'none',
              fontFamily:D.font, fontSize:14, color:D.ink,
            }}
          />
          <span style={{ fontFamily:D.mono, fontSize:10, color:D.fgMuted, padding:'2px 6px', background:D.surface, border:`1px solid ${D.border}`, borderRadius:4, letterSpacing:'0.06em' }}>ESC</span>
        </div>
        <div style={{ maxHeight:340, overflow:'auto', padding:'6px 0' }}>
          {filtered.map((a, i) => (
            <button key={a.kw + i} onClick={() => exec(a)} style={{
              width:'100%', display:'flex', alignItems:'center', gap:12, padding:'10px 14px',
              background: i === 0 ? D.surface : 'transparent', border:'none', cursor:'pointer',
              font:'inherit', textAlign:'left', color:D.fg,
            }}>
              <span style={{
                width:28, height:28, borderRadius:7, background: `${a.accent}22`, color: a.accent,
                display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, fontFamily:D.mono,
              }}>{a.icon}</span>
              <span style={{ flex:1, fontSize:13, color:D.ink }}>{a.label}</span>
              <span style={{ fontFamily:D.mono, fontSize:10, color:D.fgMuted, letterSpacing:'0.04em' }}>{a.hint}</span>
              {i === 0 && <span style={{ fontFamily:D.mono, fontSize:10, color:D.uvHi, padding:'2px 6px', background:D.uvSoft, border:`1px solid ${D.uv}55`, borderRadius:4 }}>↩</span>}
            </button>
          ))}
          {filtered.length === 0 && (
            <div style={{ padding:'18px 16px', color:D.fgDim, fontSize:13 }}>No match. Try “temp”, “gen”, “call”, “train”, “reflect”.</div>
          )}
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:12, padding:'8px 14px', borderTop:`1px solid ${D.border}`, background:'rgba(0,0,0,0.2)' }}>
          <span style={{ fontFamily:D.mono, fontSize:10, color:D.fgMuted, letterSpacing:'0.06em' }}>↩ RUN</span>
          <span style={{ fontFamily:D.mono, fontSize:10, color:D.fgMuted, letterSpacing:'0.06em' }}>ESC CLOSE</span>
          <span style={{ marginLeft:'auto', fontFamily:D.mono, fontSize:10, color:D.fgDim, letterSpacing:'0.06em' }}>{filtered.length} · {actions.length} ACTIONS</span>
        </div>
      </div>
    </div>
  );
}

function DT3TInline() {
  const { answers, setAnswer } = useMission();
  return (
    <div>
      {T3T_PROMPTS.map((p, i) => {
        const v = answers[p.id] || '';
        const done = !!v.trim();
        return (
          <div key={p.id} style={{
            display:'flex', gap:10, alignItems:'flex-start', padding:'10px 14px',
            borderTop: i ? `1px solid ${D.border}` : 'none',
          }}>
            <span style={{
              width:20, height:20, borderRadius:'50%',
              background: done ? D.green : D.surfaceHi,
              color: done ? '#000' : D.fgDim,
              fontSize:10, fontFamily:D.mono, fontWeight:600,
              display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, marginTop:1,
            }}>{done ? <Icon.check s={10} /> : i + 1}</span>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:12.5, color:D.fg, lineHeight:1.45, marginBottom:5 }}>{p.q}</div>
              <textarea
                value={v}
                onChange={(e) => setAnswer(p.id, e.target.value)}
                placeholder="Type your answer · auto-saves"
                rows={1}
                style={{
                  width:'100%', resize:'none', padding:'7px 9px', fontSize:12, lineHeight:1.5,
                  fontFamily:D.font, border:`1px solid ${D.border}`, borderRadius:6,
                  background:D.bgWarm, color:D.ink, outline:'none',
                }}
                onFocus={(e) => { e.target.style.borderColor = D.uv; e.target.style.boxShadow = `0 0 0 3px ${D.uvSoft}`; }}
                onBlur={(e) => { e.target.style.borderColor = D.border; e.target.style.boxShadow = 'none'; }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────
   V1·D DESKTOP
   ──────────────────────────────────────────────────────────────────────── */

function V1DDesktopInner() {
  const { metrics, activity } = useMission();
  const [tab, setTab] = useState('overview');
  const [cmdOpen, setCmdOpen] = useState(false);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCmdOpen(o => !o);
      } else if (e.key === 'Escape') {
        setCmdOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="ab" style={{
      width:'100%', height:'100%', background:D.bg, color:D.fg,
      fontFamily:D.font, fontSize:13, display:'flex', flexDirection:'column',
      position:'relative', overflow:'hidden',
    }}>
      <Aurora />

      {/* Top bar */}
      <header style={{
        position:'relative',
        display:'flex', alignItems:'center', gap:14, padding:'12px 20px',
        borderBottom:`1px solid ${D.border}`,
        background:'rgba(14,12,20,0.6)', backdropFilter:'blur(24px)',
      }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{
            width:28, height:28, borderRadius:8, background:D.uv,
            display:'flex', alignItems:'center', justifyContent:'center',
            boxShadow:`0 0 18px ${D.uv}88`,
          }}>
            <OrbitStar size={16} color="#fff" />
          </div>
          <span style={{ fontWeight:600, fontSize:14, letterSpacing:'-0.01em', color:D.ink }}>Mission Control</span>
        </div>
        <span style={{ color:D.fgMuted, fontFamily:D.mono, fontSize:11, letterSpacing:'0.06em' }}>WED · 2026-05-27 · 09:12</span>

        <nav style={{ marginLeft:18, display:'flex', gap:4, alignItems:'center' }}>
          {['overview','insights','review'].map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding:'5px 12px', fontSize:12, fontWeight:500, textTransform:'capitalize',
              background: tab === t ? D.uvSoft : 'transparent',
              color: tab === t ? D.uvHi : D.fgDim,
              border: tab === t ? `1px solid ${D.uv}55` : `1px solid transparent`,
              borderRadius:6, cursor:'pointer', font:'inherit', fontWeight:500,
            }}>{t}</button>
          ))}
        </nav>

        <div
          onClick={() => setCmdOpen(true)}
          style={{
            marginLeft:'auto', display:'flex', alignItems:'center', gap:8,
            padding:'5px 10px', border:`1px solid ${D.border}`, borderRadius:8,
            background:D.surface, color:D.fgDim, fontSize:12, minWidth:260, cursor:'pointer',
          }}>
          <Icon.search s={14} />
          <span style={{ flex:1 }}>Log, jump, find…</span>
          <span style={{ fontFamily:D.mono, fontSize:10, padding:'1px 5px', background:D.surfaceHi, border:`1px solid ${D.border}`, borderRadius:3, color:D.fgDim }}>⌘K</span>
        </div>
        <button onClick={() => setCmdOpen(true)} style={{
          padding:'6px 14px', background:D.uv, color:'#fff', border:'none', borderRadius:8,
          font:'inherit', fontSize:12, fontWeight:500, cursor:'pointer', display:'flex', alignItems:'center', gap:6,
          boxShadow:`0 4px 14px ${D.uv}55`,
        }}>
          <Icon.plus s={12} /> Log
        </button>
      </header>

      {/* Body */}
      <div style={{ position:'relative', flex:1, padding:'16px 20px', overflow:'auto', display:'flex', flexDirection:'column', gap:14 }}>
        {/* Chip strip */}
        <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
          <div style={{ display:'flex', alignItems:'center', gap:6, padding:'5px 11px', background:D.surface, border:`1px solid ${D.border}`, borderRadius:99, fontSize:11.5, backdropFilter:'blur(12px)' }}>
            <Icon.flame s={12} style={{ color: D.amber }} />
            <span style={{ color:D.ink, fontWeight:500 }}>6-day Temporal streak</span>
            <span style={{ color:D.fgMuted, fontFamily:D.mono, fontSize:10 }}>· longest in 30d</span>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:6, padding:'5px 11px', background:`${D.green}14`, border:`1px solid ${D.green}40`, borderRadius:99, fontSize:11.5 }}>
            <Icon.arrowUp s={12} style={{ color: D.green }} />
            <span style={{ color:D.ink, fontWeight:500 }}>Cash MoM</span>
            <span style={{ color:D.green, fontFamily:D.mono, fontSize:11 }}>+228%</span>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:6, padding:'5px 11px', background:`${D.amber}14`, border:`1px solid ${D.amber}40`, borderRadius:99, fontSize:11.5, color:D.amber }}>
            <Icon.bolt s={12} />
            <span style={{ fontWeight:500, color:D.ink }}>Deep work pace ↓ vs 14-day avg</span>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:6, padding:'5px 11px', background:D.surface, border:`1px solid ${D.border}`, borderRadius:99, fontSize:11.5, color:D.fgDim }}>
            <span style={{ fontFamily:D.mono, fontSize:10, letterSpacing:'0.08em' }}>SYNC</span>
            <span style={{ fontFamily:D.mono, fontSize:10, letterSpacing:'0.08em' }}>· monarch · 4m ago</span>
          </div>
        </div>

        {/* Metric grid */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(6, 1fr)', gap:10 }}>
          <DMetricCard metricId="cash"       sparkColor={D.uv} />
          <DMetricCard metricId="netWorth"   sparkColor={D.cyan} />
          <DMetricCard metricId="temporal"   sparkColor={D.pink} />
          <DMetricCard metricId="pipeline"   sparkColor={D.amber} />
          <DMetricCard metricId="deepWork"   sparkColor={D.cyan} />
          <DMetricCard metricId="moneyMoved" sparkColor={D.green} />
        </div>

        {/* Main grid */}
        <div style={{ flex:1, display:'grid', gridTemplateColumns:'1fr 320px', gap:14, minHeight:0 }}>
          <div style={{ display:'flex', flexDirection:'column', gap:10, minHeight:0 }}>
            <DPanel title="Three to Thrive" count="0 / 3" open accent={
              <span style={{ marginLeft:6, padding:'1px 8px', background:`${D.amber}22`, color:D.amber, fontSize:10, fontFamily:D.mono, letterSpacing:'0.06em', borderRadius:99, border:`1px solid ${D.amber}40` }}>DAILY</span>
            }>
              <DT3TInline />
            </DPanel>

            <DPanel title="Trends · last 14 days" accent={
              <span style={{ marginLeft:6, padding:'1px 8px', background:D.uvSoft, color:D.uvHi, fontSize:10, fontFamily:D.mono, letterSpacing:'0.06em', borderRadius:99, border:`1px solid ${D.uv}55` }}>+18% MoM</span>
            } open>
              <div style={{ padding:'14px', display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:14 }}>
                {[
                  { label:'TEMPORAL', sub:'6.5h · goal 5h', data:TEMPORAL_14, color:D.pink, delta:'+30%' },
                  { label:'DEEP WORK',sub:'5h this week',   data:DEEPWORK_14, color:D.cyan, delta:'−10%' },
                  { label:'PIPELINE', sub:'8 touches',      data:PIPELINE_14, color:D.amber, delta:'+40%' },
                ].map(s => (
                  <div key={s.label} style={{ display:'flex', flexDirection:'column', gap:6 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline' }}>
                      <span style={{ fontFamily:D.mono, fontSize:10, letterSpacing:'0.1em', color:D.fgDim }}>{s.label}</span>
                      <span style={{ fontFamily:D.mono, fontSize:11, color: s.delta.startsWith('+') ? D.green : D.red }}>{s.delta}</span>
                    </div>
                    <Sparkline data={s.data} color={s.color} fill={s.color} height={36} width={260} strokeWidth={1.5} dots />
                    <span style={{ fontSize:11, color:D.fgDim }}>{s.sub}</span>
                  </div>
                ))}
              </div>
            </DPanel>

            <DPanel title="Tasks" count="3 open" action={
              <span style={{ fontSize:11, color:D.fgMuted, fontFamily:D.mono, letterSpacing:'0.06em' }}>Add ⌘N</span>
            }>
              <div>
                {[
                  ['Investor deck v3', 'today',   true,  'temporal', D.pink],
                  ['Northway followup', 'today',  false, 'pipeline', D.amber],
                  ['Review monthly P&L', 'tmrw',  false, 'finance',  D.green],
                ].map(([t, when, done, kind, c]) => (
                  <div key={t} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', borderTop:`1px solid ${D.border}` }}>
                    <span style={{
                      width:14, height:14, borderRadius:3, border:`1.5px solid ${done ? D.green : D.borderHi}`,
                      background: done ? D.green : 'transparent', display:'flex', alignItems:'center', justifyContent:'center',
                    }}>{done && <Icon.check s={9} style={{ color:'#000' }} />}</span>
                    <span style={{ flex:1, fontSize:12.5, color: done ? D.fgMuted : D.ink, textDecoration: done ? 'line-through' : 'none' }}>{t}</span>
                    <span style={{ fontSize:10, fontFamily:D.mono, color:c, letterSpacing:'0.08em' }}>{kind.toUpperCase()}</span>
                    <span style={{ fontSize:11, color:D.fgDim }}>{when}</span>
                  </div>
                ))}
              </div>
            </DPanel>
          </div>

          {/* Activity feed */}
          <div style={{
            background:D.surface, border:`1px solid ${D.border}`, borderRadius:12,
            display:'flex', flexDirection:'column', overflow:'hidden', backdropFilter:'blur(20px)',
          }}>
            <div style={{ padding:'12px 14px', display:'flex', alignItems:'center', justifyContent:'space-between', borderBottom:`1px solid ${D.border}` }}>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <span style={{ fontSize:13, fontWeight:600, color:D.ink }}>Activity</span>
                <span style={{ width:6, height:6, borderRadius:'50%', background:D.green, boxShadow:`0 0 8px ${D.green}`, animation:'mc-pulse 2s ease-in-out infinite' }} />
              </div>
              <span style={{ fontFamily:D.mono, fontSize:10, color:D.fgDim, letterSpacing:'0.08em' }}>LIVE</span>
            </div>
            <div style={{ flex:1, overflow:'auto' }}>
              {activity.map((a, i) => <DActivityRow key={a.id || i} a={a} />)}
            </div>
          </div>
        </div>
      </div>
      <CmdKOverlay open={cmdOpen} onClose={() => setCmdOpen(false)} />
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────
   V1·D MOBILE
   ──────────────────────────────────────────────────────────────────────── */

function V1DMobileInner() {
  const { metrics, activity, log } = useMission();

  return (
    <div className="ab" style={{
      width:'100%', height:'100%', background:D.bg, color:D.fg, fontFamily:D.font, fontSize:14,
      display:'flex', flexDirection:'column', position:'relative', overflow:'hidden',
    }}>
      <Aurora intensity={0.9} />

      <div style={{ position:'relative', height:'100%', display:'flex', flexDirection:'column' }}>
        {/* Status bar */}
        <div style={{ height:38, padding:'10px 18px 0', display:'flex', justifyContent:'space-between', fontFamily:D.font, fontSize:13, color:D.ink, fontWeight:600 }}>
          <span>9:12</span>
          <span style={{ fontFamily:D.mono, color:D.fgDim, fontSize:11 }}>5G ●●●●</span>
        </div>

        {/* Header */}
        <div style={{ padding:'10px 18px 14px', display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ width:30, height:30, borderRadius:8, background:D.uv, display:'flex', alignItems:'center', justifyContent:'center', boxShadow:`0 0 16px ${D.uv}88` }}>
            <OrbitStar size={18} color="#fff" />
          </div>
          <div>
            <h1 style={{ margin:0, fontSize:20, fontWeight:600, letterSpacing:'-0.02em', color:D.ink }}>Mission Control</h1>
            <div style={{ fontSize:11, color:D.fgDim, fontFamily:D.mono, letterSpacing:'0.06em', marginTop:1 }}>WED · 2026-05-27</div>
          </div>
        </div>

        {/* Hero: Temporal */}
        <div style={{ padding:'0 18px 12px' }}>
          <div style={{
            background:`linear-gradient(135deg, ${D.uv}26 0%, ${D.pink}1A 100%)`,
            border:`1px solid ${D.uv}55`, borderRadius:16, padding:'16px 18px',
            position:'relative', overflow:'hidden',
          }}>
            <div style={{ position:'absolute', top:-30, right:-30, width:140, height:140, background:`radial-gradient(circle, ${D.uv} 0%, transparent 70%)`, opacity:0.4, pointerEvents:'none' }} />
            <div style={{ position:'relative' }}>
              <div style={{ fontFamily:D.mono, fontSize:10, letterSpacing:'0.1em', color:D.uvHi }}>TEMPORAL · TODAY</div>
              <div style={{ display:'flex', alignItems:'baseline', justifyContent:'space-between', marginTop:6 }}>
                <span style={{ ...numStyle, fontSize:46, color:D.ink, lineHeight:1 }}>{fmt(metrics.temporal.today, 'hours')}</span>
                <span style={{ fontFamily:D.mono, fontSize:11, color:D.fgDim }}>{fmt(metrics.temporal.week,'hours')} / {fmt(metrics.temporal.goal,'hours')} wk</span>
              </div>
              <div style={{ marginTop:10, height:5, background:'rgba(255,255,255,0.1)', borderRadius:3, overflow:'hidden' }}>
                <div style={{ width: `${clamp(metrics.temporal.week / metrics.temporal.goal, 0, 1) * 100}%`, height:'100%', background:D.uv, boxShadow:`0 0 8px ${D.uv}88` }} />
              </div>
              <div style={{ display:'flex', gap:6, marginTop:14 }}>
                {[['+0.5h',0.5],['+1h',1],['+2h',2]].map(([l,a]) => (
                  <button key={l} onClick={() => log('temporal', a, l)} style={{
                    flex:1, padding:'11px 0', background:'rgba(255,255,255,0.08)', color:D.ink,
                    border:`1px solid ${D.uv}55`, borderRadius:8, font:'inherit', fontSize:13, fontWeight:500, cursor:'pointer',
                  }}>{l}</button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Snapshot scroll */}
        <div style={{ padding:'0 0 12px' }}>
          <div style={{ display:'flex', gap:8, padding:'0 18px', overflowX:'auto', scrollbarWidth:'none' }}>
            {['cash','netWorth','pipeline','moneyMoved','deepWork'].map(id => {
              const m = metrics[id];
              const c = { cash:D.uv, netWorth:D.cyan, pipeline:D.amber, moneyMoved:D.green, deepWork:D.cyan }[id];
              return (
                <div key={id} style={{ minWidth:130, background:D.surface, border:`1px solid ${D.border}`, borderRadius:10, padding:'10px 12px', position:'relative', overflow:'hidden', backdropFilter:'blur(20px)' }}>
                  <div style={{ position:'absolute', top:-20, right:-20, width:60, height:60, background:`radial-gradient(circle, ${c} 0%, transparent 70%)`, opacity:0.25, pointerEvents:'none' }} />
                  <div style={{ position:'relative' }}>
                    <div style={{ fontFamily:D.mono, fontSize:9, letterSpacing:'0.08em', color:D.fgDim, textTransform:'uppercase' }}>{m.label}</div>
                    <div style={{ ...numStyle, fontSize:20, color:D.ink, marginTop:4 }}>{fmt(m.today, m.fmt)}</div>
                    <div style={{ fontSize:10, color:D.fgDim, marginTop:2, fontFamily:D.mono }}>{m.note || ''}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Quick actions */}
        <div style={{ padding:'0 18px 12px' }}>
          <div style={{ fontFamily:D.mono, fontSize:10, letterSpacing:'0.1em', color:D.fgDim, marginBottom:6 }}>QUICK LOG</div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:6 }}>
            {[
              ['+ Moved',     'moneyMoved', 250,  D.green],
              ['+ Generated', 'moneyMoved', 500,  D.green],
              ['+ Call',      'pipeline',   0.5,  D.amber],
              ['+ Demo',      'pipeline',   1,    D.amber],
              ['+ Deep 0.5h', 'deepWork',   0.5,  D.cyan],
              ['+ Train',     'trained',    1,    D.pink],
            ].map(([l, m, a, c]) => (
              <button key={l} onClick={() => log(m, a, l.trim())} style={{
                padding:'12px 0', background:`${c}1A`, color:c, border:`1px solid ${c}40`, borderRadius:10,
                font:'inherit', fontSize:12, fontWeight:500, cursor:'pointer',
              }}>{l}</button>
            ))}
          </div>
        </div>

        {/* Activity */}
        <div style={{ flex:1, padding:'0 18px 80px', overflow:'auto' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
            <span style={{ fontFamily:D.mono, fontSize:10, letterSpacing:'0.1em', color:D.fgDim }}>RECENT</span>
            <span style={{ fontSize:11, color:D.fgDim }}>Reflect ↑</span>
          </div>
          <div style={{ background:D.surface, border:`1px solid ${D.border}`, borderRadius:12, overflow:'hidden', backdropFilter:'blur(20px)' }}>
            {activity.slice(0, 5).map((a, i) => <DActivityRow key={a.id || i} a={a} />)}
          </div>
        </div>

        {/* Bottom nav */}
        <div style={{
          position:'absolute', bottom:0, left:0, right:0, padding:'10px 18px 22px',
          background:'rgba(14,12,20,0.85)', backdropFilter:'blur(18px)',
          borderTop:`1px solid ${D.border}`, display:'flex', justifyContent:'space-around',
        }}>
          {[['Overview', true, 'dot'],['Insights', false, 'bolt'],['Reflect', false, 'brain'],['Tasks', false, 'check']].map(([l,active,icon]) => (
            <button key={l} style={{
              background:'transparent', border:'none', font:'inherit', fontSize:11, fontWeight:500,
              color: active ? D.uvHi : D.fgDim, display:'flex', flexDirection:'column', alignItems:'center', gap:3,
            }}>
              <span style={{ width:26, height:26, borderRadius:7, background: active ? D.uvSoft : 'transparent', display:'flex', alignItems:'center', justifyContent:'center', border: active ? `1px solid ${D.uv}55` : 'none' }}>
                {icon === 'dot' && <Icon.dot s={8} style={{ color: active ? D.uvHi : D.fgMuted }} />}
                {icon === 'bolt' && <Icon.bolt s={14} />}
                {icon === 'brain' && <Icon.brain s={14} />}
                {icon === 'check' && <Icon.check s={14} />}
              </span>
              {l}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function V1DMobile() { return <MissionProvider><V1DMobileInner /></MissionProvider>; }

/* ────────────────────────────────────────────────────────────────────────
   V1·D DRAWER
   ──────────────────────────────────────────────────────────────────────── */

function V1DDrawerInner() {
  const { answers, setAnswer } = useMission();
  const answered = T3T_PROMPTS.filter(p => (answers[p.id] || '').trim()).length;
  return (
    <div className="ab" style={{
      width:'100%', height:'100%', background:D.bg, color:D.fg,
      fontFamily:D.font, fontSize:13, display:'flex', flexDirection:'column',
      borderLeft:`1px solid ${D.borderHi}`, boxShadow:`-24px 0 60px rgba(0,0,0,0.5)`,
      position:'relative', overflow:'hidden',
    }}>
      <Aurora intensity={0.7} />

      <div style={{ position:'relative', height:'100%', display:'flex', flexDirection:'column' }}>
        {/* Header */}
        <div style={{ padding:'16px 22px', borderBottom:`1px solid ${D.border}`, display:'flex', alignItems:'center', gap:12 }}>
          <div style={{ width:36, height:36, borderRadius:10, background:`linear-gradient(135deg, ${D.uv}, ${D.pink})`, display:'flex', alignItems:'center', justifyContent:'center', boxShadow:`0 0 18px ${D.uv}66` }}>
            <OrbitStar size={20} color="#fff" />
          </div>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:15, fontWeight:600, color:D.ink }}>Reflection</div>
            <div style={{ fontSize:11, color:D.fgDim, fontFamily:D.mono, letterSpacing:'0.06em', marginTop:1 }}>WED · 2026-05-27 · {answered}/3 answered</div>
          </div>
          <button style={{
            width:30, height:30, borderRadius:8, background:D.surface, border:`1px solid ${D.border}`,
            color:D.fgDim, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer',
          }}><Icon.close s={14} /></button>
        </div>

        {/* Progress */}
        <div style={{ padding:'14px 22px 0' }}>
          <div style={{ display:'flex', gap:6 }}>
            {[0,1,2].map(i => (
              <div key={i} style={{
                flex:1, height:4, borderRadius:2,
                background: i < answered ? `linear-gradient(90deg, ${D.uv}, ${D.pink})` : D.surfaceHi,
                boxShadow: i < answered ? `0 0 10px ${D.uv}` : 'none',
              }} />
            ))}
          </div>
        </div>

        {/* Prompts */}
        <div style={{ flex:1, overflow:'auto', padding:'16px 22px 20px', display:'flex', flexDirection:'column', gap:20 }}>
          {T3T_PROMPTS.map((p, i) => {
            const v = answers[p.id] || '';
            const done = !!v.trim();
            const c = [D.uv, D.pink, D.amber][i];
            return (
              <div key={p.id}>
                <div style={{ display:'flex', gap:10, alignItems:'flex-start', marginBottom:8 }}>
                  <span style={{
                    width:22, height:22, borderRadius:'50%',
                    background: done ? `linear-gradient(135deg, ${D.uv}, ${D.pink})` : `${c}22`,
                    color: done ? '#fff' : c,
                    fontSize:11, fontFamily:D.mono, fontWeight:600,
                    display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
                    boxShadow: done ? `0 0 10px ${D.uv}66` : 'none',
                  }}>{done ? <Icon.check s={11} /> : i + 1}</span>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:13.5, fontWeight:500, lineHeight:1.4, color:D.ink, fontFamily:D.serif, letterSpacing:'-0.005em' }}>{p.q}</div>
                    {p.tag && (
                      <span style={{ display:'inline-block', marginTop:5, padding:'1px 8px', fontSize:10, fontFamily:D.mono, color:D.pink, background:`${D.pink}1A`, border:`1px solid ${D.pink}40`, borderRadius:99, letterSpacing:'0.06em' }}>DAILY</span>
                    )}
                  </div>
                </div>
                <textarea
                  value={v}
                  onChange={(e) => setAnswer(p.id, e.target.value)}
                  placeholder="Type your answer · auto-saves"
                  rows={3}
                  style={{
                    width:'100%', resize:'vertical', padding:'10px 12px', fontSize:13, lineHeight:1.5,
                    fontFamily:D.font, border:`1px solid ${D.border}`, borderRadius:10,
                    background:D.surface, color:D.ink, outline:'none', backdropFilter:'blur(12px)',
                  }}
                  onFocus={(e) => { e.target.style.borderColor = c; e.target.style.boxShadow = `0 0 0 3px ${c}22`; }}
                  onBlur={(e) => { e.target.style.borderColor = D.border; e.target.style.boxShadow = 'none'; }}
                />
                {v && (
                  <div style={{ marginTop:4, fontSize:10, fontFamily:D.mono, color:D.green, letterSpacing:'0.06em' }}>
                    ● SAVED · {v.length} CHARS
                  </div>
                )}
              </div>
            );
          })}

          {/* Yesterday */}
          <div style={{ marginTop:6, padding:'12px 14px', background:D.surface, border:`1px solid ${D.border}`, borderRadius:10, borderLeft:`3px solid ${D.pink}`, backdropFilter:'blur(12px)' }}>
            <div style={{ fontFamily:D.mono, fontSize:10, letterSpacing:'0.1em', color:D.pink, marginBottom:6 }}>YESTERDAY · 3/3</div>
            <div style={{ fontSize:13, color:D.fg, lineHeight:1.5, fontStyle:'italic', fontFamily:D.serif }}>
              "Push through the investor doc resistance. Stop polishing what doesn't ship."
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding:'12px 22px', borderTop:`1px solid ${D.border}`, display:'flex', gap:8, alignItems:'center', background:'rgba(14,12,20,0.6)', backdropFilter:'blur(20px)' }}>
          <span style={{ fontSize:10, color:D.fgMuted, fontFamily:D.mono, letterSpacing:'0.06em' }}>⌘↩ TO SAVE & CLOSE</span>
          <button style={{
            marginLeft:'auto', padding:'9px 16px',
            background:`linear-gradient(135deg, ${D.uv}, ${D.pink})`, color:'#fff', border:'none',
            borderRadius:10, font:'inherit', fontSize:12.5, fontWeight:500, cursor:'pointer',
            boxShadow:`0 4px 12px ${D.uv}55`,
          }}>Save & close</button>
        </div>
      </div>
    </div>
  );
}

function V1DDrawer() { return <MissionProvider><V1DDrawerInner /></MissionProvider>; }
function V1DDesktop() { return <MissionProvider><V1DDesktopInner /></MissionProvider>; }

Object.assign(window, { V1DDesktop, V1DMobile, V1DDrawer });
