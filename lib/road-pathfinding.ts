import { haversine } from './graph';

export interface RoadNode {
  id: string;
  lat: number;
  lng: number;
  connections: string[]; // Connected node IDs
}

export interface RoadGraph {
  nodes: Map<string, RoadNode>;
  edges: Map<string, { from: string; to: string; distance: number; modes: string[] }>;
}

export interface PathResult {
  path: string[];
  coordinates: [number, number][];
  distance: number;
  found: boolean;
}

// Build road graph directly from GeoJSON coordinates
export function buildRoadGraphFromGeoJSON(geoJsonData: any): RoadGraph {
  const nodes = new Map<string, RoadNode>();
  const edges = new Map<string, { from: string; to: string; distance: number; modes: string[] }>();
  const SNAP_DISTANCE = 5; // 5 meters tolerance for connecting road segments
  
  console.log('Building road graph from GeoJSON...');
  
  // Helper function to find or create a node with snapping
  function findOrCreateNode(lat: number, lng: number): string {
    // First check if there's a node within snapping distance
    let foundNodeId: string | null = null;
    nodes.forEach((existingNode, existingId) => {
      if (!foundNodeId) {
        const distance = haversine(lat, lng, existingNode.lat, existingNode.lng);
        if (distance <= SNAP_DISTANCE) {
          console.log(`Snapping point [${lat}, ${lng}] to existing node ${existingId} (distance: ${distance.toFixed(2)}m)`);
          foundNodeId = existingId;
        }
      }
    });
    
    if (foundNodeId) {
      return foundNodeId;
    }
    
    // Create new node
    const nodeId = `${lat.toFixed(8)}_${lng.toFixed(8)}`;
    nodes.set(nodeId, {
      id: nodeId,
      lat,
      lng,
      connections: []
    });
    return nodeId;
  }
  
  // Process each LineString feature (road segment)
  geoJsonData.features.forEach((feature: any, featureIndex: number) => {
    if (feature.geometry.type === 'LineString') {
      const coordinates = feature.geometry.coordinates;
      const modes = feature.properties.mode || ['W'];
      
      console.log(`Processing road ${feature.properties.name || featureIndex}:`, {
        coordinates: coordinates.length,
        modes
      });
      
      // Create nodes for each coordinate point with snapping
      for (let i = 0; i < coordinates.length; i++) {
        const [lng, lat] = coordinates[i];
        const nodeId = findOrCreateNode(lat, lng);
        
        // Create edge to next point in the same road
        if (i < coordinates.length - 1) {
          const [nextLng, nextLat] = coordinates[i + 1];
          const nextNodeId = findOrCreateNode(nextLat, nextLng);
          
          if (nodeId !== nextNodeId) { // Only create edge if nodes are different
            const currentNode = nodes.get(nodeId)!;
            const nextNode = nodes.get(nextNodeId)!;
            const distance = haversine(currentNode.lat, currentNode.lng, nextNode.lat, nextNode.lng);
            
            // Forward edge
            const forwardEdgeId = `${nodeId}_${nextNodeId}`;
            edges.set(forwardEdgeId, {
              from: nodeId,
              to: nextNodeId,
              distance,
              modes
            });
            
            // Backward edge (bidirectional roads)
            const backwardEdgeId = `${nextNodeId}_${nodeId}`;
            edges.set(backwardEdgeId, {
              from: nextNodeId,
              to: nodeId,
              distance,
              modes
            });
            
            // Update connections
            if (!currentNode.connections.includes(nextNodeId)) {
              currentNode.connections.push(nextNodeId);
            }
            
            if (!nextNode.connections.includes(nodeId)) {
              nextNode.connections.push(nodeId);
            }
          }
        }
      }
    }
  });
  
  // Count connected vs isolated nodes
  let connectedNodes = 0;
  nodes.forEach(node => {
    if (node.connections.length > 0) {
      connectedNodes++;
    }
  });
  
  console.log('Road graph built:', {
    nodes: nodes.size,
    edges: edges.size,
    connectedNodes,
    isolatedNodes: nodes.size - connectedNodes
  });
  
  return { nodes, edges };
}

// Find nearest node to a coordinate
export function findNearestRoadNode(
  nodes: Map<string, RoadNode>,
  lat: number,
  lng: number
): string | null {
  let bestNodeId: string | null = null;
  let bestDistance = Infinity;
  
  nodes.forEach((node, nodeId) => {
    const distance = haversine(lat, lng, node.lat, node.lng);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestNodeId = nodeId;
    }
  });
  
  return bestNodeId;
}

