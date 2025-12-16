'use client';

import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { PageHeader } from '@/components/layout/page-header';
import { LoadingSkeletonCard } from '@/components/layout/loading-skeleton';
import { useDetectionsStore, useStreamsStore } from '@/lib/store';
import { Maximize2 } from 'lucide-react';

export default function LiveMonitoringPage() {
  const { selectedStreamId, setSelectedStreamId } = useStreamsStore();
  const { detections } = useDetectionsStore();
  const [detectionEnabled, setDetectionEnabled] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  const { data: streams, isLoading } = useQuery({
    queryKey: ['streams'],
    queryFn: () => apiClient.listStreams().then((res) => res.data as Array<Record<string, unknown>>),
  });

  const selectedStream = streams?.find((s: Record<string, unknown>) => s.id === selectedStreamId);

  useEffect(() => {
    if (streams && streams.length > 0 && !selectedStreamId) {
      const firstStream = streams[0] as Record<string, unknown>;
      setSelectedStreamId(firstStream.id as string);
    }
  }, [streams, selectedStreamId, setSelectedStreamId]);

  /**
   * Live Monitoring Page
   * Real-time stream viewing with AI detection overlay controls
   */

  return (
    <div className="space-y-8">
      <PageHeader
        title="Live Monitoring"
        description="Watch streams in real-time with AI detection overlays"
      />

      {isLoading ? (
        <LoadingSkeletonCard count={2} />
      ) : (
        <>
          {/* Stream Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Stream Control</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="stream-select">Select Stream</Label>
                  <Select value={selectedStreamId || ''} onValueChange={setSelectedStreamId}>
                    <SelectTrigger id="stream-select">
                      <SelectValue placeholder="Select a stream" />
                    </SelectTrigger>
                    <SelectContent>
                      {streams?.map((stream: any) => (
                        <SelectItem key={stream.id} value={stream.id}>
                          {stream.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Stream Status</Label>
                  <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-800">
                    <div
                      className={`h-3 w-3 rounded-full ${
                        selectedStream?.isRunning ? 'bg-green-500' : 'bg-slate-300 dark:bg-slate-700'
                      }`}
                    />
                    <span className="text-sm">
                      {selectedStream?.isRunning ? 'Running' : 'Stopped'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800">
                <Label htmlFor="ai-toggle">Enable AI Detection</Label>
                <Switch
                  id="ai-toggle"
                  checked={detectionEnabled}
                  onCheckedChange={setDetectionEnabled}
                />
              </div>
            </CardContent>
          </Card>

          {/* Video Player */}
          <Card className={fullscreen ? 'fixed inset-0 z-50 rounded-none' : ''}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle>{selectedStream?.name || 'No stream selected'}</CardTitle>
                <CardDescription>
                  {selectedStream?.rtspUrl}
                </CardDescription>
              </div>
              <button
                onClick={() => setFullscreen(!fullscreen)}
                className="rounded-md p-2 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <Maximize2 className="h-4 w-4" />
              </button>
            </CardHeader>
            <CardContent className="aspect-video bg-black">
              {selectedStream && selectedStream.isRunning ? (
                <div className="h-full w-full flex items-center justify-center text-slate-400">
                  <div className="text-center">
                    <p className="text-sm">HLS/WebRTC stream would render here</p>
                    <p className="text-xs mt-2">Stream: {selectedStream.rtspUrl}</p>
                  </div>
                </div>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-400">
                  <p className="text-sm">Stream not running</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Detection Events */}
          {detectionEnabled && detections.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Recent Detections</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {detections.slice(0, 10).map((detection: any, index: number) => (
                    <div
                      key={index}
                      className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-800"
                    >
                      <div>
                        <p className="text-sm font-medium capitalize">{detection.type}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {(detection.confidence * 100).toFixed(1)}% confidence
                        </p>
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {new Date(detection.createdAt).toLocaleTimeString()}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
