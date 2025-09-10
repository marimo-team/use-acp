import {
  createWebSocketReadableStream,
  createWebSocketWritableStream,
  type NodeReadableStream,
} from "../components/streams.js";
import type { ConnectionState } from "../state/types.js";

export interface WebSocketManagerOptions {
  url: string;
  onConnectionStateChange: (state: ConnectionState) => void;
  onError: (error: Error) => void;
  reconnectAttempts?: number;
  reconnectDelay?: number;
}

export interface MultiWebSocketManagerOptions {
  onConnectionStateChange: (state: ConnectionState, url: string) => void;
  onError: (error: Error, url: string) => void;
  reconnectAttempts?: number;
  reconnectDelay?: number;
}

export class MultiWebSocketManager {
  private managers = new Map<string, WebSocketManager>();
  private options: MultiWebSocketManagerOptions;
  private currentUrl: string | null = null;

  constructor(options: MultiWebSocketManagerOptions) {
    this.options = options;
  }

  async connect(
    url: string,
  ): Promise<{ readable: NodeReadableStream; writable: WritableStream<Uint8Array> }> {
    this.currentUrl = url;

    let manager = this.managers.get(url);

    if (manager) {
      const state = manager.getConnectionState();
      if (state === "connected") {
        const streams = manager.getStreams();
        if (streams) {
          return streams;
        }
      }
    } else {
      manager = new WebSocketManager({
        url,
        onConnectionStateChange: (state) => this.options.onConnectionStateChange(state, url),
        onError: (error) => this.options.onError(error, url),
        reconnectAttempts: this.options.reconnectAttempts,
        reconnectDelay: this.options.reconnectDelay,
      });
      this.managers.set(url, manager);
    }

    return await manager.connect();
  }

  disconnect(url?: string) {
    if (url) {
      const manager = this.managers.get(url);
      if (manager) {
        manager.disconnect();
        this.managers.delete(url);
      }
    } else {
      for (const [managerUrl, manager] of this.managers.entries()) {
        manager.disconnect();
        this.managers.delete(managerUrl);
      }
      this.currentUrl = null;
    }
  }

  getCurrentUrl(): string | null {
    return this.currentUrl;
  }

  getConnectionState(url?: string): ConnectionState["status"] {
    const targetUrl = url || this.currentUrl;
    if (!targetUrl) return "disconnected";

    const manager = this.managers.get(targetUrl);
    return manager ? manager.getConnectionState() : "disconnected";
  }

  getActiveConnections(): string[] {
    return Array.from(this.managers.keys()).filter(
      (url) => this.managers.get(url)?.getConnectionState() === "connected",
    );
  }
}

export class WebSocketManager {
  private ws: WebSocket | null = null;
  private options: WebSocketManagerOptions;
  private reconnectCount = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private readableStream: NodeReadableStream | null = null;
  private writableStream: WritableStream<Uint8Array> | null = null;

  constructor(options: WebSocketManagerOptions) {
    this.options = {
      reconnectAttempts: 3,
      reconnectDelay: 1000,
      ...options,
    };
  }

  async connect(): Promise<{ readable: NodeReadableStream; writable: WritableStream<Uint8Array> }> {
    this.updateConnectionState({ status: "connecting", url: this.options.url });

    try {
      this.ws = new WebSocket(this.options.url);

      return new Promise((resolve, reject) => {
        if (!this.ws) {
          reject(new Error("WebSocket not initialized"));
          return;
        }

        this.ws.onopen = () => {
          this.reconnectCount = 0;
          this.updateConnectionState({ status: "connected", url: this.options.url });

          if (this.ws) {
            this.readableStream = createWebSocketReadableStream(this.ws);
            this.writableStream = createWebSocketWritableStream(this.ws);

            resolve({
              readable: this.readableStream,
              writable: this.writableStream,
            });
          }
        };

        this.ws.onerror = (_event) => {
          const error = new Error("WebSocket connection error");
          this.options.onError(error);
          this.updateConnectionState({
            status: "error",
            error: error.message,
            url: this.options.url,
          });
          reject(error);
        };

        this.ws.onclose = () => {
          this.updateConnectionState({ status: "disconnected", url: this.options.url });
          this.attemptReconnect();
        };
      });
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      this.options.onError(errorObj);
      this.updateConnectionState({
        status: "error",
        error: errorObj.message,
        url: this.options.url,
      });
      throw errorObj;
    }
  }

  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.readableStream = null;
    this.writableStream = null;
    this.updateConnectionState({ status: "disconnected" });
  }

  private attemptReconnect() {
    if (this.reconnectCount < (this.options.reconnectAttempts || 3)) {
      this.reconnectCount++;
      this.reconnectTimer = setTimeout(async () => {
        try {
          await this.connect();
        } catch (_error) {
          // Error is already handled in connect method
        }
      }, this.options.reconnectDelay);
    }
  }

  private updateConnectionState(state: ConnectionState) {
    this.options.onConnectionStateChange(state);
  }

  getConnectionState(): ConnectionState["status"] {
    if (!this.ws) return "disconnected";

    switch (this.ws.readyState) {
      case WebSocket.CONNECTING:
        return "connecting";
      case WebSocket.OPEN:
        return "connected";
      case WebSocket.CLOSING:
      case WebSocket.CLOSED:
        return "disconnected";
      default:
        return "error";
    }
  }

  getStreams(): { readable: NodeReadableStream; writable: WritableStream<Uint8Array> } | null {
    if (this.readableStream && this.writableStream) {
      return {
        readable: this.readableStream,
        writable: this.writableStream,
      };
    }
    return null;
  }
}
