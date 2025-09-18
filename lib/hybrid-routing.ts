import { haversine } from './graph';
import { destinations, Destination } from '../data/destinations';

export interface HybridRoute {
  segments: RouteSegment[];
  totalDistance: number;
  found: boolean;
}

export interface RouteSegment {
  mode: string; // '4', '2', 'W'
  path: string[];
  coordinates: [number, number][];
  distance: number;
  color: string;
  description: string;
}

// Special parking destination IDs
const SPECIAL_PARKING = {
  DEVADHAN: 'devadan-parking',
  ARCHITECTURE: 'architecture-parking',
  TWO_WHEELER: 'parking-2wheeler',
  FOUR_WHEELER: 'parking-4wheeler'
};

// Gate restrictions
const GATE_RESTRICTIONS = {
  '4': ['gate1'], // 4-wheeler can only use Gate 1
  '2': ['gate2'], // 2-wheeler can only use Gate 2
  'W': ['gate1', 'gate2'] // Walking can use both gates
};

// Route colors for different modes
const ROUTE_COLORS = {
  '4': '#FF6B6B', // Red for 4-wheeler
  '2': '#4ECDC4', // Teal for 2-wheeler
  'W': '#45B7D1', // Blue for walking
  '4PA': '#FF9F43', // Orange for 4-wheeler parking access
  '4PI': '#FFA07A' // Light salmon for 4-wheeler pickup
};

/**
 * Check if a destination allows direct vehicle access
 */
function allowsDirectVehicleAccess(destinationId: string, vehicleMode: string): boolean {
  if (vehicleMode === '4') {
    return destinationId === SPECIAL_PARKING.DEVADHAN || 
           destinationId === SPECIAL_PARKING.ARCHITECTURE;
  } else if (vehicleMode === '2') {
    // 2-wheelers can go directly to Devadhan parking
    return destinationId === SPECIAL_PARKING.DEVADHAN;
  }
  return false;
}

/**
 * Check if 2-wheeler needs special routing through Devadhan for Architecture parking
 */
function needs2WheelerSpecialRouting(destinationId: string, vehicleMode: string): boolean {
  return vehicleMode === '2' && destinationId === SPECIAL_PARKING.ARCHITECTURE;
}

/**
 * Get valid start gates for a vehicle mode
 */
export function getValidStartGates(mode: string): string[] {
  return GATE_RESTRICTIONS[mode as keyof typeof GATE_RESTRICTIONS] || [];
}

/**
 * Check if a start point is valid for the selected mode
 */
export function isValidStartPoint(startDestinationId: string, mode: string): boolean {
  const validGates = getValidStartGates(mode);
  return validGates.includes(startDestinationId);
}

/**
 * Find the appropriate intermediate parking for hybrid routing
 */
function getIntermediateParking(mode: string): Destination | null {
  const parkingId = mode === '4' ? SPECIAL_PARKING.FOUR_WHEELER : SPECIAL_PARKING.TWO_WHEELER;
  return destinations.find(d => d.id === parkingId) || null;
}

/**
 * Calculate hybrid route with vehicle + walking segments
 */
