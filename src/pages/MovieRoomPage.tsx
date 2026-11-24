import React, { useState } from 'react';
import { useCineMate } from '../context/CineMateContext';
import { VideoPlayer } from '../components/movie/VideoPlayer';
import { WebcamPanel } from '../components/webcam/WebcamPanel';
import { ChatPanel } from '../components/chat/ChatPanel';
import { SpecialInteractionsOverlay } from '../components/common/SpecialInteractionsOverlay';
import {
  Film,
  Heart,
  Settings,
  Copy,
  Check,
  LogOut,
} from 'lucide-react';
import { SpecialInteractionType } from '../types';

export const MovieRoomPage: React.FC = () => {
  const {
    room,
    endMovieNight,
    setIsSettingsOpen,
    triggerSpecialInteraction,
    sendReaction,
    connectionStats,
  } = useCineMate();

  const [copied, setCopied] = useState(false);
  const [showInteractionsMenu, setShowInteractionsMenu] = useState(false);

  const inviteUrl = `${window.location.origin}/#room=${room?.id || ''}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const interactions: { type: SpecialInteractionType; label: string; icon: string; desc: string }[] = [
    { type: 'heart-burst', label: 'Heart Burst', icon: '💖', desc: 'Exploding shower of floating hearts' },
    { type: 'virtual-hug', label: 'Virtual Hug', icon: '🤗', desc: 'Warm animated hug between your avatars' },
    { type: 'send-popcorn', label: 'Toss Popcorn', icon: '🍿', desc: 'Toss popcorn kernels to your friend' },
    { type: 'miss-you', label: 'Miss You', icon: '🥺', desc: 'Sweet message across the miles' },
    { type: 'hand-holding', label: 'Hold Hands', icon: '🤝', desc: 'Hold hands with a glowing heart' },
    { type: 'heartbeat', label: 'Heartbeat', icon: '💓', desc: 'Synchronized visual pulse' },
  ];

  return (
    <div className="min-h-screen bg-[#0B0A10] text-[#F7F5FA] flex flex-col relative overflow-hidden select-none">
      {/* Special Interactions Render Overlay */}
      <SpecialInteractionsOverlay />

      {/* Top Bar */}
      <header className="z-30 w-full glass-panel border-b border-purple-500/10 px-4 sm:px-6 py-2.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          {/* Left: Movie info & Logo */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-purple-600 to-pink-500 p-[1px] flex items-center justify-center">
                <div className="w-full h-full bg-[#0B0A10] rounded-[7px] flex items-center justify-center">
                  <Film className="w-4 h-4 text-purple-400" />
                </div>
              </div>
              <div className="hidden sm:block">
                <h1 className="font-heading font-bold text-sm text-white truncate max-w-[200px]">
                  {room?.name || 'CineMate'}
                </h1>
                <p className="text-[10px] text-purple-200/50">
                  {room?.movieTitle || 'Movie Night'}
                </p>
              </div>
            </div>

            {/* Connection Quality Pill */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.03] border border-white/10 text-[11px]">
              <span
                className={`w-2 h-2 rounded-full ${
                  connectionStats.step === 'connected'
                    ? 'bg-emerald-400 animate-pulse'
                    : connectionStats.step === 'failed'
                    ? 'bg-rose-500'
                    : 'bg-amber-400 animate-ping'
                }`}
              />
              <span className="text-gray-300 capitalize">
                {connectionStats.step === 'connected' ? 'Connected' : connectionStats.stepMessage || connectionStats.step}
              </span>
              <span className="text-purple-300 font-mono text-[10px] hidden sm:inline">
                ({connectionStats.latency}ms)
              </span>
            </div>
          </div>

          {/* Right Action Buttons */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Quick Share Link */}
            <button
              onClick={handleCopyLink}
              className="hidden sm:flex items-center gap-1 text-xs text-purple-200/80 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 px-3 py-1.5 rounded-xl transition-all cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Invite'}</span>
            </button>

            {/* Cute Interactions Dropdown Button */}
            <div className="relative">
              <button
                onClick={() => setShowInteractionsMenu((prev) => !prev)}
                className="flex items-center gap-1.5 text-xs text-white bg-gradient-to-r from-pink-600/80 to-purple-600/80 hover:from-pink-500 hover:to-purple-500 border border-pink-400/30 px-3 py-1.5 rounded-xl shadow-lg transition-all cursor-pointer"
              >
                <Heart className="w-3.5 h-3.5 fill-white animate-pulse" />
                <span className="hidden sm:inline">Interactions</span>
              </button>

              {/* Interactions Dropdown */}
              {showInteractionsMenu && (
                <div className="absolute right-0 top-full mt-2 w-72 glass-panel rounded-2xl border border-pink-500/30 shadow-2xl p-2 z-50 animate-fade-in">
                  <div className="px-3 py-1.5 border-b border-white/10 text-[11px] font-bold uppercase tracking-wider text-pink-300">
                    Cute Couple Interactions
                  </div>
                  <div className="space-y-1 mt-1">
                    {interactions.map((act) => (
                      <button
                        key={act.type}
                        onClick={() => {
                          triggerSpecialInteraction(act.type);
                          setShowInteractionsMenu(false);
                        }}
                        className="w-full flex items-center gap-2.5 p-2 rounded-xl hover:bg-white/10 text-left transition-colors cursor-pointer group"
                      >
                        <span className="text-xl group-hover:scale-125 transition-transform">{act.icon}</span>
                        <div>
                          <span className="font-semibold text-xs text-white block">{act.label}</span>
                          <span className="text-[10px] text-gray-400 line-clamp-1">{act.desc}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Settings */}
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="p-2 text-purple-200/70 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-colors cursor-pointer"
              title="Settings"
            >
              <Settings className="w-4 h-4" />
            </button>

            {/* End Movie Night */}
            <button
              onClick={() => endMovieNight()}
              className="flex items-center gap-1.5 text-xs font-semibold text-rose-200 hover:text-white bg-rose-950/40 hover:bg-rose-900/60 border border-rose-500/30 px-3 py-1.5 rounded-xl transition-all cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">End Night</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Watching Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 flex flex-col gap-4 relative">
        {/* Video Player */}
        <div className="flex-1 w-full flex items-center justify-center">
          <VideoPlayer />
        </div>

        {/* Floating Webcam PiP Panel */}
        <WebcamPanel />

        {/* Live Chat Panel Drawer */}
        <ChatPanel />
      </main>

      {/* Bottom Floating Bar with Fast Reaction Shortcuts */}
      <footer className="z-20 py-2.5 px-4 max-w-xl mx-auto flex items-center justify-center gap-2">
        <div className="glass-panel px-4 py-1.5 rounded-full border border-purple-500/20 shadow-xl flex items-center gap-2">
          <span className="text-[11px] text-purple-300 font-semibold tracking-wide mr-1 hidden sm:inline">
            Quick Reactions:
          </span>
          {[
            { key: '1', emoji: '❤️' },
            { key: '2', emoji: '😂' },
            { key: '3', emoji: '😭' },
            { key: '4', emoji: '😱' },
            { key: '5', emoji: '🔥' },
            { key: '6', emoji: '🍿' },
            { key: '7', emoji: '✨' },
          ].map((item) => (
            <button
              key={item.key}
              onClick={() => sendReaction(item.emoji)}
              className="hover:scale-130 transition-transform p-1 text-base cursor-pointer relative group"
              title={`React ${item.emoji} (Key: ${item.key})`}
            >
              <span>{item.emoji}</span>
              <span className="absolute -bottom-2 right-0 text-[8px] font-mono text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity">
                {item.key}
              </span>
            </button>
          ))}
        </div>
      </footer>
    </div>
  );
};
