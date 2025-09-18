import { GraphNode, GraphEdge, haversine } from './graph';
import { destinations } from '../data/destinations';

export interface PathSegment {
  path: string[];
  distance: number;
  travelTime: number;
  mode: string;
  color: string;
  coordinates: [number, number][];
}

export interface HybridPathResult {
  segments: PathSegment[];
  totalDistance: number;
  totalTravelTime: number;
  found: boolean;
  instructions: string[];
}

export const MODE_SPEEDS = {
  'W': 1.4,   // walking: 1.4 m/s
  '2': 5.0,   // 2-wheeler: 5 m/s  
  '4': 8.0,   // 4-wheeler: 8 m/s
  '4PA': 4.0, // 4-wheeler to parking: slower
  '4PI': 6.0  // 4-wheeler pickup: medium speed
};

export const MODE_COLORS = {
  'W': '#10B981',   // green for walking
  '2': '#3B82F6',   // blue for 2-wheeler
  '4': '#8B5CF6',   // purple for 4-wheeler
  '4PA': '#F97316', // orange for parking
  '4PI': '#EF4444'  // red for pickup
};

interface AStarNode {
  id: string;
  gCost: number; // actual cost from start
  hCost: number; // heuristic cost to goal
  fCost: number; // g + h
  parent: string | null;
}

function checkModeAccess(
  edgeModes: string[],
  selectedMode: string,
  startDestination: any,
  goalDestination: any
): boolean {
  // If no modes specified, allow all access
  if (!edgeModes || edgeModes.length === 0) {
    return true;
  }
  
  // Handle complex conditional modes
  for (const mode of edgeModes) {
    // Direct mode match
    if (mode === selectedMode) return true;
    
    // Walking is generally allowed on most paths that include W
    if (selectedMode === 'W' && mode.includes('W')) {
      return true;
    }
    
    // For non-walking modes, check if the exact mode is allowed
    if (selectedMode !== 'W' && mode === selectedMode) {
      return true;
    }
    
    // Handle conditional modes
    if (mode.includes('if ') && mode.includes(' -> ')) {
      const [condition, allowedMode] = mode.split(' -> ');
      const conditionText = condition.replace('if ', '');
      
      // Check if condition matches and mode is allowed
      if (allowedMode === selectedMode || allowedMode.includes(selectedMode)) {
        // Architecture Block Parking condition
        if (conditionText.includes('Architecture Block Parking') && 
            goalDestination?.name?.includes('Architecture Block Parking')) {
          return true;
        }
        
        // Men's Hostel pickup condition
        if (conditionText.includes("Men's Hostel Block A/B/C/D Pickup") && 
            startDestination?.name?.includes("Men's Hostel Block")) {
          return true;
        }
        
        // Devadan Block Parking condition
        if (conditionText.includes('Devadan Block Parking') && 
            goalDestination?.name?.includes('Devadan')) {
          return true;
        }
        
        // Girls Hostel pickup condition
        if (conditionText.includes('Girls Hostel') && 
            startDestination?.name?.includes('Girls Hostel')) {
          return true;
        }
        
        // Block 1 Entrance 1 condition
        if (conditionText.includes('Block 1 Entrance 1') && 
            goalDestination?.name?.includes('Block 1 Entrance 1')) {
          return true;
        }
        
        // General destination matching
        if (goalDestination?.name?.toLowerCase().includes(conditionText.toLowerCase()) ||
            startDestination?.name?.toLowerCase().includes(conditionText.toLowerCase())) {
          return true;
        }
      }
    }
    
    // Fallback: if mode contains the selected mode as substring
    if (mode.includes(selectedMode)) {
      return true;
    }
  }
  
  // Default: allow walking on most paths if no specific restrictions
  if (selectedMode === 'W') {
    return true;
  }
  
  return false;
}

