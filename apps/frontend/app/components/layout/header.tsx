'use client';

import React, { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { Moon, Sun, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/lib/store';

/**
 * Header Component
 * Sticky header with theme toggle and mobile menu button
 * Uses design tokens for consistent styling and focus states
 */

interface HeaderProps {
  onMenuClick?: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  const { theme, setTheme } = useTheme();
  const { user } = useAuthStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Use setTimeout to avoid calling setState synchronously in effect
    setTimeout(() => {
      setMounted(true);
    }, 0);
  }, []);

  if (!mounted) return null;

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white transition-all duration-200 dark:border-slate-800 dark:bg-slate-950">
      <div className="flex h-16 items-center justify-between gap-4 px-4 sm:px-6 md:px-8">
        <div className="flex items-center gap-3">
          {onMenuClick && (
            <button
              onClick={onMenuClick}
              className="inline-flex items-center justify-center rounded-md p-2 text-slate-500 transition-colors duration-200 hover:bg-slate-100 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 lg:hidden dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-50 dark:focus-visible:ring-offset-slate-950"
              aria-label="Toggle sidebar"
            >
              <Menu className="h-6 w-6" />
            </button>
          )}
          <h2 className="truncate text-base font-semibold text-slate-950 dark:text-white sm:text-lg">
            {user?.email}
          </h2>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
          >
            {theme === 'light' ? (
              <Moon className="h-4 w-4" />
            ) : (
              <Sun className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </header>
  );
}
