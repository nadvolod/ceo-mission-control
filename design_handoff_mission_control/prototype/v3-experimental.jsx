// v3-experimental.jsx — Arc + Raycast inspired. Layered, glassy, keyboard-first.
// Big asymmetric tiles, streak rings, glow accents, animated counters,
// command palette as the primary surface.

const { useState, useEffect, useRef, useMemo } = React;

const V3 = {
  sans: "'Geist','Inter',system-ui,sans-serif",
  mono: "'Geist Mono','JetBrains Mono',ui-monospace,monospace",
  serif: "'Instrument Serif',Georgia,serif",
  bg: '#0E0C14',
  bgWarm: '#13111A',
  surface: 'rgba(255,255,255,0.04)',
  surfaceHi: 'rgba(255,255,255,0.07)',
  border: 'rgba(255,255,255,0.07)',
  borderHi: 'rgba(255,255,255,0.14)',
  ink: '#F5F1FF',
  fg: '#E2DEF0',
  fgDim: '#9890B5',
  fgMuted: '#5E5774',
  uv: '#7C7CFF',
  uvHi: '#9D9CFF',
  uvDim: '#3F3D6E',
  pink: '#FF7AD8',
  green: '#3DDC97',
  amber: '#FFB454',
  red: '#FF6469',
  cyan: '#5DD9FF',
};

// Inject keyframes specific to V3
if (typeof document !== 'undefined' && !document.getElementById('v3-keyframes')) {
  const s = document.createElement('style');
  s.id = 'v3-keyframes';
  s.textContent = `
    @keyframes v3-float { 0%,100%{ transform:translateY(0); } 50%{ transform:translateY(-2px); } }
    @keyframes v3-aurora { 0%{ background-position:0% 50%; } 50%{ background-position:100% 50%; } 100%{ background-position:0% 50%; } }
    @keyframes v3-glow { 0%,100%{ box-shadow: 0 0 0 0 rgba(124,124,255,0); } 50%{ box-shadow: 0 0 24px 0 rgba(124,124,255,0.35); } }
  `;
  document.head.appendChild(s);
}

/* ────────────────────────────────────────────────────────────────────────
   Glass tile
   ──────────────────────────────────────────────────────────────────────── */

function Tile({ children, span = 1, rowSpan = 1, hue = null, style, hover = true }) {
  const [h, setH] = useState(false);
  return (
    <div
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      style={{
        gridColumn: `span ${span}`, gridRow: `span ${rowSpan}`,
        background: V3.surface,
        backdropFilter:'blur(20px)',
        border: `1px solid ${h && hover ? V3.borderHi : V3.border}`,
        borderRadius: 16, padding: 16,
        position:'relative', overflow:'hidden',
        transition:'border-color .18s, transform .18s',
        ...style,
      }}>
      {hue && (
        <div style={{
          position:'absolute', top:-40, right:-40, width:140, height:140,
          background: `radial-gradient(circle, ${hue} 0%, transparent 70%)`,
          opacity: 0.35, pointerEvents:'none',
        }} />
      )}
      <div style={{ position:'relative', height:'100%', display:'flex', flexDirection:'column' }}>{children}</div>
    </div>
  );
}

