"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function OnboardingForm({
  initialHeight,
}: {
  initialHeight: number | null;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/onboarding", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        heightCm: form.get("heightCm") || null,
        consent: true,
      }),
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      setError(body.error ?? "Something went wrong.");
      setBusy(false);
      return;
    }

    router.push("/colours");
    router.refresh();
  }

  return (
    <div className="card" style={{ maxWidth: 520 }}>
      <form onSubmit={onSubmit}>
        {error ? <div className="alert alert--error">{error}</div> : null}

        <label htmlFor="heightCm">Height in cm (optional)</label>
        <input
          id="heightCm"
          name="heightCm"
          type="number"
          min={100}
          max={250}
          defaultValue={initialHeight ?? undefined}
          placeholder="e.g. 175"
        />
        <p className="muted" style={{ marginTop: -8 }}>
          Used only to comment on proportion and length — hem lines, jacket
          cuts, that sort of thing.
        </p>

        <div className="consent">
          <input
            id="consent"
            type="checkbox"
            checked={consent}
            onChange={(event) => setConsent(event.target.checked)}
          />
          <label htmlFor="consent">
            I understand my photos will be sent to an AI model (Mistral) to
            identify the garments and colours in them. DressPTL does not infer
            ethnicity, race, nationality, age, or gender from my photos. I can
            delete my photos and account at any time.
          </label>
        </div>

        <button type="submit" disabled={!consent || busy}>
          {busy ? "Saving…" : "Continue to upload"}
        </button>
      </form>
    </div>
  );
}
