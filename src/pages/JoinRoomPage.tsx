import React, { useState, useEffect, useRef } from 'react';
import { useCineMate } from '../context/CineMateContext';
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  Volume2,
  ArrowRight,
  AlertCircle,
  Sparkles,
} from 'lucide-react';

export const JoinRoomPage: React.FC = () => {
  const {
    joinRoom,
    preferences,
  } = useCineMate();

  const [roomId, setRoomId] = useState('');
  const [displayName, setDisplayName] = useState(preferences.displayName || 'Guest');
  const [password, setPassword] = useState('');
  const [cameraActive, setCameraActive] = useState(true);
  const [micActive, setMicActive] = useState(true);
  const [previewStream, setPreviewStream] = useState<MediaStream | null>(null);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [audioMeterLevel, setAudioMeterLevel] = useState<number>(0);
  const [isJoining, setIsJoining] = useState(false);

  const videoPreviewRef = useRef<HTMLVideoElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const meterIntervalRef = useRef<any>(null);

  // Auto-detect room ID from URL query params `?room=abc` or hash `#room=abc`
  useEffect(() => {
    const extractRoomId = () => {
      // 1. Check query parameter: ?room=...
      const params = new URLSearchParams(window.location.search);
      const roomParam = params.get('room');
      if (roomParam && roomParam.trim()) {
        setRoomId(roomParam.trim());
        return;
      }

      // 2. Check hash: #room=... or #/room/... or #abc-123
      const hash = window.location.hash;
      if (hash) {
        const match = hash.match(/room=([a-zA-Z0-9\-_]+)/) || hash.match(/#\/?([a-zA-Z0-9\-_]+)/);
        if (match && match[1] && match[1] !== 'join-room') {
          setRoomId(match[1].trim());
        }
      }
    };

    extractRoomId();
    window.addEventListener('hashchange', extractRoomId);
    window.addEventListener('popstate', extractRoomId);
    return () => {
      window.removeEventListener('hashchange', extractRoomId);
      window.removeEventListener('popstate', extractRoomId);
    };
  }, []);

  // Initialize preview stream
  useEffect(() => {
    let active = true;

    async function initPreview() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });

        if (!active) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        setPreviewStream(stream);
        setPermissionError(null);

        if (videoPreviewRef.current) {
          videoPreviewRef.current.srcObject = stream;
        }

        // Setup audio meter visualizer
        try {
          const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
          if (AudioCtx) {
            const ctx = new AudioCtx();
            audioContextRef.current = ctx;
            const source = ctx.createMediaStreamSource(stream);
            const analyser = ctx.createAnalyser();
            analyser.fftSize = 128;
            source.connect(analyser);

            const buffer = new Uint8Array(analyser.frequencyBinCount);
            meterIntervalRef.current = setInterval(() => {
              analyser.getByteFrequencyData(buffer);
              let sum = 0;
              for (let i = 0; i < buffer.length; i++) sum += buffer[i];
              const avg = sum / buffer.length;
              setAudioMeterLevel(Math.min(100, Math.round(avg * 1.5)));
            }, 100);
          }
        } catch (e) {
          console.warn('Audio meter setup fallback', e);
        }
      } catch (err: any) {
        console.warn('Preview media error:', err);
        setPermissionError(
          'Camera/Mic access was denied or not found. You can still join and enable it later!'
        );
      }
    }

    initPreview();

    return () => {
      active = false;
      if (meterIntervalRef.current) clearInterval(meterIntervalRef.current);
      if (audioContextRef.current) {
        try {
          audioContextRef.current.close();
        } catch (e) {
          // Ignore
        }
      }
      if (previewStream) {
        previewStream.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  const toggleLocalCam = () => {
    const newState = !cameraActive;
    setCameraActive(newState);
    if (previewStream) {
      previewStream.getVideoTracks().forEach((t) => (t.enabled = newState));
    }
  };

  const toggleLocalMic = () => {
    const newState = !micActive;
    setMicActive(newState);
    if (previewStream) {
      previewStream.getAudioTracks().forEach((t) => (t.enabled = newState));
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomId.trim()) return;
    setIsJoining(true);

    try {
      await joinRoom(roomId.trim(), displayName.trim(), password ? password : undefined);
    } catch (err) {
      console.error('Failed to join room', err);
      setIsJoining(false);
    }
  };

  return (
    <div className="min-h-screen py-12 px-4 sm:px-6 flex items-center justify-center relative bg-[#0B0A10] bg-grain">
      {/* Background glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[400px] bg-purple-600/15 rounded-full blur-[140px] pointer-events-none -z-10" />

      <div className="w-full max-w-4xl glass-panel rounded-3xl p-6 sm:p-10 border border-purple-500/25 shadow-2xl relative overflow-hidden grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
        {/* Left Side: Hardware Preview & Test */}
        <div className="flex flex-col items-center">
          <div className="relative w-full aspect-video rounded-2xl bg-[#12111A] border border-white/10 overflow-hidden shadow-inner flex items-center justify-center">
            {cameraActive && !permissionError ? (
              <video
                ref={videoPreviewRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover -scale-x-100"
              />
            ) : (
              <div className="flex flex-col items-center justify-center text-center p-4">
                <div className="w-16 h-16 rounded-full bg-purple-500/20 text-purple-300 flex items-center justify-center mb-2 font-bold text-2xl">
                  {displayName.charAt(0).toUpperCase()}
                </div>
                <span className="text-xs text-gray-400">Camera preview off</span>
              </div>
            )}

            {/* Quick controls over video */}
            <div className="absolute bottom-3 inset-x-0 flex items-center justify-center gap-3 z-10">
              <button
                type="button"
                onClick={toggleLocalMic}
                className={`p-2.5 rounded-xl text-xs backdrop-blur-md border transition-all cursor-pointer ${
                  micActive
                    ? 'bg-black/60 hover:bg-black/80 text-white border-white/20'
                    : 'bg-red-500 text-white border-red-400'
                }`}
                title={micActive ? 'Mute' : 'Unmute'}
              >
                {micActive ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
              </button>

              <button
                type="button"
                onClick={toggleLocalCam}
                className={`p-2.5 rounded-xl text-xs backdrop-blur-md border transition-all cursor-pointer ${
                  cameraActive
                    ? 'bg-black/60 hover:bg-black/80 text-white border-white/20'
                    : 'bg-red-500 text-white border-red-400'
                }`}
                title={cameraActive ? 'Turn off camera' : 'Turn on camera'}
              >
                {cameraActive ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Live Mic Audio Meter */}
          <div className="w-full mt-4 p-3 rounded-xl bg-black/30 border border-white/10 flex items-center gap-3">
            <Volume2 className="w-4 h-4 text-purple-400 shrink-0" />
            <div className="flex-1">
              <div className="flex items-center justify-between text-[10px] text-gray-400 mb-1">
                <span>Microphone Level</span>
                <span className={audioMeterLevel > 15 ? 'text-emerald-400' : 'text-gray-500'}>
                  {audioMeterLevel > 15 ? 'Receiving Voice' : 'Silent'}
                </span>
              </div>
              <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-purple-500 to-emerald-400 rounded-full transition-all duration-100"
                  style={{ width: `${audioMeterLevel}%` }}
                />
              </div>
            </div>
          </div>

          {permissionError && (
            <div className="mt-3 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-200 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{permissionError}</span>
            </div>
          )}
        </div>

        {/* Right Side: Join Form */}
        <div>
          <div className="mb-6">
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-purple-300 bg-purple-500/10 border border-purple-500/20 px-3 py-1 rounded-full mb-2">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Pre-Join Room Lobby</span>
            </div>
            <h2 className="font-heading font-extrabold text-2xl text-white">Join Your Person</h2>
            <p className="text-xs text-purple-200/70 mt-1">
              Connect to your private movie room in one click.
            </p>
          </div>

          <form onSubmit={handleJoin} className="space-y-4">
            {/* Room ID */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-purple-300/80 mb-1">
                Room ID or Code
              </label>
              <input
                type="text"
                required
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                placeholder="e.g. abc-123-xyz"
                className="w-full bg-[#12111A] border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-purple-500 transition-colors font-mono"
              />
            </div>

            {/* Display Name */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-purple-300/80 mb-1">
                Your Display Name
              </label>
              <input
                type="text"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g. Sarah"
                className="w-full bg-[#12111A] border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-purple-500 transition-colors"
              />
            </div>

            {/* Optional Room Password */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-purple-300/80 mb-1">
                Room Password (If required)
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Leave blank if no password"
                className="w-full bg-[#12111A] border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-purple-500 transition-colors"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isJoining || !roomId.trim()}
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-purple-600 via-indigo-600 to-pink-500 hover:from-purple-500 hover:to-pink-400 text-white font-semibold text-base shadow-xl shadow-purple-600/30 hover:scale-101 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <span>{isJoining ? 'Connecting...' : 'Join Movie Night 🍿'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
