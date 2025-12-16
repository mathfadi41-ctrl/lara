import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';
import { apiClient } from '@/lib/api';
import { useTelemetryStore } from '@/lib/store';
import { Play, Square, Zap } from 'lucide-react';
import { toast } from 'sonner';

interface TelemetryControlsProps {
  streamId: string;
  streamName: string;
  simulatorStatus: Record<string, boolean>;
  onStatusChange: () => void;
}

export const TelemetryControls: React.FC<TelemetryControlsProps> = ({
  streamId,
  streamName,
  simulatorStatus,
  onStatusChange,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const latestTelemetry = useTelemetryStore(state => state.getLatestTelemetry(streamId));
  
  const isRunning = simulatorStatus[streamId] || false;
  
  const handleStartSimulator = async () => {
    setIsLoading(true);
    try {
      await apiClient.startTelemetrySimulator(streamId);
      toast.success('Telemetry simulator started', {
        description: `Simulator started for ${streamName}`,
      });
      onStatusChange();
    } catch (error) {
      toast.error('Failed to start simulator', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleStopSimulator = async () => {
    setIsLoading(true);
    try {
      await apiClient.stopTelemetrySimulator(streamId);
      toast.success('Telemetry simulator stopped', {
        description: `Simulator stopped for ${streamName}`,
      });
      onStatusChange();
    } catch (error) {
      toast.error('Failed to stop simulator', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Zap className="h-4 w-4" />
          Telemetry Simulator
        </CardTitle>
        <CardDescription>
          Control fake telemetry data for testing
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Current Status */}
        <div className="flex items-center justify-between">
          <Label className="text-sm">Status</Label>
          <Badge variant={isRunning ? 'default' : 'secondary'}>
            {isRunning ? 'Running' : 'Stopped'}
          </Badge>
        </div>
        
        {/* Telemetry Display */}
        {latestTelemetry && (
          <>
            <Separator />
            <div className="space-y-2">
              <Label className="text-sm font-medium">Current Telemetry</Label>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-muted-foreground">Position:</span>
                  <div>{latestTelemetry.latitude.toFixed(4)}, {latestTelemetry.longitude.toFixed(4)}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Altitude:</span>
                  <div>{latestTelemetry.altitude.toFixed(0)} m</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Speed:</span>
                  <div>{latestTelemetry.speed.toFixed(1)} m/s</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Heading:</span>
                  <div>{latestTelemetry.heading.toFixed(0)}°</div>
                </div>
              </div>
            </div>
          </>
        )}
        
        {/* Controls */}
        <Separator />
        <div className="flex gap-2">
          <Button
            size="sm"
            variant={isRunning ? "destructive" : "default"}
            onClick={isRunning ? handleStopSimulator : handleStartSimulator}
            disabled={isLoading}
            className="flex-1"
          >
            {isLoading ? (
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
                Loading...
              </div>
            ) : isRunning ? (
              <>
                <Square className="h-3 w-3 mr-1" />
                Stop
              </>
            ) : (
              <>
                <Play className="h-3 w-3 mr-1" />
                Start
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

interface SimulatorStatusPanelProps {
  streams: Array<{ id: string; name: string; status: string }>;
  simulatorStatus: Record<string, boolean>;
  onRefresh: () => void;
}

export const SimulatorStatusPanel: React.FC<SimulatorStatusPanelProps> = ({
  streams,
  simulatorStatus,
}) => {
  const runningCount = Object.values(simulatorStatus).filter(Boolean).length;
  const totalCount = streams.length;
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Zap className="h-5 w-5" />
          Simulator Status
        </CardTitle>
        <CardDescription>
          Overview of telemetry simulator instances
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary */}
        <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4" />
            <span className="font-medium">Active Simulators</span>
          </div>
          <Badge variant="default">
            {runningCount} / {totalCount}
          </Badge>
        </div>
        
        {/* Stream Status List */}
        <div className="space-y-2">
          {streams.map(stream => {
            const isSimRunning = simulatorStatus[stream.id];
            return (
              <div key={stream.id} className="flex items-center justify-between p-2 border rounded">
                <div className="flex items-center gap-2">
                  <div
                    className={`w-2 h-2 rounded-full ${
                      stream.status === 'RUNNING' ? 'bg-green-500' : 'bg-gray-400'
                    }`}
                  />
                  <span className="text-sm font-medium">{stream.name}</span>
                </div>
                <Badge variant={isSimRunning ? 'default' : 'secondary'} className="text-xs">
                  {isSimRunning ? 'Simulating' : 'Off'}
                </Badge>
              </div>
            );
          })}
        </div>
        
        {streams.length === 0 && (
          <div className="text-center py-4 text-muted-foreground">
            No streams available
          </div>
        )}
      </CardContent>
    </Card>
  );
};