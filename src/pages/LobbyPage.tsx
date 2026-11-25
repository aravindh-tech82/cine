import React, { useState, useRef } from 'react';
import { useCineMate } from '../context/CineMateContext';
import {
  Film,
  Sparkles,
  Copy,
  Check,
  Share2,
  QrCode,
  Upload,
  X,
  Play,
  CheckCircle2,
  Circle,
  Clock,
  HardDrive,
  Users,
} from 'lucide-react';
import { UserMood } from '../types';
import { formatTime, formatFileSize, getAvatarGradient } from '../utils/helpers';
import QRCode from 'qrcode';

export const LobbyPage: React.FC = () => {
  const {
    room,
    currentUser,
    friendUser,
    toggleReady,
    isCountdownActive,
    countdownSeconds,
    cancelCountdown,
    updateUserMood,
    selectLocalMovieFile,
    localMovieMetadata,
    setMovieTitle,
    connectionStats,
  } = useCineMate();

  const [copied, setCopied] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [qrCodeData, setQrCodeData] = useState<string>('');
  const [isRenaming, setIsRenaming] = useState(false);
  const [customTitle, setCustomTitle] = useState('');
  const [vibe, setVibe] = useState('Cozy 🕯️');
  const [snacks, setSnacks] = useState<{ [key: string]: boolean }>({
    Popcorn: true,
    'Hot Cocoa': true,
    Nachos: false,
    Candy: false,
  });

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const inviteUrl = `${window.location.origin}/?room=${room?.id || ''}#room=${room?.id || ''}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenQr = async () => {
    try {
      const url = await QRCode.toDataURL(inviteUrl, {
        width: 240,
        margin: 2,
        color: { dark: '#F7F5FA', light: '#191722' },
      });
      setQrCodeData(url);
      setShowQrModal(true);
    } catch (e) {
      console.warn('QR code generation error:', e);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      selectLocalMovieFile(file);
    }
  };

  const moods: UserMood[] = [
    'Romantic',
    'Cozy' as any,
    'Excited',
    'Happy',
    'Emotional',
    'Sleepy',
    'Hungry',
    'Scared',
  ];

  const vibes = [
    'Cozy 🕯️',
    'Romantic 💖',
    'Horror 👻',
    'Comedy 😂',
    'Late-night 🌙',
    'Comfort Movie 🧸',
  ];

  const isHost = currentUser.role === 'host';

  return (
    <div className="min-h-screen py-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto flex flex-col relative bg-[#0B0A10] bg-grain">
      {/* Synchronized 3-2-1 Countdown Overlay */}
      {isCountdownActive && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-2xl flex flex-col items-center justify-center p-6 text-center animate-fade-in">
          <div className="relative mb-6">
            <div className="w-36 h-36 rounded-full bg-gradient-to-tr from-purple-600 via-pink-600 to-indigo-600 p-1 flex items-center justify-center animate-ping">
              <div className="w-full h-full bg-[#0B0A10] rounded-full flex items-center justify-center text-6xl font-extrabold font-heading text-white">
                {countdownSeconds}
              </div>
            </div>
            <div className="absolute inset-0 flex items-center justify-center text-7xl font-extrabold font-heading text-white">
              {countdownSeconds}
            </div>
          </div>
          <h2 className="font-heading font-extrabold text-3xl sm:text-4xl text-white mb-2">
            Starting Your Cinema Night 🍿
          </h2>
          <p className="text-sm text-purple-200/70 max-w-sm mb-6">
            Both of you are ready! Settle in, grab your popcorn, and enjoy the movie together.
          </p>
          <button
            onClick={cancelCountdown}
            className="px-6 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold border border-white/20 transition-all cursor-pointer"
          >
            Cancel Countdown
          </button>
        </div>
      )}

      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-3xl glass-panel border border-purple-500/20 mb-8 shadow-xl">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xl">🍿</span>
            <h1 className="font-heading font-extrabold text-xl sm:text-2xl text-white">
              {room?.name || 'Private Movie Room'}
            </h1>
            <span className="text-[11px] font-mono text-purple-300 bg-purple-500/10 border border-purple-500/20 px-2.5 py-0.5 rounded-full ml-1">
              Room ID: {room?.id}
            </span>
          </div>
          <p className="text-xs text-purple-200/70">
            Your movie night is almost ready · Strict 2-person private room
          </p>

          {/* Real-time Connection Status Indicator */}
          <div className="flex items-center gap-2 mt-2">
            <span
              className={`w-2 h-2 rounded-full ${
                connectionStats.step === 'connected'
                  ? 'bg-emerald-400 animate-pulse'
                  : connectionStats.step === 'failed'
                  ? 'bg-rose-500'
                  : 'bg-amber-400 animate-ping'
              }`}
            />
            <span className="text-[11px] text-purple-200/90 font-medium font-mono">
              Status: {connectionStats.stepMessage || connectionStats.step}
            </span>
            {connectionStats.step === 'connected' && (
              <span className="text-[10px] text-emerald-400/90 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.2 rounded-full">
                WebRTC Direct Channel Ready ({connectionStats.latency}ms)
              </span>
            )}
          </div>
        </div>

        {/* Invite Bar */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopyLink}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-purple-600/30 hover:bg-purple-600/50 border border-purple-500/30 text-xs font-medium text-purple-200 hover:text-white transition-all cursor-pointer"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Link Copied!' : 'Copy Invite Link'}</span>
          </button>

          <button
            onClick={handleOpenQr}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-purple-200 hover:text-white transition-all cursor-pointer"
            title="Scan QR Code to join"
          >
            <QrCode className="w-4 h-4" />
          </button>

          <button
            onClick={() => {
              const text = encodeURIComponent(`Join my private CineMate room: ${inviteUrl} 🍿`);
              window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
            }}
            className="p-2 rounded-xl bg-emerald-600/30 hover:bg-emerald-600/50 border border-emerald-500/30 text-emerald-300 transition-all cursor-pointer"
            title="Share via WhatsApp"
          >
            <Share2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Grid: Left Side (Participants & Readiness) + Right Side (Movie & Checklist) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Participants & Readiness (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="glass-panel p-6 rounded-3xl border border-purple-500/20 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <span className="text-xs font-bold uppercase tracking-wider text-purple-300/80 flex items-center gap-2">
                <Users className="w-4 h-4 text-purple-400" />
                Participants (2 max)
              </span>
              <span className="text-[11px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full font-medium">
                {friendUser ? '2 / 2 Connected' : '1 / 2 (Waiting)'}
              </span>
            </div>

            {/* My Card */}
            <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/10 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-12 h-12 rounded-full bg-gradient-to-tr ${getAvatarGradient(
                      currentUser.name
                    )} border-2 border-white/20 flex items-center justify-center font-bold text-white text-lg shadow-md`}
                  >
                    {currentUser.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-heading font-bold text-white text-sm">
                        {currentUser.name}
                      </span>
                      <span className="text-[10px] bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2 py-0.2 rounded-full font-medium">
                        You ({currentUser.role})
                      </span>
                    </div>
                    <span className="text-xs text-purple-200/60 mt-0.5 flex items-center gap-1">
                      Mood: {currentUser.mood}
                    </span>
                  </div>
                </div>

                {/* Ready Status Badge */}
                <div>
                  {currentUser.isReady ? (
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-semibold">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Ready!
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-white/5 text-gray-400 border border-white/10 text-xs">
                      <Circle className="w-3.5 h-3.5" /> Not Ready
                    </span>
                  )}
                </div>
              </div>

              {/* Mood selector buttons */}
              <div className="pt-2 border-t border-white/5">
                <span className="text-[10px] text-gray-400 block mb-1.5">Pick tonight's mood:</span>
                <div className="flex flex-wrap gap-1.5">
                  {moods.map((m) => (
                    <button
                      key={m}
                      onClick={() => updateUserMood(m)}
                      className={`text-[11px] px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                        currentUser.mood === m
                          ? 'border-purple-400 bg-purple-500/20 text-purple-200 font-semibold'
                          : 'border-white/5 bg-white/[0.02] text-gray-400 hover:text-white'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Friend's Card */}
            <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/10">
              {friendUser ? (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-12 h-12 rounded-full bg-gradient-to-tr ${getAvatarGradient(
                        friendUser.name
                      )} border-2 border-white/20 flex items-center justify-center font-bold text-white text-lg shadow-md`}
                    >
                      {friendUser.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-heading font-bold text-white text-sm">
                          {friendUser.name}
                        </span>
                        <span className="text-[10px] bg-pink-500/20 text-pink-300 border border-pink-500/30 px-2 py-0.2 rounded-full font-medium">
                          {friendUser.role}
                        </span>
                      </div>
                      <span className="text-xs text-purple-200/60 mt-0.5 flex items-center gap-1">
                        Mood: {friendUser.mood}
                      </span>
                    </div>
                  </div>

                  {/* Friend Ready Status */}
                  <div>
                    {friendUser.isReady ? (
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-semibold">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Ready!
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-white/5 text-gray-400 border border-white/10 text-xs">
                        <Circle className="w-3.5 h-3.5" /> Not Ready
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                <div className="py-6 text-center">
                  <div className="w-12 h-12 rounded-full border-2 border-dashed border-purple-400/30 flex items-center justify-center mx-auto mb-2 text-xl animate-bounce">
                    🍿
                  </div>
                  <h4 className="font-semibold text-white text-sm">Waiting for your friend...</h4>
                  <p className="text-xs text-purple-200/60 mt-1 max-w-xs mx-auto">
                    Share your invite link above. As soon as they click it, they will appear here!
                  </p>
                </div>
              )}
            </div>

            {/* Ready Button */}
            <div className="pt-2">
              <button
                onClick={toggleReady}
                className={`w-full py-4 rounded-2xl font-heading font-bold text-base transition-all shadow-xl cursor-pointer flex items-center justify-center gap-2.5 ${
                  currentUser.isReady
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30'
                    : 'bg-gradient-to-r from-purple-600 via-indigo-600 to-pink-500 hover:from-purple-500 hover:to-pink-400 text-white shadow-purple-600/30 hover:scale-101'
                }`}
              >
                {currentUser.isReady ? (
                  <>
                    <CheckCircle2 className="w-5 h-5" />
                    <span>You are Ready! (Click to cancel)</span>
                  </>
                ) : (
                  <>
                    <Play className="w-5 h-5 fill-white" />
                    <span>I'm Ready to Watch 🍿</span>
                  </>
                )}
              </button>
              {currentUser.isReady && !friendUser?.isReady && (
                <p className="text-center text-xs text-purple-200/60 mt-2 animate-pulse">
                  Waiting for your friend to click Ready...
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Local Movie Selection & Movie Night Vibe (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Local Movie Selection */}
          <div className="glass-panel p-6 rounded-3xl border border-purple-500/20 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <span className="text-xs font-bold uppercase tracking-wider text-purple-300/80 flex items-center gap-2">
                <Film className="w-4 h-4 text-purple-400" />
                Local Movie Selection (Peer-to-Peer)
              </span>
              <span className="text-[11px] text-purple-300 font-medium">
                {isHost ? 'Host controls movie file' : 'Streamed from host'}
              </span>
            </div>

            {isHost ? (
              /* Host Movie Picker */
              localMovieMetadata ? (
                /* Selected Movie Card */
                <div className="p-4 rounded-2xl bg-white/[0.02] border border-purple-500/30 flex flex-col sm:flex-row items-center gap-4">
                  {localMovieMetadata.thumbnailUrl ? (
                    <img
                      src={localMovieMetadata.thumbnailUrl}
                      alt="Movie thumbnail"
                      className="w-36 h-24 rounded-xl object-cover border border-white/10 shadow"
                    />
                  ) : (
                    <div className="w-36 h-24 rounded-xl bg-purple-950/40 border border-purple-500/20 flex items-center justify-center text-purple-300">
                      <Film className="w-8 h-8" />
                    </div>
                  )}

                  <div className="flex-1 space-y-1.5 w-full">
                    {isRenaming ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={customTitle}
                          onChange={(e) => setCustomTitle(e.target.value)}
                          className="bg-[#12111A] border border-purple-500 rounded-lg px-2.5 py-1 text-xs text-white flex-1"
                        />
                        <button
                          onClick={() => {
                            if (customTitle.trim()) setMovieTitle(customTitle.trim());
                            setIsRenaming(false);
                          }}
                          className="px-2.5 py-1 bg-purple-600 rounded-lg text-xs font-semibold text-white"
                        >
                          Save
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <h3 className="font-heading font-bold text-base text-white truncate max-w-[220px]">
                          {localMovieMetadata.name}
                        </h3>
                        <button
                          onClick={() => {
                            setCustomTitle(localMovieMetadata.name);
                            setIsRenaming(true);
                          }}
                          className="text-[11px] text-purple-300 hover:text-white underline cursor-pointer"
                        >
                          Rename
                        </button>
                      </div>
                    )}

                    <div className="flex items-center gap-3 text-xs text-purple-200/60 font-mono">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {formatTime(localMovieMetadata.duration)}
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <HardDrive className="w-3.5 h-3.5" />
                        {formatFileSize(localMovieMetadata.size)}
                      </span>
                      {localMovieMetadata.resolution && (
                        <>
                          <span>•</span>
                          <span>{localMovieMetadata.resolution}</span>
                        </>
                      )}
                    </div>

                    <div className="pt-2 flex items-center gap-2">
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="text-xs text-purple-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                      >
                        Choose Different Movie
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                /* Drag & Drop Area */
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="p-8 rounded-2xl border-2 border-dashed border-purple-500/30 hover:border-purple-400 bg-purple-500/[0.03] hover:bg-purple-500/[0.07] transition-all cursor-pointer flex flex-col items-center justify-center text-center group"
                >
                  <div className="w-14 h-14 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-purple-300 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                    <Upload className="w-6 h-6" />
                  </div>
                  <h4 className="font-heading font-bold text-base text-white">
                    Drop your movie file here 🍿
                  </h4>
                  <p className="text-xs text-purple-200/60 mt-1 max-w-sm">
                    Select an MP4, WebM, or MOV file stored on your laptop. Streams directly to your friend with 100% privacy.
                  </p>
                  <span className="mt-3 inline-block px-3 py-1 rounded-full bg-purple-500/10 text-purple-300 text-[11px] font-semibold">
                    Browse Local File
                  </span>
                </div>
              )
            ) : (
              /* Guest Movie Preview Card */
              <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/10 flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-300 shrink-0">
                  <Film className="w-8 h-8" />
                </div>
                <div>
                  <h4 className="font-heading font-bold text-white text-sm">
                    {room?.movieTitle || 'Waiting for host to select movie...'}
                  </h4>
                  <p className="text-xs text-purple-200/60 mt-1">
                    The movie will stream directly from your host's browser to yours over WebRTC. You don't need to download anything.
                  </p>
                </div>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="video/mp4,video/webm,video/ogg,video/quicktime"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>

          {/* Tonight's Vibe & Snack Checklist */}
          <div className="glass-panel p-6 rounded-3xl border border-purple-500/20 space-y-4">
            <span className="text-xs font-bold uppercase tracking-wider text-purple-300/80 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-400" />
              Tonight's Movie Night Vibe
            </span>

            {/* Vibe buttons */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {vibes.map((v) => (
                <button
                  key={v}
                  onClick={() => setVibe(v)}
                  className={`p-2.5 rounded-xl border text-xs font-medium text-center transition-all cursor-pointer ${
                    vibe === v
                      ? 'border-purple-400 bg-purple-500/20 text-white font-semibold'
                      : 'border-white/5 bg-white/[0.02] text-gray-400 hover:text-white'
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>

            {/* Snack checklist */}
            <div className="pt-3 border-t border-white/10">
              <span className="text-xs font-semibold text-purple-200/80 block mb-2">
                Movie Night Snack Checklist:
              </span>
              <div className="grid grid-cols-2 gap-2">
                {Object.keys(snacks).map((snack) => (
                  <label
                    key={snack}
                    className="flex items-center gap-2 text-xs text-gray-300 p-2 rounded-xl bg-white/[0.02] border border-white/5 cursor-pointer hover:border-white/10"
                  >
                    <input
                      type="checkbox"
                      checked={snacks[snack]}
                      onChange={(e) =>
                        setSnacks((prev) => ({ ...prev, [snack]: e.target.checked }))
                      }
                      className="rounded accent-purple-500 w-3.5 h-3.5"
                    />
                    <span>{snack}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* QR Code Modal */}
      {showQrModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
          <div className="glass-panel p-6 rounded-3xl border border-purple-500/30 max-w-sm w-full text-center relative">
            <button
              onClick={() => setShowQrModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-white/10 text-gray-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
            <h3 className="font-heading font-bold text-lg text-white mb-2">Scan to Join Room</h3>
            <p className="text-xs text-purple-200/70 mb-4">
              Have your friend scan this QR code with their phone camera to join instantly.
            </p>
            {qrCodeData && (
              <img
                src={qrCodeData}
                alt="QR Code"
                className="mx-auto rounded-2xl border border-white/20 p-2 bg-white"
              />
            )}
            <button
              onClick={handleCopyLink}
              className="mt-5 w-full py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs rounded-xl"
            >
              Copy Link Instead
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
