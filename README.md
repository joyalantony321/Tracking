# Campus Navigation System

A sophisticated Next.js-based campus navigation system with intelligent hybrid routing, transportation mode restrictions, and real-time pathfinding using actual road networks.

## 🏫 Overview

This campus navigation system provides intelligent routing for different transportation modes within a campus environment. It uses real GeoJSON road data to calculate optimal paths while enforcing campus-specific transportation rules and restrictions.

## 🚀 Features

### 🎯 Core Navigation Features
- **Real Road-Based Pathfinding**: Uses actual GeoJSON road coordinates instead of direct lines
- **A* Algorithm**: Efficient shortest path calculation with proper heuristics
- **Interactive Leaflet Map**: Dynamic route visualization with multi-colored path segments
- **Real-time Location Tracking**: GPS-based navigation with arrival detection
- **Responsive UI**: Modern interface built with React and Tailwind CSS

### 📱 AR Navigation Features (NEW!)
- **Augmented Reality Overlay**: Real-world camera view with digital route markers
- **3D Waypoint Visualization**: Interactive cone-shaped markers for each route point
- **Location-Based AR**: GPS-powered AR markers positioned at actual world coordinates
- **Campus Location Validation**: Automatic verification that user is within campus boundaries
- **Smart Tooltip System**: Contextual messages based on location and permissions
- **Camera Integration**: WebXR-powered camera access with permission handling
- **Multi-Platform Support**: Works on mobile devices with camera and GPS
- **AR.js + A-Frame Integration**: Advanced AR scene rendering with 3D graphics
- **Real-time Route Sync**: AR markers automatically sync with calculated routes

### 🚗 Transportation Modes

#### 1. **Walking Mode (🚶)**
- **Speed**: 1.4 m/s (5.04 km/h)
- **Color**: Blue (`#45B7D1`)
- **Access**: Can enter through both Gate 1 and Gate 2
- **Restrictions**: None - can access all destinations directly
- **Use Case**: Pedestrian navigation throughout campus

#### 2. **2-Wheeler Mode (🏍️)**
- **Speed**: 5.0 m/s (18 km/h)
- **Color**: Teal (`#4ECDC4`)
- **Access**: **Gate 2 ONLY** - Gate 1 is completely disabled
- **Special Rules**:
  - ✅ **Direct access to**: Devadhan Block Parking
  - ❌ **Architecture Block Parking**: Must route through Devadhan first
  - 🔄 **All other destinations**: Route to 2-Wheeler square parking → walking

#### 3. **4-Wheeler Mode (🚗)**
- **Speed**: 8.0 m/s (28.8 km/h)
- **Color**: Red (`#FF6B6B`)
- **Access**: **Gate 1 ONLY** - Gate 2 is completely disabled
- **Special Rules**:
  - ✅ **Direct access to**: Devadhan Block Parking, Architecture Block Parking
  - 🔄 **All other destinations**: Route to 4-Wheeler parking → walking

## 🛣️ Routing Rules & Logic

### 🚪 Gate Access Restrictions

| Transportation Mode | Gate 1 | Gate 2 | Reason |
|-------------------|--------|--------|---------|
| 🚶 Walking | ✅ | ✅ | Pedestrians can use both gates |
| 🏍️ 2-Wheeler | ❌ | ✅ | Campus traffic flow management |
| 🚗 4-Wheeler | ✅ | ❌ | Campus traffic flow management |

### 🅿️ Parking Access Rules

#### **Direct Vehicle Access Allowed:**
- **Devadhan Block Parking**: Both 2-wheeler and 4-wheeler direct access
- **Architecture Block Parking**: 4-wheeler direct access only

#### **Special 2-Wheeler Routing to Architecture:**
```
Gate 2 → Devadhan Block Parking → Architecture Block Parking
```
*2-wheelers cannot go directly to Architecture parking and must route through Devadhan first*

### 🔄 Hybrid Routing System

When destinations don't allow direct vehicle access, the system uses hybrid routing:

#### **4-Wheeler Hybrid Route:**
```
Gate 1 → 4-Wheeler Parking → Walking to Final Destination
```

#### **2-Wheeler Hybrid Route:**
```
Gate 2 → 2-Wheeler Square Parking → Walking to Final Destination
```

## 🎨 Visual Design System

### 🌈 Route Colors
- **🚶 Walking**: Blue (`#45B7D1`)
- **🏍️ 2-Wheeler**: Teal (`#4ECDC4`)
- **🚗 4-Wheeler**: Red (`#FF6B6B`)
- **🅿️ 4-Wheeler Parking Access**: Orange (`#FF9F43`)
- **🚛 4-Wheeler Pickup**: Light Salmon (`#FFA07A`)

