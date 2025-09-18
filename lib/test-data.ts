/**
 * Test Data for Simple AR Navigation
 */

export interface TestPoint {
  id: string;
  name: string;
  coordinates: [number, number]; // [lng, lat]
  category: string;
}

export interface TestRoute {
  coordinates: [number, number][]; // [lng, lat] array
  distance: number; // in meters
  travelTime: number; // in seconds
}

export interface TestArea {
  name: string;
  coordinates: [number, number][]; // polygon boundary
}

// Test Points (converted from your GeoJSON)
export const TEST_POINTS: TestPoint[] = [
  {
    id: 'point1',
    name: 'Point 1',
    coordinates: [77.4494954935235, 12.880972880040261],
    category: 'start'
  },
  {
    id: 'point2', 
    name: 'Point 2',
    coordinates: [77.44939140649512, 12.880490907967356],
    category: 'destination'
  }
];

// Test Route (converted from your GeoJSON)
export const TEST_ROUTE: TestRoute = {
  coordinates: [
    [77.44949552900289, 12.880973352357174],
    [77.44939092838092, 12.880497022975277],
    [77.44939261339289, 12.880515436186698]
  ],
  distance: 75, // approximate distance in meters
  travelTime: 60 // approximate time in seconds
};

// Test Area (converted from your GeoJSON polygon)
export const TEST_AREA: TestArea = {
  name: 'Test Area',
  coordinates: [
    [77.44928444116192, 12.881092891348345],
    [77.44928444116192, 12.880412039663241],
    [77.44957809788536, 12.880412039663241],
    [77.44957809788536, 12.881092891348345],
    [77.44928444116192, 12.881092891348345]
  ]
};

/**
 * Check if a point is within the test area using ray casting algorithm
 */
export function isWithinTestArea(lat: number, lng: number): boolean {
  const polygon = TEST_AREA.coordinates;
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];

    if (((yi > lng) !== (yj > lng)) && 
        (lat < (xj - xi) * (lng - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }

  return inside;
}

/**
 * Calculate distance between two points using Haversine formula
 */
export function calculateDistance(
  lat1: number, lng1: number, 
  lat2: number, lng2: number
): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRadians(degree: number): number {
  return degree * (Math.PI / 180);
}

/**
 * Get route information for the test setup
 */
export function getTestRouteInfo(startId: string, destinationId: string) {
  const startPoint = TEST_POINTS.find(p => p.id === startId);
  const destinationPoint = TEST_POINTS.find(p => p.id === destinationId);
  
  if (!startPoint || !destinationPoint) {
    return {
      found: false,
      error: 'Points not found'
    };
  }

  // Convert route coordinates to [lat, lng] format for AR
  const routeCoordinates = TEST_ROUTE.coordinates.map(coord => [coord[1], coord[0]]);

  return {
    found: true,
    startPoint,
    destinationPoint,
    route: routeCoordinates,
    totalDistance: TEST_ROUTE.distance,
    totalTravelTime: TEST_ROUTE.travelTime,
    segments: [{
      coordinates: routeCoordinates,
      mode: 'walking',
      color: '#45B7D1',
      distance: TEST_ROUTE.distance,
      travelTime: TEST_ROUTE.travelTime
    }]
  };
}