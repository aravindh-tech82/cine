import React, { useState, useEffect } from 'react';
import { useCineMate } from '../context/CineMateContext';
import {
  Film,
  Sparkles,
  Lock,
  Copy,
  Check,
  Share2,
  QrCode,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import QRCode from 'qrcode';
import { RoomTheme } from '../types';

export const CreateRoomPage: React.FC = () => {
  const { createRoom, preferences, setCurrentView } = useCineMate();

  const [displayName, setDisplayName] = useState(preferences.displayName || 'Alex');
  const [roomName, setRoomName] = useState('Our Cozy Movie Night 🍿');
  const [password, setPassword] = useState('');
  const [isPasswordProtected, setIsPasswordProtected] = useState(false);
  const [selectedTheme, setSelectedTheme] = useState<RoomTheme>(preferences.theme);
  const [copied, setCopied] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [createdRoomId, setCreatedRoomId] = useState<string | null>(null);

  const previewLink = createdRoomId
    ? `${window.location.origin}/?room=${createdRoomId}#room=${createdRoomId}`
    : `${window.location.origin}/?room=cinemate-preview#room=cinemate-preview`;

  useEffect(() => {
    if (previewLink) {
      QRCode.toDataURL(previewLink, {
        width: 180,
        margin: 1.5,
        color: {
          dark: '#F7F5FA',
          light: '#191722',
        },
      })
        .then(setQrDataUrl)
        .catch(console.warn);
    }
  }, [previewLink]);

  const handleCopy = () => {
    navigator.clipboard.writeText(previewLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleWhatsAppShare = () => {
    const text = encodeURIComponent(
      `Hey! Join our private CineMate movie room here: ${previewLink} 🍿`
    );
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
  };

  const handleCreateAndEnter = (e: React.FormEvent) => {
    e.preventDefault();
    const finalPassword = isPasswordProtected ? password : undefined;
    const roomId = createRoom(roomName, displayName, finalPassword, selectedTheme);
    setCreatedRoomId(roomId);
  };

  const themes: { id: RoomTheme; name: string; color: string }[] = [
    { id: 'midnight', name: 'Midnight Cinema', color: '#A78BFA' },
    { id: 'purple', name: 'Purple Dream', color: '#C084FC' },
    { id: 'cozy', name: 'Cozy Bedroom', color: '#FB923C' },
    { id: 'pink', name: 'Pink Romance', color: '#F472B6' },
    { id: 'retro', name: 'Retro Cinema', color: '#F59E0B' },
    { id: 'galaxy', name: 'Galaxy Night', color: '#60A5FA' },
  ];

  return (
    <div className="min-h-screen py-12 px-4 sm:px-6 flex items-center justify-center relative bg-[#0B0A10] bg-grain">
      {/* Background glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[400px] bg-purple-600/15 rounded-full blur-[140px] pointer-events-none -z-10" />

      <div className="w-full max-w-xl glass-panel rounded-3xl p-6 sm:p-8 border border-purple-500/25 shadow-2xl relative overflow-hidden">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-purple-300 mb-3 shadow-inner">
            <Film className="w-6 h-6" />
          </div>
          <h1 className="font-heading font-extrabold text-2xl sm:text-3xl text-white">
            Create Your Private Cinema
          </h1>
          <p className="text-xs sm:text-sm text-purple-200/70 mt-1.5">
            A secure, private sanctuary made exclusively for two people.
          </p>
        </div>

        <form onSubmit={handleCreateAndEnter} className="space-y-5">
          {/* Your Display Name */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-purple-300/80 mb-1.5">
              Your Name
            </label>
            <input
              type="text"
              required
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g. Alex"
              className="w-full bg-[#12111A] border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-purple-500 transition-colors"
            />
          </div>

          {/* Room Name */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-purple-300/80 mb-1.5">
              Room Name
            </label>
            <input
              type="text"
              required
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              placeholder="e.g. Friday Movie Date"
              className="w-full bg-[#12111A] border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-purple-500 transition-colors"
            />
          </div>

          {/* Room Theme Picker */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-purple-300/80 mb-2">
              Atmosphere / Theme
            </label>
            <div className="grid grid-cols-3 gap-2">
              {themes.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSelectedTheme(t.id)}
                  className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center gap-1.5 ${
                    selectedTheme === t.id
                      ? 'border-purple-400 bg-purple-500/20 text-white font-semibold'
                      : 'border-white/10 bg-white/[0.02] text-gray-400 hover:border-white/20'
                  }`}
                >
                  <span
                    className="w-3.5 h-3.5 rounded-full shadow"
                    style={{ backgroundColor: t.color }}
                  />
                  <span className="text-[11px] truncate w-full">{t.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Optional Password Protection */}
          <div className="pt-2">
            <div className="flex items-center justify-between mb-2">
              <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-purple-300/80 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isPasswordProtected}
                  onChange={(e) => setIsPasswordProtected(e.target.checked)}
                  className="rounded accent-purple-500 cursor-pointer w-4 h-4"
                />
                <span>Password Protect Room</span>
              </label>
              <span className="text-[10px] text-purple-200/50">Optional</span>
            </div>

            {isPasswordProtected && (
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter a secret password"
                className="w-full bg-[#12111A] border border-purple-500/40 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-purple-400 animate-fade-in"
              />
            )}
          </div>

          {/* Privacy Notice */}
          <div className="p-3.5 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <p className="text-xs text-purple-200/80 leading-relaxed">
              <strong>Private 2-person room:</strong> Only the person with your link can join. Your movie is streamed directly peer-to-peer and never uploaded to any server.
            </p>
          </div>

          {/* Submit */}
          <button
            type="submit"
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-purple-600 via-indigo-600 to-pink-500 hover:from-purple-500 hover:to-pink-400 text-white font-semibold text-base shadow-xl shadow-purple-600/30 hover:scale-101 transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            <span>Create & Enter Lobby</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
