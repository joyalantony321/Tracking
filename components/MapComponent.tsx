'use client';

import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { Graph, buildGraphFromGeoJSON, haversine } from '../lib/graph';
import { calculateHybridRoute, HybridPathResult, MODE_COLORS } from '../lib/pathfinding';
import { calculateRoadRoute } from '../lib/road-pathfinding';
import { calculateHybridRoute as calculateNewHybridRoute, HybridRoute, RouteSegment, getValidStartGates, isValidStartPoint } from '../lib/hybrid-routing';
import { destinations } from '../data/destinations';
import { formatTravelTime, formatDistance } from '../lib/navigation';
import { Navigation, MapPin, AlertTriangle } from 'lucide-react';

// Import the GeoJSON data
import geoJsonData from '../data/GeoJson.json';

// Fix for default markers in React-Leaflet
import 'leaflet/dist/leaflet.css';

interface MapComponentProps {
  selectedMode: string;
  selectedStartPoint: any;
  selectedDestination: any;
  routeInfo: HybridPathResult | null;
  isNavigating: boolean;
  onRouteCalculated: (routeInfo: HybridPathResult) => void;
}

const MapComponent: React.FC<MapComponentProps> = ({
  selectedMode,
  selectedStartPoint,
  selectedDestination,
  routeInfo,
  isNavigating,
  onRouteCalculated
}) => {
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [graph, setGraph] = useState<Graph | null>(null);
  const [currentRoutes, setCurrentRoutes] = useState<L.Polyline[]>([]);
  const [routeMarkers, setRouteMarkers] = useState<L.Marker[]>([]);
  const [userLocationMarker, setUserLocationMarker] = useState<L.Marker | null>(null);
  const [watchId, setWatchId] = useState<number | null>(null);
  const [startMarker, setStartMarker] = useState<L.Marker | null>(null);
  const [destMarker, setDestMarker] = useState<L.Marker | null>(null);
  const [hasReachedDestination, setHasReachedDestination] = useState(false);
  const [showDestinationAlert, setShowDestinationAlert] = useState(false);

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    console.log('Initializing map...');

    // Create map centered on campus
    const map = L.map(mapContainerRef.current).setView([12.862, 77.438], 17);
    
    // Add tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19
    }).addTo(map);

    // Build graph from GeoJSON
    console.log('Building graph from GeoJSON...');
    const builtGraph = buildGraphFromGeoJSON(geoJsonData);
    console.log('Graph built:', {
      nodes: builtGraph.nodes.size,
      edges: builtGraph.edges.length
    });
    setGraph(builtGraph);

    // Add campus boundary
    const campusFeature = geoJsonData.features.find(f => f.properties.name === 'Campus');
    if (campusFeature && campusFeature.geometry.type === 'Polygon') {
      const coords = campusFeature.geometry.coordinates as [number, number][][];
      
      L.polygon(
        coords[0].map((coord: [number, number]) => [coord[1], coord[0]]), // flip [lng, lat] → [lat, lng]
        {
          color: '#3B82F6',
          weight: 2,
          opacity: 0.6,
          fillColor: '#3B82F6',
          fillOpacity: 0.1
        }
      ).addTo(map);
    }

    // Add roads to map with different styles based on modes
    // Don't show all roads initially - only show calculated routes

    // Don't show all destination markers initially - only show selected ones

    mapRef.current = map;

    // Initialize road pathfinding system
    console.log('Road pathfinding system initialized');

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Update start point marker
  useEffect(() => {
    if (!mapRef.current) return;

    // Remove previous start marker
    if (startMarker) {
      mapRef.current.removeLayer(startMarker);
    }

    if (selectedStartPoint) {
      const [lng, lat] = selectedStartPoint.coordinates;
      const marker = L.marker([lat, lng], {
        icon: L.divIcon({
          className: 'custom-start-marker',
          html: `
            <div style="
              width: 28px;
              height: 28px;
              background-color: #10B981;
              border: 3px solid white;
              border-radius: 50%;
              box-shadow: 0 2px 8px rgba(0,0,0,0.3);
              display: flex;
              align-items: center;
              justify-content: center;
              color: white;
              font-size: 16px;
            ">
              🚀
            </div>
          `,
          iconSize: [28, 28],
          iconAnchor: [14, 14]
        })
      }).addTo(mapRef.current);
      
      setStartMarker(marker);
    }
  }, [selectedStartPoint]);

  // Update destination marker
  useEffect(() => {
    if (!mapRef.current) return;

    // Remove previous destination marker
    if (destMarker) {
      mapRef.current.removeLayer(destMarker);
    }

    if (selectedDestination) {
      const [lng, lat] = selectedDestination.coordinates;
      const marker = L.marker([lat, lng], {
        icon: L.divIcon({
          className: 'custom-dest-marker',
          html: `
            <div style="
              width: 28px;
              height: 28px;
              background-color: #EF4444;
              border: 3px solid white;
              border-radius: 50%;
              box-shadow: 0 2px 8px rgba(0,0,0,0.3);
              display: flex;
              align-items: center;
              justify-content: center;
              color: white;
              font-size: 16px;
            ">
              🎯
            </div>
          `,
          iconSize: [28, 28],
          iconAnchor: [14, 14]
        })
      }).addTo(mapRef.current);
      
      setDestMarker(marker);
    }
  }, [selectedDestination]);

  // Calculate and display route when both points are selected
  useEffect(() => {
    if (!graph || !mapRef.current || !selectedStartPoint || !selectedDestination || !selectedMode) {
      console.log('Missing requirements for route calculation:', {
        graph: !!graph,
        map: !!mapRef.current,
        startPoint: !!selectedStartPoint,
        destination: !!selectedDestination,
        mode: selectedMode
      });
      return;
    }

    // Check if start point is valid for selected mode
    if ((selectedMode === '4' || selectedMode === '2') && !isValidStartPoint(selectedStartPoint.id, selectedMode)) {
      console.log('❌ Invalid start point for mode:', selectedMode, selectedStartPoint.id);
      const result: HybridPathResult = {
        segments: [],
        totalDistance: 0,
        totalTravelTime: 0,
        found: false,
        instructions: [`${selectedMode === '4' ? '4-wheelers can only enter through Gate 1' : '2-wheelers can only enter through Gate 2'}`]
      };
      onRouteCalculated(result);
      return;
    }

    console.log('Starting hybrid route calculation...', {
      startPoint: selectedStartPoint.name,
      destination: selectedDestination.name,
      mode: selectedMode,
      startCoords: selectedStartPoint.coordinates,
      destCoords: selectedDestination.coordinates
    });

    // Clear previous routes
    currentRoutes.forEach(route => {
      mapRef.current?.removeLayer(route);
    });
    routeMarkers.forEach(marker => {
      mapRef.current?.removeLayer(marker);
    });
    setCurrentRoutes([]);
    setRouteMarkers([]);

    // Calculate hybrid route using new system
    const [startLng, startLat] = selectedStartPoint.coordinates;
    const [destLng, destLat] = selectedDestination.coordinates;
    
    const hybridResult = calculateNewHybridRoute(
      geoJsonData,
      calculateRoadRoute,
      startLat,
      startLng,
      destLat,
      destLng,
      selectedMode,
      selectedStartPoint,
      selectedDestination
    );

    console.log('Hybrid route calculation result:', hybridResult);
    
    // Convert to HybridPathResult format for compatibility
    const result: HybridPathResult = {
      segments: hybridResult.segments.map(segment => ({
        path: segment.path,
        distance: segment.distance,
        travelTime: segment.distance / (segment.mode === 'W' ? 1.4 : segment.mode === '2' ? 5.0 : 8.0),
        mode: segment.mode,
        color: segment.color,
        coordinates: segment.coordinates
      })),
      totalDistance: hybridResult.totalDistance,
      totalTravelTime: hybridResult.segments.reduce((total, segment) => 
        total + (segment.distance / (segment.mode === 'W' ? 1.4 : segment.mode === '2' ? 5.0 : 8.0)), 0),
      found: hybridResult.found,
      instructions: hybridResult.segments.map(segment => segment.description)
    };

    onRouteCalculated(result);

    if (result.found && result.segments.length > 0) {
      const newRoutes: L.Polyline[] = [];
      const newMarkers: L.Marker[] = [];
      
      console.log('Drawing route segments:', result.segments.length);
      
      // Draw each segment with different colors
      result.segments.forEach((segment, index) => {
        console.log(`Drawing segment ${index + 1}:`, {
          mode: segment.mode,
          color: segment.color,
          coordinates: segment.coordinates.length,
          distance: segment.distance
        });
        
        if (segment.coordinates.length > 1) {
          // Create thick, prominent route line
          const routeLine = L.polyline(segment.coordinates, {
            color: segment.color,
            weight: 8,
            opacity: 0.9,
            dashArray: segment.mode === 'W' ? '10, 5' : undefined // Dash walking segments
          }).addTo(mapRef.current!);
          
          // Add white outline for better visibility
          const outlineLine = L.polyline(segment.coordinates, {
            color: '#FFFFFF',
            weight: 12,
            opacity: 0.6
          }).addTo(mapRef.current!);
          
          newRoutes.push(routeLine);
          newRoutes.push(outlineLine);
          
          // Add segment labels
          if (segment.coordinates.length > 0) {
            const midPoint = segment.coordinates[Math.floor(segment.coordinates.length / 2)];
            const labelMarker = L.marker(midPoint, {
              icon: L.divIcon({
                className: 'route-label',
                html: `
                  <div style="
                    background: ${segment.color};
                    color: white;
                    padding: 4px 8px;
                    border-radius: 12px;
                    font-size: 11px;
                    font-weight: bold;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.3);
                    white-space: nowrap;
                  ">
                    ${getModeName(segment.mode)} • ${formatDistance(segment.distance)}
                  </div>
                `,
                iconSize: [80, 24],
                iconAnchor: [40, 12]
              })
            }).addTo(mapRef.current!);
            
            newMarkers.push(labelMarker);
          }
        }
      });
      
      setCurrentRoutes(newRoutes);
      setRouteMarkers(newMarkers);
      
      // Fit map to show entire route
      if (newRoutes.length > 0) {
        const group = new L.FeatureGroup([...newRoutes, startMarker!, destMarker!].filter(Boolean));
        mapRef.current.fitBounds(group.getBounds().pad(0.1));
      }
      
      console.log('Route visualization complete');
    } else {
      console.log('No route found, showing direct line as fallback');
      
      // Create a fallback direct line route for visualization
      const [startLng, startLat] = selectedStartPoint.coordinates;
      const [destLng, destLat] = selectedDestination.coordinates;
      const directCoordinates: [number, number][] = [[startLat, startLng], [destLat, destLng]];
      
      // Calculate direct distance
      const directDistance = haversine(startLat, startLng, destLat, destLng);
      const walkingSpeed = 1.4; // m/s
      const directTime = directDistance / walkingSpeed;
      
      // Create a fallback result for visualization
      const fallbackResult: HybridPathResult = {
        segments: [{
          path: ['start', 'end'],
          distance: directDistance,
          travelTime: directTime,
          mode: 'W',
          color: '#4ECDC4', // Teal color for alternative route
          coordinates: directCoordinates
        }],
        totalDistance: directDistance,
        totalTravelTime: directTime,
        found: true, // Set to true so map displays it
        instructions: [`Alternative route to ${selectedDestination.name} (${formatDistance(directDistance)})`]
      };
      
      // Draw the alternative route
      const fallbackRoute = L.polyline(directCoordinates, {
        color: '#4ECDC4',
        weight: 6,
        opacity: 0.8,
        dashArray: '10, 5' // Dashed line to indicate it's an alternative route
      }).addTo(mapRef.current!);
      
      // Add outline for better visibility
      const outlineRoute = L.polyline(directCoordinates, {
        color: '#FFFFFF',
        weight: 10,
        opacity: 0.5
      }).addTo(mapRef.current!);
      
      // Add route info marker at midpoint
      const midLat = (startLat + destLat) / 2;
      const midLng = (startLng + destLng) / 2;
      const routeMarker = L.marker([midLat, midLng], {
        icon: L.divIcon({
          className: 'route-info',
          html: `
            <div style="
              background: #4ECDC4;
              color: white;
              padding: 6px 12px;
              border-radius: 16px;
              font-size: 12px;
              font-weight: bold;
              box-shadow: 0 2px 8px rgba(0,0,0,0.3);
              white-space: nowrap;
              display: flex;
              align-items: center;
              gap: 4px;
            ">
              📍 Alternative Route
            </div>
          `,
          iconSize: [140, 32],
          iconAnchor: [70, 16]
        })
      }).addTo(mapRef.current!);
      
      setCurrentRoutes([outlineRoute, fallbackRoute]);
      setRouteMarkers([routeMarker]);
      
      // Update the result to show the fallback
      onRouteCalculated(fallbackResult);
      
      // Fit map to show the route
      const group = new L.FeatureGroup([fallbackRoute, startMarker!, destMarker!].filter(Boolean));
      mapRef.current.fitBounds(group.getBounds().pad(0.1));
    }
  }, [graph, selectedStartPoint, selectedDestination, selectedMode]);

  // Live navigation with GPS tracking
  useEffect(() => {
    if (!isNavigating || !navigator.geolocation) {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
        setWatchId(null);
      }
      return;
    }

    console.log('Starting live navigation...');

    const options = {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 1000
    };

    const id = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        console.log('GPS position update:', { latitude, longitude });
        
        if (mapRef.current) {
          // Check if user has reached destination
          if (selectedDestination && !hasReachedDestination) {
            const [destLng, destLat] = selectedDestination.coordinates;
            const distanceToDestination = haversine(latitude, longitude, destLat, destLng);
            
            console.log('Distance to destination:', distanceToDestination, 'meters');
            
            // If within 20 meters of destination, show arrival message
            if (distanceToDestination <= 20) {
              console.log('Destination reached!');
              setHasReachedDestination(true);
              setShowDestinationAlert(true);
              // Auto-hide alert after 5 seconds
              setTimeout(() => setShowDestinationAlert(false), 5000);
            }
          }
          
          // Update or create user location marker
          if (userLocationMarker) {
            userLocationMarker.setLatLng([latitude, longitude]);
          } else {
            const liveMarker = L.marker([latitude, longitude], {
              icon: L.divIcon({
                className: 'live-location-marker',
                html: `
                  <div style="
                    width: 24px;
                    height: 24px;
                    background-color: #3B82F6;
                    border: 4px solid white;
                    border-radius: 50%;
                    box-shadow: 0 0 0 8px rgba(59, 130, 246, 0.3);
                    animation: pulse 2s infinite;
                  "></div>
                `,
                iconSize: [24, 24],
                iconAnchor: [12, 12]
              })
            }).addTo(mapRef.current);
            
            setUserLocationMarker(liveMarker);
          }
          
          // Center map on user location with smooth animation (higher zoom for navigation)
          mapRef.current.setView([latitude, longitude], 19, { animate: true, duration: 1 });
        }
      },
      (error) => {
        console.error('Geolocation error:', error);
      },
      options
    );
    
    setWatchId(id);

    return () => {
      if (id !== null) {
        navigator.geolocation.clearWatch(id);
      }
    };
  }, [isNavigating, selectedDestination, hasReachedDestination]);

  // Reset destination reached state when navigation stops
  useEffect(() => {
    if (!isNavigating) {
      setHasReachedDestination(false);
      setShowDestinationAlert(false);
    }
  }, [isNavigating]);

  // Cleanup user location marker when navigation stops
  useEffect(() => {
    if (!isNavigating && userLocationMarker && mapRef.current) {
      mapRef.current.removeLayer(userLocationMarker);
      setUserLocationMarker(null);
    }
  }, [isNavigating, userLocationMarker]);

  const getDestinationColor = (category: string): string => {
    const colors: { [key: string]: string } = {
      'entrance': '#3B82F6',
      'academic': '#8B5CF6', 
      'hostel': '#10B981',
      'dining': '#F97316',
      'sports': '#EF4444',
      'parking': '#6B7280',
      'facility': '#14B8A6'
    };
    return colors[category] || '#6B7280';
  };

  const getModeName = (mode: string): string => {
    const names: { [key: string]: string } = {
      'W': 'Walking',
      '2': '2-Wheeler',
      '4': '4-Wheeler',
      '4PA': 'Parking',
      '4PI': 'Pickup'
    };
    return names[mode] || mode;
  };

  const haversine = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371000; // Earth's radius in meters
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) * 
      Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  return (
    <div className="relative h-full w-full">
      <div ref={mapContainerRef} className="h-full w-full rounded-lg overflow-hidden shadow-lg" />
      
      {/* Destination Reached Alert */}
      {showDestinationAlert && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-green-50 border border-green-200 rounded-lg shadow-lg p-4 max-w-sm z-50 destination-reached">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-4 h-4 rounded-full bg-green-500 animate-pulse"></div>
            <span className="font-semibold text-sm text-green-800">🎉 Destination Reached!</span>
          </div>
          <p className="text-sm text-green-600">
            You have successfully arrived at {selectedDestination?.name}
          </p>
          <button 
            onClick={() => setShowDestinationAlert(false)}
            className="mt-2 text-xs text-green-700 hover:text-green-800 underline"
          >
            Dismiss
          </button>
        </div>
      )}
      
      {/* Route Not Found Overlay */}
      {routeInfo && !routeInfo.found && selectedStartPoint && selectedDestination && (
        <div className="absolute top-4 right-4 bg-red-50 border border-red-200 rounded-lg shadow-lg p-4 max-w-xs z-40">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-red-600" />
            <span className="font-semibold text-sm text-red-800">No Route Available</span>
          </div>
          <p className="text-sm text-red-600">
            No accessible path found for the selected mode of transport. Try a different transportation mode.
          </p>
        </div>
      )}

      {/* Hybrid Route Warning */}
      {routeInfo && routeInfo.found && routeInfo.segments.length > 1 && (
        <div className="absolute top-4 left-4 bg-orange-50 border border-orange-200 rounded-lg shadow-lg p-4 max-w-sm z-40">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-3 h-3 rounded-full bg-orange-500"></div>
            <span className="font-semibold text-sm text-orange-800">Multi-Modal Route</span>
          </div>
          <p className="text-sm text-orange-600">
            This route requires parking your vehicle and walking to the final destination.
          </p>
        </div>
      )}

      {/* Live Navigation Status */}
      {isNavigating && (
        <div className="absolute bottom-4 left-4 bg-blue-50 border border-blue-200 rounded-lg shadow-lg p-4 z-40">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-500 animate-pulse"></div>
            <span className="text-sm text-blue-800 font-medium">🧭 Live Navigation Active</span>
          </div>
          <p className="text-xs text-blue-600 mt-1">Following your GPS location</p>
          {selectedDestination && (
            <p className="text-xs text-blue-600">Navigating to: {selectedDestination.name}</p>
          )}
        </div>
      )}

      {/* Current Selection Display */}
      {selectedStartPoint && selectedDestination && routeInfo && routeInfo.found && (
        <div className="absolute bottom-4 right-4 bg-white/95 backdrop-blur-sm rounded-lg shadow-lg p-4 max-w-md z-40">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500"></div>
              <span className="text-sm text-gray-600">From:</span>
              <span className="text-sm font-medium">{selectedStartPoint.name}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-red-500"></div>
              <span className="text-sm text-gray-600">To:</span>
              <span className="text-sm font-medium">{selectedDestination.name}</span>
            </div>
            <div className="flex items-center gap-4 pt-2 border-t border-gray-200">
              <div className="text-center">
                <div className="text-xs text-gray-500">Distance</div>
                <div className="font-semibold text-sm">{formatDistance(routeInfo.totalDistance)}</div>
              </div>
              <div className="text-center">
                <div className="text-xs text-gray-500">Time</div>
                <div className="font-semibold text-sm">{formatTravelTime(routeInfo.totalTravelTime)}</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MapComponent;