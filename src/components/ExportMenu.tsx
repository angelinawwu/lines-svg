"use client";

import { useEffect, useRef, useState } from "react";
import {
  copyImageBlob,
  copyText,
  downloadBlob,
  downloadSvg,
  rasterBlob,
  type RasterFormat,
} from "@/lib/export";

interface Props {
  getSvg: () => string;
  width: number;
  height: number;
  bgColor: string;
  transparentBg: boolean;
}

type Status = { msg: string; kind: "ok" | "err" } | null;

const FORMATS: { key: "svg" | RasterFormat; label: string; ext: string }[] = [
  { key: "svg", label: "SVG", ext: "svg" },
  { key: "png", label: "PNG", ext: "png" },
  { key: "jpeg", label: "JPG", ext: "jpg" },
  { key: "webp", label: "WebP", ext: "webp" },
];

export function ExportMenu({ getSvg, width, height, bgColor, transparentBg }: Props) {
  const [open, setOpen] = useState(false);
  const [scale, setScale] = useState(2);
  const [status, setStatus] = useState<Status>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [open]);

  useEffect(() => {
    if (!status) return;
    const t = setTimeout(() => setStatus(null), 2600);
    return () => clearTimeout(t);
  }, [status]);

  const run = async (key: string, fn: () => Promise<void>, okMsg: string) => {
    setBusy(key);
    try {
      await fn();
      setStatus({ msg: okMsg, kind: "ok" });
    } catch (e) {
      setStatus({ msg: e instanceof Error ? e.message : "Failed", kind: "err" });
    } finally {
      setBusy(null);
    }
  };

  const handleExport = (key: "svg" | RasterFormat, ext: string) =>
    run(
      `dl-${key}`,
      async () => {
        const svg = getSvg();
        if (key === "svg") {
          downloadSvg(svg, `lineart.${ext}`);
        } else {
          const blob = await rasterBlob(svg, width, height, scale, key, transparentBg ? undefined : bgColor);
          downloadBlob(blob, `lineart.${ext}`);
        }
      },
      `Exported .${ext}`
    );

  const handleCopy = (key: "svg" | RasterFormat) =>
    run(
      `cp-${key}`,
      async () => {
        const svg = getSvg();
        if (key === "svg") {
          await copyText(svg);
        } else {
          const blob = await rasterBlob(svg, width, height, scale, key, transparentBg ? undefined : bgColor);
          const result = await copyImageBlob(blob);
          if (result === "converted-png" && key !== "png") {
            setStatus({ msg: "Copied as PNG (browser limit)", kind: "ok" });
            return;
          }
        }
      },
      `Copied ${key.toUpperCase()}`
    );

  return (
    <div className="relative" ref={rootRef}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="rounded-md bg-[#1722f2] px-4 py-2 text-xs font-semibold tracking-wide text-white transition-colors duration-200 ease hover:bg-[#3540ff]"
      >
        Export
      </button>

      {open && (
        <div
          className="picker-pop absolute right-0 top-full z-50 mt-2 w-72 rounded-lg border border-white/12 bg-[#1a1a1c] p-3 shadow-2xl shadow-black/60"
          style={{ transformOrigin: "top right" }}
        >
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[10px] uppercase tracking-[0.16em] text-white/40">Raster scale</p>
            <div className="flex gap-1">
              {[1, 2, 4].map((s) => (
                <button
                  key={s}
                  onClick={() => setScale(s)}
                  className={`rounded px-2 py-0.5 font-mono text-[11px] transition-colors duration-200 ease ${
                    scale === s ? "bg-white/15 text-white" : "text-white/40 hover:text-white/80"
                  }`}
                >
                  {s}x
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1">
            {FORMATS.map((f) => (
              <div
                key={f.key}
                className="flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-white/[0.05]"
              >
                <span className="font-mono text-xs text-white/85">{f.label}</span>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => handleCopy(f.key)}
                    disabled={busy !== null}
                    className="rounded border border-white/12 px-2.5 py-1 text-[11px] text-white/70 transition-colors duration-200 ease hover:border-white/30 hover:text-white disabled:opacity-40"
                  >
                    {busy === `cp-${f.key}` ? "…" : "Copy"}
                  </button>
                  <button
                    onClick={() => handleExport(f.key, f.ext)}
                    disabled={busy !== null}
                    className="rounded border border-white/12 px-2.5 py-1 text-[11px] text-white/70 transition-colors duration-200 ease hover:border-white/30 hover:text-white disabled:opacity-40"
                  >
                    {busy === `dl-${f.key}` ? "…" : "Save"}
                  </button>
                </div>
              </div>
            ))}
          </div>

          <p className="mt-2 text-[10px] leading-relaxed text-white/30">
            SVG copies as markup text. Raster copies use the clipboard image API.
          </p>
        </div>
      )}

      {status && (
        <div
          className={`status-toast pointer-events-none fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-md px-4 py-2 font-mono text-xs shadow-xl ${
            status.kind === "ok"
              ? "bg-white text-black"
              : "bg-red-500 text-white"
          }`}
        >
          {status.msg}
        </div>
      )}
    </div>
  );
}
