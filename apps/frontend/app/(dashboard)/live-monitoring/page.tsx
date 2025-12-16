'use client';

import React, { useEffect, useState } from 'react';
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
// Removed unused Select imports
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { PageHeader } from '@/components/layout/page-header';
import { LoadingSkeletonCard } from '@/components/layout/loading-skeleton';
import { StreamViewport } from '@/components/stream-viewport';
import { useStreamsStore } from '@/lib/store';
import {
  subscribeToStream,
  unsubscribeFromStream,
  enableStreamDetection,
  getCurrentSubscriptions,
} from '@/lib/socket';
import { Monitor, Grid, Grid3X3, Grid2X2 } from 'lucide-react';

type ViewMode = '1' | '2' | '4';

interface ViewportSettings {
  [streamId: string]: {
    showOverlay: boolean;
    audioEnabled: boolean;
  };
}

export default function LiveMonitoringPage() {
  const {
    selectedStreamIds,
    primaryStreamId,
    setSelectedStreams,
    setPrimaryStream,
    addSelectedStream,
    removeSelectedStream,
  } = useStreamsStore();
  
  const [viewMode, setViewMode] = useState<ViewMode>('1');
  const [viewportSettings, setViewportSettings] = useState<ViewportSettings>({});
  
  const { data: streams, isLoading } = useQuery<Stream[]>({
    queryKey: ['streams'],
    queryFn: () => apiClient.listStreams().then((res) => res.data),
  });

  // Initialize viewport settings when streams change
  useEffect(() => {
    if (streams) {
      const newSettings: ViewportSettings = {};
      streams.forEach(stream => {
        if (!viewportSettings[stream.id]) {
          newSettings[stream.id] = {
            showOverlay: true,
            audioEnabled: false,
          };
        }
      });
      if (Object.keys(newSettings).length > 0) {
        // Use setTimeout to avoid calling setState synchronously in effect
        setTimeout(() => {
          setViewportSettings(prev => ({ ...prev, ...newSettings }));
        }, 0);
      }
    }
  }, [streams, viewportSettings]);

  // Auto-select streams when view mode changes
  useEffect(() => {
    if (streams && streams.length > 0) {
      const streamCount = parseInt(viewMode);
      const selectedIds = streams.slice(0, streamCount).map(s => s.id);
      
      // Unsubscribe from streams that are no longer selected
      selectedStreamIds.forEach(id => {
        if (!selectedIds.includes(id)) {
          unsubscribeFromStream(id);
        }
      });
      
      // Update selected streams
      setSelectedStreams(selectedIds);
      
      // Subscribe to new selections
      selectedIds.forEach(id => {
        subscribeToStream(id);
        const stream = streams.find(s => s.id === id);
        if (stream?.detectionEnabled) {
          enableStreamDetection(id);
        }
      });
    }
  }, [viewMode, streams, setSelectedStreams, selectedStreamIds]);

  const selectedStreams = streams?.filter(s => selectedStreamIds.includes(s.id)) || [];

  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
  };

  const handleStreamSelect = (streamId: string) => {
    const stream = streams?.find(s => s.id === streamId);
    if (!stream) return;

    if (selectedStreamIds.includes(streamId)) {
      removeSelectedStream(streamId);
      unsubscribeFromStream(streamId);
    } else {
      const maxStreams = parseInt(viewMode);
      if (selectedStreamIds.length >= maxStreams) {
        // Replace the oldest selection
        const oldestId = selectedStreamIds[0];
        removeSelectedStream(oldestId);
        unsubscribeFromStream(oldestId);
      }
      addSelectedStream(streamId);
      subscribeToStream(streamId);
      
      const streamData = streams?.find(s => s.id === streamId);
      if (streamData?.detectionEnabled) {
        enableStreamDetection(streamId);
      }
    }
  };

  const handleToggleOverlay = (streamId: string, enabled: boolean) => {
    setViewportSettings(prev => ({
      ...prev,
      [streamId]: {
        ...prev[streamId],
        showOverlay: enabled,
      },
    }));
  };

  const handleToggleAudio = (streamId: string, enabled: boolean) => {
    setViewportSettings(prev => ({
      ...prev,
      [streamId]: {
        ...prev[streamId],
        audioEnabled: enabled,
      },
    }));
  };

  const handleSetPrimary = (streamId: string) => {
    setPrimaryStream(streamId);
  };

  const getGridClassName = () => {
    switch (viewMode) {
      case '1':
        return 'grid-cols-1';
      case '2':
        return 'grid-cols-1 md:grid-cols-2';
      case '4':
        return 'grid-cols-1 md:grid-cols-2 lg:grid-cols-2';
      default:
        return 'grid-cols-1';
    }
  };

  /**
   * Split-screen Monitoring Page
   * Multi-stream viewing with real-time detection overlays
   */

  return (
    <div className="space-y-6">
      <PageHeader
        title="Split-Screen Monitoring"
        description="Monitor up to 4 streams simultaneously with real-time AI detection"
      />

      {isLoading ? (
        <LoadingSkeletonCard count={2} />
      ) : (
        <>
          {/* Control Panel */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Grid className="h-5 w-5" />
                Stream Controls
              </CardTitle>
              <CardDescription>
                Select streams to monitor and configure view settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* View Mode Selection */}
              <div className="space-y-2">
                <Label>View Mode</Label>
                <div className="flex gap-2">
                  <Button
                    variant={viewMode === '1' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleViewModeChange('1')}
                    className="flex items-center gap-2"
                  >
                    <Monitor className="h-4 w-4" />
                    Single
                  </Button>
                  <Button
                    variant={viewMode === '2' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleViewModeChange('2')}
                    className="flex items-center gap-2"
                  >
                    <Grid2X2 className="h-4 w-4" />
                    Dual
                  </Button>
                  <Button
                    variant={viewMode === '4' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleViewModeChange('4')}
                    className="flex items-center gap-2"
                  >
                    <Grid3X3 className="h-4 w-4" />
                    Quad
                  </Button>
                </div>
              </div>

              {/* Stream Selection */}
              <div className="space-y-2">
                <Label>Select Streams (max {viewMode})</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                  {streams?.map((stream) => (
                    <Button
                      key={stream.id}
                      variant={selectedStreamIds.includes(stream.id) ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => handleStreamSelect(stream.id)}
                      disabled={!selectedStreamIds.includes(stream.id) && selectedStreamIds.length >= parseInt(viewMode)}
                      className="justify-start h-auto p-3"
                    >
                      <div className="flex flex-col items-start text-left">
                        <div className="flex items-center gap-2 w-full">
                          <div
                            className={`h-2 w-2 rounded-full ${
                              stream.status === 'RUNNING'
                                ? 'bg-green-500'
                                : stream.status === 'ERROR'
                                ? 'bg-red-500'
                                : 'bg-slate-400'
                            }`}
                          />
                          <span className="font-medium truncate">{stream.name}</span>
                        </div>
                        <span className="text-xs opacity-75 mt-1">
                          {stream.status} | {stream.fps}fps
                        </span>
                      </div>
                    </Button>
                  ))}
                </div>
                
                {selectedStreamIds.length === 0 && (
                  <p className="text-sm text-slate-500 text-center py-4">
                    Select {viewMode} stream{viewMode === '1' ? '' : 's'} to begin monitoring
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Stream Grid */}
          {selectedStreams.length > 0 && (
            <div className={`grid gap-4 ${getGridClassName()}`}>
              {selectedStreams.map((stream) => {
                const settings = viewportSettings[stream.id] || {
                  showOverlay: true,
                  audioEnabled: false,
                };
                
                return (
                  <div key={stream.id} className="relative">
                    <StreamViewport
                      stream={stream}
                      isPrimary={primaryStreamId === stream.id}
                      showOverlay={settings.showOverlay}
                      audioEnabled={settings.audioEnabled}
                      onToggleOverlay={(enabled) => handleToggleOverlay(stream.id, enabled)}
                      onToggleAudio={(enabled) => handleToggleAudio(stream.id, enabled)}
                      onFullscreen={() => console.log('Fullscreen toggled for stream:', stream.id)}
                    />
                    
                    {/* Primary stream indicator */}
                    <div className="absolute top-2 left-1/2 transform -translate-x-1/2 z-10">
                      {primaryStreamId === stream.id ? (
                        <Button
                          variant="secondary"
                          size="sm"
                          className="bg-blue-500/80 hover:bg-blue-500 text-white border-0"
                          onClick={() => handleSetPrimary(stream.id)}
                        >
                          Primary Stream
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          className="bg-black/50 hover:bg-black/70 text-white border-white/20"
                          onClick={() => handleSetPrimary(stream.id)}
                        >
                          Set as Primary
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Current Subscriptions Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Connection Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm">Active Subscriptions:</span>
                  <span className="text-sm font-medium">
                    {getCurrentSubscriptions().length} stream{getCurrentSubscriptions().length !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {getCurrentSubscriptions().map((streamId) => {
                    const stream = streams?.find(s => s.id === streamId);
                    return (
                      <span
                        key={streamId}
                        className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                      >
                        {stream?.name || streamId}
                      </span>
                    );
                  })}
                </div>
                {getCurrentSubscriptions().length === 0 && (
                  <p className="text-sm text-slate-500">No active stream subscriptions</p>
                )}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}