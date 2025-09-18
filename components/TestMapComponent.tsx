'use client';

import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { TEST_POINTS, TEST_ROUTE, TEST_AREA } from '../lib/test-data';

// Fix for default markers in Leaflet with Next.js
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface TestMapProps {
  selectedStart: string | null;
  selectedDestination: string | null;
  routeInfo: any;
  onPointSelect: (pointId: string, type: 'start' | 'destination') => void;
}

const TestMapComponent: React.FC<TestMapProps> = ({
  selectedStart,
  selectedDestination,
  routeInfo,
  onPointSelect
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const routeLayerRef = useRef<L.Polyline | null>(null);
  const areaLayerRef = useRef<L.Polygon | null>(null);

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    // Calculate center point between the two test points
    const centerLat = (TEST_POINTS[0].coordinates[1] + TEST_POINTS[1].coordinates[1]) / 2;
    const centerLng = (TEST_POINTS[0].coordinates[0] + TEST_POINTS[1].coordinates[0]) / 2;

    const map = L.map(mapRef.current).setView([centerLat, centerLng], 18);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    mapInstanceRef.current = map;

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Add test area polygon
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    // Remove existing area layer
    if (areaLayerRef.current) {
      mapInstanceRef.current.removeLayer(areaLayerRef.current);
    }

    // Convert coordinates to [lat, lng] format
    const areaCoords = TEST_AREA.coordinates.map(coord => [coord[1], coord[0]] as [number, number]);

    // Add area polygon
    const areaLayer = L.polygon(areaCoords, {
      color: '#10B981',
      fillColor: '#10B981',
      fillOpacity: 0.1,
      weight: 2,
      dashArray: '5, 5'
    }).addTo(mapInstanceRef.current);

    areaLayer.bindPopup('Test Area');
    areaLayerRef.current = areaLayer;

  }, []);

  // Add point markers
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    // Clear existing markers
    markersRef.current.forEach(marker => {
      mapInstanceRef.current?.removeLayer(marker);
    });
    markersRef.current = [];

    // Add point markers
    TEST_POINTS.forEach(point => {
      const [lng, lat] = point.coordinates;
      
      // Create custom icon based on selection state
      let iconColor = '#6B7280'; // default gray
      if (selectedStart === point.id) {
        iconColor = '#10B981'; // green for start
      } else if (selectedDestination === point.id) {
        iconColor = '#EF4444'; // red for destination
      }

      const customIcon = L.divIcon({
        html: `<div style="
          background-color: ${iconColor};
          width: 20px;
          height: 20px;
          border-radius: 50%;
          border: 3px solid white;
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: bold;
          font-size: 12px;
        ">${point.id === 'point1' ? '1' : '2'}</div>`,
        className: 'custom-marker',
        iconSize: [26, 26],
        iconAnchor: [13, 13]
      });

      const marker = L.marker([lat, lng], { icon: customIcon })
        .addTo(mapInstanceRef.current!);

      marker.bindPopup(`
        <div class="p-2">
          <h3 class="font-semibold">${point.name}</h3>
          <div class="mt-2 space-y-1">
            <button onclick="window.selectPoint('${point.id}', 'start')" 
                    class="block w-full px-2 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700">
              Set as Start
            </button>
            <button onclick="window.selectPoint('${point.id}', 'destination')" 
                    class="block w-full px-2 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700">
              Set as Destination
            </button>
          </div>
        </div>
      `);

      markersRef.current.push(marker);
    });

    // Add global function for popup buttons
    (window as any).selectPoint = (pointId: string, type: 'start' | 'destination') => {
      onPointSelect(pointId, type);
      // Close all popups
      mapInstanceRef.current?.closePopup();
    };

  }, [selectedStart, selectedDestination, onPointSelect]);

  // Add route visualization
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    // Remove existing route
    if (routeLayerRef.current) {
      mapInstanceRef.current.removeLayer(routeLayerRef.current);
      routeLayerRef.current = null;
    }

    // Add route if both points are selected
    if (routeInfo && routeInfo.found) {
      // Convert route coordinates to [lat, lng] format
      const routeCoords = TEST_ROUTE.coordinates.map(coord => [coord[1], coord[0]] as [number, number]);

      const routeLayer = L.polyline(routeCoords, {
        color: '#3B82F6',
        weight: 4,
        opacity: 0.8
      }).addTo(mapInstanceRef.current);

      routeLayer.bindPopup(`
        <div class="p-2">
          <h3 class="font-semibold">Test Route</h3>
          <p class="text-sm text-gray-600">Distance: ${routeInfo.totalDistance}m</p>
          <p class="text-sm text-gray-600">Time: ${Math.round(routeInfo.totalTravelTime / 60)} min</p>
        </div>
      `);

      routeLayerRef.current = routeLayer;
    }

  }, [routeInfo]);

  return (
    <div className="relative w-full h-full">
      <div ref={mapRef} className="w-full h-full" />
      
      {/* Map Legend */}
      <div className="absolute top-4 right-4 bg-white p-3 rounded-lg shadow-lg z-[1000]">
        <h4 className="font-semibold text-sm mb-2">Test Map Legend</h4>
        <div className="space-y-2 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-gray-500 rounded-full"></div>
            <span>Available Points</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green-600 rounded-full"></div>
            <span>Start Point</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-red-600 rounded-full"></div>
            <span>Destination</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-1 bg-blue-600"></div>
            <span>Route</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-1 bg-green-600 opacity-20 border border-green-600 border-dashed"></div>
            <span>Test Area</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TestMapComponent;