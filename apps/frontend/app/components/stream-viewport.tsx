'use client';

import React, { useRef, useEffect, useState } from 'react';
import { Maximize2, Minimize2, Eye, EyeOff, Volume2, VolumeX, Thermometer, Camera } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { Stream, StreamType, SplitLayout } from '@/lib/api';
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

  // Get enhanced detection styling
  const { getDetectionStyle, getDetectionsByChannel } = useDetectionsStore();
  const streamType = stream.type || 'COLOR';

  // Helper function to get stream type color and icon
  const getStreamTypeBadge = (type: StreamType) => {
    switch (type) {
      case 'COLOR':
        return { label: 'Color', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200', icon: <Camera className="h-3 w-3" /> };
      case 'THERMAL':
        return { label: 'Thermal', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200', icon: <Thermometer className="h-3 w-3" /> };
      case 'SPLIT':
        return { label: 'Split', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-200', icon: <Camera className="h-3 w-3" /> };
      default:
        return { label: 'Unknown', color: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-200', icon: <Camera className="h-3 w-3" /> };
    }
  };

  // Helper function to get split layout indicator
  const getSplitLayoutIndicator = (layout?: SplitLayout) => {
    if (!layout) return null;
    return layout === 'LEFT_RIGHT' ? 'L|R' : 'T|B';
  };

  // Draw detections on canvas overlay
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !showOverlay) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw split layout guides if applicable
    if (streamType === 'SPLIT' && stream.splitLayout) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.lineWidth = 2;
      ctx.setLineDash([10, 10]);
      
      if (stream.splitLayout === 'LEFT_RIGHT') {
        ctx.beginPath();
        ctx.moveTo(canvas.width / 2, 0);
        ctx.lineTo(canvas.width / 2, canvas.height);
        ctx.stroke();
        
        // Label halves
        ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.font = '14px Inter, system-ui, sans-serif';
        ctx.fillText('Color', 10, 20);
        ctx.fillText('Thermal', canvas.width - 60, 20);
      } else {
        ctx.beginPath();
        ctx.moveTo(0, canvas.height / 2);
        ctx.lineTo(canvas.width, canvas.height / 2);
        ctx.stroke();
        
        // Label halves
        ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.font = '14px Inter, system-ui, sans-serif';
        ctx.fillText('Color', 10, 20);
        ctx.fillText('Thermal', 10, canvas.height - 10);
      }
      ctx.setLineDash([]);
    }

    // Draw detection bounding boxes
    recentDetections.forEach((detection) => {
      if (detection.boundingBox) {
        const { x, y, width, height } = detection.boundingBox;
        
        // Scale bounding box to canvas size (assuming 1920x1080 source)
        const scaleX = canvas.width / 1920;
        const scaleY = canvas.height / 1080;
        
        let scaledX = x * scaleX;
        let scaledY = y * scaleY;
        let scaledWidth = width * scaleX;
        let scaledHeight = height * scaleY;

        // Adjust for split stream coordinates
        if (streamType === 'SPLIT' && detection.channel && stream.splitLayout) {
          if (detection.channel === 'thermal') {
            if (stream.splitLayout === 'LEFT_RIGHT') {
              scaledX += canvas.width / 2; // Offset for right half
            } else {
              scaledY += canvas.height / 2; // Offset for bottom half
            }
          }
        }

        // Get enhanced styling
        const style = getDetectionStyle(detection, streamType);
        
        // Draw bounding box with enhanced styling
        ctx.strokeStyle = style.color;
        ctx.lineWidth = streamType === 'THERMAL' ? 3 : 2; // Thicker lines for thermal
        ctx.setLineDash(streamType === 'THERMAL' ? [] : [5, 5]);
        ctx.strokeRect(scaledX, scaledY, scaledWidth, scaledHeight);

        // Draw label with channel info
        ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        const labelText = `${style.icon} ${style.label} (${(detection.confidence * 100).toFixed(1)}%)` +
                         (detection.channel ? ` [${detection.channel}]` : '');
        const labelWidth = ctx.measureText(labelText).width + 10;
        ctx.fillRect(scaledX, scaledY - 30, Math.max(labelWidth, scaledWidth), 25);
        
        ctx.fillStyle = 'white';
        ctx.font = '11px Inter, system-ui, sans-serif';
        ctx.fillText(labelText, scaledX + 5, scaledY - 12);
      }
    });
  }, [recentDetections, showOverlay, streamType, stream.splitLayout, getDetectionStyle]);

  return (
    <Card 
      ref={containerRef}
      className={`relative overflow-hidden ${isPrimary ? 'ring-2 ring-blue-500' : ''} ${className}`}
    >
      <CardContent className="p-0 aspect-video relative">
        {/* Video placeholder with enhanced styling */}
        <div className={`w-full h-full flex items-center justify-center text-slate-400 ${
          streamType === 'THERMAL' ? 'bg-gradient-to-br from-gray-900 via-red-900 to-black' : 
          streamType === 'SPLIT' ? 'bg-gradient-to-r from-blue-900 via-purple-900 to-red-900' :
          'bg-black'
        }`}>
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
              
              {/* Show split layout indicator */}
              {streamType === 'SPLIT' && stream.splitLayout && (
                <div className="flex items-center justify-center gap-2 mt-2">
                  <span className="text-xs px-2 py-1 bg-blue-600/30 rounded">
                    {getSplitLayoutIndicator(stream.splitLayout)}
                  </span>
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
          <div className="flex items-center gap-2 mt-1">
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
            <span className="text-xs">
              {stream.fps}fps | {stream.avgLatencyMs.toFixed(0)}ms
            </span>
          </div>
          
          {/* Stream type badge */}
          <div className="flex items-center gap-1 mt-1">
            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium ${getStreamTypeBadge(streamType).color}`}>
              {getStreamTypeBadge(streamType).icon}
              {getStreamTypeBadge(streamType).label}
            </span>
            {streamType === 'SPLIT' && stream.splitLayout && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-purple-500/20 text-purple-300">
                <Camera className="h-2 w-2" />
                {getSplitLayoutIndicator(stream.splitLayout)}
              </span>
            )}
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
                {recentDetections.slice(0, 3).map((detection, index) => {
                  const style = getDetectionStyle(detection, streamType);
                  return (
                    <div key={index} className="flex justify-between items-center">
                      <div className="flex items-center gap-1">
                        <span>{style.icon}</span>
                        <span>{style.label}</span>
                        {detection.channel && (
                          <span className="text-xs opacity-75">[{detection.channel}]</span>
                        )}
                      </div>
                      <span className="text-xs opacity-75">
                        {(detection.confidence * 100).toFixed(0)}%
                      </span>
                    </div>
                  );
                })}
              </div>
              {recentDetections.length > 3 && (
                <p className="text-xs opacity-75 mt-1">
                  +{recentDetections.length - 3} more
                </p>
              )}
              
              {/* Show channel breakdown for split streams */}
              {streamType === 'SPLIT' && stream.splitLayout && (
                <div className="mt-2 pt-2 border-t border-white/20">
                  <div className="flex justify-between text-xs">
                    <span>Color: {getDetectionsByChannel(stream.id, 'color').length}</span>
                    <span>Thermal: {getDetectionsByChannel(stream.id, 'thermal').length}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}