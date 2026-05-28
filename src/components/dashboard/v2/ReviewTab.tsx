'use client';

import { Sparkline } from './primitives/Sparkline';
import { MC_COLORS } from './palette';
import type { MonthlyReview, MonthlyReviewRatings } from '@/lib/types';

type RatingsTrendEntry = MonthlyReviewRatings & { month: string };

type Props = {
  currentMonthReview: MonthlyReview | null;
  recentReviews: MonthlyReview[];
  ratingsTrend: RatingsTrendEntry[];
};

// Review body. Renders the current-month status, a 5-rating trend strip,
// and a compact list of recent monthly reviews. Read-only — full review
// editing stays in /dashboard for now (calls back to the same data).

export function ReviewTab({ currentMonthReview, recentReviews, ratingsTrend }: Props) {
  const noData = !currentMonthReview && recentReviews.length === 0 && ratingsTrend.length === 0;
  if (noData) {
    return (
      <div
        className="rounded-xl"
        style={{
          padding: '24px 22px',
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          backdropFilter: 'blur(20px)',
          fontSize: 13,
          color: 'var(--color-mc-fg-dim)',
        }}
        data-testid="review-tab-empty"
      >
        No monthly reviews yet. Submit one from the legacy dashboard — it&apos;ll surface here.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4" data-testid="review-tab">
      <CurrentMonthCard review={currentMonthReview} />
      <RatingsTrend trend={ratingsTrend} />
      <RecentReviewsList reviews={recentReviews} />
    </div>
  );
}

// ----- Current-month card -----------------------------------------------

function CurrentMonthCard({ review }: { review: MonthlyReview | null }) {
  return (
    <div
      className="rounded-xl"
      style={{
        padding: 18,
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
        backdropFilter: 'blur(20px)',
      }}
      data-testid="review-current-month"
    >
      <div className="flex items-baseline justify-between">
        <span
          className="font-numerics uppercase"
          style={{ fontSize: 10, letterSpacing: '0.1em', color: 'var(--color-mc-fg-dim)' }}
        >
          Current month
        </span>
        {review && (
          <span
            className="font-numerics"
            style={{ fontSize: 10, color: 'var(--color-mc-fg-muted)', letterSpacing: '0.06em' }}
          >
            {review.month}
          </span>
        )}
      </div>
      {review ? (
        <div style={{ marginTop: 10, display: 'grid', gap: 8 }}>
          <Metric label="Hours worked"   value={`${review.hoursWorked}h`} />
          <Metric label="Temporal hours" value={`${review.temporalHours}h`} />
          <Metric label="Lesson"         value={review.monthLesson || '—'} multiline />
          <Metric
            label="One thing to fix"
            value={review.oneThingToFix || '—'}
            multiline
            accent={MC_COLORS.amber}
          />
        </div>
      ) : (
        <div
          style={{
            marginTop: 10,
            fontSize: 13,
            color: 'var(--color-mc-fg-dim)',
            lineHeight: 1.5,
          }}
        >
          No review for the current month yet.
        </div>
      )}
    </div>
  );
}

function Metric({
  label,
  value,
  multiline,
  accent,
}: {
  label: string;
  value: string;
  multiline?: boolean;
  accent?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span
        className="font-numerics uppercase"
        style={{ fontSize: 10, letterSpacing: '0.08em', color: 'var(--color-mc-fg-muted)' }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: multiline ? 13 : 14,
          color: accent ?? 'var(--color-mc-ink)',
          lineHeight: 1.45,
          fontWeight: multiline ? 400 : 500,
          fontFamily: multiline ? 'var(--font-mc-serif)' : 'var(--font-mc-sans)',
        }}
      >
        {value}
      </span>
    </div>
  );
}

// ----- Ratings trend -----------------------------------------------------

const RATING_KEYS: Array<{ key: keyof MonthlyReviewRatings; label: string; color: string }> = [
  { key: 'discipline', label: 'DISCIPLINE', color: MC_COLORS.uv },
  { key: 'focus',      label: 'FOCUS',      color: MC_COLORS.pink },
  { key: 'nutrition',  label: 'NUTRITION',  color: MC_COLORS.green },
  { key: 'fitness',    label: 'FITNESS',    color: MC_COLORS.amber },
  { key: 'sleep',      label: 'SLEEP',      color: MC_COLORS.cyan },
];

