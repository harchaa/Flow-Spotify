export default function HomePage() {
  return (
    <div className="flex flex-col gap-6 px-4 pt-8">
      <header className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-accent font-bold text-accent-contrast"
        >
          F
        </span>
        <h1 className="text-2xl font-bold">Flow</h1>
      </header>

      <section className="rounded-xl bg-surface p-5">
        <h2 className="text-lg font-semibold">Focus without the loop</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Consistent sessions for deep work, with a few new tracks slipped in
          quietly — recapped when your attention is free.
        </p>
      </section>
    </div>
  );
}
