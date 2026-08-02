import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { Nav } from "@/components/Nav";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await getCurrentUser();
  if (user) redirect(user.consentAt ? "/colours" : "/onboarding");

  return (
    <>
      <Nav signedIn={false} />
      <h1>Find the colours that suit you. Once.</h1>
      <p className="lede">
        One reading of your natural colouring — from a single photo, or three
        questions and no photo at all — and you get the palette that flatters
        you. No uploading your wardrobe every time you want an answer.
      </p>

      <div className="grid grid--3" style={{ margin: "32px 0" }}>
        <div className="card">
          <h2 style={{ margin: "0 0 8px" }}>1. One reading</h2>
          <p className="muted" style={{ margin: 0 }}>
            A daylight selfie, or answer three questions about your veins,
            jewellery, and how you react to sun.
          </p>
        </div>
        <div className="card">
          <h2 style={{ margin: "0 0 8px" }}>2. Your season</h2>
          <p className="muted" style={{ margin: 0 }}>
            Spring, Summer, Autumn, or Winter — with the palette, the metals,
            and the colours to go carefully with.
          </p>
        </div>
        <div className="card">
          <h2 style={{ margin: "0 0 8px" }}>3. Keep it</h2>
          <p className="muted" style={{ margin: 0 }}>
            Saved to your account. Outfit ideas build on it whenever you want
            them.
          </p>
        </div>
      </div>

      <Link href="/signup">
        <button>Create an account</button>
      </Link>

      <h2>What we do and don&rsquo;t look at</h2>
      <p className="muted" style={{ maxWidth: "62ch" }}>
        We read three colour properties: your <em>undertone</em> (warm, cool, or
        neutral), how light or deep your skin appears, and the contrast between
        your hair, skin, and eyes. That is a measurement of light, and it is all
        colour matching needs.
      </p>
      <p className="muted" style={{ maxWidth: "62ch" }}>
        We never infer or store ethnicity, race, nationality, age, or gender.
        Selfies used for the reading are <strong>not stored at all</strong> —
        they are analysed and discarded. You can overrule the result, and delete
        everything, at any time.
      </p>
    </>
  );
}
