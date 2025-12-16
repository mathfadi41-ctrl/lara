'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L, { LatLngExpression, DivIcon } from 'leaflet';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import type { Stream } from '@/lib/api';
import { useTelemetryStore, useDetectionsStore } from '@/lib/store';
import { Navigation, MapPin, Route } from 'lucide-react';
import { formatCoordinates, formatSpeed, formatAltitude, formatHeading } from '@/lib/utils';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet default markers
delete (L.Icon.Default.prototype as unknown)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Stream type icons
const createStreamIcon = (streamType: string, status: string) => {
  const isActive = status === 'RUNNING';
  const baseIcon = `
    <div class="stream-marker ${isActive ? 'active' : 'inactive'} ${streamType.toLowerCase()}">
      <div class="marker-inner">
        ${streamType === 'COLOR' ? '📹' : streamType === 'THERMAL' ? '🌡️' : '📊'}
      </div>
    </div>
  `;
  
  return new DivIcon({
    html: baseIcon,
    className: 'custom-stream-marker',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
};

// Detection marker icons
const createDetectionIcon = (detectionType: string, streamType: string) => {
  const color = streamType === 'THERMAL' ? '#FFFF00' : streamType === 'SPLIT' ? '#9932CC' : '#0066CC';
  const icon = detectionType === 'FIRE' ? '🔥' : detectionType === 'SMOKE' ? '💨' : detectionType === 'HOTSPOT' ? '🌡️' : '📍';
  
  return new DivIcon({
    html: `<div class="detection-marker" style="background-color: ${color}">${icon}</div>`,
    className: 'custom-detection-marker',
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
};

// Heading cone component
const HeadingCone: React.FC<{ position: LatLngExpression; heading: number }> = ({ position, heading }) => {
  const map = useMap();
  const coneRef = useRef<L.Polygon | null>(null);
  
  useEffect(() => {
    if (!map) return;
    
    // Create a triangular cone pointing in the heading direction
    const headingRad = (heading * Math.PI) / 180;
    const center = L.latLng(position as [number, number]);
    const size = 100; // meters
    const width = size * 0.5; // cone width
    
    const points = [];
    const steps = 3;
    for (let i = 0; i <= steps; i++) {
      const angle = headingRad - (width / size) + (i * (width / size) / steps);
      const point = L.latLng(
        center.lat + Math.sin(angle) * size / 111111, // Rough conversion to lat/lng
        center.lng + Math.cos(angle) * size / (111111 * Math.cos(center.lat * Math.PI / 180))
      );
      points.push(point);
    }
    
    if (coneRef.current) {
      coneRef.current.setLatLngs(points);
    } else {
      coneRef.current = L.polygon(points, {
        color: '#FF6600',
        fillColor: '#FFAA00',
        fillOpacity: 0.3,
        weight: 1,
      }).addTo(map);
    }
    
    return () => {
      if (coneRef.current) {
        map.removeLayer(coneRef.current);
      }
    };
  }, [position, heading, map]);
  
  return null;
};

// Map updater component for centering and zoom
const MapUpdater: React.FC<{ 
  center: LatLngExpression; 
  zoom: number; 
  bounds: LatLngExpression[] | null;
}> = ({ center, zoom, bounds }) => {
  const map = useMap();
  
  useEffect(() => {
    if (bounds && bounds.length > 0) {
      map.fitBounds(bounds, { padding: [20, 20] });
    } else {
      map.setView(center, zoom);
    }
  }, [center, zoom, bounds, map]);
  
  return null;
};

interface TelemetryMapProps {
  streams: Stream[];
  onStreamSelect?: (streamId: string) => void;
  selectedStreamIds?: string[];
  showDetections?: boolean;
  showPaths?: boolean;
  showHeadingCones?: boolean;
  height?: string;
}

export const TelemetryMap: React.FC<TelemetryMapProps> = ({
  streams,
  onStreamSelect,
  showDetections = true,
  showPaths = true,
  showHeadingCones = true,
  height = '600px',
}) => {
  const telemetryStore = useTelemetryStore();
  const detectionsStore = useDetectionsStore();
  
  const [mapCenter] = useState<LatLngExpression>([37.7749, -122.4194]); // Default to San Francisco
  const [mapZoom] = useState(10);
  const [detectionFilter, setDetectionFilter] = useState({
    FIRE: true,
    SMOKE: true,
    HOTSPOT: true,
  });
  
  // Calculate map bounds based on all stream positions
  const mapBounds = useMemo(() => {
    const positions: LatLngExpression[] = [];
    
    streams.forEach(stream => {
      const position = telemetryStore.getStreamPosition(stream.id);
      if (position) {
        positions.push([position.lat, position.lng]);
      }
    });
    
    return positions.length > 0 ? positions : null;
  }, [streams, telemetryStore]);
  
  // Get polyline path for a stream
  const getStreamPath = (streamId: string): LatLngExpression[] => {
    const history = telemetryStore.getTelemetryHistory(streamId);
    return history
      .slice(0, 20) // Show last 20 points
      .map(t => [t.latitude, t.longitude] as LatLngExpression)
      .reverse(); // Oldest first for proper polyline
  };
  
  // Get detections with geo info for a stream
  const getStreamDetections = (streamId: string) => {
    const detections = detectionsStore.getDetectionsForStream(streamId);
    return detections.filter(detection => 
      detection.geoInfo?.latitude && detection.geoInfo?.longitude
    );
  };
  
  // Filter detections based on user settings
  const shouldShowDetection = (detectionType: string) => {
    return detectionFilter[detectionType as keyof typeof detectionFilter] ?? true;
  };
  
  if (!streams || streams.length === 0) {
    return (
      <Card className="w-full">
        <CardContent className="flex items-center justify-center h-96">
          <div className="text-center">
            <MapPin className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">No streams available</p>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Navigation className="h-5 w-5" />
          Telemetry Map
        </CardTitle>
        <CardDescription>
          Real-time stream positions and detection overlays
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Detection Filters */}
        <div className="flex items-center gap-4 flex-wrap">
          <Label className="text-sm font-medium">Detection Types:</Label>
          {Object.entries(detectionFilter).map(([type, enabled]) => (
            <div key={type} className="flex items-center space-x-2">
              <Switch
                checked={enabled}
                onCheckedChange={(checked) => 
                  setDetectionFilter(prev => ({ ...prev, [type]: checked }))
                }
                id={`detection-${type}`}
              />
              <Label htmlFor={`detection-${type}`} className="text-sm">
                {type === 'FIRE' ? '🔥' : type === 'SMOKE' ? '💨' : '🌡️'} {type}
              </Label>
            </div>
          ))}
        </div>
        
        {/* Map */}
        <div style={{ height }} className="rounded-lg overflow-hidden border">
          <MapContainer
            center={mapCenter}
            zoom={mapZoom}
            style={{ height: '100%', width: '100%' }}
            key={streams.length} // Force re-render when streams change
          >
            <MapUpdater
              center={mapCenter}
              zoom={mapZoom}
              bounds={mapBounds}
            />
            
            <TileLayer
              attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            
            {/* Stream Markers */}
            {streams.map(stream => {
              const position = telemetryStore.getStreamPosition(stream.id);
              if (!position) return null;
              
              return (
                <Marker
                  key={stream.id}
                  position={[position.lat, position.lng]}
                  icon={createStreamIcon(stream.type, stream.status)}
                  eventHandlers={{
                    click: () => onStreamSelect?.(stream.id),
                  }}
                >
                  <Popup>
                    <div className="space-y-2">
                      <h3 className="font-semibold">{stream.name}</h3>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span>Type:</span>
                          <Badge variant="outline">{stream.type}</Badge>
                        </div>
                        <div className="flex justify-between">
                          <span>Status:</span>
                          <Badge 
                            variant={stream.status === 'RUNNING' ? 'default' : 'secondary'}
                          >
                            {stream.status}
                          </Badge>
                        </div>
                        
                        {/* Telemetry Stats */}
                        {(() => {
                          const stats = telemetryStore.getStreamStats(stream.id);
                          return stats ? (
                            <>
                              <div className="flex justify-between">
                                <span>Speed:</span>
                                <span>{formatSpeed(stats.speed)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Altitude:</span>
                                <span>{formatAltitude(stats.altitude)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Heading:</span>
                                <span>{formatHeading(stats.heading)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Position:</span>
                                <span>{formatCoordinates(position.lat, position.lng)}</span>
                              </div>
                            </>
                          ) : (
                            <div className="text-xs text-muted-foreground">
                              No telemetry data available
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  </Popup>
                </Marker>
              );
            })}
            
            {/* Stream Paths */}
            {showPaths && streams.map(stream => {
              const path = getStreamPath(stream.id);
              if (path.length < 2) return null;
              
              const color = stream.type === 'THERMAL' ? '#FF4400' : 
                           stream.type === 'SPLIT' ? '#9932CC' : '#0066CC';
              
              return (
                <Polyline
                  key={`path-${stream.id}`}
                  positions={path}
                  color={color}
                  weight={3}
                  opacity={0.7}
                />
              );
            })}
            
            {/* Heading Cones */}
            {showHeadingCones && streams.map(stream => {
              const latest = telemetryStore.getLatestTelemetry(stream.id);
              if (!latest) return null;
              
              return (
                <HeadingCone
                  key={`heading-${stream.id}`}
                  position={[latest.latitude, latest.longitude]}
                  heading={latest.heading}
                />
              );
            })}
            
            {/* Detection Markers */}
            {showDetections && streams.map(stream => {
              const detections = getStreamDetections(stream.id)
                .filter(detection => shouldShowDetection(detection.detectionType || detection.type));
              
              return detections.map(detection => (
                <Marker
                  key={`detection-${detection.id}`}
                  position={[
                    detection.geoInfo!.latitude!,
                    detection.geoInfo!.longitude!
                  ]}
                  icon={createDetectionIcon(
                    detection.detectionType || detection.type,
                    stream.type
                  )}
                >
                  <Popup>
                    <div className="space-y-2">
                      <h4 className="font-semibold">Detection Alert</h4>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span>Type:</span>
                          <Badge variant="destructive">
                            {detection.detectionType || detection.type}
                          </Badge>
                        </div>
                        <div className="flex justify-between">
                          <span>Confidence:</span>
                          <span>{(detection.confidence * 100).toFixed(1)}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Stream:</span>
                          <span>{stream.name}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Time:</span>
                          <span>{new Date(detection.createdAt).toLocaleTimeString()}</span>
                        </div>
                      </div>
                    </div>
                  </Popup>
                </Marker>
              ));
            })}
          </MapContainer>
        </div>
        
        {/* Legend */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
          <div className="space-y-2">
            <h4 className="font-medium">Stream Types</h4>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                <span>📹 Color Stream</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                <span>🌡️ Thermal Stream</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
                <span>📊 Split Stream</span>
              </div>
            </div>
          </div>
          
          <div className="space-y-2">
            <h4 className="font-medium">Detections</h4>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                <span>🔥 Fire</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-gray-500 rounded-full"></div>
                <span>💨 Smoke</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                <span>🌡️ Hotspot</span>
              </div>
            </div>
          </div>
          
          <div className="space-y-2">
            <h4 className="font-medium">Status</h4>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                <span>Active Stream</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-gray-400 rounded-full"></div>
                <span>Inactive Stream</span>
              </div>
            </div>
          </div>
          
          <div className="space-y-2">
            <h4 className="font-medium">Features</h4>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Route className="w-3 h-3" />
                <span>Flight Path</span>
              </div>
              <div className="flex items-center gap-2">
                <Navigation className="w-3 h-3" />
                <span>Heading Cone</span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
      
      <style jsx global>{`
        .custom-stream-marker {
          background: none !important;
          border: none !important;
        }
        
        .stream-marker {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
          border: 2px solid white;
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        }
        
        .stream-marker.active {
          animation: pulse 2s infinite;
        }
        
        .stream-marker.color {
          background-color: #0066CC;
        }
        
        .stream-marker.thermal {
          background-color: #FF4400;
        }
        
        .stream-marker.split {
          background-color: #9932CC;
        }
        
        .stream-marker.inactive {
          opacity: 0.5;
        }
        
        .custom-detection-marker {
          background: none !important;
          border: none !important;
        }
        
        .detection-marker {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          border: 2px solid white;
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        }
        
        @keyframes pulse {
          0% {
            transform: scale(1);
            opacity: 1;
          }
          50% {
            transform: scale(1.1);
            opacity: 0.7;
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }
      `}</style>
    </Card>
  );
};