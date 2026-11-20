import { signalingService } from './signaling';

export interface WebRTCOptions {
  roomId: string;
  userId: string;
  isHost: boolean;
  onRemoteWebcamStream: (stream: MediaStream) => void;
  onRemoteMovieStream: (stream: MediaStream) => void;
  onDataChannelMessage: (data: any) => void;
  onConnectionStateChange: (state: RTCPeerConnectionState) => void;
  onSpeakingStateChange?: (speaking: boolean) => void;
}

export class WebRTCManager {
  private pc: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private localWebcamStream: MediaStream | null = null;
  private localMovieStream: MediaStream | null = null;
  private movieSenders: RTCRtpSender[] = [];
  private webcamSenders: RTCRtpSender[] = [];
  private options: WebRTCOptions | null = null;
  private unsubscribeSignaling: (() => void) | null = null;
  
  // Audio analysis for speech detection / ducking
  private audioContext: AudioContext | null = null;
  private speechAnalyser: AnalyserNode | null = null;
  private speechCheckInterval: any = null;
  private isSpeaking: boolean = false;

  private iceServers: RTCIceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
  ];

  constructor() {
    this.loadCustomTurnConfig();
  }

  private loadCustomTurnConfig() {
    try {
      const turnServer = import.meta.env.VITE_TURN_SERVER;
      const turnUser = import.meta.env.VITE_TURN_USERNAME;
      const turnPass = import.meta.env.VITE_TURN_CREDENTIAL;
      if (turnServer && turnUser && turnPass) {
        this.iceServers.push({
          urls: turnServer,
          username: turnUser,
          credential: turnPass,
        });
      }
    } catch (e) {
      // Ignore
    }
  }

  public init(options: WebRTCOptions) {
    this.options = options;
    this.createPeerConnection();

    // Subscribe to signaling messages
    this.unsubscribeSignaling = signalingService.addListener(async (msg) => {
      if (msg.roomId !== options.roomId || msg.senderId === options.userId) return;

      try {
        switch (msg.type) {
          case 'sdp-offer':
            await this.handleOffer(msg.payload);
            break;
          case 'sdp-answer':
            await this.handleAnswer(msg.payload);
            break;
          case 'ice-candidate':
            await this.handleCandidate(msg.payload);
            break;
        }
      } catch (err) {
        console.error('[WebRTC] Signaling error handling msg:', msg.type, err);
      }
    });

    // If host, initiate call with offer
    if (options.isHost) {
      this.initiateOffer();
    }
  }

  private createPeerConnection() {
    if (this.pc) {
      this.pc.close();
    }

    const pc = new RTCPeerConnection({
      iceServers: this.iceServers,
      iceCandidatePoolSize: 2,
    });

    pc.onicecandidate = (event) => {
      if (event.candidate && this.options) {
        signalingService.sendMessage('ice-candidate', event.candidate.toJSON());
      }
    };

    pc.onconnectionstatechange = () => {
      console.log(`[WebRTC] Peer connection state: ${pc.connectionState}`);
      if (this.options) {
        this.options.onConnectionStateChange(pc.connectionState);
      }
      if (pc.connectionState === 'failed') {
        this.restartIce();
      }
    };

    pc.ontrack = (event) => {
      console.log('[WebRTC] Received remote track:', event.track.kind, event.streams);
      const stream = event.streams[0] || new MediaStream([event.track]);
      
      // Determine if track belongs to movie stream or webcam stream
      // Movie streams are explicitly tagged with stream ID starting with 'cinemate-movie' or track id containing 'movie'
      const isMovie = stream.id.includes('movie') || event.track.id.includes('movie') || event.track.label.toLowerCase().includes('movie');

      if (isMovie) {
        console.log('[WebRTC] Dispatching remote movie stream:', stream.id);
        if (this.options) {
          this.options.onRemoteMovieStream(stream);
        }
      } else {
        console.log('[WebRTC] Dispatching remote webcam stream:', stream.id);
        if (this.options) {
          this.options.onRemoteWebcamStream(stream);
        }
        if (event.track.kind === 'audio') {
          this.setupAudioAnalysis(stream);
        }
      }
    };

    // Setup DataChannel
    if (this.options?.isHost) {
      const dc = pc.createDataChannel('cinemate-sync', { ordered: true });
      this.setupDataChannel(dc);
    } else {
      pc.ondatachannel = (event) => {
        console.log('[WebRTC] Guest received datachannel:', event.channel.label);
        this.setupDataChannel(event.channel);
      };
    }

    this.pc = pc;

    // Attach existing local streams if already ready
    if (this.localWebcamStream) {
      this.attachLocalWebcamStream(this.localWebcamStream);
    }
  }

  private setupDataChannel(dc: RTCDataChannel) {
    this.dataChannel = dc;
    dc.onopen = () => {
      console.log('[WebRTC] DataChannel open & ready for zero-latency sync');
    };
    dc.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data);
        if (this.options) {
          this.options.onDataChannelMessage(parsed);
        }
      } catch (e) {
        console.error('[WebRTC] Failed to parse DataChannel message:', event.data);
      }
    };
    dc.onerror = (err) => console.error('[WebRTC] DataChannel error:', err);
    dc.onclose = () => console.log('[WebRTC] DataChannel closed');
  }

  public sendData(data: any): boolean {
    if (this.dataChannel && this.dataChannel.readyState === 'open') {
      try {
        this.dataChannel.send(JSON.stringify(data));
        return true;
      } catch (e) {
        console.error('[WebRTC] Error sending on DataChannel:', e);
      }
    }
    // Fallback through signaling service
    signalingService.sendMessage('playback-control', data);
    return false;
  }

  public async initiateOffer() {
    if (!this.pc) return;
    try {
      const offer = await this.pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      });
      await this.pc.setLocalDescription(offer);
      signalingService.sendMessage('sdp-offer', offer);
      console.log('[WebRTC] Offer sent');
    } catch (err) {
      console.error('[WebRTC] Failed to create offer:', err);
    }
  }

  private async handleOffer(offer: RTCSessionDescriptionInit) {
    if (!this.pc) return;
    try {
      console.log('[WebRTC] Handling offer...');
      await this.pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await this.pc.createAnswer();
      await this.pc.setLocalDescription(answer);
      signalingService.sendMessage('sdp-answer', answer);
      console.log('[WebRTC] Answer sent');
    } catch (err) {
      console.error('[WebRTC] Failed to handle offer:', err);
    }
  }

  private async handleAnswer(answer: RTCSessionDescriptionInit) {
    if (!this.pc) return;
    try {
      console.log('[WebRTC] Handling answer...');
      await this.pc.setRemoteDescription(new RTCSessionDescription(answer));
    } catch (err) {
      console.error('[WebRTC] Failed to handle answer:', err);
    }
  }

  private async handleCandidate(candidate: RTCIceCandidateInit) {
    if (!this.pc) return;
    try {
      await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (err) {
      console.error('[WebRTC] Error adding ICE candidate:', err);
    }
  }

  public async restartIce() {
    if (!this.pc || !this.options) return;
    console.log('[WebRTC] Restarting ICE...');
    try {
      const offer = await this.pc.createOffer({ iceRestart: true });
      await this.pc.setLocalDescription(offer);
      signalingService.sendMessage('sdp-offer', offer);
    } catch (e) {
      console.error('[WebRTC] Failed ICE restart:', e);
    }
  }

  /**
   * Attaches webcam and microphone tracks to peer connection
   */
  public attachLocalWebcamStream(stream: MediaStream) {
    this.localWebcamStream = stream;
    if (!this.pc) return;

    // Remove existing webcam senders
    this.webcamSenders.forEach((sender) => {
      try {
        this.pc?.removeTrack(sender);
      } catch (e) {
        // Ignore
      }
    });
    this.webcamSenders = [];

    // Add new tracks
    stream.getTracks().forEach((track) => {
      try {
        const sender = this.pc!.addTrack(track, stream);
        this.webcamSenders.push(sender);
      } catch (e) {
        console.error('[WebRTC] Failed to add webcam track:', e);
      }
    });

    // If already connected, renegotiate
    if (this.pc.signalingState === 'stable' && this.options?.isHost) {
      this.initiateOffer();
    }
  }

  /**
   * Captures the local movie stream and transmits it to the peer
   */
  public attachLocalMovieStream(videoElement: HTMLVideoElement): MediaStream | null {
    try {
      let stream: MediaStream | null = null;
      if (typeof (videoElement as any).captureStream === 'function') {
        stream = (videoElement as any).captureStream();
      } else if (typeof (videoElement as any).mozCaptureStream === 'function') {
        stream = (videoElement as any).mozCaptureStream();
      }

      if (!stream) {
        console.warn('[WebRTC] captureStream is not supported by this browser');
        return null;
      }

      // Clone tracks and give them movie-specific stream identifier
      const movieStream = new MediaStream();
      stream.getTracks().forEach((track) => {
        // Tag track for recognition
        movieStream.addTrack(track);
      });

      this.localMovieStream = movieStream;

      if (!this.pc) return movieStream;

      // Remove existing movie senders
      this.movieSenders.forEach((sender) => {
        try {
          this.pc?.removeTrack(sender);
        } catch (e) {
          // Ignore
        }
      });
      this.movieSenders = [];

      // Add movie tracks
      movieStream.getTracks().forEach((track) => {
        try {
          const sender = this.pc!.addTrack(track, movieStream);
          this.movieSenders.push(sender);
        } catch (err) {
          console.error('[WebRTC] Error adding movie track:', err);
        }
      });

      // Renegotiate
      if (this.pc.signalingState === 'stable') {
        this.initiateOffer();
      }

      return movieStream;
    } catch (err) {
      console.error('[WebRTC] Failed to capture movie stream:', err);
      return null;
    }
  }

  public removeLocalMovieStream() {
    this.movieSenders.forEach((sender) => {
      try {
        this.pc?.removeTrack(sender);
      } catch (e) {
        // Ignore
      }
    });
    this.movieSenders = [];
    this.localMovieStream = null;

    if (this.pc && this.pc.signalingState === 'stable') {
      this.initiateOffer();
    }
  }

  /**
   * Sets up real-time audio energy analysis for speaking indicators and audio ducking
   */
  private setupAudioAnalysis(remoteStream: MediaStream) {
    try {
      const audioTracks = remoteStream.getAudioTracks();
      if (audioTracks.length === 0) return;

      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;

      if (!this.audioContext) {
        this.audioContext = new AudioCtx();
      }

      const source = this.audioContext.createMediaStreamSource(remoteStream);
      const analyser = this.audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      this.speechAnalyser = analyser;

      const buffer = new Uint8Array(analyser.frequencyBinCount);

      if (this.speechCheckInterval) clearInterval(this.speechCheckInterval);
      this.speechCheckInterval = setInterval(() => {
        if (!this.speechAnalyser) return;
        this.speechAnalyser.getByteFrequencyData(buffer);
        let sum = 0;
        for (let i = 0; i < buffer.length; i++) {
          sum += buffer[i];
        }
        const average = sum / buffer.length;
        // Speaking threshold
        const speakingNow = average > 24;
        if (speakingNow !== this.isSpeaking) {
          this.isSpeaking = speakingNow;
          if (this.options?.onSpeakingStateChange) {
            this.options.onSpeakingStateChange(speakingNow);
          }
        }
      }, 150);
    } catch (err) {
      console.warn('[WebRTC] Audio analysis setup error:', err);
    }
  }

  public destroy() {
    if (this.speechCheckInterval) {
      clearInterval(this.speechCheckInterval);
      this.speechCheckInterval = null;
    }

    if (this.audioContext) {
      try {
        this.audioContext.close();
      } catch (e) {
        // Ignore
      }
      this.audioContext = null;
    }

    if (this.unsubscribeSignaling) {
      this.unsubscribeSignaling();
      this.unsubscribeSignaling = null;
    }

    if (this.dataChannel) {
      try {
        this.dataChannel.close();
      } catch (e) {
        // Ignore
      }
      this.dataChannel = null;
    }

    if (this.pc) {
      try {
        this.pc.close();
      } catch (e) {
        // Ignore
      }
      this.pc = null;
    }

    this.localWebcamStream = null;
    this.localMovieStream = null;
    this.movieSenders = [];
    this.webcamSenders = [];
    this.options = null;
  }
}
