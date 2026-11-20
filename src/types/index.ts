export type RoomTheme = 'midnight' | 'purple' | 'cozy' | 'pink' | 'retro' | 'galaxy';

export type ParticipantRole = 'host' | 'guest';

export type UserMood = 'Happy' | 'Excited' | 'Sleepy' | 'Emotional' | 'Scared' | 'Romantic' | 'Hungry' | 'Confused';

export interface Participant {
  id: string;
  name: string;
  role: ParticipantRole;
  isReady: boolean;
  cameraOn: boolean;
  micOn: boolean;
  speaking: boolean;
  mood: UserMood;
  joinedAt: number;
  avatarSeed?: string;
}

export interface RoomSettings {
  maxParticipants: number;
  hostControlsMovie: boolean;
  guestCanRequestControl: boolean;
  sharedControls: boolean;
  theme: RoomTheme;
  passwordProtected: boolean;
  password?: string;
}

export interface Room {
  id: string;
  name: string;
  hostId: string;
  createdAt: number;
  settings: RoomSettings;
  movieTitle?: string;
  movieDuration?: number;
  movieSize?: number;
  movieResolution?: string;
}

export interface MovieFileMetadata {
  file: File | null;
  name: string;
  size: number;
  duration: number;
  resolution?: string;
  thumbnailUrl?: string;
  objectUrl?: string;
}

export interface PlaybackState {
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  buffered: number;
  volume: number;
  isMuted: boolean;
  playbackRate: number;
  lastActionTime: number;
  syncStatus: 'synced' | 'syncing' | 'delayed';
  drift: number;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: number;
  isSystem?: boolean;
}

export interface FloatingReaction {
  id: string;
  emoji: string;
  senderId: string;
  senderName: string;
  x: number; // percentage across screen
  y: number;
  timestamp: number;
}

export type SpecialInteractionType = 
  | 'heart-burst' 
  | 'virtual-hug' 
  | 'send-popcorn' 
  | 'miss-you' 
  | 'hand-holding' 
  | 'heartbeat';

export interface SpecialInteraction {
  id: string;
  type: SpecialInteractionType;
  senderId: string;
  senderName: string;
  timestamp: number;
  data?: any;
}

export interface WatchlistItem {
  id: string;
  title: string;
  description: string;
  genre: string;
  duration: string;
  rating: number;
  posterUrl: string;
  addedBy: string;
  watched: boolean;
  notes?: string;
  createdAt: number;
}

export interface MovieNightSummary {
  roomName: string;
  movieTitle: string;
  durationWatched: number;
  totalMovieDuration: number;
  sessionDuration: number;
  reactionsSentCount: number;
  participants: { name: string; role: ParticipantRole; mood?: UserMood }[];
  date: string;
  userRating: number;
  notes: string;
  favoriteMoment: string;
}

export interface UserPreferences {
  displayName: string;
  theme: RoomTheme;
  selectedCameraId: string;
  selectedMicId: string;
  selectedSpeakerId: string;
  cameraEnabled: boolean;
  micEnabled: boolean;
  movieVolume: number;
  voiceVolume: number;
  micVolume: number;
  audioDucking: boolean; // Lower movie volume when someone speaks
  noiseSuppression: boolean;
  echoCancellation: boolean;
  videoQuality: '1080p' | '720p' | '480p';
  webcamLayout: 'side-by-side' | 'floating-pip' | 'right-sidebar' | 'minimal-overlay';
}

export type ConnectionQuality = 'excellent' | 'good' | 'fair' | 'poor' | 'disconnected';

export interface ConnectionStats {
  quality: ConnectionQuality;
  latency: number; // ms
  iceConnectionState: RTCIceConnectionState | 'offline';
  signalingState: RTCSignalingState | 'offline';
  isReconnecting: boolean;
}

export interface SignalingPayload {
  roomId: string;
  senderId: string;
  type: 
    | 'join'
    | 'leave'
    | 'ready-toggle'
    | 'ready-countdown-start'
    | 'ready-countdown-cancel'
    | 'mood-change'
    | 'media-state-change'
    | 'sdp-offer'
    | 'sdp-answer'
    | 'ice-candidate'
    | 'movie-selected'
    | 'playback-control'
    | 'chat-message'
    | 'reaction'
    | 'special-interaction'
    | 'sync-heartbeat'
    | 'vibe-update';
  payload: any;
  timestamp: number;
}
