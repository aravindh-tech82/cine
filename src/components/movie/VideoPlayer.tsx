import React, { useRef, useState, useEffect } from 'react';
import { useCineMate } from '../../context/CineMateContext';
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  Film,
} from 'lucide-react';
import { formatTime } from '../../utils/helpers';

export const VideoPlayer: React.FC = () => {
  const {
    currentUser,
    localMovieMetadata,
    remoteMovieStream,
    attachLocalVideoElement,
    attachRemoteVideoElement,
    playbackState,
    playMovie,
    pauseMovie,
    seekMovie,
    skipMovie,
    setMovieVolume,
    toggleMovieMute,
    activeReactions,
    sendReaction,
    toggleCamera,
    toggleMic,
    room,
  } = useCineMate();

  const containerRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsTimeoutRef = useRef<any>(null);

  const [areControlsVisible, setAreControlsVisible] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hoverSeekTime, setHoverSeekTime] = useState<number | null>(null);
  const [hoverSeekPos, setHoverSeekPos] = useState<number>(0);

  const isHost = currentUser.role === 'host';

  // Attach video element to context
  useEffect(() => {
    if (!videoRef.current) return;
    if (isHost) {
      attachLocalVideoElement(videoRef.current);
    } else {
      attachRemoteVideoElement(videoRef.current);
    }
  }, [isHost, attachLocalVideoElement, attachRemoteVideoElement]);

  const handleTimeUpdate = () => {
    // Updates smoothly on native events
  };

  // Autohide controls logic
  const handleMouseMove = () => {
    setAreControlsVisible(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      if (playbackState.isPlaying) {
        setAreControlsVisible(false);
      }
    }, 3200);
  };

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is focused inside an input or textarea
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          if (playbackState.isPlaying) pauseMovie();
          else playMovie();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          skipMovie(-10);
          break;
        case 'ArrowRight':
          e.preventDefault();
          skipMovie(10);
          break;
        case 'KeyF':
          e.preventDefault();
          toggleFullscreen();
          break;
        case 'KeyM':
          e.preventDefault();
          toggleMovieMute();
          break;
        case 'KeyC':
          e.preventDefault();
          toggleCamera();
          break;
        case 'KeyV':
          e.preventDefault();
          toggleMic();
          break;
        case 'Digit1':
          e.preventDefault();
          sendReaction('❤️');
          break;
        case 'Digit2':
          e.preventDefault();
          sendReaction('😂');
          break;
        case 'Digit3':
          e.preventDefault();
          sendReaction('😭');
          break;
        case 'Digit4':
          e.preventDefault();
          sendReaction('😱');
          break;
        case 'Digit5':
          e.preventDefault();
          sendReaction('🔥');
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [playbackState.isPlaying, pauseMovie, playMovie, skipMovie, toggleMovieMute, toggleCamera, toggleMic, sendReaction]);

  // Toggle Fullscreen
  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(console.warn);
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(console.warn);
      setIsFullscreen(false);
    }
  };

  // Seek bar hover
  const handleSeekHover = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    const dur = videoRef.current?.duration || playbackState.duration || 100;
    setHoverSeekTime(pos * dur);
    setHoverSeekPos(e.clientX - rect.left);
  };

  const handleSeekClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    const dur = videoRef.current?.duration || playbackState.duration || 100;
    const targetTime = Math.max(0, Math.min(dur, pos * dur));
    seekMovie(targetTime);
  };

  const currentDuration = videoRef.current?.duration || playbackState.duration || 0;
  const currentVideoTime = videoRef.current?.currentTime || playbackState.currentTime || 0;
  const progressPercent = currentDuration > 0 ? (currentVideoTime / currentDuration) * 100 : 0;

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      className="relative w-full h-full min-h-[440px] max-h-[82vh] bg-black rounded-3xl overflow-hidden shadow-2xl border border-purple-500/15 flex items-center justify-center group select-none"
    >
      {/* Actual HTML5 Video Element */}
      {isHost ? (
        localMovieMetadata?.objectUrl ? (
          <video
            ref={videoRef}
            src={localMovieMetadata.objectUrl}
            playsInline
            onTimeUpdate={handleTimeUpdate}
            onClick={() => (playbackState.isPlaying ? pauseMovie() : playMovie())}
            className="w-full h-full object-contain cursor-pointer"
          />
        ) : (
          <div className="flex flex-col items-center justify-center p-8 text-center text-purple-200/70">
            <div className="w-16 h-16 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center mb-4 text-purple-300">
              <Film className="w-8 h-8" />
            </div>
            <h3 className="font-heading font-semibold text-lg text-white">No Movie Loaded</h3>
            <p className="text-xs text-gray-400 mt-1 max-w-sm">
              Please go back to the lobby or select a movie file from your computer to start streaming.
            </p>
          </div>
        )
      ) : (
        /* Guest View */
        <video
          ref={videoRef}
          playsInline
          autoPlay
          onTimeUpdate={handleTimeUpdate}
          onClick={() => (playbackState.isPlaying ? pauseMovie() : playMovie())}
          className="w-full h-full object-contain cursor-pointer"
        />
      )}

      {/* Guest Waiting State if stream not yet flowing */}
      {!isHost && !remoteMovieStream && (
        <div className="absolute inset-0 bg-[#0B0A10]/90 backdrop-blur-md flex flex-col items-center justify-center p-8 text-center z-10">
          <div className="w-16 h-16 rounded-full bg-purple-500/20 border border-purple-500/40 flex items-center justify-center mb-4 animate-pulse">
            <Film className="w-8 h-8 text-purple-300" />
          </div>
          <h3 className="font-heading font-bold text-lg text-white">
            Connecting to Host's Stream...
          </h3>
          <p className="text-xs text-purple-200/70 mt-2 max-w-md leading-relaxed">
            Your host is setting up the movie. Once they hit play, the movie will stream directly peer-to-peer to your screen in real time 🍿
          </p>
          <div className="mt-4 flex items-center gap-2 text-[11px] text-emerald-400 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span>WebRTC Direct Channel Ready</span>
          </div>
        </div>
      )}

      {/* Floating Reactions Overlay */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-20">
        {activeReactions.map((reaction) => (
          <div
            key={reaction.id}
            style={{
              left: `${reaction.x}%`,
              bottom: `${100 - reaction.y}%`,
            }}
            className="absolute text-5xl sm:text-6xl animate-float-up drop-shadow-xl select-none"
          >
            {reaction.emoji}
          </div>
        ))}
      </div>

      {/* Movie Title Banner (Top Left) */}
      <div
        className={`absolute top-4 left-6 z-25 flex items-center gap-2.5 px-3.5 py-1.5 rounded-full glass-control transition-opacity duration-300 ${
          areControlsVisible ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <span className="text-sm">🍿</span>
        <span className="font-medium text-xs text-white truncate max-w-[240px]">
          {room?.movieTitle || localMovieMetadata?.name || 'Private Cinema Night'}
        </span>
        <div className="w-px h-3 bg-white/20" />
        <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-semibold tracking-wide">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          {playbackState.syncStatus === 'synced' ? 'Synced' : 'Synchronizing'}
        </span>
      </div>

      {/* Big Play/Pause Center Indicator on Click/Hover */}
      {!playbackState.isPlaying && (
        <button
          onClick={playMovie}
          className="absolute z-20 p-6 rounded-full bg-purple-600/80 hover:bg-purple-500 text-white backdrop-blur-xl border border-white/20 shadow-2xl transition-all hover:scale-110 cursor-pointer"
        >
          <Play className="w-10 h-10 fill-white translate-x-0.5" />
        </button>
      )}

      {/* Custom Video Controls Bar (Bottom) */}
      <div
        className={`absolute bottom-0 inset-x-0 z-30 p-4 sm:p-6 bg-gradient-to-t from-black/95 via-black/70 to-transparent transition-opacity duration-300 ${
          areControlsVisible ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Seek Bar Slider */}
        <div
          onMouseMove={handleSeekHover}
          onMouseLeave={() => setHoverSeekTime(null)}
          onClick={handleSeekClick}
          className="relative w-full h-3 group/seek flex items-center cursor-pointer mb-3"
        >
          {/* Background track */}
          <div className="w-full h-1 group-hover/seek:h-2 bg-white/20 rounded-full overflow-hidden transition-all">
            <div
              className="h-full bg-gradient-to-r from-purple-500 via-indigo-400 to-pink-500 relative rounded-full"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {/* Scrubber thumb */}
          <div
            className="absolute w-3.5 h-3.5 bg-white rounded-full shadow-lg border border-purple-500 scale-0 group-hover/seek:scale-100 transition-transform -translate-x-1/2 pointer-events-none"
            style={{ left: `${progressPercent}%` }}
          />

          {/* Hover timestamp tooltip */}
          {hoverSeekTime !== null && (
            <div
              className="absolute -top-7 transform -translate-x-1/2 bg-black/90 border border-purple-500/30 text-[10px] font-mono text-purple-200 px-2 py-0.5 rounded shadow pointer-events-none"
              style={{ left: `${hoverSeekPos}px` }}
            >
              {formatTime(hoverSeekTime)}
            </div>
          )}
        </div>

        {/* Buttons Row */}
        <div className="flex items-center justify-between text-white">
          <div className="flex items-center gap-3 sm:gap-4">
            {/* Play / Pause */}
            <button
              onClick={playbackState.isPlaying ? pauseMovie : playMovie}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
              title={playbackState.isPlaying ? 'Pause (Space)' : 'Play (Space)'}
            >
              {playbackState.isPlaying ? (
                <Pause className="w-5 h-5 fill-white" />
              ) : (
                <Play className="w-5 h-5 fill-white" />
              )}
            </button>

            {/* Skip -10s */}
            <button
              onClick={() => skipMovie(-10)}
              className="p-2 text-purple-200/80 hover:text-white transition-colors cursor-pointer"
              title="Rewind 10s (Left Arrow)"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            {/* Skip +10s */}
            <button
              onClick={() => skipMovie(10)}
              className="p-2 text-purple-200/80 hover:text-white transition-colors cursor-pointer"
              title="Forward 10s (Right Arrow)"
            >
              <RotateCw className="w-4 h-4" />
            </button>

            {/* Volume Control */}
            <div className="flex items-center gap-2 group/vol">
              <button
                onClick={toggleMovieMute}
                className="p-2 text-purple-200/80 hover:text-white transition-colors cursor-pointer"
              >
                {playbackState.isMuted || playbackState.volume === 0 ? (
                  <VolumeX className="w-4 h-4 text-red-400" />
                ) : (
                  <Volume2 className="w-4 h-4" />
                )}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={playbackState.isMuted ? 0 : playbackState.volume}
                onChange={(e) => setMovieVolume(parseFloat(e.target.value))}
                className="w-16 sm:w-20 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-purple-500"
              />
            </div>

            {/* Time Stamp Display */}
            <div className="text-xs font-mono text-purple-200/70 hidden sm:block">
              <span className="text-white font-medium">{formatTime(currentVideoTime)}</span>
              <span className="mx-1 text-gray-500">/</span>
              <span>{formatTime(currentDuration)}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Quick Reactions toolbar right on player */}
            <div className="hidden md:flex items-center gap-1 px-2 py-1 rounded-xl glass-control">
              {['❤️', '😂', '😭', '😱', '🔥', '🍿'].map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => sendReaction(emoji)}
                  className="hover:scale-130 transition-transform p-1 text-sm cursor-pointer"
                  title={`React ${emoji}`}
                >
                  {emoji}
                </button>
              ))}
            </div>

            {/* Fullscreen Button */}
            <button
              onClick={toggleFullscreen}
              className="p-2 text-purple-200/80 hover:text-white transition-colors cursor-pointer"
              title="Toggle Fullscreen (F)"
            >
              {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