export function calculateHybridRoute(
  geoJsonData: any,
  calculateRoadRoute: Function,
  startLat: number,
  startLng: number,
  endLat: number,
  endLng: number,
  mode: string,
  startDestination?: any,
  endDestination?: any
): HybridRoute {
  
  console.log('🚗 Calculating hybrid route:', { mode, startDest: startDestination?.name, endDest: endDestination?.name });
  
  // Validate start point for vehicle mode
  if ((mode === '4' || mode === '2') && startDestination) {
    if (!isValidStartPoint(startDestination.id, mode)) {
      console.log('❌ Invalid start point for mode:', mode, startDestination.id);
      return { segments: [], totalDistance: 0, found: false };
    }
  }

  // Check if direct routing is allowed (going to accessible parking)
  if ((mode === '4' || mode === '2') && endDestination) {
    if (allowsDirectVehicleAccess(endDestination.id, mode)) {
      console.log('✅ Direct routing to special parking allowed');
      
      // Calculate direct route to special parking
      const directRoute = calculateRoadRoute(
        geoJsonData, startLat, startLng, endLat, endLng, mode, startDestination, endDestination
      );
      
      if (directRoute.found) {
        return {
          segments: [{
            mode: mode,
            path: directRoute.path,
            coordinates: directRoute.coordinates,
            distance: directRoute.distance,
            color: ROUTE_COLORS[mode as keyof typeof ROUTE_COLORS],
            description: `${mode === '4' ? '4-Wheeler' : '2-Wheeler'} route to ${endDestination.name}`
          }],
          totalDistance: directRoute.distance,
          found: true
        };
      }
    }
  }

  // Special routing for 2-wheelers going to Architecture parking (via Devadhan first)
  if (needs2WheelerSpecialRouting(endDestination?.id, mode)) {
    console.log('🔄 Special 2-wheeler routing: Gate 2 -> Devadhan -> Architecture parking');
    
    const devadhanParking = destinations.find(d => d.id === SPECIAL_PARKING.DEVADHAN);
    if (!devadhanParking) {
      console.log('❌ Devadhan parking not found');
      return { segments: [], totalDistance: 0, found: false };
    }

    // Segment 1: 2-wheeler from Gate 2 to Devadhan parking
    const vehicleToDevadhan = calculateRoadRoute(
      geoJsonData,
      startLat,
      startLng,
      devadhanParking.coordinates[1], // lat
      devadhanParking.coordinates[0], // lng
      mode,
      startDestination,
      devadhanParking
    );

    if (!vehicleToDevadhan.found) {
      console.log('❌ 2-wheeler route to Devadhan not found');
      return { segments: [], totalDistance: 0, found: false };
    }

    // Segment 2: 2-wheeler from Devadhan to Architecture parking
    const devadhanToArchitecture = calculateRoadRoute(
      geoJsonData,
      devadhanParking.coordinates[1], // lat
      devadhanParking.coordinates[0], // lng
      endLat,
      endLng,
      mode,
      devadhanParking,
      endDestination
    );

    if (!devadhanToArchitecture.found) {
      console.log('❌ 2-wheeler route from Devadhan to Architecture not found');
      return { segments: [], totalDistance: 0, found: false };
    }

    console.log('✅ Special 2-wheeler route calculated successfully');
    
    return {
      segments: [
        {
          mode: mode,
          path: vehicleToDevadhan.path,
          coordinates: vehicleToDevadhan.coordinates,
          distance: vehicleToDevadhan.distance,
          color: ROUTE_COLORS[mode as keyof typeof ROUTE_COLORS],
          description: `2-Wheeler route from ${startDestination.name} to ${devadhanParking.name}`
        },
        {
          mode: mode,
          path: devadhanToArchitecture.path,
          coordinates: devadhanToArchitecture.coordinates,
          distance: devadhanToArchitecture.distance,
          color: ROUTE_COLORS[mode as keyof typeof ROUTE_COLORS],
          description: `2-Wheeler route from ${devadhanParking.name} to ${endDestination.name}`
        }
      ],
      totalDistance: vehicleToDevadhan.distance + devadhanToArchitecture.distance,
      found: true
    };
  }

  // For vehicles, try flexible routing strategies
  if ((mode === '4' || mode === '2') && endDestination) {
    console.log('🔄 Trying flexible routing strategies for vehicles');
    
    // Strategy 1: Try direct route first (if destination allows it)
    if (allowsDirectVehicleAccess(endDestination.id, mode)) {
      console.log('✅ Direct vehicle access allowed, using direct route');
      // This was already handled above
    }
    
    // Strategy 2: Try hybrid routing (vehicle -> parking -> walking)
    const intermediateParking = getIntermediateParking(mode);
    if (intermediateParking) {

    // Segment 1: Vehicle to intermediate parking
    const vehicleRoute = calculateRoadRoute(
      geoJsonData, 
      startLat, 
      startLng, 
      intermediateParking.coordinates[1], // lat
      intermediateParking.coordinates[0], // lng
      mode, 
      startDestination, 
      intermediateParking
    );

    if (!vehicleRoute.found) {
      console.log('❌ Vehicle route to parking not found');
      return { segments: [], totalDistance: 0, found: false };
    }

    // Segment 2: Walking from parking to destination
    const walkingRoute = calculateRoadRoute(
      geoJsonData,
      intermediateParking.coordinates[1], // lat
      intermediateParking.coordinates[0], // lng
      endLat,
      endLng,
      'W', // Walking mode
      intermediateParking,
      endDestination
    );

    if (!walkingRoute.found) {
      console.log('❌ Walking route from parking not found');
      return { segments: [], totalDistance: 0, found: false };
    }

    console.log('✅ Hybrid route calculated successfully');
    
    return {
      segments: [
        {
          mode: mode,
          path: vehicleRoute.path,
          coordinates: vehicleRoute.coordinates,
          distance: vehicleRoute.distance,
          color: ROUTE_COLORS[mode as keyof typeof ROUTE_COLORS],
          description: `${mode === '4' ? '4-Wheeler' : '2-Wheeler'} route to ${intermediateParking.name}`
        },
        {
          mode: 'W',
          path: walkingRoute.path,
          coordinates: walkingRoute.coordinates,
          distance: walkingRoute.distance,
          color: ROUTE_COLORS.W,
          description: `Walking route from ${intermediateParking.name} to ${endDestination.name}`
        }
      ],
      totalDistance: vehicleRoute.distance + walkingRoute.distance,
      found: true
    };
    }
  }

  // For walking mode or any direct routing fallback, use single segment
  console.log('🚶 Using direct routing fallback');
  
  const directRoute = calculateRoadRoute(
    geoJsonData, startLat, startLng, endLat, endLng, mode, startDestination, endDestination
  );

  if (directRoute.found) {
    return {
      segments: [{
        mode: mode,
        path: directRoute.path,
        coordinates: directRoute.coordinates,
        distance: directRoute.distance,
        color: ROUTE_COLORS[mode as keyof typeof ROUTE_COLORS] || ROUTE_COLORS.W,
        description: `${mode === 'W' ? 'Walking' : mode === '4' ? '4-Wheeler' : mode === '2' ? '2-Wheeler' : 'Direct'} route to ${endDestination?.name || 'destination'}`
      }],
      totalDistance: directRoute.distance,
      found: true
    };
  }

  console.log('❌ No route found');
  return { segments: [], totalDistance: 0, found: false };
}