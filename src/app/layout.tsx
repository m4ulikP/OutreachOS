import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OutreachOS — Freelancer Sales Studio",
  description:
    "Refined professional workspace for freelancers managing prospects, tailored outreach, discovery calls, and pipeline conversions.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  const stored = localStorage.getItem('theme');
                  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                  if (stored === 'dark' || (!stored && prefersDark)) {
                    document.documentElement.classList.add('dark');
                  } else {
                    document.documentElement.classList.remove('dark');
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body className="min-h-screen bg-background text-foreground antialiased selection:bg-primary/20">
        {children}
      </body>
    </html>
  );
}
