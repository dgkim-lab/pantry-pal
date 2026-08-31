import type { Metadata } from "next";
import "./globals.css";
import { SiteFooter } from "@/app/components/site-footer";
import { MuiThemeProvider } from "@/app/components/mui-theme-provider";
import { ClientErrorReporter } from "@/app/components/client-error-reporter";

export const metadata: Metadata = {
  title: "Pantry Pal",
  description: "A shared grocery list for real life.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/icon.svg",
    apple: "/apple-icon.svg",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <MuiThemeProvider>
          <ClientErrorReporter>{children}</ClientErrorReporter>
          <SiteFooter />
        </MuiThemeProvider>
      </body>
    </html>
  );
}
