// Test script to run in browser console
console.log('Testing pathfinding with real data...');

// This should be run in the browser console when the app is loaded
function testPathfinding() {
  // Check if the global graph and functions are available
  if (typeof window !== 'undefined' && window.mapComponent) {
    console.log('Testing through map component');
  } else {
    console.log('Please run this in the browser console when the app is loaded');
  }
}

// Instructions for user:
console.log(`
To test pathfinding:
1. Open the app at http://localhost:3001
2. Open browser console (F12)
3. Try selecting a mode and destinations
4. Watch the console output for debugging information
`);