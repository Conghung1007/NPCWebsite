import { useState, useRef, useEffect, useCallback } from "react";
import { Volume2, VolumeX, Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { useStreamingAudio } from "@/hooks/useStreamingAudio";

interface ExamAudioPlayerProps {
  src: string;
  maxPlays?: number;
  className?: string;
  onPlayComplete?: () => void;
}

export function ExamAudioPlayer({ 
  src, 
  maxPlays = 1, 
  className = "",
  onPlayComplete 
}: ExamAudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const lastValidTimeRef = useRef<number>(0);
  const playCountRef = useRef<number>(0);
  const isPlayingRef = useRef<boolean>(false);
  const isExhaustedRef = useRef<boolean>(false);
  const hasAutoPlayedRef = useRef<boolean>(false);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isDisabled, setIsDisabled] = useState(false);

  const {
    isLoading,
    isDownloading,
    isReady,
    downloadProgress,
    error,
    setAudioElement,
  } = useStreamingAudio(src, {
    autoPlay: false,
    onReady: () => {
      // Trigger auto-play when streaming is ready
      if (audioRef.current && !hasAutoPlayedRef.current && playCountRef.current < maxPlays) {
        hasAutoPlayedRef.current = true;
        audioRef.current.play().catch(console.error);
      }
    },
  });

  const handleSeeking = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    
    const attemptedTime = audio.currentTime;
    const lastValid = lastValidTimeRef.current;
    
    if (Math.abs(attemptedTime - lastValid) > 0.5) {
      audio.currentTime = lastValid;
    }
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    // Connect audio element to streaming hook
    setAudioElement(audio);

    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
    };

    const handleCanPlayThrough = () => {
      // Auto-play is now handled by streaming hook's onReady callback
      // This is kept for non-streaming fallback
      if (!isReady && !hasAutoPlayedRef.current && playCountRef.current < maxPlays) {
        hasAutoPlayedRef.current = true;
        audio.play().catch(console.error);
      }
    };

    const handleTimeUpdate = () => {
      if (isPlayingRef.current) {
        lastValidTimeRef.current = audio.currentTime;
      }
      setCurrentTime(audio.currentTime);
    };

    const handleEnded = () => {
      isPlayingRef.current = false;
      setIsPlaying(false);
      
      playCountRef.current += 1;
      
      if (playCountRef.current >= maxPlays) {
        isExhaustedRef.current = true;
        setIsDisabled(true);
        audio.src = '';
      }
      
      lastValidTimeRef.current = 0;
      onPlayComplete?.();
    };

    const handlePlay = () => {
      if (isExhaustedRef.current || playCountRef.current >= maxPlays) {
        audio.pause();
        audio.currentTime = 0;
        return;
      }
      
      isPlayingRef.current = true;
      setIsPlaying(true);
    };

    const handlePause = () => {
      isPlayingRef.current = false;
      setIsPlaying(false);
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('canplaythrough', handleCanPlayThrough);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('seeking', handleSeeking);

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('canplaythrough', handleCanPlayThrough);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('seeking', handleSeeking);
    };
  }, [maxPlays, onPlayComplete, handleSeeking, setAudioElement, isReady]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  const handleVolumeChange = (value: number[]) => {
    const newVolume = value[0];
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
  };

  const formatTime = (time: number) => {
    if (!isFinite(time)) return "0:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const playbackPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className={`bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl p-4 shadow-sm border ${className}`}>
      <audio ref={audioRef} preload="auto" />
      
      <div className="flex items-center gap-4">
        <div className="flex-1 space-y-2">
          {/* Dual progress bars container */}
          <div className="relative h-3 bg-gray-200 rounded-full overflow-hidden">
            {/* Download progress bar (blue) - background layer */}
            <div 
              className="absolute top-0 left-0 h-full rounded-full transition-all duration-300 bg-gradient-to-r from-blue-400 to-blue-500"
              style={{ width: `${downloadProgress}%` }}
              data-testid="audio-download-progress"
            />
            {/* Playback progress bar (green) - foreground layer */}
            <div 
              className={`absolute top-0 left-0 h-full rounded-full transition-all duration-100 ${
                isDisabled 
                  ? 'bg-gray-500' 
                  : 'bg-gradient-to-r from-green-500 to-green-600'
              }`}
              style={{ width: `${playbackPercent}%` }}
              data-testid="audio-playback-progress"
            />
          </div>
          
          {/* Status indicators */}
          <div className="flex justify-between items-center text-xs">
            <div className="flex items-center gap-2">
              <span className="text-gray-600">{formatTime(currentTime)}</span>
              {/* Download indicator */}
              {(isLoading || isDownloading) && (
                <span className="flex items-center gap-1 text-blue-600" data-testid="audio-download-status">
                  {isLoading ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Download className="h-3 w-3" />
                  )}
                  <span>{isLoading ? 'Đang kết nối...' : `Đang tải ${downloadProgress}%`}</span>
                </span>
              )}
              {error && (
                <span className="text-red-500 text-xs">{error}</span>
              )}
            </div>
            <span className={`${isPlaying ? 'text-green-600 font-medium' : 'text-gray-500'}`}>
              {isDisabled ? 'Đã phát xong' : isPlaying ? 'Đang phát...' : formatTime(duration)}
            </span>
          </div>

          {/* Legend for dual progress bars */}
          {(isDownloading || downloadProgress < 100) && downloadProgress > 0 && (
            <div className="flex items-center gap-4 text-xs text-gray-500">
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                <span>Đã tải: {downloadProgress}%</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-green-500"></div>
                <span>Đang phát</span>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={toggleMute}
            className="h-8 w-8 text-gray-600 hover:text-gray-900"
            data-testid="exam-audio-mute-btn"
          >
            {isMuted || volume === 0 ? (
              <VolumeX className="h-4 w-4" />
            ) : (
              <Volume2 className="h-4 w-4" />
            )}
          </Button>
          
          <div className="w-20">
            <Slider
              value={[isMuted ? 0 : volume]}
              min={0}
              max={1}
              step={0.1}
              onValueChange={handleVolumeChange}
              className="cursor-pointer"
              data-testid="exam-audio-volume"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
