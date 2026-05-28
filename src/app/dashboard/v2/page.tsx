'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Plus, Search } from 'lucide-react';
import { Aurora } from '@/components/dashboard/v2/primitives/Aurora';
import { OrbitStar } from '@/components/dashboard/v2/primitives/OrbitStar';
import { MetricCard } from '@/components/dashboard/v2/MetricCard';
import { ChipStrip } from '@/components/dashboard/v2/ChipStrip';
import { ActivityFeed } from '@/components/dashboard/v2/ActivityFeed';
import { CollapsiblePanel } from '@/components/dashboard/v2/CollapsiblePanel';
import { CmdK } from '@/components/dashboard/v2/CmdK';
import { ReflectionDrawer } from '@/components/dashboard/v2/ReflectionDrawer';
import { useMissionStore } from '@/components/dashboard/v2/useMissionStore';
import { deriveActivity, deriveChips, consecutiveStreak } from '@/components/dashboard/v2/derive';
import { TrendsPanel, buildOverviewTrendSeries } from '@/components/dashboard/v2/TrendsPanel';
import { InsightsTab } from '@/components/dashboard/v2/InsightsTab';
import { ReviewTab } from '@/components/dashboard/v2/ReviewTab';
import { MobileLayout } from '@/components/dashboard/v2/MobileLayout';

type Tab = 'overview' | 'insights' | 'review';

const DAY_LABELS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

function fmtHeaderDate(d: Date): string {
  const day = DAY_LABELS[d.getDay()];
  const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return `${day} · ${date} · ${time}`;
}

