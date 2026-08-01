import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { AuthForm } from "@/components/AuthForm";
import { Nav } from "@/components/Nav";

export const dynamic = "force-dynamic";

export default async function SignupPage() {
  if (await getCurrentUser()) redirect("/onboarding");

  return (
    <>
      <Nav signedIn={false} />
      <h1>Create your account</h1>
      <p className="lede">
        Two minutes to set up, then upload the outfits you actually like.
      </p>
      <AuthForm mode="signup" />
    </>
  );
}
