import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SITE_URL } from "@/lib/site";
import "./globals.css";

// The font variables sit on <html>: the App shell tokens live on :root and read them from there.
const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

const DESCRIPTION = "Write path redirect rules (301, 302, 307), generate short paths and test where a path goes. Kept in your browser; nothing is published.";

export const metadata: Metadata = {
  title: "Redirect Manager | Bookchaowalit",
  description: DESCRIPTION,
  metadataBase: new URL(SITE_URL),
  authors: [{ name: "Bookchaowalit", url: "https://bookchaowalit.com" }],
  creator: "Bookchaowalit",
  openGraph: { type: "website", title: "Redirect Manager | Bookchaowalit", description: DESCRIPTION, siteName: "Bookchaowalit" },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
