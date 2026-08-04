import type { Metadata } from "next";
import { Share_Tech_Mono, Inter } from "next/font/google";
import "./globals.css";

const terminalFont = Share_Tech_Mono({
  variable: "--font-terminal",
  weight: "400",
  subsets: ["latin"],
});

const bodyFont = Inter({
  variable: "--font-body",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Personal Brain // Terminal",
  description: "A conversational agent over your own Gmail and Drive.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${terminalFont.variable} ${bodyFont.variable} h-full antialiased`}
    >
      <body className="h-full">{children}</body>
    </html>
  );
}
