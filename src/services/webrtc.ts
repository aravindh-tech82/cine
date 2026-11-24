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
  private remoteWebcamStream: MediaStream = new MediaStream();
  private remoteMovieStream: MediaStream = new MediaStream();

  private movieSenders: RTCRtpSender[] = [];
  private webcamSenders: RTCRtpSender[] = [];
  private options: WebRTCOptions | null = null;
  private unsubscribeSignaling: (() => void) | null = null;

  // Stream identification metadata
  private knownMovieStreamId: string | null = null;
  private knownWebcamStreamId: string | null = null;
  private knownMovieTrackIds: Set<string> = new Set();
  private knownWebcamTrackIds: Set<string> = new Set();

  // WebRTC ICE & Negotiation queueing
  private pendingCandidates: RTCIceCandidateInit[] = [];
  private isNegotiating: boolean = false;
  private needsRenegotiation: boolean = false;

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
          case 'stream-meta':
            this.handleStreamMeta(msg.payload);
            break;
          case 'join':
            // When a peer joins, if host, initiate negotiation immediately
            if (options.isHost) {
              console.log('[WebRTC] Peer joined room, initiating offer from host');
              setTimeout(() => {
                this.initiateOffer();
              }, 300);
            }
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
      const track = event.track;
      const stream = event.streams[0] || new MediaStream([track]);
      console.log(`[WebRTC] ontrack fired: kind=${track.kind}, trackId=${track.id}, streamId=${stream.id}`);

      let isMovie = false;

      // On host side, all remote incoming tracks are strictly from the guest's webcam/mic
      if (this.options?.isHost) {
        isMovie = false;
      } else if (this.knownMovieStreamId && stream.id === this.knownMovieStreamId) {
        isMovie = true;
      } else if (this.knownMovieTrackIds.has(track.id)) {
        isMovie = true;
      } else if (this.knownWebcamStreamId && stream.id === this.knownWebcamStreamId) {
        isMovie = false;
      } else if (this.knownWebcamTrackIds.has(track.id)) {
        isMovie = false;
      } else {
        // 2. Intelligent stream separation heuristic on guest side:
        // If a video track arrives and we already have a webcam video track with a different stream ID, it is the movie!
        if (track.kind === 'video') {
          if (this.remoteWebcamStream.getVideoTracks().length > 0 && stream.id !== this.knownWebcamStreamId) {
            isMovie = true;
            this.knownMovieStreamId = stream.id;
          } else {
            isMovie = false;
            this.knownWebcamStreamId = stream.id;
          }
        } else if (track.kind === 'audio') {
          if (this.remoteWebcamStream.getAudioTracks().length > 0 && stream.id !== this.knownWebcamStreamId) {
            isMovie = true;
            this.knownMovieStreamId = stream.id;
          } else {
            isMovie = false;
            this.knownWebcamStreamId = stream.id;
          }
        }
      }

      if (isMovie) {
        console.log('[WebRTC] Routing track to REMOTE MOVIE STREAM:', track.kind, track.id);
        if (!this.remoteMovieStream.getTracks().some((t) => t.id === track.id)) {
          this.remoteMovieStream.addTrack(track);
        }
        if (this.options) {
          this.options.onRemoteMovieStream(this.remoteMovieStream);
        }
      } else {
        console.log('[WebRTC] Routing track to REMOTE WEBCAM STREAM:', track.kind, track.id);
        if (!this.remoteWebcamStream.getTracks().some((t) => t.id === track.id)) {
          this.remoteWebcamStream.addTrack(track);
        }
        if (this.options) {
          this.options.onRemoteWebcamStream(this.remoteWebcamStream);
        }
        if (track.kind === 'audio') {
          this.setupAudioAnalysis(this.remoteWebcamStream);
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

  private handleStreamMeta(meta: any) {
    if (!meta) return;
    if (meta.movieStreamId) this.knownMovieStreamId = meta.movieStreamId;
    if (meta.webcamStreamId) this.knownWebcamStreamId = meta.webcamStreamId;

    if (Array.isArray(meta.movieTrackIds)) {
      meta.movieTrackIds.forEach((id: string) => this.knownMovieTrackIds.add(id));
    }
    if (Array.isArray(meta.webcamTrackIds)) {
      meta.webcamTrackIds.forEach((id: string) => this.knownWebcamTrackIds.add(id));
    }

    console.log('[WebRTC] Received stream-meta:', {
      movieStreamId: this.knownMovieStreamId,
      webcamStreamId: this.knownWebcamStreamId,
      movieTrackCount: this.knownMovieTrackIds.size,
    });

    // Check if any tracks in remoteWebcamStream were misclassified before meta arrived
    let reassignNeeded = false;
    this.remoteWebcamStream.getTracks().forEach((track) => {
      if (this.knownMovieTrackIds.has(track.id)) {
        this.remoteWebcamStream.removeTrack(track);
        this.remoteMovieStream.addTrack(track);
        reassignNeeded = true;
      }
    });

    if (reassignNeeded && this.options) {
      this.options.onRemoteWebcamStream(this.remoteWebcamStream);
      this.options.onRemoteMovieStream(this.remoteMovieStream);
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

    if (this.pc.signalingState !== 'stable') {
      console.log(`[WebRTC] Signaling state is '${this.pc.signalingState}', queueing renegotiation`);
      this.needsRenegotiation = true;
      return;
    }

    try {
      this.isNegotiating = true;
      const offer = await this.pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      });
      await this.pc.setLocalDescription(offer);

      const meta = {
        movieStreamId: this.localMovieStream?.id || null,
        webcamStreamId: this.localWebcamStream?.id || null,
        movieTrackIds: this.localMovieStream?.getTracks().map((t) => t.id) || [],
        webcamTrackIds: this.localWebcamStream?.getTracks().map((t) => t.id) || [],
      };

      signalingService.sendMessage('sdp-offer', { offer, ...meta });
      signalingService.sendMessage('stream-meta', meta);
      console.log('[WebRTC] Offer and stream metadata sent');
    } catch (err) {
      console.error('[WebRTC] Failed to create offer:', err);
      this.isNegotiating = false;
    }
  }

  private async handleOffer(payload: any) {
    if (!this.pc) return;

    const offer = payload.offer || payload;
    this.handleStreamMeta(payload);

    try {
      console.log('[WebRTC] Handling offer...');
      await this.pc.setRemoteDescription(new RTCSessionDescription(offer));

      // Flush queued candidates
      await this.drainPendingCandidates();

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
      this.isNegotiating = false;

      // Flush queued candidates
      await this.drainPendingCandidates();

      if (this.needsRenegotiation) {
        this.needsRenegotiation = false;
        setTimeout(() => this.initiateOffer(), 200);
      }
    } catch (err) {
      console.error('[WebRTC] Failed to handle answer:', err);
      this.isNegotiating = false;
    }
  }

  private async handleCandidate(candidate: RTCIceCandidateInit) {
    if (!candidate) return;

    // If remote description is not set yet, queue candidate
    if (!this.pc || !this.pc.remoteDescription || !this.pc.remoteDescription.type) {
      this.pendingCandidates.push(candidate);
      return;
    }

    try {
      await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (err) {
      console.error('[WebRTC] Error adding ICE candidate:', err);
    }
  }

  private async drainPendingCandidates() {
    if (!this.pc || !this.pc.remoteDescription || !this.pc.remoteDescription.type) return;

    while (this.pendingCandidates.length > 0) {
      const cand = this.pendingCandidates.shift();
      if (cand) {
        try {
          await this.pc.addIceCandidate(new RTCIceCandidate(cand));
        } catch (e) {
          console.warn('[WebRTC] Error adding drained candidate', e);
        }
      }
    }
  }

  public async restartIce() {
    if (!this.pc || !this.options) return;
    console.log('[WebRTC] Restarting ICE...');
    try {
      const offer = await this.pc.createOffer({ iceRestart: true });
      await this.pc.setLocalDescription(offer);
      signalingService.sendMessage('sdp-offer', { offer });
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

    const meta = {
      webcamStreamId: stream.id,
      webcamTrackIds: stream.getTracks().map((t) => t.id),
      movieStreamId: this.localMovieStream?.id || null,
      movieTrackIds: this.localMovieStream?.getTracks().map((t) => t.id) || [],
    };
    signalingService.sendMessage('stream-meta', meta);

    // If already connected and host, renegotiate
    if (this.pc.signalingState === 'stable' && this.options?.isHost) {
      this.initiateOffer();
    }
  }

  /**
   * Captures the local movie stream and transmits it to the peer
   */
  public attachLocalMovieStream(videoElement: HTMLVideoElement): MediaStream | null {
    try {
      // Check if we already have an active stream on this video element
      if (this.localMovieStream && this.localMovieStream.getTracks().some((t) => t.readyState === 'live')) {
        console.log('[WebRTC] Local movie stream is already active, verifying senders on PC');
        if (this.pc) {
          let addedAny = false;
          this.localMovieStream.getTracks().forEach((track) => {
            if (!this.movieSenders.some((s) => s.track?.id === track.id)) {
              try {
                const sender = this.pc!.addTrack(track, this.localMovieStream!);
                this.movieSenders.push(sender);
                addedAny = true;
                console.log(`[WebRTC] Added previously unattached track to PC: kind=${track.kind}, id=${track.id}`);
              } catch (e) {
                console.warn('[WebRTC] Error adding track from existing stream:', e);
              }
            }
          });
          if (addedAny) {
            this.initiateOffer();
          }
        }
        return this.localMovieStream;
      }

      let stream: MediaStream | null = null;
      if (typeof (videoElement as any).captureStream === 'function') {
        stream = (videoElement as any).captureStream(30);
      } else if (typeof (videoElement as any).mozCaptureStream === 'function') {
        stream = (videoElement as any).mozCaptureStream(30);
      }

      if (!stream) {
        console.warn('[WebRTC] captureStream is not supported by this browser');
        return null;
      }

      console.log(`[WebRTC] Captured movie stream: id=${stream.id}, tracks=${stream.getTracks().length}`);
      this.localMovieStream = stream;

      // Listen for dynamically added audio tracks (e.g. Chrome audio decoder initializing on playback)
      stream.onaddtrack = (event) => {
        console.log('[WebRTC] Movie stream dynamically added track:', event.track.kind, event.track.id);
        if (this.pc && !this.movieSenders.some((s) => s.track?.id === event.track.id)) {
          try {
            const sender = this.pc.addTrack(event.track, stream!);
            this.movieSenders.push(sender);
            this.initiateOffer();
          } catch (e) {
            console.error('[WebRTC] Error adding dynamic movie track:', e);
          }
        }
      };

      if (!this.pc) return stream;

      // Remove existing movie senders if any
      this.movieSenders.forEach((sender) => {
        try {
          this.pc?.removeTrack(sender);
        } catch (e) {
          // Ignore
        }
      });
      this.movieSenders = [];

      // Add all movie tracks (video and audio)
      stream.getTracks().forEach((track) => {
        try {
          const sender = this.pc!.addTrack(track, stream!);
          this.movieSenders.push(sender);
          console.log(`[WebRTC] Added movie track to PC: kind=${track.kind}, id=${track.id}`);
        } catch (err) {
          console.error('[WebRTC] Error adding movie track:', err);
        }
      });

      // Broadcast stream metadata
      const meta = {
        movieStreamId: stream.id,
        movieTrackIds: stream.getTracks().map((t) => t.id),
        webcamStreamId: this.localWebcamStream?.id || null,
        webcamTrackIds: this.localWebcamStream?.getTracks().map((t) => t.id) || [],
      };
      signalingService.sendMessage('stream-meta', meta);

      // Renegotiate with peer
      this.initiateOffer();

      return stream;
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
    this.pendingCandidates = [];
    this.options = null;
  }
}
