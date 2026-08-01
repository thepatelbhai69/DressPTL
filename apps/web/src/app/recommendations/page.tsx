import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getLatestRecommendations, getStyleProfile } from "@/lib/db";
import { Nav } from "@/components/Nav";
import { Recommendations } from "@/components/Recommendations";

export const dynamic = "force-dynamic";

export default async function RecommendationsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.consentAt) redirect("/onboarding");

  const profile = await getStyleProfile(user.id);

  if (!profile || profile.photoCount === 0) {
    return (
      <>
        <Nav signedIn />
        <h1>Recommendations</h1>
        <div className="empty card">
          <p>We need at least one outfit to work from.</p>
          <Link href="/upload">
            <button>Upload an outfit</button>
          </Link>
        </div>
      </>
    );
  }

  const latest = await getLatestRecommendations(user.id);

  return (
    <>
      <Nav signedIn />
      <h1>Recommendations</h1>
      <p className="lede">
        Built from your palette, your usual pairings, and the proportions you
        told us about.
      </p>
      <Recommendations
        initialOutfits={latest?.outfits ?? []}
        initialGeneratedAt={latest?.createdAt ?? null}
      />
    </>
  );
}
