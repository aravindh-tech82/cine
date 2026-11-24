import React, { useState } from 'react';
import { useCineMate } from '../../context/CineMateContext';
import {
  X,
  Video,
  Mic,
  Palette,
  Shield,
  Volume2,
  Radio,
  Check,
  RefreshCw,
  Sparkles,
  Server,
  Zap,
} from 'lucide-react';
import { RoomTheme } from '../../types';
import { getSupabaseConfig, saveSupabaseConfig, getSupabaseClient } from '../../services/supabase';

export const SettingsModal: React.FC = () => {
  const {
    isSettingsOpen,
    setIsSettingsOpen,
    preferences,
    updatePreferences,
    availableCameras,
    availableMics,
    availableSpeakers,
    switchCamera,
    switchMic,
    connectionStats,
  } = useCineMate();

  const [activeTab, setActiveTab] = useState<'video' | 'audio' | 'appearance' | 'signaling'>('video');

  // Supabase manual config state
  const currentSupabase = getSupabaseConfig();
  const [supabaseUrl, setSupabaseUrl] = useState(currentSupabase.url);
  const [supabaseAnonKey, setSupabaseAnonKey] = useState(currentSupabase.anonKey);
  const [supabaseSaveStatus, setSupabaseSaveStatus] = useState<string>('');

  if (!isSettingsOpen) return null;

  const themes: { id: RoomTheme; name: string; desc: string; colors: string[] }[] = [
    {
      id: 'midnight',
      name: 'Midnight Cinema',
      desc: 'Deep cosmic obsidian with radiant violet & lilac accents',
      colors: ['#0B0A10', '#191722', '#A78BFA'],
    },
    {
      id: 'purple',
      name: 'Purple Dream',
      desc: 'Ethereal purple haze with soft neon pink glow',
      colors: ['#0c0919', '#1c1635', '#c084fc'],
    },
    {
      id: 'cozy',
      name: 'Cozy Bedroom',
      desc: 'Warm candlelit amber, hot cocoa, and soft shadows',
      colors: ['#140E0F', '#281c1f', '#fb923c'],
    },
    {
      id: 'pink',
      name: 'Pink Romance',
      desc: 'Gentle blush petals and tender intimate warmth',
      colors: ['#140A12', '#2c1528', '#f472b6'],
    },
    {
      id: 'retro',
      name: 'Retro Cinema',
      desc: 'Vintage movie projector gold and sepia noir tones',
      colors: ['#0f1214', '#1c2328', '#f59e0b'],
    },
    {
      id: 'galaxy',
      name: 'Galaxy Night',
      desc: 'Starlight deep navy with celestial electric blue',
      colors: ['#060714', '#121433', '#60a5fa'],
    },
  ];

  const handleSaveSupabase = () => {
    saveSupabaseConfig(supabaseUrl, supabaseAnonKey);
    setSupabaseSaveStatus('Saved! Reconnecting signaling...');
    setTimeout(() => {
      setSupabaseSaveStatus('');
    }, 3000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-2xl glass-panel rounded-2xl border border-purple-500/20 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/[0.02]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-heading font-semibold text-lg text-white">CineMate Settings</h2>
              <p className="text-xs text-purple-200/60">Customize your cinema, audio & connection</p>
            </div>
          </div>
          <button
            onClick={() => setIsSettingsOpen(false)}
            className="p-2 rounded-full hover:bg-white/10 text-purple-200/70 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs Bar */}
        <div className="flex border-b border-white/10 px-6 gap-6 bg-black/20 text-sm">
          <button
            onClick={() => setActiveTab('video')}
            className={`py-3 flex items-center gap-2 border-b-2 font-medium transition-colors cursor-pointer ${
              activeTab === 'video'
                ? 'border-purple-400 text-purple-300'
                : 'border-transparent text-purple-200/60 hover:text-white'
            }`}
          >
            <Video className="w-4 h-4" />
            Video
          </button>
          <button
            onClick={() => setActiveTab('audio')}
            className={`py-3 flex items-center gap-2 border-b-2 font-medium transition-colors cursor-pointer ${
              activeTab === 'audio'
                ? 'border-purple-400 text-purple-300'
                : 'border-transparent text-purple-200/60 hover:text-white'
            }`}
          >
            <Mic className="w-4 h-4" />
            Audio
          </button>
          <button
            onClick={() => setActiveTab('appearance')}
            className={`py-3 flex items-center gap-2 border-b-2 font-medium transition-colors cursor-pointer ${
              activeTab === 'appearance'
                ? 'border-purple-400 text-purple-300'
                : 'border-transparent text-purple-200/60 hover:text-white'
            }`}
          >
            <Palette className="w-4 h-4" />
            Themes
          </button>
          <button
            onClick={() => setActiveTab('signaling')}
            className={`py-3 flex items-center gap-2 border-b-2 font-medium transition-colors cursor-pointer ${
              activeTab === 'signaling'
                ? 'border-purple-400 text-purple-300'
                : 'border-transparent text-purple-200/60 hover:text-white'
            }`}
          >
            <Server className="w-4 h-4" />
            Signaling & P2P
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-sm">
          {/* VIDEO TAB */}
          {activeTab === 'video' && (
            <div className="space-y-5">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-purple-300/80 mb-2">
                  Camera Device
                </label>
                <select
                  value={preferences.selectedCameraId}
                  onChange={(e) => switchCamera(e.target.value)}
                  className="w-full bg-[#12111A] border border-white/10 rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-purple-500"
                >
                  <option value="">Default Camera</option>
                  {availableCameras.map((cam) => (
                    <option key={cam.deviceId} value={cam.deviceId}>
                      {cam.label || `Camera ${cam.deviceId.slice(0, 5)}`}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-purple-300/80 mb-2">
                  Streaming Video Quality
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {(['1080p', '720p', '480p'] as const).map((q) => (
                    <button
                      key={q}
                      onClick={() => updatePreferences({ videoQuality: q })}
                      className={`py-2.5 px-3 rounded-xl border text-center font-medium transition-all cursor-pointer ${
                        preferences.videoQuality === q
                          ? 'border-purple-500 bg-purple-500/20 text-purple-200 font-semibold'
                          : 'border-white/10 bg-white/[0.02] text-gray-400 hover:border-white/20'
                      }`}
                    >
                      {q === '1080p' ? 'Full HD (1080p)' : q === '720p' ? 'HD (720p)' : 'Smooth (480p)'}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-purple-300/80 mb-2">
                  Webcam Layout in Cinema
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { id: 'floating-pip', label: 'Floating Picture-in-Picture' },
                    { id: 'side-by-side', label: 'Side-by-Side Split' },
                    { id: 'right-sidebar', label: 'Right Side Panel' },
                    { id: 'minimal-overlay', label: 'Minimal Corner Pill' },
                  ].map((layout) => (
                    <button
                      key={layout.id}
                      onClick={() => updatePreferences({ webcamLayout: layout.id as any })}
                      className={`p-3 rounded-xl border text-left font-medium text-xs transition-all cursor-pointer ${
                        preferences.webcamLayout === layout.id
                          ? 'border-purple-500 bg-purple-500/20 text-purple-200'
                          : 'border-white/10 bg-white/[0.02] text-gray-400 hover:border-white/20'
                      }`}
                    >
                      {layout.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* AUDIO TAB */}
          {activeTab === 'audio' && (
            <div className="space-y-5">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-purple-300/80 mb-2">
                  Microphone Device
                </label>
                <select
                  value={preferences.selectedMicId}
                  onChange={(e) => switchMic(e.target.value)}
                  className="w-full bg-[#12111A] border border-white/10 rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-purple-500"
                >
                  <option value="">Default Microphone</option>
                  {availableMics.map((mic) => (
                    <option key={mic.deviceId} value={mic.deviceId}>
                      {mic.label || `Microphone ${mic.deviceId.slice(0, 5)}`}
                    </option>
                  ))}
                </select>
              </div>

              {availableSpeakers.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-purple-300/80 mb-2">
                    Audio Output (Speaker)
                  </label>
                  <select
                    value={preferences.selectedSpeakerId}
                    onChange={(e) => updatePreferences({ selectedSpeakerId: e.target.value })}
                    className="w-full bg-[#12111A] border border-white/10 rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-purple-500"
                  >
                    <option value="">Default Speaker</option>
                    {availableSpeakers.map((spk) => (
                      <option key={spk.deviceId} value={spk.deviceId}>
                        {spk.label || `Speaker ${spk.deviceId.slice(0, 5)}`}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Audio Ducking Feature */}
              <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 text-white font-medium">
                    <Volume2 className="w-4 h-4 text-purple-400" />
                    <span>Smart Audio Ducking</span>
                  </div>
                  <p className="text-xs text-purple-200/70 mt-1">
                    Automatically lowers the movie volume slightly whenever you or your friend speak, so you never miss a word.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={preferences.audioDucking}
                  onChange={(e) => updatePreferences({ audioDucking: e.target.checked })}
                  className="w-5 h-5 rounded accent-purple-500 cursor-pointer mt-0.5"
                />
              </div>

              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-gray-300 text-xs">AI Noise Suppression</span>
                  <input
                    type="checkbox"
                    checked={preferences.noiseSuppression}
                    onChange={(e) => updatePreferences({ noiseSuppression: e.target.checked })}
                    className="w-4 h-4 rounded accent-purple-500 cursor-pointer"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-300 text-xs">Acoustic Echo Cancellation</span>
                  <input
                    type="checkbox"
                    checked={preferences.echoCancellation}
                    onChange={(e) => updatePreferences({ echoCancellation: e.target.checked })}
                    className="w-4 h-4 rounded accent-purple-500 cursor-pointer"
                  />
                </div>
              </div>
            </div>
          )}

          {/* APPEARANCE / THEMES TAB */}
          {activeTab === 'appearance' && (
            <div className="space-y-4">
              <p className="text-xs text-purple-200/70">
                Choose the aesthetic atmosphere for your private cinema night.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {themes.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => updatePreferences({ theme: t.id })}
                    className={`p-4 rounded-xl border text-left transition-all relative overflow-hidden group cursor-pointer ${
                      preferences.theme === t.id
                        ? 'border-purple-400 bg-purple-500/15 shadow-lg shadow-purple-500/10'
                        : 'border-white/10 bg-white/[0.02] hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-white group-hover:text-purple-300 transition-colors">
                        {t.name}
                      </span>
                      {preferences.theme === t.id && (
                        <span className="p-1 rounded-full bg-purple-500 text-white">
                          <Check className="w-3 h-3" />
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 line-clamp-2 mb-3">{t.desc}</p>
                    <div className="flex items-center gap-1.5">
                      {t.colors.map((c, i) => (
                        <div
                          key={i}
                          className="w-5 h-5 rounded-full border border-white/20"
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* SIGNALING & P2P TAB */}
          {activeTab === 'signaling' && (
            <div className="space-y-5">
              <div className="p-3.5 rounded-xl bg-purple-950/30 border border-purple-500/20 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse" />
                  <div>
                    <p className="font-medium text-white text-xs">
                      Signaling Status:{' '}
                      <span className="text-emerald-400">
                        {getSupabaseClient() ? 'Supabase Realtime Cloud' : 'Cross-Tab / Local Broadcast'}
                      </span>
                    </p>
                    <p className="text-[11px] text-purple-200/60 mt-0.5">
                      Latency: ~{connectionStats.latency}ms · Peer Connection: {connectionStats.iceConnectionState}
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-purple-300/80 mb-1">
                  Supabase Project URL
                </label>
                <input
                  type="text"
                  placeholder="https://your-project.supabase.co"
                  value={supabaseUrl}
                  onChange={(e) => setSupabaseUrl(e.target.value)}
                  className="w-full bg-[#12111A] border border-white/10 rounded-xl px-3.5 py-2 text-white text-xs focus:outline-none focus:border-purple-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-purple-300/80 mb-1">
                  Supabase Anon Key
                </label>
                <input
                  type="password"
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                  value={supabaseAnonKey}
                  onChange={(e) => setSupabaseAnonKey(e.target.value)}
                  className="w-full bg-[#12111A] border border-white/10 rounded-xl px-3.5 py-2 text-white text-xs focus:outline-none focus:border-purple-500 font-mono"
                />
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-xs text-emerald-400 font-medium">{supabaseSaveStatus}</span>
                <button
                  onClick={handleSaveSupabase}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-semibold shadow-md transition-colors cursor-pointer"
                >
                  Save & Connect
                </button>
              </div>

              <div className="pt-2 border-t border-white/10">
                <p className="text-[11px] text-purple-200/50 leading-relaxed">
                  💡 <strong>Peer-to-Peer Privacy:</strong> Your movie file and webcams are streamed directly peer-to-peer between your two devices using WebRTC. Supabase is only used for lightweight signaling (SDP offer/answers, play/pause commands, and chat). No video files are ever uploaded or saved on any server.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-white/10 bg-white/[0.02] flex justify-end">
          <button
            onClick={() => setIsSettingsOpen(false)}
            className="px-5 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-semibold transition-all cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

