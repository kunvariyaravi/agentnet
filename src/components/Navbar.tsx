'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import ThemeToggle from './ThemeToggle';

export default function Navbar() {
  const pathname = usePathname();
  const [user, setUser] = useState<any>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/api/auth/me')
      .then(async r => {
        // Only 401 means logged out — transient 429/5xx must not flip the nav to logged-out state
        if (r.status === 401) { setUser(null); return; }
        if (!r.ok) return;
        const d = await r.json();
        setUser(d.user ?? null);
      })
      .catch(() => {});
  }, []);

  // Close profile dropdown on route change
  useEffect(() => {
    setProfileOpen(false);
    setMobileOpen(false);
  }, [pathname]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setUser(null);
    window.location.href = '/';
  };

  const navLinks = [
    { href: '/works', label: 'My Works' },
    { href: '/agents', label: 'Browse' },
    { href: '/agents/create', label: 'Publish' },
  ];

  const profileMenuItems = [
    { href: '/agents?mine=true', label: 'My Agents', icon: 'M12 2L2 7l10 5 10-5-10-5z M2 17l10 5 10-5 M2 12l10 5 10-5' },
    { href: '/works', label: 'My Works', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2 M9 5a2 2 0 012-2h2a2 2 0 012 2 M9 5a2 2 0 002 2h2a2 2 0 002-2 M9 14l2 2 4-4' },
    { href: '/profile', label: 'Profile', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' },
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-[var(--border)] bg-[var(--background)]/80 backdrop-blur-xl">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link href={user ? "/agents" : "/"} className="flex items-center gap-2.5 shrink-0">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--primary)]">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                <path d="M2 17l10 5 10-5"/>
                <path d="M2 12l10 5 10-5"/>
              </svg>
            </div>
            <span className="text-lg font-semibold tracking-tight">AgentNet</span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map(link => (
              <Link
                key={link.href}
                href={user ? link.href : '/login'}
                className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                  pathname === link.href
                    ? 'bg-[var(--secondary)] text-[var(--foreground)]'
                    : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--secondary)]/50'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* Auth / Profile */}
          <div className="hidden md:flex items-center gap-3">
            <ThemeToggle />
            {user ? (
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setProfileOpen(!profileOpen)}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-[var(--secondary)] transition-colors"
                >
                  <div className="h-7 w-7 rounded-full bg-[var(--primary)]/10 text-[var(--primary)] flex items-center justify-center text-xs font-semibold">
                    {user.name?.charAt(0)}
                  </div>
                  <span className="text-sm font-medium">{user.name}</span>
                  <svg
                    width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                    className={`text-[var(--muted-foreground)] transition-transform ${profileOpen ? 'rotate-180' : ''}`}
                  >
                    <path d="M6 9l6 6 6-6"/>
                  </svg>
                </button>

                {/* Dropdown */}
                {profileOpen && (
                  <div className="absolute right-0 top-full mt-1 w-56 rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-xl overflow-hidden">
                    {/* User info header */}
                    <div className="px-4 py-3 border-b border-[var(--border)]">
                      <div className="text-sm font-semibold truncate">{user.name}</div>
                      <div className="text-xs text-[var(--muted-foreground)] truncate">{user.email}</div>
                    </div>

                    {/* Menu items */}
                    <div className="py-1.5">
                      {profileMenuItems.map(item => (
                        <Link
                          key={item.label}
                          href={item.href}
                          className="flex items-center gap-3 px-4 py-2 text-sm text-[var(--muted-foreground)] hover:bg-[var(--secondary)] hover:text-[var(--foreground)] transition-colors"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                            <path d={item.icon}/>
                          </svg>
                          {item.label}
                        </Link>
                      ))}
                    </div>

                    {/* Admin section */}
                    {user.role === 'admin' && (
                      <>
                        <div className="border-t border-[var(--border)]" />
                        <Link
                          href="/admin"
                          className="flex items-center gap-3 px-4 py-2 text-sm text-[var(--muted-foreground)] hover:bg-[var(--secondary)] hover:text-[var(--foreground)] transition-colors"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                            <path d="M12 2L3 7v6c0 5 3.5 8.5 9 10 5.5-1.5 9-5 9-10V7l-9-5z"/>
                          </svg>
                          Admin Dashboard
                        </Link>
                      </>
                    )}

                    {/* Logout */}
                    <div className="border-t border-[var(--border)]">
                      <button
                        onClick={handleLogout}
                        className="flex w-full items-center gap-3 px-4 py-2 text-sm text-[var(--muted-foreground)] hover:bg-[var(--secondary)] hover:text-[var(--foreground)] transition-colors"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                          <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4 M16 17l5-5-5-5 M21 12H9"/>
                        </svg>
                        Logout
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link href="/login" className="px-3 py-2 text-sm font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
                  Log in
                </Link>
                <Link href="/signup" className="px-4 py-2 text-sm font-medium bg-[var(--primary)] text-white rounded-lg hover:bg-[var(--primary)]/90 transition-colors">
                  Sign up
                </Link>
              </div>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden flex items-center gap-1">
            <ThemeToggle />
            <button
              className="p-2 text-[var(--muted-foreground)]"
              onClick={() => setMobileOpen(!mobileOpen)}
            >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {mobileOpen ? <path d="M18 6L6 18M6 6l12 12"/> : <path d="M4 6h16M4 12h16M4 18h16"/>}
            </svg>
          </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="md:hidden border-t border-[var(--border)] py-4 space-y-2">
            {navLinks.map(link => (
              <Link
                key={link.href}
                href={user ? link.href : '/login'}
                className="block px-3 py-2 text-sm rounded-lg text-[var(--muted-foreground)] hover:bg-[var(--secondary)]"
              >
                {link.label}
              </Link>
            ))}

            {/* Divider */}
            <div className="border-t border-[var(--border)] my-2" />

            {user ? (
              <>
                <div className="px-3 py-1 text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">
                  {user.name}
                </div>
                {profileMenuItems.map(item => (
                  <Link
                    key={item.label}
                    href={item.href}
                    className="flex items-center gap-3 px-3 py-2 text-sm rounded-lg text-[var(--muted-foreground)] hover:bg-[var(--secondary)]"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                      <path d={item.icon}/>
                    </svg>
                    {item.label}
                  </Link>
                ))}
                {user.role === 'admin' && (
                  <Link href="/admin" className="flex items-center gap-3 px-3 py-2 text-sm rounded-lg text-[var(--muted-foreground)] hover:bg-[var(--secondary)]">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                      <path d="M12 2L3 7v6c0 5 3.5 8.5 9 10 5.5-1.5 9-5 9-10V7l-9-5z"/>
                    </svg>
                    Admin Dashboard
                  </Link>
                )}
                <button onClick={handleLogout} className="flex items-center gap-3 w-full text-left px-3 py-2 text-sm rounded-lg text-[var(--muted-foreground)] hover:bg-[var(--secondary)]">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                    <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4 M16 17l5-5-5-5 M21 12H9"/>
                  </svg>
                  Logout
                </button>
              </>
            ) : (
              <div className="flex flex-col gap-2">
                <Link href="/login" className="block px-3 py-2 text-sm rounded-lg text-[var(--muted-foreground)] hover:bg-[var(--secondary)]">Log in</Link>
                <Link href="/signup" className="block px-3 py-2 text-sm rounded-lg bg-[var(--primary)] text-white text-center">Sign up</Link>
              </div>
            )}
          </div>
        )}
      </div>
    </nav>
  );
}
