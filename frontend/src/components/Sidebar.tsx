'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  cta?: boolean;
}

const NAV_MAIN: NavItem[] = [
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
];

const NAV_PIPELINE: NavItem[] = [
  {
    href: '/contacts',
    label: 'Contacts',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
          d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    href: '/outreach',
    label: 'Outreach Tracker',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
          d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    href: '/playbook',
    label: 'BD Playbook',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    href: '/brief',
    label: 'Morning Brief',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
          d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
  },
];

const NAV_INTEL: NavItem[] = [
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
    href: '/market-map',
    label: 'Market Map',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
          d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6-10l6-3m0 13l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-1.447-.894L15 9m0 4v8m0-8V9" />
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
];

function SectionLabel({ label }: { label: string }) {
  return (
    <div className="pt-4 pb-1 px-3">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-600">{label}</p>
    </div>
  );
}

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  if (item.cta && !active) {
    return (
      <Link href={item.href}
        className="flex items-center gap-2.5 w-full bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white text-sm font-medium px-3 py-2.5 rounded-lg transition-all shadow-sm shadow-indigo-900/30 mb-1">
        {item.icon}
        {item.label}
      </Link>
    );
  }
  return (
    <Link href={item.href}
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
}

export default function Sidebar() {
  const pathname = usePathname();

  const isActive = (href: string) => href === '/' ? pathname === '/' : pathname.startsWith(href);

  return (
    <aside className="w-60 bg-slate-900 min-h-screen flex flex-col flex-shrink-0 relative">
      <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-indigo-500 via-violet-500 to-indigo-400" />

      {/* Brand */}
      <div className="px-5 pt-6 pb-5 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg shadow-indigo-900/40">
            <svg className="w-[18px] h-[18px] text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
      <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
        {NAV_MAIN.map(item => (
          <NavLink key={item.href} item={item} active={isActive(item.href)} />
        ))}

        <SectionLabel label="BD Pipeline" />
        {NAV_PIPELINE.map(item => (
          <NavLink key={item.href} item={item} active={isActive(item.href)} />
        ))}

        <SectionLabel label="Intelligence" />
        {NAV_INTEL.map(item => (
          <NavLink key={item.href} item={item} active={isActive(item.href)} />
        ))}
      </nav>

      {/* Footer */}
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
