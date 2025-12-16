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
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { PageHeader } from '@/components/layout/page-header';
import { LoadingSkeletonCard } from '@/components/layout/loading-skeleton';
import { StreamViewport } from '@/components/stream-viewport';
import { TelemetryMap } from '@/components/telemetry-map';
import { TelemetryControls, SimulatorStatusPanel } from '@/components/telemetry-controls';
import { useStreamsStore, useTelemetryStore } from '@/lib/store';
import {
  subscribeToStream,
  unsubscribeFromStream,
  enableStreamDetection,
  getCurrentSubscriptions,
} from '@/lib/socket';
import { Monitor, Map, SplitSquareHorizontal, Zap } from 'lucide-react';

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
  const [view, setView] = useState<'streams' | 'map' | 'split'>('split');
  const [showDetections, setShowDetections] = useState(true);
  const [showPaths, setShowPaths] = useState(true);
  const [showHeadingCones, setShowHeadingCones] = useState(true);
  const [splitPosition, setSplitPosition] = useState(50); // 50/50 split
  
  const { data: streams, isLoading } = useQuery<Stream[]>({
    queryKey: ['streams'],
    queryFn: () => apiClient.listStreams().then((res) => res.data),
  });

  // Load telemetry history when streams are loaded
  const telemetryStore = useTelemetryStore();
  
  // Fetch simulator status
  const { data: simulatorStatus = {}, refetch: refetchSimulatorStatus } = useQuery<Record<string, boolean>>({
    queryKey: ['simulator-status'],
    queryFn: () => apiClient.getSimulatorStatus().then(res => {
      const status: Record<string, boolean> = {};
      res.data.forEach(({ streamId, running }) => {
        status[streamId] = running;
      });
      return status;
    }),
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  // Load telemetry history for all streams
  useEffect(() => {
    if (streams) {
      streams.forEach(stream => {
        // Load recent telemetry history (last 50 points)
        apiClient.listTelemetry(stream.id, { limit: 50 })
          .then(response => {
            telemetryStore.setTelemetryHistory(stream.id, response.data);
          })
          .catch(error => {
            console.warn(`Failed to load telemetry history for stream ${stream.id}:`, error);
          });
      });
    }
  }, [streams, telemetryStore]);

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

  const handleStreamSelectFromMap = (streamId: string) => {
    if (selectedStreamIds.includes(streamId)) {
      // If already selected, set as primary
      setPrimaryStream(streamId);
    } else {
      // If not selected, add it to selection
      if (selectedStreamIds.length < parseInt(viewMode)) {
        addSelectedStream(streamId);
        subscribeToStream(streamId);
        const stream = streams?.find(s => s.id === streamId);
        if (stream?.detectionEnabled) {
          enableStreamDetection(streamId);
        }
      } else {
        // Replace the oldest selection
        const oldestId = selectedStreamIds[0];
        removeSelectedStream(oldestId);
        unsubscribeFromStream(oldestId);
        addSelectedStream(streamId);
        subscribeToStream(streamId);
        
        const streamData = streams?.find(s => s.id === streamId);
        if (streamData?.detectionEnabled) {
          enableStreamDetection(streamId);
        }
      }
    }
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
          {/* View and Control Panel */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <SplitSquareHorizontal className="h-5 w-5" />
                Monitoring Controls
              </CardTitle>
              <CardDescription>
                Configure view mode, streams, and telemetry display options
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* View Mode Selection */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">View Mode</Label>
                <div className="flex gap-2">
                  <Button
                    variant={view === 'streams' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setView('streams')}
                    className="flex items-center gap-2"
                  >
                    <Monitor className="h-4 w-4" />
                    Streams Only
                  </Button>
                  <Button
                    variant={view === 'split' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setView('split')}
                    className="flex items-center gap-2"
                  >
                    <SplitSquareHorizontal className="h-4 w-4" />
                    Split View
                  </Button>
                  <Button
                    variant={view === 'map' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setView('map')}
                    className="flex items-center gap-2"
                  >
                    <Map className="h-4 w-4" />
                    Map Only
                  </Button>
                </div>
              </div>

              {/* View Grid Size and Map Options */}
              {view !== 'map' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Grid Size</Label>
                    <div className="flex gap-2">
                      <Button
                        variant={viewMode === '1' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => handleViewModeChange('1')}
                      >
                        1
                      </Button>
                      <Button
                        variant={viewMode === '2' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => handleViewModeChange('2')}
                      >
                        2
                      </Button>
                      <Button
                        variant={viewMode === '4' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => handleViewModeChange('4')}
                      >
                        4
                      </Button>
                    </div>
                  </div>
                  
                  {view === 'split' && (
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Split Position</Label>
                      <div className="flex items-center gap-2">
                        <span className="text-xs">Streams</span>
                        <input
                          type="range"
                          min="30"
                          max="70"
                          value={splitPosition}
                          onChange={(e) => setSplitPosition(parseInt(e.target.value))}
                          className="flex-1"
                        />
                        <span className="text-xs">Map</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Map Display Options */}
              {view !== 'streams' && (
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Map Features</Label>
                  <div className="flex flex-wrap gap-4">
                    <div className="flex items-center space-x-2">
                      <Switch
                        checked={showDetections}
                        onCheckedChange={setShowDetections}
                        id="show-detections"
                      />
                      <Label htmlFor="show-detections" className="text-sm">Detection Markers</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch
                        checked={showPaths}
                        onCheckedChange={setShowPaths}
                        id="show-paths"
                      />
                      <Label htmlFor="show-paths" className="text-sm">Flight Paths</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch
                        checked={showHeadingCones}
                        onCheckedChange={setShowHeadingCones}
                        id="show-heading"
                      />
                      <Label htmlFor="show-heading" className="text-sm">Heading Cones</Label>
                    </div>
                  </div>
                </div>
              )}

              {/* Stream Selection */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">
                  Select Streams (max {viewMode === 'map' ? 'all' : viewMode})
                </Label>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                  {streams?.map((stream) => (
                    <Button
                      key={stream.id}
                      variant={selectedStreamIds.includes(stream.id) ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => view === 'map' ? handleStreamSelectFromMap(stream.id) : handleStreamSelect(stream.id)}
                      disabled={view !== 'map' && !selectedStreamIds.includes(stream.id) && selectedStreamIds.length >= parseInt(viewMode)}
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
                          {/* Show simulator status */}
                          {simulatorStatus[stream.id] && (
                            <Zap className="h-3 w-3 text-yellow-500" />
                          )}
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
                    Select streams to begin monitoring
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Main Content Area */}
          {view === 'streams' && (
            /* Streams Only View */
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

          {view === 'map' && (
            /* Map Only View */
            <TelemetryMap
              streams={streams || []}
              onStreamSelect={handleStreamSelectFromMap}
              selectedStreamIds={selectedStreamIds}
              showDetections={showDetections}
              showPaths={showPaths}
              showHeadingCones={showHeadingCones}
              height="700px"
            />
          )}

          {view === 'split' && (
            /* Split View */
            <div className="grid gap-4" style={{ gridTemplateColumns: `${splitPosition}% 1fr` }}>
              {/* Streams Panel */}
              <div className="space-y-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Video Streams</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className={`grid gap-2 ${getGridClassName()}`}>
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
                            
                            {/* Mini primary stream indicator */}
                            {primaryStreamId === stream.id && (
                              <div className="absolute top-1 left-1 z-10">
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  className="bg-blue-500/80 hover:bg-blue-500 text-white border-0 text-xs px-2 py-0 h-6"
                                  onClick={() => handleSetPrimary(stream.id)}
                                >
                                  Primary
                                </Button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Map Panel */}
              <div className="space-y-4">
                <TelemetryMap
                  streams={streams || []}
                  onStreamSelect={handleStreamSelectFromMap}
                  selectedStreamIds={selectedStreamIds}
                  showDetections={showDetections}
                  showPaths={showPaths}
                  showHeadingCones={showHeadingCones}
                  height="100%"
                />
              </div>
            </div>
          )}

          {/* Bottom Panel - Telemetry Controls and Status */}
          {(view !== 'streams' || selectedStreams.length > 0) && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Telemetry Controls */}
              {selectedStreams.map(stream => (
                <TelemetryControls
                  key={stream.id}
                  streamId={stream.id}
                  streamName={stream.name}
                  simulatorStatus={simulatorStatus}
                  onStatusChange={() => refetchSimulatorStatus()}
                />
              ))}
              
              {/* Simulator Status Panel */}
              <SimulatorStatusPanel
                streams={streams?.map(s => ({ id: s.id, name: s.name, status: s.status })) || []}
                simulatorStatus={simulatorStatus}
                onRefresh={() => refetchSimulatorStatus()}
              />
            </div>
          )}

          {/* Connection Status */}
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
                        {simulatorStatus[streamId] && (
                          <Zap className="h-3 w-3 ml-1 text-yellow-500" />
                        )}
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