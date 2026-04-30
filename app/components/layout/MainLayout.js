"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { Footer, SiteHeader } from "@/app/components/public/chrome";

export default function MainLayout({ children }) {
  const pathname = usePathname();
  const isAdminPath = pathname?.startsWith("/admin");
  const hasMountedRef = useRef(false);
  const preserveNextScrollRef = useRef(false);

  useEffect(() => {
    const markPopStateNavigation = () => {
      preserveNextScrollRef.current = true;
    };

    window.addEventListener("popstate", markPopStateNavigation);
    return () => window.removeEventListener("popstate", markPopStateNavigation);
  }, []);

  useEffect(() => {
    if (isAdminPath) {
      return;
    }

    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      return;
    }

    if (preserveNextScrollRef.current) {
      preserveNextScrollRef.current = false;
      return;
    }

    if (window.location.hash) {
      return;
    }

    window.scrollTo({
      top: 0,
      left: 0,
      behavior: "auto",
    });
  }, [isAdminPath, pathname]);

  if (isAdminPath) {
    return <div className="admin-shell min-h-screen">{children}</div>;
  }

  return (
    <div className="page-shell flex min-h-screen flex-col">
      <a
        href="#main-content"
        className="skip-link sr-only focus:not-sr-only focus:absolute focus:left-5 focus:top-4 focus:z-[60] focus:rounded-full focus:bg-[var(--accent)] focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-[#051019]"
      >
        Skip to main content
      </a>
      <SiteHeader />
      <main id="main-content" className="content-shell mx-auto w-full max-w-[1500px] flex-1 px-5 py-8 xl:px-8">
        {children}
      </main>
      <Footer />
    </div>
  );
}
