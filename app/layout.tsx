import { Analytics } from "@vercel/analytics/next";
import type { Metadata } from "next";
import { Fraunces, IBM_Plex_Mono, Source_Serif_4 } from "next/font/google";
import "./globals.css";

const display = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
});

const prose = Source_Serif_4({
  subsets: ["latin"],
  variable: "--font-source-serif",
  display: "swap",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Search sheet",
  description:
    "Replay a search trace on graph paper. The frontier is swappable; the sheet only plays the trace back.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${prose.variable} ${mono.variable}`}
    >
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
