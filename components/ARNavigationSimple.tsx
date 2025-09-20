"use client";

import { useEffect, useRef, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Navigation, X, AlertTriangle } from 'lucide-react';
import {
  calculateBearing,
  calculateDistance,
  convertToARPosition,
  getNextNavigationPoint,
  smoothBearing,
  type ARNavigationPoint,
  type ARArrowPosition,
} from '@/lib/ar-navigation';

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
  // Extract route data from routeInfo
  const route: [number, number][] = routeInfo?.segments?.flatMap((segment: any) => 
    segment.coordinates?.map((coord: [number, number]) => [coord[1], coord[0]]) // Convert to [lat, lng]
  ) || [];
  
  const destination = routeInfo?.destination?.name || routeInfo?.destinationPoint?.name || 'Unknown Destination';
  
  const sceneRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const arrowEntityRef = useRef<any>(null);
  
  const [isARReady, setIsARReady] = useState(false);
  const [permissionsGranted, setPermissionsGranted] = useState(false);
  const [arError, setArError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [currentBearing, setCurrentBearing] = useState(0);
  const [deviceOrientation, setDeviceOrientation] = useState(0);
  const [distance, setDistance] = useState(0);
  const [nextPoint, setNextPoint] = useState<ARNavigationPoint | null>(null);
  const [arrowPosition, setArrowPosition] = useState<ARArrowPosition>({
    x: 0,
    y: 0,
    z: -5,
    rotationY: 0,
  });

  // Handle device orientation
  useEffect(() => {
    const handleOrientation = (event: DeviceOrientationEvent) => {
      if (event.alpha !== null) {
        setDeviceOrientation(event.alpha);
      }
    };

    if (typeof DeviceOrientationEvent !== 'undefined') {
      window.addEventListener('deviceorientation', handleOrientation);
      return () => window.removeEventListener('deviceorientation', handleOrientation);
    }
  }, []);

  // Get user location
  const getCurrentLocation = useCallback(() => {
    return new Promise<{ lat: number; lng: number }>((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation not supported'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (error) => reject(error),
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000,
        }
      );
    });
  }, []);

  // Update AR arrow based on navigation data
  const updateARArrow = useCallback(() => {
    if (!userLocation || !route || route.length === 0) return;

    const currentNextPoint = getNextNavigationPoint(
      userLocation.lat,
      userLocation.lng,
      route
    );

    if (!currentNextPoint) return;

    setNextPoint(currentNextPoint);

    const newDistance = currentNextPoint.distance || 0;
    const targetBearing = currentNextPoint.bearing || 0;

    // Smooth bearing transition
    const smoothedBearing = smoothBearing(currentBearing, targetBearing, 0.2);
    setCurrentBearing(smoothedBearing);
    setDistance(newDistance);

    // Convert to AR coordinates
    const newPosition = convertToARPosition(smoothedBearing, newDistance, deviceOrientation);
    setArrowPosition(newPosition);

    // Update A-Frame entity if it exists
    if (arrowEntityRef.current) {
      arrowEntityRef.current.setAttribute('position', {
        x: newPosition.x,
        y: newPosition.y,
        z: newPosition.z,
      });
      arrowEntityRef.current.setAttribute('rotation', {
        x: 0,
        y: newPosition.rotationY,
        z: 0,
      });
    }
  }, [userLocation, route, currentBearing, deviceOrientation]);

  // Request permissions and start camera
  const requestPermissions = async () => {
    setIsInitializing(true);
    setArError(null);

    try {
      // Request camera permission and start video
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      // Get user location
      const location = await getCurrentLocation();
      setUserLocation(location);

      setPermissionsGranted(true);
      setIsInitializing(false);
    } catch (error: any) {
      console.error('Permission request failed:', error);
      setArError(`Access denied: ${error.message}`);
      setIsInitializing(false);
    }
  };

  // Load A-Frame scripts
  const loadAFrameScripts = useCallback(() => {
    return new Promise<void>((resolve, reject) => {
      // Check if A-Frame is already loaded
      if (typeof (window as any).AFRAME !== 'undefined') {
        resolve();
        return;
      }

      const aframeScript = document.createElement('script');
      aframeScript.src = 'https://aframe.io/releases/1.4.0/aframe.min.js';
      aframeScript.onload = () => {
        const arScript = document.createElement('script');
        arScript.src = 'https://cdn.rawgit.com/jeromeetienne/AR.js/2.2.1/aframe/build/aframe-ar.js';
        arScript.onload = () => resolve();
        arScript.onerror = () => reject(new Error('Failed to load AR.js'));
        document.head.appendChild(arScript);
      };
      aframeScript.onerror = () => reject(new Error('Failed to load A-Frame'));
      document.head.appendChild(aframeScript);
    });
  }, []);

  // Initialize AR scene
  const initializeARScene = useCallback(async () => {
    if (!sceneRef.current || !permissionsGranted) return;

    try {
      setIsInitializing(true);
      
      await loadAFrameScripts();

      // Create AR scene
      sceneRef.current.innerHTML = `
        <a-scene
          embedded
          arjs="sourceType: webcam; displayWidth: 640; displayHeight: 480; rendererColorManagement: true;"
          vr-mode-ui="enabled: false"
          style="width: 100%; height: 100%;"
        >
          <a-assets>
            <a-mixin
              id="arrow-material"
              material="color: #ff4444; metalness: 0.2; roughness: 0.8;"
            />
          </a-assets>

          <!-- Navigation Arrow -->
          <a-entity
            id="ar-arrow"
            position="${arrowPosition.x} ${arrowPosition.y} ${arrowPosition.z}"
            rotation="0 ${arrowPosition.rotationY} 0"
          >
            <!-- Arrow body (cone) -->
            <a-cone
              mixin="arrow-material"
              radius-bottom="0.3"
              radius-top="0.05"
              height="1.5"
              position="0 0.75 0"
              animation="property: rotation; to: 0 360 0; loop: true; dur: 4000"
            />
            
            <!-- Arrow base (cylinder) -->
            <a-cylinder
              mixin="arrow-material"
              radius="0.1"
              height="0.5" 
              position="0 0.25 0"
            />

            <!-- Distance indicator -->
            <a-text
              value="${Math.round(distance)}m"
              position="0 2 0"
              align="center"
              color="#ffffff"
              shader="msdf"
              font="roboto"
              scale="2 2 2"
            />
          </a-entity>

          <!-- Camera -->
          <a-camera
            look-controls-enabled="true"
            arjs-look-controls="smoothingFactor: 0.1"
            arjs-device-orientation-controls="smoothingFactor: 0.1"
          />
        </a-scene>
      `;

      // Get reference to arrow entity
      setTimeout(() => {
        const arrowEntity = sceneRef.current?.querySelector('#ar-arrow');
        if (arrowEntity) {
          arrowEntityRef.current = arrowEntity;
        }
        setIsARReady(true);
        setIsInitializing(false);
      }, 1000);

    } catch (error: any) {
      console.error('Failed to initialize AR:', error);
      setArError(`Failed to initialize AR: ${error.message}`);
      setIsInitializing(false);
    }
  }, [permissionsGranted, arrowPosition, distance]);

  // Update location periodically
  useEffect(() => {
    if (!permissionsGranted) return;

    const locationInterval = setInterval(async () => {
      try {
        const location = await getCurrentLocation();
        setUserLocation(location);
      } catch (error) {
        console.error('Location update failed:', error);
      }
    }, 5000);

    return () => clearInterval(locationInterval);
  }, [permissionsGranted, getCurrentLocation]);

  // Update AR arrow when data changes
  useEffect(() => {
    if (isARReady) {
      updateARArrow();
    }
  }, [isARReady, updateARArrow]);

  // Initialize when permissions granted
  useEffect(() => {
    if (permissionsGranted && route.length > 0) {
      initializeARScene();
    }
  }, [permissionsGranted, route, initializeARScene]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (videoRef.current?.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-black">
      {/* Camera Video Background */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="absolute inset-0 w-full h-full object-cover"
        style={{ display: permissionsGranted ? 'block' : 'none' }}
      />

      {/* AR Scene Overlay */}
      {permissionsGranted && (
        <div
          ref={sceneRef}
          className="absolute inset-0 w-full h-full"
          style={{ pointerEvents: 'none' }}
        />
      )}

      {/* Controls Overlay */}
      <div className="absolute top-4 left-4 right-4 z-60">
        <div className="flex justify-between items-center">
          <div className="bg-black/60 backdrop-blur-sm rounded-lg px-3 py-2 text-white">
            <div className="flex items-center gap-2">
              <Navigation size={16} />
              <span className="text-sm">AR Navigation</span>
            </div>
          </div>

          <Button
            onClick={onClose}
            variant="outline"
            size="sm"
            className="bg-black/60 backdrop-blur-sm border-white/20 text-white hover:bg-white/20"
          >
            <X size={16} />
          </Button>
        </div>
      </div>

      {/* Navigation Info */}
      {permissionsGranted && nextPoint && (
        <div className="absolute bottom-4 left-4 right-4 z-60">
          <div className="bg-black/60 backdrop-blur-sm rounded-lg p-4 text-white">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm opacity-80">Distance to next point:</span>
              <span className="font-bold">{Math.round(distance)}m</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm opacity-80">Bearing:</span>
              <span className="font-bold">{Math.round(currentBearing)}°</span>
            </div>
            <div className="mt-2 text-center">
              <span className="text-xs opacity-80">Following route to {destination}</span>
            </div>
          </div>
        </div>
      )}

      {/* Loading/Error States */}
      {!permissionsGranted && (
        <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-60">
          <div className="bg-white rounded-lg p-6 max-w-sm mx-4 text-center">
            {arError ? (
              <>
                <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">AR Error</h3>
                <p className="text-gray-600 mb-4">{arError}</p>
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
                <h3 className="text-lg font-semibold mb-2">Starting AR...</h3>
                <p className="text-gray-600">Setting up camera and location</p>
              </>
            ) : (
              <>
                <Navigation className="w-12 h-12 text-blue-500 mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">AR Navigation</h3>
                <p className="text-gray-600 mb-4">
                  See direction arrows in your live camera view
                </p>
                <Button onClick={requestPermissions} className="w-full">
                  Start AR Navigation
                </Button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Permissions Notice */}
      {permissionsGranted && isInitializing && (
        <div className="absolute bottom-4 left-4 right-4 z-60">
          <div className="bg-yellow-600/90 backdrop-blur-sm rounded-lg p-3 text-white text-sm text-center">
            📱 Loading AR scene...
          </div>
        </div>
      )}
    </div>
  );
};

export default ARNavigation;