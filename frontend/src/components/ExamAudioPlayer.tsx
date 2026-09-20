import { useState, useRef, useEffect, useCallback } from "react";
import { Volume2, VolumeX, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

interface ExamAudioPlayerProps {
  src: string;
  maxPlays?: number;
  className?: string;
  onPlayComplete?: () => void;
  /** Attempt autoplay when ready (often blocked — one-shot Start button is the fallback). */
  autoPlay?: boolean;
}

const EXAM_AUDIO_PLAY_EVENT = "exam-audio-play";

/**
 * Exam listening player (JLPT-style):
 * - Plays once (maxPlays)
 * - No pause / seek / replay for the candidate
 * - If browser blocks autoplay: one "Bắt đầu nghe" tap starts playback, then controls lock
 * - Mute + volume remain available
 */
export function ExamAudioPlayer({
  src,
  maxPlays = 1,
  className = "",
  onPlayComplete,
  autoPlay = true,
}: ExamAudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const lastValidTimeRef = useRef(0);
  const playCountRef = useRef(0);
  const isPlayingRef = useRef(false);
  const isExhaustedRef = useRef(false);
  const hasStartedRef = useRef(false);
  const onPlayCompleteRef = useRef(onPlayComplete);
  onPlayCompleteRef.current = onPlayComplete;

  const [isPlaying, setIsPlaying] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isDisabled, setIsDisabled] = useState(false);
  const [isLoading, setIsLoading] = useState(Boolean(src?.trim()));
  const [bufferedPercent, setBufferedPercent] = useState(0);
  const [loadError, setLoadError] = useState(false);
  const [needsUserStart, setNeedsUserStart] = useState(false);

  const resolvedSrc = typeof src === "string" ? src.trim() : "";

  useEffect(() => {
    playCountRef.current = 0;
    isPlayingRef.current = false;
    isExhaustedRef.current = false;
    hasStartedRef.current = false;
    lastValidTimeRef.current = 0;
    setIsPlaying(false);
    setHasStarted(false);
    setDuration(0);
    setCurrentTime(0);
    setIsDisabled(false);
    setBufferedPercent(0);
    setLoadError(false);
    setNeedsUserStart(false);
    setIsLoading(Boolean(resolvedSrc));
  }, [resolvedSrc]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !resolvedSrc) return;

    const tryAutoPlay = () => {
      if (
        !autoPlay ||
        hasStartedRef.current ||
        isExhaustedRef.current ||
        playCountRef.current >= maxPlays
      ) {
        return;
      }
      void audio.play().then(
        () => {
          // play event handler marks started
        },
        () => {
          // Autoplay blocked — show one-shot start button (not pause)
          setNeedsUserStart(true);
          setIsLoading(false);
        },
      );
    };

    const syncFromElement = () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        setDuration(audio.duration);
      }
      if (audio.readyState >= 2) {
        setIsLoading(false);
        setLoadError(false);
      }
      if (audio.buffered.length > 0 && audio.duration > 0) {
        const bufferedEnd = audio.buffered.end(audio.buffered.length - 1);
        setBufferedPercent(Math.round((bufferedEnd / audio.duration) * 100));
      }
    };

    const handleLoadedMetadata = () => syncFromElement();

    const handleCanPlay = () => {
      setIsLoading(false);
      setLoadError(false);
      syncFromElement();
    };

    const handleCanPlayThrough = () => {
      setIsLoading(false);
      setLoadError(false);
      tryAutoPlay();
    };

    const handleProgress = () => syncFromElement();

    const handlePlaying = () => {
      setIsLoading(false);
      setLoadError(false);
      setNeedsUserStart(false);
    };

    const handleLoadStart = () => {
      if (!isExhaustedRef.current && !hasStartedRef.current) {
        setIsLoading(true);
        setBufferedPercent(0);
      }
    };

    const handleTimeUpdate = () => {
      // Always advance "allowed" cursor while playing; block seeking backward/forward
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
        setNeedsUserStart(false);
      }

      lastValidTimeRef.current = 0;
      onPlayCompleteRef.current?.();
    };

    const handlePlay = () => {
      if (isExhaustedRef.current || playCountRef.current >= maxPlays) {
        audio.pause();
        audio.currentTime = 0;
        return;
      }

      window.dispatchEvent(
        new CustomEvent(EXAM_AUDIO_PLAY_EVENT, { detail: audio }),
      );

      hasStartedRef.current = true;
      setHasStarted(true);
      setNeedsUserStart(false);
      isPlayingRef.current = true;
      setIsPlaying(true);
    };

    const handlePause = () => {
      isPlayingRef.current = false;
      setIsPlaying(false);

      // Candidate has no Pause control. If the browser interrupted mid-play
      // (tab switch, system, etc.), offer a one-shot resume — not a toggle.
      if (
        hasStartedRef.current &&
        !isExhaustedRef.current &&
        playCountRef.current < maxPlays &&
        !audio.ended
      ) {
        setNeedsUserStart(true);
      }
    };

    const handleError = () => {
      if (isExhaustedRef.current || !audio.getAttribute("src")) return;
      setIsLoading(false);
      setLoadError(true);
      isPlayingRef.current = false;
      setIsPlaying(false);
    };

    const handleSeeking = () => {
      const attemptedTime = audio.currentTime;
      const lastValid = lastValidTimeRef.current;
      if (Math.abs(attemptedTime - lastValid) > 0.5) {
        audio.currentTime = lastValid;
      }
    };

    const handleOtherPlay = (e: Event) => {
      const other = (e as CustomEvent<HTMLAudioElement>).detail;
      // Do not pause an in-progress exam track for another player —
      // only prevent *starting* overlap by pausing idle others before they start.
      // If this track already started, keep it; if not started, stay paused.
      if (other && other !== audio && !hasStartedRef.current && !audio.paused) {
        audio.pause();
      }
    };

    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("canplay", handleCanPlay);
    audio.addEventListener("canplaythrough", handleCanPlayThrough);
    audio.addEventListener("progress", handleProgress);
    audio.addEventListener("playing", handlePlaying);
    audio.addEventListener("loadstart", handleLoadStart);
    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("play", handlePlay);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("seeking", handleSeeking);
    audio.addEventListener("error", handleError);
    window.addEventListener(EXAM_AUDIO_PLAY_EVENT, handleOtherPlay);

    syncFromElement();
    if (audio.readyState >= 2) {
      tryAutoPlay();
    }

    return () => {
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("canplay", handleCanPlay);
      audio.removeEventListener("canplaythrough", handleCanPlayThrough);
      audio.removeEventListener("progress", handleProgress);
      audio.removeEventListener("playing", handlePlaying);
      audio.removeEventListener("loadstart", handleLoadStart);
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("seeking", handleSeeking);
      audio.removeEventListener("error", handleError);
      window.removeEventListener(EXAM_AUDIO_PLAY_EVENT, handleOtherPlay);
      audio.pause();
    };
  }, [resolvedSrc, maxPlays, autoPlay]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  const handleVolumeChange = (value: number[]) => {
    const newVolume = value[0] ?? 0;
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
  };

  const toggleMute = () => {
    setIsMuted((prev) => !prev);
  };

  /** One-shot start / resume — never exposes pause to the candidate. */
  const handleStartListen = useCallback(() => {
    const audio = audioRef.current;
    if (
      !audio ||
      !resolvedSrc ||
      isDisabled ||
      isExhaustedRef.current ||
      playCountRef.current >= maxPlays ||
      audio.ended
    ) {
      return;
    }

    setLoadError(false);
    void audio.play().catch((err) => {
      console.error("Exam audio start failed:", err);
      setLoadError(true);
      setNeedsUserStart(true);
    });
  }, [resolvedSrc, isDisabled, maxPlays]);

  const formatTime = (time: number) => {
    if (!isFinite(time) || time < 0) return "0:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const playbackPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
  const showStartButton =
    needsUserStart && !isPlaying && !isDisabled && !loadError;

  if (!resolvedSrc) {
    return null;
  }

  return (
    <div
      className={`bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl p-4 shadow-sm border ${className}`}
    >
      <audio
        ref={audioRef}
        src={resolvedSrc}
        preload="auto"
        playsInline
      />

      <div className="flex items-center gap-4">
        {showStartButton ? (
          <Button
            type="button"
            size="sm"
            onClick={handleStartListen}
            className="shrink-0 gap-1.5"
            data-testid="exam-audio-start-btn"
          >
            <Play className="h-4 w-4" />
            {hasStarted ? "Tiếp tục nghe" : "Bắt đầu nghe"}
          </Button>
        ) : (
          <div
            className="h-10 w-10 shrink-0 rounded-md flex items-center justify-center bg-white/70 border text-gray-500"
            aria-hidden
            title={
              isDisabled
                ? "Đã phát xong"
                : isPlaying || hasStarted
                  ? "Đang phát"
                  : isLoading
                    ? "Đang tải"
                    : undefined
            }
          >
            <Play className="h-4 w-4 opacity-50" />
          </div>
        )}

        <div className="flex-1 space-y-2 min-w-0">
          <div className="relative h-3 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="absolute top-0 left-0 h-full rounded-full transition-all duration-300 bg-gradient-to-r from-blue-400 to-blue-500"
              style={{ width: `${bufferedPercent}%` }}
              data-testid="audio-download-progress"
            />
            <div
              className={`absolute top-0 left-0 h-full rounded-full transition-all duration-100 ${
                isDisabled
                  ? "bg-gray-500"
                  : "bg-gradient-to-r from-green-500 to-green-600"
              }`}
              style={{ width: `${playbackPercent}%` }}
              data-testid="audio-playback-progress"
            />
          </div>

          <div className="flex justify-between items-center text-xs gap-2">
            <span className="text-gray-600">{formatTime(currentTime)}</span>
            <span
              className={
                loadError
                  ? "text-red-600 font-medium"
                  : isDisabled
                    ? "text-gray-500"
                    : "text-gray-500"
              }
            >
              {loadError
                ? "Lỗi tải"
                : isDisabled
                  ? "Đã phát xong"
                  : isLoading
                    ? "…"
                    : formatTime(duration)}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={toggleMute}
            disabled={isDisabled}
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
              disabled={isDisabled}
              className="cursor-pointer"
              data-testid="exam-audio-volume"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
