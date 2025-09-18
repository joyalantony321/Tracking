// Simple test script to verify pathfinding works
const { buildGraphFromGeoJSON } = require('./lib/graph');
const { calculateHybridRoute } = require('./lib/pathfinding');
const { destinations } = require('./data/destinations');
const geoJsonData = require('./data/GeoJson.json');

console.log('Testing pathfinding system...');

// Build graph
console.log('Building graph...');
const graph = buildGraphFromGeoJSON(geoJsonData);
console.log('Graph built:', {
  nodes: graph.nodes.size,
  edges: graph.edges.length,
  adjacency: graph.adjacency.size
});

// Test basic route
const gate1 = destinations.find(d => d.name === 'Gate 1');
const gate2 = destinations.find(d => d.name === 'Gate 2');

if (gate1 && gate2) {
  console.log('\nTesting route from Gate 1 to Gate 2...');
  const [startLng, startLat] = gate1.coordinates;
  
  const result = calculateHybridRoute(
    graph.nodes,
    graph.edges,
    graph.adjacency,
    startLat,
    startLng,
    gate2,
    'W' // Walking
  );
  
  console.log('Route result:', {
    found: result.found,
    segments: result.segments.length,
    totalDistance: result.totalDistance,
    totalTime: result.totalTravelTime
  });
  
  if (result.found) {
    console.log('✅ Basic pathfinding works!');
  } else {
    console.log('❌ Pathfinding failed');
  }
} else {
  console.log('❌ Could not find test destinations');
}