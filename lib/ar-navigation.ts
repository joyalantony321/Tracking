export interface ARNavigationPoint {
  lat: number;
  lng: number;
  distance?: number;
  bearing?: number;
}

export interface ARArrowPosition {
  x: number;
  y: number;
  z: number;
  rotationY: number;
}

/**
 * Calculate bearing from one point to another
 * Returns bearing in degrees (0-360, where 0 is North)
 */
export function calculateBearing(
  startLat: number,
  startLng: number,
  destLat: number,
  destLng: number
): number {
  const startLatRad = (startLat * Math.PI) / 180;
  const startLngRad = (startLng * Math.PI) / 180;
  const destLatRad = (destLat * Math.PI) / 180;
  const destLngRad = (destLng * Math.PI) / 180;

  const y = Math.sin(destLngRad - startLngRad) * Math.cos(destLatRad);
  const x =
    Math.cos(startLatRad) * Math.sin(destLatRad) -
    Math.sin(startLatRad) * Math.cos(destLatRad) * Math.cos(destLngRad - startLngRad);

  let bearing = Math.atan2(y, x) * (180 / Math.PI);
  
  // Normalize to 0-360 degrees
  bearing = (bearing + 360) % 360;
  
  return bearing;
}

/**
 * Calculate distance between two points using Haversine formula
 * Returns distance in meters
 */
export function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Convert bearing and distance to AR world coordinates
 * Places arrow at fixed distance ahead of user
 */
export function convertToARPosition(
  bearing: number,
  distance: number,
  deviceOrientation: number = 0
): ARArrowPosition {
  // Fixed AR distance (keeps arrow at comfortable viewing distance)
  const arDistance = Math.min(distance, 10); // Max 10 meters ahead in AR
  const minDistance = 3; // Minimum 3 meters to avoid being too close

  const finalDistance = Math.max(minDistance, Math.min(arDistance, 8));

  // Convert bearing to AR coordinate system
  // Adjust for device orientation (compass heading)
  const relativeBearing = bearing - deviceOrientation;
  const bearingRad = (relativeBearing * Math.PI) / 180;

  // AR coordinates: X = left/right, Z = forward/back, Y = up/down
  const x = Math.sin(bearingRad) * finalDistance;
  const z = -Math.cos(bearingRad) * finalDistance; // Negative Z is forward
  const y = 0; // Keep arrow at ground level

  return {
    x,
    y,
    z,
    rotationY: relativeBearing,
  };
}

/**
 * Get next navigation point from route
 * This will integrate with your existing Leaflet routing
 */
export function getNextNavigationPoint(
  currentLat: number,
  currentLng: number,
  route: [number, number][], // GeoJSON coordinates
  currentSegmentIndex: number = 0
): ARNavigationPoint | null {
  if (!route || route.length === 0) return null;

  // Find the next point in the route
  let nextPointIndex = currentSegmentIndex + 1;
  
  // If we're at the end of the route, return the final destination
  if (nextPointIndex >= route.length) {
    const finalPoint = route[route.length - 1];
    return {
      lat: finalPoint[1],
      lng: finalPoint[0],
      distance: calculateDistance(currentLat, currentLng, finalPoint[1], finalPoint[0]),
      bearing: calculateBearing(currentLat, currentLng, finalPoint[1], finalPoint[0]),
    };
  }

  const nextPoint = route[nextPointIndex];
  const distance = calculateDistance(currentLat, currentLng, nextPoint[1], nextPoint[0]);
  const bearing = calculateBearing(currentLat, currentLng, nextPoint[1], nextPoint[0]);

  return {
    lat: nextPoint[1],
    lng: nextPoint[0],
    distance,
    bearing,
  };
}

/**
 * Smooth bearing changes to prevent jittery arrow movement
 */
export function smoothBearing(
  currentBearing: number,
  targetBearing: number,
  smoothingFactor: number = 0.1
): number {
  // Handle 360° wraparound
  let diff = targetBearing - currentBearing;
  if (diff > 180) diff -= 360;
  if (diff < -180) diff += 360;

  const smoothedBearing = currentBearing + diff * smoothingFactor;
  return (smoothedBearing + 360) % 360;
}

/**
 * Check if user has reached a waypoint
 */
export function hasReachedWaypoint(
  userLat: number,
  userLng: number,
  waypointLat: number,
  waypointLng: number,
  threshold: number = 10 // meters
): boolean {
  const distance = calculateDistance(userLat, userLng, waypointLat, waypointLng);
  return distance <= threshold;
}