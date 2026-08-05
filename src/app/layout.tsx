import type { Metadata } from "next";
import { Share_Tech_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider, NO_FLASH_THEME_SCRIPT } from "./ThemeProvider";

const terminalFont = Share_Tech_Mono({
  variable: "--font-terminal",
  weight: "400",
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
      className={`${terminalFont.variable} h-full antialiased`}
      // The no-flash script below sets [data-theme] on this element before
      // React hydrates, on purpose — the server has no way to know the
      // client's saved localStorage preference. That's a deliberate,
      // expected mismatch (the standard pattern for avoiding a flash of
      // the wrong theme), not a bug to silently patch around elsewhere.
      suppressHydrationWarning
    >
      <head>
        {/* Sets [data-theme] before hydration/paint so switching themes
            doesn't flash the wrong palette on load. */}
        <script dangerouslySetInnerHTML={{ __html: NO_FLASH_THEME_SCRIPT }} />
      </head>
      <body className="h-full">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