export default function MissionControlV2Page() {
  const store = useMissionStore();
  const { focusData, financialData, weeklyTrackerData, monarchData, monthlyReviewData } = store;

  const [tab, setTab] = useState<Tab>('overview');
  const [cmdOpen, setCmdOpen] = useState(false);
  const [reflectOpen, setReflectOpen] = useState(false);
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setNow(new Date()));
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => {
      cancelAnimationFrame(raf);
      clearInterval(id);
    };
  }, []);

  // ⌘K + ⌘R global handlers
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      const lower = e.key.toLowerCase();
      if (meta && lower === 'k') {
        e.preventDefault();
        setCmdOpen((o) => !o);
      } else if (meta && lower === 'r') {
        const target = document.activeElement as HTMLElement | null;
        const isTypingTarget =
          !!target &&
          (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable);
        e.preventDefault();
        if (!isTypingTarget) setReflectOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Auto-dismiss error toast.
  useEffect(() => {
    if (!store.toast) return;
    const id = setTimeout(() => store.clearToast(), 4000);
    return () => clearTimeout(id);
  }, [store.toast, store.clearToast]);

  // Derive the live activity feed. An empty array is the correct "no activity
  // today" state — the ActivityFeed component already renders the empty UI.
  // We do NOT fall back to fixtures: that leaked fake rows ("+ Generated
  // $2,000 · Annual contract · Vega") to real users with no real entries.
  const activity = useMemo(() => {
    return deriveActivity({
      focus: focusData?.recentSessions,
      financial: financialData?.recentEntries,
      optimistic: store.activity,
      limit: 25,
    });
  }, [focusData, financialData, store.activity]);

  // Derive chips.
  const chips = useMemo(() => {
    const streak = consecutiveStreak(weeklyTrackerData);
    const cashMoM =
      monarchData && monarchData.previousMonthIncome && monarchData.previousMonthIncome > 0
        ? ((monarchData.monthlyIncome - monarchData.previousMonthIncome) /
            monarchData.previousMonthIncome) *
          100
        : null;
    return deriveChips({
      streakDays: streak,
      monarchSyncedAt: monarchData?.lastSynced ?? null,
      cashMoMPct: cashMoM,
      deepWorkPace: 'flat',
    });
  }, [weeklyTrackerData, monarchData]);

  return (
    <>
    {/* Mobile layout — hidden at md+ */}
    <div className="md:hidden">
      <MobileLayout
        metrics={store.metrics}
        activity={activity}
        tab={tab}
        onTab={setTab}
        onOpenReflection={() => setReflectOpen(true)}
        onLog={store.log}
      />
    </div>

    {/* Desktop layout — hidden below md */}
    <div
      className="mc-root relative hidden md:flex min-h-screen flex-col overflow-hidden"
      style={{
        background: 'var(--color-mc-bg)',
        color: 'var(--color-mc-fg)',
        fontFamily: 'var(--font-mc-sans)',
        fontSize: 13,
      }}
      data-testid="desktop-layout"
    >
      <Aurora />

      <header
        className="relative flex items-center gap-3.5"
        style={{
          padding: '12px 20px',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          background: 'rgba(14,12,20,0.6)',
          backdropFilter: 'blur(24px)',
        }}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="flex items-center justify-center rounded-lg"
            style={{
              width: 28,
              height: 28,
              background: 'var(--color-mc-uv)',
              boxShadow: '0 0 18px rgba(124,124,255,0.55)',
            }}
          >
            <OrbitStar size={16} color="#fff" />
          </div>
          <span
            style={{
              fontWeight: 600,
              fontSize: 14,
              letterSpacing: '-0.01em',
              color: 'var(--color-mc-ink)',
            }}
          >
            Mission Control
          </span>
        </div>
        <span
          className="font-numerics hidden md:inline"
          style={{
            color: 'var(--color-mc-fg-muted)',
            fontSize: 11,
            letterSpacing: '0.06em',
          }}
          suppressHydrationWarning
        >
          {now ? fmtHeaderDate(now) : ''}
        </span>

        <nav className="ml-4 flex items-center gap-1" aria-label="Sections">
          {(['overview', 'insights', 'review'] as const).map((t) => {
            const active = tab === t;
            return (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className="rounded-md capitalize"
                style={{
                  padding: '5px 12px',
                  fontSize: 12,
                  fontWeight: 500,
                  background: active ? 'rgba(124,124,255,0.14)' : 'transparent',
                  color: active ? 'var(--color-mc-uv-hi)' : 'var(--color-mc-fg-dim)',
                  border: active
                    ? '1px solid rgba(124,124,255,0.33)'
                    : '1px solid transparent',
                  cursor: 'pointer',
                  font: 'inherit',
                }}
                data-testid={`tab-${t}`}
                aria-pressed={active}
              >
                {t}
              </button>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setCmdOpen(true)}
            className="hidden sm:flex items-center gap-2 rounded-lg cursor-pointer"
            style={{
              padding: '5px 10px',
              border: '1px solid rgba(255,255,255,0.08)',
              background: 'rgba(255,255,255,0.04)',
              color: 'var(--color-mc-fg-dim)',
              fontSize: 12,
              minWidth: 240,
              font: 'inherit',
            }}
            data-testid="cmdk-trigger"
            aria-label="Open command palette"
          >
            <Search size={14} aria-hidden />
            <span className="flex-1 text-left">Log, jump, find…</span>
            <span
              className="font-numerics"
              style={{
                fontSize: 10,
                padding: '1px 5px',
                background: 'rgba(255,255,255,0.07)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 3,
                color: 'var(--color-mc-fg-dim)',
              }}
            >
              ⌘K
            </span>
          </button>
          <button
            type="button"
            onClick={() => setCmdOpen(true)}
            className="flex items-center gap-1.5 rounded-lg cursor-pointer"
            style={{
              padding: '6px 14px',
              background: 'var(--color-mc-uv)',
              color: '#fff',
              border: 'none',
              fontSize: 12,
              fontWeight: 500,
              font: 'inherit',
              boxShadow: '0 4px 14px rgba(124,124,255,0.33)',
            }}
            data-testid="log-button"
          >
            <Plus size={12} aria-hidden /> Log
          </button>
          <Link
            href="/dashboard"
            className="rounded-md text-[11px]"
            style={{
              padding: '5px 10px',
              border: '1px solid rgba(255,255,255,0.08)',
              color: 'var(--color-mc-fg-dim)',
            }}
          >
            ← Old dashboard
          </Link>
        </div>
      </header>

      <div
        className="relative flex flex-1 flex-col gap-3.5 overflow-auto"
        style={{ padding: '16px 20px' }}
      >
        <ChipStrip chips={chips} />

        <div className="grid gap-2.5 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
          <MetricCard metric={store.metrics.cash}       onLog={store.log} />
          <MetricCard metric={store.metrics.netWorth}   onLog={store.log} />
          <MetricCard metric={store.metrics.temporal}   onLog={store.log} />
          <MetricCard metric={store.metrics.pipeline}   onLog={store.log} />
          <MetricCard metric={store.metrics.deepWork}   onLog={store.log} />
          <MetricCard metric={store.metrics.moneyMoved} onLog={store.log} />
        </div>

        {tab === 'overview' && (
        <div className="grid flex-1 gap-3.5 lg:grid-cols-[1fr_320px] min-h-0">
          <div className="flex flex-col gap-2.5 min-h-0">
            <CollapsiblePanel
              title="Three to Thrive"
              count={
                store.threeToThrive?.todaysEntry
                  ? `${store.threeToThrive.todaysEntry.answers.filter((a) => a.answer.trim()).length} / ${store.threeToThrive.todaysEntry.questions.length}`
                  : '0 / 3'
              }
              defaultOpen
              accent={
                <span
                  className="font-numerics"
                  style={{
                    marginLeft: 6,
                    padding: '1px 8px',
                    background: 'rgba(255,180,84,0.14)',
                    color: 'var(--color-mc-amber)',
                    fontSize: 10,
                    letterSpacing: '0.06em',
                    borderRadius: 999,
                    border: '1px solid rgba(255,180,84,0.25)',
                  }}
                >
                  DAILY
                </span>
              }
              action={
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setReflectOpen(true);
                  }}
                  className="rounded-md"
                  style={{
                    padding: '4px 10px',
                    fontSize: 11,
                    fontWeight: 500,
                    background: 'rgba(124,124,255,0.14)',
                    color: 'var(--color-mc-uv-hi)',
                    border: '1px solid rgba(124,124,255,0.33)',
                    cursor: 'pointer',
                    font: 'inherit',
                  }}
                  data-testid="open-reflection"
                >
                  Open
                </button>
              }
            >
              <T3TPanelInline
                questions={store.threeToThrive?.todaysEntry?.questions ?? []}
                answers={store.threeToThrive?.todaysEntry?.answers ?? []}
                onSave={store.saveThreeToThriveAnswer}
              />
            </CollapsiblePanel>

            <CollapsiblePanel
              title="Trends · last 14 days"
              defaultOpen
              accent={
                <span
                  className="font-numerics"
                  style={{
                    marginLeft: 6,
                    padding: '1px 8px',
                    background: 'rgba(124,124,255,0.14)',
                    color: 'var(--color-mc-uv-hi)',
                    fontSize: 10,
                    letterSpacing: '0.06em',
                    borderRadius: 999,
                    border: '1px solid rgba(124,124,255,0.33)',
                  }}
                >
                  TRENDS
                </span>
              }
            >
              <TrendsPanel
                series={buildOverviewTrendSeries(
                  focusData?.dailyTrend,
                  { temporalWeekly: 5, deepWorkWeekly: 10, pipelineWeekly: 3 },
                )}
              />
            </CollapsiblePanel>
          </div>

          <ActivityFeed entries={activity} />
        </div>
        )}

        {tab === 'insights' && (
          <InsightsTab
            focusDailyTrend={focusData?.dailyTrend}
            financialDailyTrend={financialData?.dailyFinancialTrend}
          />
        )}

        {tab === 'review' && (
          <ReviewTab
            currentMonthReview={monthlyReviewData?.currentMonthReview ?? null}
            recentReviews={monthlyReviewData?.recentReviews ?? []}
            ratingsTrend={monthlyReviewData?.ratingsTrend ?? []}
          />
        )}

        {store.toast && (
          <div
            role="alert"
            className="fixed bottom-6 left-1/2 z-30 -translate-x-1/2 rounded-lg"
            style={{
              padding: '10px 14px',
              fontSize: 12.5,
              color: '#fff',
              background: 'var(--color-mc-red)',
              border: '1px solid rgba(255,255,255,0.16)',
              boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
            }}
            data-testid="error-toast"
          >
            {store.toast.text}
          </div>
        )}
      </div>
    </div>

    {/* Modal overlays — Radix portals to document.body, shared by both layouts */}
    <CmdK
      open={cmdOpen}
      onOpenChange={setCmdOpen}
      onLog={store.log}
      onOpenReflection={() => setReflectOpen(true)}
      onSwitchTab={setTab}
    />

    <ReflectionDrawer
      open={reflectOpen}
      onOpenChange={setReflectOpen}
      data={store.threeToThrive}
      onSave={store.saveThreeToThriveAnswer}
    />
    </>
  );
}

// Compact 3-row T3T inside the collapsible panel — the same surface as the
// drawer but a single line per question. Updates the same store as the
// drawer so toggling between them is consistent.
function T3TPanelInline({
  questions,
  answers,
  onSave,
}: {
  questions: string[];
  answers: Array<{ question: string; answer: string }>;
  onSave: (date: string, question: string, answer: string) => Promise<void>;
}) {
  const initialMap = new Map<string, string>();
  answers.forEach((a) => initialMap.set(a.question, a.answer));

  if (questions.length === 0) {
    return (
      <div
        style={{
          padding: '14px 18px',
          fontSize: 12.5,
          color: 'var(--color-mc-fg-dim)',
        }}
      >
        Reflection prompts load with the day&apos;s entry.
      </div>
    );
  }

  return (
    <div>
      {questions.map((q, i) => (
        <T3TPanelRow
          key={q}
          index={i}
          question={q}
          initial={initialMap.get(q) ?? ''}
          onSave={onSave}
        />
      ))}
    </div>
  );
}

function T3TPanelRow({
  index,
  question,
  initial,
  onSave,
}: {
  index: number;
  question: string;
  initial: string;
  onSave: (date: string, question: string, answer: string) => Promise<void>;
}) {
  const [value, setValue] = useState(initial);
  const [timer, setTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  // Sync local draft when the server-supplied initial answer changes.
  // Deferred via rAF for the React 19 lint rule.
  useEffect(() => {
    const id = requestAnimationFrame(() => setValue(initial));
    return () => cancelAnimationFrame(id);
  }, [initial]);
  const done = !!value.trim();

  const onChange = (next: string) => {
    setValue(next);
    if (timer) clearTimeout(timer);
    const id = setTimeout(() => {
      const d = new Date();
      const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      void onSave(date, question, next).catch((err) =>
        console.error('T3T inline save failed', err),
      );
    }, 600);
    setTimer(id);
  };

  return (
    <div
      className="flex items-start gap-2.5"
      style={{
        padding: '10px 14px',
        borderTop: index ? '1px solid rgba(255,255,255,0.08)' : 'none',
      }}
    >
      <span
        className="flex items-center justify-center font-numerics"
        style={{
          width: 20,
          height: 20,
          borderRadius: '50%',
          background: done ? 'var(--color-mc-green)' : 'rgba(255,255,255,0.07)',
          color: done ? '#000' : 'var(--color-mc-fg-dim)',
          fontSize: 10,
          fontWeight: 600,
          flexShrink: 0,
          marginTop: 1,
        }}
        aria-hidden
      >
        {done ? '✓' : index + 1}
      </span>
      <div className="flex-1 min-w-0">
        <div
          style={{
            fontSize: 12.5,
            color: 'var(--color-mc-fg)',
            lineHeight: 1.45,
            marginBottom: 5,
          }}
        >
          {question}
        </div>
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Type your answer · auto-saves"
          rows={1}
          style={{
            width: '100%',
            resize: 'none',
            padding: '7px 9px',
            fontSize: 12,
            lineHeight: 1.5,
            fontFamily: 'inherit',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 6,
            background: 'var(--color-mc-bg-warm)',
            color: 'var(--color-mc-ink)',
            outline: 'none',
          }}
        />
      </div>
    </div>
  );
}
