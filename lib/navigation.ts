import { destinations, Destination } from '../data/destinations';
import { findNearestNode, findNearestDestination, GraphNode } from './graph';

export interface NavigationMode {
  id: string;
  name: string;
  icon: string;
  color: string;
  speed: number;
}

export const NAVIGATION_MODES: NavigationMode[] = [
  { id: 'W', name: 'Walking', icon: '🚶', color: '#10B981', speed: 1.4 },
  { id: '2', name: '2-Wheeler', icon: '🏍️', color: '#3B82F6', speed: 5.0 },
  { id: '4', name: '4-Wheeler', icon: '🚗', color: '#8B5CF6', speed: 8.0 }
];

export function filterDestinationsByCategory(category?: string): Destination[] {
  if (!category || category === 'all') return destinations;
  return destinations.filter(dest => dest.category === category);
}

export function searchDestinations(query: string): Destination[] {
  if (!query.trim()) return destinations;
  
  const lowerQuery = query.toLowerCase();
  return destinations.filter(dest => 
    dest.name.toLowerCase().includes(lowerQuery) ||
    dest.category.toLowerCase().includes(lowerQuery) ||
    dest.type.toLowerCase().includes(lowerQuery)
  );
}

export function snapToGraph(
  nodes: Map<string, GraphNode>,
  lat: number, 
  lng: number
): { nodeId: string; snappedLat: number; snappedLng: number } | null {
  const nearest = findNearestNode(nodes, lat, lng);
  if (!nearest) return null;
  
  const node = nodes.get(nearest.id);
  if (!node) return null;
  
  return {
    nodeId: nearest.id,
    snappedLat: node.lat,
    snappedLng: node.lng
  };
}

export function formatTravelTime(seconds: number): string {
  if (seconds < 60) {
    return `${Math.round(seconds)}s`;
  } else {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.round(seconds % 60);
    return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
  }
}

export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)}m`;
  } else {
    return `${(meters / 1000).toFixed(1)}km`;
  }
}

export const DESTINATION_CATEGORIES = [
  { id: 'all', name: 'All Destinations', icon: '🎯' },
  { id: 'entrance', name: 'Gates & Entrances', icon: '🚪' },
  { id: 'academic', name: 'Academic Buildings', icon: '🏫' },
  { id: 'hostel', name: 'Hostels', icon: '🏠' },
  { id: 'dining', name: 'Dining', icon: '🍽️' },
  { id: 'sports', name: 'Sports Facilities', icon: '⚽' },
  { id: 'parking', name: 'Parking Areas', icon: '🅿️' },
  { id: 'facility', name: 'Other Facilities', icon: '🏢' }
];