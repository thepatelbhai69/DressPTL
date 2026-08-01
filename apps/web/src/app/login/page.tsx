import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { AuthForm } from "@/components/AuthForm";
import { Nav } from "@/components/Nav";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/profile");

  return (
    <>
      <Nav signedIn={false} />
      <h1>Sign in</h1>
      <p className="lede">Pick up where your wardrobe left off.</p>
      <AuthForm mode="login" />
    </>
  );
}
