import { signalingService } from './signaling';
import { ConnectionStep } from '../types';

export interface WebRTCOptions {
  roomId: string;
  userId: string;
  isHost: boolean;
  onRemoteWebcamStream: (stream: MediaStream) => void;
  onRemoteMovieStream: (stream: MediaStream) => void;
  onDataChannelMessage: (data: any) => void;
  onConnectionStateChange: (state: RTCPeerConnectionState) => void;
  onSpeakingStateChange?: (speaking: boolean) => void;
  onStepChange?: (step: ConnectionStep, message: string) => void;
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

  // Stream & Track identification metadata
  private knownMovieStreamId: string | null = null;
  private knownWebcamStreamId: string | null = null;
  private knownMovieTrackIds: Set<string> = new Set();
  private knownWebcamTrackIds: Set<string> = new Set();

  // WebRTC ICE & Negotiation queueing
  private pendingCandidates: RTCIceCandidateInit[] = [];
  private isNegotiating: boolean = false;
  private needsRenegotiation: boolean = false;
  private peerJoined: boolean = false;

  // Web Audio Context for reliable movie audio capture
  private movieAudioContext: AudioContext | null = null;
  private movieAudioSourceNode: MediaElementAudioSourceNode | null = null;
  private movieAudioDestination: MediaStreamAudioDestinationNode | null = null;
  private attachedVideoElement: HTMLVideoElement | null = null;

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

  private getRoleTag(): string {
    return this.options?.isHost ? '[HOST]' : '[GUEST]';
  }

  private loadCustomTurnConfig() {
    try {
      const stunServer = import.meta.env.VITE_STUN_SERVER;
      if (stunServer && !this.iceServers.some((s) => s.urls === stunServer)) {
        this.iceServers.unshift({ urls: stunServer });
      }

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

      // Also check localStorage for user configured TURN server
      const savedConfig = localStorage.getItem('cinemate_webrtc_turn');
      if (savedConfig) {
        const parsed = JSON.parse(savedConfig);
        if (parsed.server && parsed.username && parsed.credential) {
          this.iceServers.push({
            urls: parsed.server,
            username: parsed.username,
            credential: parsed.credential,
          });
        }
      }
    } catch {
      // Ignore
    }
  }

  public init(options: WebRTCOptions) {
    this.options = options;
    console.log(`${this.getRoleTag()} [WebRTC] Initializing WebRTCManager (roomId=${options.roomId}, isHost=${options.isHost})`);
    this.createPeerConnection();

    // Subscribe to signaling messages
    this.unsubscribeSignaling = signalingService.addListener(async (msg) => {
      if (msg.roomId !== options.roomId || msg.senderId === options.userId) return;

      try {
        switch (msg.type) {
          case 'sdp-offer':
            console.log(`${this.getRoleTag()} [WebRTC] Received sdp-offer from peer`);
            this.options?.onStepChange?.('establishing-peer-connection', 'Exchanging SDP Offer/Answer...');
            await this.handleOffer(msg.payload);
            break;
          case 'sdp-answer':
            console.log(`${this.getRoleTag()} [WebRTC] Received sdp-answer from peer`);
            this.options?.onStepChange?.('establishing-peer-connection', 'SDP Answer Received');
            await this.handleAnswer(msg.payload);
            break;
          case 'ice-candidate':
            await this.handleCandidate(msg.payload);
            break;
          case 'stream-meta':
            this.handleStreamMeta(msg.payload);
            break;
          case 'join':
            // Peer is in the room
            this.peerJoined = true;
            console.log(`${this.getRoleTag()} [WebRTC] Peer joined room.`);
            if (options.isHost) {
              this.options?.onStepChange?.('guest-joined', 'Guest detected, initiating offer...');
              setTimeout(() => {
                this.initiateOffer();
              }, 300);
            } else {
              this.options?.onStepChange?.('exchanging-signaling', 'Connected to host signaling channel');
            }
            break;
          case 'leave':
            console.log(`${this.getRoleTag()} [WebRTC] Peer left room.`);
            this.peerJoined = false;
            this.options?.onStepChange?.(options.isHost ? 'waiting-for-guest' : 'reconnecting', 'Peer disconnected');
            break;
        }
      } catch (err) {
        console.error(`${this.getRoleTag()} [WebRTC] Signaling error handling msg: ${msg.type}`, err);
      }
    });
  }

