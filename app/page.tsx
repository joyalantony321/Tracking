'use client';

import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import NavigationPanel from '@/components/NavigationPanel';
import { HybridPathResult } from '@/lib/pathfinding';

// Dynamically import MapComponent to avoid SSR issues with Leaflet
const MapComponent = dynamic(() => import('@/components/MapComponent'), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full bg-gray-100 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
        <p className="text-gray-600">Loading campus map...</p>
      </div>
    </div>
  )
});

export default function CampusNavigation() {
  const [selectedMode, setSelectedMode] = useState('');
  const [selectedStartPoint, setSelectedStartPoint] = useState<any>(null);
  const [selectedDestination, setSelectedDestination] = useState<any>(null);
  const [routeInfo, setRouteInfo] = useState<HybridPathResult | null>(null);
  const [isNavigating, setIsNavigating] = useState(false);

  const handleModeChange = (mode: string) => {
    setSelectedMode(mode);
    // Clear route when mode changes
    setRouteInfo(null);
  };

  const handleStartPointSelect = (startPoint: any) => {
    setSelectedStartPoint(startPoint);
    setRouteInfo(null);
  };

  const handleDestinationSelect = (destination: any) => {
    setSelectedDestination(destination);
    setRouteInfo(null);
  };

  const handleRouteCalculated = (newRouteInfo: HybridPathResult) => {
    console.log('Route calculated in main app:', newRouteInfo);
    setRouteInfo(newRouteInfo);
  };

  const handleStartNavigation = () => {
    // Request location permission first
    if (!navigator.geolocation) {
      alert('GPS location is not supported by this browser. Please use a modern browser with location services.');
      return;
    }
    
    // Request permission and start navigation
    navigator.geolocation.getCurrentPosition(
      (position) => {
        // Permission granted, start navigation
        setIsNavigating(true);
        console.log('Live navigation started');
        alert('🧭 Live navigation started! Make sure to keep your device\'s location services enabled.');
      },
      (error) => {
        // Permission denied or error
        let errorMessage = 'Unable to access your location. ';
        switch(error.code) {
          case error.PERMISSION_DENIED:
            errorMessage += 'Please enable location permissions for this website in your browser settings.';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage += 'Location information is unavailable. Please check your GPS settings.';
            break;
          case error.TIMEOUT:
            errorMessage += 'Location request timed out. Please try again.';
            break;
          default:
            errorMessage += 'An unknown error occurred while retrieving your location.';
            break;
        }
        alert(errorMessage);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000
      }
    );
  };

  const handleStopNavigation = () => {
    setIsNavigating(false);
    console.log('Navigation stopped');
    alert('Navigation stopped. You can start a new route anytime.');
  };

  const handleClearRoute = () => {
    setSelectedStartPoint(null);
    setSelectedDestination(null);
    setRouteInfo(null);
    setIsNavigating(false);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header - Mobile Responsive */}
      <header className="bg-white border-b border-gray-200 px-4 sm:px-6 py-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Campus Navigation</h1>
              <p className="text-xs sm:text-sm text-gray-600 mt-1">
                Smart pathfinding with GPS navigation
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${isNavigating ? 'bg-green-500' : 'bg-gray-400'}`}></div>
              <span className="text-xs sm:text-sm text-gray-600">
                {isNavigating ? 'Live Navigation' : 'Navigation Ready'}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content - Mobile First Design */}
      <div className="p-4 max-w-7xl mx-auto">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Navigation Panel - Full width on mobile, sidebar on desktop */}
          <div className="w-full lg:w-96 lg:flex-shrink-0">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <NavigationPanel
                selectedMode={selectedMode}
                selectedStartPoint={selectedStartPoint}
                selectedDestination={selectedDestination}
                routeInfo={routeInfo}
                isNavigating={isNavigating}
                onModeChange={handleModeChange}
                onStartPointSelect={handleStartPointSelect}
                onDestinationSelect={handleDestinationSelect}
                onStartNavigation={handleStartNavigation}
                onStopNavigation={handleStopNavigation}
                onClearRoute={handleClearRoute}
              />
            </div>
          </div>

          {/* Map Container - Card Element for Mobile */}
          <div className="flex-1">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <div className="h-64 sm:h-80 md:h-96 lg:h-[calc(100vh-200px)] relative">
                <MapComponent
                  selectedMode={selectedMode}
                  selectedStartPoint={selectedStartPoint}
                  selectedDestination={selectedDestination}
                  routeInfo={routeInfo}
                  isNavigating={isNavigating}
                  onRouteCalculated={handleRouteCalculated}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}