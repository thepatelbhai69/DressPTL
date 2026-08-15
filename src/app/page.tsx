import Link from "next/link";
import { CATEGORY_LABELS } from "@/lib/catalog";

const FEATURED_CATEGORIES = [
  "top",
  "jewelry",
  "shoes",
  "watch",
  "socks",
  "hair",
] as const;

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <section className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center gap-6 px-6 py-24 text-center">
        <p className="text-sm font-medium uppercase tracking-widest text-zinc-500">
          Personal styling, powered by color science
        </p>
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          Clothes that actually match your skin tone
        </h1>
        <p className="max-w-xl text-lg text-zinc-600 dark:text-zinc-400">
          Upload a photo or pick your tone by hand. DressPTL analyzes your
          undertone and depth, then recommends a full look — clothing,
          jewelry, shoes, watches, socks, and hair color — pulled from
          real clothing lines.
        </p>
        <Link
          href="/analyze"
          className="mt-2 rounded-full bg-zinc-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-zinc-700 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
        >
          Find your match
        </Link>
      </section>

      <section className="border-t border-zinc-200 bg-zinc-50 px-6 py-16 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center text-sm font-medium uppercase tracking-widest text-zinc-500">
            A full look, every time
          </h2>
          <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-6">
            {FEATURED_CATEGORIES.map((category) => (
              <div
                key={category}
                className="rounded-xl border border-zinc-200 bg-white px-4 py-6 text-center dark:border-zinc-800 dark:bg-black"
              >
                <span className="text-sm font-medium">
                  {CATEGORY_LABELS[category]}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
