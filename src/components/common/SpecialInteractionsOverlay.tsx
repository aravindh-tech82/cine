import React, { useEffect } from 'react';
import { useCineMate } from '../../context/CineMateContext';
import { Heart, X } from 'lucide-react';

export const SpecialInteractionsOverlay: React.FC = () => {
  const { activeSpecialInteraction, closeSpecialInteraction, currentUser, friendUser } = useCineMate();

  useEffect(() => {
    if (!activeSpecialInteraction) return;

    // Auto dismiss after 4.5 seconds
    const timer = setTimeout(() => {
      closeSpecialInteraction();
    }, 4500);

    return () => clearTimeout(timer);
  }, [activeSpecialInteraction, closeSpecialInteraction]);

  if (!activeSpecialInteraction) return null;

  const { type, senderName } = activeSpecialInteraction;
  const isMe = activeSpecialInteraction.senderId === currentUser.id;

  return (
    <div className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center p-4">
      {/* VIRTUAL HUG */}
      {type === 'virtual-hug' && (
        <div className="pointer-events-auto bg-[#191722]/90 backdrop-blur-xl border border-pink-500/40 p-6 rounded-3xl shadow-2xl shadow-pink-500/25 flex flex-col items-center max-w-sm text-center animate-bounce-subtle">
          <div className="relative flex items-center justify-center w-28 h-20 mb-4">
            {/* Left avatar */}
            <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-purple-600 to-indigo-600 border-2 border-white flex items-center justify-center text-xl font-bold shadow-lg animate-slide-right">
              {currentUser.name.charAt(0)}
            </div>
            {/* Center Heart */}
            <div className="absolute z-10 w-12 h-12 rounded-full bg-pink-500/30 border border-pink-400 flex items-center justify-center animate-ping">
              <Heart className="w-6 h-6 text-pink-400 fill-pink-400" />
            </div>
            {/* Right avatar */}
            <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-pink-600 to-rose-600 border-2 border-white flex items-center justify-center text-xl font-bold shadow-lg -ml-4 animate-slide-left">
              {friendUser?.name ? friendUser.name.charAt(0) : '❤️'}
            </div>
          </div>
          <h3 className="font-heading font-bold text-xl text-white">
            {isMe ? 'You sent a Virtual Hug 🤗' : `${senderName} sent you a Warm Hug 🤗`}
          </h3>
          <p className="text-xs text-pink-200/80 mt-1.5">
            Wrapping you in warmth and closeness across the distance.
          </p>
        </div>
      )}

      {/* MISS YOU BANNER */}
      {type === 'miss-you' && (
        <div className="pointer-events-auto bg-gradient-to-r from-purple-900/95 via-pink-900/95 to-purple-900/95 backdrop-blur-xl border border-pink-400/40 px-8 py-5 rounded-3xl shadow-2xl flex items-center gap-4 animate-fade-in">
          <div className="p-3 rounded-2xl bg-pink-500/20 text-pink-300 border border-pink-400/30">
            <Heart className="w-8 h-8 fill-pink-400 animate-pulse" />
          </div>
          <div className="text-left">
            <h4 className="font-heading font-bold text-lg text-white">
              {isMe ? 'Sent to your favorite person ❤️' : `From ${senderName} with love ❤️`}
            </h4>
            <p className="text-sm text-pink-100 font-medium">
              "Sending you a little hug from here, wishing we were side by side."
            </p>
          </div>
          <button
            onClick={closeSpecialInteraction}
            className="p-1.5 hover:bg-white/10 rounded-full text-white/60 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* SEND POPCORN */}
      {type === 'send-popcorn' && (
        <div className="pointer-events-auto bg-[#191722]/90 backdrop-blur-xl border border-amber-500/30 p-6 rounded-3xl shadow-2xl flex flex-col items-center text-center animate-fade-in">
          <div className="text-6xl mb-3 animate-bounce">🍿</div>
          <h3 className="font-heading font-bold text-lg text-white">
            {isMe ? 'You tossed some popcorn! 🍿' : `${senderName} tossed you some popcorn! 🍿`}
          </h3>
          <p className="text-xs text-amber-200/80 mt-1">
            "Here, have a bite! Don't eat all the caramel ones!"
          </p>
        </div>
      )}

      {/* SYNCHRONIZED HEARTBEAT */}
      {type === 'heartbeat' && (
        <div className="pointer-events-auto bg-black/85 backdrop-blur-xl border border-red-500/30 p-8 rounded-3xl shadow-2xl flex flex-col items-center text-center">
          <div className="w-20 h-20 rounded-full bg-red-500/20 border-2 border-red-500 flex items-center justify-center animate-pulse mb-3">
            <Heart className="w-10 h-10 text-red-500 fill-red-500 animate-ping" />
          </div>
          <h3 className="font-heading font-bold text-xl text-white">Synchronized Heartbeat</h3>
          <p className="text-xs text-red-200/80 mt-1">
            Feel each other's pulse in real time. One movie, two hearts beating as one.
          </p>
        </div>
      )}

      {/* HAND-HOLDING ANIMATION */}
      {type === 'hand-holding' && (
        <div className="pointer-events-auto bg-gradient-to-b from-[#191722]/95 to-[#261e47]/95 backdrop-blur-xl border border-purple-400/40 p-6 rounded-3xl shadow-2xl flex flex-col items-center text-center">
          <div className="text-5xl mb-3 animate-pulse">🤝✨</div>
          <h3 className="font-heading font-bold text-lg text-white">Holding Hands Across the Miles</h3>
          <p className="text-xs text-purple-200/80 mt-1 max-w-xs">
            "Even when hands can't touch, our hearts never let go."
          </p>
        </div>
      )}
    </div>
  );
};
