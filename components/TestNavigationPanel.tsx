'use client';

import React, { useState } from 'react';
import { Play, Square, RotateCcw, Camera } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { TEST_POINTS, isWithinTestArea } from '../lib/test-data';
import ARNavigation from './ARNavigation';

interface TestNavigationPanelProps {
  selectedStart: string | null;
  selectedDestination: string | null;
  routeInfo: any;
  isNavigating: boolean;
  onStartNavigation: () => void;
  onStopNavigation: () => void;
  onClearRoute: () => void;
}

const TestNavigationPanel: React.FC<TestNavigationPanelProps> = ({
  selectedStart,
  selectedDestination,
  routeInfo,
  isNavigating,
  onStartNavigation,
  onStopNavigation,
  onClearRoute
}) => {
  const [showAR, setShowAR] = useState(false);
  const [locationStatus, setLocationStatus] = useState<{
    isInTestArea: boolean;
    isLoading: boolean;
    error?: string;
    distance?: number;
  }>({ isInTestArea: false, isLoading: false });

  const startPoint = TEST_POINTS.find(p => p.id === selectedStart);
  const destinationPoint = TEST_POINTS.find(p => p.id === selectedDestination);

  const handleARNavigation = async () => {
    setLocationStatus({ isInTestArea: false, isLoading: true });
    
    try {
      // For testing, we'll be more permissive with location validation
      // Check if geolocation is supported
      if (!navigator.geolocation) {
        // Allow AR to work without geolocation for testing
        console.warn('Geolocation not supported, proceeding with AR for testing');
        setLocationStatus({ 
          isInTestArea: true, 
          isLoading: false 
        });
        setShowAR(true);
        return;
      }

      // Get current position
      try {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(
            resolve,
            reject,
            {
              enableHighAccuracy: true,
              timeout: 5000, // Reduced timeout for testing
              maximumAge: 300000
            }
          );
        });

        const { latitude: lat, longitude: lng } = position.coords;
        const isInTestArea = isWithinTestArea(lat, lng);

        setLocationStatus({ 
          isInTestArea, 
          isLoading: false 
        });

        // For testing, allow AR even if not in exact test area
        if (isInTestArea) {
          console.log('User is in test area, launching AR');
          setShowAR(true);
        } else {
          console.log('User not in test area, but allowing AR for testing');
          setLocationStatus({ 
            isInTestArea: true, // Override for testing
            isLoading: false 
          });
          setShowAR(true);
        }
      } catch (locationError: any) {
        console.warn('Location access issue, proceeding with AR for testing:', locationError);
        // For testing, proceed with AR even if location fails
        setLocationStatus({ 
          isInTestArea: true, 
          isLoading: false 
        });
        setShowAR(true);
      }
    } catch (error: any) {
      console.error('AR navigation error:', error);
      // For testing, still try to launch AR
      setLocationStatus({ 
        isInTestArea: true, 
        isLoading: false 
      });
      setShowAR(true);
    }
  };

  const resetSelection = () => {
    onClearRoute();
  };

  const formatDistance = (meters: number): string => {
    return `${meters}m`;
  };

  const formatTravelTime = (seconds: number): string => {
    const minutes = Math.round(seconds / 60);
    return `${minutes} min`;
  };

  return (
    <div className="w-96 bg-white border-r border-gray-200 flex flex-col h-full">
      {/* Header */}
      <div className="p-6 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <Camera className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">AR Navigation Test</h1>
            <p className="text-sm text-gray-600">Simple 2-point test setup</p>
          </div>
        </div>
      </div>

      {/* Point Selection */}
      <div className="p-6 border-b border-gray-100">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Test Route: Point 1 → Point 2</h3>
        
        <div className="space-y-3">
          {/* Start Point */}
          <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
            <div>
              <span className="text-sm font-medium text-green-800">Start Point:</span>
              <div className="text-sm text-green-700 font-semibold">
                Point 1 (12.8810°N, 77.4495°E)
              </div>
            </div>
            <Badge variant="outline" className="bg-green-100 border-green-300 text-green-800">
              Fixed Start
            </Badge>
          </div>

          {/* Destination Point */}
          <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-200">
            <div>
              <span className="text-sm font-medium text-red-800">Destination:</span>
              <div className="text-sm text-red-700 font-semibold">
                Point 2 (12.8805°N, 77.4494°E)
              </div>
            </div>
            <Badge variant="outline" className="bg-red-100 border-red-300 text-red-800">
              Fixed Destination
            </Badge>
          </div>
        </div>

        <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
          <div className="text-xs text-blue-800 font-medium mb-1">🧪 Test Setup</div>
          <div className="text-xs text-blue-700">
            This test uses your specific GeoJSON points. AR navigation will guide you from Point 1 to Point 2.
          </div>
        </div>
      </div>

      {/* Route Information */}
      {routeInfo && routeInfo.found && (
        <div className="p-6 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Route Information</h3>
          
          <Card>
            <CardContent className="p-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">Distance:</span>
                  <div className="font-semibold">{formatDistance(routeInfo.totalDistance)}</div>
                </div>
                <div>
                  <span className="text-gray-600">Time:</span>
                  <div className="font-semibold">{formatTravelTime(routeInfo.totalTravelTime)}</div>
                </div>
              </div>

              <div className="mt-3 pt-3 border-t">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-blue-600 rounded-full"></div>
                  <span className="text-sm text-gray-700">Walking Route</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Navigation Buttons */}
          <div className="mt-4 space-y-2">
            {!isNavigating ? (
              <>
                <Button 
                  onClick={onStartNavigation}
                  className="w-full bg-green-600 hover:bg-green-700"
                  size="lg"
                >
                  <Play className="w-5 h-5 mr-2" />
                  Start Navigation
                </Button>
                
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        onClick={handleARNavigation}
                        className="w-full bg-blue-600 hover:bg-blue-700"
                        size="lg"
                        disabled={!routeInfo || locationStatus.isLoading}
                      >
                        <Camera className="w-5 h-5 mr-2" />
                        {locationStatus.isLoading ? 'Checking Location...' : 'AR Navigation'}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {!routeInfo ? (
                        <p>Select both points first</p>
                      ) : locationStatus.error ? (
                        <p>{locationStatus.error}</p>
                      ) : !locationStatus.isInTestArea && locationStatus.distance !== undefined ? (
                        <p>User not in test area</p>
                      ) : locationStatus.isInTestArea ? (
                        <p>Ready for AR Navigation</p>
                      ) : (
                        <p>Click to check location and start AR</p>
                      )}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </>
            ) : (
              <Button 
                onClick={onStopNavigation}
                variant="destructive"
                className="w-full"
                size="lg"
              >
                <Square className="w-5 h-5 mr-2" />
                Stop Navigation
              </Button>
            )}
            
            <Button 
              variant="outline" 
              onClick={resetSelection}
              className="w-full"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Reset Route
            </Button>
          </div>
        </div>
      )}

      {/* Instructions */}
      {!routeInfo?.found && (
        <div className="p-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Instructions</h3>
          <div className="space-y-2 text-sm text-gray-600">
            <div className="flex items-start gap-2">
              <span className="flex-shrink-0 w-5 h-5 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-semibold">1</span>
              <span>Click on Point 1 marker and select "Set as Start"</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="flex-shrink-0 w-5 h-5 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-semibold">2</span>
              <span>Click on Point 2 marker and select "Set as Destination"</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="flex-shrink-0 w-5 h-5 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-semibold">3</span>
              <span>Route will automatically appear</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="flex-shrink-0 w-5 h-5 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-semibold">4</span>
              <span>Click "AR Navigation" to test AR features</span>
            </div>
          </div>
        </div>
      )}

      {/* AR Navigation Modal */}
      {showAR && routeInfo && (
        <div className="fixed inset-0 z-50">
          <ARNavigation
            routeInfo={routeInfo}
            selectedMode="walking"
            onClose={() => setShowAR(false)}
          />
        </div>
      )}
    </div>
  );
};

export default TestNavigationPanel;