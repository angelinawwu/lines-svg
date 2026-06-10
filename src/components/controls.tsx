"use client";

import { useId } from "react";

export function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-b border-white/8 px-4 py-4">
      <h3 className="mb-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40">
        {title}
      </h3>
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  );
}

export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  unit = "",
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (v: number) => void;
}) {
  const id = useId();
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between">
        <label htmlFor={id} className="text-xs text-white/70">
          {label}
        </label>
        <span className="font-mono text-[11px] text-white/50">
          {Number.isInteger(step) ? value : value.toFixed(2)}
          {unit}
        </span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="param-slider w-full"
      />
    </div>
  );
}

export function SegmentedControl<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div>
      <p className="mb-1 text-xs text-white/70">{label}</p>
      <div className="flex rounded-md border border-white/10 bg-black/30 p-0.5">
        {options.map((o) => (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            className={`flex-1 rounded px-2 py-1 text-[11px] transition-colors duration-200 ease ${
              o.value === value
                ? "bg-white/12 text-white"
                : "text-white/45 hover:text-white/80"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function Toggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!value)}
      className="flex items-center justify-between text-xs text-white/70"
    >
      <span>{label}</span>
      <span
        className={`relative h-4.5 w-8 rounded-full transition-colors duration-200 ease ${
          value ? "bg-[#1722f2]" : "bg-white/15"
        }`}
      >
        <span
          className="absolute top-0.5 h-3.5 w-3.5 rounded-full bg-white transition-transform duration-200"
          style={{
            transform: value ? "translateX(15px)" : "translateX(2px)",
            transitionTimingFunction: "cubic-bezier(.215,.61,.355,1)",
          }}
        />
      </span>
    </button>
  );
}

export function NumberInput({
  label,
  value,
  onChange,
  min = 1,
  max = 8000,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
}) {
  const id = useId();
  return (
    <div className="flex flex-1 flex-col">
      <label htmlFor={id} className="mb-1 text-xs text-white/70">
        {label}
      </label>
      <input
        id={id}
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (Number.isFinite(n)) onChange(Math.min(max, Math.max(min, n)));
        }}
        className="w-full rounded border border-white/12 bg-black/30 px-2 py-1.5 font-mono text-xs text-white/90 outline-none focus:border-white/35"
      />
    </div>
  );
}
