'use client';

import React, { useState, useMemo } from 'react';
import { Search, MapPin, Navigation2, Play, Square, RotateCcw, MapPinIcon, Camera } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  NAVIGATION_MODES, 
  DESTINATION_CATEGORIES,
  filterDestinationsByCategory,
  searchDestinations,
  formatTravelTime,
  formatDistance
} from '../lib/navigation';

import { getValidStartGates, isValidStartPoint } from '../lib/hybrid-routing';
import { validateCampusLocation } from '../lib/campus-boundaries';
import ARNavigation from './ARNavigation';

interface NavigationPanelProps {
  selectedMode: string;
  selectedStartPoint: any;
  selectedDestination: any;
  routeInfo: any;
  isNavigating: boolean;
  onModeChange: (mode: string) => void;
  onStartPointSelect: (destination: any) => void;
  onDestinationSelect: (destination: any) => void;
  onStartNavigation: () => void;
  onStopNavigation: () => void;
  onClearRoute: () => void;
}

const NavigationPanel: React.FC<NavigationPanelProps> = ({
  selectedMode,
  selectedStartPoint,
  selectedDestination,
  routeInfo,
  isNavigating,
  onModeChange,
  onStartPointSelect,
  onDestinationSelect,
  onStartNavigation,
  onStopNavigation,
  onClearRoute
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectionStep, setSelectionStep] = useState<'mode' | 'start' | 'destination'>('mode');
  const [showAR, setShowAR] = useState(false);
  const [locationStatus, setLocationStatus] = useState<{
    isInCampus: boolean;
    isLoading: boolean;
    error?: string;
    distance?: number;
  }>({ isInCampus: false, isLoading: false });

  const filteredDestinations = useMemo(() => {
    let destinations = filterDestinationsByCategory(selectedCategory);
    if (searchQuery.trim()) {
      destinations = searchDestinations(searchQuery);
    }
    
    // Filter out selected start point from destination list
    if (selectionStep === 'destination' && selectedStartPoint) {
      destinations = destinations.filter(dest => dest.id !== selectedStartPoint.id);
    }
    
    // Filter start points based on vehicle mode restrictions
    if (selectionStep === 'start' && (selectedMode === '4' || selectedMode === '2')) {
      const validGates = getValidStartGates(selectedMode);
      destinations = destinations.filter(dest => {
        // Only show valid gates for vehicle modes
        if (dest.category === 'entrance') {
          return validGates.includes(dest.id);
        }
        return true; // Keep other destinations for completeness
      });
    }
    
    return destinations;
  }, [searchQuery, selectedCategory, selectionStep, selectedStartPoint, selectedMode]);

  const groupedDestinations = useMemo(() => {
    const grouped: { [key: string]: any[] } = {};
    filteredDestinations.forEach(dest => {
      if (!grouped[dest.category]) {
        grouped[dest.category] = [];
      }
      grouped[dest.category].push(dest);
    });
    return grouped;
  }, [filteredDestinations]);

  const handleModeSelect = (mode: string) => {
    onModeChange(mode);
    setSelectionStep('start');
  };

  const handleDestinationClick = (destination: any) => {
    if (selectionStep === 'start') {
      onStartPointSelect(destination);
      setSelectionStep('destination');
      setSearchQuery('');
    } else if (selectionStep === 'destination') {
      onDestinationSelect(destination);
    }
  };

  const resetSelection = () => {
    onClearRoute();
    setSelectionStep('mode');
    setSearchQuery('');
    setSelectedCategory('all');
  };

  const handleARNavigation = async () => {
    setLocationStatus({ isInCampus: false, isLoading: true });
    
    try {
      const validation = await validateCampusLocation();
      
      if (validation.error) {
        setLocationStatus({ 
          isInCampus: false, 
          isLoading: false, 
          error: validation.error 
        });
        return;
      }

      const isInCampus = validation.isInCampus;
      const distance = validation.distance || 0;

      setLocationStatus({ 
        isInCampus, 
        isLoading: false, 
        distance 
      });

      if (isInCampus) {
        setShowAR(true);
      }
    } catch (error) {
      setLocationStatus({ 
        isInCampus: false, 
        isLoading: false, 
        error: 'Failed to check location' 
      });
    }
  };

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

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="p-6 border-b border-gray-100">
        <div className="flex items-center gap-2 mb-4">
          <Navigation2 className="w-6 h-6 text-blue-600" />
          <h1 className="text-xl font-bold text-gray-900">Campus Navigator</h1>
        </div>
        
        {/* Progress Steps */}
        <div className="flex items-center gap-2 mb-4">
          <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm ${
            selectionStep === 'mode' ? 'bg-blue-100 text-blue-700' : 
            selectedMode ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
          }`}>
            <div className={`w-2 h-2 rounded-full ${
              selectedMode ? 'bg-green-500' : selectionStep === 'mode' ? 'bg-blue-500' : 'bg-gray-400'
            }`}></div>
            <span>Transport</span>
          </div>
          <div className="w-4 h-px bg-gray-300"></div>
          <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm ${
            selectionStep === 'start' ? 'bg-blue-100 text-blue-700' : 
            selectedStartPoint ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
          }`}>
            <div className={`w-2 h-2 rounded-full ${
              selectedStartPoint ? 'bg-green-500' : selectionStep === 'start' ? 'bg-blue-500' : 'bg-gray-400'
            }`}></div>
            <span>Start</span>
          </div>
          <div className="w-4 h-px bg-gray-300"></div>
          <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm ${
            selectionStep === 'destination' ? 'bg-blue-100 text-blue-700' : 
            selectedDestination ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
          }`}>
            <div className={`w-2 h-2 rounded-full ${
              selectedDestination ? 'bg-green-500' : selectionStep === 'destination' ? 'bg-blue-500' : 'bg-gray-400'
            }`}></div>
            <span>Destination</span>
          </div>
        </div>

        {/* Selected Mode Display */}
        {selectedMode && (
          <div className="mb-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-lg">{NAVIGATION_MODES.find(m => m.id === selectedMode)?.icon}</span>
                <div>
                  <div className="text-sm font-medium text-blue-800">
                    Mode: {NAVIGATION_MODES.find(m => m.id === selectedMode)?.name}
                  </div>
                  {(selectedMode === '4' || selectedMode === '2') && (
                    <div className="text-xs text-amber-700 mt-1">
                      {selectedMode === '4' ? '⚠️ 4-wheelers can only enter through Gate 1' : '⚠️ 2-wheelers can only enter through Gate 2'}
                    </div>
                  )}
                </div>
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={resetSelection}
                className="text-blue-700 hover:text-blue-800"
              >
                <RotateCcw className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Selected Points Display */}
        {selectedStartPoint && (
          <div className="mb-3 p-3 bg-green-50 rounded-lg border border-green-200">
            <div className="flex items-center gap-2">
              <span className="text-lg">🚀</span>
              <div>
                <div className="text-sm font-medium text-green-800">Start: {selectedStartPoint.name}</div>
                <div className="text-xs text-green-600 capitalize">{selectedStartPoint.category}</div>
              </div>
            </div>
          </div>
        )}

        {selectedDestination && (
          <div className="mb-3 p-3 bg-red-50 rounded-lg border border-red-200">
            <div className="flex items-center gap-2">
              <span className="text-lg">🎯</span>
              <div>
                <div className="text-sm font-medium text-red-800">Destination: {selectedDestination.name}</div>
                <div className="text-xs text-red-600 capitalize">{selectedDestination.category}</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Transportation Mode Selection */}
      {selectionStep === 'mode' && (
        <div className="p-6 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Select Transportation Mode</h3>
          <div className="grid grid-cols-1 gap-3">
            {NAVIGATION_MODES.map(mode => (
              <Button
                key={mode.id}
                variant="outline"
                onClick={() => handleModeSelect(mode.id)}
                className="flex items-center gap-3 h-auto py-4 px-4 justify-start hover:bg-gray-50 hover:border-gray-300 transition-all duration-200"
              >
                <span className="text-2xl">{mode.icon}</span>
                <div className="text-left">
                  <div className="font-medium text-gray-900">{mode.name}</div>
                  <div className="text-sm text-gray-500">Speed: {mode.speed} m/s</div>
                </div>
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Route Information */}
      {routeInfo && routeInfo.found && (
        <div className="p-6 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Route Information</h3>
          
          {/* Overall Stats */}
          <div className="bg-gray-50 rounded-lg p-3 mb-3">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-gray-600">Distance:</span>
                <div className="font-semibold">{formatDistance(routeInfo.totalDistance)}</div>
              </div>
              <div>
                <span className="text-gray-600">Time:</span>
                <div className="font-semibold">{formatTravelTime(routeInfo.totalTravelTime)}</div>
              </div>
            </div>
          </div>
          
          {/* Segments */}
          {routeInfo.segments.length > 1 && (
            <div className="space-y-2 mb-4">
              <span className="text-xs font-medium text-gray-700 uppercase tracking-wide">Route Segments</span>
              {routeInfo.segments.map((segment: any, index: number) => (
                <div key={index} className="flex items-center gap-2 text-sm">
                  <div 
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: segment.color }}
                  ></div>
                  <div className="flex-1">
                    <div className="font-medium">{getModeName(segment.mode)}</div>
                    <div className="text-xs text-gray-600">
                      {formatDistance(segment.distance)} • {formatTravelTime(segment.travelTime)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          
          {/* Navigation Buttons */}
          <div className="space-y-2">
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
                        <p>Calculate a route first</p>
                      ) : locationStatus.error ? (
                        <p>{locationStatus.error}</p>
                      ) : locationStatus.distance !== undefined && !locationStatus.isInCampus ? (
                        <p>User not in campus (Distance: {locationStatus.distance}m)</p>
                      ) : locationStatus.isInCampus ? (
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

      {/* Destination Selection */}
      {(selectionStep === 'start' || selectionStep === 'destination') && (
        <div className="flex-1 overflow-hidden flex flex-col">
          <div className="p-6 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">
              {selectionStep === 'start' ? 'Select Start Point' : 'Select Destination'}
            </h3>
            
            {/* Search */}
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder={`Search ${selectionStep === 'start' ? 'start points' : 'destinations'}...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Category Filter */}
            <div className="grid grid-cols-4 gap-1 mb-4">
              {DESTINATION_CATEGORIES.slice(0, 4).map(category => (
                <Button
                  key={category.id}
                  variant={selectedCategory === category.id ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedCategory(category.id)}
                  className="text-xs py-2 h-auto"
                >
                  <span className="mr-1">{category.icon}</span>
                  {category.name.split(' ')[0]}
                </Button>
              ))}
            </div>
            <div className="grid grid-cols-4 gap-1">
              {DESTINATION_CATEGORIES.slice(4).map(category => (
                <Button
                  key={category.id}
                  variant={selectedCategory === category.id ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedCategory(category.id)}
                  className="text-xs py-2 h-auto"
                >
                  <span className="mr-1">{category.icon}</span>
                  {category.name.split(' ')[0]}
                </Button>
              ))}
            </div>
          </div>

          {/* Destinations List */}
          <div className="flex-1 overflow-y-auto p-6">
            {Object.entries(groupedDestinations).length > 0 ? (
              <div className="space-y-4">
                {Object.entries(groupedDestinations).map(([category, dests]) => (
                  <div key={category}>
                    <h4 className="text-sm font-semibold text-gray-700 mb-2 capitalize">
                      {category.replace('-', ' ')}
                    </h4>
                    <div className="space-y-2">
                      {dests.map(dest => {
                        const isInvalidStart = selectionStep === 'start' && 
                          (selectedMode === '4' || selectedMode === '2') && 
                          dest.category === 'entrance' && 
                          !isValidStartPoint(dest.id, selectedMode);
                        
                        return (
                        <Card
                          key={dest.id}
                          className={`cursor-pointer transition-all duration-200 hover:shadow-md ${
                            (selectionStep === 'start' && selectedStartPoint?.id === dest.id) ||
                            (selectionStep === 'destination' && selectedDestination?.id === dest.id)
                              ? 'ring-2 ring-blue-500 bg-blue-50' 
                              : isInvalidStart
                              ? 'opacity-50 cursor-not-allowed bg-red-50'
                              : 'hover:bg-gray-50'
                          }`}
                          onClick={() => !isInvalidStart && handleDestinationClick(dest)}
                        >
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <h5 className="font-medium text-gray-900 mb-1">{dest.name}</h5>
                                <Badge 
                                  variant="secondary" 
                                  className="text-xs"
                                  style={{ backgroundColor: getDestinationColor(dest.category) + '20' }}
                                >
                                  {dest.type}
                                </Badge>
                                {isInvalidStart && (
                                  <div className="mt-2 text-xs text-red-600">
                                    ❌ Not accessible for {selectedMode === '4' ? '4-wheelers (Gate 1 only)' : '2-wheelers (Gate 2 only)'}
                                  </div>
                                )}
                              </div>
                              <div className="w-2 h-2 rounded-full ml-2 flex-shrink-0"
                                   style={{ backgroundColor: getDestinationColor(dest.category) }}>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center text-gray-500 py-8">
                <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No destinations found</p>
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* AR Navigation Modal */}
      {showAR && routeInfo && (
        <div className="fixed inset-0 z-50">
          <ARNavigation
            routeInfo={routeInfo}
            selectedMode={selectedMode}
            onClose={() => setShowAR(false)}
          />
        </div>
      )}
    </div>
  );
};

export default NavigationPanel;