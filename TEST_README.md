# AR Navigation Test Page

A simplified test implementation of the AR navigation system using 2 points, 1 route, and 1 test area.

## 🎯 Test Setup

### Data Structure
- **Point 1**: Start location at coordinates [77.4494954935235, 12.880972880040261]
- **Point 2**: Destination at coordinates [77.44939140649512, 12.880490907967356]
- **Route**: Pre-defined path with 3 coordinate points
- **Test Area**: Polygon boundary for location validation

### Files Created
```
/app/test/page.tsx              # Main test page
/components/TestMapComponent.tsx # Simplified map component
/components/TestNavigationPanel.tsx # Test navigation UI
/lib/test-data.ts              # Test data and utilities
/data/test-map.json            # GeoJSON data from your input
```

## 🚀 How to Use

1. **Access Test Page**: Navigate to `http://localhost:3000/test`

2. **Select Points**: 
   - Click on the numbered markers (1 or 2) on the map
   - Choose "Set as Start" or "Set as Destination" from popup

3. **View Route**: 
   - Route automatically appears when both points selected
   - Blue line shows the path between points

4. **Test AR Navigation**:
   - Click "AR Navigation" button
   - System validates if you're in the test area
   - AR experience launches with 3D waypoints

## 🎮 Features Included

### ✅ Same UI Components
- **Navigation Panel**: Identical layout and styling
- **Point Selection**: Interactive map markers
- **Route Visualization**: Colored path display
- **AR Integration**: Full AR navigation system

### ✅ Location Validation
- **Test Area Boundary**: Polygon-based validation
- **Smart Tooltips**: Context-aware status messages
- **Permission Handling**: GPS and camera access

### ✅ AR Navigation
- **3D Waypoints**: Cone-shaped markers at route coordinates
- **Camera Overlay**: Real-world view with digital markers
- **Location-Based AR**: GPS-synchronized marker positioning

## 🗺️ Test Data

Your provided GeoJSON has been converted to:

```typescript
// Points (converted from GeoJSON Point features)
const TEST_POINTS = [
  { id: 'point1', coordinates: [77.4494954935235, 12.880972880040261] },
  { id: 'point2', coordinates: [77.44939140649512, 12.880490907967356] }
];

// Route (converted from GeoJSON LineString)
const TEST_ROUTE = {
  coordinates: [
    [77.44949552900289, 12.880973352357174],
    [77.44939092838092, 12.880497022975277], 
    [77.44939261339289, 12.880515436186698]
  ]
};

// Test Area (converted from GeoJSON Polygon)
const TEST_AREA = {
  coordinates: [
    [77.44928444116192, 12.881092891348345],
    [77.44928444116192, 12.880412039663241],
    [77.44957809788536, 12.880412039663241],
    [77.44957809788536, 12.881092891348345],
    [77.44928444116192, 12.881092891348345]
  ]
};
```

## 🎨 Visual Elements

- **Map Legend**: Shows point types, route, and test area
- **Interactive Markers**: Numbered points with selection popups
- **Route Display**: Blue line connecting selected points
- **Test Area**: Dashed green polygon boundary
- **Status Indicators**: Real-time feedback on selections

## 🔧 Technical Implementation

- **Leaflet Map**: Interactive map with custom markers
- **Location Validation**: Ray-casting algorithm for polygon detection
- **AR Integration**: A-Frame + AR.js with location-based markers
- **State Management**: React hooks for point selection and routing
- **Responsive UI**: Same styling as main application

## 🧪 Testing Workflow

1. **Point Selection**: Test interactive marker clicks
2. **Route Calculation**: Verify automatic route display
3. **Location Validation**: Test "User not in test area" message
4. **AR Launch**: Validate camera permissions and AR scene
5. **3D Waypoints**: Check GPS-based marker positioning

This test page provides the same AR navigation experience with your specific data points while maintaining all the UI components and features from the main application.