import React, { useRef, useEffect, useState } from 'react';
import { useCineMate } from '../../context/CineMateContext';
import {
  Mic,
  MicOff,
  Video as VideoIcon,
  VideoOff,
  Maximize2,
  Minimize2,
  Volume2,
} from 'lucide-react';
import { getAvatarGradient } from '../../utils/helpers';

interface ParticipantCardProps {
  name: string;
  isMe: boolean;
  cameraOn: boolean;
  micOn: boolean;
  speaking: boolean;
  mood?: string;
  stream: MediaStream | null;
  onToggleCam?: () => void;
  onToggleMic?: () => void;
  isMinimal?: boolean;
}

const ParticipantCard: React.FC<ParticipantCardProps> = ({
  name,
  isMe,
  cameraOn,
  micOn,
  speaking,
  mood,
  stream,
  onToggleCam,
  onToggleMic,
  isMinimal = false,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (videoRef.current && stream && cameraOn) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(console.warn);
    }
  }, [stream, cameraOn]);

  const gradient = getAvatarGradient(name);

  return (
    <div
      className={`relative rounded-2xl overflow-hidden border transition-all ${
        speaking
          ? 'border-purple-400 shadow-lg shadow-purple-500/40 speaking-pulse ring-2 ring-purple-400/50'
          : 'border-white/10 hover:border-white/20'
      } bg-[#191722] flex flex-col justify-between ${
        isMinimal ? 'w-40 h-28' : 'w-full h-full min-h-[140px]'
      }`}
    >
      {/* Video or Avatar */}
      <div className="absolute inset-0 w-full h-full bg-[#12111A] flex items-center justify-center">
        {cameraOn && stream ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted={isMe} // Always mute local video to prevent echo
            className="w-full h-full object-cover -scale-x-100"
          />
        ) : (
          <div className="flex flex-col items-center justify-center gap-1.5 p-3">
            <div
              className={`w-12 h-12 rounded-full bg-gradient-to-tr ${gradient} flex items-center justify-center text-white font-bold text-lg shadow-md border border-white/20`}
            >
              {name ? name.charAt(0).toUpperCase() : '?'}
            </div>
            <span className="text-[10px] text-purple-200/50 flex items-center gap-1">
              <VideoOff className="w-2.5 h-2.5" /> Camera off
            </span>
          </div>
        )}
      </div>

      {/* Top Overlay Badge */}
      <div className="relative z-10 flex items-center justify-between p-2.5 bg-gradient-to-b from-black/70 to-transparent">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-semibold text-white drop-shadow-md truncate max-w-[90px]">
            {isMe ? `${name} (You)` : name}
          </span>
          {mood && (
            <span className="text-[10px] bg-white/10 backdrop-blur-md px-1.5 py-0.5 rounded-full text-purple-200 border border-white/10">
              {mood}
            </span>
          )}
        </div>

        {/* Audio status indicator */}
        <div className="flex items-center gap-1">
          {speaking && (
            <span className="flex items-center gap-1 text-[9px] bg-purple-500/90 text-white px-1.5 py-0.5 rounded-full font-medium">
              <Volume2 className="w-2.5 h-2.5 animate-pulse" /> Speaking
            </span>
          )}
          <span
            className={`p-1 rounded-full text-[10px] ${
              micOn ? 'bg-black/50 text-emerald-400' : 'bg-red-500/80 text-white'
            }`}
          >
            {micOn ? <Mic className="w-3 h-3" /> : <MicOff className="w-3 h-3" />}
          </span>
        </div>
      </div>

      {/* Bottom Controls (Only for me) */}
      {isMe && onToggleCam && onToggleMic && (
        <div className="relative z-10 p-2 bg-gradient-to-t from-black/80 to-transparent flex items-center justify-center gap-2">
          <button
            onClick={onToggleMic}
            className={`p-1.5 rounded-xl text-xs backdrop-blur-md border transition-all cursor-pointer ${
              micOn
                ? 'bg-white/10 hover:bg-white/20 text-white border-white/10'
                : 'bg-red-500/80 hover:bg-red-600 text-white border-red-400/50'
            }`}
            title={micOn ? 'Mute Mic' : 'Unmute Mic'}
          >
            {micOn ? <Mic className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={onToggleCam}
            className={`p-1.5 rounded-xl text-xs backdrop-blur-md border transition-all cursor-pointer ${
              cameraOn
                ? 'bg-white/10 hover:bg-white/20 text-white border-white/10'
                : 'bg-red-500/80 hover:bg-red-600 text-white border-red-400/50'
            }`}
            title={cameraOn ? 'Turn Camera Off' : 'Turn Camera On'}
          >
            {cameraOn ? <VideoIcon className="w-3.5 h-3.5" /> : <VideoOff className="w-3.5 h-3.5" />}
          </button>
        </div>
      )}
    </div>
  );
};

