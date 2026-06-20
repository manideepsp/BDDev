'use client';

import { usePathname } from 'next/navigation';
import Sidebar from './Sidebar';

const NO_SHELL_PATHS = ['/login', '/register'];

export default function AuthShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthPage = NO_SHELL_PATHS.some(p => pathname.startsWith(p));

  if (isAuthPage) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto min-w-0">{children}</main>
    </div>
  );
}
