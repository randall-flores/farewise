import { Fraunces, Hanken_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";

// The departure-board type trio. Each becomes a CSS variable used in globals.css.
// Fraunces (display): the FareWise wordmark and airline names — a high-contrast
// serif that reads like the destination text on a real board.
const display = Fraunces({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-display",
  display: "swap",
});
// Hanken Grotesk (body): plain, legible running text.
const body = Hanken_Grotesk({ subsets: ["latin"], variable: "--font-body", display: "swap" });
// JetBrains Mono (mono): all metadata, labels, times, and prices — the gate-listing face.
const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata = {
  title: "FareWise — honest flight search",
  description: "Compare flights, see the catch, book direct.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
