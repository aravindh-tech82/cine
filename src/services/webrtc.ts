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
  private knownMovieMids: Set<string> = new Set();
  private knownWebcamMids: Set<string> = new Set();

  // WebRTC ICE & Negotiation queueing
  private pendingCandidates: RTCIceCandidateInit[] = [];
  private isNegotiating: boolean = false;
  private isMakingOffer: boolean = false;
  private ignoreOffer: boolean = false;
  private isPolite: boolean = false;
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
    // 1. Google STUN (ports 19302 and TLS 5349 - zero latency, global uptime)
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    // 2. Cloudflare STUN (port 3478 - global Anycast, high speed)
    { urls: 'stun:stun.cloudflare.com:3478' },
    // 3. Free Public TURN Relay for Symmetric NAT traversal across mobile & Wi-Fi
    {
      urls: [
        'turn:openrelay.metered.ca:80',
        'turn:openrelay.metered.ca:443',
        'turn:openrelay.metered.ca:443?transport=tcp',
      ],
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
  ];

  constructor() {
    this.loadCustomTurnConfig();
  }

  private getRoleTag(): string {
    return this.options?.isHost ? '[HOST]' : '[GUEST]';
  }

  private loadCustomTurnConfig() {
    try {
      // 1. Full ICE Servers JSON array configuration (VITE_ICE_SERVERS)
      const rawIceServers = import.meta.env.VITE_ICE_SERVERS;
      if (rawIceServers) {
        try {
          const parsed = JSON.parse(rawIceServers);
          if (Array.isArray(parsed) && parsed.length > 0) {
            this.iceServers = parsed;
            console.log('[WebRTC] Custom full iceServers array loaded from VITE_ICE_SERVERS');
            return;
          }
        } catch {
          console.warn('[WebRTC] Failed to parse VITE_ICE_SERVERS JSON configuration');
        }
      }

      // 2. Custom STUN server
      const stunServer = import.meta.env.VITE_STUN_SERVER;
      if (stunServer && !this.iceServers.some((s) => s.urls === stunServer)) {
        this.iceServers.unshift({ urls: stunServer.trim() });
      }

      // 3. Custom TURN server (supports single URL or comma-separated URLs)
      const turnServer = import.meta.env.VITE_TURN_SERVER;
      const turnUser = import.meta.env.VITE_TURN_USERNAME;
      const turnPass = import.meta.env.VITE_TURN_CREDENTIAL;
      if (turnServer && turnUser && turnPass) {
        const urls = turnServer.includes(',')
          ? turnServer.split(',').map((u: string) => u.trim())
          : turnServer.trim();
        this.iceServers.unshift({
          urls,
          username: turnUser.trim(),
          credential: turnPass.trim(),
        });
        console.log('[WebRTC] Production TURN relay server configured');
      }

      // 4. Also check localStorage for user configured TURN server
      const savedConfig = localStorage.getItem('cinemate_webrtc_turn');
      if (savedConfig) {
        const parsed = JSON.parse(savedConfig);
        if (parsed.server && parsed.username && parsed.credential) {
          const urls = parsed.server.includes(',')
            ? parsed.server.split(',').map((u: string) => u.trim())
            : parsed.server.trim();
          this.iceServers.unshift({
            urls,
            username: parsed.username.trim(),
            credential: parsed.credential.trim(),
          });
        }
      }
    } catch {
      // Ignore
    }
  }

  public init(options: WebRTCOptions) {
    this.options = options;
    this.isPolite = !options.isHost;
    if (typeof window !== 'undefined') {
      (window as any).__webrtcManager = this;
    }
    console.log(`${this.getRoleTag()} [WebRTC] Initializing WebRTCManager (roomId=${options.roomId}, isHost=${options.isHost}, isPolite=${this.isPolite})`);
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
          case 'request-ice-restart':
            if (options.isHost) {
              console.log(`${this.getRoleTag()} [WebRTC] Received request-ice-restart from Guest. Restarting ICE...`);
              this.restartIce();
            }
            break;
          case 'join':
            // Peer is in the room
            this.handlePeerJoined();
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
      bundlePolicy: 'max-bundle',
      rtcpMuxPolicy: 'require',
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
        console.warn(`${this.getRoleTag()} [WebRTC] ICE connection state failed, triggering restart`);
        this.options?.onStepChange?.('failed', 'Connection interrupted, retrying...');
        this.restartIce();
      } else if (pc.iceConnectionState === 'disconnected') {
        this.options?.onStepChange?.('reconnecting', 'Reconnecting media stream...');
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
      } else if (pc.connectionState === 'disconnected') {
        this.options?.onStepChange?.('reconnecting', 'Peer connection temporarily disconnected');
      } else if (pc.connectionState === 'failed') {
        console.warn(`${this.getRoleTag()} [WebRTC] Peer connection state failed`);
        this.options?.onStepChange?.('failed', 'Peer connection interrupted');
        this.restartIce();

        // Safe auto-rebuild if ICE restart does not recover within 5 seconds
        setTimeout(() => {
          if (this.pc && (this.pc.connectionState === 'failed' || this.pc.iceConnectionState === 'failed')) {
            console.log(`${this.getRoleTag()} [WebRTC] Auto-rebuilding connection after persistent failure...`);
            this.reconnect();
          }
        }, 5000);
      }
    };

    pc.ontrack = (event) => {
      const track = event.track;
      const stream = event.streams[0] || new MediaStream([track]);
      const mid = event.transceiver?.mid;
      console.log(`${this.getRoleTag()} [WebRTC] ontrack fired: kind=${track.kind}, trackId=${track.id}, streamId=${stream.id}, mid=${mid}`);

      let isMovie = false;

      // On host side, all remote incoming tracks are strictly from the guest's webcam/mic
      if (this.options?.isHost) {
        isMovie = false;
      } else if (mid && this.knownMovieMids.has(mid)) {
        isMovie = true;
      } else if (mid && this.knownWebcamMids.has(mid)) {
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
            // If in movie room or only 1 video stream arriving, route to movie
            isMovie = true;
            this.knownMovieStreamId = stream.id;
          }
        } else if (track.kind === 'audio') {
          if (this.remoteWebcamStream.getAudioTracks().length > 0 && stream.id !== this.knownWebcamStreamId) {
            isMovie = true;
            this.knownMovieStreamId = stream.id;
          } else {
            // Check if stream id matches movie stream
            isMovie = (stream.id === this.knownMovieStreamId);
          }
        }
      }

      if (isMovie) {
        console.log(`${this.getRoleTag()} [WebRTC] MOVIE TRACK ROUTED to remote movie stream: kind=${track.kind}, id=${track.id}`);
        if (!this.remoteMovieStream.getTracks().some((t) => t.id === track.id)) {
          this.remoteMovieStream.addTrack(track);
        }
        if (this.options) {
          this.options.onRemoteMovieStream(this.remoteMovieStream);
          this.options.onStepChange?.('connected', 'Movie Stream Connected');
        }
      } else {
        console.log(`${this.getRoleTag()} [WebRTC] WEBCAM TRACK ROUTED to remote webcam stream: kind=${track.kind}, id=${track.id}`);
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

    if (Array.isArray(meta.movieMids)) {
      meta.movieMids.forEach((mid: string) => this.knownMovieMids.add(mid));
    }
    if (Array.isArray(meta.webcamMids)) {
      meta.webcamMids.forEach((mid: string) => this.knownWebcamMids.add(mid));
    }

    if (Array.isArray(meta.movieTrackIds)) {
      meta.movieTrackIds.forEach((id: string) => this.knownMovieTrackIds.add(id));
    }
    if (Array.isArray(meta.webcamTrackIds)) {
      meta.webcamTrackIds.forEach((id: string) => this.knownWebcamTrackIds.add(id));
    }

    console.log(`${this.getRoleTag()} [WebRTC] Received stream-meta:`, {
      movieStreamId: this.knownMovieStreamId,
      webcamStreamId: this.knownWebcamStreamId,
      movieMids: Array.from(this.knownMovieMids),
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
      this.options.onRemoteWebcamStream(this.remoteWebcamStream);
      this.options.onRemoteMovieStream(this.remoteMovieStream);
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

  public async initiateOffer(isIceRestart: boolean = false) {
    if (!this.pc) return;

    if (this.isMakingOffer || this.pc.signalingState !== 'stable') {
      console.log(`${this.getRoleTag()} [WebRTC] Cannot initiate offer now (isMakingOffer=${this.isMakingOffer}, state=${this.pc.signalingState}), queuing renegotiation`);
      this.needsRenegotiation = true;
      return;
    }

    try {
      this.isMakingOffer = true;
      console.log(`${this.getRoleTag()} [WebRTC] Creating SDP offer (iceRestart=${isIceRestart})...`);
      const offer = await this.pc.createOffer({
        iceRestart: isIceRestart,
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      });

      if (this.pc.signalingState !== 'stable') {
        console.warn(`${this.getRoleTag()} [WebRTC] Signaling state changed to '${this.pc.signalingState}' while creating offer`);
        return;
      }

      await this.pc.setLocalDescription(offer);
      console.log(`${this.getRoleTag()} [WebRTC] Local description set to SDP offer`);

      const localDesc = this.pc.localDescription;
      if (!localDesc) return;

      const movieMids: string[] = [];
      const webcamMids: string[] = [];
      this.pc.getTransceivers().forEach((tc) => {
        if (!tc.mid) return;
        if (this.movieSenders.some((s) => s === tc.sender)) {
          movieMids.push(tc.mid);
        } else if (this.webcamSenders.some((s) => s === tc.sender)) {
          webcamMids.push(tc.mid);
        }
      });

      const meta = {
        movieMids,
        webcamMids,
        movieStreamId: this.localMovieStream?.id || null,
        webcamStreamId: this.localWebcamStream?.id || null,
        movieTrackIds: this.localMovieStream?.getTracks().map((t) => t.id) || [],
        webcamTrackIds: this.localWebcamStream?.getTracks().map((t) => t.id) || [],
      };

      signalingService.sendMessage('sdp-offer', {
        offer: {
          type: localDesc.type,
          sdp: localDesc.sdp,
        },
        ...meta,
      });
      signalingService.sendMessage('stream-meta', meta);
      console.log(`${this.getRoleTag()} [WebRTC] SDP offer and stream metadata sent to peer (movieMids: [${movieMids.join(', ')}], webcamMids: [${webcamMids.join(', ')}])`);
    } catch (err) {
      console.error(`${this.getRoleTag()} [WebRTC] Failed to create offer:`, err);
    } finally {
      this.isMakingOffer = false;
    }
  }

  private async handleOffer(payload: any) {
    if (!this.pc) return;

    const offer = payload.offer || payload;
    this.handleStreamMeta(payload);

    try {
      const offerCollision = this.isMakingOffer || this.pc.signalingState !== 'stable';
      this.ignoreOffer = !this.isPolite && offerCollision;

      if (this.ignoreOffer) {
        console.warn(`${this.getRoleTag()} [WebRTC] SDP Glare collision detected! Impolite Host ignoring incoming offer.`);
        return;
      }

      if (offerCollision && this.isPolite) {
        console.log(`${this.getRoleTag()} [WebRTC] SDP Glare collision detected! Polite Guest rolling back local offer.`);
        await this.pc.setLocalDescription({ type: 'rollback' });
      }

      console.log(`${this.getRoleTag()} [WebRTC] Handling incoming SDP offer...`);
      await this.pc.setRemoteDescription(new RTCSessionDescription(offer));
      console.log(`${this.getRoleTag()} [WebRTC] Remote description set to SDP offer`);

      await this.drainPendingCandidates();

      if (this.pc.signalingState !== 'have-remote-offer') {
        console.warn(`${this.getRoleTag()} [WebRTC] Unexpected signalingState '${this.pc.signalingState}' after setRemoteDescription, skipping answer`);
        return;
      }

      console.log(`${this.getRoleTag()} [WebRTC] Creating SDP answer...`);
      const answer = await this.pc.createAnswer();
      await this.pc.setLocalDescription(answer);
      console.log(`${this.getRoleTag()} [WebRTC] Local description set to SDP answer`);

      const localAnswerDesc = this.pc.localDescription;
      if (!localAnswerDesc) return;

      signalingService.sendMessage('sdp-answer', {
        answer: {
          type: localAnswerDesc.type,
          sdp: localAnswerDesc.sdp,
        },
      });
      console.log(`${this.getRoleTag()} [WebRTC] SDP answer sent to peer`);

      if (this.pc.iceConnectionState === 'connected' || this.pc.iceConnectionState === 'completed') {
        this.options?.onStepChange?.('connected', 'Peer Connected');
      }
    } catch (err) {
      console.error(`${this.getRoleTag()} [WebRTC] Failed to handle offer:`, err);
    }
  }

  private async handleAnswer(payload: any) {
    if (!this.pc) return;
    const answer = payload.answer || payload;

    if (this.ignoreOffer) {
      return;
    }

    try {
      console.log(`${this.getRoleTag()} [WebRTC] Handling incoming SDP answer...`);
      if (this.pc.signalingState !== 'have-local-offer') {
        console.warn(`${this.getRoleTag()} [WebRTC] Received answer but signalingState is '${this.pc.signalingState}', ignoring`);
        return;
      }

      await this.pc.setRemoteDescription(new RTCSessionDescription(answer));
      console.log(`${this.getRoleTag()} [WebRTC] Remote description set to SDP answer. Signaling stable.`);

      if (this.pc.iceConnectionState === 'connected' || this.pc.iceConnectionState === 'completed') {
        this.options?.onStepChange?.('connected', 'Peer Connected');
      }

      await this.drainPendingCandidates();

      if (this.needsRenegotiation) {
        this.needsRenegotiation = false;
        setTimeout(() => this.initiateOffer(), 150);
      }
    } catch (err) {
      console.error(`${this.getRoleTag()} [WebRTC] Failed to handle answer:`, err);
    }
  }

  private async handleCandidate(candidate: RTCIceCandidateInit) {
    if (!candidate) return;

    if (!this.pc || !this.pc.remoteDescription || !this.pc.remoteDescription.type) {
      console.log(`${this.getRoleTag()} [WebRTC] Buffering remote ICE candidate (waiting for remote description)`);
      this.pendingCandidates.push(candidate);
      return;
    }

    try {
      await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
      console.log(`${this.getRoleTag()} [WebRTC] Added remote ICE candidate`);
    } catch (err) {
      if (!this.ignoreOffer) {
        console.error(`${this.getRoleTag()} [WebRTC] Error adding ICE candidate:`, err);
      }
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

  public handlePeerJoined() {
    if (!this.peerJoined) {
      this.peerJoined = true;
      console.log(`${this.getRoleTag()} [WebRTC] Peer joined room.`);
      if (this.options?.isHost) {
        this.options?.onStepChange?.('guest-joined', 'Guest detected, initiating offer...');
        setTimeout(() => {
          this.initiateOffer();
        }, 300);
      } else {
        this.options?.onStepChange?.('exchanging-signaling', 'Connected to host signaling channel');
      }
    } else if (this.options?.isHost && this.pc && this.pc.signalingState === 'stable' && this.pc.connectionState !== 'connected') {
      // Re-trigger offer if connection is not yet established
      console.log(`${this.getRoleTag()} [WebRTC] Peer is in room and PC is stable, ensuring offer is sent...`);
      setTimeout(() => {
        this.initiateOffer();
      }, 200);
    }
  }

  public async restartIce() {
    if (!this.pc || !this.options) return;

    if (!this.options.isHost) {
      console.log(`${this.getRoleTag()} [WebRTC] Guest requesting ICE restart from Host`);
      signalingService.sendMessage('request-ice-restart', {});
      return;
    }

    console.log(`${this.getRoleTag()} [WebRTC] Host initiating ICE restart...`);
    this.initiateOffer(true);
  }

  public async reconnect() {
    console.log(`${this.getRoleTag()} [WebRTC] Executing complete peer connection rebuild...`);
    this.options?.onStepChange?.('establishing-peer-connection', 'Rebuilding connection...');

    this.movieSenders = [];
    this.webcamSenders = [];
    this.createPeerConnection();

    if (this.localWebcamStream) {
      this.attachLocalWebcamStream(this.localWebcamStream);
    }
    if (this.options?.isHost && this.attachedVideoElement) {
      this.attachLocalMovieStream(this.attachedVideoElement);
    }

    if (this.options?.isHost) {
      setTimeout(() => this.initiateOffer(), 300);
    }
  }

  public attachLocalWebcamStream(stream: MediaStream) {
    this.localWebcamStream = stream;
    if (!this.pc) return;

    let needsOffer = false;

    stream.getTracks().forEach((track) => {
      const existingSender = this.webcamSenders.find((s) => s.track?.kind === track.kind);
      if (existingSender) {
        if (existingSender.track?.id !== track.id) {
          console.log(`${this.getRoleTag()} [WebRTC] Replacing webcam ${track.kind} track without renegotiation`);
          existingSender.replaceTrack(track).catch(console.warn);
        }
      } else {
        try {
          const sender = this.pc!.addTrack(track, stream);
          this.webcamSenders.push(sender);
          needsOffer = true;
          console.log(`${this.getRoleTag()} [WebRTC] Added webcam track to PC: kind=${track.kind}, id=${track.id}`);
        } catch (e) {
          console.error(`${this.getRoleTag()} [WebRTC] Failed to add webcam track:`, e);
        }
      }
    });

    const meta = {
      webcamStreamId: stream.id,
      webcamTrackIds: stream.getTracks().map((t) => t.id),
      movieStreamId: this.localMovieStream?.id || null,
      movieTrackIds: this.localMovieStream?.getTracks().map((t) => t.id) || [],
    };
    signalingService.sendMessage('stream-meta', meta);

    if (needsOffer && this.options?.isHost && this.peerJoined && this.pc.signalingState === 'stable') {
      this.initiateOffer();
    }
  }

  public attachLocalMovieStream(videoElement: HTMLVideoElement): MediaStream | null {
    try {
      this.attachedVideoElement = videoElement;

      // 1. Capture video track using captureStream(30) if not already captured
      let capturedStream: MediaStream | null = null;
      let videoTrack: MediaStreamTrack | undefined;
      let audioTrack: MediaStreamTrack | undefined;

      if (this.localMovieStream && this.localMovieStream.getVideoTracks().length > 0) {
        videoTrack = this.localMovieStream.getVideoTracks()[0];
        audioTrack = this.localMovieStream.getAudioTracks()[0];
      } else {
        if (typeof (videoElement as any).captureStream === 'function') {
          capturedStream = (videoElement as any).captureStream(30);
        } else if (typeof (videoElement as any).mozCaptureStream === 'function') {
          capturedStream = (videoElement as any).mozCaptureStream(30);
        }

        if (!capturedStream) {
          console.warn(`${this.getRoleTag()} [WebRTC] video.captureStream() is not supported in this browser`);
          return null;
        }

        videoTrack = capturedStream.getVideoTracks()[0];
        audioTrack = capturedStream.getAudioTracks()[0];
      }

      // 2. Fallback: Web Audio API capture directly from videoElement
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
      if (!this.localMovieStream) {
        this.localMovieStream = new MediaStream();
      }
      if (videoTrack && !this.localMovieStream.getVideoTracks().some((t) => t.id === videoTrack.id)) {
        this.localMovieStream.addTrack(videoTrack);
      }
      if (audioTrack && !this.localMovieStream.getAudioTracks().some((t) => t.id === audioTrack.id)) {
        this.localMovieStream.addTrack(audioTrack);
      }

      const movieStream = this.localMovieStream;
      console.log(`${this.getRoleTag()} [WebRTC] Local movie stream prepared: tracks=${movieStream.getTracks().length} (video=${!!videoTrack}, audio=${!!audioTrack})`);

      // 4. Listen for dynamically added audio tracks when playback starts
      if (capturedStream) {
        capturedStream.onaddtrack = (event) => {
          console.log(`${this.getRoleTag()} [WebRTC] captureStream dynamically added track: kind=${event.track.kind}, id=${event.track.id}`);
          if (event.track.kind === 'audio' && !this.localMovieStream?.getAudioTracks().length) {
            this.localMovieStream?.addTrack(event.track);
            if (this.pc) {
              const existingAudioSender = this.movieSenders.find((s) => s.track?.kind === 'audio');
              if (existingAudioSender) {
                existingAudioSender.replaceTrack(event.track).catch(console.warn);
              } else {
                try {
                  const sender = this.pc.addTrack(event.track, this.localMovieStream!);
                  this.movieSenders.push(sender);
                  this.initiateOffer();
                } catch (e) {
                  console.error(`${this.getRoleTag()} [WebRTC] Error adding dynamic movie audio track:`, e);
                }
              }
            }
          }
        };
      }

      if (!this.pc) return movieStream;

      // 5. Intelligent sender management: Use replaceTrack on existing senders to prevent transceiver churn!
      let needsOffer = false;

      if (videoTrack) {
        const existingVideoSender = this.movieSenders.find(
          (s) => s.track?.kind === 'video' || (s as any).kind === 'video'
        );
        if (existingVideoSender) {
          if (existingVideoSender.track?.id !== videoTrack.id) {
            console.log(`${this.getRoleTag()} [WebRTC] Seamlessly replacing video track on existing sender`);
            existingVideoSender.replaceTrack(videoTrack).catch(console.warn);
          }
        } else {
          try {
            const sender = this.pc.addTrack(videoTrack, movieStream);
            this.movieSenders.push(sender);
            needsOffer = true;
            console.log(`${this.getRoleTag()} [WebRTC] Added movie video track to PC: id=${videoTrack.id}`);
          } catch (err) {
            console.error(`${this.getRoleTag()} [WebRTC] Error adding movie video track:`, err);
          }
        }
      }

      if (audioTrack) {
        const existingAudioSender = this.movieSenders.find(
          (s) => s.track?.kind === 'audio' || (s as any).kind === 'audio'
        );
        if (existingAudioSender) {
          if (existingAudioSender.track?.id !== audioTrack.id) {
            console.log(`${this.getRoleTag()} [WebRTC] Seamlessly replacing audio track on existing sender`);
            existingAudioSender.replaceTrack(audioTrack).catch(console.warn);
          }
        } else {
          try {
            const sender = this.pc.addTrack(audioTrack, movieStream);
            this.movieSenders.push(sender);
            needsOffer = true;
            console.log(`${this.getRoleTag()} [WebRTC] Added movie audio track to PC: id=${audioTrack.id}`);
          } catch (err) {
            console.error(`${this.getRoleTag()} [WebRTC] Error adding movie audio track:`, err);
          }
        }
      }

      // 6. Broadcast stream metadata
      const meta = {
        movieStreamId: movieStream.id,
        movieTrackIds: movieStream.getTracks().map((t) => t.id),
        webcamStreamId: this.localWebcamStream?.id || null,
        webcamTrackIds: this.localWebcamStream?.getTracks().map((t) => t.id) || [],
      };
      signalingService.sendMessage('stream-meta', meta);

      // 7. Renegotiate only if new tracks were added to the peer connection
      if (needsOffer && this.options?.isHost) {
        if (this.pc.signalingState === 'stable' && !this.isMakingOffer) {
          this.initiateOffer();
        } else {
          this.needsRenegotiation = true;
        }
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
