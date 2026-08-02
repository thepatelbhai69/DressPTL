"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { SkinAnalysis } from "@dressptl/shared";

type Mode = "choose" | "photo" | "quiz";

/**
 * The one-time colour reading.
 *
 * The quiz is offered as an equal option, not a fallback: three questions the
 * user can answer about themselves beat one photo taken under a kitchen bulb,
 * and it answers the objection that a style app shouldn't need your face.
 */
export function ColourFinder({ hasProfile }: { hasProfile: boolean }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("choose");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submitPhoto(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    if (!(data.get("file") instanceof File)) {
      setError("Choose a photo first.");
      return;
    }

    setBusy(true);
    setError(null);
    const response = await fetch("/api/skin", { method: "POST", body: data });
    const body = (await response.json().catch(() => ({}))) as {
      error?: string;
      analysis?: SkinAnalysis;
    };
    setBusy(false);

    if (!response.ok) {
      setError(body.error ?? "Could not read that photo.");
      return;
    }
    router.refresh();
  }

  async function submitQuiz(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);

    setBusy(true);
    setError(null);
    const response = await fetch("/api/skin", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        mode: "quiz",
        veins: data.get("veins"),
        metal: data.get("metal"),
        sun: data.get("sun"),
        depth: data.get("depth") || undefined,
        contrast: data.get("contrast") || undefined,
      }),
    });
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    setBusy(false);

    if (!response.ok) {
      setError(body.error ?? "Could not save your answers.");
      return;
    }
    router.refresh();
  }

  if (mode === "choose") {
    return (
      <div className="grid grid--2">
        <button className="choice" onClick={() => setMode("photo")}>
          <span className="choice__title">Use a photo</span>
          <span className="choice__body">
            One selfie in daylight. We read the colour and discard the image —
            it is never stored.
          </span>
        </button>
        <button className="choice" onClick={() => setMode("quiz")}>
          <span className="choice__title">Answer three questions</span>
          <span className="choice__body">
            No photo needed. Often more reliable, because lighting can&rsquo;t
            skew it.
          </span>
        </button>
        {hasProfile ? (
          <p className="muted" style={{ gridColumn: "1 / -1", margin: 0 }}>
            You already have a reading — doing this again replaces it.
          </p>
        ) : null}
      </div>
    );
  }

  if (mode === "photo") {
    return (
      <div className="card" style={{ maxWidth: 520 }}>
        <form onSubmit={submitPhoto}>
          {error ? <div className="alert alert--error">{error}</div> : null}
          <label htmlFor="file">A photo of your face</label>
          <input
            id="file"
            name="file"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            required
          />
          <p className="muted" style={{ marginTop: -8 }}>
            Daylight, no filter, no strong background colour. Indoor bulbs make
            almost everyone read warm.
          </p>
          <div style={{ display: "flex", gap: 10 }}>
            <button type="submit" disabled={busy}>
              {busy ? "Reading…" : "Find my colours"}
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => setMode("choose")}
              disabled={busy}
            >
              Back
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="card" style={{ maxWidth: 560 }}>
      <form onSubmit={submitQuiz}>
        {error ? <div className="alert alert--error">{error}</div> : null}

        <fieldset className="quiz">
          <legend>In daylight, the veins on your inner wrist look…</legend>
          <label><input type="radio" name="veins" value="green" required /> Green</label>
          <label><input type="radio" name="veins" value="blue" /> Blue or purple</label>
          <label><input type="radio" name="veins" value="both" /> Hard to tell</label>
        </fieldset>

        <fieldset className="quiz">
          <legend>Which looks better against your skin?</legend>
          <label><input type="radio" name="metal" value="gold" required /> Gold</label>
          <label><input type="radio" name="metal" value="silver" /> Silver</label>
          <label><input type="radio" name="metal" value="both" /> Both work</label>
        </fieldset>

        <fieldset className="quiz">
          <legend>In strong sun, your skin usually…</legend>
          <label><input type="radio" name="sun" value="tans" required /> Tans</label>
          <label><input type="radio" name="sun" value="burns" /> Burns</label>
          <label><input type="radio" name="sun" value="both" /> Burns, then tans</label>
        </fieldset>

        <label htmlFor="depth">How deep is your skin tone?</label>
        <select id="depth" name="depth" defaultValue="medium">
          <option value="light">Light</option>
          <option value="medium">Medium</option>
          <option value="deep">Deep</option>
        </select>

        <label htmlFor="contrast">
          Contrast between your hair, skin, and eyes
        </label>
        <select id="contrast" name="contrast" defaultValue="medium">
          <option value="low">Low — they blend together</option>
          <option value="medium">Medium</option>
          <option value="high">High — they stand apart</option>
        </select>

        <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
          <button type="submit" disabled={busy}>
            {busy ? "Working…" : "Find my colours"}
          </button>
          <button
            type="button"
            className="secondary"
            onClick={() => setMode("choose")}
            disabled={busy}
          >
            Back
          </button>
        </div>
      </form>
    </div>
  );
}

/** Lets the user overrule the reading. Shown alongside the result. */
export function UndertoneCorrection({ current }: { current: string | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function set(undertone: string) {
    setBusy(true);
    await fetch("/api/skin", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mode: "manual", undertone }),
    });
    setBusy(false);
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button className="linkish" onClick={() => setOpen(true)}>
        Doesn&rsquo;t look right? Set it yourself
      </button>
    );
  }

  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
      {["warm", "cool", "neutral"].map((option) => (
        <button
          key={option}
          className="secondary"
          disabled={busy || option === current}
          onClick={() => set(option)}
        >
          {option}
        </button>
      ))}
      <button className="linkish" onClick={() => setOpen(false)}>
        Cancel
      </button>
    </div>
  );
}
