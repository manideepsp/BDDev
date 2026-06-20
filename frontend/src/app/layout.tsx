import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import AuthShell from '@/components/AuthShell';
import { AuthProvider } from '@/contexts/AuthContext';

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
        <AuthProvider>
          <AuthShell>
            {children}
          </AuthShell>
        </AuthProvider>
      </body>
    </html>
  );
}
