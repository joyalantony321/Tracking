import * as turf from '@turf/turf';

export interface GraphNode {
  id: string;
  lat: number;
  lng: number;
  type: 'intersection' | 'endpoint' | 'destination';
  name?: string;
}

export interface GraphEdge {
  id: string;
  from: string;
  to: string;
  distance: number; // meters
  modes: string[];
  surface: string;
  coordinates: [number, number][];
  name?: string;
}

export interface Graph {
  nodes: Map<string, GraphNode>;
  edges: GraphEdge[];
  adjacency: Map<string, string[]>;
}

// Haversine distance calculation
export function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
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

function generateNodeId(lat: number, lng: number): string {
  // Use higher precision for better node matching
  return `node_${lat.toFixed(8)}_${lng.toFixed(8)}`;
}

function findOrCreateNearbyNode(
  nodes: Map<string, GraphNode>,
  lat: number,
  lng: number,
  tolerance: number = 2 // 2 meters tolerance
): string {
  // Check if there's already a node within tolerance distance
  let foundNodeId: string | null = null;
  nodes.forEach((node, nodeId) => {
    if (!foundNodeId) {
      const distance = haversine(lat, lng, node.lat, node.lng);
      if (distance <= tolerance) {
        foundNodeId = nodeId; // Use existing nearby node
      }
    }
  });
  
  if (foundNodeId) {
    return foundNodeId;
  }
  
  // No nearby node found, create new one
  return generateNodeId(lat, lng);
}

function generateEdgeId(fromId: string, toId: string): string {
  return `edge_${fromId}_${toId}`;
}

export function buildGraphFromGeoJSON(geoJsonData: any): Graph {
  console.log('Building graph from GeoJSON data...');
  const nodes = new Map<string, GraphNode>();
  const edges: GraphEdge[] = [];
  const adjacency = new Map<string, string[]>();
  
  // First pass: Add all destination points as nodes
  geoJsonData.features.forEach((feature: any) => {
    if (feature.geometry.type === 'Point') {
      const [lng, lat] = feature.geometry.coordinates;
      const nodeId = generateNodeId(lat, lng);
      if (!nodes.has(nodeId)) {
        nodes.set(nodeId, {
          id: nodeId,
          lat,
          lng,
          type: 'destination',
          name: feature.properties.name
        });
        adjacency.set(nodeId, []);
      }
    }
  });

  // Second pass: Process line features and create graph
  geoJsonData.features.forEach((feature: any) => {
    if (feature.geometry.type === 'LineString') {
      const coordinates = feature.geometry.coordinates;
      const modes = feature.properties.mode || ['W'];
      const surface = feature.properties.surface || 'unknown';
      const name = feature.properties.name || '';
      
      // Create nodes and edges for this line
      for (let i = 0; i < coordinates.length; i++) {
        const [lng, lat] = coordinates[i];
        const nodeId = findOrCreateNearbyNode(nodes, lat, lng);
        
        // Add node if not exists
        if (!nodes.has(nodeId)) {
          nodes.set(nodeId, {
            id: nodeId,
            lat,
            lng,
            type: i === 0 || i === coordinates.length - 1 ? 'endpoint' : 'intersection'
          });
          adjacency.set(nodeId, []);
        }
        
        // Create edge to next point
        if (i < coordinates.length - 1) {
          const [nextLng, nextLat] = coordinates[i + 1];
          const nextNodeId = findOrCreateNearbyNode(nodes, nextLat, nextLng);
          const distance = haversine(lat, lng, nextLat, nextLng);
          
          const edgeId = generateEdgeId(nodeId, nextNodeId);
          const edge: GraphEdge = {
            id: edgeId,
            from: nodeId,
            to: nextNodeId,
            distance,
            modes,
            surface,
            coordinates: [[lng, lat], [nextLng, nextLat]],
            name
          };
          
          edges.push(edge);
          adjacency.get(nodeId)?.push(nextNodeId);
          
          // Add reverse edge for bidirectional travel
          const reverseEdgeId = generateEdgeId(nextNodeId, nodeId);
          const reverseEdge: GraphEdge = {
            id: reverseEdgeId,
            from: nextNodeId,
            to: nodeId,
            distance,
            modes,
            surface,
            coordinates: [[nextLng, nextLat], [lng, lat]],
            name
          };
          
          edges.push(reverseEdge);
          
          if (!adjacency.has(nextNodeId)) {
            adjacency.set(nextNodeId, []);
          }
          adjacency.get(nextNodeId)?.push(nodeId);
        }
      }
    }
  });
  
  // Count nodes with connections
  let connectedNodes = 0;
  adjacency.forEach((neighbors) => {
    if (neighbors.length > 0) {
      connectedNodes++;
    }
  });
  
  console.log('Graph built successfully:', {
    nodes: nodes.size,
    edges: edges.length,
    adjacencyEntries: adjacency.size,
    connectedNodes: connectedNodes,
    isolatedNodes: nodes.size - connectedNodes
  });
  
  return { nodes, edges, adjacency };
}

export function findNearestNode(nodes: Map<string, GraphNode>, lat: number, lng: number): { id: string; distance: number } | null {
  let bestId: string | null = null;
  let bestDistance = Infinity;
  
  nodes.forEach((node, id) => {
    const distance = haversine(lat, lng, node.lat, node.lng);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestId = id;
    }
  });
  
  return bestId ? { id: bestId, distance: bestDistance } : null;
}

export function findNearestDestination(destinations: any[], lat: number, lng: number): any | null {
  let bestDestination = null;
  let bestDistance = Infinity;
  
  destinations.forEach(dest => {
    const [destLng, destLat] = dest.coordinates;
    const distance = haversine(lat, lng, destLat, destLng);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestDestination = dest;
    }
  });
  
  return bestDestination;
}

// Enhanced snapping with edge projection
export function snapToNearestPoint(
  nodes: Map<string, GraphNode>,
  edges: GraphEdge[],
  lat: number,
  lng: number
): { nodeId: string; lat: number; lng: number; isNewNode: boolean } | null {
  const point = turf.point([lng, lat]);
  let bestDistance = Infinity;
  let bestResult: any = null;
  
  // Check distance to existing nodes
  nodes.forEach((node, id) => {
    const distance = haversine(lat, lng, node.lat, node.lng);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestResult = {
        nodeId: id,
        lat: node.lat,
        lng: node.lng,
        isNewNode: false
      };
    }
  });
  
  // Check projection onto edges
  edges.forEach(edge => {
    try {
      const line = turf.lineString(edge.coordinates);
      const snapped = turf.nearestPointOnLine(line, point);
      const distance = turf.distance(point, snapped, { units: 'meters' });
      
      if (distance < bestDistance) {
        const [snapLng, snapLat] = snapped.geometry.coordinates;
        bestDistance = distance;
        bestResult = {
          nodeId: generateNodeId(snapLat, snapLng),
          lat: snapLat,
          lng: snapLng,
          isNewNode: true,
          originalEdge: edge
        };
      }
    } catch (error) {
      // Handle turf errors gracefully
      console.warn('Edge projection failed:', error);
    }
  });
  
  return bestResult;
}