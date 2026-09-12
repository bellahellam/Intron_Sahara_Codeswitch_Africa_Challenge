import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MAMA-SAUTI",
  description:
    "A Community Health Promoter's conversational screening assistant. Not a diagnosis; an initial screening that helps make a referral.",
  // §14.5: no third-party analytics, tag managers or session-replay scripts of any kind, on any
  // screen. A session-replay script on a screen containing a mother's disclosure would be a
  // serious breach. Banned by rule, not by intention.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Pinch-zoom stays available. A CHP reading a consent script in poor light may need it, and
  // disabling it is an accessibility failure dressed up as polish.
  maximumScale: 5,
  themeColor: "#1B5E4A",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="sw">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        {/* 360×640 is the verification target (FR-30). max-w keeps it honest on a laptop too. */}
        <div className="mx-auto min-h-screen w-full max-w-md bg-neutral-50">{children}</div>
      </body>
    </html>
  );
}
