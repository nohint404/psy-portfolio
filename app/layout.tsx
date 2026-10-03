import type { Metadata, Viewport } from "next";
import "@fontsource/pixelify-sans/400.css";
import "@fontsource/pixelify-sans/500.css";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://psymariux.vercel.app"),
  title: "Psymariux | The Developer Workshop",
  description: "Psymariux's projects, source code and recent GitHub activity in an interactive Minecraft workshop.",
  icons: { icon: "/art/psymariux-head.png", apple: "/art/psymariux-head.png" },
  openGraph: { title: "Psymariux's Developer Workshop", description: "Game worlds, backend tools and public source code by Psymariux.", images: [{ url: "/art/social.png", width: 1200, height: 630 }], type: "website" },
  twitter: { card: "summary_large_image", title: "Psymariux's Developer Workshop", images: ["/art/social.png"] },
};
export const viewport: Viewport = { themeColor: "#191a1c", colorScheme: "dark" };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><head><link rel="preload" href="/fonts/DepartureMono-Regular.woff2" as="font" type="font/woff2" crossOrigin="anonymous" /></head><body>{children}</body></html>;
}
