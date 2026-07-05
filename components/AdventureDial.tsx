"use client";

const LEVELS = [
  { value: 0, label: "Off", hint: "All familiar" },
  { value: 1, label: "Low", hint: "A couple of new tracks" },
  { value: 2, label: "Medium", hint: "A few new tracks" },
  { value: 3, label: "High", hint: "More discoveries" },
];

type Props = {
  value: number;
  onChange: (value: number) => void;
  idPrefix?: string;
};

/** The novelty dial: how much discovery to quietly dose into sessions. */
export default function AdventureDial({ value, onChange, idPrefix = "adv" }: Props) {
  return (
    <fieldset>
      <legend className="text-sm font-medium">Adventure</legend>
      <p className="mt-0.5 text-xs text-muted">
        {LEVELS.find((l) => l.value === value)?.hint}
      </p>
      <div role="radiogroup" aria-label="Adventure level" className="mt-2 flex gap-1.5">
        {LEVELS.map((level) => {
          const selected = level.value === value;
          return (
            <button
              key={level.value}
              type="button"
              role="radio"
              aria-checked={selected}
              id={`${idPrefix}-${level.value}`}
              onClick={() => onChange(level.value)}
              className={`min-h-11 flex-1 rounded-full border px-2 text-xs font-medium ${
                selected
                  ? "border-accent-text bg-accent-contrast text-accent-text"
                  : "border-white/15 text-muted"
              }`}
            >
              {level.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