function Eyebrow({ children, color = V3.fgDim, dot = null }) {
  return (
    <div style={{ fontFamily:V3.mono, fontSize:10, letterSpacing:'0.1em', textTransform:'uppercase', color, display:'flex', alignItems:'center', gap:6 }}>
      {dot && <span style={{ width:5, height:5, borderRadius:'50%', background:dot, display:'inline-block', boxShadow: `0 0 8px ${dot}` }} />}
      {children}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────
   COMMAND PALETTE (always visible at top — primary input)
   ──────────────────────────────────────────────────────────────────────── */

function CommandPalette() {
  const { log } = useMission();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(true);

  const allActions = [
    { kw:'+0.5h temporal', label:'Log +0.5h Temporal',  run:() => log('temporal', 0.5, '+0.5h'),    icon:'⏱', accent:V3.uv },
    { kw:'+1h temporal',   label:'Log +1h Temporal',    run:() => log('temporal', 1,   '+1h'),      icon:'⏱', accent:V3.uv },
    { kw:'+2h temporal',   label:'Log +2h Temporal',    run:() => log('temporal', 2,   '+2h'),      icon:'⏱', accent:V3.uv },
    { kw:'+gen 2000',      label:'+ Generated $2,000',  run:() => log('moneyMoved', 2000, '+ Gen'), icon:'$', accent:V3.green },
    { kw:'+moved 500',     label:'+ Moved $500',        run:() => log('moneyMoved', 500, '+ Moved'),icon:'$', accent:V3.green },
    { kw:'+call',          label:'+ Pipeline call',     run:() => log('pipeline', 0.5, '+ Call'),   icon:'☎', accent:V3.pink },
    { kw:'+demo',          label:'+ Pipeline demo',     run:() => log('pipeline', 1,   '+ Demo'),   icon:'☎', accent:V3.pink },
    { kw:'+0.5h deep',     label:'+0.5h Deep work',     run:() => log('deepWork', 0.5, '+0.5h'),    icon:'◆', accent:V3.cyan },
    { kw:'+train',         label:'+ Training session',  run:() => log('trained', 1,   '+ Session'), icon:'△', accent:V3.amber },
    { kw:'reflect',        label:'Open reflection',     run:() => {},                                icon:'❋', accent:V3.pink },
    { kw:'trends',         label:'Open insights',       run:() => {},                                icon:'∿', accent:V3.uv },
  ];

  const filtered = q ? allActions.filter(a => a.kw.includes(q.toLowerCase()) || a.label.toLowerCase().includes(q.toLowerCase())) : allActions.slice(0, 5);

  return (
    <div style={{
      background: V3.bgWarm, border:`1px solid ${V3.borderHi}`, borderRadius:14,
      boxShadow:'0 24px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(124,124,255,0.08), 0 0 60px rgba(124,124,255,0.06)',
      overflow:'hidden',
    }}>
      <div style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 14px', borderBottom: q ? `1px solid ${V3.border}` : 'none' }}>
        <Icon.search s={14} style={{ color:V3.fgDim }} />
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && filtered[0]) { filtered[0].run(); setQ(''); } }}
          placeholder="Log, jump, search — try “+1h temporal” or “gen 2000”"
          style={{
            flex:1, background:'transparent', border:'none', outline:'none',
            font:'inherit', fontSize:14, color:V3.ink, fontFamily:V3.sans,
          }}
        />
        <span style={{ fontFamily:V3.mono, fontSize:10, color:V3.fgMuted, padding:'2px 6px', background:V3.surface, border:`1px solid ${V3.border}`, borderRadius:4 }}>⌘K</span>
      </div>
      {q && (
        <div style={{ maxHeight:240, overflow:'auto' }}>
          {filtered.map((a, i) => (
            <button key={a.kw} onClick={() => { a.run(); setQ(''); }} style={{
              width:'100%', display:'flex', alignItems:'center', gap:12, padding:'9px 14px',
              background: i === 0 ? V3.surface : 'transparent', border:'none', cursor:'pointer',
              font:'inherit', textAlign:'left', color:V3.fg,
            }}>
              <span style={{
                width:26, height:26, borderRadius:6, background: `${a.accent}26`, color: a.accent,
                display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, fontFamily:V3.mono,
              }}>{a.icon}</span>
              <span style={{ flex:1, fontSize:13 }}>{a.label}</span>
              <span style={{ fontFamily:V3.mono, fontSize:10, color:V3.fgMuted }}>{a.kw}</span>
              <span style={{ fontFamily:V3.mono, fontSize:10, color:V3.fgMuted }}>↩</span>
            </button>
          ))}
          {filtered.length === 0 && (
            <div style={{ padding:14, color:V3.fgDim, fontSize:13 }}>No match. Try “+1h temp”, “gen”, “call”, “reflect”.</div>
          )}
        </div>
      )}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────
   STREAK / RING METRIC TILE — for goal-tracked metrics.
   ──────────────────────────────────────────────────────────────────────── */

function RingTile({ metricId, presets, hue, ringColor }) {
  const { metrics, log } = useMission();
  const m = metrics[metricId];
  if (!m) return null;
  const pct = m.goal ? clamp(m.week / m.goal, 0, 1) : 0;
  return (
    <Tile hue={hue}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
        <Eyebrow dot={ringColor}>{m.label}</Eyebrow>
        {m.goal && <span style={{ fontFamily:V3.mono, fontSize:10, color: pct >= 1 ? V3.green : V3.fgDim }}>{fmt(m.week,m.fmt)}/{fmt(m.goal,m.fmt)}</span>}
      </div>

      <div style={{ display:'flex', alignItems:'center', gap:16, marginTop:14, marginBottom:14 }}>
        <Ring pct={pct} size={64} stroke={5} color={ringColor} track={V3.surfaceHi}>
          <span style={{ fontFamily:V3.sans, fontSize:13, fontWeight:500, color:V3.ink }}>{Math.round(pct * 100)}<span style={{ fontSize:9, color:V3.fgDim }}>%</span></span>
        </Ring>
        <div style={{ flex:1 }}>
          <div style={{ fontFamily:V3.sans, fontSize:32, color:V3.ink, fontWeight:300, letterSpacing:'-0.03em', lineHeight:1 }}>
            <Ticker value={m.today} fmt={m.fmt} />
          </div>
          <div style={{ fontFamily:V3.mono, fontSize:10, color:V3.fgDim, marginTop:4, letterSpacing:'0.06em' }}>TODAY</div>
        </div>
      </div>

      {presets && (
        <div style={{ display:'flex', gap:6, marginTop:'auto' }}>
          {presets.map(([l, a]) => (
            <button key={l} onClick={() => log(metricId, a, l)} style={{
              flex:1, padding:'7px 0', fontFamily:V3.sans, fontSize:12, fontWeight:500,
              background:`${ringColor}1A`, color:ringColor, border:`1px solid ${ringColor}33`, borderRadius:8, cursor:'pointer',
            }}>{l}</button>
          ))}
        </div>
      )}
    </Tile>
  );
}

/* ────────────────────────────────────────────────────────────────────────
   V3 DESKTOP
   ──────────────────────────────────────────────────────────────────────── */

function V3DesktopInner() {
  const { metrics, activity, log } = useMission();

  return (
    <div className="ab" style={{
      width:'100%', height:'100%', background:V3.bg, color:V3.fg, fontFamily:V3.sans, fontSize:13,
      position:'relative', overflow:'hidden',
    }}>
      {/* Aurora background */}
      <div style={{
        position:'absolute', inset:0, opacity:0.6, pointerEvents:'none',
        background: `radial-gradient(60% 50% at 20% 20%, ${V3.uv}26 0%, transparent 50%),
                     radial-gradient(50% 40% at 85% 10%, ${V3.pink}1F 0%, transparent 60%),
                     radial-gradient(70% 60% at 80% 90%, ${V3.cyan}1A 0%, transparent 60%)`,
      }} />

      <div style={{ position:'relative', height:'100%', display:'flex', flexDirection:'column' }}>
        {/* Top chrome */}
        <header style={{ padding:'14px 24px', display:'flex', alignItems:'center', gap:16 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ width:32, height:32, borderRadius:8, background:V3.uv, display:'flex', alignItems:'center', justifyContent:'center', boxShadow: `0 0 24px ${V3.uv}66` }}>
              <OrbitStar size={20} color="#fff" glow />
            </div>
            <div>
              <div style={{ fontFamily:V3.sans, fontSize:14, fontWeight:600, letterSpacing:'-0.01em', color:V3.ink }}>Mission Control</div>
              <div style={{ fontFamily:V3.mono, fontSize:10, color:V3.fgDim, letterSpacing:'0.08em' }}>WED · MAY 27 · 09:12</div>
            </div>
          </div>

          <div style={{ flex:1, maxWidth:520, marginLeft:'auto', marginRight:'auto' }}>
            <CommandPalette />
          </div>

          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <button style={{
              padding:'8px 12px', background:V3.surface, color:V3.fg, border:`1px solid ${V3.border}`,
              borderRadius:8, font:'inherit', fontSize:12, cursor:'pointer', display:'flex', alignItems:'center', gap:6,
            }}><Icon.brain s={14} /> Reflect</button>
            <div style={{ width:32, height:32, borderRadius:'50%', background:`linear-gradient(135deg, ${V3.uv}, ${V3.pink})`, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:500, fontSize:12, color:'#fff' }}>NM</div>
          </div>
        </header>

        {/* Hero strip */}
        <div style={{ padding:'4px 24px 14px', display:'flex', gap:10, alignItems:'center' }}>
          <div style={{
            padding:'6px 12px', background:V3.surface, border:`1px solid ${V3.border}`, borderRadius:99,
            display:'flex', alignItems:'center', gap:8, fontSize:12,
          }}>
            <span style={{ width:8, height:8, borderRadius:'50%', background:V3.amber, animation:'mc-pulse 2s ease-in-out infinite' }} />
            <span style={{ color:V3.amber, fontFamily:V3.mono, fontSize:10, letterSpacing:'0.06em' }}>STREAK</span>
            <span style={{ color:V3.ink, fontWeight:500 }}>6-day Temporal</span>
            <span style={{ color:V3.fgDim, fontSize:11 }}>· longest in 30d</span>
          </div>
          <div style={{
            padding:'6px 12px', background:`${V3.green}1A`, border:`1px solid ${V3.green}40`, borderRadius:99,
            display:'flex', alignItems:'center', gap:8, fontSize:12,
          }}>
            <Icon.arrowUp s={12} style={{ color:V3.green }} />
            <span style={{ color:V3.green, fontFamily:V3.mono, fontSize:10, letterSpacing:'0.06em' }}>CASH MoM</span>
            <span style={{ color:V3.ink, fontWeight:500 }}>+228%</span>
          </div>
          <div style={{
            padding:'6px 12px', background:`${V3.red}1A`, border:`1px solid ${V3.red}40`, borderRadius:99,
            display:'flex', alignItems:'center', gap:8, fontSize:12,
          }}>
            <Icon.arrowDown s={12} style={{ color:V3.red }} />
            <span style={{ color:V3.red, fontFamily:V3.mono, fontSize:10, letterSpacing:'0.06em' }}>DEEP WORK</span>
            <span style={{ color:V3.ink }}>pace ↓18% vs 14d</span>
          </div>
          <div style={{ flex:1 }} />
          <div style={{ fontFamily:V3.mono, fontSize:10, color:V3.fgMuted, letterSpacing:'0.06em' }}>SYNCED 4m AGO · ALL SYSTEMS LIVE</div>
        </div>

        {/* Asymmetric grid */}
        <div style={{
          flex:1, padding:'0 24px 24px', display:'grid',
          gridTemplateColumns:'repeat(6, 1fr)', gridAutoRows:'minmax(140px, auto)', gap:12,
          overflow:'auto',
        }}>
          {/* HERO — Cash, big tile */}
          <Tile span={3} rowSpan={2} hue={V3.uv}>
            <Eyebrow dot={V3.uv}>CASH · FIELD</Eyebrow>
            <div style={{ display:'flex', alignItems:'baseline', gap:14, marginTop:14 }}>
              <span style={{
                fontFamily:V3.serif, fontSize:88, fontWeight:400, color:V3.ink, letterSpacing:'-0.04em', lineHeight:0.9,
              }}><Ticker value={metrics.cash.today} fmt="money" duration={640} /></span>
              <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
                <span style={{ fontFamily:V3.mono, fontSize:13, color:V3.green }}>▲ 228.0% MoM</span>
                <span style={{ fontFamily:V3.mono, fontSize:11, color:V3.fgDim }}>+$2.4K · no burn</span>
              </div>
            </div>

            <div style={{ marginTop:16, marginBottom:6 }}>
              <Sparkline data={CASH_30} color={V3.uv} fill={V3.uv} height={50} width={420} strokeWidth={1.5} dots />
            </div>

            <div style={{ display:'flex', gap:18, marginTop:14, paddingTop:14, borderTop:`1px solid ${V3.border}` }}>
              <div><Eyebrow color={V3.fgMuted}>NET WORTH</Eyebrow><div style={{ fontFamily:V3.serif, fontSize:24, color:V3.ink, marginTop:2 }}>{fmt(metrics.netWorth.today,'money')}</div></div>
              <div><Eyebrow color={V3.fgMuted}>DEBT</Eyebrow><div style={{ fontFamily:V3.serif, fontSize:24, color:V3.red, marginTop:2 }}>{fmt(metrics.debt.today,'money')}</div></div>
              <div><Eyebrow color={V3.fgMuted}>RUNWAY</Eyebrow><div style={{ fontFamily:V3.serif, fontSize:24, color:V3.ink, marginTop:2 }}>∞</div></div>
              <div style={{ marginLeft:'auto', alignSelf:'flex-end', fontFamily:V3.mono, fontSize:10, color:V3.fgDim }}>monarch · 4m</div>
            </div>
          </Tile>

          {/* Temporal ring tile */}
          <RingTile metricId="temporal" hue={V3.uv} ringColor={V3.uv} presets={[['+0.5h', 0.5],['+1h', 1],['+2h', 2]]} />
          {/* Pipeline ring tile */}
          <RingTile metricId="pipeline" hue={V3.pink} ringColor={V3.pink} presets={[['+ Call', 0.5],['+ Demo', 1],['+ FU', 0.5]]} />

          {/* Money moved */}
          <Tile span={1} hue={V3.green}>
            <Eyebrow dot={V3.green}>MONEY MOVED</Eyebrow>
            <div style={{ flex:1, display:'flex', flexDirection:'column', justifyContent:'center' }}>
              <span style={{ fontFamily:V3.serif, fontSize:36, color:V3.ink, fontWeight:300, lineHeight:1, letterSpacing:'-0.02em' }}>
                <Ticker value={metrics.moneyMoved.today} fmt="money" />
              </span>
              <span style={{ fontFamily:V3.mono, fontSize:10, color:V3.fgDim, letterSpacing:'0.06em', marginTop:4 }}>TODAY · wk $0</span>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:5, marginTop:'auto' }}>
              {[['+ Moved', 500], ['+ Generated', 1000], ['+ Cut', 250]].map(([l, a]) => (
                <button key={l} onClick={() => log('moneyMoved', a, l)} style={{
                  padding:'6px 8px', fontSize:11, fontFamily:V3.sans, textAlign:'left',
                  background:`${V3.green}1A`, color:V3.green, border:`1px solid ${V3.green}33`, borderRadius:6, cursor:'pointer',
                  fontWeight:500,
                }}>{l}</button>
              ))}
            </div>
          </Tile>

          {/* Three to Thrive — collapsed compact */}
          <Tile span={3} hue={V3.pink}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <Eyebrow dot={V3.pink}>THREE TO THRIVE · DAILY</Eyebrow>
              <span style={{ fontFamily:V3.mono, fontSize:10, color:V3.fgDim }}>0 / 3 · ⌘R to focus</span>
            </div>
            <div style={{ marginTop:12, display:'flex', flexDirection:'column', gap:8, flex:1 }}>
              {T3T_PROMPTS.map((p, i) => (
                <div key={p.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 10px', background:V3.surface, border:`1px solid ${V3.border}`, borderRadius:8, cursor:'pointer' }}>
                  <span style={{ fontFamily:V3.mono, fontSize:10, color:V3.pink, letterSpacing:'0.08em' }}>0{i+1}</span>
                  <span style={{ fontSize:12, color:V3.fg, lineHeight:1.35, flex:1 }}>{p.q}</span>
                  {p.tag && <span style={{ fontFamily:V3.mono, fontSize:9, color:V3.pink, padding:'1px 6px', background:`${V3.pink}1A`, borderRadius:99 }}>DAILY</span>}
                  <Icon.arrowRight s={12} style={{ color:V3.fgMuted }} />
                </div>
              ))}
            </div>
          </Tile>

          {/* Deep Work */}
          <Tile span={1} hue={V3.cyan}>
            <Eyebrow dot={V3.cyan}>DEEP WORK</Eyebrow>
            <div style={{ marginTop:8 }}>
              <span style={{ fontFamily:V3.serif, fontSize:36, color:V3.ink, fontWeight:300, lineHeight:1 }}><Ticker value={metrics.deepWork.today} fmt="hours" /></span>
              <div style={{ fontFamily:V3.mono, fontSize:10, color:V3.fgDim, marginTop:4 }}>TODAY · wk 5/10h</div>
            </div>
            <div style={{ marginTop:8 }}>
              <Sparkline data={DEEPWORK_14} color={V3.cyan} fill={V3.cyan} height={28} width={150} />
            </div>
            <div style={{ display:'flex', gap:5, marginTop:'auto' }}>
              {[['+0.5h', 0.5], ['+1h', 1]].map(([l, a]) => (
                <button key={l} onClick={() => log('deepWork', a, l)} style={{
                  flex:1, padding:'6px 0', fontSize:11, fontFamily:V3.sans, fontWeight:500,
                  background:`${V3.cyan}1A`, color:V3.cyan, border:`1px solid ${V3.cyan}33`, borderRadius:6, cursor:'pointer',
                }}>{l}</button>
              ))}
            </div>
          </Tile>

          {/* Trained */}
          <Tile span={1} hue={V3.amber}>
            <Eyebrow dot={V3.amber}>TRAINED</Eyebrow>
            <div style={{ marginTop:8, flex:1 }}>
              <span style={{ fontFamily:V3.serif, fontSize:36, color:V3.ink, fontWeight:300, lineHeight:1 }}><Ticker value={metrics.trained.week} fmt="count" /></span>
              <span style={{ fontFamily:V3.serif, fontSize:18, color:V3.fgDim, marginLeft:4 }}>/ 4</span>
              <div style={{ fontFamily:V3.mono, fontSize:10, color:V3.red, marginTop:4 }}>BEHIND · 4 needed</div>
            </div>
            <button onClick={() => log('trained', 1, '+ Session')} style={{
              padding:'7px 0', fontSize:11, fontFamily:V3.sans, fontWeight:500,
              background:`${V3.amber}1A`, color:V3.amber, border:`1px solid ${V3.amber}33`, borderRadius:6, cursor:'pointer',
            }}>+ Log session</button>
          </Tile>

          {/* Activity tape */}
          <Tile span={2} hue={null} style={{ padding:0 }}>
            <div style={{ padding:'14px 16px 8px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <Eyebrow dot={V3.green}>LIVE TAPE</Eyebrow>
              <span style={{ fontFamily:V3.mono, fontSize:10, color:V3.fgDim }}>auto · last 40</span>
            </div>
            <div style={{ flex:1, overflow:'auto', padding:'0 8px 12px' }}>
              {activity.slice(0, 6).map((a, i) => (
                <div key={a.id || i} style={{
                  display:'grid', gridTemplateColumns:'40px 1fr', gap:10, padding:'6px 8px',
                  borderRadius:6, background: a._flash ? `${V3.uv}1A` : 'transparent', transition:'background 1s',
                }}>
                  <span style={{ fontFamily:V3.mono, fontSize:10, color:V3.fgMuted }}>{a.t}</span>
                  <div>
                    <div style={{ display:'flex', gap:6, alignItems:'baseline' }}>
                      <span style={{ fontFamily:V3.mono, fontSize:11, color: a.delta?.startsWith('+') ? V3.green : V3.fg }}>{a.delta}</span>
                      <span style={{ fontSize:12, color:V3.ink, fontWeight:500 }}>{a.label}</span>
                    </div>
                    <div style={{ fontSize:11, color:V3.fgDim, marginTop:1 }}>{a.meta}</div>
                  </div>
                </div>
              ))}
            </div>
          </Tile>
        </div>
      </div>
    </div>
  );
}

function V3Desktop() { return <MissionProvider><V3DesktopInner /></MissionProvider>; }

/* ────────────────────────────────────────────────────────────────────────
   V3 MOBILE
   ──────────────────────────────────────────────────────────────────────── */

function V3MobileInner() {
  const { metrics, activity, log } = useMission();

  return (
    <div className="ab" style={{
      width:'100%', height:'100%', background:V3.bg, color:V3.fg, fontFamily:V3.sans, fontSize:14,
      position:'relative', overflow:'hidden',
    }}>
      <div style={{
        position:'absolute', inset:0, opacity:0.6, pointerEvents:'none',
        background: `radial-gradient(60% 50% at 20% 10%, ${V3.uv}33 0%, transparent 50%),
                     radial-gradient(50% 40% at 80% 90%, ${V3.pink}1F 0%, transparent 60%)`,
      }} />

      <div style={{ position:'relative', height:'100%', display:'flex', flexDirection:'column' }}>
        {/* Status */}
        <div style={{ height:38, padding:'10px 18px 0', display:'flex', justifyContent:'space-between', fontFamily:V3.sans, fontSize:13, color:V3.ink, fontWeight:600 }}>
          <span>9:12</span>
          <span style={{ fontFamily:V3.mono, color:V3.fgDim }}>5G ●●●●</span>
        </div>

        {/* Header */}
        <div style={{ padding:'12px 18px 8px', display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ width:32, height:32, borderRadius:8, background:V3.uv, display:'flex', alignItems:'center', justifyContent:'center', boxShadow:`0 0 18px ${V3.uv}66` }}>
            <OrbitStar size={18} color="#fff" />
          </div>
          <div>
            <div style={{ fontSize:18, fontWeight:600, color:V3.ink, letterSpacing:'-0.01em' }}>Mission</div>
            <div style={{ fontFamily:V3.mono, fontSize:9, color:V3.fgDim, letterSpacing:'0.1em', marginTop:1 }}>WED · MAY 27</div>
          </div>
          <div style={{ marginLeft:'auto', width:32, height:32, borderRadius:'50%', background:`linear-gradient(135deg, ${V3.uv}, ${V3.pink})`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:500, color:'#fff' }}>NM</div>
        </div>

        {/* CMD-K */}
        <div style={{ padding:'4px 14px 10px' }}>
          <div style={{
            background:V3.surface, border:`1px solid ${V3.border}`, borderRadius:12,
            padding:'10px 12px', display:'flex', alignItems:'center', gap:8,
          }}>
            <Icon.search s={14} style={{ color:V3.fgDim }} />
            <span style={{ flex:1, fontSize:13, color:V3.fgDim }}>Log, jump, search…</span>
            <span style={{ fontFamily:V3.mono, fontSize:10, color:V3.fgMuted, padding:'2px 6px', background:V3.surfaceHi, borderRadius:4 }}>⌘K</span>
          </div>
        </div>

        {/* Streaks strip — horiz scroll */}
        <div style={{ padding:'0 14px 10px', display:'flex', gap:6, overflowX:'auto' }}>
          {[
            { bg:V3.amber, label:'6d Temporal', sub:'STREAK' },
            { bg:V3.green, label:'+228% Cash',  sub:'MOM' },
            { bg:V3.red,   label:'Deep ↓18%',  sub:'PACE' },
          ].map((s, i) => (
            <div key={i} style={{
              padding:'5px 10px', background:`${s.bg}1A`, border:`1px solid ${s.bg}40`, borderRadius:99,
              display:'flex', alignItems:'center', gap:6, fontSize:11, whiteSpace:'nowrap',
            }}>
              <span style={{ fontFamily:V3.mono, fontSize:9, color:s.bg, letterSpacing:'0.08em' }}>{s.sub}</span>
              <span style={{ color:V3.ink, fontWeight:500 }}>{s.label}</span>
            </div>
          ))}
        </div>

        {/* Hero card — cash */}
        <div style={{ padding:'0 14px 12px' }}>
          <div style={{
            background: V3.surface, border:`1px solid ${V3.border}`, borderRadius:16, padding:18,
            position:'relative', overflow:'hidden',
          }}>
            <div style={{ position:'absolute', top:-40, right:-40, width:140, height:140, background:`radial-gradient(circle, ${V3.uv} 0%, transparent 70%)`, opacity:0.4, pointerEvents:'none' }} />
            <Eyebrow dot={V3.uv}>CASH · FIELD</Eyebrow>
            <div style={{ marginTop:8, position:'relative' }}>
              <div style={{ fontFamily:V3.serif, fontSize:56, color:V3.ink, fontWeight:300, letterSpacing:'-0.03em', lineHeight:1 }}>
                <Ticker value={metrics.cash.today} fmt="money" />
              </div>
              <div style={{ display:'flex', gap:10, marginTop:8, fontFamily:V3.mono, fontSize:11 }}>
                <span style={{ color:V3.green }}>▲ 228%</span>
                <span style={{ color:V3.fgDim }}>NW $982K</span>
                <span style={{ color:V3.red }}>DEBT $27.9K</span>
              </div>
              <div style={{ marginTop:12 }}>
                <Sparkline data={CASH_30} color={V3.uv} fill={V3.uv} height={32} width={330} strokeWidth={1.5} />
              </div>
            </div>
          </div>
        </div>

        {/* Two ring tiles */}
        <div style={{ padding:'0 14px 12px', display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
          {[
            { id:'temporal', color:V3.uv,   presets:[['+0.5h', 0.5],['+1h', 1]] },
            { id:'pipeline', color:V3.pink, presets:[['+ Call', 0.5],['+ Demo', 1]] },
          ].map(({ id, color, presets }) => {
            const m = metrics[id];
            const pct = m.goal ? clamp(m.week / m.goal, 0, 1) : 0;
            return (
              <div key={id} style={{
                background:V3.surface, border:`1px solid ${V3.border}`, borderRadius:14, padding:14,
              }}>
                <Eyebrow dot={color}>{m.label}</Eyebrow>
                <div style={{ display:'flex', alignItems:'center', gap:10, marginTop:10 }}>
                  <Ring pct={pct} size={48} stroke={4} color={color} track={V3.surfaceHi}>
                    <span style={{ fontSize:11, color:V3.ink, fontFamily:V3.sans, fontWeight:500 }}>{Math.round(pct * 100)}%</span>
                  </Ring>
                  <div style={{ flex:1 }}>
                    <div style={{ fontFamily:V3.serif, fontSize:24, color:V3.ink, fontWeight:300, lineHeight:1 }}><Ticker value={m.today} fmt={m.fmt} /></div>
                    <div style={{ fontFamily:V3.mono, fontSize:9, color:V3.fgDim, marginTop:3 }}>wk {fmt(m.week,m.fmt)}/{fmt(m.goal,m.fmt)}</div>
                  </div>
                </div>
                <div style={{ display:'flex', gap:5, marginTop:12 }}>
                  {presets.map(([l, a]) => (
                    <button key={l} onClick={() => log(id, a, l)} style={{
                      flex:1, padding:'8px 0', fontSize:11, fontFamily:V3.sans, fontWeight:500,
                      background:`${color}1A`, color, border:`1px solid ${color}33`, borderRadius:6, cursor:'pointer',
                    }}>{l}</button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Activity */}
        <div style={{ flex:1, padding:'0 14px 14px', overflow:'auto' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
            <Eyebrow dot={V3.green}>LIVE TAPE</Eyebrow>
            <span style={{ fontFamily:V3.mono, fontSize:10, color:V3.fgDim }}>Reflect ↑</span>
          </div>
          <div style={{ background:V3.surface, border:`1px solid ${V3.border}`, borderRadius:14, padding:'4px 0' }}>
            {activity.slice(0, 5).map((a, i) => (
              <div key={a.id || i} style={{ display:'grid', gridTemplateColumns:'40px 1fr', gap:10, padding:'8px 14px' }}>
                <span style={{ fontFamily:V3.mono, fontSize:10, color:V3.fgMuted }}>{a.t}</span>
                <div>
                  <div style={{ display:'flex', gap:6, alignItems:'baseline' }}>
                    <span style={{ fontFamily:V3.mono, fontSize:11, color: a.delta?.startsWith('+') ? V3.green : V3.fg }}>{a.delta}</span>
                    <span style={{ fontSize:12.5, color:V3.ink, fontWeight:500 }}>{a.label}</span>
                  </div>
                  <div style={{ fontSize:11, color:V3.fgDim }}>{a.meta}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function V3Mobile() { return <MissionProvider><V3MobileInner /></MissionProvider>; }

/* ────────────────────────────────────────────────────────────────────────
   V3 DRAWER — glassy reflection sheet
   ──────────────────────────────────────────────────────────────────────── */

function V3DrawerInner() {
  const { answers, setAnswer } = useMission();
  const answered = T3T_PROMPTS.filter(p => (answers[p.id] || '').trim()).length;

  return (
    <div className="ab" style={{
      width:'100%', height:'100%', background:V3.bg, color:V3.fg, fontFamily:V3.sans, fontSize:13,
      position:'relative', overflow:'hidden',
      borderLeft:`1px solid ${V3.borderHi}`, boxShadow:'-24px 0 60px rgba(0,0,0,0.5)',
    }}>
      <div style={{
        position:'absolute', inset:0, opacity:0.55, pointerEvents:'none',
        background: `radial-gradient(70% 50% at 80% 10%, ${V3.pink}26 0%, transparent 60%),
                     radial-gradient(60% 50% at 10% 90%, ${V3.uv}1F 0%, transparent 60%)`,
      }} />

      <div style={{ position:'relative', height:'100%', display:'flex', flexDirection:'column' }}>
        {/* Header */}
        <div style={{ padding:'18px 22px', borderBottom:`1px solid ${V3.border}`, display:'flex', alignItems:'center', gap:12 }}>
          <div style={{ width:36, height:36, borderRadius:10, background:`linear-gradient(135deg, ${V3.pink}, ${V3.uv})`, display:'flex', alignItems:'center', justifyContent:'center' }}>
            <OrbitStar size={20} color="#fff" />
          </div>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:16, fontWeight:600, color:V3.ink, letterSpacing:'-0.01em' }}>Reflection</div>
            <div style={{ fontFamily:V3.mono, fontSize:10, color:V3.fgDim, letterSpacing:'0.08em', marginTop:2 }}>WED · MAY 27 · {answered}/3 ANSWERED</div>
          </div>
          <button style={{
            width:30, height:30, borderRadius:8, background:V3.surface, border:`1px solid ${V3.border}`,
            color:V3.fgDim, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer',
          }}><Icon.close s={14} /></button>
        </div>

        {/* Progress */}
        <div style={{ padding:'14px 22px 0', display:'flex', gap:6 }}>
          {[0,1,2].map(i => (
            <div key={i} style={{
              flex:1, height:5, borderRadius:3,
              background: i < answered
                ? `linear-gradient(90deg, ${V3.uv}, ${V3.pink})`
                : V3.surfaceHi,
              boxShadow: i < answered ? `0 0 10px ${V3.uv}` : 'none',
            }} />
          ))}
        </div>

        {/* Prompts */}
        <div style={{ flex:1, overflow:'auto', padding:'18px 22px', display:'flex', flexDirection:'column', gap:22 }}>
          {T3T_PROMPTS.map((p, i) => {
            const v = answers[p.id] || '';
            const done = !!v.trim();
            const accentColor = [V3.uv, V3.pink, V3.amber][i];
            return (
              <div key={p.id}>
                <div style={{ display:'flex', alignItems:'baseline', gap:10, marginBottom:8 }}>
                  <span style={{
                    width:24, height:24, borderRadius:'50%',
                    background: done ? `linear-gradient(135deg, ${V3.uv}, ${V3.pink})` : `${accentColor}1A`,
                    color: done ? '#fff' : accentColor, fontFamily:V3.mono, fontSize:11, fontWeight:500,
                    display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
                    boxShadow: done ? `0 0 12px ${V3.uv}66` : 'none',
                  }}>{done ? <Icon.check s={12} /> : `0${i+1}`}</span>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:14.5, fontWeight:500, color:V3.ink, lineHeight:1.4, fontFamily:V3.serif }}>{p.q}</div>
                    {p.tag && (
                      <span style={{ display:'inline-block', marginTop:5, padding:'2px 8px', fontSize:10, fontFamily:V3.mono, color:V3.pink, background:`${V3.pink}1A`, border:`1px solid ${V3.pink}33`, borderRadius:99 }}>{p.tag}</span>
                    )}
                  </div>
                </div>
                <textarea
                  value={v}
                  onChange={(e) => setAnswer(p.id, e.target.value)}
                  placeholder="Type to answer · auto-saves"
                  rows={3}
                  style={{
                    width:'100%', resize:'vertical', padding:'12px 14px', fontSize:13.5, lineHeight:1.55,
                    fontFamily:V3.sans, border:`1px solid ${V3.border}`, borderRadius:10,
                    background:V3.surface, color:V3.ink, outline:'none',
                  }}
                  onFocus={(e) => { e.target.style.borderColor = accentColor; e.target.style.boxShadow = `0 0 0 3px ${accentColor}22`; }}
                  onBlur={(e) => { e.target.style.borderColor = V3.border; e.target.style.boxShadow = 'none'; }}
                />
                {v && (
                  <div style={{ marginTop:4, fontFamily:V3.mono, fontSize:10, color:V3.green, letterSpacing:'0.06em' }}>● SAVED · {v.length} CHARS</div>
                )}
              </div>
            );
          })}

          {/* Insight from past week */}
          <div style={{
            padding:'14px 16px', background:V3.surface, border:`1px solid ${V3.border}`, borderRadius:12,
            borderLeft:`3px solid ${V3.pink}`,
          }}>
            <Eyebrow color={V3.pink}>PATTERN · LAST 7 DAYS</Eyebrow>
            <div style={{ fontSize:13, color:V3.fg, lineHeight:1.55, marginTop:8, fontStyle:'italic', fontFamily:V3.serif }}>
              "Courage" answers cluster around shipping investor docs. Block 2h Friday for the v3 cut — you mentioned it Mon and Tue.
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding:'12px 22px', borderTop:`1px solid ${V3.border}`, display:'flex', alignItems:'center', gap:10,
          background:V3.surface, backdropFilter:'blur(20px)',
        }}>
          <span style={{ fontFamily:V3.mono, fontSize:10, color:V3.fgMuted, letterSpacing:'0.06em' }}>⌘↩ SAVE · ⌘P PRINT WEEK</span>
          <button style={{
            marginLeft:'auto', padding:'9px 16px', background:`linear-gradient(135deg, ${V3.uv}, ${V3.pink})`,
            color:'#fff', border:'none', borderRadius:10, font:'inherit', fontSize:12.5, fontWeight:500, cursor:'pointer',
            boxShadow:`0 4px 12px ${V3.uv}55`,
          }}>Save & close</button>
        </div>
      </div>
    </div>
  );
}

function V3Drawer() { return <MissionProvider><V3DrawerInner /></MissionProvider>; }

Object.assign(window, { V3Desktop, V3Mobile, V3Drawer });
