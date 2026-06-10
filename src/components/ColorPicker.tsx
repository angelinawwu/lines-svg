"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  CURATED_SWATCHES,
  contrastRatio,
  harmonies,
  hexToHsv,
  hsvToHex,
  type HSV,
} from "@/lib/color";

interface EyeDropperResult {
  sRGBHex: string;
}
interface EyeDropperCtor {
  new (): { open(): Promise<EyeDropperResult> };
}

interface Props {
  label: string;
  value: string;
  onChange: (hex: string) => void;
  /** the opposing color, used for contrast feedback */
  pairedWith?: string;
}

export function ColorPicker({ label, value, onChange, pairedWith }: Props) {
  const [open, setOpen] = useState(false);
  const [hsv, setHsv] = useState<HSV>(() => hexToHsv(value) ?? { h: 0, s: 0, v: 0 });
  const [hexInput, setHexInput] = useState(value);
  const [recent, setRecent] = useState<string[]>([]);
  const rootRef = useRef<HTMLDivElement>(null);
  const areaRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef<"area" | "hue" | null>(null);

  useEffect(() => {
    setHexInput(value);
    const parsed = hexToHsv(value);
    if (parsed && hsvToHex(parsed) !== hsvToHex(hsv)) setHsv(parsed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const commit = useCallback(
    (hex: string) => {
      onChange(hex);
      setRecent((r) => [hex, ...r.filter((c) => c !== hex)].slice(0, 8));
    },
    [onChange]
  );

  const updateFromHsv = useCallback(
    (next: HSV) => {
      setHsv(next);
      const hex = hsvToHex(next);
      setHexInput(hex);
      onChange(hex);
    },
    [onChange]
  );

  const handleArea = useCallback(
    (e: { clientX: number; clientY: number }) => {
      const el = areaRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const s = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
      const v = 1 - Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
      setHsv((prev) => {
        const next = { ...prev, s, v };
        const hex = hsvToHex(next);
        setHexInput(hex);
        onChange(hex);
        return next;
      });
    },
    [onChange]
  );

  useEffect(() => {
    const move = (e: MouseEvent) => {
      if (draggingRef.current === "area") handleArea(e);
    };
    const up = () => {
      if (draggingRef.current) {
        draggingRef.current = null;
        setRecent((r) => [value, ...r.filter((c) => c !== value)].slice(0, 8));
      }
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
  }, [handleArea, value]);

  const pickEyedropper = async () => {
    const ED = (window as unknown as { EyeDropper?: EyeDropperCtor }).EyeDropper;
    if (!ED) return;
    try {
      const result = await new ED().open();
      commit(result.sRGBHex);
    } catch {
      /* cancelled */
    }
  };

  const ratio = pairedWith ? contrastRatio(value, pairedWith) : null;
  const hueHex = hsvToHex({ h: hsv.h, s: 1, v: 1 });
  const suggestions = harmonies(value);

  return (
    <div className="relative" ref={rootRef}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2.5 rounded-md border border-white/10 bg-white/[0.04] px-2.5 py-2 text-left transition-colors duration-200 ease hover:border-white/25"
      >
        <span
          className="h-6 w-6 shrink-0 rounded border border-white/20"
          style={{ background: value }}
        />
        <span className="flex min-w-0 flex-col">
          <span className="text-[10px] uppercase tracking-[0.14em] text-white/45">{label}</span>
          <span className="font-mono text-xs text-white/90">{value.toUpperCase()}</span>
        </span>
        {ratio !== null && (
          <span
            className={`ml-auto font-mono text-[10px] ${ratio < 2 ? "text-amber-400" : "text-white/35"}`}
            title="Contrast ratio vs paired color"
          >
            {ratio.toFixed(1)}:1
          </span>
        )}
      </button>

      {open && (
        <div
          className="picker-pop absolute left-0 top-full z-50 mt-2 w-64 rounded-lg border border-white/12 bg-[#1a1a1c] p-3 shadow-2xl shadow-black/60"
          style={{ transformOrigin: "top left" }}
        >
          <div
            ref={areaRef}
            className="relative h-36 w-full cursor-crosshair rounded-md"
            style={{
              background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, ${hueHex})`,
            }}
            onMouseDown={(e) => {
              draggingRef.current = "area";
              handleArea(e);
            }}
          >
            <span
              className="pointer-events-none absolute h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow"
              style={{
                left: `${hsv.s * 100}%`,
                top: `${(1 - hsv.v) * 100}%`,
                background: value,
              }}
            />
          </div>

          <input
            type="range"
            min={0}
            max={360}
            value={hsv.h}
            onChange={(e) => updateFromHsv({ ...hsv, h: Number(e.target.value) })}
            className="hue-slider mt-3 w-full"
          />

          <div className="mt-3 flex items-center gap-2">
            <input
              value={hexInput}
              onChange={(e) => {
                setHexInput(e.target.value);
                const parsed = hexToHsv(e.target.value);
                if (parsed) {
                  setHsv(parsed);
                  onChange(
                    e.target.value.startsWith("#") ? e.target.value : `#${e.target.value}`
                  );
                }
              }}
              spellCheck={false}
              className="w-full rounded border border-white/12 bg-black/30 px-2 py-1.5 font-mono text-xs text-white/90 outline-none focus:border-white/35"
            />
            <button
              onClick={pickEyedropper}
              title="Pick from screen"
              className="shrink-0 rounded border border-white/12 px-2 py-1.5 text-xs text-white/70 transition-colors duration-200 ease hover:border-white/30 hover:text-white"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="m2 22 1-1h3l9-9M3 21v-3l9-9" />
                <path d="m15 6 3.4-3.4a2.1 2.1 0 1 1 3 3L18 9l.4.4a2.1 2.1 0 1 1-3 3l-3.8-3.8a2.1 2.1 0 1 1 3-3l.4.4Z" />
              </svg>
            </button>
          </div>

          <div className="mt-3">
            <p className="mb-1.5 text-[9px] uppercase tracking-[0.16em] text-white/35">Swatches</p>
            <div className="flex flex-wrap gap-1.5">
              {CURATED_SWATCHES.map((c) => (
                <SwatchBtn key={c} color={c} active={c === value} onPick={commit} />
              ))}
            </div>
          </div>

          {suggestions.length > 0 && (
            <div className="mt-3">
              <p className="mb-1.5 text-[9px] uppercase tracking-[0.16em] text-white/35">
                Harmonies
              </p>
              <div className="flex flex-wrap gap-1.5">
                {suggestions.map((c) => (
                  <SwatchBtn key={c} color={c} active={false} onPick={commit} />
                ))}
              </div>
            </div>
          )}

          {recent.length > 0 && (
            <div className="mt-3">
              <p className="mb-1.5 text-[9px] uppercase tracking-[0.16em] text-white/35">Recent</p>
              <div className="flex flex-wrap gap-1.5">
                {recent.map((c) => (
                  <SwatchBtn key={c} color={c} active={c === value} onPick={commit} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SwatchBtn({
  color,
  active,
  onPick,
}: {
  color: string;
  active: boolean;
  onPick: (c: string) => void;
}) {
  return (
    <button
      onClick={() => onPick(color)}
      title={color}
      className={`h-5 w-5 rounded border transition-transform duration-200 ease hover:scale-110 ${
        active ? "border-white" : "border-white/20"
      }`}
      style={{ background: color }}
    />
  );
}
