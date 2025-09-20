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
  const route = routeInfo?.segments?.flatMap((segment: any) => segment.coordinates) || [];
  const destination = routeInfo?.destination?.name || routeInfo?.destinationPoint?.name || 'Unknown Destination';
  const totalDistance = routeInfo?.totalDistance || 0;
  const startPoint = routeInfo?.startPoint;
  const sceneRef = useRef<HTMLDivElement>(null);
  const [arSupported, setArSupported] = useState(false);
  const [permissionsGranted, setPermissionsGranted] = useState(false);
  const [arError, setArError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [currentSegment, setCurrentSegment] = useState(0);
  const [navigationPhase, setNavigationPhase] = useState<'to-start' | 'to-destination'>('to-start');
  const [isAtStartPoint, setIsAtStartPoint] = useState(false);

  // Calculate distance between two points using Haversine formula
  const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371000; // Earth's radius in meters
    const dLat = toRadians(lat2 - lat1);
    const dLng = toRadians(lng2 - lng1);
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const toRadians = (degree: number): number => {
    return degree * (Math.PI / 180);
  };

  // Check AR support and request permissions
  const checkARSupport = async () => {
    try {
      // Check if device supports camera
      const devices = await navigator.mediaDevices.enumerateDevices();
      const hasCamera = devices.some(device => device.kind === 'videoinput');
      
      if (!hasCamera) {
        setArError('No camera found on this device');
        return false;
      }

      // Check geolocation support
      if (!navigator.geolocation) {
        setArError('Geolocation not supported on this device');
        return false;
      }

      // For test mode, be more permissive with location validation
      const isTestMode = routeInfo?.startPoint?.id === 'point1' && routeInfo?.destinationPoint?.id === 'point2';
      
      if (isTestMode) {
        console.log('Test mode detected - using permissive location validation');
        // Use test area coordinates for simulation if location fails
        try {
          const position = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: true,
              timeout: 5000,
              maximumAge: 300000
            });
          });
          
          setUserLocation({ lat: position.coords.latitude, lng: position.coords.longitude });
        } catch (locationError) {
          console.warn('Location access failed in test mode, using test coordinates');
          // Use Point 1 coordinates as fallback for testing
          setUserLocation({ lat: 12.880972880040261, lng: 77.4494954935235 });
        }
        
        setArSupported(true);
        return true;
      }

      // Regular campus validation for non-test mode
      const locationValidation = await validateCampusLocation();
      
      if (locationValidation.error) {
        setArError(`Location error: ${locationValidation.error}`);
        return false;
      }

      if (!locationValidation.isInCampus) {
        const distance = locationValidation.distance || 0;
        setArError(`You are ${distance}m away from campus. AR navigation requires you to be on campus.`);
        return false;
      }

      // Set user location from validation
      if (locationValidation.location) {
        setUserLocation(locationValidation.location);
      }

      setArSupported(true);
      return true;
    } catch (error) {
      console.error('AR support check failed:', error);
      setArError('AR not supported on this device');
      return false;
    }
  };

  // Request camera and location permissions
  const requestPermissions = async () => {
    setIsInitializing(true);
    setArError(null);

    try {
      // Request camera permission
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'environment' // Use back camera
        } 
      });
      
      // Stop the stream immediately (AR.js will handle camera)
      stream.getTracks().forEach(track => track.stop());

      // Request location permission
      return new Promise<boolean>((resolve) => {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const currentLocation = {
              lat: position.coords.latitude,
              lng: position.coords.longitude
            };
            setUserLocation(currentLocation);
            
            // Check if user is at start point
            if (startPoint && startPoint.coordinates) {
              const [startLng, startLat] = startPoint.coordinates;
              const distanceToStart = calculateDistance(
                currentLocation.lat, currentLocation.lng,
                startLat, startLng
              );
              
              // Consider user "at start point" if within 50 meters
              const isAtStart = distanceToStart <= 50;
              setIsAtStartPoint(isAtStart);
              setNavigationPhase(isAtStart ? 'to-destination' : 'to-start');
              
              console.log(`Distance to start: ${distanceToStart.toFixed(1)}m, Phase: ${isAtStart ? 'to-destination' : 'to-start'}`);
            }
            
            setPermissionsGranted(true);
            setIsInitializing(false);
            resolve(true);
          },
          (error) => {
            console.error('Geolocation error:', error);
            setArError(`Location access denied: ${error.message}`);
            setIsInitializing(false);
            resolve(false);
          },
          {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 60000
          }
        );
      });
    } catch (error: any) {
      console.error('Permission request failed:', error);
      setArError(`Camera access denied: ${error.message}`);
      setIsInitializing(false);
      return false;
    }
  };

  // Initialize AR scene
  const initializeARScene = async () => {
    if (!sceneRef.current || !permissionsGranted || route.length === 0) {
      console.log('AR scene initialization skipped:', {
        sceneRef: !!sceneRef.current,
        permissionsGranted,
        routeLength: route.length
      });
      return;
    }

    console.log('Initializing AR scene...');
    setIsInitializing(true);

    try {
      // Clear previous content
      sceneRef.current.innerHTML = '';

      // Create AR scene HTML with simplified, more reliable configuration
      const sceneHTML = `
        <a-scene
          id="ar-scene"
          vr-mode-ui="enabled: false"
          embedded
          arjs="sourceType: webcam; debugUIEnabled: true; detectionMode: mono_and_matrix; matrixCodeType: 3x3;"
          style="width: 100%; height: 100%; position: absolute; top: 0; left: 0; z-index: 1;"
          renderer="logarithmicDepthBuffer: true; precision: medium;"
          loading-screen="enabled: false;"
        >
        <!-- Start Point Marker (if not at start) -->
        ${navigationPhase === 'to-start' && startPoint && startPoint.coordinates ? `
          <a-entity
            id="start-point"
            gps-entity-place="latitude: ${startPoint.coordinates[1]}; longitude: ${startPoint.coordinates[0]};"
            geometry="primitive: cylinder; height: 8; radius: 1.5;"
            material="color: #10B981; opacity: 0.9;"
            scale="2.5 2.5 2.5"
            animation="property: scale; to: 3 3 3; direction: alternate; loop: true; dur: 1500;"
            text="value: START POINT; position: 0 5 0; align: center; color: white; width: 15;"
          ></a-entity>
        ` : ''}

        <!-- Route waypoints (only show if at start point) -->
        ${navigationPhase === 'to-destination' ? route.map((point: any, index: number) => `
          <a-entity
            id="waypoint-${index}"
            gps-entity-place="latitude: ${point[0]}; longitude: ${point[1]};"
            geometry="primitive: cone; height: 5; radiusBottom: 1; radiusTop: 0;"
            material="color: ${index === currentSegment ? '#FF6B6B' : '#4ECDC4'}; opacity: 0.8;"
            scale="2 4 2"
            animation="property: rotation; to: 0 360 0; loop: true; dur: 3000;"
          ></a-entity>
        `).join('') : ''}
        
        <!-- Direction arrows between waypoints (only show if at start point) -->
        ${navigationPhase === 'to-destination' ? route.slice(0, -1).map((point: any, index: number) => {
          const nextPoint = route[index + 1];
          const midLat = (point[0] + nextPoint[0]) / 2;
          const midLng = (point[1] + nextPoint[1]) / 2;
          
          return `
            <a-entity
              id="arrow-${index}"
              gps-entity-place="latitude: ${midLat}; longitude: ${midLng};"
              geometry="primitive: cone; height: 3; radiusBottom: 0.5; radiusTop: 0;"
              material="color: #45B7D1; opacity: 0.9;"
              scale="1 2 1"
              look-at="[gps-camera]"
            ></a-entity>
          `;
        }).join('') : ''}
        
        <!-- Final Destination marker (always show) -->
        ${route.length > 0 ? `
          <a-entity
            id="destination"
            gps-entity-place="latitude: ${route[route.length - 1][0]}; longitude: ${route[route.length - 1][1]};"
            geometry="primitive: cylinder; height: 8; radius: 1;"
            material="color: ${navigationPhase === 'to-destination' ? '#10B981' : '#6B7280'}; opacity: 0.9;"
            scale="2 2 2"
            animation="property: scale; to: 2.5 2.5 2.5; direction: alternate; loop: true; dur: 1000;"
            text="value: ${destination || 'DESTINATION'}; position: 0 4 0; align: center; color: white; width: 20;"
          ></a-entity>
        ` : ''}
        
        <!-- AR Camera -->
        <a-camera 
          id="ar-camera"
          gps-camera="gpsMinDistance: 5; simulateLatitude: ${userLocation?.lat || 0}; simulateLongitude: ${userLocation?.lng || 0};"
          rotation-reader
          wasd-controls="enabled: false;"
          look-controls="enabled: true; magicWindowTrackingEnabled: true; touchEnabled: true; mouseEnabled: true;"
        >
          <!-- AR UI Overlay -->
          <a-plane 
            position="0 2 -3" 
            width="5" 
            height="1.5" 
            color="#000000" 
            opacity="0.8"
            text="value: ${navigationPhase === 'to-start' 
              ? 'Navigate to START POINT first\\n' + (startPoint?.name || 'Start Location')
              : 'AR Navigation to ' + destination
            }; position: 0 0 0.1; align: center; color: white; width: 8;"
          ></a-plane>
        </a-camera>
        
        <!-- Ambient lighting -->
        <a-light type="ambient" color="#ffffff" intensity="0.5"></a-light>
        <a-light type="directional" position="0 1 0" color="#ffffff" intensity="0.5"></a-light>
      </a-scene>
    `;

      sceneRef.current.innerHTML = sceneHTML;

      // Load AR libraries first
      await loadARLibraries();
      
      // Verify libraries are ready
      if (!areARLibrariesReady()) {
        throw new Error('AR libraries failed to initialize properly');
      }
      
      console.log('AR libraries ready, scene created');
      
      // Add event listener for when AR scene is ready
      setTimeout(() => {
        const arScene = sceneRef.current?.querySelector('#ar-scene');
        if (arScene) {
          arScene.addEventListener('loaded', () => {
            console.log('AR scene loaded successfully');
            setIsInitializing(false);
          });
          
          // Fallback timeout in case 'loaded' event doesn't fire
          setTimeout(() => {
            console.log('AR scene initialization timeout - assuming ready');
            setIsInitializing(false);
          }, 5000);
        } else {
          setIsInitializing(false);
        }
      }, 1000);
      
    } catch (error: any) {
      console.error('Failed to initialize AR scene:', error);
      setArError(`Failed to initialize AR: ${error?.message || 'Unknown error'}. Please refresh and try again.`);
      setIsInitializing(false);
    }
  };

  // Initialize AR when component mounts
  useEffect(() => {
    if (!arSupported) {
      checkARSupport();
    }
  }, []);

  // Initialize AR scene when permissions are granted
  useEffect(() => {
    if (permissionsGranted && route.length > 0) {
      console.log('Permissions granted, initializing AR scene in 1 second...');
      setIsInitializing(true); // Show loading overlay
      
      setTimeout(() => {
        initializeARScene();
      }, 1000); // Small delay to ensure DOM is ready
    }
  }, [permissionsGranted, route, currentSegment, navigationPhase]);

  // Periodically check user's location to update navigation phase
  useEffect(() => {
    if (!permissionsGranted || !startPoint || isAtStartPoint) return;

    const locationCheckInterval = setInterval(() => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const currentLocation = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          
          setUserLocation(currentLocation);
          
          if (startPoint && startPoint.coordinates) {
            const [startLng, startLat] = startPoint.coordinates;
            const distanceToStart = calculateDistance(
              currentLocation.lat, currentLocation.lng,
              startLat, startLng
            );
            
            // Check if user has reached the start point
            if (distanceToStart <= 50 && navigationPhase === 'to-start') {
              setIsAtStartPoint(true);
              setNavigationPhase('to-destination');
              console.log('User reached start point, switching to destination navigation');
              
              // Re-initialize AR scene with destination markers
              setTimeout(() => {
                initializeARScene();
              }, 500);
            }
          }
        },
        (error) => {
          console.error('Location update error:', error);
        },
        {
          enableHighAccuracy: true,
          maximumAge: 30000, // 30 seconds
          timeout: 10000
        }
      );
    }, 5000); // Check every 5 seconds

    return () => clearInterval(locationCheckInterval);
  }, [permissionsGranted, startPoint, isAtStartPoint, navigationPhase]);

  // Cleanup on component unmount
  useEffect(() => {
    return () => {
      // Clean up AR scene
      if (sceneRef.current) {
        sceneRef.current.innerHTML = '';
      }
      
      console.log('AR Navigation component unmounted and cleaned up');
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-black">
      {/* Fallback Camera Stream - shows while AR is loading */}
      {permissionsGranted && isInitializing && (
        <div className="absolute inset-0 z-5">
          <video
            id="fallback-camera"
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
            ref={(video) => {
              if (video && !video.srcObject) {
                navigator.mediaDevices.getUserMedia({ 
                  video: { facingMode: 'environment' } 
                }).then(stream => {
                  video.srcObject = stream;
                }).catch(err => console.log('Fallback camera error:', err));
              }
            }}
          />
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
            <Card className="bg-white">
              <CardContent className="p-4 text-center">
                <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-2"></div>
                <p className="text-sm">Loading AR Scene...</p>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* AR Scene Container */}
      <div ref={sceneRef} className="w-full h-full relative">
        {/* AR Error State */}
        {permissionsGranted && arError && (
          <div className="absolute inset-0 bg-red-900 bg-opacity-90 flex items-center justify-center z-20">
            <Card className="max-w-md mx-4">
              <CardContent className="p-6 text-center">
                <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2 text-white">AR Initialization Failed</h3>
                <p className="text-gray-300 mb-4">{arError}</p>
                <div className="space-y-2">
                  <Button onClick={() => window.location.reload()} className="w-full">
                    Refresh Page
                  </Button>
                  <Button onClick={onClose} variant="outline" className="w-full">
                    Back to Map
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
        
        {/* Loading/Permission Screen */}
        {!permissionsGranted && (
          <div className="absolute inset-0 bg-black bg-opacity-80 flex items-center justify-center z-10">
            <Card className="max-w-md mx-4">
              <CardContent className="p-6 text-center">
                {!arSupported ? (
                  <>
                    <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">AR Not Supported</h3>
                    <p className="text-gray-600 mb-4">{arError}</p>
                    <Button onClick={onClose} variant="outline">
                      Back to Map View
                    </Button>
                  </>
                ) : isInitializing ? (
                  <>
                    <div className="animate-spin w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                    <h3 className="text-lg font-semibold mb-2">Initializing AR...</h3>
                    <p className="text-gray-600">Requesting camera and location access</p>
                  </>
                ) : arError ? (
                  <>
                    <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Permission Required</h3>
                    <p className="text-gray-600 mb-4">{arError}</p>
                    <div className="space-y-2">
                      <Button onClick={requestPermissions} className="w-full">
                        <Camera className="w-4 h-4 mr-2" />
                        Grant Permissions
                      </Button>
                      <Button onClick={onClose} variant="outline" className="w-full">
                        Back to Map View
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <Camera className="w-12 h-12 text-blue-500 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">AR Navigation Ready</h3>
                    <p className="text-gray-600 mb-4">
                      Allow camera and location access to see route directions in augmented reality
                    </p>
                    <div className="space-y-2">
                      <Button onClick={requestPermissions} className="w-full">
                        <Navigation className="w-4 h-4 mr-2" />
                        Start AR Navigation
                      </Button>
                      <Button onClick={onClose} variant="outline" className="w-full">
                        Use Map Instead
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* AR Controls Overlay */}
      {permissionsGranted && (
        <div className="absolute top-4 left-4 right-4 z-20">
          <div className="flex justify-between items-start">
            {/* Route Info */}
            <Card className="bg-black bg-opacity-70 text-white">
              <CardContent className="p-3">
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="w-4 h-4" />
                  <span>
                    {navigationPhase === 'to-start' 
                      ? `First go to ${startPoint?.name || 'Start Point'}`
                      : `AR Navigation to ${destination}`
                    }
                  </span>
                </div>
                <div className="text-xs text-gray-300 mt-1">
                  {navigationPhase === 'to-start' 
                    ? '🎯 Look for green START POINT marker'
                    : totalDistance > 0 
                      ? `Total: ${(totalDistance / 1000).toFixed(2)} km`
                      : 'Follow route markers'
                  }
                </div>
                {navigationPhase === 'to-start' && (
                  <div className="text-xs text-yellow-300 mt-1">
                    Phase 1/2: Navigate to start position
                  </div>
                )}
                {navigationPhase === 'to-destination' && (
                  <div className="text-xs text-green-300 mt-1">
                    Phase 2/2: Follow route to destination
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Close Button */}
            <Button 
              onClick={onClose}
              size="sm"
              variant="destructive"
              className="bg-red-600 hover:bg-red-700"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Debug Info - temporary for troubleshooting */}
      {process.env.NODE_ENV === 'development' && (
        <div className="absolute top-20 right-4 z-30">
          <Card className="bg-yellow-500 bg-opacity-90 text-black text-xs">
            <CardContent className="p-2">
              <div>🔧 Debug Info:</div>
              <div>AR Supported: {arSupported ? '✅' : '❌'}</div>
              <div>Permissions: {permissionsGranted ? '✅' : '❌'}</div>
              <div>Initializing: {isInitializing ? '⏳' : '✅'}</div>
              <div>User Location: {userLocation ? '✅' : '❌'}</div>
              <div>Route Length: {route.length}</div>
              <div>Phase: {navigationPhase}</div>
              <div>AR Error: {arError ? '❌' : '✅'}</div>
              {!permissionsGranted && (
                <Button 
                  onClick={() => {
                    setPermissionsGranted(true);
                    setUserLocation({ lat: 12.880972880040261, lng: 77.4494954935235 });
                    initializeARScene();
                  }}
                  size="sm"
                  className="mt-2 w-full text-xs"
                >
                  🔧 Force AR Test
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* AR Instructions */}
      {permissionsGranted && !isInitializing && (
        <div className="absolute bottom-4 left-4 right-4 z-20">
          <Card className="bg-black bg-opacity-70 text-white">
            <CardContent className="p-3 text-center">
              <p className="text-sm">
                📱 Point your camera towards the route • 🔄 Move around to see AR markers
              </p>
              <p className="text-xs text-gray-300 mt-1">
                Blue cones = waypoints • Red cone = current target • Green cylinder = destination
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default ARNavigation;