import type { Metadata } from "next";
import RestorePage from "@/components/RestorePage";

export const metadata: Metadata = { title: "Restore from takeUforward | A2Z Tracker" };

export default function Restore() {
  return <RestorePage />;
}
