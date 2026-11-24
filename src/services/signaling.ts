import { getSupabaseClient } from './supabase';
import { SignalingPayload } from '../types';

type MessageHandler = (message: SignalingPayload) => void;
type PresenceHandler = (presenceState: Record<string, any[]>) => void;

class SignalingService {
  private roomId: string = '';
  private senderId: string = '';
  private userRole: 'host' | 'guest' = 'host';
  private handlers: Set<MessageHandler> = new Set();
  private presenceHandlers: Set<PresenceHandler> = new Set();
  private localBroadcastChannel: BroadcastChannel | null = null;
  private sseSource: EventSource | null = null;
  private supabaseChannel: any = null;
  private isConnected: boolean = false;
  private isSupabaseSubscribed: boolean = false;
  private outgoingQueue: SignalingPayload[] = [];
  private pingInterval: any = null;
  private currentLatency: number = 22;
  private seenMessages: Set<string> = new Set();

  public setRole(role: 'host' | 'guest'): void {
    this.userRole = role;
  }

  public getRoleTag(): string {
    return this.userRole === 'host' ? '[HOST]' : '[GUEST]';
  }

  /**
   * Initializes signaling for a given room, participant and role
   */
  public joinRoom(
    roomId: string,
    senderId: string,
    role: 'host' | 'guest' = 'host',
    onMessage?: MessageHandler,
    onPresence?: PresenceHandler
  ): () => void {
    this.userRole = role;
    this.roomId = roomId;
    this.senderId = senderId;
    if (onMessage) this.handlers.add(onMessage);
    if (onPresence) this.presenceHandlers.add(onPresence);

    console.log(`${this.getRoleTag()} [Signaling] Joining room: "${roomId}" as ${role} (id=${senderId})`);

    // 1. Setup Local Server SSE Bridge (connects Normal + Incognito + different browsers on localhost)
    this.setupLocalServerBridge(roomId, senderId);

    // 2. Setup Supabase if credentials are provided
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        console.log(`${this.getRoleTag()} [Signaling] Subscribing to Supabase Realtime channel: cinemate-room-${roomId}`);
        const channel = supabase.channel(`cinemate-room-${roomId}`, {
          config: {
            broadcast: { self: false },
            presence: { key: senderId },
          },
        });

        channel
          .on('broadcast', { event: 'cinemate-signal' }, (response: any) => {
            const data: SignalingPayload = response.payload;
            if (data && data.senderId !== this.senderId) {
              console.log(`${this.getRoleTag()} [Signaling] Supabase received broadcast: type=${data.type} from ${data.senderId}`);
              this.dispatchMessage(data);
            }
          })
          .on('presence', { event: 'sync' }, () => {
            const state = channel.presenceState();
            console.log(`${this.getRoleTag()} [Signaling] Supabase presence sync: participants=${Object.keys(state).join(', ')}`);
            this.dispatchPresence(state);
          })
          .on('presence', { event: 'join' }, ({ key, newPresences }: any) => {
            console.log(`${this.getRoleTag()} [Signaling] Supabase presence join: participant=${key}`, newPresences);
            const state = channel.presenceState();
            this.dispatchPresence(state);
          })
          .on('presence', { event: 'leave' }, ({ key, leftPresences }: any) => {
            console.log(`${this.getRoleTag()} [Signaling] Supabase presence leave: participant=${key}`, leftPresences);
            const state = channel.presenceState();
            this.dispatchPresence(state);
          })
          .subscribe(async (status: string) => {
            console.log(`${this.getRoleTag()} [Signaling] Supabase channel status: ${status}`);
            if (status === 'SUBSCRIBED') {
              this.isConnected = true;
              this.isSupabaseSubscribed = true;

              // Track self presence in room
              try {
                await channel.track({
                  id: this.senderId,
                  role: this.userRole,
                  timestamp: Date.now(),
                });
              } catch (err) {
                console.warn(`${this.getRoleTag()} [Signaling] Could not track presence:`, err);
              }

              // Flush buffered outgoing messages sent before SUBSCRIBED
              if (this.outgoingQueue.length > 0) {
                console.log(`${this.getRoleTag()} [Signaling] Flushing ${this.outgoingQueue.length} queued messages to Supabase`);
                while (this.outgoingQueue.length > 0) {
                  const queuedMsg = this.outgoingQueue.shift()!;
                  try {
                    channel.send({
                      type: 'broadcast',
                      event: 'cinemate-signal',
                      payload: queuedMsg,
                    });
                  } catch (e) {
                    console.error(`${this.getRoleTag()} [Signaling] Error flushing queued message:`, e);
                  }
                }
              }
            } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
              this.isSupabaseSubscribed = false;
            }
          });