function RatingsTrend({ trend }: { trend: RatingsTrendEntry[] }) {
  if (trend.length === 0) return null;
  return (
    <div
      className="rounded-xl"
      style={{
        padding: 18,
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
        backdropFilter: 'blur(20px)',
      }}
      data-testid="review-ratings-trend"
    >
      <div
        className="font-numerics uppercase"
        style={{
          fontSize: 10,
          letterSpacing: '0.1em',
          color: 'var(--color-mc-fg-dim)',
          marginBottom: 14,
        }}
      >
        Ratings trend ({trend.length} {trend.length === 1 ? 'month' : 'months'})
      </div>
      {/*
        Each rating gets its own card with the label and value stacked
        vertically. Old layout was label-left / value-far-right inside a
        wide column, which visually disconnected the two. The big colored
        N/10 numeral now sits right under the label so the association is
        unambiguous; the sparkline runs full-width below.

        Min column width is 140px so the 140px-wide Sparkline doesn't clip
        when the grid fits multiple columns at narrow viewports.
      */}
      <div
        className="grid gap-2.5"
        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}
      >
        {RATING_KEYS.map(({ key, label, color }) => {
          const data = trend.map((t) => t[key]);
          const latest = data[data.length - 1];
          return (
            <div
              key={key}
              className="flex flex-col gap-2 rounded-lg overflow-hidden"
              style={{
                padding: '12px 14px',
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.06)',
              }}
              data-testid={`rating-${key}`}
            >
              <span
                className="font-numerics uppercase"
                style={{
                  fontSize: 10,
                  letterSpacing: '0.08em',
                  // fg-dim (not fg-muted) so the label pops on the dark surface.
                  color: 'var(--color-mc-fg-dim)',
                }}
              >
                {label}
              </span>
              <span className="font-numerics" style={{ fontSize: 22, color, lineHeight: 1 }}>
                {latest}
                <span style={{ fontSize: 12, color: 'var(--color-mc-fg-muted)', marginLeft: 2 }}>
                  /10
                </span>
              </span>
              {/* Sparkline uses preserveAspectRatio='none' so the fixed
                  140-wide viewBox stretches/shrinks to the available cell
                  width. width:100% in CSS overrides the SVG width attr. */}
              <div style={{ width: '100%' }}>
                <Sparkline
                  data={data}
                  color={color}
                  fill={color}
                  height={24}
                  width={140}
                  strokeWidth={1.5}
                  dots
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ----- Recent reviews ---------------------------------------------------

function RecentReviewsList({ reviews }: { reviews: MonthlyReview[] }) {
  if (reviews.length === 0) return null;
  return (
    <div
      className="overflow-hidden rounded-xl"
      style={{
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
        backdropFilter: 'blur(20px)',
      }}
      data-testid="review-recent"
    >
      <div
        className="font-numerics uppercase"
        style={{
          padding: '14px 18px',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          fontSize: 10,
          letterSpacing: '0.1em',
          color: 'var(--color-mc-fg-dim)',
        }}
      >
        Recent reviews
      </div>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {reviews.slice(0, 6).map((r) => (
          <li
            key={r.id}
            style={{
              padding: '12px 18px',
              borderTop: '1px solid rgba(255,255,255,0.06)',
              display: 'flex',
              alignItems: 'baseline',
              gap: 14,
            }}
          >
            <span
              className="font-numerics"
              style={{ fontSize: 11, color: 'var(--color-mc-fg-muted)', minWidth: 56 }}
            >
              {r.month}
            </span>
            <span
              style={{
                flex: 1,
                fontSize: 12.5,
                color: 'var(--color-mc-ink)',
                lineHeight: 1.4,
                fontFamily: 'var(--font-mc-serif)',
              }}
            >
              {r.monthLesson || r.oneThingToFix || '—'}
            </span>
            <span
              className="font-numerics"
              style={{ fontSize: 10, color: 'var(--color-mc-fg-muted)', letterSpacing: '0.06em' }}
            >
              {r.hoursWorked}h · {r.temporalHours}h temp
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
