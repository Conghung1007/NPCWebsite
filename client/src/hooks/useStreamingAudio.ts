import { useState, useRef, useCallback, useEffect } from "react";

interface StreamInfo {
  url: string;
  contentLength: number | null;
  contentType: string;
  supportsRange: boolean;
}

interface StreamingAudioState {
  isLoading: boolean;
  isDownloading: boolean;
  isReady: boolean;
  downloadProgress: number;
  error: string | null;
  totalSize: number;
  downloadedSize: number;
}

interface UseStreamingAudioOptions {
  chunkSize?: number;
  autoPlay?: boolean;
  onReady?: () => void;
  onError?: (error: string) => void;
  onDownloadComplete?: () => void;
}

const DEFAULT_CHUNK_SIZE = 512 * 1024; // 512KB chunks

export function useStreamingAudio(
  audioUrl: string | null,
  options: UseStreamingAudioOptions = {}
) {
  const {
    chunkSize = DEFAULT_CHUNK_SIZE,
    autoPlay = false,
    onReady,
    onError,
    onDownloadComplete,
  } = options;

  const [state, setState] = useState<StreamingAudioState>({
    isLoading: false,
    isDownloading: false,
    isReady: false,
    downloadProgress: 0,
    error: null,
    totalSize: 0,
    downloadedSize: 0,
  });

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mediaSourceRef = useRef<MediaSource | null>(null);
  const sourceBufferRef = useRef<SourceBuffer | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const chunksQueueRef = useRef<ArrayBuffer[]>([]);
  const isAppendingRef = useRef(false);
  const streamInfoRef = useRef<StreamInfo | null>(null);
  const downloadCompleteRef = useRef(false);
  const objectUrlRef = useRef<string | null>(null);
  const currentUrlRef = useRef<string | null>(null);
  const isStreamingActiveRef = useRef(false);

  const resetStreamState = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }

    if (mediaSourceRef.current) {
      if (mediaSourceRef.current.readyState === 'open') {
        try {
          mediaSourceRef.current.endOfStream();
        } catch (e) {
          // Ignore errors when ending stream
        }
      }
      mediaSourceRef.current = null;
    }

    sourceBufferRef.current = null;
    chunksQueueRef.current = [];
    isAppendingRef.current = false;
    downloadCompleteRef.current = false;
    streamInfoRef.current = null;
    isStreamingActiveRef.current = false;
    currentUrlRef.current = null;

    setState({
      isLoading: false,
      isDownloading: false,
      isReady: false,
      downloadProgress: 0,
      error: null,
      totalSize: 0,
      downloadedSize: 0,
    });
  }, []);

  const appendNextChunk = useCallback(() => {
    const sourceBuffer = sourceBufferRef.current;
    const queue = chunksQueueRef.current;

    if (!sourceBuffer || isAppendingRef.current || queue.length === 0) {
      return;
    }

    if (sourceBuffer.updating) {
      return;
    }

    isAppendingRef.current = true;
    const chunk = queue.shift()!;

    try {
      sourceBuffer.appendBuffer(chunk);
    } catch (error) {
      console.error('Error appending buffer:', error);
      isAppendingRef.current = false;
    }
  }, []);

  const downloadChunks = useCallback(async (streamInfo: StreamInfo) => {
    const { url, contentLength, supportsRange } = streamInfo;

    if (!supportsRange || !contentLength) {
      // Fallback: download entire file at once (for files without range support)
      setState(prev => ({ ...prev, isDownloading: true }));
      
      try {
        const response = await fetch(url, { signal: abortControllerRef.current?.signal });
        if (!response.ok) throw new Error('Failed to download audio');
        
        const arrayBuffer = await response.arrayBuffer();
        chunksQueueRef.current.push(arrayBuffer);
        
        setState(prev => ({
          ...prev,
          downloadedSize: arrayBuffer.byteLength,
          downloadProgress: 100,
          isDownloading: false,
        }));
        
        downloadCompleteRef.current = true;
        appendNextChunk();
        onDownloadComplete?.();
      } catch (error: any) {
        if (error.name !== 'AbortError') {
          setState(prev => ({ ...prev, error: error.message, isDownloading: false }));
          onError?.(error.message);
        }
      }
      return;
    }

    // Chunked download with Range requests
    setState(prev => ({
      ...prev,
      isDownloading: true,
      totalSize: contentLength,
    }));

    let downloadedBytes = 0;
    const totalBytes = contentLength;

    while (downloadedBytes < totalBytes) {
      if (abortControllerRef.current?.signal.aborted) {
        break;
      }

      const start = downloadedBytes;
      const end = Math.min(start + chunkSize - 1, totalBytes - 1);

      try {
        const response = await fetch(url, {
          headers: {
            'Range': `bytes=${start}-${end}`,
          },
          signal: abortControllerRef.current?.signal,
        });

        if (!response.ok && response.status !== 206) {
          throw new Error(`Failed to download chunk: ${response.status}`);
        }

        const chunk = await response.arrayBuffer();
        downloadedBytes += chunk.byteLength;

        chunksQueueRef.current.push(chunk);
        
        const progress = Math.round((downloadedBytes / totalBytes) * 100);
        setState(prev => ({
          ...prev,
          downloadedSize: downloadedBytes,
          downloadProgress: progress,
        }));

        // Try to append chunks while downloading
        appendNextChunk();
      } catch (error: any) {
        if (error.name !== 'AbortError') {
          console.error('Error downloading chunk:', error);
          setState(prev => ({ ...prev, error: error.message, isDownloading: false }));
          onError?.(error.message);
          return;
        }
        break;
      }
    }

    downloadCompleteRef.current = true;
    setState(prev => ({ ...prev, isDownloading: false }));
    onDownloadComplete?.();

    // Ensure all remaining chunks are appended
    appendNextChunk();
  }, [chunkSize, appendNextChunk, onDownloadComplete, onError]);

  const initMediaSource = useCallback((streamInfo: StreamInfo, audio: HTMLAudioElement) => {
    const mediaSource = new MediaSource();
    mediaSourceRef.current = mediaSource;

    const objectUrl = URL.createObjectURL(mediaSource);
    objectUrlRef.current = objectUrl;
    audio.src = objectUrl;

    mediaSource.addEventListener('sourceopen', () => {
      try {
        // Try different MIME types for better browser compatibility
        let mimeType = streamInfo.contentType;
        
        // For MP3 files, use a compatible MIME type
        if (mimeType === 'audio/mpeg' || mimeType.includes('mp3')) {
          // Check if the browser supports audio/mpeg
          if (MediaSource.isTypeSupported('audio/mpeg')) {
            mimeType = 'audio/mpeg';
          } else if (MediaSource.isTypeSupported('audio/mp3')) {
            mimeType = 'audio/mp3';
          } else {
            // Fallback: use regular audio element instead of MediaSource
            if (objectUrlRef.current) {
              URL.revokeObjectURL(objectUrlRef.current);
              objectUrlRef.current = null;
            }
            audio.src = streamInfo.url;
            setState(prev => ({ ...prev, isReady: true, downloadProgress: 100 }));
            onReady?.();
            if (autoPlay) {
              audio.play().catch(console.error);
            }
            return;
          }
        }

        const sourceBuffer = mediaSource.addSourceBuffer(mimeType);
        sourceBufferRef.current = sourceBuffer;

        sourceBuffer.addEventListener('updateend', () => {
          isAppendingRef.current = false;
          
          // Mark as ready once we have some buffer
          setState(prev => {
            if (!prev.isReady && sourceBuffer.buffered.length > 0) {
              onReady?.();
              if (autoPlay && audioRef.current) {
                audioRef.current.play().catch(console.error);
              }
              return { ...prev, isReady: true };
            }
            return prev;
          });

          // Continue appending if we have more chunks
          if (chunksQueueRef.current.length > 0) {
            appendNextChunk();
          } else if (downloadCompleteRef.current && mediaSource.readyState === 'open') {
            // All chunks appended and download complete
            try {
              mediaSource.endOfStream();
            } catch (e) {
              // Ignore errors
            }
          }
        });

        sourceBuffer.addEventListener('error', (e) => {
          console.error('SourceBuffer error:', e);
          setState(prev => ({ ...prev, error: 'Buffer error' }));
        });

        // Start downloading chunks
        downloadChunks(streamInfo);
      } catch (error) {
        console.error('Error initializing MediaSource:', error);
        // Fallback: use regular audio element
        if (objectUrlRef.current) {
          URL.revokeObjectURL(objectUrlRef.current);
          objectUrlRef.current = null;
        }
        audio.src = streamInfo.url;
        setState(prev => ({ ...prev, isReady: true, downloadProgress: 100 }));
        onReady?.();
      }
    });

    mediaSource.addEventListener('sourceended', () => {
      console.log('MediaSource ended');
    });

    mediaSource.addEventListener('error', (e) => {
      console.error('MediaSource error:', e);
      // Fallback to direct URL
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
      if (streamInfo.url) {
        audio.src = streamInfo.url;
        setState(prev => ({ ...prev, isReady: true, downloadProgress: 100 }));
        onReady?.();
      }
    });
  }, [autoPlay, downloadChunks, appendNextChunk, onReady]);

  const startStreaming = useCallback(async (audio: HTMLAudioElement, url: string) => {
    // Guard: don't start if already active for the same URL
    if (isStreamingActiveRef.current && currentUrlRef.current === url) {
      return;
    }

    // Reset previous stream state
    resetStreamState();
    
    isStreamingActiveRef.current = true;
    currentUrlRef.current = url;
    
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    abortControllerRef.current = new AbortController();

    try {
      // Get stream info from our API
      const response = await fetch(`/api/audio/stream-info?url=${encodeURIComponent(url)}`, {
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error('Failed to get stream info');
      }

      const streamInfo: StreamInfo = await response.json();
      streamInfoRef.current = streamInfo;

      setState(prev => ({
        ...prev,
        isLoading: false,
        totalSize: streamInfo.contentLength || 0,
      }));

      // Check if MediaSource is supported
      if ('MediaSource' in window && MediaSource.isTypeSupported('audio/mpeg')) {
        initMediaSource(streamInfo, audio);
      } else {
        // Fallback: use regular audio element with direct download progress tracking
        audio.src = streamInfo.url;
        setState(prev => ({ ...prev, isReady: true, downloadProgress: 100 }));
        onReady?.();
        if (autoPlay) {
          audio.play().catch(console.error);
        }
      }
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.error('Error starting stream:', error);
        setState(prev => ({ ...prev, isLoading: false, error: error.message }));
        onError?.(error.message);
        
        // Fallback: try direct URL
        audio.src = url;
        setState(prev => ({ ...prev, isReady: true, downloadProgress: 100 }));
        onReady?.();
      }
    }
  }, [autoPlay, resetStreamState, initMediaSource, onReady, onError]);

  // Cleanup on unmount only
  useEffect(() => {
    return () => {
      resetStreamState();
    };
  }, []);

  // Start streaming when both URL and audio element are available
  useEffect(() => {
    const audio = audioRef.current;
    
    if (audioUrl && audio) {
      // Only start if URL changed or not currently streaming
      if (currentUrlRef.current !== audioUrl) {
        startStreaming(audio, audioUrl);
      }
    } else if (!audioUrl && isStreamingActiveRef.current) {
      resetStreamState();
    }
  }, [audioUrl, startStreaming, resetStreamState]);

  const setAudioElement = useCallback((element: HTMLAudioElement | null) => {
    const prevElement = audioRef.current;
    audioRef.current = element;
    
    // Start streaming when audio element is first provided and we have a URL
    if (element && !prevElement && audioUrl && !isStreamingActiveRef.current) {
      startStreaming(element, audioUrl);
    }
  }, [audioUrl, startStreaming]);

  const abort = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, []);

  const cleanup = useCallback(() => {
    resetStreamState();
  }, [resetStreamState]);

  return {
    ...state,
    setAudioElement,
    abort,
    cleanup,
  };
}
