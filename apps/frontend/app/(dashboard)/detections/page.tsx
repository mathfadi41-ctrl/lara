'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
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
import { Download, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function DetectionsPage() {
  const [selectedStream, setSelectedStream] = useState<string>('');

  const { data: streams } = useQuery({
    queryKey: ['streams'],
    queryFn: () => apiClient.listStreams().then((res) => res.data as Array<Record<string, unknown>>),
  });

  const { data: detections, isLoading } = useQuery({
    queryKey: ['detections', selectedStream],
    queryFn: () =>
      apiClient.listDetections({
        streamId: selectedStream || undefined,
        take: 100,
      }).then((res) => res.data as Array<Record<string, unknown>>),
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Detection History</h1>
        <p className="mt-2 text-slate-600 dark:text-slate-400">
          View and manage AI detection events
        </p>
      </div>

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
                  {streams?.map((stream: any) => (
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
        <div className="flex justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-slate-950 dark:border-slate-800 dark:border-t-white"></div>
        </div>
      ) : detections && detections.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {detections.map((detection: any) => (
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
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-slate-600 dark:text-slate-400">
                No detections found
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
