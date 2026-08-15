import type { Metadata } from "next";
import { AnalyzeFlow } from "@/components/AnalyzeFlow";

export const metadata: Metadata = {
  title: "Find your match — DressPTL",
  description:
    "Upload a photo or pick your skin tone to get a full outfit recommendation.",
};

export default function AnalyzePage() {
  return <AnalyzeFlow />;
}
