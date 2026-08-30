import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pantry Pal",
  description: "A shared grocery list for real life.",
  manifest: "/manifest.webmanifest",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
