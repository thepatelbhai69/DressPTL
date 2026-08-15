"use client";

import { MANUAL_SWATCHES } from "@/lib/manualSwatches";
import { classifySkinTone, hexToRgb, type SkinToneResult } from "@/lib/color";

export function ManualTonePicker({
  onPicked,
}: {
  onPicked: (result: SkinToneResult) => void;
}) {
  return (
    <div className="flex flex-col items-center gap-4">
      <p className="max-w-sm text-center text-sm text-zinc-500">
        Tap the swatch that&apos;s closest to your natural skin tone.
      </p>
      <div className="grid grid-cols-3 gap-3">
        {MANUAL_SWATCHES.map((swatch) => (
          <button
            key={swatch.id}
            onClick={() => onPicked(classifySkinTone(hexToRgb(swatch.hex)))}
            className="h-14 w-14 rounded-full border border-black/10 transition hover:scale-105 dark:border-white/10"
            style={{ backgroundColor: swatch.hex }}
            aria-label={`${swatch.depth} ${swatch.undertone}`}
            title={`${swatch.depth} / ${swatch.undertone}`}
          />
        ))}
      </div>
    </div>
  );
}
