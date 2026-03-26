import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Microworld — Economic Simulation",
  description:
    "An economic simulation inspired by Greg Egan's Permutation City. LLM-powered agents on a 2D grid produce, trade, and evolve.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en" className={`${inter.variable}`}>
        <body>{children}</body>
      </html>
    </ClerkProvider>
  );
}
