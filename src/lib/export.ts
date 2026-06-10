// Export and clipboard helpers

export type RasterFormat = "png" | "jpeg" | "webp";

export async function svgToCanvas(
  svgString: string,
  width: number,
  height: number,
  scale: number,
  bgFallback?: string
): Promise<HTMLCanvasElement> {
  const url = URL.createObjectURL(new Blob([svgString], { type: "image/svg+xml" }));
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Failed to render SVG"));
      el.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const ctx = canvas.getContext("2d")!;
    if (bgFallback) {
      ctx.fillStyle = bgFallback;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function rasterBlob(
  svgString: string,
  width: number,
  height: number,
  scale: number,
  format: RasterFormat,
  bgFallback?: string
): Promise<Blob> {
  const canvas = await svgToCanvas(
    svgString,
    width,
    height,
    scale,
    format === "jpeg" ? bgFallback ?? "#ffffff" : bgFallback
  );
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Encoding failed"))),
      `image/${format}`,
      format === "jpeg" ? 0.92 : undefined
    );
  });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export function downloadSvg(svgString: string, filename: string) {
  downloadBlob(new Blob([svgString], { type: "image/svg+xml" }), filename);
}

/** Copy a blob to the clipboard. Falls back to PNG if the format is unsupported. */
export async function copyImageBlob(blob: Blob): Promise<"ok" | "converted-png"> {
  try {
    await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
    return "ok";
  } catch {
    // Most browsers only allow image/png on the clipboard
    if (blob.type !== "image/png") {
      const bmp = await createImageBitmap(blob);
      const canvas = document.createElement("canvas");
      canvas.width = bmp.width;
      canvas.height = bmp.height;
      canvas.getContext("2d")!.drawImage(bmp, 0, 0);
      const png = await new Promise<Blob>((res, rej) =>
        canvas.toBlob((b) => (b ? res(b) : rej(new Error("PNG encode failed"))), "image/png")
      );
      await navigator.clipboard.write([new ClipboardItem({ "image/png": png })]);
      return "converted-png";
    }
    throw new Error("Clipboard write failed");
  }
}

export async function copyText(text: string) {
  await navigator.clipboard.writeText(text);
}
