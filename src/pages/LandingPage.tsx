import React from 'react';
import { useCineMate } from '../context/CineMateContext';
import {
  Heart,
  Video,
  Mic,
  Smile,
  Zap,
  Bookmark,
  Sparkles,
  Play,
  ArrowRight,
  MonitorPlay,
  Lock,
  Film,
} from 'lucide-react';

export const LandingPage: React.FC = () => {
  const { setCurrentView } = useCineMate();

  const features = [
    {
      icon: <MonitorPlay className="w-6 h-6 text-purple-400" />,
      title: 'Synchronized Playback',
      desc: 'Play, pause, seek, and rewind in perfect lockstep with automatic millisecond drift correction.',
    },
    {
      icon: <Video className="w-6 h-6 text-pink-400" />,
      title: 'Real-Time Webcam',
      desc: 'See their genuine smiles, jump scares, and teary eyes with smooth WebRTC video.',
    },
    {
      icon: <Mic className="w-6 h-6 text-indigo-400" />,
      title: 'Crystal-Clear Voice Chat',
      desc: 'Talk naturally with smart audio ducking that automatically softens movie volume when either of you speaks.',
    },
    {
      icon: <Zap className="w-6 h-6 text-amber-400" />,
      title: 'Peer-to-Peer Local Streaming',
      desc: 'Stream any video stored on your laptop directly to your friend without uploading to any server or cloud.',
    },
    {
      icon: <Smile className="w-6 h-6 text-rose-400" />,
      title: 'Cute Virtual Interactions',
      desc: 'Send exploding Heart Bursts, Virtual Hugs, toss Popcorn across the screen, or share synchronized heartbeats.',
    },
    {
      icon: <Lock className="w-6 h-6 text-emerald-400" />,
      title: '100% Private & Encrypted',
      desc: 'Strict 2-person rooms with unguessable links, optional passwords, and zero data tracking.',
    },
    {
      icon: <Bookmark className="w-6 h-6 text-blue-400" />,
      title: 'Shared Movie Watchlist',
      desc: 'Build your bucket list together and let the interactive movie roulette pick your next movie night.',
    },
    {
      icon: <Sparkles className="w-6 h-6 text-purple-300" />,
      title: 'Atmospheric Themes',
      desc: 'From Midnight Cinema to Candlelit Cozy Bedroom, tailor the lighting and aesthetic vibe to your mood.',
    },
  ];

  const steps = [
    {
      number: '01',
      title: 'Create Your Room',
      desc: 'Pick your display name, choose your cozy room theme, and set an optional password.',
      badge: '30 seconds',
    },
    {
      number: '02',
      title: 'Invite Your Person',
      desc: 'Share your private link or scan the instant QR code on WhatsApp or text message.',
      badge: 'Strictly 2 people',
    },
    {
      number: '03',
      title: 'Watch Together',
      desc: 'Pick a movie file from your laptop, turn on your cameras, and cozy up for an unforgettable night.',
      badge: 'Zero cloud upload',
    },
  ];

  return (
    <div className="min-h-screen bg-[#0B0A10] text-[#F7F5FA] flex flex-col relative overflow-hidden bg-grain">
      {/* Ambient background glows */}
      <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[700px] h-[450px] bg-purple-600/15 rounded-full blur-[140px] pointer-events-none -z-10" />
      <div className="absolute top-[550px] left-1/4 w-[500px] h-[350px] bg-pink-600/10 rounded-full blur-[130px] pointer-events-none -z-10" />

      {/* Hero Section */}
      <section className="relative pt-12 pb-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto flex flex-col items-center text-center">
        {/* Subtle pill tag */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass-panel border border-purple-500/30 text-xs font-medium text-purple-300 mb-8 animate-fade-in shadow-lg shadow-purple-500/10">
          <Heart className="w-3.5 h-3.5 text-pink-400 fill-pink-400 animate-pulse" />
          <span>Private rooms · Real-time streaming · Video & voice</span>
        </div>

        {/* Headline */}
        <h1 className="font-heading font-extrabold text-4xl sm:text-6xl lg:text-7xl tracking-tight text-white max-w-4xl leading-[1.1] mb-6">
          Distance disappears when the{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-400 to-purple-300">
            movie starts.
          </span>
        </h1>

        {/* Subtitle */}
        <p className="text-base sm:text-xl text-purple-200/70 max-w-2xl font-normal leading-relaxed mb-10">
          Your private cinema for two. Watch, laugh, react, and spend time together — no matter how far apart you are.
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto mb-16">
          <button
            onClick={() => setCurrentView('create-room')}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-8 py-4 rounded-2xl bg-gradient-to-r from-purple-600 via-indigo-600 to-pink-500 hover:from-purple-500 hover:to-pink-400 text-white font-semibold text-base shadow-xl shadow-purple-600/30 hover:shadow-purple-600/50 hover:scale-102 transition-all cursor-pointer"
          >
            <Play className="w-5 h-5 fill-white" />
            <span>Create Your Movie Room</span>
          </button>
          <button
            onClick={() => setCurrentView('join-room')}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-4 rounded-2xl glass-panel hover:bg-white/10 border border-purple-500/25 text-white font-medium text-base transition-all hover:scale-102 cursor-pointer"
          >
            <span>Join a Room</span>
            <ArrowRight className="w-4 h-4 text-purple-300" />
          </button>
        </div>

        {/* Cinematic Visual Showcase Mockup */}
        <div className="relative w-full max-w-5xl rounded-3xl p-2.5 bg-gradient-to-b from-purple-500/30 via-purple-500/10 to-transparent shadow-2xl">
          <div className="w-full rounded-2xl bg-[#12111A] border border-white/10 overflow-hidden shadow-2xl relative">
            {/* Mock Top bar */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-white/10 bg-white/[0.02]">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500/60" />
                <div className="w-3 h-3 rounded-full bg-amber-500/60" />
                <div className="w-3 h-3 rounded-full bg-emerald-500/60" />
                <span className="text-xs text-gray-400 ml-2 font-mono">cinemate.app/room/love-story-482</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-purple-300 font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>Connected & Synced</span>
              </div>
            </div>

            {/* Video mockup view */}
            <div className="relative aspect-video w-full bg-gradient-to-tr from-[#0B0A10] via-[#1a1429] to-[#0f1124] flex items-center justify-center overflow-hidden">
              <img
                src="https://images.unsplash.com/photo-1518173946687-a4c8a383392e?auto=format&fit=crop&w=1600&q=80"
                alt="Cinematic movie scene"
                className="w-full h-full object-cover opacity-65"
              />

              {/* Floating Webcams inside mock */}
              <div className="absolute bottom-6 left-6 flex items-center gap-3">
                <div className="w-36 h-24 rounded-xl border border-purple-500/40 bg-black/80 backdrop-blur-md overflow-hidden relative shadow-lg">
                  <img
                    src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80"
                    alt="Alex webcam"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute bottom-1 left-2 text-[10px] text-white font-medium drop-shadow">
                    Sarah 💖
                  </div>
                </div>
                <div className="w-36 h-24 rounded-xl border border-purple-500/40 bg-black/80 backdrop-blur-md overflow-hidden relative shadow-lg">
                  <img
                    src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=300&q=80"
                    alt="Sam webcam"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute bottom-1 left-2 text-[10px] text-white font-medium drop-shadow">
                    Alex (You)
                  </div>
                </div>
              </div>

              {/* Animated Floating Hearts */}
              <div className="absolute top-1/3 left-1/2 -translate-x-1/2 text-5xl animate-bounce">
                ❤️
              </div>
              <div className="absolute top-1/4 right-1/4 text-4xl animate-pulse">
                🍿
              </div>

              {/* Floating Chat snippet */}
              <div className="absolute top-6 right-6 w-60 glass-panel rounded-2xl p-3 border border-purple-500/30 text-left shadow-xl hidden sm:block">
                <div className="text-[11px] font-bold text-pink-300">Sarah</div>
                <p className="text-xs text-white mt-0.5">"Look at that scene! It reminded me of us 🥺❤️"</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it Works Section */}
      <section id="how-it-works" className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="font-heading font-bold text-3xl sm:text-4xl text-white">
            How CineMate Works
          </h2>
          <p className="text-sm sm:text-base text-purple-200/70 mt-3 max-w-xl mx-auto">
            Three simple steps to bring your bedroom cinema to life across any distance.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {steps.map((step) => (
            <div
              key={step.number}
              className="relative glass-panel rounded-2xl p-8 border border-purple-500/20 hover:border-purple-400/50 transition-all group hover:-translate-y-1 shadow-lg"
            >
              <div className="flex items-center justify-between mb-6">
                <span className="font-heading font-extrabold text-3xl text-purple-400/40 group-hover:text-purple-400 transition-colors">
                  {step.number}
                </span>
                <span className="text-[11px] font-semibold text-purple-300 bg-purple-500/10 border border-purple-500/20 px-3 py-1 rounded-full">
                  {step.badge}
                </span>
              </div>
              <h3 className="font-heading font-bold text-xl text-white mb-2">{step.title}</h3>
              <p className="text-sm text-purple-200/70 leading-relaxed">{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <span className="text-xs font-semibold tracking-wider uppercase text-purple-400 bg-purple-500/10 border border-purple-500/20 px-3.5 py-1.5 rounded-full">
            Designed Exclusively for Two
          </span>
          <h2 className="font-heading font-bold text-3xl sm:text-4xl text-white mt-4">
            Everything You Need for Movie Night
          </h2>
          <p className="text-sm sm:text-base text-purple-200/70 mt-3 max-w-2xl mx-auto">
            Not a generic video call. Every feature is handcrafted to recreate the warmth and magic of sitting on the same couch.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feat, idx) => (
            <div
              key={idx}
              className="glass-panel p-6 rounded-2xl border border-white/10 hover:border-purple-500/30 transition-all hover:-translate-y-1 group"
            >
              <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 w-fit mb-4 group-hover:scale-110 transition-transform">
                {feat.icon}
              </div>
              <h3 className="font-heading font-semibold text-base text-white mb-2">{feat.title}</h3>
              <p className="text-xs text-purple-200/60 leading-relaxed">{feat.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Call to Action Banner */}
      <section className="py-16 px-4 max-w-5xl mx-auto text-center">
        <div className="glass-panel rounded-3xl p-10 sm:p-14 border border-purple-500/30 bg-gradient-to-r from-purple-950/40 via-purple-900/20 to-pink-950/40 shadow-2xl relative overflow-hidden">
          <div className="relative z-10 max-w-2xl mx-auto">
            <h2 className="font-heading font-extrabold text-3xl sm:text-4xl text-white mb-4">
              Ready for your movie night?
            </h2>
            <p className="text-sm sm:text-base text-purple-200/80 mb-8 leading-relaxed">
              Grab your favorite snacks, choose your cozy movie, and get ready to feel close again.
            </p>
            <button
              onClick={() => setCurrentView('create-room')}
              className="inline-flex items-center gap-2.5 px-8 py-4 rounded-2xl bg-gradient-to-r from-purple-600 via-indigo-600 to-pink-500 hover:from-purple-500 hover:to-pink-400 text-white font-semibold text-base shadow-xl shadow-purple-600/30 hover:scale-103 transition-all cursor-pointer"
            >
              <Play className="w-5 h-5 fill-white" />
              <span>Create Your Room Now 🍿</span>
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t border-white/10 py-10 px-4 sm:px-6 lg:px-8 bg-black/40">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6 text-xs text-purple-200/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-purple-600 to-pink-500 p-[1px] flex items-center justify-center">
              <div className="w-full h-full bg-[#0B0A10] rounded-[7px] flex items-center justify-center">
                <Film className="w-4 h-4 text-purple-400" />
              </div>
            </div>
            <div>
              <span className="font-heading font-bold text-white text-sm">CineMate</span>
              <p className="text-[11px] text-purple-300/50">Different places. One movie. Together.</p>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <span>End-to-End P2P Streaming</span>
            <span>Zero Server Storage</span>
            <span>Made with ❤️ for Long-Distance Connections</span>
          </div>

          <div>
            © {new Date().getFullYear()} CineMate. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
};
