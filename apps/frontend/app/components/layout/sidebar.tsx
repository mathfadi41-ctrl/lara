'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import React from 'react';
import {
  BarChart3,
  Grid3x3,
  LogOut,
  Monitor,
  Settings,
  Users,
} from 'lucide-react';
import { useAuthStore } from '@/lib/store';
import { apiClient } from '@/lib/api';

/**
 * Sidebar Component
 * Navigation sidebar with role-based filtering
 * Uses design tokens for consistent styling, spacing, and focus states
 */

const navItems = [
  {
    href: '/dashboard',
    label: 'Dashboard',
    icon: Grid3x3,
    roles: ['Admin', 'Operator', 'Viewer'],
  },
  {
    href: '/streams',
    label: 'Streams',
    icon: Monitor,
    roles: ['Admin', 'Operator', 'Viewer'],
  },
  {
    href: '/live-monitoring',
    label: 'Live Monitoring',
    icon: BarChart3,
    roles: ['Admin', 'Operator', 'Viewer'],
  },
  {
    href: '/detections',
    label: 'Detection History',
    icon: BarChart3,
    roles: ['Admin', 'Operator', 'Viewer'],
  },
  {
    href: '/users',
    label: 'Users',
    icon: Users,
    roles: ['Admin'],
  },
  {
    href: '/settings',
    label: 'Settings',
    icon: Settings,
    roles: ['Admin', 'Operator', 'Viewer'],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuthStore();

  const handleLogout = async () => {
    apiClient.logout();
    logout();
    window.location.href = '/login';
  };

  const filteredItems = navItems.filter((item) => !user || item.roles.includes(user.role));

  return (
    <div className="hidden flex-col border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950 lg:flex lg:w-64">
      {/* Sidebar Header */}
      <div className="sticky top-0 flex h-16 items-center border-b border-slate-200 px-6 dark:border-slate-800">
        <h1 className="text-lg font-bold tracking-tight text-slate-950 dark:text-white">Dashboard</h1>
      </div>

      {/* Navigation */}
      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-4">
        {filteredItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${
                isActive
                  ? 'bg-slate-100 text-slate-950 dark:bg-slate-800 dark:text-white'
                  : 'text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800/50 focus-visible:ring-offset-slate-950'
              }`}
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Logout Button */}
      <div className="border-t border-slate-200 p-4 dark:border-slate-800">
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition-all duration-200 hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:text-slate-400 dark:hover:bg-slate-800/50 dark:focus-visible:ring-offset-slate-950"
        >
          <LogOut className="h-4 w-4 flex-shrink-0" />
          <span className="truncate">Logout</span>
        </button>
      </div>
    </div>
  );
}
