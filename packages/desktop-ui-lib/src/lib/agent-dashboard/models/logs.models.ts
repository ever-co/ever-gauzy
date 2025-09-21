export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
export type SyncStatus = 'PENDING' | 'SYNCED' | 'FAILED';

export interface LogEntry {
  id: string;
  ts: string;
  level: LogLevel;
  msg: string;
}

export interface QueueItem {
  id: string;
  createdAt: string;
  type: string;
  sizeBytes?: number;
  retries: number;
  status: SyncStatus;
  errorMessage?: string;
}

export interface SyncHealth {
  queueLength: number;
  lastSuccessAt?: string;
  apiReachable: boolean;
}
