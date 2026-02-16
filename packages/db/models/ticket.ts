export interface Ticket<TResult = unknown> {
  id: string;
  entityId: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  result?: TResult;
  workerId?: string;
  claimedAt?: string;
  completedAt?: string;
  retryCount: number;
  traceId?: string;
}

export interface BirdSummary {
  title: string;
  extract: string;
  fetchedAt: string;
}

export type BirdTicket = Ticket<BirdSummary>;
