/**
 * Marks a discovery. Icon + text (never color alone) per the colorblind rule.
 */
export default function NewBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-accent-contrast px-2 py-0.5 text-[11px] font-semibold text-accent-text">
      <svg viewBox="0 0 24 24" className="h-3 w-3" fill="currentColor" aria-hidden="true">
        <path d="M12 2l2.1 6.4L20.5 10l-6.4 2.1L12 18.5 9.9 12.1 3.5 10l6.4-1.6L12 2z" />
      </svg>
      New
    </span>
  );
}
