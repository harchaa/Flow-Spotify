/**
 * The Flow feature mark: a calm stream (three flowing lines) with one spark —
 * steady sound carrying a little discovery. Used anywhere Flow surfaces so
 * the feature is recognizable at a glance.
 */
export default function FlowMark({ size = 40 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      aria-hidden="true"
      className="shrink-0"
    >
      <rect width="40" height="40" rx="12" fill="var(--accent)" />
      <path
        d="M8 15c3-2.5 6-2.5 9 0s6 2.5 9 0"
        fill="none"
        stroke="var(--accent-contrast)"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <path
        d="M8 21c3-2.5 6-2.5 9 0s6 2.5 9 0"
        fill="none"
        stroke="var(--accent-contrast)"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <path
        d="M8 27c3-2.5 6-2.5 9 0s6 2.5 9 0"
        fill="none"
        stroke="var(--accent-contrast)"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <circle cx="31.5" cy="12.5" r="2.6" fill="var(--accent-contrast)" />
    </svg>
  );
}
