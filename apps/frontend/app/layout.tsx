import type { Metadata, Viewport } from 'next';
import { ThemeProvider } from '@/components/providers/ThemeProvider';
import './globals.css';

export const metadata: Metadata = {
  title: 'AI Investment Agents',
  description: 'Assets and AI insights dashboard',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

/** Reduces static metadata / RSC edge cases in dev; fine for this dashboard. */
export const dynamic = 'force-dynamic';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning className="min-h-screen bg-background font-sans">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
