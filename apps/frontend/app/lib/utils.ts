import { clsx, type ClassValue } from 'clsx';

export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}

// Utility function to format coordinates for display
export function formatCoordinates(lat: number, lng: number, precision: number = 4): string {
  return `${lat.toFixed(precision)}, ${lng.toFixed(precision)}`;
}

// Utility function to format distance/speed
export function formatSpeed(speed: number, unit: 'mps' | 'kmh' | 'mph' = 'mps'): string {
  switch (unit) {
    case 'kmh':
      return `${(speed * 3.6).toFixed(1)} km/h`;
    case 'mph':
      return `${(speed * 2.237).toFixed(1)} mph`;
    default:
      return `${speed.toFixed(1)} m/s`;
  }
}

// Utility function to format altitude
export function formatAltitude(altitude: number, unit: 'm' | 'ft' = 'm'): string {
  switch (unit) {
    case 'ft':
      return `${(altitude * 3.281).toFixed(0)} ft`;
    default:
      return `${altitude.toFixed(0)} m`;
  }
}

// Utility function to format heading
export function formatHeading(heading: number): string {
  const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const index = Math.round(heading / 22.5) % 16;
  return `${heading.toFixed(0)}° ${directions[index]}`;
}
