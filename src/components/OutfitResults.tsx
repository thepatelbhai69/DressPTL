import type { SkinToneResult } from "@/lib/color";
import { DEPTH_LABELS, UNDERTONE_LABELS } from "@/lib/color";
import { CATEGORY_LABELS } from "@/lib/catalog";
import type { OutfitRecommendation } from "@/lib/matcher";

function ColorDot({ hex }: { hex: string }) {
  return (
    <span
      className="inline-block h-8 w-8 shrink-0 rounded-full border border-black/10 dark:border-white/10"
      style={{ backgroundColor: hex }}
    />
  );
}

function OutfitCard({ recommendation }: { recommendation: OutfitRecommendation }) {
  const { item } = recommendation.best;
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
          {CATEGORY_LABELS[recommendation.category]}
        </span>
        <ColorDot hex={item.colorHex} />
      </div>
      <div>
        <h3 className="font-medium">{item.name}</h3>
        <p className="text-sm text-zinc-500">{item.line}</p>
      </div>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        {item.description}
      </p>
      <p className="text-xs text-zinc-400">
        {item.colorName}
        {item.metal ? ` · ${item.metal.replace("-", " ")}` : ""}
      </p>
    </div>
  );
}

export function OutfitResults({
  skinTone,
  recommendations,
  onRestart,
}: {
  skinTone: SkinToneResult;
  recommendations: OutfitRecommendation[];
  onRestart: () => void;
}) {
  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-12">
      <div className="mb-10 flex flex-col items-center gap-3 text-center">
        <ColorDot hex={skinTone.hex} />
        <h2 className="text-2xl font-semibold">
          {DEPTH_LABELS[skinTone.depth]} depth, {" "}
          {UNDERTONE_LABELS[skinTone.undertone]} undertone
        </h2>
        <p className="max-w-xl text-sm text-zinc-500">
          Here&apos;s a full look chosen for your tone — swap any single
          piece out for one of its alternates, or start over with a
          different photo or swatch.
        </p>
        <button
          onClick={onRestart}
          className="mt-2 text-sm font-medium underline underline-offset-4"
        >
          Start over
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {recommendations.map((recommendation) => (
          <OutfitCard key={recommendation.category} recommendation={recommendation} />
        ))}
      </div>
    </div>
  );
}
