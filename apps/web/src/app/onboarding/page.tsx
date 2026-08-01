import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { Nav } from "@/components/Nav";
import { OnboardingForm } from "@/components/OnboardingForm";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <>
      <Nav signedIn />
      <h1>Before your first upload</h1>
      <p className="lede">
        One optional detail and one consent, then you&rsquo;re in.
      </p>
      <OnboardingForm initialHeight={user.heightCm} />
    </>
  );
}
