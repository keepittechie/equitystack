import "./globals.css";
import { Suspense } from "react";
import MainLayout from "@/app/components/layout/MainLayout";
import StructuredData from "@/app/components/public/StructuredData";
import PageViewTracker from "@/app/components/telemetry/PageViewTracker";
import { buildSiteJsonLd } from "@/lib/structured-data";

export const metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://equitystack.org"),
  title: {
    default: "EquityStack | Policies, promises, and Black impact evidence",
    template: "%s | EquityStack",
  },
  description:
    "EquityStack is a public-interest research platform for tracking policies, promises, outcomes, and Black impact evidence with public sources and visible analysis limits.",
  applicationName: "EquityStack",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "EquityStack | Policies, promises, and Black impact evidence",
    description:
      "Track policies, promises, outcomes, and Black impact evidence with public sources, structured records, and visible analysis coverage.",
    siteName: "EquityStack",
    type: "website",
    url: "/",
    images: [
      {
        url: "/images/hero/civil-rights-march.jpg",
        width: 2200,
        height: 1490,
        alt: "March on Washington for Jobs and Freedom, 1963",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "EquityStack | Policies, promises, and Black impact evidence",
    description:
      "Explore policy records, promises, outcomes, and Black impact evidence with linked public sources.",
    images: ["/images/hero/civil-rights-march.jpg"],
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="antialiased">
        <StructuredData data={buildSiteJsonLd()} />
        <Suspense fallback={null}>
          <PageViewTracker />
        </Suspense>
        <MainLayout>
          {children}
        </MainLayout>
      </body>
    </html>
  );
}
