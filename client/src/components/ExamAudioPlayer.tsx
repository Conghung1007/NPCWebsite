import { useState, useRef, useEffect, useCallback } from "react";
import { Play, Pause, Volume2, VolumeX } from "lucide-react";
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
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [playCountDisplay, setPlayCountDisplay] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isDisabled, setIsDisabled] = useState(false);

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
      setPlayCountDisplay(playCountRef.current);
      
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
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('seeking', handleSeeking);

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('seeking', handleSeeking);
    };
  }, [maxPlays, onPlayComplete, handleSeeking]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  const handlePlayPause = () => {
    const audio = audioRef.current;
    if (!audio || isDisabled || isExhaustedRef.current) return;

    if (isPlaying) {
      audio.pause();
    } else {
      if (playCountRef.current >= maxPlays) {
        return;
      }
      audio.play().catch(console.error);
    }
  };

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

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className={`bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl p-4 shadow-sm border ${className}`}>
      <audio ref={audioRef} src={src} preload="metadata" />
      
      <div className="flex items-center gap-4">
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={handlePlayPause}
          disabled={isDisabled}
          className={`h-12 w-12 rounded-full transition-all ${
            isDisabled 
              ? 'bg-gray-200 text-gray-400 cursor-not-allowed' 
              : isPlaying 
                ? 'bg-red-100 hover:bg-red-200 text-red-600 border-red-300' 
                : 'bg-green-100 hover:bg-green-200 text-green-600 border-green-300'
          }`}
          data-testid="exam-audio-play-btn"
        >
          {isPlaying ? (
            <Pause className="h-5 w-5" />
          ) : (
            <Play className="h-5 w-5 ml-0.5" />
          )}
        </Button>

        <div className="flex-1 space-y-2">
          <div className="relative h-2 bg-gray-200 rounded-full overflow-hidden">
            <div 
              className="absolute top-0 left-0 h-full bg-gradient-to-r from-green-500 to-green-600 rounded-full transition-all duration-100"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          
          <div className="flex justify-between text-xs text-gray-500">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
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
