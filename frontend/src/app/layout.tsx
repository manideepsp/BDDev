import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import Sidebar from '@/components/Sidebar';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-geist-sans',
});

export const metadata: Metadata = {
  title: {
    default: 'KS Business — Knowledge Systems BD Intelligence',
    template: '%s · KS Business',
  },
  description:
    'Knowledge Systems multi-agent AI pipeline that researches companies, scores fit, identifies prospects, and generates hyper-personalised outreach — in under 30 seconds.',
  keywords: ['business development', 'AI', 'outreach', 'prospect intelligence', 'sales automation', 'knowledge systems'],
};

export const viewport: Viewport = {
  themeColor: '#0A0C14',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="font-sans bg-background antialiased">
        <div className="flex min-h-screen">
          <Sidebar />
          <main className="flex-1 overflow-auto min-w-0">{children}</main>
        </div>
      </body>
    </html>
  );
}