// Check if a mode is allowed on an edge based on complex conditions
function isEdgeModeAllowed(
  edgeModes: string[],
  selectedMode: string,
  startDestination?: any,
  goalDestination?: any
): boolean {
  // console.log('Checking edge mode:', { edgeModes, selectedMode, startDest: startDestination?.name, goalDest: goalDestination?.name });
  
  for (const mode of edgeModes) {
    // Direct mode match (simple cases)
    if (mode === selectedMode) {
      // console.log('✅ Direct mode match:', mode);
      return true;
    }
    
    // Always allow walking on paths that include walking
    if (selectedMode === 'W' && mode === 'W') {
      // console.log('✅ Walking allowed');
      return true;
    }
    
    // Handle mode mapping for 4-wheeler variants
    if (selectedMode === '4') {
      // 4-wheeler can use 4PA (parking access) and 4PI (pickup) paths
      if (mode === '4PA' || mode === '4PI') {
        // console.log('✅ 4-wheeler can use parking/pickup paths');
        return true;
      }
    }
    
    // Handle conditional modes with "if ... -> mode" pattern
    if (mode.includes('if ') && mode.includes(' -> ')) {
      const [condition, allowedMode] = mode.split(' -> ');
      const conditionText = condition.replace('if ', '').trim();
      
      console.log('Checking conditional mode:', { condition: conditionText, allowedMode, selectedMode });
      
      // Check if the allowed mode matches what we selected or can be used by our mode
      let canUseMode = false;
      if (allowedMode === selectedMode) {
        canUseMode = true;
      } else if (selectedMode === '4' && (allowedMode === '4PA' || allowedMode === '4PI')) {
        canUseMode = true;
      }
      
      if (canUseMode) {
        // Check specific destination conditions
        if (conditionText.includes('Architecture Block Parking')) {
          const isArchParkingDestination = goalDestination?.name?.toLowerCase().includes('architecture') && 
                                           goalDestination?.name?.toLowerCase().includes('parking');
          console.log('Architecture Block Parking condition:', isArchParkingDestination);
          if (isArchParkingDestination) return true;
        }
        
        if (conditionText.includes("Men's Hostel Block A/B/C/D Pickup")) {
          const isMensHostelPickup = startDestination?.name?.toLowerCase().includes("men's hostel") ||
                                     goalDestination?.name?.toLowerCase().includes("men's hostel");
          console.log("Men's Hostel pickup condition:", isMensHostelPickup);
          if (isMensHostelPickup) return true;
        }
        
        if (conditionText.includes('Devadan Block Parking') || conditionText.includes('Devadan Parking')) {
          const isDevadanParking = goalDestination?.name?.toLowerCase().includes('devadan') && 
                                   goalDestination?.name?.toLowerCase().includes('parking');
          console.log('Devadan parking condition:', isDevadanParking);
          if (isDevadanParking) return true;
        }
        
        if (conditionText.includes('Girls Hostel')) {
          const isGirlsHostel = startDestination?.name?.toLowerCase().includes('girls hostel') ||
                                goalDestination?.name?.toLowerCase().includes('girls hostel');
          console.log('Girls Hostel condition:', isGirlsHostel);
          if (isGirlsHostel) return true;
        }
        
        if (conditionText.includes('Block 1 Entrance 1')) {
          const isBlock1Entrance = goalDestination?.name?.toLowerCase().includes('block 1 entrance 1');
          console.log('Block 1 Entrance 1 condition:', isBlock1Entrance);
          if (isBlock1Entrance) return true;
        }
        
        // Handle "destination is" conditions
        if (conditionText.startsWith('destination is ')) {
          const expectedDest = conditionText.replace('destination is ', '').trim();
          const isDestinationMatch = goalDestination?.name?.toLowerCase().includes(expectedDest.toLowerCase());
          console.log('Destination condition check:', { expected: expectedDest, actual: goalDestination?.name, match: isDestinationMatch });
          if (isDestinationMatch) return true;
        }
        
        // Generic destination matching
        if (goalDestination?.name?.toLowerCase().includes(conditionText.toLowerCase())) {
          console.log('✅ Generic destination match');
          return true;
        }
        
        if (startDestination?.name?.toLowerCase().includes(conditionText.toLowerCase())) {
          console.log('✅ Generic start destination match');
          return true;
        }
      }
    }
  }
  
  console.log('❌ Mode not allowed on this edge');
  return false;
}

