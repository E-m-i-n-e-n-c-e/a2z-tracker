import type { Metadata } from "next";
import AccountPage from "@/components/AccountPage";

export const metadata: Metadata = { title: "Account | A2Z Tracker" };

export default function Account() {
  return <AccountPage />;
}
