'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { useAuthStore } from '@/lib/store';

/**
 * Dashboard Layout
 * Provides consistent shell structure with responsive design tokens
 * Mobile: stacks vertically (≤1024px)
 * Desktop: sidebar left, main content right
 * Uses design tokens for spacing and background colors
 */

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { user, isLoading } = useAuthStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login');
    }
  }, [user, isLoading, router]);

  if (!mounted || isLoading || !user) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-white dark:bg-slate-950">
        <div className="text-center">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-slate-200 border-t-slate-950 dark:border-slate-800 dark:border-t-white"></div>
          <p className="mt-4 text-slate-600 dark:text-slate-400">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full flex-col bg-white dark:bg-slate-950 lg:flex-row">
      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 transition-opacity duration-200 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          role="presentation"
        />
      )}

      {/* Sidebar */}
      <div
        className={`${
          sidebarOpen ? 'block' : 'hidden'
        } fixed inset-y-0 left-0 z-40 w-64 transition-transform duration-300 lg:relative lg:block lg:w-64`}
      >
        <Sidebar />
      </div>

      {/* Main Content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
        <main className="flex-1 overflow-auto bg-slate-50 dark:bg-slate-900">
          {/* Consistent padding using design tokens: p-4 (sm), p-6 (md), p-8 (lg) */}
          <div className="p-4 sm:p-6 md:p-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
