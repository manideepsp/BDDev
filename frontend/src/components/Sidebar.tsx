'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  {
    href: '/',
    label: 'Dashboard',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    href: '/research',
    label: 'New Research',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    ),
  },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-60 bg-slate-900 min-h-screen flex flex-col flex-shrink-0">
      {/* Brand */}
      <div className="px-5 py-6 border-b border-slate-700/50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
                d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div>
            <div className="text-white font-bold text-sm tracking-tight">Nexus BD</div>
            <div className="text-slate-400 text-xs">AI Intelligence</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {navItems.map((item) => {
          const active =
            item.href === '/'
              ? pathname === '/'
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                active
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              {item.icon}
              {item.label}
            </Link>
          );
        })}

        <div className="pt-4 pb-1">
          <div className="text-xs font-medium text-slate-600 uppercase tracking-wider px-3 mb-1">
            Pipeline
          </div>
        </div>

        {[
          { label: 'Researched', color: 'bg-blue-500' },
          { label: 'Outreach Ready', color: 'bg-indigo-500' },
          { label: 'Contacted', color: 'bg-amber-500' },
          { label: 'Qualified', color: 'bg-emerald-500' },
        ].map(({ label, color }) => (
          <Link
            key={label}
            href="/"
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-500 hover:text-slate-300 transition-colors"
          >
            <span className={`w-2 h-2 rounded-full ${color} flex-shrink-0`} />
            {label}
          </Link>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-3 py-4 border-t border-slate-700/50">
        <div className="flex items-center gap-3 px-3 py-2">
          <div className="w-7 h-7 bg-indigo-500/20 border border-indigo-500/30 rounded-full flex items-center justify-center flex-shrink-0">
            <span className="text-indigo-400 text-xs font-bold">M</span>
          </div>
          <div className="min-w-0">
            <div className="text-slate-300 text-xs font-medium truncate">Manideep</div>
            <div className="text-slate-500 text-xs truncate">pipaltree.ai</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
