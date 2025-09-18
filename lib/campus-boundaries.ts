/**
 * Campus Boundaries and Location Validation
 */

export interface CampusBoundary {
  name: string;
  coordinates: [number, number][]; // [lat, lng] polygon points
}

// Define campus boundary as a polygon (approximate coordinates)
export const CAMPUS_BOUNDARY: CampusBoundary = {
  name: "Main Campus",
  coordinates: [
    [12.9715, 77.5945], // Northwest corner
    [12.9720, 77.5955], // Northeast corner  
    [12.9710, 77.5960], // Southeast corner
    [12.9705, 77.5950], // Southwest corner
    [12.9715, 77.5945], // Close polygon
  ]
};

/**
 * Check if a point is within campus boundaries using ray casting algorithm
 * @param lat Latitude of the point to check
 * @param lng Longitude of the point to check
 * @param boundary Campus boundary polygon
 * @returns true if point is inside campus, false otherwise
 */
export function isWithinCampus(
  lat: number, 
  lng: number, 
  boundary: CampusBoundary = CAMPUS_BOUNDARY
): boolean {
  const polygon = boundary.coordinates;
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
 * Calculate distance from point to campus boundary (in meters)
 * @param lat Latitude of the point
 * @param lng Longitude of the point
 * @returns Distance to campus in meters, 0 if inside campus
 */
export function distanceToCampus(lat: number, lng: number): number {
  if (isWithinCampus(lat, lng)) {
    return 0;
  }

  // Find minimum distance to any boundary point
  let minDistance = Infinity;
  
  for (const [boundaryLat, boundaryLng] of CAMPUS_BOUNDARY.coordinates) {
    const distance = haversineDistance(lat, lng, boundaryLat, boundaryLng);
    minDistance = Math.min(minDistance, distance);
  }

  return minDistance;
}

/**
 * Haversine distance calculation between two points
 */
function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
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
 * Get user's current location and validate campus proximity
 */
export async function validateCampusLocation(): Promise<{
  isInCampus: boolean;
  location?: { lat: number; lng: number };
  distance?: number;
  error?: string;
}> {
  try {
    // Check if geolocation is supported
    if (!navigator.geolocation) {
      return {
        isInCampus: false,
        error: 'Geolocation is not supported by this browser'
      };
    }

    // Get current position
    const position = await new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        resolve,
        reject,
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000 // 5 minutes
        }
      );
    });

    const { latitude: lat, longitude: lng } = position.coords;
    const isInCampus = isWithinCampus(lat, lng);
    const distance = distanceToCampus(lat, lng);

    return {
      isInCampus,
      location: { lat, lng },
      distance: Math.round(distance)
    };

  } catch (error: any) {
    console.error('Location validation error:', error);
    
    let errorMessage = 'Unable to determine location';
    if (error.code === 1) {
      errorMessage = 'Location access denied';
    } else if (error.code === 2) {
      errorMessage = 'Location unavailable';
    } else if (error.code === 3) {
      errorMessage = 'Location request timeout';
    }

    return {
      isInCampus: false,
      error: errorMessage
    };
  }
}