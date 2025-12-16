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
import { Download, Share2, Flame, Wind, Thermometer, Camera } from 'lucide-react';
import { useDetectionsStore } from '@/lib/store';
import type { DetectionType, DetectionChannel } from '@/lib/api';

export default function DetectionsPage() {
  const [selectedStream, setSelectedStream] = useState<string>('');
  const [selectedType, setSelectedType] = useState<string>('');

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

  // Helper functions for detection display
  const getDetectionTypeInfo = (detection: Record<string, unknown>) => {
    const detectionType = (detection.detectionType || detection.type || '').toString().toUpperCase();
    
    switch (detectionType) {
      case 'FIRE':
        return { 
          label: 'Fire', 
          icon: <Flame className="h-4 w-4" />, 
          color: 'text-red-600 bg-red-50 border-red-200',
          iconBg: 'bg-red-100'
        };
      case 'SMOKE':
        return { 
          label: 'Smoke', 
          icon: <Wind className="h-4 w-4" />, 
          color: 'text-gray-600 bg-gray-50 border-gray-200',
          iconBg: 'bg-gray-100'
        };
      case 'HOTSPOT':
        return { 
          label: 'Hotspot', 
          icon: <Thermometer className="h-4 w-4" />, 
          color: 'text-orange-600 bg-orange-50 border-orange-200',
          iconBg: 'bg-orange-100'
        };
      default:
        return { 
          label: detectionType || 'Detection', 
          icon: <Camera className="h-4 w-4" />, 
          color: 'text-blue-600 bg-blue-50 border-blue-200',
          iconBg: 'bg-blue-100'
        };
    }
  };

  const getChannelInfo = (detection: Record<string, unknown>) => {
    const channel = detection.channel as string;
    if (!channel) return null;
    
    return {
      label: channel.charAt(0).toUpperCase() + channel.slice(1),
      icon: channel === 'color' ? <Camera className="h-3 w-3" /> : <Thermometer className="h-3 w-3" />,
    };
  };

  // Filter detections by type if selected
  const filteredDetections = detections?.filter(detection => {
    if (!selectedType) return true;
    
    const detectionType = (detection.detectionType || detection.type || '').toString().toUpperCase();
    return detectionType === selectedType.toUpperCase();
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
              <Select value={selectedType} onValueChange={setSelectedType}>
                <SelectTrigger id="type">
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All types</SelectItem>
                  <SelectItem value="fire">🔥 Fire</SelectItem>
                  <SelectItem value="smoke">💨 Smoke</SelectItem>
                  <SelectItem value="hotspot">🌡️ Hotspot</SelectItem>
                  <SelectItem value="person">👤 Person</SelectItem>
                  <SelectItem value="vehicle">🚗 Vehicle</SelectItem>
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
      ) : filteredDetections && filteredDetections.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredDetections.map((detection: Record<string, unknown>) => {
            const typeInfo = getDetectionTypeInfo(detection);
            const channelInfo = getChannelInfo(detection);
            
            return (
              <Card key={detection.id} className={typeInfo.color}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-lg ${typeInfo.iconBg}`}>
                        {typeInfo.icon}
                      </div>
                      <div>
                        <CardTitle className="text-lg">
                          {typeInfo.label}
                        </CardTitle>
                        <CardDescription className="flex items-center gap-2">
                          <span>{new Date(detection.createdAt).toLocaleString()}</span>
                          {channelInfo && (
                            <div className="flex items-center gap-1 px-2 py-1 bg-white/70 rounded text-xs">
                              {channelInfo.icon}
                              {channelInfo.label}
                            </div>
                          )}
                        </CardDescription>
                      </div>
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
                  {/* Enhanced metadata display */}
                  <div className="space-y-2 text-sm">
                    {detection.geoInfo && (
                      <div className="flex justify-between">
                        <span className="text-slate-600 dark:text-slate-400">Location:</span>
                        <span>{detection.geoInfo.latitude?.toFixed(4)}, {detection.geoInfo.longitude?.toFixed(4)}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-slate-600 dark:text-slate-400">Stream:</span>
                      <span>{streams?.find(s => s.id === detection.streamId)?.name || 'Unknown'}</span>
                    </div>
                  </div>

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
            );
          })}
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
