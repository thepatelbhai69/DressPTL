"use client";

import { useMemo, useState } from "react";
import type { SkinToneResult } from "@/lib/color";
import { recommendOutfit } from "@/lib/matcher";
import { PhotoUploadPanel } from "./PhotoUploadPanel";
import { ManualTonePicker } from "./ManualTonePicker";
import { OutfitResults } from "./OutfitResults";

type Step = "choose" | "photo" | "manual" | "results";

export function AnalyzeFlow() {
  const [step, setStep] = useState<Step>("choose");
  const [skinTone, setSkinTone] = useState<SkinToneResult | null>(null);

  const recommendations = useMemo(() => {
    if (!skinTone) return null;
    return recommendOutfit(skinTone.undertone, skinTone.depth);
  }, [skinTone]);

  function handleDetected(result: SkinToneResult) {
    setSkinTone(result);
    setStep("results");
  }

  function restart() {
    setSkinTone(null);
    setStep("choose");
  }

  if (step === "results" && skinTone && recommendations) {
    return (
      <OutfitResults
        skinTone={skinTone}
        recommendations={recommendations}
        onRestart={restart}
      />
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-8 px-6 py-16">
      {step === "choose" && (
        <>
          <div className="text-center">
            <h1 className="text-3xl font-semibold tracking-tight">
              Let&apos;s find your tone
            </h1>
            <p className="mt-2 text-zinc-500">
              Choose how you&apos;d like to get started.
            </p>
          </div>
          <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2">
            <button
              onClick={() => setStep("photo")}
              className="rounded-xl border border-zinc-200 p-6 text-left transition hover:border-zinc-400 dark:border-zinc-800 dark:hover:border-zinc-600"
            >
              <h2 className="font-medium">Upload a photo</h2>
              <p className="mt-1 text-sm text-zinc-500">
                We&apos;ll estimate your undertone and depth automatically.
              </p>
            </button>
            <button
              onClick={() => setStep("manual")}
              className="rounded-xl border border-zinc-200 p-6 text-left transition hover:border-zinc-400 dark:border-zinc-800 dark:hover:border-zinc-600"
            >
              <h2 className="font-medium">Pick your tone</h2>
              <p className="mt-1 text-sm text-zinc-500">
                Choose the swatch closest to your skin tone by hand.
              </p>
            </button>
          </div>
        </>
      )}

      {step === "photo" && (
        <>
          <PhotoUploadPanel onDetected={handleDetected} />
          <button
            onClick={() => setStep("choose")}
            className="text-sm font-medium underline underline-offset-4"
          >
            Back
          </button>
        </>
      )}

      {step === "manual" && (
        <>
          <ManualTonePicker onPicked={handleDetected} />
          <button
            onClick={() => setStep("choose")}
            className="text-sm font-medium underline underline-offset-4"
          >
            Back
          </button>
        </>
      )}
    </div>
  );
}
