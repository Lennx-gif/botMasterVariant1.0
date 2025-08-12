export interface DatabaseConnectionOptions {
  uri: string;
  maxPoolSize?: number;
  minPoolSize?: number;
  maxIdleTimeMS?: number;
  serverSelectionTimeoutMS?: number;
  socketTimeoutMS?: number;
  connectTimeoutMS?: number;
  retryWrites?: boolean;
}

export interface DatabaseConnection {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  getConnectionState(): string;
}

export class DatabaseError extends Error {
  public readonly code?: string;
  public readonly retryable: boolean;
  
  constructor(message: string, code?: string, retryable: boolean = false) {
    super(message);
    this.name = 'DatabaseError';
    if (code !== undefined) {
      this.code = code;
    }
    this.retryable = retryable;
  }
}