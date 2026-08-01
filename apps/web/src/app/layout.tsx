import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DressPTL — your colour profile, learned",
  description:
    "Upload outfits you love. DressPTL learns your favourite colour blends and recommends new looks.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <div className="shell">{children}</div>
      </body>
    </html>
  );
}
