import Link from "next/link";
import { redirect } from "next/navigation";
import { summarizeProfile, suggestPaletteAdditions } from "@dressptl/shared";
import { getCurrentUser } from "@/lib/auth";
import { getStyleProfile } from "@/lib/db";
import { recomputeStyleProfile } from "@/lib/analysis";
import { Nav } from "@/components/Nav";
import { Blends, Swatches } from "@/components/Palette";
import { DangerZone } from "@/components/DangerZone";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.consentAt) redirect("/onboarding");

  const profile =
    (await getStyleProfile(user.id)) ?? (await recomputeStyleProfile(user.id));

  if (profile.photoCount === 0) {
    return (
      <>
        <Nav signedIn />
        <h1>Your style profile</h1>
        <div className="empty card">
          <p>Nothing to learn from yet.</p>
          <Link href="/upload">
            <button>Upload your first outfit</button>
          </Link>
        </div>
      </>
    );
  }

  const suggestions = suggestPaletteAdditions(profile, 4);

  return (
    <>
      <Nav signedIn />
      <h1>Your style profile</h1>
      <p className="lede">{summarizeProfile(profile)}</p>

      <h2>Your palette</h2>
      <Swatches palette={profile.palette} />

      <h2>Colour blends you reach for</h2>
      <Blends blends={profile.blends} />

      <h2>Worth adding</h2>
      <p className="muted">
        Colours that would sit well beside what you already wear
        {profile.undertone ? ` and suit a ${profile.undertone} undertone` : ""}.
      </p>
      <ul className="swatches">
        {suggestions.map((suggestion) => (
          <li className="swatch" key={suggestion.name}>
            <div
              className="swatch__chip"
              style={{ background: suggestion.hex }}
              aria-hidden="true"
            />
            <div className="swatch__name">{suggestion.name}</div>
            <div className="muted">{suggestion.reason}</div>
          </li>
        ))}
      </ul>

      <h2>Details</h2>
      <div className="card">
        <p style={{ margin: 0 }}>
          <strong>Outfits analysed:</strong> {profile.photoCount}
        </p>
        <p style={{ margin: "6px 0 0" }}>
          <strong>Skin undertone:</strong>{" "}
          {profile.undertone ?? "not determined"}{" "}
          <span className="muted">(colour temperature only)</span>
        </p>
        <p style={{ margin: "6px 0 0" }}>
          <strong>Silhouette:</strong> {profile.silhouette ?? "not determined"}
        </p>
        <p style={{ margin: "6px 0 0" }}>
          <strong>Height:</strong>{" "}
          {user.heightCm ? `${user.heightCm} cm` : "not provided"}
        </p>
        {profile.styleTags.length > 0 ? (
          <p style={{ margin: "12px 0 0" }}>
            {profile.styleTags.map((tag) => (
              <span className="tag" key={tag.tag}>
                {tag.tag}
              </span>
            ))}
          </p>
        ) : null}
      </div>

      <Link href="/recommendations">
        <button style={{ marginTop: 24 }}>See recommendations</button>
      </Link>

      <DangerZone />
    </>
  );
}
