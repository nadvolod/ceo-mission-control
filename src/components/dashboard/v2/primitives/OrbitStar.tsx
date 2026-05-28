'use client';

// Two crossed ellipses + a center dot, slowly rotating. The brand mark.
export function OrbitStar({
  size = 16,
  color = '#fff',
  spin = true,
}: {
  size?: number;
  color?: string;
  spin?: boolean;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={spin ? 'mc-orbit-spin' : ''}
      aria-hidden
    >
      <ellipse cx="12" cy="12" rx="10" ry="3" fill="none" stroke={color} strokeWidth={1.5} />
      <ellipse cx="12" cy="12" rx="3" ry="10" fill="none" stroke={color} strokeWidth={1.5} />
      <circle cx="12" cy="12" r="1.5" fill={color} />
    </svg>
  );
}
