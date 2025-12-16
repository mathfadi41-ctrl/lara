'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Stream } from '@/lib/api';
import { apiClient } from '@/lib/api';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PageHeader } from '@/components/layout/page-header';
import { EmptyState } from '@/components/layout/empty-state';
import { LoadingSkeletonCard } from '@/components/layout/loading-skeleton';
import { Download, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function DetectionsPage() {
  const [selectedStream, setSelectedStream] = useState<string>('');

  const { data: streams } = useQuery<Stream[]>({
    queryKey: ['streams'],
    queryFn: () => apiClient.listStreams().then((res) => res.data),
  });

  const { data: detections, isLoading } = useQuery({
    queryKey: ['detections', selectedStream],
    queryFn: () =>
      apiClient.listDetections({
        streamId: selectedStream || undefined,
        take: 100,
      }).then((res) => res.data as Array<Record<string, unknown>>),
  });

  /**
   * Detections Page
   * View and manage AI detection events with filtering capabilities
   */

  return (
    <div className="space-y-8">
      <PageHeader
        title="Detection History"
        description="View and manage AI detection events"
      />

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="stream">Stream</Label>
              <Select value={selectedStream} onValueChange={setSelectedStream}>
                <SelectTrigger id="stream">
                  <SelectValue placeholder="All streams" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All streams</SelectItem>
                  {streams?.map((stream) => (
                    <SelectItem key={stream.id} value={stream.id}>
                      {stream.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="type">Detection Type</Label>
              <Select>
                <SelectTrigger id="type">
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All types</SelectItem>
                  <SelectItem value="fire">Fire</SelectItem>
                  <SelectItem value="smoke">Smoke</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confidence">Confidence</Label>
              <Input
                id="confidence"
                type="range"
                min="0"
                max="100"
                className="w-full"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Detections Grid */}
      {isLoading ? (
        <LoadingSkeletonCard count={3} variant="grid" />
      ) : detections && detections.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {detections.map((detection: Record<string, unknown>) => (
            <Card key={detection.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg capitalize">
                      {detection.type}
                    </CardTitle>
                    <CardDescription>
                      {new Date(detection.createdAt).toLocaleString()}
                    </CardDescription>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium">
                      {(detection.confidence * 100).toFixed(1)}%
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      Confidence
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {detection.screenshotKey && (
                  <div className="aspect-video rounded-lg border border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-800">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`${process.env.NEXT_PUBLIC_API_URL}/detections/${detection.id}/screenshot`}
                      alt="Detection"
                      className="h-full w-full rounded-lg object-cover"
                    />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" size="sm" className="w-full">
                    <Download className="mr-2 h-4 w-4" />
                    Download
                  </Button>
                  <Button variant="outline" size="sm" className="w-full">
                    <Share2 className="mr-2 h-4 w-4" />
                    Share
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          title="No detections found"
          description="Detection events will appear here when AI detection is active"
        />
      )}
    </div>
  );
}
