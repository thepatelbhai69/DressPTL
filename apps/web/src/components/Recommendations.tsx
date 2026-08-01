"use client";

import { useState } from "react";
import type { OutfitRecommendation } from "@dressptl/shared";

export function Recommendations({
  initialOutfits,
  initialGeneratedAt,
}: {
  initialOutfits: OutfitRecommendation[];
  initialGeneratedAt: string | null;
}) {
  const [outfits, setOutfits] = useState(initialOutfits);
  const [generatedAt, setGeneratedAt] = useState(initialGeneratedAt);
  const [degraded, setDegraded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function generate() {
    setBusy(true);
    setError(null);

    const response = await fetch("/api/recommendations", { method: "POST" });
    const body = (await response.json().catch(() => ({}))) as {
      outfits?: OutfitRecommendation[];
      degraded?: boolean;
      error?: string;
    };

    setBusy(false);

    if (!response.ok) {
      setError(body.error ?? "Could not generate recommendations.");
      return;
    }

    setOutfits(body.outfits ?? []);
    setDegraded(Boolean(body.degraded));
    setGeneratedAt(new Date().toISOString());
  }

  return (
    <>
      <button onClick={generate} disabled={busy}>
        {busy
          ? "Styling…"
          : outfits.length > 0
            ? "Regenerate"
            : "Generate recommendations"}
      </button>

      {error ? (
        <div className="alert alert--error" style={{ marginTop: 16 }}>
          {error}
        </div>
      ) : null}

      {degraded ? (
        <div className="alert" style={{ marginTop: 16 }}>
          The styling model was unavailable, so these were built directly from
          your learned palette.
        </div>
      ) : null}

      {generatedAt ? (
        <p className="muted" style={{ marginTop: 12 }}>
          Last generated {new Date(generatedAt).toLocaleString()}
        </p>
      ) : null}

      <div className="grid grid--2" style={{ marginTop: 20 }}>
        {outfits.map((outfit, index) => (
          <div className="card" key={`${outfit.title}-${index}`}>
            <h2 style={{ margin: "0 0 4px", fontSize: "1.05rem" }}>
              {outfit.title}
            </h2>
            <div className="muted" style={{ fontSize: "0.82rem" }}>
              {outfit.occasion}
            </div>

            <ul className="outfit__items">
              {outfit.items.map((item, itemIndex) => (
                <li key={`${item.garment}-${itemIndex}`}>
                  <i style={{ background: item.colorHex }} aria-hidden="true" />
                  <span>
                    {item.garment} — {item.colorName}
                  </span>
                </li>
              ))}
            </ul>

            <p style={{ fontSize: "0.9rem", margin: "0 0 6px" }}>
              {outfit.rationale}
            </p>
            {outfit.silhouetteNote ? (
              <p className="muted" style={{ margin: 0, fontSize: "0.85rem" }}>
                {outfit.silhouetteNote}
              </p>
            ) : null}
          </div>
        ))}
      </div>
    </>
  );
}
