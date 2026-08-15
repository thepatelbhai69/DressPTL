import { classifySkinTone, type Rgb, type SkinToneResult } from "./color";

const SAMPLE_SIZE = 160; // downscale target so pixel loops stay cheap

// Chai & Ngan YCbCr skin-pixel rule. Works reasonably across a wide range
// of skin tones because Cb/Cr separate chrominance from luminance.
function isSkinPixel(r: number, g: number, b: number): boolean {
  const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
  const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
  return cb >= 77 && cb <= 127 && cr >= 133 && cr <= 173;
}

export async function loadImage(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function sampleAverageSkinColor(img: HTMLImageElement): Rgb {
  const canvas = document.createElement("canvas");
  const scale = SAMPLE_SIZE / Math.max(img.naturalWidth, img.naturalHeight, 1);
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));
  canvas.width = w;
  canvas.height = h;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  ctx.drawImage(img, 0, 0, w, h);

  const { data } = ctx.getImageData(0, 0, w, h);

  // Bias sampling toward the center of the frame, where a face/subject
  // typically is, so background pixels don't dilute the estimate.
  const cx = w / 2;
  const cy = h / 2;
  const maxDist = Math.sqrt(cx * cx + cy * cy);

  let sumR = 0;
  let sumG = 0;
  let sumB = 0;
  let count = 0;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const distRatio = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2) / maxDist;
      if (distRatio > 0.85) continue; // skip far corners/background

      const idx = (y * w + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const alpha = data[idx + 3];
      if (alpha < 200) continue;

      if (isSkinPixel(r, g, b)) {
        sumR += r;
        sumG += g;
        sumB += b;
        count++;
      }
    }
  }

  if (count < 20) {
    // Fallback: not enough detected skin pixels (e.g. tight crop, unusual
    // lighting) - average the whole center region instead of failing.
    sumR = sumG = sumB = 0;
    count = 0;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const distRatio = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2) / maxDist;
        if (distRatio > 0.5) continue;
        const idx = (y * w + x) * 4;
        sumR += data[idx];
        sumG += data[idx + 1];
        sumB += data[idx + 2];
        count++;
      }
    }
  }

  count = Math.max(count, 1);
  return {
    r: sumR / count,
    g: sumG / count,
    b: sumB / count,
  };
}

export async function analyzePhoto(file: File): Promise<SkinToneResult> {
  const img = await loadImage(file);
  const rgb = sampleAverageSkinColor(img);
  return classifySkinTone(rgb);
}
