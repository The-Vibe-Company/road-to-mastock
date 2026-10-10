import type { Metadata, Viewport } from "next";
import { Barlow_Condensed, Geist } from "next/font/google";
import { AccentProvider } from "@/components/accent-provider";
import { TalentsProvider } from "@/components/talents-provider";
import { TrophiesProvider } from "@/components/trophies-provider";
import { HydrationWatchdog, WATCHDOG_SCRIPT } from "@/components/hydration-watchdog";
import { ACCENT_BOOT_SCRIPT } from "@/components/accent-provider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

// La pile de fonte : Barlow Condensed, la grotesque étroite des chiffres
// frappés sur les plaques — titres et gros chiffres uniquement, le corps
// reste en Geist.
const barlowCondensed = Barlow_Condensed({
  variable: "--font-display",
  weight: ["600", "700", "800"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Road to Mastock",
  description: "Track your gym sessions. Get mastock.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Mastock",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#1a1e24",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className={`dark ${geistSans.variable} ${barlowCondensed.variable}`}>
      <body>
        <script dangerouslySetInnerHTML={{ __html: WATCHDOG_SCRIPT }} />
        {/* L'accent mémorisé, appliqué avant la première peinture. */}
        <script dangerouslySetInnerHTML={{ __html: ACCENT_BOOT_SCRIPT }} />
        <HydrationWatchdog />
        <AccentProvider>
          <TalentsProvider>
            <TrophiesProvider>
              <div className="column-rods mx-auto min-h-dvh max-w-lg">{children}</div>
            </TrophiesProvider>
          </TalentsProvider>
        </AccentProvider>
      </body>
    </html>
  );
}
