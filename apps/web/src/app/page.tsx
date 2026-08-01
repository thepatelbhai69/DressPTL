import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { Nav } from "@/components/Nav";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await getCurrentUser();
  if (user) redirect(user.consentAt ? "/profile" : "/onboarding");

  return (
    <>
      <Nav signedIn={false} />
      <h1>Your colour profile, learned from what you already love.</h1>
      <p className="lede">
        Upload photos of outfits you feel good in. DressPTL works out the
        colours and pairings you actually reach for, then suggests new looks
        built on them.
      </p>

      <div className="grid grid--3" style={{ margin: "32px 0" }}>
        <div className="card">
          <h2 style={{ margin: "0 0 8px" }}>1. Upload</h2>
          <p className="muted" style={{ margin: 0 }}>
            A few photos of outfits you like wearing.
          </p>
        </div>
        <div className="card">
          <h2 style={{ margin: "0 0 8px" }}>2. Learn</h2>
          <p className="muted" style={{ margin: 0 }}>
            We extract the palette from each look and track which colours you
            pair together.
          </p>
        </div>
        <div className="card">
          <h2 style={{ margin: "0 0 8px" }}>3. Wear</h2>
          <p className="muted" style={{ margin: 0 }}>
            Outfit suggestions that extend your palette instead of replacing it.
          </p>
        </div>
      </div>

      <Link href="/signup">
        <button>Create an account</button>
      </Link>

      <h2>What we do and don&rsquo;t look at</h2>
      <p className="muted" style={{ maxWidth: "62ch" }}>
        Photos are analysed for the clothes and colours in them. We derive skin{" "}
        <em>undertone</em> — whether warm, cool, or neutral tones suit you — for
        colour matching only. We never infer or store ethnicity, race,
        nationality, age, or gender, and your photos are private to your
        account. You can delete everything at any time.
      </p>
    </>
  );
}
