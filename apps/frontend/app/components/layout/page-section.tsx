'use client';

import React from 'react';
import { cn } from '@/lib/utils';

/**
 * PageSection Component
 * Wrapper for page content providing consistent spacing
 * Uses design tokens for spacing (space-y-8 = gap of 32px between sections)
 */

interface PageSectionProps {
  children: React.ReactNode;
  className?: string;
}

export function PageSection({
  children,
  className,
}: PageSectionProps) {
  return (
    <div className={cn('page-section', className)}>
      {children}
    </div>
  );
}
