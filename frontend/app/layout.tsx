import type { Metadata, Viewport } from "next";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#fbe4ef",
};

export const metadata: Metadata = {
  title: "Little Moments — make someone feel extra special",
  description:
    "Create a tiny, unforgettable digital surprise with photos, memories, and a message from you.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>
        <div className="phone-backdrop" aria-hidden="true">
          <span>♡</span><span>✿</span><span>✦</span><span>🎀</span><span>♡</span><span>☁</span><span>✧</span><span>🌷</span>
        </div>
        <div className="app-frame">{children}</div>
      </body>
    </html>
  );
}
