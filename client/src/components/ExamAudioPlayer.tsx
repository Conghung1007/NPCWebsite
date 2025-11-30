import { useState, useRef, useEffect, useCallback } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

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
  
  // Loading/buffering state
  const [isLoading, setIsLoading] = useState(true);
  const [bufferedPercent, setBufferedPercent] = useState(0);

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

    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
      setIsLoading(false);
    };

    const handleCanPlayThrough = () => {
      setIsLoading(false);
      if (!hasAutoPlayedRef.current && playCountRef.current < maxPlays) {
        hasAutoPlayedRef.current = true;
        audio.play().catch(console.error);
      }
    };

    const handleProgress = () => {
      if (audio.buffered.length > 0 && audio.duration > 0) {
        const bufferedEnd = audio.buffered.end(audio.buffered.length - 1);
        const percent = Math.round((bufferedEnd / audio.duration) * 100);
        setBufferedPercent(percent);
      }
    };

    const handleWaiting = () => {
      // Audio is buffering
    };

    const handlePlaying = () => {
      setIsLoading(false);
    };

    const handleLoadStart = () => {
      setIsLoading(true);
      setBufferedPercent(0);
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

    const handleError = (e: Event) => {
      console.error('Audio error:', e);
      setIsLoading(false);
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('canplaythrough', handleCanPlayThrough);
    audio.addEventListener('progress', handleProgress);
    audio.addEventListener('waiting', handleWaiting);
    audio.addEventListener('playing', handlePlaying);
    audio.addEventListener('loadstart', handleLoadStart);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('seeking', handleSeeking);
    audio.addEventListener('error', handleError);

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('canplaythrough', handleCanPlayThrough);
      audio.removeEventListener('progress', handleProgress);
      audio.removeEventListener('waiting', handleWaiting);
      audio.removeEventListener('playing', handlePlaying);
      audio.removeEventListener('loadstart', handleLoadStart);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('seeking', handleSeeking);
      audio.removeEventListener('error', handleError);
    };
  }, [maxPlays, onPlayComplete, handleSeeking]);

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

  const playbackPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className={`bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl p-4 shadow-sm border ${className}`}>
      <audio ref={audioRef} src={src} preload="auto" />
      
      <div className="flex items-center gap-4">
        <div className="flex-1 space-y-2">
          {/* Dual progress bars container */}
          <div className="relative h-3 bg-gray-200 rounded-full overflow-hidden">
            {/* Buffered/Download progress bar (blue) - background layer */}
            <div 
              className="absolute top-0 left-0 h-full rounded-full transition-all duration-300 bg-gradient-to-r from-blue-400 to-blue-500"
              style={{ width: `${bufferedPercent}%` }}
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
          
          {/* Time indicators */}
          <div className="flex justify-between items-center text-xs">
            <span className="text-gray-600">{formatTime(currentTime)}</span>
            <span className={`${isPlaying ? 'text-green-600 font-medium' : 'text-gray-500'}`}>
              {isDisabled ? 'Đã phát xong' : formatTime(duration)}
            </span>
          </div>
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