  private createPeerConnection() {
    if (this.pc) {
      try {
        this.pc.close();
      } catch {
        // Ignore
      }
    }

    const pc = new RTCPeerConnection({
      iceServers: this.iceServers,
      iceCandidatePoolSize: 2,
    });

    pc.onicecandidate = (event) => {
      if (event.candidate && this.options) {
        console.log(`${this.getRoleTag()} [WebRTC] Local ICE candidate generated: type=${event.candidate.type}, protocol=${event.candidate.protocol}`);
        signalingService.sendMessage('ice-candidate', event.candidate.toJSON());
      }
    };

    pc.onicecandidateerror = (event: any) => {
      console.warn(`${this.getRoleTag()} [WebRTC] ICE candidate error:`, event.errorCode, event.errorText);
    };

    pc.oniceconnectionstatechange = () => {
      console.log(`${this.getRoleTag()} [WebRTC] ICE connection state: ${pc.iceConnectionState}`);
      if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
        this.options?.onStepChange?.('connected', 'Peer Connected');
      } else if (pc.iceConnectionState === 'failed') {
        this.options?.onStepChange?.('failed', 'Connection failed, attempting ICE restart...');
        this.restartIce();
      } else if (pc.iceConnectionState === 'disconnected') {
        this.options?.onStepChange?.('reconnecting', 'ICE connection temporarily disconnected');
      }
    };

    pc.onsignalingstatechange = () => {
      console.log(`${this.getRoleTag()} [WebRTC] Signaling state changed to: ${pc.signalingState}`);
    };

    pc.onconnectionstatechange = () => {
      console.log(`${this.getRoleTag()} [WebRTC] Peer connection state changed to: ${pc.connectionState}`);
      if (this.options) {
        this.options.onConnectionStateChange(pc.connectionState);
      }
      if (pc.connectionState === 'connected') {
        this.options?.onStepChange?.('connected', 'Peer connection established');
      } else if (pc.connectionState === 'connecting') {
        this.options?.onStepChange?.('establishing-peer-connection', 'Establishing peer connection...');
      } else if (pc.connectionState === 'failed') {
        this.options?.onStepChange?.('failed', 'Peer connection failed');
        this.restartIce();
      }
    };