function aStarPathfinding(
  nodes: Map<string, GraphNode>,
  edges: GraphEdge[],
  adjacency: Map<string, string[]>,
  startId: string,
  goalId: string,
  mode: string,
  startDestination?: any,
  goalDestination?: any
): { path: string[]; distance: number; travelTime: number; found: boolean } {
  console.log('Starting A* pathfinding:', {
    startId,
    goalId,
    mode,
    nodesCount: nodes.size,
    edgesCount: edges.length,
    startNodeExists: nodes.has(startId),
    goalNodeExists: nodes.has(goalId),
    startNeighbors: adjacency.get(startId)?.length || 0,
    goalNeighbors: adjacency.get(goalId)?.length || 0
  });
  
  if (!nodes.has(startId) || !nodes.has(goalId)) {
    console.log('Start or goal node not found in graph');
    return { path: [], distance: 0, travelTime: 0, found: false };
  }
  
  const openSet = new Set<string>([startId]);
  const closedSet = new Set<string>();
  const nodeMap = new Map<string, AStarNode>();
  
  const goalNode = nodes.get(goalId)!;
  const startNode = nodes.get(startId)!;
  
  // Quick connectivity check
  const isConnected = checkGraphConnectivity(nodes, adjacency, startId, goalId);
  console.log('Graph connectivity check:', isConnected);
  
  if (!isConnected) {
    console.log('No path exists between start and goal nodes');
    return { path: [], distance: 0, travelTime: 0, found: false };
  }
  
  // Initialize start node
  const heuristicCost = haversine(startNode.lat, startNode.lng, goalNode.lat, goalNode.lng) / MODE_SPEEDS[mode as keyof typeof MODE_SPEEDS];
  nodeMap.set(startId, {
    id: startId,
    gCost: 0,
    hCost: heuristicCost,
    fCost: heuristicCost,
    parent: null
  });
  
  // Create edge lookup for faster access
  const edgeMap = new Map<string, GraphEdge>();
  edges.forEach(edge => {
    edgeMap.set(`${edge.from}_${edge.to}`, edge);
  });
  
  let iterations = 0;
  const maxIterations = 10000;
  
  while (openSet.size > 0 && iterations < maxIterations) {
    iterations++;
    
    // Find node with lowest fCost
    let currentId = '';
    let lowestFCost = Infinity;
    
    openSet.forEach(nodeId => {
      const node = nodeMap.get(nodeId);
      if (node && node.fCost < lowestFCost) {
        lowestFCost = node.fCost;
        currentId = nodeId;
      }
    });
    
    if (!currentId) break;
    
    // Found goal
    if (currentId === goalId) {
      console.log('Path found after', iterations, 'iterations');
      const path: string[] = [];
      let current = currentId;
      let totalDistance = 0;
      
      while (current) {
        path.unshift(current);
        const aStarNode = nodeMap.get(current);
        if (aStarNode?.parent) {
          const edge = edgeMap.get(`${aStarNode.parent}_${current}`);
          if (edge) totalDistance += edge.distance;
        }
        current = aStarNode?.parent || '';
      }
      
      const travelTime = nodeMap.get(goalId)?.gCost || 0;
      
      return {
        path,
        distance: totalDistance,
        travelTime,
        found: true
      };
    }
    
    openSet.delete(currentId);
    closedSet.add(currentId);
    
    const neighbors = adjacency.get(currentId) || [];
    
    for (const neighborId of neighbors) {
      if (closedSet.has(neighborId)) continue;
      
      const edge = edgeMap.get(`${currentId}_${neighborId}`);
      if (!edge) continue;
      
      // Check mode access for this edge
      if (!checkModeAccess(edge.modes, mode, startDestination, goalDestination)) {
        console.log(`Mode ${mode} not allowed on edge ${edge.id} with modes:`, edge.modes);
        continue;
      }
      
      const neighborNode = nodes.get(neighborId);
      if (!neighborNode) continue;
      
      const speed = MODE_SPEEDS[mode as keyof typeof MODE_SPEEDS] || MODE_SPEEDS['W'];
      const travelTime = edge.distance / speed;
      const tentativeGCost = (nodeMap.get(currentId)?.gCost || 0) + travelTime;
      
      if (!nodeMap.has(neighborId)) {
        const hCost = haversine(neighborNode.lat, neighborNode.lng, goalNode.lat, goalNode.lng) / speed;
        nodeMap.set(neighborId, {
          id: neighborId,
          gCost: Infinity,
          hCost,
          fCost: Infinity,
          parent: null
        });
      }
      
      const neighborAStarNode = nodeMap.get(neighborId)!;
      
      if (tentativeGCost < neighborAStarNode.gCost) {
        neighborAStarNode.gCost = tentativeGCost;
        neighborAStarNode.fCost = neighborAStarNode.gCost + neighborAStarNode.hCost;
        neighborAStarNode.parent = currentId;
        
        if (!openSet.has(neighborId)) {
          openSet.add(neighborId);
        }
      }
    }
  }
  
  console.log('No path found after', iterations, 'iterations');
  return { path: [], distance: 0, travelTime: 0, found: false };
}

