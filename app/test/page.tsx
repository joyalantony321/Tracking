'use client';

import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import TestNavigationPanel from '@/components/TestNavigationPanel';
import { getTestRouteInfo } from '@/lib/test-data';

// Dynamically import TestMapComponent to avoid SSR issues with Leaflet
const TestMapComponent = dynamic(() => import('@/components/TestMapComponent'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full bg-gray-100">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
        <p className="text-gray-600">Loading test map...</p>
      </div>
    </div>
  )
});

export default function TestPage() {
  const [selectedStart, setSelectedStart] = useState<string | null>('point1');
  const [selectedDestination, setSelectedDestination] = useState<string | null>('point2');
  const [routeInfo, setRouteInfo] = useState<any>(null);
  const [isNavigating, setIsNavigating] = useState(false);

  const handlePointSelect = (pointId: string, type: 'start' | 'destination') => {
    if (type === 'start') {
      setSelectedStart(pointId);
      // If same point selected for both, clear destination
      if (selectedDestination === pointId) {
        setSelectedDestination(null);
        setRouteInfo(null);
      }
    } else {
      setSelectedDestination(pointId);
      // If same point selected for both, clear start
      if (selectedStart === pointId) {
        setSelectedStart(null);
        setRouteInfo(null);
      }
    }
  };

  // Initialize route on component mount and when points change
  React.useEffect(() => {
    if (selectedStart && selectedDestination && selectedStart !== selectedDestination) {
      const route = getTestRouteInfo(selectedStart, selectedDestination);
      setRouteInfo(route);
      console.log('Auto-initialized route from Point 1 to Point 2:', route);
    } else {
      setRouteInfo(null);
    }
  }, [selectedStart, selectedDestination]);

  // Auto-initialize route on page load
  React.useEffect(() => {
    const route = getTestRouteInfo('point1', 'point2');
    setRouteInfo(route);
    console.log('Page loaded - Route initialized:', route);
  }, []);

  const handleStartNavigation = () => {
    setIsNavigating(true);
    // In a real app, you would start GPS tracking here
    console.log('Starting navigation...');
  };

  const handleStopNavigation = () => {
    setIsNavigating(false);
    console.log('Stopping navigation...');
  };

  const handleClearRoute = () => {
    setSelectedStart(null);
    setSelectedDestination(null);
    setRouteInfo(null);
    setIsNavigating(false);
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Navigation Panel */}
      <TestNavigationPanel
        selectedStart={selectedStart}
        selectedDestination={selectedDestination}
        routeInfo={routeInfo}
        isNavigating={isNavigating}
        onStartNavigation={handleStartNavigation}
        onStopNavigation={handleStopNavigation}
        onClearRoute={handleClearRoute}
      />

      {/* Map */}
      <div className="flex-1 relative">
        <TestMapComponent
          selectedStart={selectedStart}
          selectedDestination={selectedDestination}
          routeInfo={routeInfo}
          onPointSelect={handlePointSelect}
        />

        {/* Test Info Overlay */}
        <div className="absolute top-4 left-4 bg-white p-4 rounded-lg shadow-lg z-[1000] max-w-sm">
          <h3 className="font-semibold text-lg mb-2">🧪 AR Navigation Test</h3>
          <div className="text-sm space-y-1 text-gray-600">
            <p><strong>Test Area:</strong> Polygon boundary shown on map</p>
            <p><strong>Points:</strong> 2 test locations</p>
            <p><strong>Route:</strong> Pre-defined path between points</p>
            <p><strong>AR Feature:</strong> Location validation + 3D waypoints</p>
          </div>
          
          {selectedStart && selectedDestination && (
            <div className="mt-3 pt-3 border-t">
              <div className="text-xs text-green-600 font-medium">
                ✅ Route Active: {selectedStart} → {selectedDestination}
              </div>
            </div>
          )}
        </div>

        {/* Navigation Status */}
        {isNavigating && (
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg z-[1000]">
            <div className="flex items-center gap-2">
              <div className="animate-pulse w-2 h-2 bg-white rounded-full"></div>
              <span className="font-medium">Navigation Active</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}