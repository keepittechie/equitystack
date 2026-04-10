import "./globals.css";
import { Suspense } from "react";
import MainLayout from "@/app/components/layout/MainLayout";
import PageViewTracker from "@/app/components/telemetry/PageViewTracker";

export const metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://equitystack.org"),
  title: {
    default: "EquityStack | Measure how government actions impact Black Americans",
    template: "%s | EquityStack",
  },
  description:
    "EquityStack is a public civic intelligence platform for measuring how government actions impact Black Americans through policies, promises, evidence, and outcome-based analysis.",
  applicationName: "EquityStack",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "EquityStack | Measure how government actions impact Black Americans",
    description:
      "A public civic intelligence platform for tracking policy records, promises, evidence, and measurable impact on Black Americans.",
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
    title: "EquityStack | Measure how government actions impact Black Americans",
    description:
      "Explore policy records, presidents, promises, reports, sources, and evidence on Black political and legal history.",
    images: ["/images/hero/civil-rights-march.jpg"],
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="antialiased">
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
