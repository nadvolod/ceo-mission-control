// v2-bold.jsx — Trading terminal. Dense, mono, operator-grade.
// Bloomberg/quant-desk vibe. Number-first. Green up, red down.

const { useState, useEffect, useRef } = React;

const V2 = {
  font: "'Geist Mono','JetBrains Mono',ui-monospace,monospace",
  sans: "'Geist','Inter',system-ui,sans-serif",
  bg: '#08090C',
  surface: '#0E1014',
  surfaceHi: '#13161D',
  grid: 'rgba(255,255,255,0.04)',
  ink: '#F2F4F7',
  fg: '#D7DCE6',
  fgDim: '#7A8290',
  fgMuted: '#454B57',
  border: 'rgba(255,255,255,0.06)',
  borderStrong: 'rgba(255,255,255,0.14)',
  amber: '#F5A524',
  green: '#1EE07A',
  greenDim: '#0F5733',
  red: '#FF5560',
  redDim: '#6B1A21',
  cyan: '#37D5F2',
  violet: '#8B7CFF',
  magenta: '#FF6BFF',
};

/* ────────────────────────────────────────────────────────────────────────
   Helpers
   ──────────────────────────────────────────────────────────────────────── */

function MonoLabel({ children, color = V2.fgDim, dot, style }) {
  return (
    <div style={{ fontFamily:V2.font, fontSize:10, letterSpacing:'0.12em', textTransform:'uppercase', color, display:'flex', alignItems:'center', gap:6, ...style }}>
      {dot && <span style={{ width:6, height:6, background:dot, display:'inline-block' }} />}
      {children}
    </div>
  );
}

function Cell({ children, span = 1, style }) {
  return (
    <div style={{
      gridColumn: `span ${span}`,
      background:V2.surface, border:`1px solid ${V2.border}`,
      padding:'10px 12px', display:'flex', flexDirection:'column', gap:6,
      position:'relative', ...style,
    }}>{children}</div>
  );
}

/* ────────────────────────────────────────────────────────────────────────
   QUOTE CELL — the main metric primitive.
   ──────────────────────────────────────────────────────────────────────── */

function QuoteCell({ metricId, presets, big = false }) {
  const { metrics, log } = useMission();
  const m = metrics[metricId];
  if (!m) return null;
  const isMoney = m.fmt === 'money';
  const dir = m.delta != null ? (m.delta >= 0 ? 'up' : 'down') : null;
  const color = dir === 'up' ? V2.green : dir === 'down' ? V2.red : V2.ink;

  return (
    <Cell>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline' }}>
        <MonoLabel color={V2.fgDim}>{m.label}</MonoLabel>
        <MonoLabel color={V2.fgMuted} style={{ fontSize:9 }}>{m.unit || ''}</MonoLabel>
      </div>

      <div style={{ display:'flex', alignItems:'baseline', gap:8 }}>
        <span style={{
          fontFamily:V2.font, fontWeight:500, fontSize: big ? 30 : 22,
          color: V2.ink, letterSpacing:'-0.01em',
        }}>{fmt(m.today, m.fmt)}</span>
        {m.week != null && (
          <span style={{ fontFamily:V2.font, fontSize:11, color:V2.fgDim }}>
            wk {fmt(m.week, m.fmt)}{m.goal ? ` / ${fmt(m.goal, m.fmt)}` : ''}
          </span>
        )}
      </div>

      {/* trend row */}
      <div style={{ display:'flex', alignItems:'center', gap:8, height:22 }}>
        {m.spark && (
          <Sparkline data={m.spark} color={color === V2.ink ? V2.cyan : color} height={20} width={140} strokeWidth={1.25} />
        )}
        {m.delta != null && (
          <span style={{ fontFamily:V2.font, fontSize:11, color }}>
            {dir === 'up' ? '▲' : '▼'} {fmt(Math.abs(m.delta), 'pct')}
          </span>
        )}
        {!m.spark && m.note && (
          <MonoLabel color={V2.fgMuted}>{m.note}</MonoLabel>
        )}
      </div>

      {/* quick log row */}
      {presets && presets.length > 0 && (
        <div style={{ display:'flex', gap:0, marginTop:2, borderTop:`1px solid ${V2.border}`, paddingTop:8 }}>
          {presets.map(([lbl, amt]) => (
            <button key={lbl} onClick={() => log(metricId, amt, lbl.trim())} style={{
              flex:1, padding:'5px 6px', fontFamily:V2.font, fontSize:10, letterSpacing:'0.04em',
              background:'transparent', color: V2.fg, border:`1px solid ${V2.border}`,
              cursor:'pointer', marginRight: -1, textTransform:'uppercase',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = V2.surfaceHi; e.currentTarget.style.color = V2.green; e.currentTarget.style.borderColor = V2.green; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = V2.fg; e.currentTarget.style.borderColor = V2.border; }}
            >{lbl}</button>
          ))}
        </div>
      )}
    </Cell>
  );
}

