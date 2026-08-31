import type { Metadata } from "next";
import "./globals.css";
import { SiteFooter } from "@/app/components/site-footer";
import { MuiThemeProvider } from "@/app/components/mui-theme-provider";

export const metadata: Metadata = {
  title: "Pantry Pal",
  description: "A shared grocery list for real life.",
  manifest: "/manifest.webmanifest",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <MuiThemeProvider>
          {children}
          <SiteFooter />
        </MuiThemeProvider>
      </body>
    </html>
  );
}
