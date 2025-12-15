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
    <div className="hidden border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950 lg:block lg:w-64">
      <div className="sticky top-0 flex h-16 items-center border-b border-slate-200 px-6 dark:border-slate-800">
        <h1 className="text-lg font-bold text-slate-950 dark:text-white">Dashboard</h1>
      </div>

      <nav className="flex flex-col gap-2 p-4">
        {filteredItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-slate-100 text-slate-950 dark:bg-slate-800 dark:text-white'
                  : 'text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800/50'
              }`}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="absolute bottom-0 left-0 right-0 border-t border-slate-200 p-4 dark:border-slate-800">
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800/50"
        >
          <LogOut className="h-4 w-4" />
          Logout
        </button>
      </div>
    </div>
  );
}
