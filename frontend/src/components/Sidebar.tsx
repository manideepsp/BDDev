'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV = [
  {
    href: '/',
    label: 'Dashboard',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
          d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
      </svg>
    ),
  },
  {
    href: '/analyze',
    label: 'New Analysis',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    ),
    cta: true,
  },
  {
    href: '/trends',
    label: 'Market Intelligence',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
          d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
      </svg>
    ),
  },
  {
    href: '/linkedin',
    label: 'LinkedIn Posts',
    icon: (
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
      </svg>
    ),
  },
  {
    href: '/settings',
    label: 'Company Profile',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
          d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    ),
  },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-60 bg-slate-900 min-h-screen flex flex-col flex-shrink-0 relative">
      {/* Rainbow accent stripe — first thing judges see */}
      <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-indigo-500 via-violet-500 to-indigo-400" />

      {/* Brand */}
      <div className="px-5 pt-6 pb-5 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg shadow-indigo-900/40">
            <svg className="w-4.5 h-4.5 text-white w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
                d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div>
            <div className="text-white font-bold text-sm tracking-tight">Nexus BD</div>
            <div className="text-slate-500 text-[11px] tracking-wide">AI Intelligence Engine</div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-3 space-y-0.5">
        {NAV.map((item) => {
          const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);

          if (item.cta && !active) {
            return (
              <Link key={item.href} href={item.href}
                className="flex items-center gap-2.5 w-full bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white text-sm font-medium px-3 py-2.5 rounded-lg transition-all shadow-sm shadow-indigo-900/30 mb-1">
                {item.icon}
                {item.label}
              </Link>
            );
          }

          return (
            <Link key={item.href} href={item.href}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                active
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}>
              {item.icon}
              <span className="flex-1">{item.label}</span>
              {active && <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 flex-shrink-0" />}
            </Link>
          );
        })}

        {/* Section label */}
        <div className="pt-5 pb-1 px-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-600">Pipeline stages</p>
        </div>

        {/* Stage hints — not links, just ambient context about the BD funnel */}
        {[
          { label: 'Gathering data', color: 'bg-blue-400',   dot: 'border-blue-400/30' },
          { label: 'Human review',   color: 'bg-amber-400',  dot: 'border-amber-400/30' },
          { label: 'AI synthesis',   color: 'bg-violet-400', dot: 'border-violet-400/30' },
          { label: 'Outreach ready', color: 'bg-emerald-400', dot: 'border-emerald-400/30' },
        ].map(({ label, color }) => (
          <div key={label} className="flex items-center gap-2.5 px-3 py-1.5">
            <span className={`w-1.5 h-1.5 rounded-full ${color} flex-shrink-0 opacity-60`} />
            <span className="text-xs text-slate-600">{label}</span>
          </div>
        ))}
      </nav>

      {/* User footer — links to Company Profile settings */}
      <div className="px-3 py-4 border-t border-slate-800">
        <Link href="/settings"
          className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-800 transition-colors group">
          <div className="w-7 h-7 bg-gradient-to-br from-indigo-500/25 to-violet-500/25 border border-indigo-500/20 rounded-full flex items-center justify-center flex-shrink-0">
            <span className="text-indigo-400 text-[11px] font-bold">M</span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-slate-300 text-xs font-medium truncate">Manideep</div>
            <div className="text-slate-600 text-[11px] truncate">pipaltree.ai</div>
          </div>
          <svg className="w-3 h-3 text-slate-700 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
            fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </div>
    </aside>
  );
}
