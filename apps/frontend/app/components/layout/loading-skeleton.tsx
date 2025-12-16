'use client';

import React from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

/**
 * LoadingSkeletonCard Component
 * Displays a loading skeleton using design tokens
 * Useful for consistent loading states across dashboard pages
 */

interface LoadingSkeletonCardProps {
  count?: number;
  variant?: 'card' | 'grid';
}

export function LoadingSkeletonCard({ count = 3, variant = 'card' }: LoadingSkeletonCardProps) {
  if (variant === 'grid') {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="skeleton rounded-lg h-48" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i}>
          <CardHeader className="space-y-2">
            <div className="skeleton h-6 w-3/4" />
            <div className="skeleton h-4 w-1/2" />
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="skeleton h-4 w-full" />
              <div className="skeleton h-4 w-5/6" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
