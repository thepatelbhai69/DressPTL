"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

export function Nav({ signedIn }: { signedIn: boolean }) {
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <nav className="nav">
      <Link href="/" className="nav__brand">
        DressPTL
      </Link>
      {signedIn ? (
        <>
          <Link href="/upload" className="nav__link">
            Upload
          </Link>
          <Link href="/profile" className="nav__link">
            Style profile
          </Link>
          <Link href="/recommendations" className="nav__link">
            Recommendations
          </Link>
          <button className="linkish" onClick={logout}>
            Sign out
          </button>
        </>
      ) : (
        <>
          <Link href="/login" className="nav__link">
            Sign in
          </Link>
          <Link href="/signup" className="nav__link">
            Create account
          </Link>
        </>
      )}
    </nav>
  );
}
