"use client";

import { useEffect, useRef, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Navigation, X, AlertTriangle, Camera } from 'lucide-react';
import LiveCameraLabeling from './LiveCameraLabeling';
import StaticPathMap from './StaticPathMap';

interface ARNavigationProps {
  routeInfo: any;
  selectedMode: string;
  onClose: () => void;
}

const ARNavigation: React.FC<ARNavigationProps> = ({
  routeInfo,
  selectedMode,
  onClose
}) => {
  const [permissionsGranted, setPermissionsGranted] = useState(false);
  const [arError, setArError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  
  const destination = routeInfo?.destination?.name || routeInfo?.destinationPoint?.name || 'Unknown Destination';

  // Request camera and location permissions
  const requestPermissions = useCallback(async () => {
    setIsInitializing(true);
    setArError(null);
    
    try {
      // Request camera permission
      await navigator.mediaDevices.getUserMedia({ video: true });
      
      // Request location permission
      await new Promise<void>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          () => resolve(),
          (error) => reject(error),
          { enableHighAccuracy: true, timeout: 10000 }
        );
      });
      
      setPermissionsGranted(true);
      console.log('✅ Permissions granted successfully');
      
    } catch (error: any) {
      console.error('❌ Permission error:', error);
      setArError(error.message || 'Failed to get permissions');
    } finally {
      setIsInitializing(false);
    }
  }, []);

  // Handle camera ready state
  const handleCameraReady = useCallback((isReady: boolean) => {
    setIsCameraReady(isReady);
  }, []);

  // Handle location updates from map
  const handleLocationUpdate = useCallback((location: { lat: number; lng: number }) => {
    setUserLocation(location); 
  }, []);

  return (
    <div className="fixed inset-0 bg-black z-50">
      {/* Header with close button */}
      <div className="absolute top-0 left-0 right-0 z-60 bg-gradient-to-b from-black/70 to-transparent p-4">
        <div className="flex items-center justify-between text-white">
          <div className="flex items-center gap-3">
            <Camera className="w-6 h-6" />
            <div>
              <h2 className="text-lg font-semibold">Live Navigation</h2>
              <p className="text-sm opacity-75">To: {destination}</p>
            </div>
          </div>
          <Button
            onClick={onClose}
            size="sm"
            variant="ghost"
            className="text-white hover:bg-white/20"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {permissionsGranted ? (
        <>
          {/* Split view container */}
          <div className="flex flex-col h-full pt-20">
            {/* Top half - Live camera with labeling */}
            <div className="flex-1 relative">
              <LiveCameraLabeling onCameraReady={handleCameraReady} />
              
              {/* Camera status overlay */}
              <div className="absolute bottom-4 left-4 bg-black/50 text-white px-3 py-2 rounded-lg text-sm">
                📷 Live Camera Labeling
              </div>
            </div>

            {/* Bottom half - Static path map */}
            <div className="flex-1 relative border-t-2 border-white/20">
              <StaticPathMap
                routeInfo={routeInfo}
                selectedMode={selectedMode}
                onLocationUpdate={handleLocationUpdate}
              />
              
              {/* Map status overlay */}
              <div className="absolute bottom-4 right-4 bg-black/50 text-white px-3 py-2 rounded-lg text-sm">
                🗺️ Route Map
              </div>
            </div>
          </div>
        </>
      ) : (
        /* Permission request screen */
        <div className="absolute inset-0 bg-black/90 flex items-center justify-center">
          <div className="bg-white rounded-lg p-8 max-w-sm mx-4 text-center">
            {arError ? (
              <>
                <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2 text-gray-900">Permission Error</h3>
                <p className="text-gray-600 mb-6">{arError}</p>
                <div className="space-y-2">
                  <Button onClick={requestPermissions} className="w-full">
                    Try Again
                  </Button>
                  <Button onClick={onClose} variant="outline" className="w-full">
                    Back to Map
                  </Button>
                </div>
              </>
            ) : isInitializing ? (
              <>
                <div className="animate-spin w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Starting Live Navigation...</h3>
                <p className="text-gray-600">Setting up camera and location access</p>
              </>
            ) : (
              <>
                <Navigation className="w-12 h-12 text-blue-500 mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Live Navigation</h3>
                <p className="text-gray-600 mb-4">
                  View live camera with place labels and your route map
                </p>
                <Button onClick={requestPermissions} className="w-full">
                  Start Live Navigation
                </Button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Initialization Notice */}
      {permissionsGranted && isInitializing && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-60">
          <div className="bg-black/80 backdrop-blur-sm rounded-lg p-6 text-white text-center">
            <div className="animate-spin w-8 h-8 border-4 border-white border-t-transparent rounded-full mx-auto mb-4" />
            <p className="text-lg font-medium">Setting up Live Navigation...</p>
            <p className="text-sm opacity-80 mt-2">Preparing camera and map view</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default ARNavigation;