import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { listPhotos } from "@/lib/db";
import { Nav } from "@/components/Nav";
import { UploadManager, type PhotoSummary } from "@/components/UploadManager";

export const dynamic = "force-dynamic";

interface StoredColor {
  hex?: unknown;
}

export default async function UploadPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.consentAt) redirect("/onboarding");

  const rows = await listPhotos(user.id);

  const photos: PhotoSummary[] = rows.map(({ photo, analysis }) => {
    let colorHexes: string[] = [];
    if (analysis) {
      try {
        const parsed = JSON.parse(analysis.colors_json) as StoredColor[];
        colorHexes = parsed
          .map((color) => color.hex)
          .filter((hex): hex is string => typeof hex === "string")
          .slice(0, 5);
      } catch {
        colorHexes = [];
      }
    }
    return {
      id: photo.id,
      status: photo.status,
      error: photo.error,
      createdAt: photo.created_at,
      colorHexes,
    };
  });

  return (
    <>
      <Nav signedIn />
      <h1>Upload outfits</h1>
      <p className="lede">
        The more looks you add, the sharper your palette gets. Recent uploads
        count for more than old ones.
      </p>
      <UploadManager photos={photos} />
    </>
  );
}