// Simple A* pathfinding implementation with proper mode validation
export function findShortestPath(
  graph: RoadGraph,
  startNodeId: string,
  goalNodeId: string,
  mode: string = 'W',
  startDestination?: any,
  goalDestination?: any
): PathResult {
  console.log('Finding shortest path:', { startNodeId, goalNodeId, mode });
  
  const { nodes, edges } = graph;
  const openSet = new Set<string>([startNodeId]);
  const closedSet = new Set<string>();
  
  const gScore = new Map<string, number>();
  const fScore = new Map<string, number>();
  const cameFrom = new Map<string, string>();
  
  gScore.set(startNodeId, 0);
  
  const goalNode = nodes.get(goalNodeId);
  const startNode = nodes.get(startNodeId);
  
  if (!goalNode || !startNode) {
    console.log('Start or goal node not found');
    return { path: [], coordinates: [], distance: 0, found: false };
  }
  
  const heuristic = haversine(startNode.lat, startNode.lng, goalNode.lat, goalNode.lng);
  fScore.set(startNodeId, heuristic);
  
  while (openSet.size > 0) {
    // Find node with lowest fScore
    let current = '';
    let lowestF = Infinity;
    openSet.forEach(nodeId => {
      const f = fScore.get(nodeId) || Infinity;
      if (f < lowestF) {
        lowestF = f;
        current = nodeId;
      }
    });
    
    if (!current) break;
    
    if (current === goalNodeId) {
      // Reconstruct path
      const path: string[] = [];
      let currentPathNode = current;
      
      while (currentPathNode) {
        path.unshift(currentPathNode);
        currentPathNode = cameFrom.get(currentPathNode) || '';
      }
      
      // Convert path to coordinates
      const coordinates: [number, number][] = path.map(nodeId => {
        const node = nodes.get(nodeId)!;
        return [node.lat, node.lng];
      });
      
      const totalDistance = gScore.get(goalNodeId) || 0;
      
      console.log('Path found:', { pathLength: path.length, distance: totalDistance });
      return { path, coordinates, distance: totalDistance, found: true };
    }
    
    openSet.delete(current);
    closedSet.add(current);
    
    const currentNode = nodes.get(current);
    if (!currentNode) continue;
    
    // Check all neighbors
    for (const neighborId of currentNode.connections) {
      if (closedSet.has(neighborId)) continue;
      
      const edgeId = `${current}_${neighborId}`;
      const edge = edges.get(edgeId);
      
      if (!edge) continue;
      
      // Check if mode is allowed on this edge using complex conditions
      if (!isEdgeModeAllowed(edge.modes, mode, startDestination, goalDestination)) {
        continue;
      }
      
      const tentativeG = (gScore.get(current) || 0) + edge.distance;
      
      if (!openSet.has(neighborId)) {
        openSet.add(neighborId);
      } else if (tentativeG >= (gScore.get(neighborId) || Infinity)) {
        continue;
      }
      
      cameFrom.set(neighborId, current);
      gScore.set(neighborId, tentativeG);
      
      const neighborNode = nodes.get(neighborId)!;
      const h = haversine(neighborNode.lat, neighborNode.lng, goalNode.lat, goalNode.lng);
      fScore.set(neighborId, tentativeG + h);
    }
  }
  
  console.log('No path found');
  return { path: [], coordinates: [], distance: 0, found: false };
}

// Main function to calculate route using GeoJSON roads
export function calculateRoadRoute(
  geoJsonData: any,
  startLat: number,
  startLng: number,
  endLat: number,
  endLng: number,
  mode: string = 'W',
  startDestination?: any,
  goalDestination?: any
): PathResult {
  console.log('Calculating road route:', {
    start: [startLat, startLng],
    end: [endLat, endLng],
    mode,
    startDest: startDestination?.name,
    goalDest: goalDestination?.name
  });
  
  // Build road graph
  const roadGraph = buildRoadGraphFromGeoJSON(geoJsonData);
  
  // Find nearest nodes to start and end points
  const startNodeId = findNearestRoadNode(roadGraph.nodes, startLat, startLng);
  const endNodeId = findNearestRoadNode(roadGraph.nodes, endLat, endLng);
  
  if (!startNodeId || !endNodeId) {
    console.log('Could not find nearest road nodes');
    return { path: [], coordinates: [], distance: 0, found: false };
  }
  
  console.log('Nearest nodes found:', { startNodeId, endNodeId });
  
  // Find shortest path
  return findShortestPath(roadGraph, startNodeId, endNodeId, mode, startDestination, goalDestination);
}