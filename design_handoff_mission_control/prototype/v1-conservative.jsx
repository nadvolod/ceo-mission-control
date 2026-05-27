// v1-conservative.jsx — Linear-style clean dashboard. Light, refined, dense.
// Bold without being weird. The "ships Monday" option.

const { useState, useEffect, useRef, useMemo } = React;

const V1 = {
  font: "'Geist','Inter',system-ui,sans-serif",
  mono: "'Geist Mono','JetBrains Mono',ui-monospace,monospace",
  bg: '#FAFAF9',
  surface: '#FFFFFF',
  ink: '#0E0E10',
  fg: '#16181D',
  fgDim: '#62646A',
  fgMuted: '#9C9FA6',
  border: 'rgba(14,14,16,0.07)',
  borderStrong: 'rgba(14,14,16,0.12)',
  accent: '#5B59FF',
  accentSoft: '#EEEDFF',
  ok: '#0A7C3E',
  warn: '#B45309',
  bad:  '#B91C1C',
};

/* ────────────────────────────────────────────────────────────────────────
   METRIC CARD — the hero primitive.
   States: idle / hover (reveals quick-log row).
   ──────────────────────────────────────────────────────────────────────── */

function MetricCard({ metricId, primary = false, sparkColor, big = false }) {
  const { metrics, log, setMetric } = useMission();
  const m = metrics[metricId];
  const [hover, setHover] = useState(false);
  if (!m) return null;

  // Quick log presets per metric
  const presets = {
    temporal:  [['+0.5h', 0.5], ['+1h', 1], ['+2h', 2]],
    focus:     [['+0.5h', 0.5], ['+1h', 1], ['+2h', 2]],
    pipeline:  [['+ Call', 0.5], ['+ Demo', 1], ['+ FU', 0.5]],
    deepWork:  [['+0.5h', 0.5], ['+1h', 1]],
    trained:   [['+ Session', 1]],
    moneyMoved:[['+ Moved', 250], ['+ Generated', 500], ['+ Cut', 100]],
    cash:      [],
    netWorth:  [],
    debt:      [],
    cashMoM:   [],
  };

  const displayValue = m.fmt === 'hours' ? m.today : m.today;
  const subValue = m.week != null ? `${fmt(m.week, m.fmt)} this week` : (m.note || '');
  const goalPct = m.goal ? clamp(m.week / m.goal, 0, 1) : null;
  const ahead   = m.goal && m.week >= m.goal;

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position:'relative', background: V1.surface, border:`1px solid ${V1.border}`,
        borderRadius: 10, padding: 14, display:'flex', flexDirection:'column', gap:8,
        minHeight: 132, transition:'border-color .15s, transform .15s',
        borderColor: hover ? V1.borderStrong : V1.border,
      }}>
      <div style={{ display:'flex', alignItems:'baseline', justifyContent:'space-between', gap:8 }}>
        <span style={{ fontFamily:V1.mono, fontSize:10, letterSpacing:'0.08em', textTransform:'uppercase', color:V1.fgMuted }}>{m.label}</span>
        {m.goal && (
          <span style={{
            fontSize:10, fontFamily:V1.mono, color: ahead ? V1.ok : V1.fgMuted,
            display:'inline-flex', alignItems:'center', gap:4,
          }}>
            {ahead && <Icon.check s={10} />}
            {fmt(m.week, m.fmt)}/{fmt(m.goal, m.fmt)}
          </span>
        )}
      </div>

      <div style={{ display:'flex', alignItems:'baseline', gap:6 }}>
        <InlineNumber
          value={displayValue}
          onCommit={(v) => setMetric(metricId, { today: v })}
          fmt={m.fmt}
          style={{ fontSize: big ? 32 : 26, fontWeight:600, letterSpacing:'-0.02em', color: V1.ink, lineHeight:1 }}
        />
        {m.fmt !== 'pct' && m.id !== 'cashMoM' && (
          <span style={{ fontSize:11, color:V1.fgMuted }}>today</span>
        )}
      </div>

      <div style={{ fontSize:11, color: V1.fgDim, display:'flex', alignItems:'center', gap:6 }}>
        <span>{subValue}</span>
      </div>

      {/* Footer: sparkline OR quick log */}
      <div style={{ marginTop:'auto', height:32, position:'relative' }}>
        <div style={{ position:'absolute', inset:0, opacity: hover && presets[metricId]?.length ? 0 : 1, transition:'opacity .12s', pointerEvents: hover && presets[metricId]?.length ? 'none' : 'auto' }}>
          {m.spark ? (
            <Sparkline data={m.spark} color={sparkColor || m.color} fill={sparkColor || m.color} height={32} width={232} />
          ) : (
            goalPct != null ? (
              <div style={{ width:'100%', height:4, background:'rgba(14,14,16,0.06)', borderRadius:2, marginTop:14, overflow:'hidden' }}>
                <div style={{ width: `${goalPct*100}%`, height:'100%', background: ahead ? V1.ok : (m.color || V1.accent), transition:'width .3s' }} />
              </div>
            ) : (
              <div style={{ marginTop:14, fontSize:10, fontFamily:V1.mono, color:V1.fgMuted, letterSpacing:'0.06em', textTransform:'uppercase' }}>{m.note}</div>
            )
          )}
        </div>
        <div style={{ position:'absolute', inset:0, display:'flex', gap:4, alignItems:'center', opacity: hover && presets[metricId]?.length ? 1 : 0, transition:'opacity .12s', pointerEvents: hover && presets[metricId]?.length ? 'auto' : 'none' }}>
          {(presets[metricId] || []).map(([lbl, amt]) => (
            <button key={lbl} onClick={() => log(metricId, amt, lbl.trim())} style={{
              flex:1, padding:'6px 4px', fontSize:11, fontFamily:V1.font, fontWeight:500,
              background:V1.accentSoft, color:V1.accent, border:'none', borderRadius:6, cursor:'pointer',
            }}>{lbl}</button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────
   ACTIVITY FEED ITEM
   ──────────────────────────────────────────────────────────────────────── */

function ActivityRow({ a }) {
  const isPositive = a.delta?.startsWith('+');
  return (
    <div style={{
      display:'flex', gap:10, alignItems:'flex-start', padding:'10px 12px',
      borderTop:`1px solid ${V1.border}`, background: a._flash ? 'rgba(91,89,255,0.06)' : 'transparent',
      transition:'background .8s',
    }}>
      <span style={{ fontFamily:V1.mono, fontSize:10, color:V1.fgMuted, paddingTop:2, minWidth:34 }}>{a.t}</span>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:'flex', alignItems:'baseline', gap:6 }}>
          <span style={{
            fontFamily:V1.mono, fontSize:11, fontWeight:500,
            color: isPositive ? V1.ok : V1.fg,
          }}>{a.delta}</span>
          <span style={{ fontSize:12, color:V1.fg, fontWeight:500 }}>{a.label}</span>
        </div>
        <div style={{ fontSize:11, color:V1.fgDim, marginTop:1 }}>{a.meta}</div>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────
   COLLAPSIBLE PANEL — the right way to surface "trends/review" sections.
   ──────────────────────────────────────────────────────────────────────── */

function Panel({ title, count, open: initialOpen = false, accent, children, action }) {
  const [open, setOpen] = useState(initialOpen);
  return (
    <div style={{ background:V1.surface, border:`1px solid ${V1.border}`, borderRadius:10, overflow:'hidden' }}>
      <button onClick={() => setOpen(o => !o)} style={{
        width:'100%', display:'flex', alignItems:'center', gap:10, padding:'12px 14px',
        background:'transparent', border:'none', cursor:'pointer', font:'inherit', textAlign:'left',
      }}>
        <Icon.chevron s={12} style={{ transform: open ? 'rotate(90deg)' : 'rotate(0)', transition:'transform .15s', color:V1.fgDim }} />
        <span style={{ fontSize:13, fontWeight:600, color:V1.fg }}>{title}</span>
        {count != null && (
          <span style={{ fontSize:11, fontFamily:V1.mono, color:V1.fgMuted }}>{count}</span>
        )}
        {accent}
        <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:8 }}>
          {action}
        </div>
      </button>
      {open && (
        <div style={{ borderTop:`1px solid ${V1.border}`, padding:'4px 0' }}>
          {children}
        </div>
      )}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────
   T3T — compact, inline-edit, NO giant textareas.
   ──────────────────────────────────────────────────────────────────────── */

function T3TInline({ compact = false }) {
  const { answers, setAnswer } = useMission();
  const answered = T3T_PROMPTS.filter(p => answers[p.id]?.trim()).length;
  return (
    <div>
      {T3T_PROMPTS.map((p, i) => {
        const v = answers[p.id] || '';
        const done = !!v.trim();
        return (
          <div key={p.id} style={{
            display:'flex', gap:10, alignItems:'flex-start', padding:'10px 14px',
            borderTop: i ? `1px solid ${V1.border}` : 'none',
          }}>
            <span style={{
              width:18, height:18, borderRadius:'50%',
              background: done ? V1.ok : 'rgba(14,14,16,0.05)',
              color: done ? '#fff' : V1.fgDim,
              fontSize:10, fontFamily:V1.mono, fontWeight:600,
              display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, marginTop:1,
            }}>{done ? <Icon.check s={10} /> : i + 1}</span>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:12.5, color:V1.fg, lineHeight:1.45, marginBottom:4 }}>{p.q}</div>
              <textarea
                value={v}
                onChange={(e) => setAnswer(p.id, e.target.value)}
                placeholder="Type your answer · auto-saves"
                rows={compact ? 1 : 2}
                style={{
                  width:'100%', resize:'none', padding:'6px 8px', fontSize:12, font:`inherit`,
                  fontFamily:V1.font, border:`1px solid ${V1.border}`, borderRadius:6,
                  background:V1.bg, color:V1.fg, outline:'none',
                }}
                onFocus={(e) => e.target.style.borderColor = V1.accent}
                onBlur={(e) => e.target.style.borderColor = V1.border}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────
   V1 DESKTOP
   ──────────────────────────────────────────────────────────────────────── */

function V1DesktopInner() {
  const { metrics, activity } = useMission();
  const [tab, setTab] = useState('overview');

  return (
    <div className="ab" style={{
      width:'100%', height:'100%', background:V1.bg, color:V1.fg,
      fontFamily:V1.font, fontSize:13, display:'flex', flexDirection:'column',
    }}>
      {/* Top bar */}
      <header style={{
        display:'flex', alignItems:'center', gap:14, padding:'12px 20px',
        borderBottom:`1px solid ${V1.border}`, background:V1.surface,
      }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <OrbitStar size={18} color={V1.accent} />
          <span style={{ fontWeight:600, fontSize:14, letterSpacing:'-0.01em' }}>Mission Control</span>
        </div>
        <span style={{ color:V1.fgMuted, fontFamily:V1.mono, fontSize:11 }}>WED · 2026-05-27 · 09:12</span>

        <nav style={{ marginLeft:18, display:'flex', gap:4, alignItems:'center' }}>
          {['overview','insights','review'].map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding:'5px 10px', fontSize:12, fontWeight:500, textTransform:'capitalize',
              background: tab === t ? V1.accentSoft : 'transparent', color: tab === t ? V1.accent : V1.fgDim,
              border:'none', borderRadius:6, cursor:'pointer', font:'inherit', fontWeight:500,
            }}>{t}</button>
          ))}
        </nav>

        <div style={{
          marginLeft:'auto', display:'flex', alignItems:'center', gap:8,
          padding:'5px 10px', border:`1px solid ${V1.border}`, borderRadius:8,
          background:V1.bg, color:V1.fgDim, fontSize:12, minWidth:240,
        }}>
          <Icon.search s={14} />
          <span style={{ flex:1 }}>Log, jump, find…</span>
          <span style={{ fontFamily:V1.mono, fontSize:10, padding:'1px 5px', background:V1.surface, border:`1px solid ${V1.border}`, borderRadius:3 }}>⌘K</span>
        </div>
        <button style={{
          padding:'6px 12px', background:V1.ink, color:'#fff', border:'none', borderRadius:6,
          font:'inherit', fontSize:12, fontWeight:500, cursor:'pointer', display:'flex', alignItems:'center', gap:6,
        }}>
          <Icon.plus s={12} /> Log
        </button>
      </header>

      {/* Body */}
      <div style={{ flex:1, padding:'16px 20px', overflow:'hidden', display:'flex', flexDirection:'column', gap:14 }}>
        {/* Anomaly / streak strip */}
        <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
          <div style={{ display:'flex', alignItems:'center', gap:6, padding:'5px 10px', background:V1.surface, border:`1px solid ${V1.border}`, borderRadius:99, fontSize:11.5 }}>
            <Icon.flame s={12} style={{ color: '#ea580c' }} />
            <span style={{ color:V1.fg, fontWeight:500 }}>6-day Temporal streak</span>
            <span style={{ color:V1.fgMuted, fontFamily:V1.mono, fontSize:10 }}>· longest in 30d</span>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:6, padding:'5px 10px', background:V1.surface, border:`1px solid ${V1.border}`, borderRadius:99, fontSize:11.5 }}>
            <Icon.arrowUp s={12} style={{ color: V1.ok }} />
            <span style={{ color:V1.fg, fontWeight:500 }}>Cash MoM</span>
            <span style={{ color:V1.ok, fontFamily:V1.mono, fontSize:11 }}>+228%</span>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:6, padding:'5px 10px', background:'#FEF6EC', border:`1px solid #F2D5A0`, borderRadius:99, fontSize:11.5, color:'#9A5B07' }}>
            <Icon.bolt s={12} />
            <span style={{ fontWeight:500 }}>Deep work pace ↓ vs 14-day avg</span>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:6, padding:'5px 10px', background:V1.surface, border:`1px solid ${V1.border}`, borderRadius:99, fontSize:11.5, color:V1.fgDim }}>
            <span style={{ fontFamily:V1.mono, fontSize:10 }}>SYNC</span>
            <span style={{ fontFamily:V1.mono, fontSize:10 }}>· monarch · 4m ago</span>
          </div>
        </div>

        {/* Metric grid */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(6, 1fr)', gap:10 }}>
          <MetricCard metricId="cash" sparkColor={V1.accent} />
          <MetricCard metricId="netWorth" sparkColor="#0ea5e9" />
          <MetricCard metricId="temporal" sparkColor="#7c3aed" />
          <MetricCard metricId="pipeline" sparkColor="#a855f7" />
          <MetricCard metricId="deepWork" sparkColor="#3b82f6" />
          <MetricCard metricId="moneyMoved" sparkColor="#f59e0b" />
        </div>

        {/* Main grid: trends/panels + activity feed */}
        <div style={{ flex:1, display:'grid', gridTemplateColumns:'1fr 320px', gap:14, minHeight:0 }}>
          <div style={{ display:'flex', flexDirection:'column', gap:10, minHeight:0 }}>
            {/* Today snapshot — collapsed panels */}
            <Panel title="Three to Thrive" count="0 / 3" open accent={
              <span style={{ marginLeft:6, padding:'1px 6px', background:'#FEF3C7', color:'#92400E', fontSize:10, fontFamily:V1.mono, borderRadius:99 }}>daily</span>
            }>
              <T3TInline />
            </Panel>

            <Panel title="Trends · last 14 days" count="" accent={
              <span style={{ marginLeft:6, padding:'1px 6px', background:V1.accentSoft, color:V1.accent, fontSize:10, fontFamily:V1.mono, borderRadius:99 }}>+18% MoM</span>
            } open>
              <div style={{ padding:'12px 14px', display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:14 }}>
                {[
                  { label:'TEMPORAL', sub:'6.5h · goal 5h', data:TEMPORAL_14, color:'#7c3aed', delta:'+30%' },
                  { label:'DEEP WORK',sub:'5h this week',   data:DEEPWORK_14, color:'#3b82f6', delta:'−10%' },
                  { label:'PIPELINE', sub:'8 touches',      data:PIPELINE_14, color:'#a855f7', delta:'+40%' },
                ].map(s => (
                  <div key={s.label} style={{ display:'flex', flexDirection:'column', gap:6 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline' }}>
                      <span style={{ fontFamily:V1.mono, fontSize:10, letterSpacing:'0.08em', color:V1.fgMuted }}>{s.label}</span>
                      <span style={{ fontFamily:V1.mono, fontSize:11, color: s.delta.startsWith('+') ? V1.ok : V1.bad }}>{s.delta}</span>
                    </div>
                    <Sparkline data={s.data} color={s.color} fill={s.color} height={36} width={260} strokeWidth={1.5} dots />
                    <span style={{ fontSize:11, color:V1.fgDim }}>{s.sub}</span>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel title="Tasks" count="3 open" action={
              <span style={{ fontSize:11, color:V1.fgDim }}>Add ⌘N</span>
            }>
              <div>
                {[
                  ['Investor deck v3', 'today',   true,  'temporal'],
                  ['Northway followup', 'today',  false, 'pipeline'],
                  ['Review monthly P&L', 'tmrw',  false, 'finance'],
                ].map(([t, when, done, kind]) => (
                  <div key={t} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', borderTop:`1px solid ${V1.border}` }}>
                    <span style={{
                      width:14, height:14, borderRadius:3, border:`1.5px solid ${done ? V1.ok : V1.borderStrong}`,
                      background: done ? V1.ok : 'transparent', display:'flex', alignItems:'center', justifyContent:'center',
                    }}>{done && <Icon.check s={9} style={{ color:'#fff' }} />}</span>
                    <span style={{ flex:1, fontSize:12.5, color: done ? V1.fgDim : V1.fg, textDecoration: done ? 'line-through' : 'none' }}>{t}</span>
                    <span style={{ fontSize:10, fontFamily:V1.mono, color:V1.fgMuted }}>{kind.toUpperCase()}</span>
                    <span style={{ fontSize:11, color:V1.fgDim }}>{when}</span>
                  </div>
                ))}
              </div>
            </Panel>
          </div>

          {/* Activity feed */}
          <div style={{ background:V1.surface, border:`1px solid ${V1.border}`, borderRadius:10, display:'flex', flexDirection:'column', overflow:'hidden' }}>
            <div style={{ padding:'12px 14px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <span style={{ fontSize:13, fontWeight:600 }}>Activity</span>
                <span style={{ width:6, height:6, borderRadius:'50%', background:V1.ok, animation:'mc-pulse 2s ease-in-out infinite' }} />
              </div>
              <span style={{ fontSize:11, color:V1.fgDim }}>live</span>
            </div>
            <div style={{ flex:1, overflow:'auto' }}>
              {activity.map((a, i) => <ActivityRow key={a.id || i} a={a} />)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function V1Desktop() { return <MissionProvider><V1DesktopInner /></MissionProvider>; }

/* ────────────────────────────────────────────────────────────────────────
   V1 MOBILE — compressed, horizontal-scroll metric snapshot, big tap targets.
   ──────────────────────────────────────────────────────────────────────── */

function V1MobileInner() {
  const { metrics, activity, log } = useMission();

  const heroMetrics = ['cash','netWorth','temporal','pipeline','moneyMoved'];

  return (
    <div className="ab" style={{
      width:'100%', height:'100%', background:V1.bg, color:V1.fg, fontFamily:V1.font, fontSize:14,
      display:'flex', flexDirection:'column',
    }}>
      {/* Status bar */}
      <div style={{ height:38, padding:'10px 18px 0', display:'flex', justifyContent:'space-between', fontFamily:V1.mono, fontSize:13, color:V1.ink }}>
        <span style={{ fontWeight:600 }}>9:12</span>
        <span>● ● ● ●</span>
      </div>

      {/* Header */}
      <div style={{ padding:'8px 18px 14px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <OrbitStar size={20} color={V1.accent} />
          <h1 style={{ margin:0, fontSize:22, fontWeight:600, letterSpacing:'-0.02em' }}>Mission Control</h1>
        </div>
        <div style={{ fontSize:12, color:V1.fgDim, marginTop:2, fontFamily:V1.mono }}>WED · 2026-05-27</div>
      </div>

      {/* Big primary card: TODAY focus */}
      <div style={{ padding:'0 18px 12px' }}>
        <div style={{ background:V1.ink, color:'#fff', borderRadius:14, padding:'16px 18px' }}>
          <div style={{ fontFamily:V1.mono, fontSize:10, letterSpacing:'0.1em', color:'rgba(255,255,255,0.55)' }}>TEMPORAL · TODAY</div>
          <div style={{ display:'flex', alignItems:'baseline', justifyContent:'space-between', marginTop:6 }}>
            <span style={{ fontSize:44, fontWeight:600, letterSpacing:'-0.03em' }}>{fmt(metrics.temporal.today, 'hours')}</span>
            <span style={{ fontFamily:V1.mono, fontSize:11, color:'rgba(255,255,255,0.7)' }}>{fmt(metrics.temporal.week,'hours')} / {fmt(metrics.temporal.goal,'hours')} wk</span>
          </div>
          <div style={{ marginTop:10, height:5, background:'rgba(255,255,255,0.15)', borderRadius:3, overflow:'hidden' }}>
            <div style={{ width: `${clamp(metrics.temporal.week / metrics.temporal.goal, 0, 1) * 100}%`, height:'100%', background:V1.accent }} />
          </div>
          <div style={{ display:'flex', gap:6, marginTop:14 }}>
            {[['+0.5h',0.5],['+1h',1],['+2h',2]].map(([l,a]) => (
              <button key={l} onClick={() => log('temporal', a, l)} style={{
                flex:1, padding:'10px 0', background:'rgba(255,255,255,0.12)', color:'#fff',
                border:'1px solid rgba(255,255,255,0.18)', borderRadius:8, font:'inherit', fontSize:13, fontWeight:500, cursor:'pointer',
              }}>{l}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Horizontal-scroll metric snapshot */}
      <div style={{ padding:'0 0 12px' }}>
        <div style={{
          display:'flex', gap:8, padding:'0 18px', overflowX:'auto',
          scrollbarWidth:'none', msOverflowStyle:'none',
        }}>
          {heroMetrics.filter(id => id !== 'temporal').map(id => {
            const m = metrics[id];
            return (
              <div key={id} style={{ minWidth:130, background:V1.surface, border:`1px solid ${V1.border}`, borderRadius:10, padding:'10px 12px' }}>
                <div style={{ fontFamily:V1.mono, fontSize:9, letterSpacing:'0.08em', color:V1.fgMuted }}>{m.label.toUpperCase()}</div>
                <div style={{ fontSize:18, fontWeight:600, letterSpacing:'-0.02em', marginTop:4 }}>{fmt(m.today, m.fmt)}</div>
                <div style={{ fontSize:10, color:V1.fgDim, marginTop:2, fontFamily:V1.mono }}>{m.note || ''}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Quick actions */}
      <div style={{ padding:'0 18px 12px' }}>
        <div style={{ fontFamily:V1.mono, fontSize:10, letterSpacing:'0.08em', color:V1.fgMuted, marginBottom:6 }}>QUICK LOG</div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:6 }}>
          {[
            ['+ Moved',     'moneyMoved', 250,  V1.accentSoft, V1.accent],
            ['+ Generated', 'moneyMoved', 500,  V1.accentSoft, V1.accent],
            ['+ Call',      'pipeline',   0.5,  V1.accentSoft, V1.accent],
            ['+ Demo',      'pipeline',   1,    V1.accentSoft, V1.accent],
            ['+ Deep 0.5h', 'deepWork',   0.5,  V1.accentSoft, V1.accent],
            ['+ Train',     'trained',    1,    V1.accentSoft, V1.accent],
          ].map(([l, m, a, bg, fg]) => (
            <button key={l} onClick={() => log(m, a, l.trim())} style={{
              padding:'12px 0', background:bg, color:fg, border:'none', borderRadius:10,
              font:'inherit', fontSize:12, fontWeight:500, cursor:'pointer',
            }}>{l}</button>
          ))}
        </div>
      </div>

      {/* Activity feed (tiny) */}
      <div style={{ flex:1, padding:'0 18px 80px', overflow:'auto' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
          <span style={{ fontFamily:V1.mono, fontSize:10, letterSpacing:'0.08em', color:V1.fgMuted }}>RECENT</span>
          <span style={{ fontSize:11, color:V1.fgDim }}>Reflect ↑</span>
        </div>
        <div style={{ background:V1.surface, border:`1px solid ${V1.border}`, borderRadius:10, overflow:'hidden' }}>
          {activity.slice(0, 5).map((a, i) => <ActivityRow key={a.id || i} a={a} />)}
        </div>
      </div>

      {/* Bottom nav */}
      <div style={{
        position:'absolute', bottom:0, left:0, right:0, padding:'10px 18px 20px',
        background:'rgba(250,250,249,0.92)', backdropFilter:'blur(12px)',
        borderTop:`1px solid ${V1.border}`, display:'flex', justifyContent:'space-around',
      }}>
        {[['Overview', true],['Insights', false],['Reflect', false],['Tasks', false]].map(([l,active]) => (
          <button key={l} style={{
            background:'transparent', border:'none', font:'inherit', fontSize:11, fontWeight:500,
            color: active ? V1.accent : V1.fgDim, display:'flex', flexDirection:'column', alignItems:'center', gap:3,
          }}>
            <span style={{ width:24, height:24, borderRadius:6, background: active ? V1.accentSoft : 'transparent', display:'flex', alignItems:'center', justifyContent:'center' }}>
              {l === 'Overview' && <Icon.dot s={8} style={{ color: active ? V1.accent : V1.fgMuted }} />}
              {l === 'Insights' && <Icon.bolt s={14} />}
              {l === 'Reflect'  && <Icon.brain s={14} />}
              {l === 'Tasks'    && <Icon.check s={14} />}
            </span>
            {l}
          </button>
        ))}
      </div>
    </div>
  );
}

function V1Mobile() { return <MissionProvider><V1MobileInner /></MissionProvider>; }

/* ────────────────────────────────────────────────────────────────────────
   V1 DRAWER — reflection drawer, right-side slideout (shown as standalone)
   ──────────────────────────────────────────────────────────────────────── */

function V1DrawerInner() {
  const { answers, setAnswer } = useMission();
  const answered = T3T_PROMPTS.filter(p => (answers[p.id] || '').trim()).length;
  return (
    <div className="ab" style={{
      width:'100%', height:'100%', background:V1.surface, color:V1.fg,
      fontFamily:V1.font, fontSize:13, display:'flex', flexDirection:'column',
      borderLeft:`1px solid ${V1.border}`, boxShadow:'-12px 0 32px rgba(14,14,16,0.06)',
    }}>
      {/* Header */}
      <div style={{ padding:'16px 20px', borderBottom:`1px solid ${V1.border}`, display:'flex', alignItems:'center', gap:12 }}>
        <div style={{ width:34, height:34, borderRadius:8, background:'#FEF3C7', display:'flex', alignItems:'center', justifyContent:'center' }}>
          <Icon.flame s={18} style={{ color:'#92400E' }} />
        </div>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:15, fontWeight:600 }}>Reflection</div>
          <div style={{ fontSize:11.5, color:V1.fgDim, fontFamily:V1.mono }}>WED · 2026-05-27 · {answered}/3 answered</div>
        </div>
        <button style={{
          width:28, height:28, borderRadius:6, background:V1.bg, border:`1px solid ${V1.border}`,
          color:V1.fgDim, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer',
        }}><Icon.close s={14} /></button>
      </div>

      {/* Progress strip */}
      <div style={{ padding:'14px 20px 0' }}>
        <div style={{ display:'flex', gap:6 }}>
          {[0,1,2].map(i => (
            <div key={i} style={{
              flex:1, height:4, borderRadius:2,
              background: i < answered ? V1.ok : 'rgba(14,14,16,0.06)',
            }} />
          ))}
        </div>
      </div>

      {/* Prompts */}
      <div style={{ flex:1, overflow:'auto', padding:'14px 20px 20px', display:'flex', flexDirection:'column', gap:18 }}>
        {T3T_PROMPTS.map((p, i) => {
          const v = answers[p.id] || '';
          const done = !!v.trim();
          return (
            <div key={p.id}>
              <div style={{ display:'flex', gap:10, alignItems:'flex-start', marginBottom:8 }}>
                <span style={{
                  width:22, height:22, borderRadius:'50%',
                  background: done ? V1.ok : V1.accentSoft,
                  color: done ? '#fff' : V1.accent,
                  fontSize:11, fontFamily:V1.mono, fontWeight:600,
                  display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
                }}>{done ? <Icon.check s={11} /> : i + 1}</span>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13.5, fontWeight:500, lineHeight:1.4 }}>{p.q}</div>
                  {p.tag && (
                    <span style={{ display:'inline-block', marginTop:4, padding:'1px 6px', fontSize:10, fontFamily:V1.mono, color:'#7c3aed', background:'#F3E8FF', borderRadius:99 }}>{p.tag}</span>
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
                  fontFamily:V1.font, border:`1px solid ${V1.border}`, borderRadius:8,
                  background:V1.bg, color:V1.fg, outline:'none',
                }}
                onFocus={(e) => e.target.style.borderColor = V1.accent}
                onBlur={(e) => e.target.style.borderColor = V1.border}
              />
              {v && (
                <div style={{ marginTop:4, fontSize:10, fontFamily:V1.mono, color:V1.ok }}>
                  <Icon.check s={9} /> autosaved · {v.length} chars
                </div>
              )}
            </div>
          );
        })}

        {/* Yesterday */}
        <div style={{ marginTop:8, padding:'12px 14px', background:V1.bg, border:`1px solid ${V1.border}`, borderRadius:10 }}>
          <div style={{ fontFamily:V1.mono, fontSize:10, letterSpacing:'0.08em', color:V1.fgMuted, marginBottom:6 }}>YESTERDAY</div>
          <div style={{ fontSize:12, color:V1.fgDim, lineHeight:1.5, fontStyle:'italic' }}>
            "Push through the investor doc resistance. Stop polishing what doesn't ship." · 3/3
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ padding:'12px 20px', borderTop:`1px solid ${V1.border}`, display:'flex', gap:8, alignItems:'center' }}>
        <span style={{ fontSize:11, color:V1.fgDim, fontFamily:V1.mono }}>⌘↩ to save & close</span>
        <button style={{
          marginLeft:'auto', padding:'8px 14px', background:V1.ink, color:'#fff', border:'none',
          borderRadius:8, font:'inherit', fontSize:12.5, fontWeight:500, cursor:'pointer',
        }}>Save & close</button>
      </div>
    </div>
  );
}

function V1Drawer() { return <MissionProvider><V1DrawerInner /></MissionProvider>; }

Object.assign(window, { V1Desktop, V1Mobile, V1Drawer });
