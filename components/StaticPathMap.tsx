"use client";

import { useEffect, useRef, useState, useCallback } from 'react';
import { MapPin, Navigation, Target } from 'lucide-react';

// Dynamic Leaflet import to avoid SSR issues
let L: any = null;
if (typeof window !== 'undefined') {
  const leaflet = require('leaflet');
  require('leaflet/dist/leaflet.css');
  L = leaflet;
}

// Import the GeoJSON data for campus boundaries
import geoJsonData from '../data/GeoJson.json';

interface StaticPathMapProps {
  routeInfo: any;
  selectedMode: string;
  onLocationUpdate?: (location: { lat: number; lng: number }) => void;
}

const StaticPathMap: React.FC<StaticPathMapProps> = ({ 
  routeInfo, 
  selectedMode, 
  onLocationUpdate 
}) => {
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const userLocationMarkerRef = useRef<L.Marker | null>(null);
  const routePolylineRef = useRef<L.Polyline | null>(null);
  const watchIdRef = useRef<number | null>(null);
  
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [isMapReady, setIsMapReady] = useState(false);
  const [totalDistance, setTotalDistance] = useState<number>(0);
  const [estimatedTime, setEstimatedTime] = useState<number>(0);

  // Extract route data from routeInfo (correct structure)
  const route: [number, number][] = routeInfo?.segments?.flatMap((segment: any) => 
    segment.coordinates || []
  ) || [];
  
  const destination = routeInfo?.destination?.name || routeInfo?.destinationPoint?.name || 'Unknown Destination';
  const startPoint = routeInfo?.startPoint;
  const destinationPoint = routeInfo?.destination || routeInfo?.destinationPoint;
  
  // Debug route data
  console.log('📍 Route data in StaticPathMap:', {
    hasRouteInfo: !!routeInfo,
    segmentsCount: routeInfo?.segments?.length || 0,
    routePointsCount: route.length,
    destination,
    startPoint: startPoint?.name
  });

  // Calculate total distance and estimated time
  const calculateRouteStats = useCallback(() => {
    // Use route info totals if available (more accurate)
    if (routeInfo?.totalDistance && routeInfo?.totalTravelTime) {
      setTotalDistance(routeInfo.totalDistance);
      setEstimatedTime(routeInfo.totalTravelTime / 60); // convert seconds to minutes
      console.log('📊 Using route info stats:', {
        distance: routeInfo.totalDistance,
        time: routeInfo.totalTravelTime / 60
      });
      return;
    }
    
    // Fallback calculation if route points available
    if (route.length < 2) {
      console.log('⚠️ No route data for stats calculation');
      return;
    }
    
    let totalDist = 0;
    for (let i = 0; i < route.length - 1; i++) {
      const [lat1, lng1] = route[i];
      const [lat2, lng2] = route[i + 1];
      
      // Haversine formula for distance calculation
      const R = 6371000; // Earth's radius in meters
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLng = (lng2 - lng1) * Math.PI / 180;
      const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                Math.sin(dLng/2) * Math.sin(dLng/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      const distance = R * c;
      totalDist += distance;
    }
    
    setTotalDistance(totalDist);
    
    // Estimate time based on mode (walking: 5 km/h, driving: 30 km/h)
    const speed = selectedMode === 'driving' ? 30 : 5; // km/h
    const timeInHours = (totalDist / 1000) / speed;
    setEstimatedTime(timeInHours * 60); // convert to minutes
    
    console.log('📊 Calculated route stats:', {
      distance: totalDist,
      time: timeInHours * 60
    });
  }, [routeInfo, route, selectedMode]);

  // Check if user is within campus boundary
  const isUserInCampus = useCallback((userLat: number, userLng: number) => {
    const campusFeature = geoJsonData.features.find(f => f.properties.name === 'Campus');
    if (!campusFeature || campusFeature.geometry.type !== 'Polygon') return false;
    
    const coords = campusFeature.geometry.coordinates[0] as [number, number][];
    let inside = false;

    for (let i = 0, j = coords.length - 1; i < coords.length; j = i++) {
      const [xi, yi] = coords[i];
      const [xj, yj] = coords[j];

      if (((yi > userLat) !== (yj > userLat)) && 
          (userLng < (xj - xi) * (userLat - yi) / (yj - yi) + xi)) {
        inside = !inside;
      }
    }

    return inside;
  }, []);

  // Initialize map to show entire campus area
  const initializeMap = useCallback(() => {
    if (!mapContainerRef.current || !L || mapRef.current) return;

    console.log('Initializing campus map for AR navigation...');
    
    // Create map with full interactive controls
    const map = L.map(mapContainerRef.current, {
      zoomControl: true, // Enable zoom controls for user interaction
      attributionControl: false,
      dragging: true, // Enable map dragging/panning
      scrollWheelZoom: true, // Enable mouse wheel zoom
      doubleClickZoom: true, // Enable double-click zoom
      touchZoom: true, // Enable touch zoom for mobile
      boxZoom: true, // Enable box zoom selection
      keyboard: true, // Enable keyboard navigation
      zoomSnap: 0.1, // Smooth zoom increments
      zoomDelta: 0.5, // Zoom step size
      wheelPxPerZoomLevel: 60 // Smooth mouse wheel zoom
    });

    // Add tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19
    }).addTo(map);

    // Add campus boundary and fit to entire campus area
    const campusFeature = geoJsonData.features.find(f => f.properties.name === 'Campus');
    if (campusFeature && campusFeature.geometry.type === 'Polygon') {
      const coords = campusFeature.geometry.coordinates as [number, number][][];
      const campusCoords = coords[0].map((coord: [number, number]) => [coord[1], coord[0]]); // flip [lng, lat] → [lat, lng]
      
      // Create campus boundary polygon
      const campusPolygon = L.polygon(campusCoords, {
        color: '#3B82F6',
        weight: 2,
        opacity: 0.8,
        fillColor: '#3B82F6',
        fillOpacity: 0.15
      }).addTo(map);
      
      // Set campus view with adjustable zoom level
      // Center on campus - adjust the zoom number to control detail level
      map.setView([12.862, 77.438], 16.3); // Zoom level: 17 (adjust this number)
      
      console.log('📍 Set campus view at zoom level 17');
      
      console.log('📍 Map fitted to entire campus area');
    } else {
      // Fallback: set to default campus center if boundary not found
      map.setView([12.862, 77.438], 16);
    }

    mapRef.current = map;
    setIsMapReady(true);
    
    console.log('Campus map initialized for mobile AR view - showing full campus');
  }, []);

  // Add route polyline to map
  const addRouteToMap = useCallback(() => {
    if (!mapRef.current || !L) return;

    console.log('Adding calculated route to campus map...');
    console.log('Route segments available:', routeInfo?.segments?.length || 0);
    
    // Remove existing route
    if (routePolylineRef.current) {
      mapRef.current.removeLayer(routePolylineRef.current);
    }

    // Draw route segments if available (like main map)
    if (routeInfo?.segments && routeInfo.segments.length > 0) {
      console.log('Drawing route segments:', routeInfo.segments.length);
      
      routeInfo.segments.forEach((segment: any, index: number) => {
        console.log(`Drawing segment ${index + 1}:`, {
          mode: segment.mode,
          coordinates: segment.coordinates?.length || 0,
          color: segment.color
        });
        
        if (segment.coordinates && segment.coordinates.length > 1) {
          // Create white outline for better visibility
          L.polyline(segment.coordinates, {
            color: '#FFFFFF',
            weight: 8, // Thicker outline for mobile
            opacity: 0.7
          }).addTo(mapRef.current!);
          
          // Create colored route line
          const routeLine = L.polyline(segment.coordinates, {
            color: segment.color || '#3B82F6',
            weight: 5,
            opacity: 0.9,
            dashArray: segment.mode === 'W' ? '8, 4' : undefined // Dash walking segments for mobile
          }).addTo(mapRef.current!);
          
          // Store reference to first segment for cleanup
          if (index === 0) {
            routePolylineRef.current = routeLine;
          }
        }
      });
    } else if (route.length > 0) {
      // Fallback: draw single route line if segments not available
      console.log('Drawing fallback route with', route.length, 'points');
      
      // Create white outline
      L.polyline(route, {
        color: '#FFFFFF',
        weight: 8,
        opacity: 0.7
      }).addTo(mapRef.current);
      
      // Create route line
      const polyline = L.polyline(route, {
        color: '#3B82F6',
        weight: 5,
        opacity: 0.9,
        smoothFactor: 1
      }).addTo(mapRef.current);

      routePolylineRef.current = polyline;
    } else {
      console.log('❌ No route data available to draw');
      return;
    }

    // Add start point marker (same style as main map)
    if (startPoint) {
      L.marker([startPoint.coordinates[1], startPoint.coordinates[0]], {
        icon: L.divIcon({
          className: 'custom-start-marker',
          html: `
            <div style="
              width: 24px;
              height: 24px;
              background-color: #10B981;
              border: 3px solid white;
              border-radius: 50%;
              box-shadow: 0 2px 6px rgba(0,0,0,0.3);
              display: flex;
              align-items: center;
              justify-content: center;
              color: white;
              font-size: 12px;
            ">
              🚀
            </div>
          `,
          iconSize: [24, 24],
          iconAnchor: [12, 12]
        })
      }).addTo(mapRef.current)
        .bindPopup(`Start: ${startPoint.name}`);
    }

    // Add destination marker (same style as main map)
    if (destinationPoint) {
      L.marker([destinationPoint.coordinates[1], destinationPoint.coordinates[0]], {
        icon: L.divIcon({
          className: 'custom-dest-marker',
          html: `
            <div style="
              width: 24px;
              height: 24px;
              background-color: #EF4444;
              border: 3px solid white;
              border-radius: 50%;
              box-shadow: 0 2px 6px rgba(0,0,0,0.3);
              display: flex;
              align-items: center;
              justify-content: center;
              color: white;
              font-size: 12px;
            ">
              🎯
            </div>
          `,
          iconSize: [24, 24],
          iconAnchor: [12, 12]
        })
      }).addTo(mapRef.current)
        .bindPopup(`Destination: ${destination}`);
    }

    // Keep campus view - don't fit to route bounds to maintain campus context
    // This ensures the user always sees the full campus area for orientation
    
    console.log('Route added to campus map successfully');
  }, [routeInfo, route, startPoint, destinationPoint, destination]);

  // Start location tracking
  const startLocationTracking = useCallback(() => {
    if (!navigator.geolocation) {
      console.warn('Geolocation not supported');
      return;
    }

    // Stop existing watch
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }

    console.log('Starting location tracking...');
    
    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const newLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };
        
        setUserLocation(newLocation);
        onLocationUpdate?.(newLocation);
        updateUserLocationOnMap(newLocation);
      },
      (error) => {
        console.error('Location tracking error:', error);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 10000,
        timeout: 30000
      }
    );
  }, [onLocationUpdate]);

  // Update user location marker on map (only if in campus)
  const updateUserLocationOnMap = useCallback((location: { lat: number; lng: number }) => {
    if (!mapRef.current || !L) return;

    // Remove existing user location marker
    if (userLocationMarkerRef.current) {
      mapRef.current.removeLayer(userLocationMarkerRef.current);
    }

    // Only show marker if user is within campus
    const inCampus = isUserInCampus(location.lat, location.lng);
    if (!inCampus) {
      console.log('User is outside campus - no marker shown');
      return;
    }

    // Create pulsing user location marker (larger for mobile)
    const userIcon = L.divIcon({
      html: `
        <div style="position: relative;">
          <div style="
            width: 16px; 
            height: 16px; 
            background-color: #3B82F6; 
            border: 3px solid white; 
            border-radius: 50%;
            box-shadow: 0 2px 6px rgba(0,0,0,0.4);
            z-index: 1000;
          "></div>
          <div style="
            position: absolute;
            top: -7px;
            left: -7px;
            width: 30px;
            height: 30px;
            background-color: rgba(59, 130, 246, 0.3);
            border-radius: 50%;
            animation: pulse 2s infinite ease-out;
          "></div>
        </div>
        <style>
          @keyframes pulse {
            0% { transform: scale(0.8); opacity: 1; }
            100% { transform: scale(2.5); opacity: 0; }
          }
        </style>
      `,
      className: 'user-location-marker',
      iconSize: [22, 22],
      iconAnchor: [11, 11]
    });

    const marker = L.marker([location.lat, location.lng], { icon: userIcon })
      .addTo(mapRef.current)
      .bindPopup('Your location in campus');

    userLocationMarkerRef.current = marker;
    console.log('User location marker updated - inside campus');
  }, [isUserInCampus]);

  // Initialize map when component mounts
  useEffect(() => {
    initializeMap();
    
    return () => {
      // Cleanup
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [initializeMap]);

  // Add route when map is ready or when route data changes
  useEffect(() => {
    if (isMapReady) {
      addRouteToMap();
      calculateRouteStats();
      startLocationTracking();
    }
  }, [isMapReady, addRouteToMap, calculateRouteStats, startLocationTracking]);
  
  // Update route when routeInfo changes (separate effect for better reactivity)
  useEffect(() => {
    if (isMapReady && routeInfo) {
      console.log('🔄 Route info updated, redrawing route...');
      addRouteToMap();
      calculateRouteStats();
    }
  }, [routeInfo, isMapReady, addRouteToMap, calculateRouteStats]);

  return (
    <div className="relative w-full h-full bg-gray-100">
      {/* Map container - full screen for mobile */}
      <div ref={mapContainerRef} className="w-full h-full" />
      
      {/* Mobile-optimized route information overlay */}
      <div className="absolute top-2 left-2 right-2 bg-white/95 backdrop-blur-sm rounded-lg p-2 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Navigation className="w-4 h-4 text-blue-600" />
            <span className="font-semibold text-sm text-gray-800">Route</span>
          </div>
          
          <div className="flex items-center gap-3 text-xs">
            <div className="flex items-center gap-1">
              <Target className="w-3 h-3 text-red-500" />
              <span className="font-medium">{destination}</span>
            </div>
            
            <div className="text-gray-600">
              {totalDistance > 1000 
                ? `${(totalDistance / 1000).toFixed(1)} km` 
                : `${Math.round(totalDistance)} m`}
            </div>
            
            <div className="text-gray-600">
              {estimatedTime > 60 
                ? `${Math.floor(estimatedTime / 60)}h ${Math.round(estimatedTime % 60)}m`
                : `${Math.round(estimatedTime)} min`}
            </div>
          </div>
        </div>
      </div>

      {/* Campus status indicator (bottom) */}
      {userLocation && (
        <div className="absolute bottom-2 left-2 right-2 flex justify-between items-center">
          <div className="bg-blue-600/90 text-white px-2 py-1 rounded text-xs flex items-center gap-1">
            <MapPin className="w-3 h-3" />
            <span>
              {isUserInCampus(userLocation.lat, userLocation.lng) ? 'In Campus' : 'Outside Campus'}
            </span>
          </div>
          
          <div className="bg-gray-800/90 text-white px-2 py-1 rounded text-xs">
            📍 BMSCE Campus Map {routeInfo?.segments?.length ? `(${routeInfo.segments.length} segments)` : '(No Route)'}
          </div>
        </div>
      )}

      {/* Loading state */}
      {!isMapReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100/80 backdrop-blur-sm">
          <div className="text-center">
            <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-2" />
            <p className="text-gray-600 text-sm">Loading Campus Map...</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default StaticPathMap;