import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MAMA-SAUTI",
  description: "A Community Health Promoter's conversational screening assistant. Not a diagnosis; an initial screening that helps make a referral.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#7C3AED",
};

const workflow = [
  { number: "01", title: "Begin privately", body: "Set up a short screening with a mother, on her terms." },
  { number: "02", title: "Listen naturally", body: "Kiswahili and English can sit in the same answer." },
  { number: "03", title: "Review and refer", body: "Evidence stays connected to her words before a referral is prepared." },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="sw">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body>
        <div className="app-shell">
          <aside className="app-sidebar" aria-hidden="true">
            <div className="sidebar-inner">
              <div className="sidebar-brand">
                <p className="sidebar-kicker">Community health screening assistant</p>
                <div className="sidebar-logo-row">
                  <div className="sidebar-icon">
                    <svg viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M1 11h2M4 7v8M7 4v14M10 8v6M13 5v12M16 8v6M19 7v8M22 11h-1" />
                    </svg>
                  </div>
                  <span className="sidebar-name">MAMA-SAUTI</span>
                </div>
                <p className="sidebar-tagline">Private voice screening for <em>postpartum wellbeing.</em></p>
                <p className="sidebar-tagline-en">Designed for the language a mother naturally uses in conversation, not the language an interface expects.</p>
              </div>

              <div className="sidebar-stats">
                {workflow.map((step) => (
                  <div className="sidebar-stat" key={step.number}>
                    <span className="sidebar-stat-num">{step.number}</span>
                    <div>
                      <p className="sidebar-stat-title">{step.title}</p>
                      <p className="sidebar-stat-body">{step.body}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="sidebar-footer">
              <div className="sidebar-trust">
                <span className="sidebar-trust-item">Audio deleted by default</span>
                <span className="sidebar-trust-item">Not a diagnosis</span>
                <span className="sidebar-trust-item">Evidence-led review</span>
              </div>
              <p className="sidebar-footer-note">A screening support tool · Not a medical device</p>
            </div>
          </aside>

          <div className="app-card">{children}</div>
        </div>
      </body>
    </html>
  );
}