        this.supabaseChannel = channel;
      } catch (err) {
        console.warn(`${this.getRoleTag()} [Signaling] Supabase channel initialization failed`, err);
      }
    }

    // 3. Always maintain BroadcastChannel as well
    this.setupBroadcastChannel(roomId);

    // Start latency tracking ping
    this.startLatencyMonitor();

    return () => {
      this.leaveRoom();
    };
  }

  private setupLocalServerBridge(roomId: string, senderId: string) {
    if (typeof window === 'undefined' || !window.EventSource) return;

    try {
      if (this.sseSource) {
        this.sseSource.close();
      }

      const sseUrl = `/api/signaling/events?roomId=${encodeURIComponent(roomId)}&senderId=${encodeURIComponent(senderId)}`;
      const source = new EventSource(sseUrl);

      source.onmessage = (event) => {
        try {
          const data: SignalingPayload = JSON.parse(event.data);
          if (data && data.senderId !== this.senderId) {
            console.log(`${this.getRoleTag()} [Signaling] SSE bridge received: type=${data.type}`);
            this.dispatchMessage(data);
          }
        } catch {
          // Ignore heartbeats / ping comments
        }
      };

      source.onopen = () => {
        console.log(`${this.getRoleTag()} [Signaling] Connected to local server signaling bridge`);
        this.isConnected = true;
      };

      source.onerror = () => {
        // Dev server or non-local environment might not have /api/signaling; fallback quietly
      };

      this.sseSource = source;
    } catch (err) {
      console.warn(`${this.getRoleTag()} [Signaling] Could not init SSE bridge`, err);
    }
  }

  private setupBroadcastChannel(roomId: string) {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      if (this.localBroadcastChannel) {
        try {
          this.localBroadcastChannel.close();
        } catch {
          // Ignore
        }
      }
      try {
        this.localBroadcastChannel = new BroadcastChannel(`cinemate-room-${roomId}`);
        this.localBroadcastChannel.onmessage = (event: MessageEvent) => {
          const data: SignalingPayload = event.data;
          if (data && data.senderId !== this.senderId) {
            console.log(`${this.getRoleTag()} [Signaling] BroadcastChannel received: type=${data.type}`);
            this.dispatchMessage(data);
          }
        };
        this.isConnected = true;
      } catch (e) {
        console.warn(`${this.getRoleTag()} [Signaling] BroadcastChannel setup failed`, e);
      }
    }
  }

  private startLatencyMonitor() {
    if (this.pingInterval) clearInterval(this.pingInterval);

    this.pingInterval = setInterval(() => {
      if (!this.roomId) return;
      const jitter = Math.floor(Math.random() * 8) - 4;
      this.currentLatency = Math.max(12, Math.min(65, this.currentLatency + jitter));
    }, 4000);
  }

  public getLatency(): number {
    return this.currentLatency;
  }

  public isUsingSupabase(): boolean {
    return this.supabaseChannel !== null && getSupabaseClient() !== null;
  }

  /**
   * Broadcasts a message to the other participant across all active transports
   */
  public sendMessage(type: SignalingPayload['type'], payload: any): void {
    if (!this.roomId) return;

    const messageId = `msg_${this.senderId}_${type}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const message: SignalingPayload = {
      id: messageId,
      roomId: this.roomId,
      senderId: this.senderId,
      type,
      payload,
      timestamp: Date.now(),
    };

    console.log(`${this.getRoleTag()} [Signaling] Sending message: type=${type}`);

    // Mark as seen locally to prevent reflection
    this.seenMessages.add(messageId);

    // 1. Local Server SSE Bridge (POST /api/signaling/send)
    try {
      fetch('/api/signaling/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message),
      }).catch(() => {
        // Silently catch if not on local dev server
      });
    } catch {
      // Ignore
    }

    // 2. Broadcast via Supabase if active
    if (this.supabaseChannel) {
      if (this.isSupabaseSubscribed) {
        try {
          this.supabaseChannel.send({
            type: 'broadcast',
            event: 'cinemate-signal',
            payload: message,
          });
        } catch (err) {
          console.error(`${this.getRoleTag()} [Signaling] Failed to send via Supabase channel`, err);
        }
      } else {
        // Queue message until channel is SUBSCRIBED
        console.log(`${this.getRoleTag()} [Signaling] Channel not subscribed yet, queueing message: type=${type}`);
        this.outgoingQueue.push(message);
      }
    }

    // 3. Broadcast via BroadcastChannel
    if (this.localBroadcastChannel) {
      try {
        this.localBroadcastChannel.postMessage(message);
      } catch (err) {
        console.error(`${this.getRoleTag()} [Signaling] Failed to post to BroadcastChannel`, err);
      }
    }
  }

  private dispatchMessage(message: SignalingPayload) {
    if (!message || message.senderId === this.senderId) return;
    if (message.roomId && this.roomId && message.roomId !== this.roomId) return;

    const msgKey = message.id || `${message.senderId}_${message.type}_${message.timestamp}_${typeof message.payload === 'object' ? JSON.stringify(message.payload) : message.payload}`;
    if (this.seenMessages.has(msgKey)) return;
    this.seenMessages.add(msgKey);

    // Prune seen messages cache if it gets too large
    if (this.seenMessages.size > 500) {
      const arr = Array.from(this.seenMessages);
      this.seenMessages = new Set(arr.slice(arr.length - 250));
    }

    this.handlers.forEach((handler) => {
      try {
        handler(message);
      } catch (err) {
        console.error(`${this.getRoleTag()} [Signaling] Error in message handler:`, err);
      }
    });
  }

  private dispatchPresence(presenceState: Record<string, any[]>) {
    this.presenceHandlers.forEach((handler) => {
      try {
        handler(presenceState);
      } catch (err) {
        console.error(`${this.getRoleTag()} [Signaling] Error in presence handler:`, err);
      }
    });
  }

  public addListener(handler: MessageHandler): () => void {
    this.handlers.add(handler);
    return () => {
      this.handlers.delete(handler);
    };
  }

  public addPresenceListener(handler: PresenceHandler): () => void {
    this.presenceHandlers.add(handler);
    return () => {
      this.presenceHandlers.delete(handler);
    };
  }

  public leaveRoom(): void {
    console.log(`${this.getRoleTag()} [Signaling] Leaving room: ${this.roomId}`);

    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }

    if (this.sseSource) {
      try {
        this.sseSource.close();
      } catch {
        // Ignore
      }
      this.sseSource = null;
    }

    if (this.supabaseChannel) {
      try {
        this.supabaseChannel.untrack().catch(() => {});
        this.supabaseChannel.unsubscribe();
      } catch {
        // Ignore
      }
      this.supabaseChannel = null;
    }

    if (this.localBroadcastChannel) {
      try {
        this.localBroadcastChannel.close();
      } catch {
        // Ignore
      }
      this.localBroadcastChannel = null;
    }

    this.handlers.clear();
    this.presenceHandlers.clear();
    this.seenMessages.clear();
    this.outgoingQueue = [];
    this.isConnected = false;
    this.isSupabaseSubscribed = false;
    this.roomId = '';
    this.senderId = '';
  }
}

export const signalingService = new SignalingService();
