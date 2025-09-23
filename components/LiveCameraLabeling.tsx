"use client";

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { RotateCcw } from 'lucide-react';

interface LiveCameraLabelingProps {
  onCameraReady?: (isReady: boolean) => void;
}

const LiveCameraLabeling: React.FC<LiveCameraLabelingProps> = ({ onCameraReady }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initialize video when component mounts
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleLoadedData = () => {
      setIsVideoLoaded(true);
      setError(null);
      onCameraReady?.(true);
      
      // Auto-play the video
      video.play().then(() => {
        setIsPlaying(true);
      }).catch((error) => {
        console.error('Auto-play failed:', error);
        setError('Video auto-play failed. Click play to start.');
      });
    };

    const handleError = (e: Event) => {
      console.error('Video error:', e);
      setError('Failed to load video Track1.mp4');
      onCameraReady?.(false);
    };

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    video.addEventListener('loadeddata', handleLoadedData);
    video.addEventListener('error', handleError);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);

    return () => {
      video.removeEventListener('loadeddata', handleLoadedData);
      video.removeEventListener('error', handleError);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
    };
  }, [onCameraReady]);





  if (error) {
    return (
      <div className="w-full h-full bg-black flex items-center justify-center">
        <div className="text-center text-white p-6">
          <div className="text-red-500 text-4xl mb-4"></div>
          <h3 className="text-lg font-semibold mb-2">Video Error</h3>
          <p className="text-sm opacity-80 mb-4">{error}</p>
          <Button 
            onClick={() => {
              setError(null);
              window.location.reload();
            }} 
            variant="outline" 
            size="sm"
            className="bg-white/10 hover:bg-white/20"
          >
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="relative w-full h-full overflow-hidden bg-black"
      style={{ maxHeight: '100%' }}
    >
      <video
        ref={videoRef}
        className="w-full h-full object-cover"
        src="/Track1.mp4"
        loop
        muted={isMuted}
        playsInline
        preload="auto"
        style={{ maxHeight: '100%', maxWidth: '100%' }}
      />
      {/* Note: Using object-cover to fill container. For 1:1 ratio video, 
          change to object-contain if you want to see entire video with possible black bars */}

      {!isVideoLoaded && (
        <div className="absolute inset-0 bg-black flex items-center justify-center">
          <div className="text-center text-white">
            <div className="animate-spin w-8 h-8 border-4 border-white border-t-transparent rounded-full mx-auto mb-4" />
            <p className="text-lg font-medium">Loading Video...</p>
            <p className="text-sm opacity-80 mt-2">Preparing Track1.mp4</p>
          </div>
        </div>
      )}



      <div className="absolute top-4 right-4 flex gap-2">
        <Button
          onClick={() => {}}
          size="sm"
          variant="secondary"
          className="bg-black/50 hover:bg-black/70 text-white backdrop-blur-sm"
          disabled
        >
          <RotateCcw className="w-4 h-4 opacity-50" />
        </Button>
      </div>

      {/* Compact status overlay in corner */}
      <div className="absolute bottom-2 right-2 bg-black/60 text-white px-2 py-1 rounded text-xs backdrop-blur-sm">
        {isVideoLoaded ? '🎥' : '⏳'}
      </div>
    </div>
  );
};

export default LiveCameraLabeling;
