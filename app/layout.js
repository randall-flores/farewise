import { Fraunces, Public_Sans } from "next/font/google";
import "./globals.css";

// Each font becomes a CSS variable we reference in globals.css.
const display = Fraunces({ subsets: ["latin"], variable: "--font-display", display: "swap" });
const body = Public_Sans({ subsets: ["latin"], variable: "--font-body", display: "swap" });

export const metadata = {
  title: "FareWise — honest flight search",
  description: "Compare flights, see the catch, book direct.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body>{children}</body>
    </html>
  );
}
