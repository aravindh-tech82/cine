import React, { useState } from 'react';
import { useCineMate } from '../context/CineMateContext';
import {
  Bookmark,
  Plus,
  Shuffle,
  Star,
  CheckCircle2,
  Circle,
  Trash2,
  Clock,
  X,
  Film,
} from 'lucide-react';
import { WatchlistItem } from '../types';
import confetti from 'canvas-confetti';

export const WatchlistPage: React.FC = () => {
  const {
    watchlist,
    addToWatchlist,
    toggleWatchedInWatchlist,
    removeFromWatchlist,
    setCurrentView,
  } = useCineMate();

  const [filter, setFilter] = useState<'all' | 'unwatched' | 'watched'>('all');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isRouletteOpen, setIsRouletteOpen] = useState(false);
  const [rouletteWinner, setRouletteWinner] = useState<WatchlistItem | null>(null);
  const [isSpinning, setIsSpinning] = useState(false);

  // New movie form
  const [title, setTitle] = useState('');
  const [genre, setGenre] = useState('Romance / Drama');
  const [duration, setDuration] = useState('2h 00m');
  const [rating, setRating] = useState(4.8);
  const [posterUrl, setPosterUrl] = useState('');
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');

  const filteredMovies = watchlist.filter((item: WatchlistItem) => {
    if (filter === 'unwatched') return !item.watched;
    if (filter === 'watched') return item.watched;
    return true;
  });

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    addToWatchlist({
      title: title.trim(),
      description: description.trim() || 'A movie chosen for our next date night.',
      genre: genre.trim(),
      duration: duration.trim(),
      rating: Number(rating),
      posterUrl:
        posterUrl.trim() ||
        'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=600&q=80',
      addedBy: 'You',
      watched: false,
      notes: notes.trim(),
    });

    setTitle('');
    setDescription('');
    setNotes('');
    setPosterUrl('');
    setIsAddModalOpen(false);
  };

  const handleSpinRoulette = () => {
    const unwatched = watchlist.filter((m: WatchlistItem) => !m.watched);
    const pool = unwatched.length > 0 ? unwatched : watchlist;
    if (pool.length === 0) return;

    setIsRouletteOpen(true);
    setIsSpinning(true);
    setRouletteWinner(null);

    let counter = 0;
    const interval = setInterval(() => {
      const randomIdx = Math.floor(Math.random() * pool.length);
      setRouletteWinner(pool[randomIdx]);
      counter++;

      if (counter > 18) {
        clearInterval(interval);
        setIsSpinning(false);
        const finalWinner = pool[Math.floor(Math.random() * pool.length)];
        setRouletteWinner(finalWinner);
        confetti({
          particleCount: 80,
          spread: 80,
          origin: { y: 0.6 },
          colors: ['#A78BFA', '#F472B6', '#FBBF24'],
        });
      }
    }, 120);
  };

  return (
    <div className="min-h-screen py-10 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto bg-[#0B0A10] bg-grain">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-8 border-b border-white/10">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <Bookmark className="w-5 h-5" />
            </span>
            <h1 className="font-heading font-extrabold text-2xl sm:text-3xl text-white">
              Our Shared Watchlist
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-purple-200/70">
            Every movie you both dream of watching together across the miles.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleSpinRoulette}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:opacity-95 text-white font-semibold text-xs shadow-lg shadow-amber-500/20 transition-all hover:scale-102 cursor-pointer"
          >
            <Shuffle className="w-4 h-4" />
            <span>Pick Our Next Movie 🎬</span>
          </button>

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs shadow-lg shadow-purple-600/30 transition-all hover:scale-102 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Movie</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-3 py-6">
        {[
          { id: 'all', label: `All Movies (${watchlist.length})` },
          { id: 'unwatched', label: `To Watch (${watchlist.filter((w: WatchlistItem) => !w.watched).length})` },
          { id: 'watched', label: `Watched Together (${watchlist.filter((w: WatchlistItem) => w.watched).length})` },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFilter(tab.id as any)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
              filter === tab.id
                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Movies Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {filteredMovies.map((movie: WatchlistItem) => (
          <div
            key={movie.id}
            className="glass-panel rounded-2xl overflow-hidden border border-white/10 hover:border-purple-500/30 transition-all group flex flex-col justify-between"
          >
            <div>
              {/* Poster */}
              <div className="relative aspect-[16/10] overflow-hidden bg-black/40">
                <img
                  src={movie.posterUrl}
                  alt={movie.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute top-2.5 right-2.5 flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/70 backdrop-blur-md text-amber-300 text-xs font-semibold border border-white/10">
                  <Star className="w-3 h-3 fill-amber-300" />
                  <span>{movie.rating}</span>
                </div>
                {movie.watched && (
                  <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center">
                    <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-300 bg-emerald-950/80 border border-emerald-500/40 px-3 py-1 rounded-full">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Watched Together
                    </span>
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-purple-400">
                    {movie.genre}
                  </span>
                  <span className="text-[11px] text-gray-400 font-mono flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    {movie.duration}
                  </span>
                </div>

                <h3 className="font-heading font-bold text-base text-white group-hover:text-purple-300 transition-colors">
                  {movie.title}
                </h3>

                <p className="text-xs text-purple-200/60 line-clamp-2 leading-relaxed">
                  {movie.description}
                </p>

                {movie.notes && (
                  <p className="text-[11px] text-pink-300/80 italic bg-pink-500/10 p-2 rounded-lg border border-pink-500/20">
                    "{movie.notes}"
                  </p>
                )}
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="px-4 py-3 border-t border-white/5 bg-white/[0.01] flex items-center justify-between">
              <button
                onClick={() => toggleWatchedInWatchlist(movie.id)}
                className={`flex items-center gap-1.5 text-xs font-medium cursor-pointer transition-colors ${
                  movie.watched ? 'text-emerald-400' : 'text-gray-400 hover:text-white'
                }`}
              >
                {movie.watched ? (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Watched</span>
                  </>
                ) : (
                  <>
                    <Circle className="w-4 h-4" />
                    <span>Mark Watched</span>
                  </>
                )}
              </button>

              <button
                onClick={() => removeFromWatchlist(movie.id)}
                className="p-1 rounded text-gray-500 hover:text-rose-400 transition-colors cursor-pointer"
                title="Remove from watchlist"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Add Movie Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
          <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-purple-500/30 max-w-lg w-full relative">
            <button
              onClick={() => setIsAddModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-white/10 text-gray-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2 mb-4">
              <Film className="w-5 h-5 text-purple-400" />
              <h2 className="font-heading font-bold text-xl text-white">Add Movie to Watchlist</h2>
            </div>

            <form onSubmit={handleAddSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-purple-300/80 mb-1">
                  Movie Title
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. About Time"
                  className="w-full bg-[#12111A] border border-white/10 rounded-xl px-3.5 py-2.5 text-white text-xs focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-purple-300/80 mb-1">
                    Genre
                  </label>
                  <input
                    type="text"
                    value={genre}
                    onChange={(e) => setGenre(e.target.value)}
                    placeholder="Romance / Sci-Fi"
                    className="w-full bg-[#12111A] border border-white/10 rounded-xl px-3.5 py-2.5 text-white text-xs focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-purple-300/80 mb-1">
                    Duration
                  </label>
                  <input
                    type="text"
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    placeholder="2h 10m"
                    className="w-full bg-[#12111A] border border-white/10 rounded-xl px-3.5 py-2.5 text-white text-xs focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-purple-300/80 mb-1">
                  Rating (1.0 to 5.0)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="1"
                  max="5"
                  value={rating}
                  onChange={(e) => setRating(parseFloat(e.target.value))}
                  className="w-full bg-[#12111A] border border-white/10 rounded-xl px-3.5 py-2.5 text-white text-xs focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-purple-300/80 mb-1">
                  Poster Image URL (Optional)
                </label>
                <input
                  type="url"
                  value={posterUrl}
                  onChange={(e) => setPosterUrl(e.target.value)}
                  placeholder="https://images.unsplash.com/..."
                  className="w-full bg-[#12111A] border border-white/10 rounded-xl px-3.5 py-2.5 text-white text-xs focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-purple-300/80 mb-1">
                  Movie Description / Why We Want To Watch
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="A romantic time-travel movie for a teary cozy evening..."
                  className="w-full bg-[#12111A] border border-white/10 rounded-xl px-3.5 py-2.5 text-white text-xs focus:outline-none focus:border-purple-500 resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-purple-300/80 mb-1">
                  Sweet Note (Optional)
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. You promised to bring the popcorn!"
                  className="w-full bg-[#12111A] border border-white/10 rounded-xl px-3.5 py-2.5 text-white text-xs focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs text-gray-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs shadow-md transition-all cursor-pointer"
                >
                  Save Movie
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Movie Roulette Modal */}
      {isRouletteOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
          <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-amber-500/40 max-w-md w-full text-center relative shadow-2xl">
            <button
              onClick={() => setIsRouletteOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-white/10 text-gray-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>

            <span className="text-3xl mb-2 inline-block">🎲</span>
            <h2 className="font-heading font-extrabold text-2xl text-white">Movie Roulette</h2>
            <p className="text-xs text-amber-200/80 mt-1 mb-6">
              {isSpinning ? 'Picking your destiny...' : 'Tonight we are watching:'}
            </p>

            {rouletteWinner && (
              <div className="p-4 rounded-2xl bg-white/[0.03] border border-amber-500/30 flex flex-col items-center">
                <img
                  src={rouletteWinner.posterUrl}
                  alt={rouletteWinner.title}
                  className="w-44 h-28 object-cover rounded-xl border border-white/10 shadow-lg mb-3"
                />
                <h3 className="font-heading font-bold text-lg text-white">
                  {rouletteWinner.title}
                </h3>
                <span className="text-xs text-amber-300 font-medium mt-0.5">
                  {rouletteWinner.genre} · {rouletteWinner.duration}
                </span>
                <p className="text-xs text-purple-200/70 mt-2 line-clamp-2">
                  {rouletteWinner.description}
                </p>
              </div>
            )}

            <div className="mt-6 flex items-center justify-center gap-3">
              <button
                onClick={handleSpinRoulette}
                disabled={isSpinning}
                className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-white font-semibold text-xs shadow-md transition-all cursor-pointer"
              >
                Spin Again 🎲
              </button>
              <button
                onClick={() => {
                  setIsRouletteOpen(false);
                  setCurrentView('create-room');
                }}
                className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs shadow-md transition-all cursor-pointer"
              >
                Watch Now 🍿
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
