import "./globals.css";
import { Suspense } from "react";
import MainLayout from "@/app/components/layout/MainLayout";
import StructuredData from "@/app/components/public/StructuredData";
import PageViewTracker from "@/app/components/telemetry/PageViewTracker";
import { buildSiteJsonLd } from "@/lib/structured-data";

export const metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://equitystack.org"),
  title: {
    default: "EquityStack | Black history, presidents, promises, and policy impact",
    template: "%s | EquityStack",
  },
  description:
    "EquityStack is a public-interest research platform covering Black history, U.S. presidents, campaign promises, civil rights policy, legislation, and policy impact on Black Americans.",
  applicationName: "EquityStack",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "EquityStack | Black history, presidents, promises, and policy impact",
    description:
      "Research Black history by president, campaign promises, legislation, civil rights policy, and measured policy impact on Black Americans.",
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
    title: "EquityStack | Black history, presidents, promises, and policy impact",
    description:
      "Explore Black history, presidents, campaign promises, legislation, and policy impact on Black Americans.",
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
