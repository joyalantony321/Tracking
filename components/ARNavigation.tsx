"use client";

import { useEffect, useRef, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Navigation, X, AlertTriangle, MapPin } from 'lucide-react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import {
  calculateBearing,
  calculateDistance,
  convertToARPosition,
  getNextNavigationPoint,
  smoothBearing,
  type ARNavigationPoint,
  type ARArrowPosition,
} from '@/lib/ar-navigation';

// Dynamic Leaflet import to avoid SSR issues
let L: any = null;
if (typeof window !== 'undefined') {
  const leaflet = require('leaflet');
  require('leaflet/dist/leaflet.css');
  L = leaflet;
}

interface ARNavigationProps {
  routeInfo: any;
  selectedMode: string;
  onClose: () => void;
}

const ARNavigation: React.FC<ARNavigationProps> = ({
  routeInfo,
  selectedMode,
  onClose
}) => {
  // Extract route data from routeInfo
  const route: [number, number][] = routeInfo?.segments?.flatMap((segment: any) => 
    segment.coordinates?.map((coord: [number, number]) => [coord[1], coord[0]]) // Convert to [lat, lng]
  ) || [];
  
  const destination = routeInfo?.destination?.name || routeInfo?.destinationPoint?.name || 'Unknown Destination';
  const startPoint = routeInfo?.startPoint;
  
  const sceneRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const threeSceneRef = useRef<HTMLDivElement>(null);
  const threeRendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const threeSceneObjectRef = useRef<THREE.Scene | null>(null);
  const threeCameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const arrowModelRef = useRef<THREE.Group | null>(null);
  
  const [isARReady, setIsARReady] = useState(false);
  const [permissionsGranted, setPermissionsGranted] = useState(false);
  const [arError, setArError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [currentBearing, setCurrentBearing] = useState(0);
  const [deviceOrientation, setDeviceOrientation] = useState(0);
  const [distance, setDistance] = useState(0);
  const [nextPoint, setNextPoint] = useState<ARNavigationPoint | null>(null);
  const [navigationPhase, setNavigationPhase] = useState<'to-start' | 'to-destination'>('to-start');
  const [isAtStartPoint, setIsAtStartPoint] = useState(false);
  const [userLocationMarker, setUserLocationMarker] = useState<any>(null);
  const [routePolyline, setRoutePolyline] = useState<any>(null);
  const [videoReady, setVideoReady] = useState(false);
  const [showArrow, setShowArrow] = useState(false);
  const [turnDirection, setTurnDirection] = useState<'left' | 'right' | 'straight'>('straight');
  const [arrowPosition, setArrowPosition] = useState<ARArrowPosition>({
    x: 0,
    y: 0,
    z: -5,
    rotationY: 0,
  });

  // Handle device orientation
  useEffect(() => {
    const handleOrientation = (event: DeviceOrientationEvent) => {
      if (event.alpha !== null) {
        setDeviceOrientation(event.alpha);
      }
    };

    if (typeof DeviceOrientationEvent !== 'undefined') {
      window.addEventListener('deviceorientation', handleOrientation);
      return () => window.removeEventListener('deviceorientation', handleOrientation);
    }
  }, []);

  // Get user location
  const getCurrentLocation = useCallback(() => {
    return new Promise<{ lat: number; lng: number }>((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation not supported'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (error) => reject(error),
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000,
        }
      );
    });
  }, []);

  // Initialize Three.js scene for 3D arrows
  const initializeThreeJS = useCallback(() => {
    if (!threeSceneRef.current || threeRendererRef.current) return;

    console.log('Initializing Three.js for 3D arrows...');

    // Create scene
    const scene = new THREE.Scene();
    threeSceneObjectRef.current = scene;

    // Create camera
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 5;
    threeCameraRef.current = camera;

    // Create renderer
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(threeSceneRef.current.offsetWidth, threeSceneRef.current.offsetHeight);
    renderer.setClearColor(0x000000, 0); // Transparent background
    threeSceneRef.current.appendChild(renderer.domElement);
    threeRendererRef.current = renderer;

    // Add lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(0, 10, 5);
    scene.add(directionalLight);

    // Load the arrow model
    loadArrowModel();

    console.log('Three.js initialized successfully');
  }, []);

  // Load the 3D arrow model
  const loadArrowModel = useCallback(() => {
    const loader = new GLTFLoader();
    
    loader.load(
      '/direction_arrows.glb',
      (gltf) => {
        console.log('Arrow model loaded successfully:', gltf);
        
        const arrowGroup = new THREE.Group();
        arrowGroup.add(gltf.scene);
        
        // Scale and position the arrow
        arrowGroup.scale.set(2, 2, 2);
        arrowGroup.position.set(0, -1, -3);
        
        // Initially hide the arrow
        arrowGroup.visible = false;
        
        arrowModelRef.current = arrowGroup;
        
        if (threeSceneObjectRef.current) {
          threeSceneObjectRef.current.add(arrowGroup);
        }
        
        console.log('Arrow model added to scene');
      },
      (progress) => {
        console.log('Loading progress:', (progress.loaded / progress.total * 100) + '%');
      },
      (error) => {
        console.error('Error loading arrow model:', error);
        console.log('Creating fallback arrow geometry...');
        
        // Create fallback arrow using basic geometry
        createFallbackArrow();
      }
    );
  }, []);

  // Create a simple arrow geometry as fallback
  const createFallbackArrow = useCallback(() => {
    if (!threeSceneObjectRef.current) return;

    // Create arrow using cone and cylinder
    const arrowGroup = new THREE.Group();
    
    // Arrow head (cone)
    const headGeometry = new THREE.ConeGeometry(0.5, 1, 8);
    const headMaterial = new THREE.MeshLambertMaterial({ color: 0x00ff00 });
    const arrowHead = new THREE.Mesh(headGeometry, headMaterial);
    arrowHead.position.set(0, 0.5, 0);
    arrowHead.rotation.z = Math.PI; // Point upward
    
    // Arrow shaft (cylinder)
    const shaftGeometry = new THREE.CylinderGeometry(0.2, 0.2, 1.5);
    const shaftMaterial = new THREE.MeshLambertMaterial({ color: 0x0066ff });
    const arrowShaft = new THREE.Mesh(shaftGeometry, shaftMaterial);
    arrowShaft.position.set(0, -0.5, 0);
    
    arrowGroup.add(arrowHead);
    arrowGroup.add(arrowShaft);
    
    // Scale and position the arrow
    arrowGroup.scale.set(1.5, 1.5, 1.5);
    arrowGroup.position.set(0, -1, -3);
    arrowGroup.visible = false;
    
    arrowModelRef.current = arrowGroup;
    threeSceneObjectRef.current.add(arrowGroup);
    
    console.log('Fallback arrow created and added to scene');
  }, []);

  // Calculate turn direction and distance to next turn
  const calculateTurnDirection = useCallback((userLat: number, userLng: number, routePoints: [number, number][]) => {
    if (!routePoints || routePoints.length < 3) return { direction: 'straight', distanceToTurn: 0 };

    // Find the closest point on the route
    let closestIndex = 0;
    let minDistance = Infinity;
    
    for (let i = 0; i < routePoints.length; i++) {
      const dist = calculateDistance(userLat, userLng, routePoints[i][0], routePoints[i][1]);
      if (dist < minDistance) {
        minDistance = dist;
        closestIndex = i;
      }
    }

    // Look ahead for the next significant turn (within 100 meters)
    for (let i = closestIndex + 1; i < routePoints.length - 1; i++) {
      const distanceToPoint = calculateDistance(userLat, userLng, routePoints[i][0], routePoints[i][1]);
      
      if (distanceToPoint > 100) break; // Too far ahead
      
      if (distanceToPoint < 50) { // Within 50 meters, show turn direction
        // Calculate turn angle
        const bearing1 = calculateBearing(routePoints[i-1][0], routePoints[i-1][1], routePoints[i][0], routePoints[i][1]);
        const bearing2 = calculateBearing(routePoints[i][0], routePoints[i][1], routePoints[i+1][0], routePoints[i+1][1]);
        
        let turnAngle = bearing2 - bearing1;
        if (turnAngle > 180) turnAngle -= 360;
        if (turnAngle < -180) turnAngle += 360;
        
        // Determine turn direction (threshold of 30 degrees)
        if (Math.abs(turnAngle) > 30) {
          return {
            direction: turnAngle > 0 ? 'right' : 'left',
            distanceToTurn: distanceToPoint,
            turnAngle: Math.abs(turnAngle)
          };
        }
      }
    }

    return { direction: 'straight', distanceToTurn: 0 };
  }, []);

  // Update 3D arrow visibility and rotation
  const updateArrowDisplay = useCallback((bearing: number, show: boolean, direction: 'left' | 'right' | 'straight') => {
    if (!arrowModelRef.current || !threeRendererRef.current || !threeSceneObjectRef.current || !threeCameraRef.current) return;

    // Show/hide arrow
    arrowModelRef.current.visible = show;
    
    if (show) {
      // Update arrow rotation based on bearing
      const rotation = (bearing - deviceOrientation) * (Math.PI / 180);
      arrowModelRef.current.rotation.y = rotation;
      
      // Adjust arrow color/animation based on turn direction
      arrowModelRef.current.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          if (direction === 'left') {
            child.material.color.setHex(0x00ff00); // Green for left
          } else if (direction === 'right') {
            child.material.color.setHex(0xff0000); // Red for right  
          } else {
            child.material.color.setHex(0x0000ff); // Blue for straight
          }
        }
      });

      // Add subtle animation
      const time = Date.now() * 0.001;
      arrowModelRef.current.position.y = -1 + Math.sin(time * 2) * 0.2;
    }

    // Render the scene
    threeRendererRef.current.render(threeSceneObjectRef.current, threeCameraRef.current);
  }, [deviceOrientation]);

  // Update AR arrow based on navigation data
  useEffect(() => {
    if (!userLocation) return;

    let targetPoint: ARNavigationPoint | null = null;

    // Phase 1: Navigate to start point first
    if (navigationPhase === 'to-start' && startPoint && startPoint.coordinates) {
      const [startLng, startLat] = startPoint.coordinates;
      const distanceToStart = calculateDistance(
        userLocation.lat,
        userLocation.lng,
        startLat,
        startLng
      );
      
      // Check if user has reached start point (within 50 meters)
      if (distanceToStart <= 50 && !isAtStartPoint) {
        setIsAtStartPoint(true);
        setNavigationPhase('to-destination');
        return; // Will re-trigger with new phase
      }
      
      targetPoint = {
        lat: startLat,
        lng: startLng,
        distance: distanceToStart,
        bearing: calculateBearing(userLocation.lat, userLocation.lng, startLat, startLng)
      };
      
      // Show arrow for navigation to start point
      setShowArrow(distanceToStart > 10); // Show when more than 10m away
      setTurnDirection('straight');
    } 
    // Phase 2: Navigate along route to destination
    else if (navigationPhase === 'to-destination' && route && route.length > 0) {
      targetPoint = getNextNavigationPoint(
        userLocation.lat,
        userLocation.lng,
        route
      );
      
      // Calculate turn direction and show arrow when approaching turns
      const turnInfo = calculateTurnDirection(userLocation.lat, userLocation.lng, route);
      
      if (turnInfo.distanceToTurn > 0 && turnInfo.distanceToTurn < 50) {
        setShowArrow(true);
        setTurnDirection(turnInfo.direction as 'left' | 'right' | 'straight');
        console.log(`Turn ahead: ${turnInfo.direction} in ${Math.round(turnInfo.distanceToTurn)}m`);
      } else {
        setShowArrow(false);
      }
    }

    if (!targetPoint) return;

    setNextPoint(targetPoint);

    const newDistance = targetPoint.distance || 0;
    const targetBearing = targetPoint.bearing || 0;

    // Smooth bearing transition
    const smoothedBearing = smoothBearing(currentBearing, targetBearing, 0.2);
    setCurrentBearing(smoothedBearing);
    setDistance(newDistance);

    // Convert to AR coordinates
    const newPosition = convertToARPosition(smoothedBearing, newDistance, deviceOrientation);
    setArrowPosition(newPosition);

    // Update 3D arrow display
    updateArrowDisplay(smoothedBearing, showArrow, turnDirection);
  }, [userLocation, route, navigationPhase, startPoint, isAtStartPoint, calculateTurnDirection, updateArrowDisplay, showArrow, turnDirection]);

  // Update user location on map
  useEffect(() => {
    if (userLocation && mapRef.current) {
      // Remove existing marker
      if (userLocationMarker) {
        mapRef.current.removeLayer(userLocationMarker);
      }

      // Add new user location marker
      const marker = L.marker([userLocation.lat, userLocation.lng], {
        icon: L.divIcon({
          className: 'user-location-marker',
          html: '<div style="width: 16px; height: 16px; background: #3B82F6; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3); animation: pulse 2s infinite;"></div>',
          iconSize: [16, 16],
          iconAnchor: [8, 8]
        })
      }).addTo(mapRef.current);

      setUserLocationMarker(marker);
      
      // Update map view to follow user
      mapRef.current.setView([userLocation.lat, userLocation.lng], mapRef.current.getZoom(), { animate: true });
    }
  }, [userLocation]); // Removed userLocationMarker from dependencies

  // Request permissions and start camera
  const requestPermissions = async () => {
    setIsInitializing(true);
    setArError(null);

    // Check for browser support
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setArError('Camera access not supported in this browser. Please use a modern browser.');
      setIsInitializing(false);
      return;
    }

    try {
      console.log('Requesting camera access...');
      console.log('MediaDevices supported:', !!navigator.mediaDevices);
      console.log('getUserMedia supported:', !!navigator.mediaDevices.getUserMedia);
      
      // Request camera permission and start video
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });

      console.log('Camera stream obtained:', stream);
      console.log('Video tracks:', stream.getVideoTracks());

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        
        // Add event listeners for video element
        videoRef.current.onloadedmetadata = () => {
          console.log('Video metadata loaded');
          setVideoReady(true);
          videoRef.current?.play().then(() => {
            console.log('Video is playing');
          }).catch((error) => {
            console.error('Error playing video:', error);
          });
        };

        videoRef.current.oncanplay = () => {
          console.log('Video can play');
          setVideoReady(true);
        };

        videoRef.current.onplay = () => {
          console.log('Video started playing');
          setVideoReady(true);
        };

        videoRef.current.onpause = () => {
          console.log('Video paused');
          setVideoReady(false);
        };

        videoRef.current.onerror = (error) => {
          console.error('Video error:', error);
          setVideoReady(false);
        };
      }

      // Get user location
      const location = await getCurrentLocation();
      setUserLocation(location);

      // Initialize map
      setTimeout(() => {
        if (!mapContainerRef.current || mapRef.current) return;

        const map = L.map(mapContainerRef.current, {
          attributionControl: false,
          zoomControl: true
        }).setView([12.862, 77.438], 17);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap',
          maxZoom: 19
        }).addTo(map);

        mapRef.current = map;

        // Add route polyline if available
        if (route && route.length > 0) {
          const polyline = L.polyline(route, {
            color: '#3B82F6',
            weight: 4,
            opacity: 0.8
          }).addTo(map);
          setRoutePolyline(polyline);
          
          map.fitBounds(polyline.getBounds(), { padding: [20, 20] });
        }

        // Add user location marker
        if (location) {
          const marker = L.marker([location.lat, location.lng], {
            icon: L.divIcon({
              className: 'user-location-marker',
              html: '<div style="width: 16px; height: 16px; background: #3B82F6; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>',
              iconSize: [16, 16],
              iconAnchor: [8, 8]
            })
          }).addTo(map);
          setUserLocationMarker(marker);
          map.setView([location.lat, location.lng], 18);
        }
      }, 100);

      // Check if user is already at start point
      if (startPoint && startPoint.coordinates) {
        const [startLng, startLat] = startPoint.coordinates;
        const distanceToStart = calculateDistance(
          location.lat,
          location.lng,
          startLat,
          startLng
        );
        
        if (distanceToStart <= 50) {
          setIsAtStartPoint(true);
          setNavigationPhase('to-destination');
        }
      }

      setPermissionsGranted(true);
      setIsInitializing(false);
      
      // Initialize Three.js after permissions are granted
      setTimeout(() => {
        initializeThreeJS();
      }, 500);
    } catch (error: any) {
      console.error('Permission request failed:', error);
      
      // Try fallback camera constraints
      try {
        console.log('Trying fallback camera constraints...');
        const fallbackStream = await navigator.mediaDevices.getUserMedia({
          video: true // Simple constraints as fallback
        });
        
        if (videoRef.current) {
          videoRef.current.srcObject = fallbackStream;
          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play();
          };
        }
        
        const location = await getCurrentLocation();
        setUserLocation(location);
        setPermissionsGranted(true);
        setIsInitializing(false);
        
      } catch (fallbackError: any) {
        console.error('Fallback also failed:', fallbackError);
        setArError(`Camera access denied: ${fallbackError.message}. Please allow camera access and reload the page.`);
        setIsInitializing(false);
      }
    }
  };

  // Update user location on map
  const updateUserLocationOnMap = useCallback((location: { lat: number; lng: number }) => {
    if (!mapRef.current) return;

    // Remove existing marker
    if (userLocationMarker) {
      mapRef.current.removeLayer(userLocationMarker);
    }

    // Add new user location marker
    const marker = L.marker([location.lat, location.lng], {
      icon: L.divIcon({
        className: 'user-location-marker',
        html: '<div class="w-4 h-4 bg-blue-500 rounded-full border-2 border-white shadow-lg animate-pulse"></div>',
        iconSize: [16, 16],
        iconAnchor: [8, 8]
      })
    }).addTo(mapRef.current);

    setUserLocationMarker(marker);

    // Center map on user location
    mapRef.current.setView([location.lat, location.lng], mapRef.current.getZoom());
  }, [userLocationMarker]);

  // Enhanced AR overlay rendering with canvas
  const renderAROverlay = useCallback(() => {
    if (!nextPoint || !userLocation || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size to match video
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Calculate arrow position
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const arrowLength = 100;
    
    // Convert bearing to canvas rotation (adjust for screen orientation)
    const bearing = (currentBearing - deviceOrientation) * (Math.PI / 180);
    
    // Draw arrow
    ctx.save();
    ctx.translate(centerX, centerY - 80);
    ctx.rotate(bearing);
    
    // Arrow style - bright color for visibility
    ctx.strokeStyle = '#00FF00';
    ctx.fillStyle = '#00FF00';
    ctx.lineWidth = 6;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
    ctx.shadowBlur = 4;
    
    // Draw arrow body
    ctx.beginPath();
    ctx.moveTo(0, -arrowLength/2);
    ctx.lineTo(0, arrowLength/2);
    ctx.stroke();
    
    // Draw arrow head
    ctx.beginPath();
    ctx.moveTo(0, -arrowLength/2);
    ctx.lineTo(-20, -arrowLength/2 + 30);
    ctx.lineTo(20, -arrowLength/2 + 30);
    ctx.closePath();
    ctx.fill();
    
    ctx.restore();

    // Draw distance and bearing info with background
    ctx.shadowColor = 'transparent';
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(centerX - 80, centerY + 60, 160, 50);
    
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`${Math.round(distance)}m`, centerX, centerY + 80);
    
    ctx.font = '12px Arial';
    ctx.fillText(`${Math.round(currentBearing)}°`, centerX, centerY + 100);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`${Math.round(distance)}m`, centerX, centerY + 52);
    
    // Draw compass ring
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(centerX, centerY - 100, 60, 0, 2 * Math.PI);
    ctx.stroke();
    
    // Draw compass N indicator
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('N', centerX, centerY - 155);
    
    // Draw bearing text
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(centerX - 40, centerY + 70, 80, 25);
    ctx.fillStyle = '#ffffff';
    ctx.font = '14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`${Math.round(currentBearing)}°`, centerX, centerY + 87);
  }, [nextPoint, userLocation, currentBearing, distance, navigationPhase, startPoint]);

  // Initialize simple AR overlay
  const initializeARScene = useCallback(async () => {
    if (!sceneRef.current || !permissionsGranted) return;

    try {
      setIsInitializing(true);

      // Create canvas for AR overlay
      sceneRef.current.innerHTML = `
        <canvas 
          id="ar-canvas" 
          width="640" 
          height="480"
          style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 10;"
        ></canvas>
      `;

      setIsARReady(true);
      setIsInitializing(false);

    } catch (error: any) {
      console.error('Failed to initialize AR:', error);
      setArError(`Failed to initialize AR: ${error.message}`);
      setIsInitializing(false);
    }
  }, [permissionsGranted]);

  // Update location periodically
  useEffect(() => {
    if (!permissionsGranted) return;

    const locationInterval = setInterval(async () => {
      try {
        const location = await getCurrentLocation();
        setUserLocation(location);
      } catch (error) {
        console.error('Location update failed:', error);
      }
    }, 5000);

    return () => clearInterval(locationInterval);
  }, [permissionsGranted, getCurrentLocation]);

  // Render AR overlay when data changes
  useEffect(() => {
    if (!permissionsGranted || !canvasRef.current || !nextPoint || !userLocation) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const arrowLength = 100;
    
    const bearing = (currentBearing - deviceOrientation) * (Math.PI / 180);
    
    ctx.save();
    ctx.translate(centerX, centerY - 80);
    ctx.rotate(bearing);
    
    ctx.strokeStyle = '#00FF00';
    ctx.fillStyle = '#00FF00';
    ctx.lineWidth = 6;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
    ctx.shadowBlur = 4;
    
    ctx.beginPath();
    ctx.moveTo(0, -arrowLength/2);
    ctx.lineTo(0, arrowLength/2);
    ctx.stroke();
    
    ctx.beginPath();
    ctx.moveTo(0, -arrowLength/2);
    ctx.lineTo(-20, -arrowLength/2 + 30);
    ctx.lineTo(20, -arrowLength/2 + 30);
    ctx.closePath();
    ctx.fill();
    
    ctx.restore();

    ctx.shadowColor = 'transparent';
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(centerX - 80, centerY + 60, 160, 50);
    
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`${Math.round(distance)}m`, centerX, centerY + 80);
    
    ctx.font = '12px Arial';
    ctx.fillText(`${Math.round(currentBearing)}°`, centerX, centerY + 100);
  }, [permissionsGranted, nextPoint, userLocation, currentBearing, deviceOrientation, distance]);

  // Start location tracking when permissions granted
  useEffect(() => {
    if (!permissionsGranted) return;

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const newLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        setUserLocation(newLocation);
      },
      (error) => {
        console.error('Location tracking error:', error);
      },
      {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 1000,
      }
    );

    return () => {
      if (watchId) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [permissionsGranted]);

  // Handle device orientation
  useEffect(() => {
    if (!permissionsGranted) return;

    const handleOrientation = (event: DeviceOrientationEvent) => {
      if (event.alpha !== null) {
        setDeviceOrientation(event.alpha);
      }
    };

    window.addEventListener('deviceorientation', handleOrientation);
    
    return () => {
      window.removeEventListener('deviceorientation', handleOrientation);
    };
  }, [permissionsGranted]);

  // Ensure video plays when stream is set
  useEffect(() => {
    if (videoRef.current && videoRef.current.srcObject && permissionsGranted) {
      const video = videoRef.current;
      
      const playVideo = async () => {
        try {
          await video.play();
          console.log('Video playback started successfully');
        } catch (error) {
          console.error('Video play failed:', error);
        }
      };

      if (video.readyState >= 2) {
        playVideo();
      } else {
        video.addEventListener('loadeddata', playVideo);
        return () => video.removeEventListener('loadeddata', playVideo);
      }
    }
  }, [permissionsGranted]);

  // Continuous Three.js rendering loop
  useEffect(() => {
    if (!permissionsGranted || !threeRendererRef.current) return;

    const animate = () => {
      if (threeRendererRef.current && threeSceneObjectRef.current && threeCameraRef.current) {
        // Update arrow animation if visible
        if (arrowModelRef.current && arrowModelRef.current.visible) {
          const time = Date.now() * 0.001;
          arrowModelRef.current.position.y = -1 + Math.sin(time * 2) * 0.2;
          
          // Rotate arrow based on current bearing and turn direction
          const rotation = (currentBearing - deviceOrientation) * (Math.PI / 180);
          arrowModelRef.current.rotation.y = rotation;
        }
        
        threeRendererRef.current.render(threeSceneObjectRef.current, threeCameraRef.current);
      }
      requestAnimationFrame(animate);
    };

    animate();
  }, [permissionsGranted, currentBearing, deviceOrientation]);

  // Handle window resize for Three.js
  useEffect(() => {
    const handleResize = () => {
      if (threeRendererRef.current && threeCameraRef.current && threeSceneRef.current) {
        const width = threeSceneRef.current.offsetWidth;
        const height = threeSceneRef.current.offsetHeight;
        
        threeCameraRef.current.aspect = width / height;
        threeCameraRef.current.updateProjectionMatrix();
        threeRendererRef.current.setSize(width, height);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Cleanup
  useEffect(() => {
    return () => {
      if (videoRef.current?.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
      
      // Cleanup Three.js
      if (threeRendererRef.current) {
        threeRendererRef.current.dispose();
      }
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-black">
      {/* Split Screen Layout */}
      {permissionsGranted ? (
        <div className="flex flex-col md:flex-row h-full">
          {/* Left Half - AR Camera View */}
          <div className="w-full md:w-1/2 h-1/2 md:h-full relative">
            {/* Camera Video Background */}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              controls={false}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                backgroundColor: '#000'
              }}
            />

            {/* Three.js 3D Arrow Overlay */}
            <div
              ref={threeSceneRef}
              className="absolute inset-0 w-full h-full"
              style={{ pointerEvents: 'none', zIndex: 10 }}
            />

            {/* AR Overlay Canvas (for additional 2D overlays) */}
            <canvas
              ref={canvasRef}
              id="ar-canvas"
              className="absolute inset-0 w-full h-full"
              style={{ pointerEvents: 'none', zIndex: 11 }}
            />

            {/* AR View Label */}
            <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-sm rounded-lg px-3 py-2 text-white">
              <div className="flex items-center gap-2">
                <Navigation size={16} />
                <span className="text-sm">AR View</span>
                {videoRef.current?.srcObject && (
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                )}
              </div>
            </div>

            {/* Camera Status Debug */}
            <div className="absolute top-16 left-4 bg-black/80 rounded-lg px-3 py-2 text-white text-xs">
              <div>Permissions: {permissionsGranted ? '✅' : '❌'}</div>
              <div>Video Stream: {videoRef.current?.srcObject ? '✅' : '❌'}</div>
              <div>Video Ready: {videoReady ? '✅' : '❌'}</div>
              <div>Video Playing: {videoRef.current && !videoRef.current.paused ? '✅' : '❌'}</div>
              <div>3D Scene: {threeSceneObjectRef.current ? '✅' : '❌'}</div>
              <div>Arrow Model: {arrowModelRef.current ? '✅' : '❌'}</div>
              <div>Show Arrow: {showArrow ? '✅' : '❌'}</div>
              <div>Turn Direction: {turnDirection}</div>
            </div>

            {/* Fallback message for black screen */}
            {permissionsGranted && !videoReady && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                <div className="bg-white/90 rounded-lg p-4 text-center max-w-sm">
                  <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4" />
                  <h3 className="font-semibold mb-2">Starting Camera...</h3>
                  <p className="text-sm text-gray-600">
                    Please allow camera access when prompted. If the camera doesn't start, refresh the page.
                  </p>
                </div>
              </div>
            )}

            {/* Turn Direction Notification */}
            {showArrow && permissionsGranted && videoReady && (
              <div className="absolute bottom-20 left-1/2 transform -translate-x-1/2 bg-blue-600/90 backdrop-blur-sm rounded-full px-6 py-3 text-white">
                <div className="flex items-center gap-3">
                  {turnDirection === 'left' && (
                    <>
                      <div className="text-2xl">←</div>
                      <span className="font-semibold">Turn Left Ahead</span>
                    </>
                  )}
                  {turnDirection === 'right' && (
                    <>
                      <div className="text-2xl">→</div>
                      <span className="font-semibold">Turn Right Ahead</span>
                    </>
                  )}
                  {turnDirection === 'straight' && (
                    <>
                      <div className="text-2xl">↑</div>
                      <span className="font-semibold">Continue Straight</span>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Right Half - Live Leaflet Map */}
          <div className="w-full md:w-1/2 h-1/2 md:h-full relative">
            {/* Leaflet Map Container */}
            <div 
              ref={mapContainerRef}
              className="absolute inset-0 w-full h-full z-10"
            />

            {/* Map Overlay Info */}
            <div className="absolute top-4 right-4 z-20 bg-black/60 backdrop-blur-sm rounded-lg px-3 py-2 text-white">
              <div className="flex items-center gap-2">
                <MapPin size={16} />
                <span className="text-sm">Live Map</span>
              </div>
            </div>

            {/* Navigation Info Panel */}
            <div className="absolute bottom-4 left-4 right-4 z-20 bg-black/70 backdrop-blur-sm rounded-lg p-4">
              <div className="text-white">
                <h3 className="text-sm font-semibold mb-2">
                  {navigationPhase === 'to-start' 
                    ? `Phase 1: Go to ${startPoint?.name || 'Start Point'}`
                    : `Phase 2: Following route to ${destination}`
                  }
                </h3>
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="opacity-80">Distance:</span>
                    <div className="font-bold text-lg">{Math.round(distance)}m</div>
                  </div>
                  <div>
                    <span className="opacity-80">Bearing:</span>
                    <div className="font-bold text-lg">{Math.round(currentBearing)}°</div>
                  </div>
                </div>
                {nextPoint && (
                  <div className="text-xs text-gray-300 mt-2">
                    Next: Waypoint ({nextPoint.lat.toFixed(4)}, {nextPoint.lng.toFixed(4)})
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Controls Overlay */}
      {permissionsGranted && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-60 px-4">
          <div className="flex flex-col md:flex-row items-center gap-2 md:gap-4">
            <div className="bg-black/60 backdrop-blur-sm rounded-lg px-4 py-2 text-white">
              <div className="flex items-center gap-2">
                <Navigation size={16} />
                <span className="text-sm font-medium">
                  {navigationPhase === 'to-start' 
                    ? `Go to Start: ${startPoint?.name || 'Start Point'}`
                    : `AR Navigation to ${destination}`
                  }
                </span>
              </div>
            </div>

            <Button
              onClick={onClose}
              variant="outline"
              size="sm"
              className="bg-black/60 backdrop-blur-sm border-white/20 text-white hover:bg-white/20"
            >
              <X size={16} />
            </Button>
          </div>
        </div>
      )}



      {/* Loading/Error States */}
      {!permissionsGranted && (
        <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-60">
          <div className="bg-white rounded-lg p-6 max-w-sm mx-4 text-center">
            {arError ? (
              <>
                <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">AR Error</h3>
                <p className="text-gray-600 mb-4">{arError}</p>
                <div className="space-y-2">
                  <Button onClick={requestPermissions} className="w-full">
                    Try Again
                  </Button>
                  <Button onClick={onClose} variant="outline" className="w-full">
                    Back to Map
                  </Button>
                </div>
              </>
            ) : isInitializing ? (
              <>
                <div className="animate-spin w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Starting AR...</h3>
                <p className="text-gray-600">Setting up camera and location</p>
              </>
            ) : (
              <>
                <Navigation className="w-12 h-12 text-blue-500 mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">AR Navigation</h3>
                <p className="text-gray-600 mb-4">
                  See direction arrows in your live camera view
                </p>
                <Button onClick={requestPermissions} className="w-full">
                  Start AR Navigation
                </Button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Initialization Notice */}
      {permissionsGranted && isInitializing && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-60">
          <div className="bg-black/80 backdrop-blur-sm rounded-lg p-6 text-white text-center">
            <div className="animate-spin w-8 h-8 border-4 border-white border-t-transparent rounded-full mx-auto mb-4" />
            <p className="text-lg font-medium">Setting up AR Navigation...</p>
            <p className="text-sm opacity-80 mt-2">Preparing split-screen view</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default ARNavigation;