'use client';

import React, { useRef, useEffect, useState } from 'react';
import { Maximize2, Minimize2, Eye, EyeOff, Volume2, VolumeX } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { Stream } from '@/lib/api';
import { useDetectionsStore } from '@/lib/store';

interface StreamViewportProps {
  stream: Stream;
  isPrimary?: boolean;
  showOverlay: boolean;
  audioEnabled: boolean;
  onToggleOverlay: (enabled: boolean) => void;
  onToggleAudio: (enabled: boolean) => void;
  onFullscreen: () => void;
  className?: string;
}

export function StreamViewport({
  stream,
  isPrimary = false,
  showOverlay,
  audioEnabled,
  onToggleOverlay,
  onToggleAudio,
  onFullscreen,
  className = '',
}: StreamViewportProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  const detections = useDetectionsStore(state => state.getDetectionsForStream(stream.id));
  const recentDetections = detections.slice(0, 10); // Show last 10 detections

  const handleFullscreen = () => {
    if (!isFullscreen) {
      if (containerRef.current?.requestFullscreen) {
        containerRef.current.requestFullscreen();
        setIsFullscreen(true);
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
        setIsFullscreen(false);
      }
    }
    onFullscreen();
  };

  // Handle fullscreen change events
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Draw detections on canvas overlay
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !showOverlay) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw detection bounding boxes
    recentDetections.forEach((detection) => {
      if (detection.boundingBox) {
        const { x, y, width, height } = detection.boundingBox;
        
        // Scale bounding box to canvas size (assuming 1920x1080 source)
        const scaleX = canvas.width / 1920;
        const scaleY = canvas.height / 1080;
        
        const scaledX = x * scaleX;
        const scaledY = y * scaleY;
        const scaledWidth = width * scaleX;
        const scaledHeight = height * scaleY;

        // Draw bounding box
        ctx.strokeStyle = detection.type === 'person' ? '#ef4444' : 
                         detection.type === 'vehicle' ? '#3b82f6' : '#22c55e';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.strokeRect(scaledX, scaledY, scaledWidth, scaledHeight);

        // Draw label
        ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillRect(scaledX, scaledY - 25, scaledWidth, 25);
        
        ctx.fillStyle = 'white';
        ctx.font = '12px Inter, system-ui, sans-serif';
        ctx.fillText(
          `${detection.type} (${(detection.confidence * 100).toFixed(1)}%)`,
          scaledX + 5,
          scaledY - 8
        );
      }
    });
  }, [recentDetections, showOverlay]);

  return (
    <Card 
      ref={containerRef}
      className={`relative overflow-hidden ${isPrimary ? 'ring-2 ring-blue-500' : ''} ${className}`}
    >
      <CardContent className="p-0 aspect-video relative">
        {/* Video placeholder */}
        <div className="w-full h-full bg-black flex items-center justify-center text-slate-400">
          {stream.status === 'RUNNING' ? (
            <div className="text-center">
              <p className="text-sm">HLS/WebRTC stream: {stream.name}</p>
              <p className="text-xs mt-1 opacity-75">Stream: {stream.rtspUrl}</p>
              {audioEnabled && (
                <div className="flex items-center justify-center gap-1 mt-2">
                  <Volume2 className="h-3 w-3" />
                  <span className="text-xs">Audio enabled</span>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center">
              <p className="text-sm">Stream not running</p>
              <div
                className={`h-3 w-3 rounded-full mx-auto mt-2 ${
                  stream.status === 'ERROR'
                    ? 'bg-red-500'
                    : 'bg-slate-400'
                }`}
              />
            </div>
          )}
        </div>

        {/* Detection overlay canvas */}
        {showOverlay && recentDetections.length > 0 && (
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full pointer-events-none"
            width={1920}
            height={1080}
          />
        )}

        {/* Stream info overlay */}
        <div className="absolute top-2 left-2 bg-black/70 text-white px-2 py-1 rounded text-xs">
          <div className="flex items-center gap-2">
            <span className="font-medium">{stream.name}</span>
            {isPrimary && (
              <span className="bg-blue-500 text-white px-1 py-0.5 rounded text-xs">
                Primary
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 mt-1">
            <div
              className={`h-2 w-2 rounded-full ${
                stream.status === 'RUNNING'
                  ? 'bg-green-500'
                  : stream.status === 'ERROR'
                  ? 'bg-red-500'
                  : 'bg-slate-400'
              }`}
            />
            <span className="text-xs">{stream.status}</span>
            <span className="text-xs ml-1">
              {stream.fps}fps | {stream.avgLatencyMs.toFixed(0)}ms
            </span>
          </div>
        </div>

        {/* Controls overlay */}
        <div className="absolute top-2 right-2 flex gap-1">
          <Button
            variant="secondary"
            size="sm"
            className="h-8 w-8 p-0 bg-black/70 hover:bg-black/80 text-white border-white/20"
            onClick={() => onToggleOverlay(!showOverlay)}
            title={showOverlay ? 'Hide overlay' : 'Show overlay'}
          >
            {showOverlay ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
          </Button>
          
          <Button
            variant="secondary"
            size="sm"
            className="h-8 w-8 p-0 bg-black/70 hover:bg-black/80 text-white border-white/20"
            onClick={() => onToggleAudio(!audioEnabled)}
            title={audioEnabled ? 'Mute audio' : 'Enable audio'}
          >
            {audioEnabled ? <Volume2 className="h-3 w-3" /> : <VolumeX className="h-3 w-3" />}
          </Button>
          
          <Button
            variant="secondary"
            size="sm"
            className="h-8 w-8 p-0 bg-black/70 hover:bg-black/80 text-white border-white/20"
            onClick={handleFullscreen}
            title="Toggle fullscreen"
          >
            {isFullscreen ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
          </Button>
        </div>

        {/* Recent detections overlay (bottom left) */}
        {recentDetections.length > 0 && (
          <div className="absolute bottom-2 left-2 max-w-xs">
            <div className="bg-black/70 text-white p-2 rounded text-xs">
              <p className="font-medium mb-1">Recent detections:</p>
              <div className="space-y-1">
                {recentDetections.slice(0, 3).map((detection, index) => (
                  <div key={index} className="flex justify-between items-center">
                    <span className="capitalize">{detection.type}</span>
                    <span className="text-xs opacity-75">
                      {(detection.confidence * 100).toFixed(0)}%
                    </span>
                  </div>
                ))}
              </div>
              {recentDetections.length > 3 && (
                <p className="text-xs opacity-75 mt-1">
                  +{recentDetections.length - 3} more
                </p>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}