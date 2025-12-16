'use client';

import React from 'react';
import { cn } from '@/lib/utils';

/**
 * PageHeader Component
 * Provides consistent heading and description styling across dashboard pages
 * Follows design tokens for typography and spacing
 */

interface PageHeaderProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  description,
  action,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-8',
        className
      )}
    >
      <div className="page-header">
        <h1 className="page-title">{title}</h1>
        {description && (
          <p className="page-description">{description}</p>
        )}
      </div>
      {action && (
        <div className="flex flex-col gap-2 sm:flex-row sm:gap-2">
          {action}
        </div>
      )}
    </div>
  );
}