    pc.ontrack = (event) => {
      const track = event.track;
      const stream = event.streams[0] || new MediaStream([track]);
      console.log(`${this.getRoleTag()} [WebRTC] ontrack fired: kind=${track.kind}, trackId=${track.id}, streamId=${stream.id}`);

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
        // Intelligent stream separation heuristic on guest side:
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
        console.log(`${this.getRoleTag()} [WebRTC] MOVIE TRACK ROUTED to remote movie stream: kind=${track.kind}, id=${track.id}`);
        if (!this.remoteMovieStream.getTracks().some((t) => t.id === track.id)) {
          this.remoteMovieStream.addTrack(track);
        }
        if (this.options) {
          // Pass fresh MediaStream reference so React states and video element re-render
          this.options.onRemoteMovieStream(new MediaStream(this.remoteMovieStream.getTracks()));
          this.options.onStepChange?.('connected', 'Movie Stream Connected');
        }
      } else {
        console.log(`${this.getRoleTag()} [WebRTC] WEBCAM TRACK ROUTED to remote webcam stream: kind=${track.kind}, id=${track.id}`);
        if (!this.remoteWebcamStream.getTracks().some((t) => t.id === track.id)) {
          this.remoteWebcamStream.addTrack(track);
        }
        if (this.options) {
          this.options.onRemoteWebcamStream(new MediaStream(this.remoteWebcamStream.getTracks()));
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
        console.log(`${this.getRoleTag()} [WebRTC] Received DataChannel: label=${event.channel.label}`);
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

    console.log(`${this.getRoleTag()} [WebRTC] Received stream-meta:`, {
      movieStreamId: this.knownMovieStreamId,
      webcamStreamId: this.knownWebcamStreamId,
      movieTrackCount: this.knownMovieTrackIds.size,
    });

    // Move any tracks in remoteWebcamStream that were actually movie tracks
    let reassignNeeded = false;
    this.remoteWebcamStream.getTracks().forEach((track) => {
      if (this.knownMovieTrackIds.has(track.id) || (this.knownMovieStreamId && track.id === this.knownMovieStreamId)) {
        this.remoteWebcamStream.removeTrack(track);
        if (!this.remoteMovieStream.getTracks().some((t) => t.id === track.id)) {
          this.remoteMovieStream.addTrack(track);
        }
        reassignNeeded = true;
      }
    });

    if (reassignNeeded && this.options) {
      this.options.onRemoteWebcamStream(new MediaStream(this.remoteWebcamStream.getTracks()));
      this.options.onRemoteMovieStream(new MediaStream(this.remoteMovieStream.getTracks()));
    }
  }

  private setupDataChannel(dc: RTCDataChannel) {
    this.dataChannel = dc;
    dc.onopen = () => {
      console.log(`${this.getRoleTag()} [WebRTC] DataChannel open & ready for real-time synchronization`);
    };
    dc.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data);
        if (this.options) {
          this.options.onDataChannelMessage(parsed);
        }
      } catch {
        console.error(`${this.getRoleTag()} [WebRTC] Failed to parse DataChannel message:`, event.data);
      }
    };
    dc.onerror = (err) => console.error(`${this.getRoleTag()} [WebRTC] DataChannel error:`, err);
    dc.onclose = () => console.log(`${this.getRoleTag()} [WebRTC] DataChannel closed`);
  }

  public sendData(data: any): boolean {
    if (this.dataChannel && this.dataChannel.readyState === 'open') {
      try {
        this.dataChannel.send(JSON.stringify(data));
        return true;
      } catch (e) {
        console.error(`${this.getRoleTag()} [WebRTC] Error sending on DataChannel:`, e);
      }
    }
    // Fallback through signaling service
    signalingService.sendMessage('playback-control', data);
    return false;
  }

  public async initiateOffer() {
    if (!this.pc) return;

    // If an unanswered local offer is pending, roll back so we can make a clean offer with all tracks
    if (this.pc.signalingState === 'have-local-offer') {
      try {
        console.log(`${this.getRoleTag()} [WebRTC] Rolling back pending local offer to create clean offer`);
        await this.pc.setLocalDescription({ type: 'rollback' });
      } catch (e) {
        console.warn(`${this.getRoleTag()} [WebRTC] Rollback note:`, e);
      }
    }

    if (this.pc.signalingState !== 'stable') {
      console.log(`${this.getRoleTag()} [WebRTC] Signaling state is '${this.pc.signalingState}', queueing renegotiation`);
      this.needsRenegotiation = true;
      return;
    }

    try {
      this.isNegotiating = true;
      console.log(`${this.getRoleTag()} [WebRTC] Creating SDP offer...`);
      const offer = await this.pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      });
      await this.pc.setLocalDescription(offer);
      console.log(`${this.getRoleTag()} [WebRTC] Local description set to SDP offer`);

      const meta = {
        movieStreamId: this.localMovieStream?.id || null,
        webcamStreamId: this.localWebcamStream?.id || null,
        movieTrackIds: this.localMovieStream?.getTracks().map((t) => t.id) || [],
        webcamTrackIds: this.localWebcamStream?.getTracks().map((t) => t.id) || [],
      };

      signalingService.sendMessage('sdp-offer', { offer, ...meta });
      signalingService.sendMessage('stream-meta', meta);
      console.log(`${this.getRoleTag()} [WebRTC] SDP offer and stream metadata sent to peer`);
    } catch (err) {
      console.error(`${this.getRoleTag()} [WebRTC] Failed to create offer:`, err);
      this.isNegotiating = false;
    }
  }

  private async handleOffer(payload: any) {
    if (!this.pc) return;

    const offer = payload.offer || payload;
    this.handleStreamMeta(payload);

    try {
      console.log(`${this.getRoleTag()} [WebRTC] Handling incoming SDP offer...`);
      if (this.pc.signalingState === 'have-local-offer') {
        console.log(`${this.getRoleTag()} [WebRTC] Rolling back local offer before accepting remote offer`);
        await this.pc.setLocalDescription({ type: 'rollback' });
      }

      await this.pc.setRemoteDescription(new RTCSessionDescription(offer));
      console.log(`${this.getRoleTag()} [WebRTC] Remote description set to SDP offer`);

      // Flush queued candidates
      await this.drainPendingCandidates();

      console.log(`${this.getRoleTag()} [WebRTC] Creating SDP answer...`);
      const answer = await this.pc.createAnswer();
      await this.pc.setLocalDescription(answer);
      console.log(`${this.getRoleTag()} [WebRTC] Local description set to SDP answer`);

      signalingService.sendMessage('sdp-answer', { answer });
      console.log(`${this.getRoleTag()} [WebRTC] SDP answer sent to host`);
    } catch (err) {
      console.error(`${this.getRoleTag()} [WebRTC] Failed to handle offer:`, err);
    }
  }

  private async handleAnswer(payload: any) {
    if (!this.pc) return;
    const answer = payload.answer || payload;

    try {
      console.log(`${this.getRoleTag()} [WebRTC] Handling incoming SDP answer...`);
      if (this.pc.signalingState !== 'have-local-offer') {
        console.warn(`${this.getRoleTag()} [WebRTC] Received answer but signalingState is '${this.pc.signalingState}'`);
        return;
      }

      await this.pc.setRemoteDescription(new RTCSessionDescription(answer));
      console.log(`${this.getRoleTag()} [WebRTC] Remote description set to SDP answer. Signaling stable.`);
      this.isNegotiating = false;

      // Flush queued candidates
      await this.drainPendingCandidates();

      if (this.needsRenegotiation) {
        this.needsRenegotiation = false;
        setTimeout(() => this.initiateOffer(), 150);
      }
    } catch (err) {
      console.error(`${this.getRoleTag()} [WebRTC] Failed to handle answer:`, err);
      this.isNegotiating = false;
    }
  }

  private async handleCandidate(candidate: RTCIceCandidateInit) {
    if (!candidate) return;

    // If remote description is not set yet, queue candidate
    if (!this.pc || !this.pc.remoteDescription || !this.pc.remoteDescription.type) {
      console.log(`${this.getRoleTag()} [WebRTC] Buffering remote ICE candidate (waiting for remote description)`);
      this.pendingCandidates.push(candidate);
      return;
    }

    try {
      await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
      console.log(`${this.getRoleTag()} [WebRTC] Added remote ICE candidate`);
    } catch (err) {
      console.error(`${this.getRoleTag()} [WebRTC] Error adding ICE candidate:`, err);
    }
  }

  private async drainPendingCandidates() {
    if (!this.pc || !this.pc.remoteDescription || !this.pc.remoteDescription.type) return;

    if (this.pendingCandidates.length > 0) {
      console.log(`${this.getRoleTag()} [WebRTC] Draining ${this.pendingCandidates.length} queued ICE candidates`);
      while (this.pendingCandidates.length > 0) {
        const cand = this.pendingCandidates.shift();
        if (cand) {
          try {
            await this.pc.addIceCandidate(new RTCIceCandidate(cand));
          } catch (e) {
            console.warn(`${this.getRoleTag()} [WebRTC] Error adding drained candidate:`, e);
          }
        }
      }
    }
  }

  public async restartIce() {
    if (!this.pc || !this.options) return;
    console.log(`${this.getRoleTag()} [WebRTC] Restarting ICE connection...`);
    try {
      const offer = await this.pc.createOffer({ iceRestart: true });
      await this.pc.setLocalDescription(offer);
      signalingService.sendMessage('sdp-offer', { offer });
    } catch (e) {
      console.error(`${this.getRoleTag()} [WebRTC] Failed ICE restart:`, e);
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
      } catch {
        // Ignore
      }
    });
    this.webcamSenders = [];

    // Add new tracks
    stream.getTracks().forEach((track) => {
      try {
        const sender = this.pc!.addTrack(track, stream);
        this.webcamSenders.push(sender);
        console.log(`${this.getRoleTag()} [WebRTC] Added webcam track to PC: kind=${track.kind}, id=${track.id}`);
      } catch (e) {
        console.error(`${this.getRoleTag()} [WebRTC] Failed to add webcam track:`, e);
      }
    });

    const meta = {
      webcamStreamId: stream.id,
      webcamTrackIds: stream.getTracks().map((t) => t.id),
      movieStreamId: this.localMovieStream?.id || null,
      movieTrackIds: this.localMovieStream?.getTracks().map((t) => t.id) || [],
    };
    signalingService.sendMessage('stream-meta', meta);

    // If connected, renegotiate
    if (this.pc.signalingState === 'stable' && this.options?.isHost && this.peerJoined) {
      this.initiateOffer();
    }
  }

  /**
   * Captures the local movie stream and transmits it to the peer
   */
  public attachLocalMovieStream(videoElement: HTMLVideoElement): MediaStream | null {
    try {
      this.attachedVideoElement = videoElement;

      // 1. Capture video track using captureStream(30)
      let capturedStream: MediaStream | null = null;
      if (typeof (videoElement as any).captureStream === 'function') {
        capturedStream = (videoElement as any).captureStream(30);
      } else if (typeof (videoElement as any).mozCaptureStream === 'function') {
        capturedStream = (videoElement as any).mozCaptureStream(30);
      }

      if (!capturedStream) {
        console.warn(`${this.getRoleTag()} [WebRTC] video.captureStream() is not supported in this browser`);
        return null;
      }

      const videoTrack: MediaStreamTrack | undefined = capturedStream.getVideoTracks()[0];
      let audioTrack: MediaStreamTrack | undefined = capturedStream.getAudioTracks()[0];

      // 2. Fallback: If captureStream hasn't initialized an audio track (common before playback in Chrome),
      // use Web Audio API createMediaElementSource to capture audio directly from videoElement
      if (!audioTrack && (window.AudioContext || (window as any).webkitAudioContext)) {
        try {
          if (!this.movieAudioContext) {
            const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
            this.movieAudioContext = new AudioCtx();
          }
          if (this.movieAudioContext.state === 'suspended') {
            this.movieAudioContext.resume().catch(console.warn);
          }
          if (!this.movieAudioSourceNode) {
            this.movieAudioSourceNode = this.movieAudioContext.createMediaElementSource(videoElement);
            this.movieAudioDestination = this.movieAudioContext.createMediaStreamDestination();
            this.movieAudioSourceNode.connect(this.movieAudioDestination);
            this.movieAudioSourceNode.connect(this.movieAudioContext.destination);
          }
          audioTrack = this.movieAudioDestination?.stream.getAudioTracks()[0];
        } catch (e) {
          console.warn(`${this.getRoleTag()} [WebRTC] Web Audio movie audio source note:`, e);
        }
      }

      // 3. Assemble combined movie MediaStream
      const movieStream = new MediaStream();
      if (videoTrack) movieStream.addTrack(videoTrack);
      if (audioTrack) movieStream.addTrack(audioTrack);

      this.localMovieStream = movieStream;
      console.log(`${this.getRoleTag()} [WebRTC] Local movie stream prepared: tracks=${movieStream.getTracks().length} (video=${!!videoTrack}, audio=${!!audioTrack})`);

      // 4. Listen for dynamically added audio tracks when playback starts
      capturedStream.onaddtrack = (event) => {
        console.log(`${this.getRoleTag()} [WebRTC] captureStream dynamically added track: kind=${event.track.kind}, id=${event.track.id}`);
        if (event.track.kind === 'audio' && !this.localMovieStream?.getAudioTracks().length) {
          this.localMovieStream?.addTrack(event.track);
          if (this.pc) {
            try {
              const sender = this.pc.addTrack(event.track, this.localMovieStream!);
              this.movieSenders.push(sender);
              this.initiateOffer();
            } catch (e) {
              console.error(`${this.getRoleTag()} [WebRTC] Error adding dynamic movie audio track:`, e);
            }
          }
        }
      };

      if (!this.pc) return movieStream;

      // 5. Clean up old movie senders
      this.movieSenders.forEach((sender) => {
        try {
          this.pc?.removeTrack(sender);
        } catch {
          // Ignore
        }
      });
      this.movieSenders = [];

      // 6. Add tracks to RTCPeerConnection
      movieStream.getTracks().forEach((track) => {
        try {
          const sender = this.pc!.addTrack(track, movieStream);
          this.movieSenders.push(sender);
          console.log(`${this.getRoleTag()} [WebRTC] Added movie track to PC: kind=${track.kind}, id=${track.id}`);
        } catch (err) {
          console.error(`${this.getRoleTag()} [WebRTC] Error adding movie track:`, err);
        }
      });

      // 7. Broadcast stream metadata
      const meta = {
        movieStreamId: movieStream.id,
        movieTrackIds: movieStream.getTracks().map((t) => t.id),
        webcamStreamId: this.localWebcamStream?.id || null,
        webcamTrackIds: this.localWebcamStream?.getTracks().map((t) => t.id) || [],
      };
      signalingService.sendMessage('stream-meta', meta);

      // 8. Renegotiate with peer if host
      if (this.options?.isHost) {
        this.initiateOffer();
      }

      return movieStream;
    } catch (err) {
      console.error(`${this.getRoleTag()} [WebRTC] Failed to capture movie stream:`, err);
      return null;
    }
  }

  public removeLocalMovieStream() {
    this.movieSenders.forEach((sender) => {
      try {
        this.pc?.removeTrack(sender);
      } catch {
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
      console.warn(`${this.getRoleTag()} [WebRTC] Audio analysis setup error:`, err);
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
      } catch {
        // Ignore
      }
      this.audioContext = null;
    }

    if (this.movieAudioContext) {
      try {
        this.movieAudioContext.close();
      } catch {
        // Ignore
      }
      this.movieAudioContext = null;
      this.movieAudioSourceNode = null;
      this.movieAudioDestination = null;
    }

    if (this.unsubscribeSignaling) {
      this.unsubscribeSignaling();
      this.unsubscribeSignaling = null;
    }

    if (this.dataChannel) {
      try {
        this.dataChannel.close();
      } catch {
        // Ignore
      }
      this.dataChannel = null;
    }

    if (this.pc) {
      try {
        this.pc.close();
      } catch {
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
    this.peerJoined = false;
  }
}
