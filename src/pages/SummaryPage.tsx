import React, { useState } from 'react';
import { useCineMate } from '../context/CineMateContext';
import {
  Heart,
  Star,
  Film,
  Calendar,
  CheckCircle2,
  Bookmark,
  LogOut,
} from 'lucide-react';
import { formatTime } from '../utils/helpers';
import confetti from 'canvas-confetti';

export const SummaryPage: React.FC = () => {
  const {
    movieSummary,
    currentUser,
    friendUser,
    setCurrentView,
    leaveRoom,
    addToWatchlist,
  } = useCineMate();

  const [rating, setRating] = useState(movieSummary?.userRating || 5);
  const [favoriteMoment, setFavoriteMoment] = useState(
    movieSummary?.favoriteMoment || 'When both of us laughed at the exact same second 😂'
  );
  const [memoryNote, setMemoryNote] = useState(
    movieSummary?.notes || 'Another unforgettable long-distance movie date!'
  );
  const [savedToWatchlist, setSavedToWatchlist] = useState(false);

  const handleSaveToWatchlist = () => {
    if (!movieSummary) return;
    addToWatchlist({
      title: movieSummary.movieTitle,
      description: memoryNote,
      genre: 'Movie Night Memory',
      duration: formatTime(movieSummary.durationWatched),
      rating,
      posterUrl:
        'https://images.unsplash.com/photo-1518173946687-a4c8a383392e?auto=format&fit=crop&w=600&q=80',
      addedBy: currentUser.name,
      watched: true,
      notes: favoriteMoment,
    });
    setSavedToWatchlist(true);
    confetti({
      particleCount: 50,
      spread: 60,
      origin: { y: 0.7 },
      colors: ['#A78BFA', '#F472B6'],
    });
  };

  return (
    <div className="min-h-screen py-12 px-4 sm:px-6 flex items-center justify-center relative bg-[#0B0A10] bg-grain">
      {/* Background glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[450px] bg-pink-600/15 rounded-full blur-[140px] pointer-events-none -z-10" />

      <div className="w-full max-w-2xl glass-panel rounded-3xl p-6 sm:p-10 border border-purple-500/25 shadow-2xl relative overflow-hidden text-center">
        {/* Heart icon header */}
        <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-pink-500 to-purple-600 p-[1.5px] mx-auto mb-4 shadow-xl shadow-pink-500/20">
          <div className="w-full h-full bg-[#12111A] rounded-full flex items-center justify-center">
            <Heart className="w-8 h-8 text-pink-400 fill-pink-400 animate-pulse" />
          </div>
        </div>

        <h1 className="font-heading font-extrabold text-2xl sm:text-3xl text-white">
          That was another memory made together ❤️
        </h1>
        <p className="text-xs sm:text-sm text-purple-200/70 mt-1 max-w-md mx-auto">
          Miles apart, but sharing the exact same story. Here is your movie night recap.
        </p>

        {/* Memory Recap Card */}
        <div className="mt-8 p-6 rounded-2xl bg-white/[0.02] border border-white/10 text-left space-y-5">
          {/* Movie title & date */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-white/10 gap-2">
            <div>
              <span className="text-[10px] uppercase font-bold tracking-wider text-purple-400 flex items-center gap-1.5">
                <Film className="w-3.5 h-3.5" />
                Featured Movie
              </span>
              <h2 className="font-heading font-bold text-xl text-white mt-0.5">
                {movieSummary?.movieTitle || 'Our Movie Night'}
              </h2>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-gray-400 font-mono">
              <Calendar className="w-3.5 h-3.5 text-purple-300" />
              <span>{movieSummary?.date || new Date().toLocaleDateString()}</span>
            </div>
          </div>

          {/* Key Stats Row */}
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20">
              <span className="text-[10px] text-purple-300 font-medium block">Time Watched</span>
              <span className="font-heading font-bold text-base text-white mt-0.5 block">
                {formatTime(movieSummary?.durationWatched || 4800)}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-pink-500/10 border border-pink-500/20">
              <span className="text-[10px] text-pink-300 font-medium block">Reactions Sent</span>
              <span className="font-heading font-bold text-base text-white mt-0.5 block">
                {movieSummary?.reactionsSentCount || 18} ❤️
              </span>
            </div>

            <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
              <span className="text-[10px] text-indigo-300 font-medium block">Shared With</span>
              <span className="font-heading font-bold text-base text-white mt-0.5 block truncate">
                {friendUser ? friendUser.name : 'Your Person'}
              </span>
            </div>
          </div>

          {/* Interactive 5-star rating */}
          <div>
            <label className="block text-xs font-semibold text-purple-200/80 mb-2">
              Rate Tonight's Movie:
            </label>
            <div className="flex items-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => setRating(star)}
                  className="p-1 hover:scale-125 transition-transform cursor-pointer"
                >
                  <Star
                    className={`w-6 h-6 ${
                      star <= rating
                        ? 'text-amber-400 fill-amber-400'
                        : 'text-gray-600 hover:text-amber-300'
                    }`}
                  />
                </button>
              ))}
              <span className="text-xs text-amber-300 font-semibold ml-2 font-mono">
                {rating}.0 / 5.0
              </span>
            </div>
          </div>

          {/* Favorite moment input */}
          <div>
            <label className="block text-xs font-semibold text-purple-200/80 mb-1">
              Favorite Moment of the Night:
            </label>
            <input
              type="text"
              value={favoriteMoment}
              onChange={(e) => setFavoriteMoment(e.target.value)}
              placeholder="e.g. When the plot twist hit and you screamed!"
              className="w-full bg-[#12111A] border border-white/10 rounded-xl px-3.5 py-2 text-white text-xs focus:outline-none focus:border-purple-500"
            />
          </div>

          {/* Personal Memory note */}
          <div>
            <label className="block text-xs font-semibold text-purple-200/80 mb-1">
              Personal Memory Note:
            </label>
            <input
              type="text"
              value={memoryNote}
              onChange={(e) => setMemoryNote(e.target.value)}
              placeholder="A sweet memory note for this date..."
              className="w-full bg-[#12111A] border border-white/10 rounded-xl px-3.5 py-2 text-white text-xs focus:outline-none focus:border-purple-500"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={handleSaveToWatchlist}
            disabled={savedToWatchlist}
            className={`w-full sm:w-auto px-5 py-3 rounded-xl border text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-2 ${
              savedToWatchlist
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                : 'bg-white/5 hover:bg-white/10 text-white border-white/10'
            }`}
          >
            {savedToWatchlist ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Saved to Memories!</span>
              </>
            ) : (
              <>
                <Bookmark className="w-4 h-4 text-purple-400" />
                <span>Save to Watched Memories</span>
              </>
            )}
          </button>

          <button
            onClick={() => setCurrentView('lobby')}
            className="w-full sm:w-auto px-6 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-lg shadow-purple-600/30 transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            <Film className="w-4 h-4" />
            <span>Watch Another Movie 🍿</span>
          </button>

          <button
            onClick={leaveRoom}
            className="w-full sm:w-auto px-5 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white border border-white/10 text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            <LogOut className="w-4 h-4 text-rose-400" />
            <span>Leave Room</span>
          </button>
        </div>
      </div>
    </div>
  );
};
