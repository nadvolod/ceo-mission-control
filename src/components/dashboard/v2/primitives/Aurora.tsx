'use client';

// Page-level mood backdrop. Three soft radial gradients in UV/pink/cyan.
// Absolutely positioned, pointer-events:none — it sits behind everything.
export function Aurora({ intensity = 1 }: { intensity?: number }) {
  return (
    <div
      aria-hidden
      className="absolute inset-0 pointer-events-none"
      style={{
        opacity: 0.55 * intensity,
        background: `
          radial-gradient(60% 50% at 15% 0%, rgba(124,124,255,0.20) 0%, transparent 50%),
          radial-gradient(40% 30% at 90% 10%, rgba(255,122,216,0.10) 0%, transparent 60%),
          radial-gradient(50% 40% at 80% 95%, rgba(93,217,255,0.08) 0%, transparent 60%)
        `,
      }}
    />
  );
}
