'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

/**
 * EmptyState Component
 * Provides consistent empty state styling with optional icon, title, description, and action
 * Uses design tokens for typography and spacing
 */

interface EmptyStateProps {
  icon?: React.ReactNode;
  title?: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  icon,
  title = 'No items',
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <Card>
      <CardContent className={cn('pt-6', className)}>
        <div className="empty-state">
          {icon && (
            <div className="empty-state-icon">
              {icon}
            </div>
          )}
          <div className="text-center">
            {title && (
              <h3 className="empty-state-title">{title}</h3>
            )}
            {description && (
              <p className="empty-state-description">{description}</p>
            )}
          </div>
          {action && (
            <div className="mt-4">
              {action}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