/* ────────────────────────────────────────────────────────────────────────
   TICKER TAPE — scrolling top bar with current values + deltas.
   ──────────────────────────────────────────────────────────────────────── */

function TickerTape() {
  const { metrics } = useMission();
  const items = [
    { sym:'CASH',     v:fmt(metrics.cash.today,'money'),       d:'+228.0%', dir:'up' },
    { sym:'NW',       v:fmt(metrics.netWorth.today,'money'),   d:'+2.6%',   dir:'up' },
    { sym:'DEBT',     v:fmt(metrics.debt.today,'money'),       d:'−1.2%',   dir:'down' },
    { sym:'TEMPORAL', v:fmt(metrics.temporal.today,'hours'),   d:'wk 6.5h', dir:'flat' },
    { sym:'PIPELINE', v:fmt(metrics.pipeline.today,'hours'),   d:'+40%',    dir:'up' },
    { sym:'DEEP',     v:fmt(metrics.deepWork.today,'hours'),   d:'−10%',    dir:'down' },
    { sym:'MOVED',    v:fmt(metrics.moneyMoved.today,'money'), d:'—',       dir:'flat' },
    { sym:'FOCUS',    v:fmt(metrics.focus.today,'hours'),      d:'0/15h',   dir:'flat' },
  ];
  return (
    <div style={{ overflow:'hidden', borderTop:`1px solid ${V2.border}`, borderBottom:`1px solid ${V2.border}`, background:V2.bg, height:30, display:'flex', alignItems:'center' }}>
      <div style={{ flexShrink:0, padding:'0 12px', borderRight:`1px solid ${V2.border}`, height:'100%', display:'flex', alignItems:'center', gap:6, background:'#000' }}>
        <span style={{ width:6, height:6, background:V2.red, animation:'mc-blink 1.4s ease-in-out infinite' }} />
        <span style={{ fontFamily:V2.font, fontSize:10, color:V2.red, letterSpacing:'0.12em' }}>LIVE</span>
      </div>
      <div style={{ flex:1, overflow:'hidden', whiteSpace:'nowrap', position:'relative' }}>
        <div style={{
          display:'inline-flex', gap:24, paddingLeft:16,
          animation:'tape-scroll 36s linear infinite',
        }}>
          {[...items, ...items, ...items].map((it, i) => (
            <span key={i} style={{ display:'inline-flex', alignItems:'baseline', gap:6, fontFamily:V2.font, fontSize:11 }}>
              <span style={{ color:V2.fgDim, letterSpacing:'0.12em' }}>{it.sym}</span>
              <span style={{ color:V2.ink }}>{it.v}</span>
              <span style={{ color: it.dir === 'up' ? V2.green : it.dir === 'down' ? V2.red : V2.fgDim }}>
                {it.dir === 'up' ? '▲' : it.dir === 'down' ? '▼' : '·'} {it.d}
              </span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// Inject keyframe for tape
if (typeof document !== 'undefined' && !document.getElementById('v2-keyframes')) {
  const s = document.createElement('style');
  s.id = 'v2-keyframes';
  s.textContent = `@keyframes tape-scroll { from { transform: translateX(0); } to { transform: translateX(-50%); } }`;
  document.head.appendChild(s);
}

/* ────────────────────────────────────────────────────────────────────────
   V2 DESKTOP
   ──────────────────────────────────────────────────────────────────────── */

function V2DesktopInner() {
  const { metrics, activity, log, answers, setAnswer } = useMission();
  const [cmdInput, setCmdInput] = useState('');
  const inputRef = useRef(null);

  // Command palette parser: "+0.5h temporal" / "+gen 2000" / "+call"
  const exec = () => {
    const v = cmdInput.trim().toLowerCase();
    if (!v) return;
    // simple parses
    if (v.match(/^\+?(\d*\.?\d+)h?\s*temp/))     log('temporal', parseFloat(RegExp.$1) || 1, `+${RegExp.$1}h`);
    else if (v.match(/^\+?(\d*\.?\d+)h?\s*deep/)) log('deepWork', parseFloat(RegExp.$1) || 1, `+${RegExp.$1}h`);
    else if (v.match(/^\+?(\d*\.?\d+)h?\s*pipe/)) log('pipeline', parseFloat(RegExp.$1) || 0.5, '+ pipe');
    else if (v.match(/gen|generated/))            log('moneyMoved', 1000, '+ Generated');
    else if (v.match(/cut/))                      log('moneyMoved', 250, '+ Cut');
    else if (v.match(/moved/))                    log('moneyMoved', 500, '+ Moved');
    else                                          log('temporal', 0.5, '+0.5h');
    setCmdInput('');
  };

  return (
    <div className="ab" style={{
      width:'100%', height:'100%', background:V2.bg, color:V2.fg,
      fontFamily:V2.sans, fontSize:12, display:'flex', flexDirection:'column',
    }}>
      {/* Top chrome */}
      <header style={{ height:36, background:'#000', borderBottom:`1px solid ${V2.border}`, display:'flex', alignItems:'center', padding:'0 12px', gap:14 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <OrbitStar size={16} color={V2.amber} />
          <span style={{ fontFamily:V2.font, fontSize:11, color:V2.ink, letterSpacing:'0.16em', fontWeight:500 }}>MISSION//CONTROL</span>
          <span style={{ fontFamily:V2.font, fontSize:10, color:V2.fgMuted, letterSpacing:'0.12em' }}>v1.04 · OPERATOR</span>
        </div>
        <div style={{ flex:1 }} />
        <div style={{ fontFamily:V2.font, fontSize:10, color:V2.fgDim, letterSpacing:'0.12em' }}>WED 2026-05-27 · 09:12:08 PST</div>
        <div style={{ width:1, height:14, background:V2.border }} />
        <div style={{ display:'flex', gap:6 }}>
          {['F1·OVR','F2·INS','F3·REV','F4·TASKS'].map((k, i) => (
            <span key={k} style={{
              fontFamily:V2.font, fontSize:10, color: i === 0 ? V2.amber : V2.fgDim,
              padding:'2px 6px', background: i === 0 ? 'rgba(245,165,36,0.08)' : 'transparent', border:`1px solid ${i === 0 ? V2.amber : V2.border}`,
              letterSpacing:'0.08em',
            }}>{k}</span>
          ))}
        </div>
      </header>

      {/* Ticker tape */}
      <TickerTape />

      {/* Body grid */}
      <div style={{ flex:1, display:'grid', gridTemplateColumns:'200px 1fr 280px', minHeight:0 }}>
        {/* LEFT RAIL */}
        <aside style={{ borderRight:`1px solid ${V2.border}`, padding:'12px', display:'flex', flexDirection:'column', gap:12, overflow:'auto' }}>
          <div>
            <MonoLabel color={V2.fgDim} style={{ marginBottom:8 }}>OPERATOR</MonoLabel>
            <div style={{ fontSize:13, fontWeight:500, color:V2.ink, fontFamily:V2.font, letterSpacing:'-0.01em' }}>NIKOLAY.M</div>
            <div style={{ fontFamily:V2.font, fontSize:10, color:V2.fgDim, marginTop:2 }}>SESS · 09:12 → 10:30</div>
          </div>

          <div>
            <MonoLabel color={V2.fgDim} style={{ marginBottom:8 }}>SIGNALS</MonoLabel>
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              {[
                { lbl:'Temporal·6d',    val:'STREAK',  color:V2.green },
                { lbl:'Cash·MoM',        val:'+228%',   color:V2.green },
                { lbl:'Deep·pace',       val:'-18%',    color:V2.red },
                { lbl:'Pipeline·empty',  val:'WARN',    color:V2.amber },
                { lbl:'Train·0/4',       val:'BEHIND',  color:V2.red },
              ].map(s => (
                <div key={s.lbl} style={{ display:'flex', justifyContent:'space-between', fontFamily:V2.font, fontSize:11 }}>
                  <span style={{ color:V2.fgDim }}>{s.lbl}</span>
                  <span style={{ color:s.color, fontWeight:500 }}>{s.val}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <MonoLabel color={V2.fgDim} style={{ marginBottom:8 }}>SHORTCUTS</MonoLabel>
            <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
              {[
                ['+0.5h temp', 'log temporal'],
                ['+gen 1k',    'generated'],
                ['+call',      'pipeline'],
                ['/reflect',   'open T3T'],
                ['/trends',    'insights'],
              ].map(([k,v]) => (
                <div key={k} style={{ display:'flex', justifyContent:'space-between', fontFamily:V2.font, fontSize:10 }}>
                  <span style={{ color:V2.amber }}>{k}</span>
                  <span style={{ color:V2.fgMuted }}>{v}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ marginTop:'auto', fontFamily:V2.font, fontSize:10, color:V2.fgMuted, lineHeight:1.5 }}>
            <div>UPLINK · OK</div>
            <div>MONARCH · 4m</div>
            <div>GARMIN · 22m</div>
            <div>OPENCLAW · LIVE</div>
          </div>
        </aside>

        {/* MAIN — metric quote board */}
        <main style={{ padding:'12px', overflow:'auto', display:'flex', flexDirection:'column', gap:12 }}>
          {/* Hero row */}
          <div style={{ display:'grid', gridTemplateColumns:'2fr 1.2fr 1.2fr', gap:1, background:V2.border }}>
            <Cell style={{ padding:'14px 16px' }}>
              <MonoLabel color={V2.fgDim} dot={V2.amber}>FIELD · TODAY</MonoLabel>
              <div style={{ display:'flex', alignItems:'baseline', gap:14, marginTop:2 }}>
                <span style={{ fontFamily:V2.font, fontSize:48, fontWeight:400, color:V2.ink, letterSpacing:'-0.02em' }}>{fmt(metrics.cash.today,'money')}</span>
                <span style={{ fontFamily:V2.font, fontSize:18, color:V2.green }}>▲ 228.0%</span>
                <span style={{ fontFamily:V2.font, fontSize:12, color:V2.fgDim }}>+$2.4K vs LM</span>
              </div>
              <div style={{ display:'flex', gap:24, marginTop:8 }}>
                <div>
                  <MonoLabel color={V2.fgMuted}>NET WORTH</MonoLabel>
                  <div style={{ fontFamily:V2.font, fontSize:15, color:V2.ink }}>{fmt(metrics.netWorth.today,'money')}</div>
                </div>
                <div>
                  <MonoLabel color={V2.fgMuted}>DEBT</MonoLabel>
                  <div style={{ fontFamily:V2.font, fontSize:15, color:V2.red }}>{fmt(metrics.debt.today,'money')}</div>
                </div>
                <div>
                  <MonoLabel color={V2.fgMuted}>RUNWAY</MonoLabel>
                  <div style={{ fontFamily:V2.font, fontSize:15, color:V2.ink }}>∞</div>
                </div>
                <div style={{ flex:1 }} />
                <div style={{ minWidth:200 }}>
                  <Sparkline data={CASH_30} color={V2.green} fill={V2.green} height={40} width={200} strokeWidth={1.5} dots />
                </div>
              </div>
            </Cell>

            <QuoteCell metricId="temporal" big presets={[['+0.5H', 0.5],['+1H', 1],['+2H', 2]]} />
            <QuoteCell metricId="pipeline" big presets={[['+CALL', 0.5],['+DEMO', 1],['+FU', 0.5]]} />
          </div>

          {/* Second metric row */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:1, background:V2.border }}>
            <QuoteCell metricId="deepWork" presets={[['+0.5H', 0.5],['+1H', 1]]} />
            <QuoteCell metricId="moneyMoved" presets={[['+MOVED', 500],['+GEN', 1000],['+CUT', 250]]} />
            <QuoteCell metricId="focus" presets={[['+0.5H', 0.5],['+1H', 1]]} />
            <QuoteCell metricId="trained" presets={[['+SESSION', 1]]} />
          </div>

          {/* Charts row */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:1, background:V2.border, flex:1, minHeight:240 }}>
            <Cell>
              <div style={{ display:'flex', justifyContent:'space-between' }}>
                <MonoLabel color={V2.fgDim} dot={V2.cyan}>TEMPORAL · 14D</MonoLabel>
                <MonoLabel color={V2.green}>+30% vs prev</MonoLabel>
              </div>
              <div style={{ flex:1, display:'flex', alignItems:'flex-end', gap:4, padding:'12px 0', position:'relative' }}>
                {TEMPORAL_14.map((v, i) => {
                  const max = Math.max(...TEMPORAL_14, 5);
                  const h = (v / max) * 100;
                  const isToday = i === TEMPORAL_14.length - 1;
                  return (
                    <div key={i} style={{ flex:1, height:'100%', display:'flex', alignItems:'flex-end', position:'relative' }}>
                      <div style={{
                        width:'100%', height:`${h}%`, background: v === 0 ? V2.surfaceHi : (isToday ? V2.amber : V2.green),
                        borderTop: isToday ? `1px solid ${V2.amber}` : 'none',
                        position:'relative',
                      }}>
                        {v > 0 && <span style={{ position:'absolute', top:-14, left:'50%', transform:'translateX(-50%)', fontFamily:V2.font, fontSize:9, color:V2.fgDim }}>{v}h</span>}
                      </div>
                    </div>
                  );
                })}
                {/* goal line */}
                <div style={{ position:'absolute', left:0, right:0, bottom: `${(5 / Math.max(...TEMPORAL_14, 5)) * 100 - 12}%`, height:0, borderTop:`1px dashed ${V2.amber}` }}>
                  <span style={{ position:'absolute', right:0, top:-12, fontFamily:V2.font, fontSize:9, color:V2.amber, letterSpacing:'0.08em' }}>GOAL · 5H</span>
                </div>
              </div>
              <div style={{ display:'flex', justifyContent:'space-between', fontFamily:V2.font, fontSize:9, color:V2.fgMuted }}>
                <span>−13d</span><span>−7d</span><span>TODAY</span>
              </div>
            </Cell>

            <Cell>
              <div style={{ display:'flex', justifyContent:'space-between' }}>
                <MonoLabel color={V2.fgDim} dot={V2.violet}>NET WORTH · 30D</MonoLabel>
                <MonoLabel color={V2.green}>+5.4% +$50K</MonoLabel>
              </div>
              <div style={{ flex:1, display:'flex', alignItems:'stretch', padding:'8px 0' }}>
                <Sparkline data={NETWORTH_30} color={V2.violet} fill={V2.violet} height={140} width={540} strokeWidth={1.5} dots />
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, fontFamily:V2.font, fontSize:11, color:V2.fgDim }}>
                <div><span style={{ color:V2.fgMuted, letterSpacing:'0.08em' }}>OPEN</span><div style={{ color:V2.ink }}>$932K</div></div>
                <div><span style={{ color:V2.fgMuted, letterSpacing:'0.08em' }}>HIGH</span><div style={{ color:V2.green }}>$982K</div></div>
                <div><span style={{ color:V2.fgMuted, letterSpacing:'0.08em' }}>LOW</span><div style={{ color:V2.red }}>$932K</div></div>
                <div><span style={{ color:V2.fgMuted, letterSpacing:'0.08em' }}>CLOSE</span><div style={{ color:V2.ink }}>$982K</div></div>
              </div>
            </Cell>
          </div>

          {/* Command bar */}
          <div style={{ display:'flex', alignItems:'center', gap:8, background:V2.surface, border:`1px solid ${V2.borderStrong}`, padding:'8px 12px' }}>
            <span style={{ fontFamily:V2.font, fontSize:11, color:V2.green, letterSpacing:'0.08em' }}>{'>'} CMD</span>
            <input
              ref={inputRef}
              value={cmdInput}
              onChange={(e) => setCmdInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') exec(); }}
              placeholder="+1h temporal · +gen 2000 · +call · /reflect · /trends"
              style={{
                flex:1, background:'transparent', border:'none', outline:'none',
                fontFamily:V2.font, fontSize:12, color:V2.ink, letterSpacing:'0.01em',
              }}
            />
            <span style={{ fontFamily:V2.font, fontSize:10, color:V2.fgMuted }}>↩ EXEC · ESC CANCEL</span>
          </div>
        </main>

        {/* RIGHT RAIL — activity tape */}
        <aside style={{ borderLeft:`1px solid ${V2.border}`, display:'flex', flexDirection:'column', overflow:'hidden' }}>
          <div style={{ padding:'10px 12px', borderBottom:`1px solid ${V2.border}`, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <MonoLabel color={V2.fgDim} dot={V2.green}>TAPE · LIVE</MonoLabel>
            <span style={{ fontFamily:V2.font, fontSize:10, color:V2.fgMuted }}>{activity.length}/40</span>
          </div>
          <div style={{ flex:1, overflow:'auto', fontFamily:V2.font, fontSize:11, padding:'4px 0' }}>
            {activity.map((a, i) => (
              <div key={a.id || i} style={{
                padding:'6px 12px', display:'grid', gridTemplateColumns:'42px 1fr',
                gap:8, borderBottom:`1px solid ${V2.border}`,
                background: a._flash ? 'rgba(30,224,122,0.08)' : 'transparent',
                transition:'background 1s',
              }}>
                <span style={{ color:V2.fgMuted }}>{a.t}</span>
                <div style={{ minWidth:0 }}>
                  <div style={{ display:'flex', gap:6 }}>
                    <span style={{ color: a.delta?.startsWith('+') ? V2.green : V2.fg }}>{a.delta}</span>
                    <span style={{ color:V2.ink, fontWeight:500 }}>{a.label}</span>
                  </div>
                  <div style={{ color:V2.fgDim, fontSize:10, marginTop:1 }}>{a.meta}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Reflection prompts (compressed) */}
          <div style={{ borderTop:`1px solid ${V2.borderStrong}`, background:V2.surface }}>
            <div style={{ padding:'10px 12px', display:'flex', justifyContent:'space-between' }}>
              <MonoLabel color={V2.fgDim} dot={V2.magenta}>T3T · 0/3</MonoLabel>
              <span style={{ fontFamily:V2.font, fontSize:10, color:V2.amber }}>/reflect</span>
            </div>
            <div style={{ padding:'0 12px 12px', display:'flex', flexDirection:'column', gap:6 }}>
              {T3T_PROMPTS.map((p, i) => (
                <div key={p.id} style={{
                  display:'flex', gap:8, padding:'6px 8px', background:V2.bg, border:`1px solid ${V2.border}`,
                  cursor:'pointer',
                }}>
                  <span style={{ fontFamily:V2.font, fontSize:10, color:V2.amber }}>0{i+1}</span>
                  <span style={{ fontFamily:V2.font, fontSize:10.5, color:V2.fgDim, lineHeight:1.4, flex:1 }}>{p.q}</span>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function V2Desktop() { return <MissionProvider><V2DesktopInner /></MissionProvider>; }

/* ────────────────────────────────────────────────────────────────────────
   V2 MOBILE
   ──────────────────────────────────────────────────────────────────────── */

function V2MobileInner() {
  const { metrics, activity, log } = useMission();

  return (
    <div className="ab" style={{
      width:'100%', height:'100%', background:V2.bg, color:V2.fg, fontFamily:V2.font, fontSize:12,
      display:'flex', flexDirection:'column',
    }}>
      {/* Status bar */}
      <div style={{ height:38, padding:'10px 18px 0', display:'flex', justifyContent:'space-between', fontFamily:V2.font, fontSize:13, color:V2.ink }}>
        <span style={{ fontWeight:500 }}>9:12</span>
        <span>5G ▮▮▮</span>
      </div>

      {/* Header */}
      <div style={{ padding:'8px 16px 12px', borderBottom:`1px solid ${V2.border}`, display:'flex', alignItems:'center', gap:8 }}>
        <OrbitStar size={18} color={V2.amber} />
        <div>
          <div style={{ fontFamily:V2.font, fontSize:11, color:V2.ink, letterSpacing:'0.14em', fontWeight:500 }}>MISSION//CONTROL</div>
          <div style={{ fontFamily:V2.font, fontSize:9, color:V2.fgDim, letterSpacing:'0.12em', marginTop:2 }}>WED 2026-05-27 · 09:12</div>
        </div>
        <div style={{ marginLeft:'auto', width:8, height:8, background:V2.green, animation:'mc-blink 1.6s ease-in-out infinite' }} />
      </div>

      {/* Hero — Cash field */}
      <div style={{ padding:'14px 16px', borderBottom:`1px solid ${V2.border}` }}>
        <MonoLabel color={V2.fgDim} dot={V2.amber}>FIELD · TODAY</MonoLabel>
        <div style={{ display:'flex', alignItems:'baseline', gap:10, marginTop:6 }}>
          <span style={{ fontFamily:V2.font, fontSize:38, fontWeight:400, color:V2.ink, letterSpacing:'-0.02em' }}>{fmt(metrics.cash.today,'money')}</span>
          <span style={{ fontFamily:V2.font, fontSize:14, color:V2.green }}>▲228%</span>
        </div>
        <div style={{ display:'flex', gap:14, marginTop:6, fontFamily:V2.font, fontSize:11, color:V2.fgDim }}>
          <span>NW <span style={{ color:V2.ink }}>$982K</span></span>
          <span>DEBT <span style={{ color:V2.red }}>$27.9K</span></span>
          <span>RUN <span style={{ color:V2.ink }}>∞</span></span>
        </div>
        <div style={{ marginTop:8 }}>
          <Sparkline data={CASH_30} color={V2.green} fill={V2.green} height={26} width={330} strokeWidth={1.5} />
        </div>
      </div>

      {/* Quote rows */}
      <div style={{ flex:1, overflow:'auto' }}>
        {[
          { id:'temporal', presets:[['+0.5H',0.5],['+1H',1],['+2H',2]] },
          { id:'pipeline', presets:[['+CALL',0.5],['+DEMO',1],['+FU',0.5]] },
          { id:'deepWork', presets:[['+0.5H',0.5],['+1H',1]] },
          { id:'moneyMoved', presets:[['+MOVED',500],['+GEN',1000],['+CUT',250]] },
          { id:'trained', presets:[['+SESSION',1]] },
        ].map(({ id, presets }) => {
          const m = metrics[id];
          return (
            <div key={id} style={{ borderBottom:`1px solid ${V2.border}`, padding:'12px 16px' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline' }}>
                <MonoLabel color={V2.fgDim}>{m.label}</MonoLabel>
                {m.week != null && <MonoLabel color={V2.fgMuted}>WK {fmt(m.week,m.fmt)}{m.goal ? `/${fmt(m.goal,m.fmt)}` : ''}</MonoLabel>}
              </div>
              <div style={{ display:'flex', alignItems:'baseline', gap:10, marginTop:4 }}>
                <span style={{ fontFamily:V2.font, fontSize:24, color:V2.ink, letterSpacing:'-0.01em' }}>{fmt(m.today, m.fmt)}</span>
                {m.spark && <Sparkline data={m.spark} color={V2.cyan} height={18} width={100} strokeWidth={1.25} />}
              </div>
              <div style={{ display:'flex', gap:0, marginTop:8 }}>
                {presets.map(([l, a]) => (
                  <button key={l} onClick={() => log(id, a, l.trim())} style={{
                    flex:1, padding:'10px 0', fontFamily:V2.font, fontSize:11, letterSpacing:'0.06em',
                    background:'transparent', color:V2.fg, border:`1px solid ${V2.border}`,
                    marginRight: -1, cursor:'pointer',
                  }}>{l}</button>
                ))}
              </div>
            </div>
          );
        })}

        {/* Tape preview */}
        <div style={{ padding:'12px 16px', borderBottom:`1px solid ${V2.border}` }}>
          <MonoLabel color={V2.fgDim} dot={V2.green} style={{ marginBottom:6 }}>TAPE</MonoLabel>
          {activity.slice(0, 3).map((a, i) => (
            <div key={i} style={{ display:'grid', gridTemplateColumns:'42px 1fr', gap:8, fontFamily:V2.font, fontSize:11, padding:'3px 0' }}>
              <span style={{ color:V2.fgMuted }}>{a.t}</span>
              <span style={{ minWidth:0 }}>
                <span style={{ color: a.delta?.startsWith('+') ? V2.green : V2.fg }}>{a.delta} </span>
                <span style={{ color:V2.ink }}>{a.label}</span>
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom cmd */}
      <div style={{ padding:'10px 16px 18px', background:V2.surface, borderTop:`1px solid ${V2.borderStrong}`, display:'flex', alignItems:'center', gap:8 }}>
        <span style={{ fontFamily:V2.font, fontSize:11, color:V2.green }}>{'>'}</span>
        <span style={{ fontFamily:V2.font, fontSize:11, color:V2.fgMuted, flex:1 }}>cmd · +1h temp · /reflect</span>
        <span style={{ fontFamily:V2.font, fontSize:10, color:V2.fgMuted, padding:'2px 5px', border:`1px solid ${V2.border}` }}>F5</span>
      </div>
    </div>
  );
}

function V2Mobile() { return <MissionProvider><V2MobileInner /></MissionProvider>; }

/* ────────────────────────────────────────────────────────────────────────
   V2 DRAWER — terminal-style reflection
   ──────────────────────────────────────────────────────────────────────── */

function V2DrawerInner() {
  const { answers, setAnswer } = useMission();
  const answered = T3T_PROMPTS.filter(p => (answers[p.id] || '').trim()).length;

  return (
    <div className="ab" style={{
      width:'100%', height:'100%', background:V2.bg, color:V2.fg, fontFamily:V2.sans, fontSize:13,
      borderLeft:`1px solid ${V2.borderStrong}`, display:'flex', flexDirection:'column',
    }}>
      {/* Header */}
      <div style={{ padding:'14px 18px', borderBottom:`1px solid ${V2.border}`, display:'flex', alignItems:'center', gap:10 }}>
        <span style={{ width:8, height:8, background:V2.magenta, animation:'mc-blink 1.6s ease-in-out infinite' }} />
        <MonoLabel color={V2.ink} style={{ fontSize:11 }}>T3T · DAILY REFLECTION</MonoLabel>
        <div style={{ flex:1 }} />
        <span style={{ fontFamily:V2.font, fontSize:10, color:V2.fgDim }}>{answered}/3</span>
        <button style={{ background:'transparent', border:`1px solid ${V2.border}`, color:V2.fgDim, padding:'2px 8px', cursor:'pointer', fontFamily:V2.font, fontSize:10 }}>ESC</button>
      </div>

      {/* Progress */}
      <div style={{ padding:'10px 18px', borderBottom:`1px solid ${V2.border}`, display:'flex', gap:0 }}>
        {[0,1,2].map(i => (
          <div key={i} style={{ flex:1, height:3, background: i < answered ? V2.green : V2.surface, marginRight:i < 2 ? 4 : 0 }} />
        ))}
      </div>

      {/* Body */}
      <div style={{ flex:1, overflow:'auto', padding:'14px 18px', display:'flex', flexDirection:'column', gap:18 }}>
        {T3T_PROMPTS.map((p, i) => {
          const v = answers[p.id] || '';
          return (
            <div key={p.id}>
              <div style={{ display:'flex', alignItems:'baseline', gap:8, marginBottom:8 }}>
                <span style={{ fontFamily:V2.font, fontSize:11, color:V2.amber, letterSpacing:'0.08em' }}>Q.0{i+1}</span>
                {p.tag && <span style={{ fontFamily:V2.font, fontSize:9, color:V2.magenta, letterSpacing:'0.08em', padding:'1px 5px', border:`1px solid ${V2.magenta}` }}>{p.tag.toUpperCase()}</span>}
                {v.trim() && <span style={{ fontFamily:V2.font, fontSize:9, color:V2.green, letterSpacing:'0.08em', marginLeft:'auto' }}>● SAVED</span>}
              </div>
              <div style={{ fontSize:13, color:V2.ink, lineHeight:1.45, marginBottom:8, fontFamily:V2.sans }}>{p.q}</div>
              <textarea
                value={v}
                onChange={(e) => setAnswer(p.id, e.target.value)}
                placeholder="// type to answer · auto-saves"
                rows={3}
                style={{
                  width:'100%', resize:'vertical', padding:'10px 12px', fontSize:12.5, lineHeight:1.5,
                  fontFamily:V2.font, border:`1px solid ${V2.border}`, background:V2.surface, color:V2.ink, outline:'none',
                }}
                onFocus={(e) => e.target.style.borderColor = V2.amber}
                onBlur={(e) => e.target.style.borderColor = V2.border}
              />
            </div>
          );
        })}

        {/* Insight */}
        <div style={{ marginTop:8, padding:'12px 14px', border:`1px solid ${V2.border}`, background:V2.surface }}>
          <MonoLabel color={V2.amber} style={{ marginBottom:6 }}>// PATTERN · LAST 7</MonoLabel>
          <div style={{ fontSize:12, color:V2.fgDim, lineHeight:1.55 }}>
            "Courage" responses cluster around <span style={{ color:V2.amber }}>shipping investor docs</span>. Consider blocking 2h Friday for the v3 cut.
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ padding:'12px 18px', borderTop:`1px solid ${V2.border}`, display:'flex', alignItems:'center', gap:10, background:V2.surface }}>
        <span style={{ fontFamily:V2.font, fontSize:10, color:V2.fgMuted, flex:1 }}>⌘↩ SAVE · ⌘P PRINT WEEK · ESC CLOSE</span>
        <button style={{
          padding:'7px 12px', background:V2.amber, color:'#000', border:'none',
          fontFamily:V2.font, fontSize:11, fontWeight:500, letterSpacing:'0.08em', cursor:'pointer',
        }}>SAVE</button>
      </div>
    </div>
  );
}

function V2Drawer() { return <MissionProvider><V2DrawerInner /></MissionProvider>; }

Object.assign(window, { V2Desktop, V2Mobile, V2Drawer });
