# Live Navigation with Camera Labeling

## Overview
The AR Navigation system has been updated to provide a split-screen experience with live camera labeling and route visualization.

## Features

### Top Half - Live Camera Labeling
- **Real-time AI Detection**: Uses Fast-SCNN ONNX model to identify and label places, buildings, and roads in live camera feed
- **Detected Places**: 
  - Block 2 (Red label)
  - Block 3 (Teal label) 
  - Open Audi (Blue label)
  - Open Audi Stage (Mint green label)
  - Road (Yellow label)
  - Students Square (Plum label)
- **Camera Controls**: Switch between front and back camera
- **Performance**: Runs AI inference at 2 FPS for optimal performance

### Bottom Half - Route Map
- **Static Path Display**: Shows your calculated route with start and destination markers
- **Live Location Tracking**: Your current position is displayed with a pulsing blue marker
- **Route Information**: Distance, estimated time, and navigation mode
- **No Live Navigation**: This is a static view for reference, not turn-by-turn navigation

## How to Use

1. **Start Navigation**: Tap "AR Navigation" button from the main map
2. **Grant Permissions**: Allow camera and location access when prompted
3. **View Split Screen**: 
   - Top: Point camera at campus buildings to see AI labels
   - Bottom: View your route and current location on the map
4. **Navigate**: Use the map view to understand your route while using camera labels to identify buildings

## Technical Details

- **AI Model**: Fast-SCNN (Fast Segmentation Convolutional Neural Network)
- **Model Size**: Optimized for mobile performance
- **Inference**: Client-side processing using ONNX Runtime Web
- **Camera**: WebRTC camera access with device orientation support
- **Maps**: Leaflet.js with OpenStreetMap tiles

## Files Updated

- `components/ARNavigation.tsx` - Main split-screen navigation component
- `components/LiveCameraLabeling.tsx` - AI-powered camera labeling
- `components/StaticPathMap.tsx` - Route visualization with location tracking
- `public/fastscnn_campus.onnx` - AI model for place detection

## Notes

- The system requires good lighting for optimal AI detection
- Camera labeling works best when pointed directly at buildings
- Location accuracy depends on device GPS capability
- The map shows your calculated route but doesn't provide turn-by-turn navigation