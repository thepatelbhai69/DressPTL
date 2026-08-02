import Link from "next/link";
import { redirect } from "next/navigation";
import {
  describeSkin,
  determineSeason,
  recommendColorsForSkin,
  seasonConfidence,
  SEASONS,
} from "@dressptl/shared";
import { getCurrentUser } from "@/lib/auth";
import { getSkinProfile } from "@/lib/skin";
import { Nav } from "@/components/Nav";
import { ColourFinder, UndertoneCorrection } from "@/components/ColourFinder";

export const dynamic = "force-dynamic";

const CONFIDENCE_COPY: Record<string, string> = {
  high: "Confident reading.",
  medium: "Reasonably confident — worth sanity-checking against a mirror.",
  low: "Low confidence. Neutral undertones sit between seasons, so treat this as a starting point.",
};

export default async function ColoursPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.consentAt) redirect("/onboarding");

  const skin = await getSkinProfile(user.id);

  if (!skin || !skin.undertone) {
    return (
      <>
        <Nav signedIn />
        <h1>Find your colours</h1>
        <p className="lede">
          One reading, once. We work out which colours suit your natural
          colouring — then you never have to upload anything again.
        </p>
        <ColourFinder hasProfile={false} />
      </>
    );
  }

  const season = determineSeason(skin);
  const profile = SEASONS[season];
  const confidence = seasonConfidence(skin);
  const { best, avoid } = recommendColorsForSkin(skin, 8);

  return (
    <>
      <Nav signedIn />

      <div className="season">
        <div className="season__label">Your colour season</div>
        <h1 className="season__name">{season}</h1>
        <p className="season__tagline">{profile.tagline}</p>
        <div className="season__strip" aria-hidden="true">
          {profile.palette.slice(0, 10).map((colour) => (
            <span key={colour.name} style={{ background: colour.hex }} />
          ))}
        </div>
      </div>

      <p className="lede" style={{ marginTop: 24 }}>
        {profile.description}
      </p>

      <div className="card">
        <p style={{ margin: 0 }}>
          <strong>{describeSkin(skin)}</strong>
        </p>
        <p className="muted" style={{ margin: "6px 0 0" }}>
          {CONFIDENCE_COPY[confidence]}
          {skin.source === "quiz" ? " Based on your answers." : null}
          {skin.source === "manual" ? " Set by you." : null}
          {skin.source === "photo" ? " Read from your photo." : null}
        </p>
        {skin.note ? (
          <p className="muted" style={{ margin: "6px 0 0" }}>
            {skin.note}
          </p>
        ) : null}
        <div style={{ marginTop: 10 }}>
          <UndertoneCorrection current={skin.undertone} />
        </div>
      </div>

      <h2>Your palette</h2>
      <ul className="swatches">
        {profile.palette.map((colour) => (
          <li className="swatch" key={colour.name}>
            <div
              className="swatch__chip"
              style={{ background: colour.hex }}
              aria-hidden="true"
            />
            <div className="swatch__name">{colour.name}</div>
            <div className="muted mono">{colour.hex}</div>
          </li>
        ))}
      </ul>

      <h2>Best of the basics</h2>
      <p className="muted">
        Ranked against your undertone and how much they lift off your skin&rsquo;s
        depth.
      </p>
      <ul className="ranked">
        {best.map((colour, index) => (
          <li key={colour.name}>
            <span className="ranked__rank">{index + 1}</span>
            <span
              className="ranked__chip"
              style={{ background: colour.hex }}
              aria-hidden="true"
            />
            <span>
              <strong>{colour.name}</strong>
              <span className="muted"> — {colour.reason}</span>
            </span>
          </li>
        ))}
      </ul>

      <div className="grid grid--2" style={{ marginTop: 8 }}>
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Metals</h2>
          <p style={{ margin: 0 }}>{profile.metals}</p>
          <h2>Neutrals</h2>
          <p style={{ margin: 0 }}>{profile.neutrals.join(" · ")}</p>
        </div>
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Go carefully with</h2>
          {profile.avoid.map((colour) => (
            <div className="blend" key={colour.name}>
              <div className="blend__pair" aria-hidden="true">
                <span style={{ background: colour.hex, borderRadius: 8 }} />
              </div>
              <div>
                <strong>{colour.name}</strong>
                <div className="muted">{colour.why}</div>
              </div>
            </div>
          ))}
          <p className="muted" style={{ marginBottom: 0, fontSize: "0.82rem" }}>
            Also scoring low for you: {avoid.map((c) => c.name).join(", ")}.
          </p>
        </div>
      </div>

      <h2>Next</h2>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Link href="/recommendations">
          <button>Build outfits from this</button>
        </Link>
        <Link href="/upload">
          <button className="secondary">
            Optional: add outfits you own
          </button>
        </Link>
      </div>
      <p className="muted" style={{ marginTop: 10, maxWidth: "58ch" }}>
        Adding outfits is optional — it teaches us the colour pairings you
        already reach for, so recommendations blend your taste with your
        palette. Your colours work without it.
      </p>
    </>
  );
}
