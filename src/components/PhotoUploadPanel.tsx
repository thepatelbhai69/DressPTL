"use client";

import { useRef, useState } from "react";
import { analyzePhoto } from "@/lib/photoAnalysis";
import type { SkinToneResult } from "@/lib/color";

export function PhotoUploadPanel({
  onDetected,
}: {
  onDetected: (result: SkinToneResult) => void;
}) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "analyzing" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setStatus("analyzing");
    setErrorMessage(null);
    setPreviewUrl(URL.createObjectURL(file));

    try {
      const result = await analyzePhoto(file);
      onDetected(result);
    } catch {
      setStatus("error");
      setErrorMessage(
        "Couldn't analyze that photo. Try a clearer, well-lit photo, or pick your tone manually instead."
      );
    }
  }

  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />

      {previewUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={previewUrl}
          alt="Uploaded preview"
          className="h-48 w-48 rounded-xl object-cover"
        />
      ) : (
        <div className="flex h-48 w-48 items-center justify-center rounded-xl border-2 border-dashed border-zinc-300 text-sm text-zinc-400 dark:border-zinc-700">
          No photo yet
        </div>
      )}

      <button
        onClick={() => inputRef.current?.click()}
        className="rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-700 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
        disabled={status === "analyzing"}
      >
        {status === "analyzing" ? "Analyzing…" : "Upload a photo"}
      </button>

      <p className="max-w-xs text-xs text-zinc-500">
        A well-lit photo showing your face or arm works best. This never
        leaves your device — analysis happens entirely in your browser.
      </p>

      {errorMessage && (
        <p className="max-w-xs text-sm text-red-600 dark:text-red-400">
          {errorMessage}
        </p>
      )}
    </div>
  );
}
