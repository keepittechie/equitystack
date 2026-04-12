import BillsClient from "./BillsClient";
import { buildPageMetadata } from "@/lib/metadata";
import { buildPublicBillsDataset } from "@/lib/public-bills";
import { getFutureBills } from "@/lib/shareable-cards";

export const metadata = buildPageMetadata({
  title: "Bills",
  description:
    "Track the bills EquityStack is watching, see where they are in the legislative process, and preview why they matter for Black outcomes.",
  path: "/bills",
});

export default async function BillsPage() {
  const futureBills = await getFutureBills();
  const bills = buildPublicBillsDataset(futureBills);

  return <BillsClient bills={bills} />;
}
