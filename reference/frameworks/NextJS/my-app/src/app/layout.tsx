import { Geist, Geist_Mono } from "next/font/google";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

// This root layout wraps every route in src/app.
// Next file to read after this support file: src/app/routes-and-layouts/page.tsx.

const geistSans = Geist({
  // next/font loads the font at build time and exposes this CSS variable.
  // The html element below attaches the variable so Tailwind/global CSS can use it.
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  // Next reads this named export and turns it into document head tags.
  // Metadata is typed so misspelled fields are caught during build.
  title: "Next.js Reference App",
  description: "Code-first Next.js App Router examples with local SQLite.",
};

type RootLayoutProps = {
  // children is whichever page or nested layout is active for the current route.
  children: ReactNode;
};

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
