"use client";

import { useEffect, useRef, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Camera, RotateCcw } from 'lucide-react';

// Define the classes that the ONNX model can detect
const classes = [
  "background",
  "Block 2", 
  "Block 3",
  "Open Audi",
  "Open Audi Stage",
  "Road",
  "Students Square"
];

// Define different colors for each class
const classColors = [
  "#000000", // background - black (won't be displayed)
  "#FF6B6B", // Block 2 - red
  "#4ECDC4", // Block 3 - teal
  "#45B7D1", // Open Audi - blue
  "#96CEB4", // Open Audi Stage - mint green
  "#FFEAA7", // Road - yellow
  "#DDA0DD"  // Students Square - plum
];

interface LiveCameraLabelingProps {
  onCameraReady?: (isReady: boolean) => void;
}

const LiveCameraLabeling: React.FC<LiveCameraLabelingProps> = ({ onCameraReady }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sessionRef = useRef<any>(null);
  const currentStreamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number>(0);
  
  const [isModelLoading, setIsModelLoading] = useState(false);
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [isCameraStarted, setIsCameraStarted] = useState(false);
  const [useBackCamera, setUseBackCamera] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const inferenceRate = 500; // run model every 500ms → 2 FPS (exactly like index.html)
  const lastInferenceTimeRef = useRef(0);
  const lastPredictionRef = useRef<number[][] | null>(null); // Use ref like index.html's lastPred2d

  // Get model path based on environment
  const getModelPath = useCallback(() => {
    // Check for custom model path first (useful for Vercel deployments)
    const customModelPath = process.env.NEXT_PUBLIC_MODEL_PATH;
    if (customModelPath) {
      return [customModelPath];
    }
    
    // For static export builds, the path might be different
    const basePath = process.env.NODE_ENV === 'production' 
      ? (process.env.NEXT_PUBLIC_BASE_PATH || '') 
      : '';
    
    // Try multiple possible paths for robustness
    const possiblePaths = [
      `${basePath}/fastscnn_campus.onnx`,
      `${basePath}/public/fastscnn_campus.onnx`,
      '/fastscnn_campus.onnx',
      './fastscnn_campus.onnx',
      // Try relative path for static exports
      'fastscnn_campus.onnx'
    ];
    
    return possiblePaths;
  }, []);

  // Load ONNX model with retry logic
  const loadModel = useCallback(async () => {
    if (sessionRef.current) return; // Already loaded
    
    setIsModelLoading(true);
    setError(null);
    
    try {
      // Dynamically import onnxruntime-web with timeout
      const ort = await Promise.race([
        import('onnxruntime-web'),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('ONNX import timeout')), 10000)
        )
      ]);
      
      // Configure ONNX for web deployment
      ort.env.wasm.wasmPaths = '/'; // Base path for WASM files
      
      const modelPaths = getModelPath();
      let lastError: Error | null = null;
      
      // Try loading model from different paths
      for (const modelPath of modelPaths) {
        try {
          console.log(`🔄 Trying to load model from: ${modelPath}`);
          
          // Add timeout for model loading
          sessionRef.current = await Promise.race([
            ort.InferenceSession.create(modelPath, {
              executionProviders: ['wasm'],
              graphOptimizationLevel: 'basic'
            }),
            new Promise<never>((_, reject) => 
              setTimeout(() => reject(new Error('Model loading timeout')), 15000)
            )
          ]);
          
          setIsModelLoaded(true);
          console.log(`✅ ONNX model loaded successfully from: ${modelPath}`);
          return; // Success, exit function
          
        } catch (pathError) {
          console.warn(`❌ Failed to load from ${modelPath}:`, pathError);
          lastError = pathError as Error;
          continue; // Try next path
        }
      }
      
      // If we reach here, all paths failed
      throw lastError || new Error('All model paths failed');
      
    } catch (err) {
      console.error("❌ Error loading ONNX model:", err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      
      if (errorMessage.includes('timeout')) {
        setError("Model loading timed out. Please check your internet connection and try again.");
      } else if (errorMessage.includes('fetch')) {
        setError("Could not download AI model. Please check your internet connection.");
      } else {
        setError("Failed to load AI model. Please refresh the page and try again.");
      }
    } finally {
      setIsModelLoading(false);
    }
  }, [getModelPath]);

  // Start camera stream
  const startCamera = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current) return;
    
    try {
      // Stop existing stream
      if (currentStreamRef.current) {
        currentStreamRef.current.getTracks().forEach(track => track.stop());
      }
      
      // Get new stream
      const constraints = {
        video: { 
          facingMode: useBackCamera ? 'environment' : 'user', 
          width: 640, 
          height: 480 
        },
        audio: false
      };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      currentStreamRef.current = stream;
      videoRef.current.srcObject = stream;
      
      // Wait for video to be ready
      await new Promise<void>((resolve) => {
        if (videoRef.current) {
          videoRef.current.onloadedmetadata = () => resolve();
        }
      });
      
      await videoRef.current?.play();
      setIsCameraStarted(true);
      onCameraReady?.(true);
      
      // Start rendering loop
      startRenderLoop();
      
    } catch (err) {
      console.error("❌ Error starting camera:", err);
      setError("Failed to access camera. Please check permissions.");
      onCameraReady?.(false);
    }
  }, [useBackCamera, onCameraReady]);

  // Render loop - camera at device FPS, AI annotations at 2 FPS
  const startRenderLoop = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    if (!video || !canvas || !sessionRef.current) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Set initial canvas size
    const width = video.videoWidth;
    const height = video.videoHeight;
    canvas.width = width;
    canvas.height = height;
    
    console.log(`🎥 Starting render loop at ${width}x${height} - Camera: device FPS, AI: 2 FPS`);
    
    const render = async () => {
      if (!video || !canvas || !ctx || !sessionRef.current) return;
      
      // Draw current video frame at device FPS (smooth camera feed)
      ctx.drawImage(video, 0, 0, width, height);
      
      // Run AI inference at 2 FPS only
      const now = Date.now();
      if (now - lastInferenceTimeRef.current > inferenceRate) {
        lastInferenceTimeRef.current = now;
        
        // Get frame data for inference
        const frame = ctx.getImageData(0, 0, width, height);
        const data = frame.data;
        
        try {
          console.log(`🔍 Running AI inference at 2 FPS...`);
          
          // Preprocess: HWC -> CHW, normalize, resize to 256x256 (exactly like index.html)
          const input = new Float32Array(3 * 256 * 256);
          const scaleX = width / 256;
          const scaleY = height / 256;

          for (let y = 0; y < 256; y++) {
            for (let x = 0; x < 256; x++) {
              const srcX = Math.floor(x * scaleX);
              const srcY = Math.floor(y * scaleY);
              const idxSrc = (srcY * width + srcX) * 4;
              const idxDst = y * 256 + x;
              input[idxDst] = data[idxSrc] / 255.0;
              input[idxDst + 256*256] = data[idxSrc + 1] / 255.0;
              input[idxDst + 2*256*256] = data[idxSrc + 2] / 255.0;
            }
          }

          // Run ONNX inference
          const ort = await import('onnxruntime-web');
          const tensor = new ort.Tensor('float32', input, [1, 3, 256, 256]);
          const output = await sessionRef.current.run({ input: tensor });
          const pred = output.output.data;

          // Reshape prediction to [H, W] (exactly like index.html)
          const H = 256, W = 256, C = classes.length;
          const pred2d = Array.from({ length: H }, () => new Array(W).fill(0));
          for (let y = 0; y < H; y++) {
            for (let x = 0; x < W; x++) {
              let maxVal = -Infinity, maxClass = 0;
              for (let c = 0; c < C; c++) {
                const v = pred[c*H*W + y*W + x];
                if (v > maxVal) { maxVal = v; maxClass = c; }
              }
              pred2d[y][x] = maxClass;
            }
          }

          lastPredictionRef.current = pred2d;
          console.log(`✅ Inference complete, predictions stored`);
          
        } catch (err) {
          console.error("❌ Inference error:", err);
        }
      }
      
      // Draw class labels using last prediction (exactly like index.html) 
      if (lastPredictionRef.current) {
        const H = 256, W = 256, C = classes.length;
        const scaleX = width / 256;
        const scaleY = height / 256;

        for (let c = 1; c < C; c++) {
          let points: [number, number][] = [];
          for (let y = 0; y < H; y++) {
            for (let x = 0; x < W; x++) {
              if (lastPredictionRef.current[y][x] === c) points.push([x, y]);
            }
          }
          if (points.length === 0) continue;

          let sumX = 0, sumY = 0;
          for (let p of points) { sumX += p[0]; sumY += p[1]; }
          let cx = Math.floor(sumX / points.length * scaleX);
          let cy = Math.floor(sumY / points.length * scaleY);

          // Use different color for each class (exactly like index.html)
          ctx.fillStyle = classColors[c];
          ctx.font = 'bold 20px Arial';
          ctx.strokeStyle = '#000000'; // black outline for better visibility
          ctx.lineWidth = 2;
          
          // Draw text with outline for better visibility
          ctx.strokeText(classes[c], cx - 20, cy);
          ctx.fillText(classes[c], cx - 20, cy);
        }
      }
      
      animationFrameRef.current = requestAnimationFrame(render);
    };
    
    render();
  }, []); // Empty dependency array to prevent render loop restarts





  // Toggle camera (front/back)
  const toggleCamera = useCallback(async () => {
    setUseBackCamera(prev => {
      const newValue = !prev;
      console.log(`🔄 Switching to ${newValue ? 'back' : 'front'} camera`);
      
      // Restart camera with new facing mode
      setTimeout(() => {
        startCamera();
      }, 100);
      
      return newValue;
    });
  }, [startCamera]);

  // Initialize when component mounts
  useEffect(() => {
    loadModel();
    
    return () => {
      // Cleanup
      if (currentStreamRef.current) {
        currentStreamRef.current.getTracks().forEach(track => track.stop());
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [loadModel]);

  // Restart camera when toggle changes
  useEffect(() => {
    if (isCameraStarted) {
      startCamera();
    }
  }, [useBackCamera, startCamera, isCameraStarted]);

  return (
    <div className="relative w-full h-full bg-black">
      {/* Video element (hidden, used for capture) */}
      <video
        ref={videoRef}
        className="hidden"
        autoPlay
        muted
        playsInline
      />
      
      {/* Canvas for rendering camera feed with labels */}
      <canvas
        ref={canvasRef}
        className="w-full h-full object-cover"
        style={{ maxHeight: '100%' }}
      />
      
      {/* Camera controls */}
      {isCameraStarted && (
        <div className="absolute top-4 right-4 flex gap-2">
          <Button
            onClick={toggleCamera}
            size="sm"
            variant="secondary"
            className="bg-black/50 hover:bg-black/70 text-white"
          >
            <RotateCcw className="w-4 h-4" />
          </Button>
        </div>
      )}
      
      {/* Loading/Error States */}
      {!isCameraStarted && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80">
          <div className="text-center text-white p-6">
            {error ? (
              <>
                <div className="text-red-400 text-sm mb-4">❌ {error}</div>
                <div className="space-y-2">
                  <Button onClick={loadModel} variant="outline" className="w-full">
                    🔄 Retry Loading Model
                  </Button>
                  <Button 
                    onClick={() => {
                      setError(null);
                      setIsModelLoaded(false);
                      setIsModelLoading(false);
                      loadModel();
                    }} 
                    variant="secondary" 
                    size="sm"
                    className="w-full"
                  >
                    🔧 Force Reload
                  </Button>
                </div>
                <div className="text-xs text-gray-400 mt-3">
                  If this persists, try refreshing the page or check your internet connection.
                </div>
              </>
            ) : isModelLoading ? (
              <>
                <div className="animate-spin w-8 h-8 border-4 border-white border-t-transparent rounded-full mx-auto mb-4" />
                <div>Loading AI Model...</div>
              </>
            ) : isModelLoaded ? (
              <>
                <Camera className="w-12 h-12 mx-auto mb-4" />
                <div className="mb-4">AI Model Ready</div>
                <Button onClick={startCamera}>
                  Start Camera
                </Button>
              </>
            ) : (
              <>
                <Camera className="w-12 h-12 mx-auto mb-4" />
                <div className="mb-4">Preparing Camera...</div>
              </>
            )}
          </div>
        </div>
      )}
      
      {/* Camera controls */}
      {isCameraStarted && (
        <>
          <div className="absolute top-4 left-4 bg-black/50 text-white px-3 py-1 rounded text-sm">
            {isModelLoading ? "Loading AI..." : isModelLoaded ? "AI @ 2 FPS" : "AI Standby"}
          </div>
          
          <div className="absolute top-4 right-4 flex gap-2">
            <Button
              onClick={toggleCamera}
              size="sm"
              variant="secondary"
              className="bg-black/50 hover:bg-black/70 text-white border-white/20"
            >
              <RotateCcw className="w-4 h-4 mr-1" />
              {useBackCamera ? 'Front' : 'Back'}
            </Button>
          </div>
        </>
      )}
    </div>
  );
};

export default LiveCameraLabeling;