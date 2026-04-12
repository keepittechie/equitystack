import BillsClient from "./BillsClient";
import { buildPageMetadata } from "@/lib/metadata";
import StructuredData from "@/app/components/public/StructuredData";
import { buildPublicBillsDataset } from "@/lib/public-bills";
import { getFutureBills } from "@/lib/shareable-cards";
import {
  buildBreadcrumbJsonLd,
  buildCollectionPageJsonLd,
  buildDatasetJsonLd,
  buildItemListJsonLd,
} from "@/lib/structured-data";

export const metadata = buildPageMetadata({
  title: "Bills affecting Black Americans",
  description:
    "Track public bills EquityStack is watching, see where they are in the legislative process, and review why they matter for Black Americans.",
  path: "/bills",
  keywords: [
    "legislation affecting Black Americans",
    "civil rights bills",
    "Black policy impact bills",
  ],
});

export default async function BillsPage() {
  const futureBills = await getFutureBills();
  const bills = buildPublicBillsDataset(futureBills);

  return (
    <>
      <StructuredData
        data={[
          buildBreadcrumbJsonLd(
            [{ href: "/", label: "Home" }, { label: "Bills" }],
            "/bills"
          ),
          buildCollectionPageJsonLd({
            title: "Bills affecting Black Americans",
            description:
              "A public bill tracker for legislation that may affect Black Americans, civil-rights policy, and related policy outcomes.",
            path: "/bills",
            about: [
              "legislation affecting Black Americans",
              "civil rights bills",
              "Congress",
            ],
            keywords: ["civil rights bills", "Black policy impact bills"],
          }),
          buildDatasetJsonLd({
            title: "EquityStack public bill tracker",
            description:
              "Structured bill records covering legislative status, Black Impact Score estimates, linked promises, and source-backed context.",
            path: "/bills",
            about: ["Congress", "civil rights policy", "Black Americans"],
            keywords: ["legislation affecting Black Americans", "Black policy impact bills"],
            variableMeasured: [
              "Estimated Black Impact Score",
              "Legislative status",
              "Source count",
              "Linked promises",
            ],
          }),
          buildItemListJsonLd({
            title: "Bills visible on the EquityStack bill tracker",
            description:
              "The current visible bill entries on the public EquityStack bill tracker.",
            path: "/bills",
            items: bills
              .filter((item) => item?.detailHref && item?.title)
              .slice(0, 12)
              .map((item) => ({
                href: item.detailHref,
                name: item.title,
              })),
          }),
        ]}
      />
      <BillsClient bills={bills} />
    </>
  );
}
