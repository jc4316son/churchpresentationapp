import { io, Socket } from 'socket.io-client';

class SocketService {
  private socket: Socket | null = null;
  private updateHandlers: Set<Function> = new Set();
  private disconnectHandlers: Set<Function> = new Set();
  private reconnectHandlers: Set<Function> = new Set();
  private connectionPromise: Promise<void> | null = null;
  private retryAttempts = 0;
  private maxRetries = 5;
  private connectionTimeout: number = 20000;
  private reconnectionDelay: number = 1000;
  private isConnecting: boolean = false;
  private lastError: Error | null = null;
  private cleanupFunctions: Array<() => void> = [];

  private getSocketUrl(): string {
    try {
      // Always use explicit protocol and port in development
      if (import.meta.env.DEV) {
        return 'ws://localhost:3001';
      }
      
      // In production, derive from window.location
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.hostname;
      const port = window.location.port ? `:${window.location.port}` : '';
      return `${protocol}//${host}${port}`;
    } catch (error) {
      console.error('Error getting socket URL:', error);
      throw new Error('Failed to determine socket URL');
    }
  }

  private async waitForConnection(timeout: number = 5000): Promise<void> {
    if (this.lastError) {
      throw this.lastError;
    }

    return new Promise((resolve, reject) => {
      if (this.socket?.connected) {
        resolve();
        return;
      }

      const timeoutId = setTimeout(() => {
        reject(new Error('Wait for connection timeout'));
      }, timeout);

      const checkConnection = setInterval(() => {
        if (this.socket?.connected) {
          clearTimeout(timeoutId);
          clearInterval(checkConnection);
          resolve();
        } else if (this.lastError) {
          clearTimeout(timeoutId);
          clearInterval(checkConnection);
          reject(this.lastError);
        }
      }, 100);

      this.cleanupFunctions.push(() => {
        clearTimeout(timeoutId);
        clearInterval(checkConnection);
      });
    });
  }

  public async connect(): Promise<void> {
    if (this.socket?.connected) return;
    if (this.connectionPromise) return this.connectionPromise;
    if (this.isConnecting) {
      await new Promise(resolve => setTimeout(resolve, 100));
      return this.connect();
    }

    this.isConnecting = true;
    this.cleanup();
    this.lastError = null;

    this.connectionPromise = new Promise((resolve, reject) => {
      try {
        if (this.socket) {
          this.socket.removeAllListeners();
          this.socket.disconnect();
          this.socket = null;
        }

        const timeoutId = setTimeout(() => {
          this.lastError = new Error('Connection timeout');
          this.isConnecting = false;
          if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
          }
          reject(this.lastError);
        }, this.connectionTimeout);

        this.cleanupFunctions.push(() => clearTimeout(timeoutId));

        const socketUrl = this.getSocketUrl();
        console.log('Connecting to socket URL:', socketUrl);

        this.socket = io(socketUrl, {
          transports: ['websocket'],
          reconnection: true,
          reconnectionAttempts: this.maxRetries,
          reconnectionDelay: this.reconnectionDelay,
          timeout: this.connectionTimeout,
          autoConnect: false,
          forceNew: true,
          path: '/socket.io',
          auth: {
            timestamp: Date.now()
          }
        });

        this.socket.on('connect', () => {
          console.log('Socket connected:', this.socket?.id);
          clearTimeout(timeoutId);
          this.retryAttempts = 0;
          this.reconnectHandlers.forEach(handler => handler());
          resolve();
        });

        this.socket.on('connect_error', (error) => {
          console.error('Socket connect_error:', error);
          this.lastError = error;
        });

        this.socket.on('connect_timeout', (timeout) => {
          console.error('Socket connect_timeout:', timeout);
          this.lastError = new Error('Connection timeout');
        });

        this.socket.on('error', (error) => {
          console.error('Socket error:', error);
          this.lastError = error;
        });

        this.socket.on('disconnect', (reason) => {
          console.log('Socket disconnected:', reason);
          this.disconnectHandlers.forEach(handler => handler());
        });

        this.socket.on('presentationUpdate', (data) => {
          console.log('Received presentation update:', data);
          this.updateHandlers.forEach(handler => handler(data));
        });

        this.socket.connect();

      } catch (error) {
        console.error('Socket initialization error:', error);
        this.lastError = error instanceof Error ? error : new Error('Unknown error');
        this.isConnecting = false;
        this.connectionPromise = null;
        this.socket = null;
        reject(this.lastError);
      }
    }).finally(() => {
      this.connectionPromise = null;
      this.isConnecting = false;
    });

    return this.connectionPromise;
  }

  public disconnect(): void {
    try {
      console.log('Disconnecting socket...');
      this.cleanup();
      if (this.socket) {
        this.socket.removeAllListeners();
        this.socket.disconnect();
        this.socket = null;
      }
      this.connectionPromise = null;
      this.isConnecting = false;
      this.lastError = null;
      this.retryAttempts = 0;
    } catch (error) {
      console.error('Error during disconnect:', error);
    }
  }

  private cleanup(): void {
    this.cleanupFunctions.forEach(cleanup => {
      try {
        cleanup();
      } catch (error) {
        console.error('Cleanup error:', error);
      }
    });
    this.cleanupFunctions = [];
  }

  public async registerPresentation(): Promise<void> {
    try {
      if (!this.socket?.connected) {
        await this.connect();
      }
      console.log('Registering presentation window');
      return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          reject(new Error('Registration timeout'));
        }, 5000);

        this.socket?.emit('registerPresentation', null, (response: any) => {
          clearTimeout(timeoutId);
          if (response?.error) {
            reject(new Error(response.error));
          } else {
            resolve();
          }
        });
      });
    } catch (error) {
      console.error('Failed to register presentation:', error);
      throw error;
    }
  }

  public async registerControl(): Promise<void> {
    try {
      if (!this.socket?.connected) {
        await this.connect();
      }
      console.log('Registering control panel');
      return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          reject(new Error('Registration timeout'));
        }, 5000);

        this.socket?.emit('registerControl', null, (response: any) => {
          clearTimeout(timeoutId);
          if (response?.error) {
            reject(new Error(response.error));
          } else {
            resolve();
          }
        });
      });
    } catch (error) {
      console.error('Failed to register control:', error);
      throw error;
    }
  }

  public async sendUpdate(data: any): Promise<void> {
    try {
      if (!this.socket?.connected) {
        await this.connect();
      }
      return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          reject(new Error('Update timeout'));
        }, 5000);

        this.socket?.emit('presentationUpdate', data, (response: any) => {
          clearTimeout(timeoutId);
          if (response?.error) {
            reject(new Error(response.error));
          } else {
            resolve();
          }
        });
      });
    } catch (error) {
      console.error('Error sending update:', error);
      throw error;
    }
  }

  public onUpdate(handler: Function): () => void {
    this.updateHandlers.add(handler);
    return () => this.updateHandlers.delete(handler);
  }

  public onDisconnect(handler: Function): () => void {
    this.disconnectHandlers.add(handler);
    return () => this.disconnectHandlers.delete(handler);
  }

  public onReconnect(handler: Function): () => void {
    this.reconnectHandlers.add(handler);
    return () => this.reconnectHandlers.delete(handler);
  }

  public isConnected(): boolean {
    return this.socket?.connected ?? false;
  }

  public getId(): string | null {
    return this.socket?.id ?? null;
  }
}

export const socketService = new SocketService();