// Enhanced hybrid routing with parking rules
export function calculateHybridRoute(
  nodes: Map<string, GraphNode>,
  edges: GraphEdge[],
  adjacency: Map<string, string[]>,
  startLat: number,
  startLng: number,
  goalDestination: any,
  selectedMode: string
): HybridPathResult {
  console.log('Starting hybrid route calculation:', {
    startLat,
    startLng,
    goalDestination: goalDestination.name,
    selectedMode,
    nodesCount: nodes.size,
    edgesCount: edges.length
  });

  const segments: PathSegment[] = [];
  const instructions: string[] = [];
  let totalDistance = 0;
  let totalTravelTime = 0;

  // Find parking destinations
  const twoWheelerParking = destinations.find(d => d.name.includes('2-Wheeler square parking'));
  const fourWheelerParking = destinations.find(d => d.name.includes('4-Wheeler parking'));

  // First try direct routing with the selected mode
  console.log('Attempting direct route with mode:', selectedMode);
  const directRoute = calculateSingleRoute(
    nodes, edges, adjacency,
    startLat, startLng,
    goalDestination,
    selectedMode,
    null,
    goalDestination
  );
  
  console.log('Direct route result:', directRoute);
  
  if (directRoute.found) {
    // Direct route found, use it
    segments.push({
      path: directRoute.path,
      distance: directRoute.distance,
      travelTime: directRoute.travelTime,
      mode: selectedMode,
      color: MODE_COLORS[selectedMode as keyof typeof MODE_COLORS],
      coordinates: pathToCoordinates(directRoute.path, nodes)
    });
    
    totalDistance = directRoute.distance;
    totalTravelTime = directRoute.travelTime;
    instructions.push(`Take ${getModeName(selectedMode)} directly to ${goalDestination.name}`);
    
    return {
      segments,
      totalDistance,
      totalTravelTime,
      found: true,
      instructions
    };
  }
  
  // Direct route failed, try hybrid routing
  const needsHybridRouting = shouldUseHybridRouting(selectedMode, goalDestination);
  console.log('Direct route failed, trying hybrid routing:', needsHybridRouting);
  
  if (needsHybridRouting.required) {
    const parkingDestination = needsHybridRouting.parkingDestination;
    console.log('Using hybrid routing via:', parkingDestination?.name);
    
    // Segment 1: Vehicle to parking
    const vehicleSegment = calculateSingleRoute(
      nodes, edges, adjacency,
      startLat, startLng,
      parkingDestination,
      selectedMode,
      null,
      parkingDestination
    );
    
    console.log('Vehicle segment result:', vehicleSegment);
    
    if (vehicleSegment.found) {
      segments.push({
        path: vehicleSegment.path,
        distance: vehicleSegment.distance,
        travelTime: vehicleSegment.travelTime,
        mode: selectedMode,
        color: MODE_COLORS[selectedMode as keyof typeof MODE_COLORS],
        coordinates: pathToCoordinates(vehicleSegment.path, nodes)
      });
      
      totalDistance += vehicleSegment.distance;
      totalTravelTime += vehicleSegment.travelTime;
      instructions.push(`Take ${getModeName(selectedMode)} to ${parkingDestination.name}`);
      
      // Segment 2: Walking from parking to destination
      const [parkingLng, parkingLat] = parkingDestination.coordinates;
      const walkingSegment = calculateSingleRoute(
        nodes, edges, adjacency,
        parkingLat, parkingLng,
        goalDestination,
        'W',
        parkingDestination,
        goalDestination
      );
      
      console.log('Walking segment result:', walkingSegment);
      
      if (walkingSegment.found) {
        segments.push({
          path: walkingSegment.path,
          distance: walkingSegment.distance,
          travelTime: walkingSegment.travelTime,
          mode: 'W',
          color: MODE_COLORS['W'],
          coordinates: pathToCoordinates(walkingSegment.path, nodes)
        });
        
        totalDistance += walkingSegment.distance;
        totalTravelTime += walkingSegment.travelTime;
        instructions.push(`Walk from ${parkingDestination.name} to ${goalDestination.name}`);
      }
    }
  }
  
  // If no route found through any method, try a fallback walking route
  if (segments.length === 0) {
    console.log('No route found with any method, trying fallback walking route...');
    const walkingFallback = calculateSingleRoute(
      nodes, edges, adjacency,
      startLat, startLng,
      goalDestination,
      'W', // Force walking mode
      null,
      goalDestination
    );
    
    if (walkingFallback.found) {
      console.log('Fallback walking route found');
      segments.push({
        path: walkingFallback.path,
        distance: walkingFallback.distance,
        travelTime: walkingFallback.travelTime,
        mode: 'W',
        color: '#EF4444', // Red color to indicate fallback
        coordinates: pathToCoordinates(walkingFallback.path, nodes)
      });
      
      totalDistance = walkingFallback.distance;
      totalTravelTime = walkingFallback.travelTime;
      instructions.push(`Walk directly to ${goalDestination.name} (fallback route)`);
    }
  }
  
  const result = {
    segments,
    totalDistance,
    totalTravelTime,
    found: segments.length > 0 && segments.every(s => s.path.length > 0),
    instructions
  };
  
  console.log('Final route result:', result);
  return result;
}

