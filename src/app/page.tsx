"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DEFAULT_PARAMS,
  buildSvg,
  generatePaths,
  rasterizeSource,
  type DensityMap,
  type RenderParams,
  type StepStyle,
} from "@/lib/engine";
import { PRESETS, SAMPLES } from "@/lib/presets";
import { ColorPicker } from "@/components/ColorPicker";
import { ExportMenu } from "@/components/ExportMenu";
import {
  NumberInput,
  Section,
  SegmentedControl,
  Slider,
  Toggle,
} from "@/components/controls";

interface Source {
  data: string; // svg string or data-url
  isSvg: boolean;
  name: string;
}

export default function Home() {
  const [params, setParams] = useState<RenderParams>(DEFAULT_PARAMS);
  const [source, setSource] = useState<Source>({
    data: SAMPLES[1].svg,
    isSvg: true,
    name: SAMPLES[1].name,
  });
  const [density, setDensity] = useState<DensityMap | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [activePreset, setActivePreset] = useState<string | null>("Klein Waves");
  const fileRef = useRef<HTMLInputElement>(null);

  const set = useCallback(<K extends keyof RenderParams>(key: K, value: RenderParams[K]) => {
    setParams((p) => ({ ...p, [key]: value }));
  }, []);

  // initialize with the first preset
  useEffect(() => {
    setParams((p) => ({ ...p, ...PRESETS[0].params }));
  }, []);

  // Rasterize source -> density map (debounced for blur scrubbing)
  useEffect(() => {
    let cancelled = false;
    const artW = params.width - params.margin * 2;
    const artH = params.height - params.margin * 2;
    const t = setTimeout(() => {
      rasterizeSource(source.data, source.isSvg, artW, artH, params.blur, params.sourceMode)
        .then((map) => {
          if (!cancelled) setDensity(map);
        })
        .catch(() => {});
    }, 30);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [source, params.blur, params.sourceMode, params.width, params.height, params.margin]);

  const paths = useMemo(
    () => (density ? generatePaths(density, params) : []),
    [density, params]
  );

  const getSvg = useCallback(() => buildSvg(paths, params), [paths, params]);

  const loadFile = useCallback((file: File) => {
    if (file.type === "image/svg+xml" || file.name.endsWith(".svg")) {
      file.text().then((text) => {
        setSource({ data: text, isSvg: true, name: file.name });
        set("sourceMode", "alpha");
      });
    } else if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = () => {
        setSource({ data: reader.result as string, isSvg: false, name: file.name });
        set("sourceMode", "luminance");
      };
      reader.readAsDataURL(file);
    }
  }, [set]);

  // Global paste: accept SVG markup or image files
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith("image/")) {
          const f = item.getAsFile();
          if (f) loadFile(f);
          return;
        }
      }
      const text = e.clipboardData?.getData("text/plain")?.trim();
      if (text && text.startsWith("<svg")) {
        setSource({ data: text, isSvg: true, name: "Pasted SVG" });
        set("sourceMode", "alpha");
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [loadFile, set]);

  const applyPreset = (name: string) => {
    const preset = PRESETS.find((p) => p.name === name);
    if (!preset) return;
    setActivePreset(name);
    setParams((p) => ({ ...p, ...preset.params }));
  };

  const swapColors = () =>
    setParams((p) => ({ ...p, lineColor: p.bgColor, bgColor: p.lineColor }));

  return (
    <div
      className="flex h-screen flex-col overflow-hidden bg-[#0e0e10] text-white"
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const f = e.dataTransfer.files?.[0];
        if (f) loadFile(f);
      }}
    >
      {/* Top bar */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-white/8 px-5">
        <div className="flex items-baseline gap-3">
          <h1 className="font-display text-lg font-bold uppercase tracking-[0.22em]">
            Lineform
          </h1>
          <span className="font-mono text-[10px] text-white/30">
            svg → variable-weight lines
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden font-mono text-[11px] text-white/35 sm:block">
            {source.name} · {paths.length} paths
          </span>
          <ExportMenu
            getSvg={getSvg}
            width={params.width}
            height={params.height}
            bgColor={params.bgColor}
            transparentBg={params.transparentBg}
          />
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col md:flex-row overflow-hidden">
        {/* Preview */}
        <main className="preview-grid relative flex min-w-0 shrink-0 items-center justify-center overflow-hidden p-6 h-[40vh] md:h-auto md:flex-1">
          <div
            className="relative max-h-full max-w-full shadow-2xl shadow-black/50"
            style={{ aspectRatio: `${params.width} / ${params.height}` }}
          >
            <svg
              width={params.width}
              height={params.height}
              viewBox={`0 0 ${params.width} ${params.height}`}
              className="block h-auto max-h-full w-auto max-w-full"
              style={{ background: params.transparentBg ? "transparent" : params.bgColor }}
            >
              {params.transparentBg && (
                <pattern id="checker" width="24" height="24" patternUnits="userSpaceOnUse">
                  <rect width="24" height="24" fill="#2a2a2e" />
                  <rect width="12" height="12" fill="#222226" />
                  <rect x="12" y="12" width="12" height="12" fill="#222226" />
                </pattern>
              )}
              {params.transparentBg && (
                <rect width={params.width} height={params.height} fill="url(#checker)" />
              )}
              <g
                fill={params.lineColor}
                transform={params.skewX !== 0 || params.skewY !== 0 ? `skewX(${params.skewX}) skewY(${params.skewY})` : undefined}
              >
                {paths.map((d, i) => (
                  <path key={i} d={d} />
                ))}
              </g>
            </svg>
          </div>

          {dragOver && (
            <div className="absolute inset-0 z-40 flex items-center justify-center bg-[#1722f2]/20 backdrop-blur-sm">
              <p className="rounded-lg border-2 border-dashed border-white/60 px-8 py-5 font-display text-sm uppercase tracking-[0.2em]">
                Drop SVG or image
              </p>
            </div>
          )}
        </main>

        {/* Sidebar */}
        <aside className="flex w-full min-h-0 flex-1 shrink-0 flex-col overflow-y-auto border-t border-white/8 bg-[#121214] md:w-72 md:flex-none md:border-l md:border-t-0">
          <Section title="Source">
            <div className="flex gap-2">
              <button
                onClick={() => fileRef.current?.click()}
                className="flex-1 rounded-md border border-dashed border-white/20 px-3 py-2.5 text-xs text-white/70 transition-colors duration-200 ease hover:border-white/45 hover:text-white"
              >
                Upload SVG / image
              </button>
              <input
                ref={fileRef}
                type="file"
                accept=".svg,image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) loadFile(f);
                  e.target.value = "";
                }}
              />
            </div>
            <p className="text-[10px] leading-relaxed text-white/30">
              Or drag &amp; drop anywhere, or paste SVG markup / an image.
            </p>
            <div className="grid grid-cols-3 gap-1.5">
              {SAMPLES.map((s) => (
                <button
                  key={s.name}
                  onClick={() => setSource({ data: s.svg, isSvg: true, name: s.name })}
                  className={`rounded border px-1 py-1.5 text-[10px] transition-colors duration-200 ease ${
                    source.name === s.name
                      ? "border-white/50 text-white"
                      : "border-white/10 text-white/50 hover:border-white/30 hover:text-white/85"
                  }`}
                >
                  {s.name}
                </button>
              ))}
            </div>
          </Section>

          <Section title="Presets">
            <div className="grid grid-cols-2 gap-1.5">
              {PRESETS.map((p) => (
                <button
                  key={p.name}
                  onClick={() => applyPreset(p.name)}
                  title={p.desc}
                  className={`rounded-md border px-2 py-2 text-left transition-colors duration-200 ease ${
                    activePreset === p.name
                      ? "border-[#3540ff] bg-[#1722f2]/15"
                      : "border-white/10 hover:border-white/30"
                  }`}
                >
                  <span className="block text-[11px] font-medium text-white/90">{p.name}</span>
                  <span className="block text-[9px] text-white/40">{p.desc}</span>
                </button>
              ))}
            </div>
          </Section>

          <Section title="Lines">
            <Slider label="Spacing" value={params.spacing} min={4} max={120} unit="px" onChange={(v) => set("spacing", v)} />
            <Slider label="Direction" value={params.angle} min={-90} max={90} unit="°" onChange={(v) => set("angle", v)} />
            <Slider label="Min weight" value={params.minWeight} min={0} max={60} step={0.5} unit="px" onChange={(v) => set("minWeight", v)} />
            <Slider label="Max weight" value={params.maxWeight} min={0.5} max={120} step={0.5} unit="px" onChange={(v) => set("maxWeight", v)} />
            <Slider label="Smoothing" value={params.smoothing} min={0} max={80} unit="px" onChange={(v) => set("smoothing", v)} />
            <SegmentedControl
              label="Style"
              value={params.lineStyle}
              options={[
                { value: "smooth", label: "Smooth" },
                { value: "sharp", label: "Sharp" },
                { value: "bars", label: "Bars" },
              ]}
              onChange={(v) => set("lineStyle", v)}
            />
            {params.lineStyle === "bars" && (
              <>
                <Slider label="Bar length" value={params.dashLength} min={2} max={140} unit="px" onChange={(v) => set("dashLength", v)} />
                <Slider label="Bar gap" value={params.dashGap} min={0} max={80} unit="px" onChange={(v) => set("dashGap", v)} />
              </>
            )}
            <Slider
              label="Thickness steps"
              value={params.stepCount}
              min={0}
              max={12}
              step={1}
              onChange={(v) => set("stepCount", v)}
            />
            {params.stepCount >= 2 && (
              <SegmentedControl
                label="Step corners"
                value={params.stepStyle}
                options={[
                  { value: "sharp" as StepStyle, label: "Sharp" },
                  { value: "round" as StepStyle, label: "Round" },
                ]}
                onChange={(v) => set("stepStyle", v)}
              />
            )}
          </Section>

          <Section title="Tone">
            <Slider label="Contrast" value={params.contrast} min={0.2} max={5} step={0.05} onChange={(v) => set("contrast", v)} />
            <Slider label="Brightness" value={params.brightness} min={-0.8} max={0.8} step={0.02} onChange={(v) => set("brightness", v)} />
            <Slider label="Feather (blur)" value={params.blur} min={0} max={60} unit="px" onChange={(v) => set("blur", v)} />
            <SegmentedControl
              label="Read source as"
              value={params.sourceMode}
              options={[
                { value: "luminance", label: "Luminance" },
                { value: "alpha", label: "Alpha" },
              ]}
              onChange={(v) => set("sourceMode", v)}
            />
            {params.sourceMode === "alpha" && (
              <Slider
                label="Falloff"
                value={params.alphaFalloff}
                min={0}
                max={1}
                step={0.01}
                onChange={(v) => set("alphaFalloff", v)}
              />
            )}
            <Toggle label="Invert" value={params.invert} onChange={(v) => set("invert", v)} />
            <Toggle
              label="Clip to shape"
              value={params.clipToShape}
              onChange={(v) => set("clipToShape", v)}
            />
            {params.clipToShape && (
              <p className="text-[10px] leading-relaxed text-white/35">
                Lines are clipped to the source silhouette (alpha channel). Use{" "}
                <span className="text-white/55">Alpha</span> mode above for solid logos.
                Increase <span className="text-white/55">Feather</span> to taper edges.
              </p>
            )}
          </Section>

          <Section title="Distortion">
            <Slider label="Wave amplitude" value={params.waveAmplitude} min={0} max={80} unit="px" onChange={(v) => set("waveAmplitude", v)} />
            <Slider label="Wave frequency" value={params.waveFrequency} min={0.2} max={10} step={0.1} onChange={(v) => set("waveFrequency", v)} />
            <Slider label="Phase shift" value={params.wavePhase} min={0} max={0.5} step={0.01} onChange={(v) => set("wavePhase", v)} />
            <Slider label="Skew X" value={params.skewX} min={-45} max={45} unit="°" onChange={(v) => set("skewX", v)} />
            <Slider label="Skew Y" value={params.skewY} min={-45} max={45} unit="°" onChange={(v) => set("skewY", v)} />
          </Section>

          <Section title="Color">
            <ColorPicker
              label="Lines"
              value={params.lineColor}
              pairedWith={params.bgColor}
              onChange={(c) => set("lineColor", c)}
            />
            <ColorPicker
              label="Background"
              value={params.bgColor}
              pairedWith={params.lineColor}
              onChange={(c) => set("bgColor", c)}
            />
            <div className="flex items-center justify-between">
              <button
                onClick={swapColors}
                className="rounded border border-white/12 px-2.5 py-1.5 text-[11px] text-white/70 transition-colors duration-200 ease hover:border-white/30 hover:text-white"
              >
                ⇄ Swap
              </button>
              <Toggle
                label="Transparent bg"
                value={params.transparentBg}
                onChange={(v) => set("transparentBg", v)}
              />
            </div>
          </Section>

          <Section title="Canvas">
            <div className="flex gap-2">
              <NumberInput label="Width" value={params.width} min={100} max={6000} onChange={(v) => set("width", v)} />
              <NumberInput label="Height" value={params.height} min={100} max={6000} onChange={(v) => set("height", v)} />
            </div>
            <Slider
              label="Margin"
              value={params.margin}
              min={0}
              max={Math.floor(Math.min(params.width, params.height) / 2 - 20)}
              unit="px"
              onChange={(v) => set("margin", v)}
            />
          </Section>

          <div className="px-4 py-4">
            <button
              onClick={() => {
                setActivePreset(null);
                setParams((p) => ({
                  ...DEFAULT_PARAMS,
                  width: p.width,
                  height: p.height,
                }));
              }}
              className="w-full rounded-md border border-white/10 py-2 text-[11px] text-white/45 transition-colors duration-200 ease hover:border-white/25 hover:text-white/80"
            >
              Reset all settings
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
