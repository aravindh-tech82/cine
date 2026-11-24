import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import {
  Room,
  Participant,
  RoomTheme,
  UserMood,
  ChatMessage,
  FloatingReaction,
  SpecialInteraction,
  SpecialInteractionType,
  WatchlistItem,
  MovieNightSummary,
  UserPreferences,
  ConnectionStats,
  MovieFileMetadata,
  PlaybackState,
} from '../types';
import { signalingService } from '../services/signaling';
import { WebRTCManager } from '../services/webrtc';
import { generateRoomId, generateVideoThumbnail, INITIAL_WATCHLIST } from '../utils/helpers';
import confetti from 'canvas-confetti';

interface CineMateContextType {
  // Navigation & View
  currentView: 'landing' | 'create-room' | 'join-room' | 'lobby' | 'movie-room' | 'watchlist' | 'summary';
  setCurrentView: (view: 'landing' | 'create-room' | 'join-room' | 'lobby' | 'movie-room' | 'watchlist' | 'summary') => void;
  isSettingsOpen: boolean;
  setIsSettingsOpen: (open: boolean) => void;

  // Session & Room
  room: Room | null;
  currentUser: Participant;
  friendUser: Participant | null;
  createRoom: (roomName: string, displayName: string, password?: string, theme?: RoomTheme) => string;
  joinRoom: (roomId: string, displayName: string, password?: string) => Promise<boolean>;
  leaveRoom: () => void;
  updateUserMood: (mood: UserMood) => void;
  toggleReady: () => void;
  isCountdownActive: boolean;
  countdownSeconds: number;
  cancelCountdown: () => void;

  // Media & Hardware
  localWebcamStream: MediaStream | null;
  remoteWebcamStream: MediaStream | null;
  availableCameras: MediaDeviceInfo[];
  availableMics: MediaDeviceInfo[];
  availableSpeakers: MediaDeviceInfo[];
  toggleCamera: () => void;
  toggleMic: () => void;
  switchCamera: (deviceId: string) => Promise<void>;
  switchMic: (deviceId: string) => Promise<void>;
  requestMediaPermissions: () => Promise<boolean>;

  // Movie & Streaming
  localMovieMetadata: MovieFileMetadata | null;
  remoteMovieStream: MediaStream | null;
  playbackState: PlaybackState;
  selectLocalMovieFile: (file: File) => Promise<void>;
  setMovieTitle: (title: string) => void;
  attachLocalVideoElement: (el: HTMLVideoElement) => void;
  attachRemoteVideoElement: (el: HTMLVideoElement) => void;
  playMovie: () => void;
  pauseMovie: () => void;
  seekMovie: (time: number) => void;
  skipMovie: (delta: number) => void;
  setMovieVolume: (volume: number) => void;
  toggleMovieMute: () => void;
  remoteAudioBlocked: boolean;
  unmuteRemoteAudio: () => void;

  // Live Chat
  chatMessages: ChatMessage[];
  unreadChatCount: number;
  isChatOpen: boolean;
  setIsChatOpen: (open: boolean) => void;
  friendIsTyping: boolean;
  sendChatMessage: (text: string) => void;
  setTyping: (isTyping: boolean) => void;

  // Reactions & Cute Long-Distance Interactions
  activeReactions: FloatingReaction[];
  sendReaction: (emoji: string) => void;
  activeSpecialInteraction: SpecialInteraction | null;
  triggerSpecialInteraction: (type: SpecialInteractionType) => void;
  closeSpecialInteraction: () => void;

  // Watchlist & Summary
  watchlist: WatchlistItem[];
  addToWatchlist: (item: Omit<WatchlistItem, 'id' | 'createdAt'>) => void;
  toggleWatchedInWatchlist: (id: string) => void;
  removeFromWatchlist: (id: string) => void;
  movieSummary: MovieNightSummary | null;
  endMovieNight: (notes?: string, rating?: number, favoriteMoment?: string) => void;

  // Settings & Preferences
  preferences: UserPreferences;
  updatePreferences: (updates: Partial<UserPreferences>) => void;
  connectionStats: ConnectionStats;
}

const CineMateContext = createContext<CineMateContextType | null>(null);

const DEFAULT_PREFERENCES: UserPreferences = {
  displayName: 'Alex',
  theme: 'midnight',
  selectedCameraId: '',
  selectedMicId: '',
  selectedSpeakerId: '',
  cameraEnabled: true,
  micEnabled: true,
  movieVolume: 0.85,
  voiceVolume: 1.0,
  micVolume: 1.0,
  audioDucking: true,
  noiseSuppression: true,
  echoCancellation: true,
  videoQuality: '1080p',
  webcamLayout: 'floating-pip',
};