### 🗺️ Map Features
- **Multi-colored path segments** for hybrid routes
- **Route information markers** showing distance and mode
- **Start/destination markers** with custom icons
- **Alternative route suggestions** when optimal path unavailable

## 📁 Project Structure

```
project/
├── app/                    # Next.js 13 app directory
│   ├── globals.css        # Global styles
│   ├── layout.tsx         # Root layout
│   └── page.tsx          # Main application page
├── components/            # React components
│   ├── MapComponent.tsx   # Leaflet map integration
│   ├── NavigationPanel.tsx # Navigation controls
│   └── ui/               # Reusable UI components
├── data/                 # Static data files
│   ├── campus.geojson    # Campus boundary data
│   ├── destinations.ts   # All campus destinations
│   └── GeoJson.json     # Road network data (26 segments)
├── lib/                  # Core logic libraries
│   ├── graph.ts         # Graph data structures
│   ├── hybrid-routing.ts # Hybrid routing engine
│   ├── navigation.ts    # Navigation utilities
│   ├── pathfinding.ts   # Original pathfinding logic
│   └── road-pathfinding.ts # Road-based A* algorithm
└── hooks/               # Custom React hooks
    └── use-toast.ts     # Toast notifications
```

## 🔧 Technical Implementation

### 🧠 Core Algorithms

#### **A* Pathfinding Algorithm**
- **Heuristic**: Haversine distance calculation
- **Graph Structure**: Road network with connected nodes
- **Edge Weights**: Physical distance between road segments
- **Mode Validation**: Conditional access based on transportation mode

#### **Road Network Processing**
- **26 LineString segments** from GeoJSON data
- **Node connectivity** with 5-meter snap tolerance
- **Mode-specific edge filtering** during pathfinding
- **Conditional access rules** per road segment

### 🎯 Routing Strategies

1. **Direct Route Attempt**: Try direct vehicle access (if allowed)
2. **Hybrid Route Calculation**: Vehicle → intermediate parking → walking
3. **Special Case Handling**: 2-wheeler routing through Devadhan
4. **Alternative Route Fallback**: Show any available path

### 🗺️ Destination Categories

| Category | Examples | Count |
|----------|----------|-------|
| 🏫 Academic | Blocks, Classrooms, Labs | ~50 locations |
| 🏠 Hostel | Dormitories, Residence halls | ~30 locations |
| 🅿️ Parking | Vehicle parking areas | 5 dedicated areas |
| ⚽ Sports | Playgrounds, Courts, Fields | ~15 facilities |
| 🍽️ Dining | Canteens, Food courts | ~10 locations |
| 🚪 Entrance | Campus gates | 2 main gates |
| 🏢 Facility | Administrative, Utilities | ~20 buildings |

## 🚦 Transportation Rules Summary

### ✅ **Allowed Operations**

| From → To | Walking | 2-Wheeler | 4-Wheeler |
|-----------|---------|-----------|-----------|
| Any Gate → Devadhan Parking | ✅ | ✅ | ✅ |
| Gate 1 → Architecture Parking | ✅ | ❌ | ✅ |
| Gate 2 → Architecture Parking | ✅ | Via Devadhan | ❌ |
| Any Gate → Academic Buildings | ✅ | Via Parking | Via Parking |
| Any Gate → Hostels | ✅ | Via Parking | Via Parking |

### ❌ **Restricted Operations**

- **2-Wheeler → Gate 1**: Completely blocked
- **4-Wheeler → Gate 2**: Completely blocked  
- **2-Wheeler → Architecture Direct**: Must route through Devadhan
- **Vehicle → Non-parking destinations**: Must use hybrid routing

## 💻 Installation & Setup

### Prerequisites
- Node.js 18+ 
- npm or yarn package manager

### Installation Steps

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd campus-navigation-system
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start development server**
   ```bash
   npm run dev
   ```

4. **Open in browser**
   ```
   http://localhost:3000
   ```

### Production Build
```bash
npm run build
npm start
```

## 🎮 Usage Guide

### Step 1: Select Transportation Mode
- Choose from Walking (🚶), 2-Wheeler (🏍️), or 4-Wheeler (🚗)
- **Note**: Invalid gates will be automatically hidden based on mode

### Step 2: Choose Starting Point
- Select entry gate (Gate 1 or Gate 2)
- **Gate restrictions apply automatically**
- Invalid options are visually disabled with warning messages

