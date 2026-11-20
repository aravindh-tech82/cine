import React from 'react';
import { useCineMate } from '../../context/CineMateContext';
import { Film, Heart, Settings, Bookmark, Plus, LogIn, Sparkles } from 'lucide-react';
import { RoomTheme } from '../../types';

export const Navbar: React.FC = () => {
  const {
    currentView,
    setCurrentView,
    room,
    setIsSettingsOpen,
    preferences,
    updatePreferences,
    watchlist,
  } = useCineMate();

  const themes: { id: RoomTheme; name: string; icon: string }[] = [
    { id: 'midnight', name: 'Midnight', icon: '🌌' },
    { id: 'purple', name: 'Dream', icon: '💜' },
    { id: 'cozy', name: 'Cozy', icon: '🕯️' },
    { id: 'pink', name: 'Romance', icon: '🌸' },
    { id: 'retro', name: 'Retro', icon: '🎞️' },
    { id: 'galaxy', name: 'Galaxy', icon: '✨' },
  ];

  return (
    <header className="sticky top-0 z-40 w-full glass-panel border-b border-purple-500/10 px-4 lg:px-8 py-3.5 transition-all">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Logo */}
        <button
          onClick={() => (room ? setCurrentView('lobby') : setCurrentView('landing'))}
          className="flex items-center gap-2.5 group text-left cursor-pointer transition-transform hover:scale-102"
        >
          <div className="relative w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-pink-500 p-[1.5px] shadow-lg shadow-purple-500/20 group-hover:shadow-purple-500/40 transition-all">
            <div className="w-full h-full bg-[#0B0A10] rounded-[10px] flex items-center justify-center relative overflow-hidden">
              <Film className="w-5 h-5 text-purple-400 group-hover:text-purple-300 transition-colors" />
              <Heart className="w-3 h-3 text-pink-400 fill-pink-400 absolute bottom-1 right-1 animate-pulse" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-heading font-bold text-xl tracking-tight text-white group-hover:text-purple-200 transition-colors">
                CineMate
              </span>
              <span className="text-sm">🍿</span>
            </div>
            <p className="text-[10px] tracking-wide text-purple-300/60 uppercase font-medium">
              Distance-Free Cinema
            </p>
          </div>
        </button>

        {/* Center Navigation Links */}
        {!room && (
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-purple-200/70">
            <button
              onClick={() => setCurrentView('landing')}
              className={`hover:text-white transition-colors cursor-pointer ${
                currentView === 'landing' ? 'text-purple-400 font-semibold' : ''
              }`}
            >
              Home
            </button>
            <a href="#how-it-works" className="hover:text-white transition-colors">
              How It Works
            </a>
            <a href="#features" className="hover:text-white transition-colors">
              Features
            </a>
            <button
              onClick={() => setCurrentView('watchlist')}
              className={`hover:text-white transition-colors flex items-center gap-1.5 cursor-pointer ${
                currentView === 'watchlist' ? 'text-purple-400 font-semibold' : ''
              }`}
            >
              <Bookmark className="w-4 h-4" />
              Watchlist
              {watchlist.length > 0 && (
                <span className="text-[10px] bg-purple-500/20 text-purple-300 border border-purple-500/30 px-1.5 py-0.5 rounded-full">
                  {watchlist.length}
                </span>
              )}
            </button>
          </nav>
        )}

        {/* Right Action Buttons */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          {/* Theme Quick Selector */}
          <div className="relative group hidden sm:block">
            <button
              className="flex items-center gap-1.5 text-xs text-purple-200/80 bg-purple-950/40 hover:bg-purple-900/40 border border-purple-500/20 rounded-full px-3 py-1.5 transition-colors cursor-pointer"
              title="Change theme vibe"
            >
              <Sparkles className="w-3.5 h-3.5 text-purple-400" />
              <span className="capitalize">{preferences.theme}</span>
            </button>
            <div className="absolute right-0 top-full mt-2 hidden group-hover:flex flex-col gap-1 p-2 bg-[#191722] border border-purple-500/20 rounded-xl shadow-xl w-36 z-50">
              {themes.map((t) => (
                <button
                  key={t.id}
                  onClick={() => updatePreferences({ theme: t.id })}
                  className={`flex items-center justify-between text-xs px-2.5 py-1.5 rounded-lg text-left transition-colors cursor-pointer ${
                    preferences.theme === t.id
                      ? 'bg-purple-500/20 text-purple-300 font-medium'
                      : 'text-gray-300 hover:bg-white/5'
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <span>{t.icon}</span>
                    <span>{t.name}</span>
                  </span>
                  {preferences.theme === t.id && <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />}
                </button>
              ))}
            </div>
          </div>

          {/* Settings Button */}
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="p-2 text-purple-200/70 hover:text-white bg-purple-950/30 hover:bg-purple-900/40 border border-purple-500/20 rounded-full transition-colors cursor-pointer"
            title="Settings"
          >
            <Settings className="w-4 h-4" />
          </button>

          {/* Action CTAs */}
          {!room ? (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentView('join-room')}
                className="hidden sm:inline-flex items-center gap-1.5 text-xs font-medium text-purple-200 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 px-3.5 py-2 rounded-xl transition-all cursor-pointer"
              >
                <LogIn className="w-3.5 h-3.5" />
                Join Room
              </button>
              <button
                onClick={() => setCurrentView('create-room')}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-gradient-to-r from-purple-600 via-indigo-600 to-pink-500 hover:opacity-95 px-4 py-2 rounded-xl shadow-lg shadow-purple-600/25 transition-all hover:scale-102 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Create Room
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="hidden md:inline-flex items-center gap-1.5 text-xs text-purple-300/80 bg-purple-500/10 border border-purple-500/20 px-3 py-1.5 rounded-full">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                {room.name}
              </span>
              {currentView === 'movie-room' && (
                <button
                  onClick={() => setCurrentView('lobby')}
                  className="text-xs text-purple-200/80 hover:text-white bg-purple-900/30 border border-purple-500/30 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                >
                  Back to Lobby
                </button>
              )}
              {currentView === 'lobby' && (
                <button
                  onClick={() => setCurrentView('movie-room')}
                  className="text-xs text-purple-200/80 hover:text-white bg-purple-900/30 border border-purple-500/30 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                >
                  Go to Cinema
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