export const CineMateProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Navigation
  const [currentView, setCurrentView] = useState<'landing' | 'create-room' | 'join-room' | 'lobby' | 'movie-room' | 'watchlist' | 'summary'>('landing');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // User Preferences
  const [preferences, setPreferences] = useState<UserPreferences>(() => {
    try {
      const saved = localStorage.getItem('cinemate_user_preferences');
      if (saved) return { ...DEFAULT_PREFERENCES, ...JSON.parse(saved) };
    } catch (e) {
      // Ignore
    }
    return DEFAULT_PREFERENCES;
  });

  // Room & Participants
  const [room, setRoom] = useState<Room | null>(null);
  const [currentUser, setCurrentUser] = useState<Participant>({
    id: 'user_' + Math.random().toString(36).substring(2, 9),
    name: preferences.displayName,
    role: 'host',
    isReady: false,
    cameraOn: preferences.cameraEnabled,
    micOn: preferences.micEnabled,
    speaking: false,
    mood: 'Cozy' as UserMood,
    joinedAt: Date.now(),
  });
  const [friendUser, setFriendUser] = useState<Participant | null>(null);

  // Pre-Movie Countdown
  const [isCountdownActive, setIsCountdownActive] = useState(false);
  const [countdownSeconds, setCountdownSeconds] = useState(3);
  const countdownIntervalRef = useRef<any>(null);

  // Media Devices
  const [availableCameras, setAvailableCameras] = useState<MediaDeviceInfo[]>([]);
  const [availableMics, setAvailableMics] = useState<MediaDeviceInfo[]>([]);
  const [availableSpeakers, setAvailableSpeakers] = useState<MediaDeviceInfo[]>([]);
  const [localWebcamStream, setLocalWebcamStream] = useState<MediaStream | null>(null);
  const [remoteWebcamStream, setRemoteWebcamStream] = useState<MediaStream | null>(null);

  // Movie & Playback
  const [localMovieMetadata, setLocalMovieMetadata] = useState<MovieFileMetadata | null>(null);
  const [remoteMovieStream, setRemoteMovieStream] = useState<MediaStream | null>(null);
  const [remoteAudioBlocked, setRemoteAudioBlocked] = useState(false);
  const localVideoElRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoElRef = useRef<HTMLVideoElement | null>(null);
  const movieNightStartTimeRef = useRef<number>(Date.now());
  const playMovieRef = useRef<() => void>(() => {});
  const pauseMovieRef = useRef<() => void>(() => {});
  const seekMovieRef = useRef<(time: number) => void>(() => {});

  const [playbackState, setPlaybackState] = useState<PlaybackState>({
    currentTime: 0,
    duration: 0,
    isPlaying: false,
    buffered: 0,
    volume: preferences.movieVolume,
    isMuted: false,
    playbackRate: 1,
    lastActionTime: Date.now(),
    syncStatus: 'synced',
    drift: 0,
  });

  // Chat
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [friendIsTyping, setFriendIsTyping] = useState(false);
  const typingTimeoutRef = useRef<any>(null);

  // Reactions & Cute Interactions
  const [activeReactions, setActiveReactions] = useState<FloatingReaction[]>([]);
  const [activeSpecialInteraction, setActiveSpecialInteraction] = useState<SpecialInteraction | null>(null);

  // Watchlist & Summary
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>(() => {
    try {
      const saved = localStorage.getItem('cinemate_watchlist');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      // Ignore
    }
    return INITIAL_WATCHLIST;
  });
  const [movieSummary, setMovieSummary] = useState<MovieNightSummary | null>(null);

  // Connection
  const [connectionStats, setConnectionStats] = useState<ConnectionStats>({
    quality: 'excellent',
    latency: 18,
    iceConnectionState: 'connected',
    signalingState: 'stable',
    isReconnecting: false,
  });

  const webrtcManagerRef = useRef<WebRTCManager | null>(null);

  // Save preferences
  useEffect(() => {
    try {
      localStorage.setItem('cinemate_user_preferences', JSON.stringify(preferences));
      document.documentElement.setAttribute('data-theme', preferences.theme);
    } catch (e) {
      // Ignore
    }
  }, [preferences]);

  // Save watchlist
  useEffect(() => {
    try {
      localStorage.setItem('cinemate_watchlist', JSON.stringify(watchlist));
    } catch (e) {
      // Ignore
    }
  }, [watchlist]);

  // Enumerate Media Devices
  const updateDeviceList = useCallback(async () => {
    try {
      if (!navigator.mediaDevices?.enumerateDevices) return;
      const devices = await navigator.mediaDevices.enumerateDevices();
      setAvailableCameras(devices.filter((d) => d.kind === 'videoinput'));
      setAvailableMics(devices.filter((d) => d.kind === 'audioinput'));
      setAvailableSpeakers(devices.filter((d) => d.kind === 'audiooutput'));
    } catch (err) {
      console.warn('Could not enumerate devices:', err);
    }
  }, []);

  useEffect(() => {
    updateDeviceList();
    navigator.mediaDevices?.addEventListener('devicechange', updateDeviceList);
    return () => {
      navigator.mediaDevices?.removeEventListener('devicechange', updateDeviceList);
    };
  }, [updateDeviceList]);

  // Request camera and microphone permissions
  const requestMediaPermissions = useCallback(async (): Promise<boolean> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: preferences.cameraEnabled ? {
          deviceId: preferences.selectedCameraId ? { exact: preferences.selectedCameraId } : undefined,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        } : false,
        audio: preferences.micEnabled ? {
          deviceId: preferences.selectedMicId ? { exact: preferences.selectedMicId } : undefined,
          echoCancellation: preferences.echoCancellation,
          noiseSuppression: preferences.noiseSuppression,
        } : false,
      });

      setLocalWebcamStream(stream);
      await updateDeviceList();

      // If WebRTC is already initialized, attach local stream
      if (webrtcManagerRef.current) {
        webrtcManagerRef.current.attachLocalWebcamStream(stream);
      }

      return true;
    } catch (err) {
      console.warn('Permission request or device access error:', err);
      return false;
    }
  }, [preferences, updateDeviceList]);

  // Toggle Camera
  const toggleCamera = useCallback(() => {
    const newState = !currentUser.cameraOn;
    setCurrentUser((prev) => ({ ...prev, cameraOn: newState }));
    setPreferences((prev) => ({ ...prev, cameraEnabled: newState }));

    if (localWebcamStream) {
      localWebcamStream.getVideoTracks().forEach((track) => {
        track.enabled = newState;
      });
    } else if (newState) {
      requestMediaPermissions();
    }

    signalingService.sendMessage('media-state-change', {
      cameraOn: newState,
      micOn: currentUser.micOn,
    });
  }, [currentUser, localWebcamStream, requestMediaPermissions]);

  // Toggle Microphone
  const toggleMic = useCallback(() => {
    const newState = !currentUser.micOn;
    setCurrentUser((prev) => ({ ...prev, micOn: newState }));
    setPreferences((prev) => ({ ...prev, micEnabled: newState }));

    if (localWebcamStream) {
      localWebcamStream.getAudioTracks().forEach((track) => {
        track.enabled = newState;
      });
    } else if (newState) {
      requestMediaPermissions();
    }

    signalingService.sendMessage('media-state-change', {
      cameraOn: currentUser.cameraOn,
      micOn: newState,
    });
  }, [currentUser, localWebcamStream, requestMediaPermissions]);

  // Switch Camera Device
  const switchCamera = useCallback(async (deviceId: string) => {
    setPreferences((prev) => ({ ...prev, selectedCameraId: deviceId }));
    try {
      if (localWebcamStream) {
        localWebcamStream.getVideoTracks().forEach((t) => t.stop());
      }
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: deviceId } },
        audio: localWebcamStream?.getAudioTracks().length ? true : false,
      });
      setLocalWebcamStream(newStream);
      webrtcManagerRef.current?.attachLocalWebcamStream(newStream);
    } catch (err) {
      console.error('Failed to switch camera device', err);
    }
  }, [localWebcamStream]);

  // Switch Mic Device
  const switchMic = useCallback(async (deviceId: string) => {
    setPreferences((prev) => ({ ...prev, selectedMicId: deviceId }));
    try {
      if (localWebcamStream) {
        localWebcamStream.getAudioTracks().forEach((t) => t.stop());
      }
      const newStream = await navigator.mediaDevices.getUserMedia({
        audio: { deviceId: { exact: deviceId } },
        video: localWebcamStream?.getVideoTracks().length ? true : false,
      });
      setLocalWebcamStream(newStream);
      webrtcManagerRef.current?.attachLocalWebcamStream(newStream);
    } catch (err) {
      console.error('Failed to switch mic device', err);
    }
  }, [localWebcamStream]);

  // Update preferences helper
  const updatePreferences = useCallback((updates: Partial<UserPreferences>) => {
    setPreferences((prev) => ({ ...prev, ...updates }));
    if (updates.displayName) {
      setCurrentUser((prev) => ({ ...prev, name: updates.displayName! }));
    }
  }, []);

  // Set Movie Title
  const setMovieTitle = useCallback((title: string) => {
    setLocalMovieMetadata((prev) => (prev ? { ...prev, name: title } : null));
    setRoom((prev) => (prev ? { ...prev, movieTitle: title } : null));
    signalingService.sendMessage('movie-selected', { title });
  }, []);

  // Update Mood
  const updateUserMood = useCallback((mood: UserMood) => {
    setCurrentUser((prev) => ({ ...prev, mood }));
    signalingService.sendMessage('mood-change', { mood });
  }, []);

  // Audio Ducking handler: Friend speaking
  const handleFriendSpeaking = useCallback((speaking: boolean) => {
    setFriendUser((prev) => (prev ? { ...prev, speaking } : null));

    if (preferences.audioDucking && localVideoElRef.current) {
      // Lower movie volume by 50% smoothly
      const targetVol = speaking ? preferences.movieVolume * 0.4 : preferences.movieVolume;
      localVideoElRef.current.volume = targetVol;
    }
    if (preferences.audioDucking && remoteVideoElRef.current) {
      const targetVol = speaking ? preferences.movieVolume * 0.4 : preferences.movieVolume;
      remoteVideoElRef.current.volume = targetVol;
    }
  }, [preferences.audioDucking, preferences.movieVolume]);

  // Setup WebRTC and Signaling listeners
  const setupConnection = useCallback((currentRoom: Room, userRole: 'host' | 'guest') => {
    // 1. Join Signaling
    signalingService.joinRoom(currentRoom.id, currentUser.id, (msg) => {
      handleSignalingMessage(msg);
    });

    // 2. Initialize WebRTC
    const rtc = new WebRTCManager();
    webrtcManagerRef.current = rtc;

    rtc.init({
      roomId: currentRoom.id,
      userId: currentUser.id,
      isHost: userRole === 'host',
      onRemoteWebcamStream: (stream) => {
        console.log('[Context] Received remote webcam stream');
        setRemoteWebcamStream(stream);
      },
      onRemoteMovieStream: (stream) => {
        console.log('[Context] Received remote movie stream for guest');
        setRemoteMovieStream(stream);
      },
      onDataChannelMessage: (data) => {
        handlePlaybackControlMessage(data);
      },
      onConnectionStateChange: (state) => {
        setConnectionStats((prev) => ({
          ...prev,
          iceConnectionState: state as any,
          quality: state === 'connected' ? 'excellent' : state === 'connecting' ? 'fair' : 'poor',
        }));
      },
      onSpeakingStateChange: (speaking) => {
        handleFriendSpeaking(speaking);
      },
    });

    // Send join announcement
    signalingService.sendMessage('join', {
      user: {
        id: currentUser.id,
        name: currentUser.name,
        role: userRole,
        isReady: currentUser.isReady,
        cameraOn: currentUser.cameraOn,
        micOn: currentUser.micOn,
        mood: currentUser.mood,
      },
      roomName: currentRoom.name,
      settings: currentRoom.settings,
    });
  }, [currentUser, handleFriendSpeaking]);

  // Handle incoming signaling message
  const handleSignalingMessage = useCallback((msg: any) => {
    const { type, payload, senderId } = msg;

    switch (type) {
      case 'join': {
        // A peer joined
        const incomingUser = payload.user;
        setFriendUser({
          id: incomingUser.id,
          name: incomingUser.name,
          role: incomingUser.role,
          isReady: incomingUser.isReady || false,
          cameraOn: incomingUser.cameraOn ?? true,
          micOn: incomingUser.micOn ?? true,
          speaking: false,
          mood: incomingUser.mood || 'Cozy',
          joinedAt: Date.now(),
        });

        // Add system chat message
        setChatMessages((prev) => [
          ...prev,
          {
            id: 'sys_' + Date.now(),
            senderId: 'system',
            senderName: 'CineMate',
            text: `${incomingUser.name} joined your private room 🍿`,
            timestamp: Date.now(),
            isSystem: true,
          },
        ]);

        // If I am host, send my presence back to ensure two-way awareness
        if (currentUser.role === 'host') {
          signalingService.sendMessage('join', {
            user: {
              id: currentUser.id,
              name: currentUser.name,
              role: 'host',
              isReady: currentUser.isReady,
              cameraOn: currentUser.cameraOn,
              micOn: currentUser.micOn,
              mood: currentUser.mood,
            },
          });
          // Also if movie is selected, notify the joining guest
          if (localMovieMetadata) {
            signalingService.sendMessage('movie-selected', {
              title: localMovieMetadata.name,
              duration: localMovieMetadata.duration,
              size: localMovieMetadata.size,
              resolution: localMovieMetadata.resolution,
            });
          }

          // If local movie video is attached, ensure its tracks are captured
          if (localVideoElRef.current) {
            webrtcManagerRef.current?.attachLocalMovieStream(localVideoElRef.current);
          }

          // Negotiate with the newly joined peer
          setTimeout(() => {
            webrtcManagerRef.current?.initiateOffer();
          }, 300);
        }
        break;
      }

      case 'leave': {
        setFriendUser(null);
        setChatMessages((prev) => [
          ...prev,
          {
            id: 'sys_' + Date.now(),
            senderId: 'system',
            senderName: 'CineMate',
            text: 'Your friend has disconnected.',
            timestamp: Date.now(),
            isSystem: true,
          },
        ]);
        break;
      }

      case 'ready-toggle': {
        setFriendUser((prev) => (prev ? { ...prev, isReady: payload.isReady } : null));
        break;
      }

      case 'ready-countdown-start': {
        startSynchronizedCountdown();
        break;
      }

      case 'ready-countdown-cancel': {
        cancelCountdownLocal();
        break;
      }

      case 'mood-change': {
        setFriendUser((prev) => (prev ? { ...prev, mood: payload.mood } : null));
        break;
      }

      case 'media-state-change': {
        setFriendUser((prev) => (prev ? { ...prev, cameraOn: payload.cameraOn, micOn: payload.micOn } : null));
        break;
      }

      case 'movie-selected': {
        setRoom((prev) => (prev ? { ...prev, movieTitle: payload.title, movieDuration: payload.duration } : null));
        setPlaybackState((prev) => ({ ...prev, duration: payload.duration || prev.duration }));
        setChatMessages((prev) => [
          ...prev,
          {
            id: 'sys_' + Date.now(),
            senderId: 'system',
            senderName: 'CineMate',
            text: `Host selected movie: "${payload.title}" 🎬`,
            timestamp: Date.now(),
            isSystem: true,
          },
        ]);
        break;
      }

      case 'playback-control': {
        handlePlaybackControlMessage(payload);
        break;
      }

      case 'chat-message': {
        setChatMessages((prev) => [...prev, payload]);
        if (!isChatOpen) {
          setUnreadChatCount((prev) => prev + 1);
        }
        break;
      }

      case 'reaction': {
        displayReaction(payload);
        break;
      }

      case 'special-interaction': {
        handleReceivedSpecialInteraction(payload);
        break;
      }

      case 'sync-heartbeat': {
        if (currentUser.role === 'guest') {
          setPlaybackState((prev) => ({
            ...prev,
            currentTime: payload.time !== undefined ? payload.time : prev.currentTime,
            duration: payload.duration || prev.duration,
            isPlaying: payload.isPlaying !== undefined ? payload.isPlaying : prev.isPlaying,
            syncStatus: 'synced',
            drift: 0,
          }));
        }
        break;
      }
    }
  }, [currentUser, isChatOpen, localMovieMetadata]);

  // Handle Playback Control Commands (Play, Pause, Seek, Sync)
  const handlePlaybackControlMessage = useCallback((data: any) => {
    if (!data || !data.action) return;

    if (currentUser.role === 'host') {
      switch (data.action) {
        case 'REQUEST_PLAY': {
          playMovieRef.current();
          break;
        }
        case 'REQUEST_PAUSE': {
          pauseMovieRef.current();
          break;
        }
        case 'REQUEST_SEEK': {
          if (typeof data.time === 'number') {
            seekMovieRef.current(data.time);
          }
          break;
        }
      }
    } else {
      // Guest receives authoritative actions from host
      switch (data.action) {
        case 'PLAY': {
          setPlaybackState((prev) => ({
            ...prev,
            isPlaying: true,
            currentTime: typeof data.time === 'number' ? data.time : prev.currentTime,
            duration: data.duration || prev.duration,
          }));
          if (remoteVideoElRef.current) {
            remoteVideoElRef.current.play().catch((err) => {
              if (err.name === 'NotAllowedError') {
                remoteVideoElRef.current!.muted = true;
                setRemoteAudioBlocked(true);
                remoteVideoElRef.current!.play().catch(console.warn);
              }
            });
          }
          break;
        }
        case 'PAUSE': {
          setPlaybackState((prev) => ({
            ...prev,
            isPlaying: false,
            currentTime: typeof data.time === 'number' ? data.time : prev.currentTime,
          }));
          remoteVideoElRef.current?.pause();
          break;
        }
        case 'SEEK': {
          setPlaybackState((prev) => ({
            ...prev,
            currentTime: typeof data.time === 'number' ? data.time : prev.currentTime,
            duration: data.duration || prev.duration,
          }));
          break;
        }
        case 'HEARTBEAT': {
          setPlaybackState((prev) => ({
            ...prev,
            currentTime: typeof data.time === 'number' ? data.time : prev.currentTime,
            duration: data.duration || prev.duration,
            isPlaying: data.isPlaying !== undefined ? data.isPlaying : prev.isPlaying,
            syncStatus: 'synced',
          }));
          break;
        }
      }
    }
  }, [currentUser.role]);

  // Synchronized countdown logic
  const startSynchronizedCountdown = () => {
    setIsCountdownActive(true);
    setCountdownSeconds(3);

    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);

    let sec = 3;
    countdownIntervalRef.current = setInterval(() => {
      sec -= 1;
      setCountdownSeconds(sec);
      if (sec <= 0) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
        setIsCountdownActive(false);

        // Confetti celebration!
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#A78BFA', '#E0B8FF', '#F0C9D8', '#FF647C'],
        });

        // Switch both to Movie Room!
        setCurrentView('movie-room');
        movieNightStartTimeRef.current = Date.now();
      }
    }, 1000);
  };

  const cancelCountdownLocal = () => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    setIsCountdownActive(false);
  };

  const cancelCountdown = () => {
    cancelCountdownLocal();
    signalingService.sendMessage('ready-countdown-cancel', {});
  };

  // Toggle Ready in Lobby
  const toggleReady = () => {
    const newReady = !currentUser.isReady;
    setCurrentUser((prev) => ({ ...prev, isReady: newReady }));
    signalingService.sendMessage('ready-toggle', { isReady: newReady });

    // If friend is already ready, start countdown!
    if (newReady && friendUser?.isReady) {
      signalingService.sendMessage('ready-countdown-start', {});
      startSynchronizedCountdown();
    }
  };

  // Create Room
  const createRoom = (roomName: string, displayName: string, password?: string, theme: RoomTheme = 'midnight'): string => {
    const roomId = generateRoomId();
    const newRoom: Room = {
      id: roomId,
      name: roomName || `${displayName}'s Cinema`,
      hostId: currentUser.id,
      createdAt: Date.now(),
      settings: {
        maxParticipants: 2,
        hostControlsMovie: false,
        guestCanRequestControl: true,
        sharedControls: true,
        theme,
        passwordProtected: !!password,
        password,
      },
    };

    setRoom(newRoom);
    setCurrentUser((prev) => ({
      ...prev,
      name: displayName || prev.name,
      role: 'host',
      isReady: false,
    }));
    setPreferences((prev) => ({ ...prev, displayName, theme }));

    setupConnection(newRoom, 'host');
    requestMediaPermissions();
    setCurrentView('lobby');

    return roomId;
  };

  // Join Room
  const joinRoom = async (roomId: string, displayName: string, password?: string): Promise<boolean> => {
    const cleanRoomId = roomId.trim().toLowerCase();
    const newRoom: Room = {
      id: cleanRoomId,
      name: `CineMate Room`,
      hostId: '',
      createdAt: Date.now(),
      settings: {
        maxParticipants: 2,
        hostControlsMovie: false,
        guestCanRequestControl: true,
        sharedControls: true,
        theme: preferences.theme,
        passwordProtected: !!password,
        password,
      },
    };

    setRoom(newRoom);
    setCurrentUser((prev) => ({
      ...prev,
      name: displayName || prev.name,
      role: 'guest',
      isReady: false,
    }));
    setPreferences((prev) => ({ ...prev, displayName }));

    setupConnection(newRoom, 'guest');
    await requestMediaPermissions();
    setCurrentView('lobby');

    return true;
  };

  // Leave Room
  const leaveRoom = () => {
    signalingService.sendMessage('leave', { userId: currentUser.id });
    signalingService.leaveRoom();
    webrtcManagerRef.current?.destroy();
    webrtcManagerRef.current = null;

    if (localWebcamStream) {
      localWebcamStream.getTracks().forEach((t) => t.stop());
      setLocalWebcamStream(null);
    }
    setRemoteWebcamStream(null);
    setRemoteMovieStream(null);
    setLocalMovieMetadata(null);
    setRoom(null);
    setFriendUser(null);
    setCurrentView('landing');
  };

  // Select Local Movie File
  const selectLocalMovieFile = async (file: File) => {
    const objectUrl = URL.createObjectURL(file);
    const { thumbnailUrl, duration, resolution } = await generateVideoThumbnail(file);

    const metadata: MovieFileMetadata = {
      file,
      name: file.name.replace(/\.[^/.]+$/, ''),
      size: file.size,
      duration,
      resolution,
      thumbnailUrl,
      objectUrl,
    };

    setLocalMovieMetadata(metadata);
    setRoom((prev) => (prev ? {
      ...prev,
      movieTitle: metadata.name,
      movieDuration: duration,
      movieSize: file.size,
      movieResolution: resolution,
    } : null));

    // Broadcast selection to guest
    signalingService.sendMessage('movie-selected', {
      title: metadata.name,
      duration,
      size: file.size,
      resolution,
    });
  };

  // Attach local video element and start stream capture
  const attachLocalVideoElement = useCallback((el: HTMLVideoElement) => {
    localVideoElRef.current = el;
    if (el && webrtcManagerRef.current) {
      const capture = () => {
        console.log('[Context] Capturing movie stream from video element, readyState:', el.readyState);
        webrtcManagerRef.current?.attachLocalMovieStream(el);
      };

      if (el.readyState >= 1) {
        capture();
      }

      el.addEventListener('loadedmetadata', capture);
      el.addEventListener('canplay', capture);
      el.addEventListener('play', capture);
    }
  }, []);

  const safelyPlayRemoteVideo = useCallback((el: HTMLVideoElement) => {
    if (!el) return;
    const playPromise = el.play();
    if (playPromise !== undefined) {
      playPromise.catch((err: any) => {
        console.warn('[Context] Remote movie autoplay caught:', err.name);
        if (err.name === 'NotAllowedError') {
          el.muted = true;
          setRemoteAudioBlocked(true);
          el.play().catch(console.warn);
        }
      });
    }
  }, []);

  const unmuteRemoteAudio = useCallback(() => {
    if (remoteVideoElRef.current) {
      remoteVideoElRef.current.muted = false;
      remoteVideoElRef.current.volume = playbackState.volume || 0.85;
      setRemoteAudioBlocked(false);
      setPlaybackState((prev) => ({ ...prev, isMuted: false }));
    }
  }, [playbackState.volume]);

  const attachRemoteVideoElement = useCallback((el: HTMLVideoElement) => {
    remoteVideoElRef.current = el;
    if (el && remoteMovieStream) {
      if (el.srcObject !== remoteMovieStream) {
        el.srcObject = remoteMovieStream;
      }
      safelyPlayRemoteVideo(el);
    }
  }, [remoteMovieStream, safelyPlayRemoteVideo]);

  // Sync Video Elements with WebRTC remote stream
  useEffect(() => {
    if (remoteVideoElRef.current && remoteMovieStream) {
      if (remoteVideoElRef.current.srcObject !== remoteMovieStream) {
        remoteVideoElRef.current.srcObject = remoteMovieStream;
      }
      safelyPlayRemoteVideo(remoteVideoElRef.current);
    }
  }, [remoteMovieStream, safelyPlayRemoteVideo]);

  // Video Player Controls (Host authoritative, Guest request-based)
  const playMovie = useCallback(() => {
    if (currentUser.role === 'host') {
      const video = localVideoElRef.current;
      if (!video) return;

      webrtcManagerRef.current?.attachLocalMovieStream(video);

      video.play().catch(console.warn);
      setPlaybackState((prev) => ({
        ...prev,
        isPlaying: true,
        currentTime: video.currentTime,
        duration: video.duration || prev.duration,
      }));

      const payload = {
        action: 'PLAY',
        time: video.currentTime,
        duration: video.duration || 0,
        timestamp: Date.now(),
      };
      const sent = webrtcManagerRef.current?.sendData(payload);
      if (!sent) signalingService.sendMessage('playback-control', payload);
    } else {
      const payload = { action: 'REQUEST_PLAY', timestamp: Date.now() };
      const sent = webrtcManagerRef.current?.sendData(payload);
      if (!sent) signalingService.sendMessage('playback-control', payload);
    }
  }, [currentUser.role]);

  const pauseMovie = useCallback(() => {
    if (currentUser.role === 'host') {
      const video = localVideoElRef.current;
      if (!video) return;

      video.pause();
      setPlaybackState((prev) => ({
        ...prev,
        isPlaying: false,
        currentTime: video.currentTime,
      }));

      const payload = {
        action: 'PAUSE',
        time: video.currentTime,
        timestamp: Date.now(),
      };
      const sent = webrtcManagerRef.current?.sendData(payload);
      if (!sent) signalingService.sendMessage('playback-control', payload);
    } else {
      const payload = { action: 'REQUEST_PAUSE', timestamp: Date.now() };
      const sent = webrtcManagerRef.current?.sendData(payload);
      if (!sent) signalingService.sendMessage('playback-control', payload);
    }
  }, [currentUser.role]);

  const seekMovie = useCallback((time: number) => {
    if (currentUser.role === 'host') {
      const video = localVideoElRef.current;
      if (video) {
        video.currentTime = time;
        setPlaybackState((prev) => ({ ...prev, currentTime: time }));

        const payload = {
          action: 'SEEK',
          time,
          duration: video.duration || 0,
          timestamp: Date.now(),
        };
        const sent = webrtcManagerRef.current?.sendData(payload);
        if (!sent) signalingService.sendMessage('playback-control', payload);
      }
    } else {
      const payload = { action: 'REQUEST_SEEK', time, timestamp: Date.now() };
      const sent = webrtcManagerRef.current?.sendData(payload);
      if (!sent) signalingService.sendMessage('playback-control', payload);
    }
  }, [currentUser.role]);

  const skipMovie = useCallback((delta: number) => {
    if (currentUser.role === 'host') {
      const video = localVideoElRef.current;
      if (video) {
        const newTime = Math.max(0, Math.min(video.duration || 99999, video.currentTime + delta));
        seekMovie(newTime);
      }
    } else {
      const newTime = Math.max(0, Math.min(playbackState.duration || 99999, playbackState.currentTime + delta));
      seekMovie(newTime);
    }
  }, [currentUser.role, playbackState.duration, playbackState.currentTime, seekMovie]);

  // Keep control refs synchronized
  useEffect(() => {
    playMovieRef.current = playMovie;
    pauseMovieRef.current = pauseMovie;
    seekMovieRef.current = seekMovie;
  }, [playMovie, pauseMovie, seekMovie]);

  const setMovieVolume = (vol: number) => {
    setPlaybackState((prev) => ({ ...prev, volume: vol, isMuted: vol === 0 }));
    if (localVideoElRef.current) localVideoElRef.current.volume = vol;
    if (remoteVideoElRef.current) remoteVideoElRef.current.volume = vol;
  };

  const toggleMovieMute = () => {
    const newMuted = !playbackState.isMuted;
    setPlaybackState((prev) => ({ ...prev, isMuted: newMuted }));
    if (localVideoElRef.current) localVideoElRef.current.muted = newMuted;
    if (remoteVideoElRef.current) remoteVideoElRef.current.muted = newMuted;
  };

  // Heartbeat playback sync (host sends authoritative time to guest)
  useEffect(() => {
    if (currentUser.role !== 'host') return;
    const interval = setInterval(() => {
      if (localVideoElRef.current && playbackState.isPlaying) {
        const payload = {
          time: localVideoElRef.current.currentTime,
          duration: localVideoElRef.current.duration || 0,
          isPlaying: !localVideoElRef.current.paused,
        };
        const sent = webrtcManagerRef.current?.sendData({ action: 'HEARTBEAT', ...payload });
        if (!sent) signalingService.sendMessage('sync-heartbeat', payload);
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [currentUser.role, playbackState.isPlaying]);

  // Live Chat
  const sendChatMessage = (text: string) => {
    if (!text.trim()) return;
    const msg: ChatMessage = {
      id: 'msg_' + Date.now(),
      senderId: currentUser.id,
      senderName: currentUser.name,
      text: text.trim(),
      timestamp: Date.now(),
    };
    setChatMessages((prev) => [...prev, msg]);
    signalingService.sendMessage('chat-message', msg);
  };

  const setTyping = (typing: boolean) => {
    // Optional typing indicator
  };

  // Floating Reactions
  const displayReaction = (reaction: FloatingReaction) => {
    setActiveReactions((prev) => [...prev, reaction]);
    setTimeout(() => {
      setActiveReactions((prev) => prev.filter((r) => r.id !== reaction.id));
    }, 2400);
  };

  const sendReaction = (emoji: string) => {
    const reaction: FloatingReaction = {
      id: 'react_' + Math.random().toString(36).substring(2, 9),
      emoji,
      senderId: currentUser.id,
      senderName: currentUser.name,
      x: 15 + Math.random() * 70, // 15% to 85% width
      y: 60 + Math.random() * 20,
      timestamp: Date.now(),
    };
    displayReaction(reaction);
    signalingService.sendMessage('reaction', reaction);
  };

  // Cute Long-Distance Interactions
  const triggerSpecialInteraction = (type: SpecialInteractionType) => {
    const interaction: SpecialInteraction = {
      id: 'int_' + Date.now(),
      type,
      senderId: currentUser.id,
      senderName: currentUser.name,
      timestamp: Date.now(),
    };

    setActiveSpecialInteraction(interaction);
    signalingService.sendMessage('special-interaction', interaction);

    if (type === 'heart-burst') {
      confetti({
        particleCount: 100,
        spread: 90,
        origin: { y: 0.5 },
        colors: ['#f472b6', '#fb7185', '#fda4af', '#f43f5e'],
      });
    }
  };

  const handleReceivedSpecialInteraction = (interaction: SpecialInteraction) => {
    setActiveSpecialInteraction(interaction);
    if (interaction.type === 'heart-burst') {
      confetti({
        particleCount: 100,
        spread: 90,
        origin: { y: 0.5 },
        colors: ['#f472b6', '#fb7185', '#fda4af', '#f43f5e'],
      });
    }
  };

  const closeSpecialInteraction = () => {
    setActiveSpecialInteraction(null);
  };

  // Watchlist Actions
  const addToWatchlist = (item: Omit<WatchlistItem, 'id' | 'createdAt'>) => {
    const newItem: WatchlistItem = {
      ...item,
      id: 'watch_' + Date.now(),
      createdAt: Date.now(),
    };
    setWatchlist((prev) => [newItem, ...prev]);
  };

  const toggleWatchedInWatchlist = (id: string) => {
    setWatchlist((prev) =>
      prev.map((item) => (item.id === id ? { ...item, watched: !item.watched } : item))
    );
  };

  const removeFromWatchlist = (id: string) => {
    setWatchlist((prev) => prev.filter((item) => item.id !== id));
  };

  // End Movie Night & Summary
  const endMovieNight = (notes: string = '', rating: number = 5, favoriteMoment: string = '') => {
    const durationWatched = playbackState.currentTime;
    const sessionDuration = Math.round((Date.now() - movieNightStartTimeRef.current) / 1000);

    const summary: MovieNightSummary = {
      roomName: room?.name || 'CineMate Room',
      movieTitle: room?.movieTitle || localMovieMetadata?.name || 'Our Movie',
      durationWatched,
      totalMovieDuration: playbackState.duration || 7200,
      sessionDuration,
      reactionsSentCount: activeReactions.length + 12,
      participants: [
        { name: currentUser.name, role: currentUser.role, mood: currentUser.mood },
        ...(friendUser ? [{ name: friendUser.name, role: friendUser.role, mood: friendUser.mood }] : []),
      ],
      date: new Date().toLocaleDateString(undefined, {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      }),
      userRating: rating,
      notes,
      favoriteMoment,
    };

    setMovieSummary(summary);
    setCurrentView('summary');
  };

  return (
    <CineMateContext.Provider
      value={{
        currentView,
        setCurrentView,
        isSettingsOpen,
        setIsSettingsOpen,
        room,
        currentUser,
        friendUser,
        createRoom,
        joinRoom,
        leaveRoom,
        updateUserMood,
        toggleReady,
        isCountdownActive,
        countdownSeconds,
        cancelCountdown,
        localWebcamStream,
        remoteWebcamStream,
        availableCameras,
        availableMics,
        availableSpeakers,
        toggleCamera,
        toggleMic,
        switchCamera,
        switchMic,
        requestMediaPermissions,
        localMovieMetadata,
        remoteMovieStream,
        playbackState,
        selectLocalMovieFile,
        setMovieTitle,
        attachLocalVideoElement,
        attachRemoteVideoElement,
        playMovie,
        pauseMovie,
        seekMovie,
        skipMovie,
        setMovieVolume,
        toggleMovieMute,
        remoteAudioBlocked,
        unmuteRemoteAudio,
        chatMessages,
        unreadChatCount,
        isChatOpen,
        setIsChatOpen,
        friendIsTyping,
        sendChatMessage,
        setTyping,
        activeReactions,
        sendReaction,
        activeSpecialInteraction,
        triggerSpecialInteraction,
        closeSpecialInteraction,
        watchlist,
        addToWatchlist,
        toggleWatchedInWatchlist,
        removeFromWatchlist,
        movieSummary,
        endMovieNight,
        preferences,
        updatePreferences,
        connectionStats,
      }}
    >
      {children}
    </CineMateContext.Provider>
  );
};

export const useCineMate = () => {
  const context = useContext(CineMateContext);
  if (!context) {
    throw new Error('useCineMate must be used within a CineMateProvider');
  }
  return context;
};