### Step 3: Select Destination
- Browse by category or search by name
- Categories: Academic, Hostel, Parking, Sports, Dining, Entrance, Facility
- Selected start point is excluded from destination list

### Step 4: View Route
- **Single-colored route**: Direct path available
- **Multi-colored route**: Hybrid routing (vehicle + walking segments)
- **Route information**: Distance, time, and step-by-step instructions

### Step 5: Start Navigation
- **Regular Navigation**: Real-time GPS tracking with turn-by-turn guidance
- **AR Navigation**: Immersive augmented reality experience with camera overlay

### Step 6: AR Navigation (NEW!)
- Click **"AR Navigation"** button after route calculation
- **Location Validation**: System automatically checks if you're within campus boundaries
- **Smart Tooltips**: Hover to see status messages:
  - ✅ "Ready for AR Navigation" (within campus)
  - ❌ "User not in campus (Distance: Xm)" (outside campus)
  - ⚠️ "Location access denied" (permission issues)
- **Grant Camera Permission**: Allow camera access for AR overlay
- **GPS Permission**: Enable location services for accurate positioning
- **AR Experience**: See 3D waypoint markers overlaid on real-world camera view
- **Interactive Markers**: Cone-shaped markers show route progression
- **Real-time Updates**: Markers automatically update as you move along the route

## 🔍 Advanced Features

### 🎯 **Smart Route Selection**
- **Optimal Path Priority**: Always attempts shortest valid route first
- **Hybrid Fallback**: Automatically switches to multi-modal routing
- **Alternative Routes**: Shows viable paths when optimal unavailable
- **Mode-Specific Optimization**: Considers vehicle capabilities and restrictions

### 📊 **Route Information Display**
- **Total Distance & Time**: Complete journey metrics
- **Segment Breakdown**: Individual portions with mode-specific details
- **Visual Indicators**: Color-coded path segments
- **Step-by-Step Instructions**: Detailed navigation guidance

### 🎨 **User Interface Enhancements**
- **Mode Warnings**: "⚠️ 4-wheelers can only enter through Gate 1"
- **Invalid Options**: Grayed out with restriction explanations
- **Visual Feedback**: Color-coded categories and restrictions
- **Responsive Design**: Works on desktop and mobile devices

### 📱 **AR Navigation System**
- **WebXR Integration**: Modern web-based augmented reality
- **A-Frame + AR.js**: Robust 3D rendering and AR tracking
- **Campus Boundary Validation**: Ray-casting algorithm to verify user location
- **Smart Permission Management**: Progressive permission requests for camera and GPS
- **Location-Based Security**: AR only activates when user is within campus boundaries
- **GPS-AR Synchronization**: Real-world coordinate mapping
- **3D Waypoint Markers**: Interactive cone-shaped route indicators
- **Multi-Device Support**: Optimized for mobile phones and tablets
- **Performance Optimization**: Efficient AR scene rendering with duplicate prevention

## 🐛 Known Limitations

1. **Static Road Network**: Based on predefined GeoJSON data (26 segments)
2. **Limited Real-time Updates**: No dynamic traffic or road closure handling
3. **GPS Accuracy**: Dependent on device location services
4. **Campus-Specific**: Designed for specific campus layout

## 🚀 Future Enhancements

- **Dynamic Road Conditions**: Real-time traffic and closure updates
- **Public Transportation**: Bus routes and schedules integration
- **Accessibility Features**: Wheelchair-accessible route options
- **Multi-language Support**: Internationalization capabilities
- **Offline Mode**: Cached maps and routing for poor connectivity

## 🛠️ Development

### Tech Stack
- **Frontend**: Next.js 13, React 18, TypeScript
- **Mapping**: Leaflet.js with custom markers and polylines
- **AR Navigation**: A-Frame, AR.js, WebXR, Three.js
- **Styling**: Tailwind CSS, Radix UI components
- **Algorithms**: A* pathfinding, Haversine distance calculation
- **Data**: GeoJSON road networks, TypeScript destination definitions

### Key Libraries
```json
{
  "next": "13.5.1",
  "react": "18.2.0",
  "leaflet": "^1.9.4",
  "tailwindcss": "^3.4.4",
  "@radix-ui/react-*": "^1.x.x",
  "aframe": "^1.6.0",
  "@ar-js-org/ar.js": "^3.4.5",
  "three": "^0.170.0"
}
```

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 👥 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

**Built with ❤️ for intelligent campus navigation**