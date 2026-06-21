'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Search, Users, Mail, BookOpen, Sun,
  TrendingUp, Map, Settings, Zap,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

function LinkedinIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
    </svg>
  );
}
import { cn } from '@/lib/utils';

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  cta?: boolean;
  badge?: string;
}

const NAV_MAIN: NavItem[] = [
  { href: '/',        label: 'Dashboard',    icon: <LayoutDashboard className="w-4 h-4" /> },
  { href: '/analyze', label: 'New Analysis', icon: <Search className="w-4 h-4" />, cta: true },
];

const NAV_PIPELINE: NavItem[] = [
  { href: '/contacts', label: 'Contacts',         icon: <Users className="w-4 h-4" /> },
  { href: '/outreach', label: 'Outreach Tracker', icon: <Mail className="w-4 h-4" /> },
  { href: '/playbook', label: 'BD Playbook',       icon: <BookOpen className="w-4 h-4" /> },
  { href: '/brief',    label: 'Morning Brief',     icon: <Sun className="w-4 h-4" /> },
];

const NAV_INTEL: NavItem[] = [
  { href: '/trends',     label: 'Market Intelligence', icon: <TrendingUp className="w-4 h-4" /> },
  { href: '/market-map', label: 'Market Map',           icon: <Map className="w-4 h-4" /> },
  { href: '/linkedin',   label: 'LinkedIn Posts',       icon: <LinkedinIcon className="w-4 h-4" /> },
];

function SidebarSection({ label }: { label: string }) {
  return (
    <div className="pt-5 pb-1.5 px-3">
      <span className="text-[10px] font-semibold uppercase tracking-widest"
        style={{ color: 'hsl(var(--sidebar-foreground) / 0.35)' }}>
        {label}
      </span>
    </div>
  );
}

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  const baseStyle = 'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group relative';

  if (item.cta && !active) {
    return (
      <Link href={item.href}
        className={cn(
          baseStyle,
          'mb-1 text-white shadow-lg',
          'bg-gradient-to-r from-primary to-violet-500 hover:from-primary/90 hover:to-violet-500/90',
          'shadow-[0_4px_14px_0_hsl(var(--primary)/0.4)]'
        )}>
        {item.icon}
        <span className="flex-1">{item.label}</span>
      </Link>
    );
  }

  return (
    <Link href={item.href}
      className={cn(
        baseStyle,
        active
          ? 'text-white'
          : 'hover:text-white/80'
      )}
      style={active
        ? { backgroundColor: 'hsl(var(--sidebar-muted))', color: 'white' }
        : { color: 'hsl(var(--sidebar-foreground) / 0.65)' }
      }
    >
      {active && (
        <span className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-primary" />
      )}
      <span className={cn('transition-colors', active ? 'text-primary' : 'text-inherit')}>
        {item.icon}
      </span>
      <span className="flex-1">{item.label}</span>
      {item.badge && (
        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-primary/20 text-primary">
          {item.badge}
        </span>
      )}
      {active && <div className="w-1 h-1 rounded-full bg-primary/60 flex-shrink-0" />}
    </Link>
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  const { user } = useAuth();
  const isActive = (href: string) => href === '/' ? pathname === '/' : pathname.startsWith(href);

  return (
    <aside className="w-60 min-h-screen flex flex-col flex-shrink-0 relative"
      style={{ backgroundColor: 'hsl(var(--sidebar))', borderRight: '1px solid hsl(var(--sidebar-border))' }}>
      {/* Top gradient accent */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />

      {/* Brand */}
      <div className="px-5 pt-6 pb-5" style={{ borderBottom: '1px solid hsl(var(--sidebar-border))' }}>
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg bg-gradient-to-br from-primary to-violet-600"
            style={{ boxShadow: '0 4px 14px 0 hsl(var(--primary)/0.45)' }}>
            <Zap className="w-[18px] h-[18px] text-white" strokeWidth={2.5} />
          </div>
          <div>
            <div className="text-white font-bold text-sm tracking-tight">KS Business</div>
            <div className="text-[11px] tracking-wide" style={{ color: 'hsl(var(--sidebar-foreground) / 0.4)' }}>
              Knowledge Systems · BD Intelligence
            </div>
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
        {NAV_MAIN.map(item => (
          <NavLink key={item.href} item={item} active={isActive(item.href)} />
        ))}

        <SidebarSection label="BD Pipeline" />
        {NAV_PIPELINE.map(item => (
          <NavLink key={item.href} item={item} active={isActive(item.href)} />
        ))}

        <SidebarSection label="Intelligence" />
        {NAV_INTEL.map(item => (
          <NavLink key={item.href} item={item} active={isActive(item.href)} />
        ))}
      </nav>

      {/* Footer / Settings */}
      <div className="px-3 py-4" style={{ borderTop: '1px solid hsl(var(--sidebar-border))' }}>
        <Link href="/settings"
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 group"
          style={{ color: 'hsl(var(--sidebar-foreground) / 0.6)' }}
          onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'hsl(var(--sidebar-muted))')}
          onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
        >
          <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-[12px] font-bold text-white bg-gradient-to-br from-primary/60 to-violet-600/60">
            {(user?.full_name ?? user?.email ?? 'U')[0].toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-medium text-white/80 truncate">{user?.full_name ?? user?.email?.split('@')[0] ?? 'User'}</div>
            <div className="text-[11px] truncate" style={{ color: 'hsl(var(--sidebar-foreground) / 0.35)' }}>
              {user?.email ?? 'ks.business'}
            </div>
          </div>
          <Settings className="w-3.5 h-3.5 opacity-0 group-hover:opacity-60 transition-opacity flex-shrink-0" />
        </Link>
      </div>
    </aside>
  );
}