function shouldUseHybridRouting(mode: string, destination: any): { required: boolean; parkingDestination?: any } {
  const twoWheelerParking = destinations.find(d => d.name.includes('2-Wheeler square parking'));
  const fourWheelerParking = destinations.find(d => d.name.includes('4-Wheeler parking'));

  // 4-wheeler rules
  if (mode === '4') {
    // Allow direct access to specific parking areas
    if (destination.name.includes('Devadan Block Parking') || 
        destination.name.includes('Architecture Block Parking')) {
      return { required: false };
    }
    // Otherwise, must go to 4-wheeler parking first
    return { required: true, parkingDestination: fourWheelerParking };
  }
  
  // 2-wheeler rules
  if (mode === '2') {
    // Allow direct access to Devadan parking
    if (destination.name.includes('Devadan Block Parking')) {
      return { required: false };
    }
    // Otherwise, must go to 2-wheeler parking first
    return { required: true, parkingDestination: twoWheelerParking };
  }
  
  // Walking is always direct
  return { required: false };
}

function calculateSingleRoute(
  nodes: Map<string, GraphNode>,
  edges: GraphEdge[],
  adjacency: Map<string, string[]>,
  startLat: number,
  startLng: number,
  goalDestination: any,
  mode: string,
  startDestination?: any,
  goalDest?: any
): { path: string[]; distance: number; travelTime: number; found: boolean } {
  console.log('Calculating single route:', {
    startLat,
    startLng,
    goalDestination: goalDestination.name,
    mode
  });

  // Find nearest nodes
  const startNearest = findNearestNode(nodes, startLat, startLng);
  const [goalLng, goalLat] = goalDestination.coordinates;
  const goalNearest = findNearestNode(nodes, goalLat, goalLng);
  
  console.log('Nearest nodes:', {
    startNearest,
    goalNearest,
    startCoords: [startLat, startLng],
    goalCoords: [goalLat, goalLng]
  });
  
  if (!startNearest || !goalNearest) {
    console.log('Could not find nearest nodes');
    return { path: [], distance: 0, travelTime: 0, found: false };
  }
  
  // First try with the selected mode
  let result = aStarPathfinding(
    nodes, edges, adjacency,
    startNearest.id, goalNearest.id,
    mode, startDestination, goalDest
  );
  
  console.log('A* pathfinding result for mode', mode, ':', result);
  
  // If no path found and mode is not walking, try with walking as fallback
  if (!result.found && mode !== 'W') {
    console.log('No path found with', mode, ', trying walking as fallback...');
    result = aStarPathfinding(
      nodes, edges, adjacency,
      startNearest.id, goalNearest.id,
      'W', startDestination, goalDest
    );
    console.log('Walking fallback result:', result);
  }
  
  return result;
}

function findNearestNode(nodes: Map<string, GraphNode>, lat: number, lng: number): { id: string; distance: number } | null {
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

function pathToCoordinates(path: string[], nodes: Map<string, GraphNode>): [number, number][] {
  const coordinates = path
    .map(nodeId => {
      const node = nodes.get(nodeId);
      return node ? [node.lat, node.lng] as [number, number] : null;
    })
    .filter((coord): coord is [number, number] => coord !== null);
    
  console.log('Path to coordinates conversion:', {
    pathLength: path.length,
    coordinatesLength: coordinates.length,
    firstCoord: coordinates[0],
    lastCoord: coordinates[coordinates.length - 1]
  });
  
  return coordinates;
}

function checkGraphConnectivity(
  nodes: Map<string, GraphNode>,
  adjacency: Map<string, string[]>,
  startId: string,
  goalId: string
): boolean {
  // Simple BFS to check if there's any connection between start and goal
  const visited = new Set<string>();
  const queue = [startId];
  visited.add(startId);
  
  while (queue.length > 0) {
    const current = queue.shift()!;
    
    if (current === goalId) {
      return true;
    }
    
    const neighbors = adjacency.get(current) || [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push(neighbor);
      }
    }
  }
  
  return false;
}

function getModeName(mode: string): string {
  const names: { [key: string]: string } = {
    'W': 'walking',
    '2': '2-wheeler',
    '4': '4-wheeler',
    '4PA': '4-wheeler (parking)',
    '4PI': '4-wheeler (pickup)'
  };
  return names[mode] || mode;
}