export const WebcamPanel: React.FC = () => {
  const {
    currentUser,
    friendUser,
    localWebcamStream,
    remoteWebcamStream,
    toggleCamera,
    toggleMic,
    preferences,
  } = useCineMate();

  const [isMinimized, setIsMinimized] = useState(false);
  const layout = preferences.webcamLayout || 'floating-pip';

  if (isMinimized) {
    return (
      <div className="fixed bottom-6 left-6 z-30">
        <button
          onClick={() => setIsMinimized(false)}
          className="flex items-center gap-2 px-3.5 py-2 glass-panel rounded-full border border-purple-500/30 text-xs text-purple-200 hover:text-white hover:border-purple-400 transition-all cursor-pointer shadow-xl"
        >
          <VideoIcon className="w-3.5 h-3.5 text-purple-400" />
          <span>Show Webcams</span>
          <Maximize2 className="w-3 h-3 ml-1" />
        </button>
      </div>
    );
  }

  // Floating PiP Layout
  if (layout === 'floating-pip') {
    return (
      <div className="fixed bottom-6 left-6 z-30 flex flex-col gap-2.5 p-2 glass-panel rounded-2xl border border-purple-500/20 shadow-2xl animate-fade-in w-72 sm:w-80">
        {/* Bar */}
        <div className="flex items-center justify-between px-2 pt-1 pb-1">
          <span className="text-[11px] font-semibold tracking-wider uppercase text-purple-300/80 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Live Webcams
          </span>
          <button
            onClick={() => setIsMinimized(true)}
            className="p-1 rounded-lg text-purple-200/60 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="Minimize"
          >
            <Minimize2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Video Containers */}
        <div className="grid grid-cols-2 gap-2 h-36">
          {/* Friend's Webcam */}
          {friendUser ? (
            <ParticipantCard
              name={friendUser.name}
              isMe={false}
              cameraOn={friendUser.cameraOn}
              micOn={friendUser.micOn}
              speaking={friendUser.speaking}
              mood={friendUser.mood}
              stream={remoteWebcamStream}
            />
          ) : (
            <div className="h-full rounded-2xl border border-dashed border-white/15 bg-white/[0.02] flex flex-col items-center justify-center text-center p-3">
              <span className="text-xl animate-bounce mb-1">🍿</span>
              <p className="text-[10px] text-gray-400">Waiting for friend...</p>
            </div>
          )}

          {/* My Webcam */}
          <ParticipantCard
            name={currentUser.name}
            isMe={true}
            cameraOn={currentUser.cameraOn}
            micOn={currentUser.micOn}
            speaking={currentUser.speaking}
            mood={currentUser.mood}
            stream={localWebcamStream}
            onToggleCam={toggleCamera}
            onToggleMic={toggleMic}
          />
        </div>
      </div>
    );
  }

  // Right sidebar layout or side-by-side
  return (
    <div className="w-full flex flex-col gap-3 p-3 glass-panel rounded-2xl border border-purple-500/20">
      <div className="flex items-center justify-between pb-1 border-b border-white/10">
        <span className="text-xs font-semibold uppercase text-purple-300/80 flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          Together
        </span>
        <button
          onClick={() => setIsMinimized(true)}
          className="text-gray-400 hover:text-white"
        >
          <Minimize2 className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 h-44">
        {friendUser ? (
          <ParticipantCard
            name={friendUser.name}
            isMe={false}
            cameraOn={friendUser.cameraOn}
            micOn={friendUser.micOn}
            speaking={friendUser.speaking}
            mood={friendUser.mood}
            stream={remoteWebcamStream}
          />
        ) : (
          <div className="h-full rounded-2xl border border-dashed border-white/15 bg-white/[0.02] flex flex-col items-center justify-center text-center p-4">
            <span className="text-2xl animate-bounce mb-1">🍿</span>
            <p className="text-xs text-gray-400">Waiting for friend...</p>
          </div>
        )}
        <ParticipantCard
          name={currentUser.name}
          isMe={true}
          cameraOn={currentUser.cameraOn}
          micOn={currentUser.micOn}
          speaking={currentUser.speaking}
          mood={currentUser.mood}
          stream={localWebcamStream}
          onToggleCam={toggleCamera}
          onToggleMic={toggleMic}
        />
      </div>
    </div>
  );
};
