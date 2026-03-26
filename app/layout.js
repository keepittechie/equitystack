import "./globals.css";
import MainLayout from "@/app/components/layout/MainLayout";

export const metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://equitystack.org"),
  title: {
    default: "EquityStack",
    template: "%s | EquityStack",
  },
  description:
    "EquityStack is a data-driven platform for tracking laws, court cases, executive actions, and future legislation affecting Black communities in the United States.",
  applicationName: "EquityStack",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "EquityStack",
    description:
      "Track how U.S. laws, court cases, executive actions, and proposed reforms have helped, harmed, or failed Black Americans over time.",
    siteName: "EquityStack",
    type: "website",
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: "EquityStack",
    description:
      "Explore historical policy records, legislation, explainers, and evidence on Black political and legal history.",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="antialiased">
        <MainLayout>
          {children}
        </MainLayout>
      </body>
    </html>
  );
}
